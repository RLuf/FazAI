#!/usr/bin/env node

/*
 * FazAI - Orquestrador Inteligente de Automação
 * Autor: Roger Luft
 * Licença: Creative Commons Attribution 4.0 International (CC BY 4.0)
 * https://creativecommons.org/licenses/by/4.0/
 * Versão: 2.0.0
 */

/**
 * FazAI - Orquestrador Inteligente de Automação
 * Daemon principal
 * 
 * Este arquivo implementa o daemon principal do FazAI, responsável por:
 * - Receber comandos do CLI
 * - Interpretar comandos usando IA
 * - Executar ações no sistema
 * - Gerenciar plugins e módulos
 * - Registrar logs de operações
 */

const express = require('express');
const fs = require('fs');
const path = require('path');
const { exec, spawn } = require('child_process');
let ffi = null;
let multer = null;
try {
  ffi = require('ffi-napi-v22');
} catch (e) {
  // ffi opcional: módulos .so serão ignorados se ausente
}
const axios = require('axios');
const winston = require('winston');
const EventEmitter = require('events');
const crypto = require('crypto');

// Importar módulos de tarefas complexas e MCP
const { ComplexTasksManager } = require('./complex_tasks');
// Corrige caminho do MCP OPNsense (arquivo está em lib/mcp_opnsense.js)
const { MCPOPNsense } = require('./mcp_opnsense');
const { OPNRegistry } = require('./opnsense_registry');
const { doResearch } = require('./core/research');

// Importar handlers do agente inteligente
let agentHandlers = null;
try {
  agentHandlers = require('./handlers/agent');
} catch (error) {
  console.warn('Agent handlers não disponíveis:', error.message);
}

// Importar handlers do relay
let relayHandlers = null;
try {
  relayHandlers = require('./handlers/relay');
} catch (error) {
  console.warn('Relay handlers não disponíveis:', error.message);
}

// Sistema de cache simples em memória
class CacheManager {
  constructor() {
    this.cache = new Map();
    this.maxSize = 1000; // Máximo de 1000 entradas
    this.ttl = 3600000; // 1 hora em ms
  }

  generateKey(command, provider) {
    return crypto.createHash('md5').update(`${command}:${provider}`).digest('hex');
  }

  get(key) {
    const entry = this.cache.get(key);
    if (!entry) return null;
    
    if (Date.now() - entry.timestamp > this.ttl) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.value;
  }

  set(key, value) {
    if (this.cache.size >= this.maxSize) {
      // Remove a entrada mais antiga
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
    }
    
    this.cache.set(key, {
      value,
      timestamp: Date.now()
    });
  }

  clear() {
    this.cache.clear();
  }

  size() {
    return this.cache.size;
  }
}

const cacheManager = new CacheManager();

// Configuração do logger com rotação e níveis
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp({
      format: 'YYYY-MM-DD HH:mm:ss'
    }),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { 
    version: '2.0.0',
    service: 'fazai-daemon'
  },
  transports: [
    // Arquivo principal com rotação
    new winston.transports.File({ 
      filename: '/var/log/fazai/fazai.log',
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5,
      tailable: true
    }),
    // Arquivo de erros separado
    new winston.transports.File({ 
      filename: '/var/log/fazai/fazai-error.log',
      level: 'error',
      maxsize: 5 * 1024 * 1024, // 5MB
      maxFiles: 3
    }),
    // Console com cores
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ]
});

// Configuração do servidor Express + placeholder para WebSocket
const app = express();
const PORT = process.env.PORT || 3120;
let server; // http server será inicializado em FazAIDaemon.start()

// Configuração unificada de provedores de IA
let AI_CONFIG = {
  default_provider: 'gemma_cpp',
  enable_fallback: true,
  fallback_for_simple: false,
  max_retries: 3,
  retry_delay: 2,
  continue_on_error: true,
  enable_architecting: true,
  providers: {
    openrouter: {
      api_key: '',
      endpoint: 'https://openrouter.ai/api/v1',
      default_model: 'openai/gpt-4o',
      temperature: 0.3,
      max_tokens: 2000,
      headers: {
        'HTTP-Referer': 'https://github.com/RLuf/FazAI',
        'X-Title': 'FazAI'
      }
    },
    openai: {
      api_key: '',
      endpoint: 'https://api.openai.com/v1',
      default_model: 'gpt-4-turbo',
      temperature: 0.4,
      max_tokens: 2000
    },
    
    
    ollama: {
      api_key: '',
      endpoint: 'http://127.0.0.1:11434/v1',
      default_model: 'llama3.2:latest',
      temperature: 0.3,
      max_tokens: 2000
    },
    anthropic: {
      api_key: '',
      endpoint: 'https://api.anthropic.com/v1',
      default_model: 'claude-3-opus-20240229',
      temperature: 0.3,
      max_tokens: 2000
    },
    gemini: {
      api_key: '',
      endpoint: 'https://generativelanguage.googleapis.com/v1beta',
      default_model: 'gemini-pro',
      temperature: 0.3,
      max_tokens: 2000
    },
    llama_server: {
      api_key: '',
      endpoint: 'http://127.0.0.1:8080/v1',
      default_model: 'gemma-2b-it',
      temperature: 0.2,
      max_tokens: 2000,
      no_auth: true
    },
    gemma_cpp: {
      api_key: '',
      endpoint: '/opt/fazai/bin/gemma_oneshot',
      default_model: 'gemma2-2b-it',
      // Extras lidos do conf: weights/tokenizer/model
      weights: '/opt/fazai/models/gemma/2.0-2b-it-sfp.sbs',
      tokenizer: '/opt/fazai/models/gemma/tokenizer.spm',
      // Prompt padrão para instruir o modelo local a responder somente com 1 comando shell
      prompt: 'Responda APENAS com um comando shell Linux que atenda ao pedido a seguir. Sem explicações, sem comentários, sem markdown, sem crases. Se houver várias opções, escolha a mais direta e compatível com sistemas Linux comuns. Pedido:',
      temperature: 0.2,
      max_tokens: 1024,
      no_auth: true
    }
  },
  // Ordem de fallback para provedores (Requesty removido)
  fallback_order: ['gemma_cpp', 'llama_server', 'openrouter', 'openai', 'anthropic', 'gemini', 'ollama']
};

// Middleware para processar JSON
app.use(express.json());
// CORS para permitir frontend file:// e outras origens acessarem a API
app.use((req, res, next) => {
  try {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') {
      return res.sendStatus(204);
    }
  } catch (_) {}
  next();
});

// Pesquisa inteligente (Context7 quando disponível)
app.get('/research', async (req, res) => {
  try {
    const q = String(req.query.q || '').trim();
    const max = parseInt(String(req.query.max || '5'), 10) || 5;
    if (!q) return res.status(400).json({ success: false, error: 'query param q é obrigatório' });
    const docs = await doResearch([q], max);
    res.json({ success: true, results: docs });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// Servir frontend web diretamente pelo daemon para evitar problemas com file://
try {
  const staticDir = '/opt/fazai/tools';
  app.use('/web', express.static(staticDir));
  // Página principal (redireciona para Docler se habilitado)
  app.get('/', (req, res) => {
    try {
      const dport = parseInt((config?.docler?.client_port)||process.env.DOCLER_CLIENT_PORT||'3220',10);
      const enabled = (String((config?.docler?.enabled ?? 'true')) === 'true');
      if (enabled) return res.redirect(`http://${req.hostname}:${dport}`);
      return res.redirect('/ui');
    } catch(_) { return res.redirect('/ui'); }
  });
  // UI legada (dev-only) — controlada via conf
  app.get('/ui', (_req, res) => {
    try {
      const enabled = (String((config?.ui_legacy?.enabled ?? 'false')) === 'true');
      if (!enabled) return res.status(404).send('UI legada desabilitada');
      res.sendFile(path.join(staticDir, 'fazai_web_frontend.html'));
    } catch (e) {
      res.status(500).send('Frontend indisponível');
    }
  });
  // Acesso direto a /web sem nome de arquivo
  app.get('/web', (_req, res) => {
    try {
      res.sendFile(path.join(staticDir, 'fazai_web_frontend.html'));
    } catch (e) {
      res.status(500).send('Frontend indisponível');
    }
  });
} catch (e) {
  logger.warn(`Falha ao configurar frontend estático: ${e.message}`);
}

// Uploads (multipart) - configuração de armazenamento
let uploadMw = null;
try {
  multer = require('multer');
  const UPLOAD_DIR = '/var/lib/fazai/uploads';
  try { fs.mkdirSync(UPLOAD_DIR, { recursive: true }); } catch (_) {}
  const storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
    filename: (_req, file, cb) => cb(null, `${Date.now()}_${file.originalname.replace(/[^a-zA-Z0-9_\.-]/g, '_')}`)
  });
  uploadMw = multer({ storage });
} catch (e) {
  logger.warn(`multer indisponível; upload /kb/upload desativado: ${e.message}`);
}

// Diretório de plugins e módulos
const TOOLS_DIR = '/opt/fazai/tools';
const MODS_DIR = '/opt/fazai/mods';

// Cache para plugins e módulos carregados
const loadedTools = {};
const loadedMods = {};

// Instâncias globais dos módulos de tarefas complexas
let complexTasksManager = null;
let mcpOPNsense = null;
let opnRegistry = null;
let alertsConfig = null;
function loadAlertsConfig() {
  try {
    const p = '/etc/fazai/alerts.json';
    if (fs.existsSync(p)) { alertsConfig = JSON.parse(fs.readFileSync(p, 'utf8')); }
    else alertsConfig = { interval_sec: 60, rules: [] };
  } catch (_) { alertsConfig = { interval_sec: 60, rules: [] }; }
}
function saveAlertsConfig() {
  try { const p = '/etc/fazai/alerts.json'; fs.writeFileSync(p, JSON.stringify(alertsConfig, null, 2)); fs.chmodSync(p, 0o600); } catch (_) {}
}

// Telemetria em memória para /metrics
const telemetryStore = new Map(); // hostname -> last payload
let ingestCounter = 0;
const telemetryCounters = {
  suricata_alert_total: new Map(),
  clamav_virus_total: new Map(),
  ingest_total: 0
};
// Tabelas de reputação simples (ocorrências recentes por IP e /24)
const ipStats = { perIp: new Map(), perSubnet24: new Map() };
// Buffer de eventos recentes (para políticas baseadas em janela de tempo)
const telemetryEvents = []; // { ts: epoch_ms, source, event, host }

/**
 * Carrega dinamicamente todos os plugins disponíveis
 */
function loadTools() {
  logger.info('Carregando ferramentas e plugins');

  try {
    const files = fs.readdirSync(TOOLS_DIR);

    files.forEach(file => {
      if (file.endsWith('.js')) {
        try {
          const toolPath = path.join(TOOLS_DIR, file);
          const toolName = file.replace('.js', '');

          // Limpa o cache para garantir que mudanças sejam carregadas
          delete require.cache[require.resolve(toolPath)];

          // Carrega o plugin
          const tool = require(toolPath);
          // Se o plugin declarar que é interativo, não carregar no daemon
          if (tool?.info?.interactive === true && !process.stdin.isTTY) {
            logger.info(`Plugin interativo ignorado no daemon: ${toolName}`);
            return;
          }
          loadedTools[toolName] = tool;

          logger.info(`Plugin carregado: ${toolName}`);
        } catch (err) {
          logger.error(`Erro ao carregar plugin ${file}:`, err);
        }
      }
    });

    // Adicionar ferramentas de tarefas complexas
    if (complexTasksManager) {
      loadedTools['complex_tasks'] = {
        name: 'Complex Tasks Manager',
        description: 'Gerencia tarefas complexas como geração de gráficos, publicação HTTP e extração de dados',
        execute: async (command, params) => {
          return await complexTasksManager.executeTask(command, params);
        },
        info: {
          interactive: false,
          supportedTasks: ['generate_chart', 'publish_chart', 'extract_data', 'create_dashboard', 'monitor_system', 'generate_report']
        }
      };
      logger.info('Ferramenta de tarefas complexas carregada');
    }

    // Adicionar ferramenta MCP OPNsense
    if (mcpOPNsense) {
      loadedTools['opnsense'] = {
        name: 'OPNsense MCP',
        description: 'Gerencia firewall OPNsense via MCP (Model Context Protocol)',
        execute: async (command, params) => {
          return await mcpOPNsense.executeMCPCommand(command, params);
        },
        info: {
          interactive: false,
          supportedCommands: ['get_system_info', 'get_firewall_rules', 'create_firewall_rule', 'start_service', 'apply_config']
        }
      };
      logger.info('Ferramenta MCP OPNsense carregada');
    }
  } catch (err) {
    logger.error('Erro ao ler diretório de plugins:', err);
  }
}

/**
 * Carrega módulos nativos (.so) usando FFI
 */
function loadNativeModules() {
  logger.info('Carregando módulos nativos');

  try {
    if (!ffi) {
      logger.warn('ffi-napi-v22 não disponível; ignorando módulos nativos (.so)');
      return;
    }
    const files = fs.readdirSync(MODS_DIR);

    files.forEach(file => {
      if (file.endsWith('.so')) {
        try {
          const modPath = path.join(MODS_DIR, file);
          const modName = file.replace('.so', '');

          // Define a interface FFI para o módulo
          const mod = ffi.Library(modPath, {
            'fazai_mod_init': ['int', []],
            'fazai_mod_exec': ['int', ['string', 'pointer', 'int']],
            'fazai_mod_cleanup': ['void', []]
          });

          // Inicializa o módulo
          const initResult = mod.fazai_mod_init();
          if (initResult !== 0) {
            throw new Error(`Falha na inicialização do módulo: código ${initResult}`);
          }

          loadedMods[modName] = mod;
          logger.info(`Módulo nativo carregado: ${modName}`);
        } catch (err) {
          logger.error(`Erro ao carregar módulo nativo ${file}:`, err);
        }
      }
    });
  } catch (err) {
    logger.error('Erro ao ler diretório de módulos:', err);
  }
}

/**
 * Inicializa módulos de tarefas complexas
 */
function initializeComplexModules() {
  logger.info('Inicializando módulos de tarefas complexas');

  try {
    // Inicializar Complex Tasks Manager
    complexTasksManager = new ComplexTasksManager({
      port: config.complex_tasks?.port || 8080,
      host: config.complex_tasks?.host || '0.0.0.0',
      staticDir: config.complex_tasks?.static_dir || '/var/www/fazai',
      chartsDir: config.complex_tasks?.charts_dir || '/var/cache/fazai/charts',
      dataDir: config.complex_tasks?.data_dir || '/var/lib/fazai/data'
    });

    // Inicializar servidor HTTP se configurado
    if (false && config.complex_tasks?.enable_server !== false) {
      complexTasksManager.initializeServer()
        .then(() => {
          logger.info('Servidor de tarefas complexas iniciado com sucesso');
        })
        .catch(err => {
          logger.error('Erro ao iniciar servidor de tarefas complexas:', err);
        });
    }

    // Inicializar MCP OPNsense se configurado
    try { opnRegistry = new OPNRegistry(); logger.info('Registro OPNsense carregado'); } catch (e) { logger.warn(`Falha ao carregar registro OPNsense: ${e.message}`); }
    loadAlertsConfig();
    if (config.opnsense?.enabled) {
      try {
        mcpOPNsense = new MCPOPNsense({
          host: config.opnsense.host,
          port: config.opnsense.port || 443,
          username: config.opnsense.username,
          password: config.opnsense.password,
          apiKey: config.opnsense.api_key,
          useSSL: config.opnsense.use_ssl !== false
        });
        logger.info('MCP OPNsense inicializado (modo único)');
      } catch (e) { logger.warn(`MCP OPNsense indisponível: ${e.message}`); }
    }

    logger.info('Módulos de tarefas complexas inicializados');
    try { startAlertsScheduler(); } catch (e) { logger.warn(`Falha ao iniciar scheduler de alertas: ${e.message}`); }
  } catch (err) {
    logger.error('Erro ao inicializar módulos de tarefas complexas:', err);
  }
}

// Agendador simples para checar OPNsense e alertas
let alertsTimer = null;
function startAlertsScheduler() {
  try { if (alertsTimer) clearInterval(alertsTimer); } catch (_) {}
  const interval = Math.max(15, parseInt(alertsConfig?.interval_sec || 60, 10)) * 1000;
  alertsTimer = setInterval(async () => {
    try {
      if (!opnRegistry) opnRegistry = new OPNRegistry();
      const items = opnRegistry.list();
      for (const fw of items) {
        try { await evaluateAlertsForFirewall(fw.id); } catch (e) { logger.warn(`Alert eval ${fw.name}: ${e.message}`); }
      }
    } catch (e) { logger.warn(`Scheduler error: ${e.message}`); }
  }, interval);
}

async function evaluateAlertsForFirewall(id) {
  const rules = (alertsConfig?.rules || []).filter(r => !r.id || r.id === id);
  if (rules.length === 0) return;
  const metrics = await getOpnMetrics(id);
  for (const r of rules) {
    let trigger = false;
    let reason = '';
    if (r.cpu_percent && metrics.cpu_percent != null && metrics.cpu_percent >= r.cpu_percent) { trigger = true; reason += `CPU ${metrics.cpu_percent}% >= ${r.cpu_percent}%\n`; }
    if (r.mem_percent && metrics.mem_percent != null && metrics.mem_percent >= r.mem_percent) { trigger = true; reason += `Mem ${metrics.mem_percent}% >= ${r.mem_percent}%\n`; }
    if (r.sessions && metrics.sessions != null && metrics.sessions >= r.sessions) { trigger = true; reason += `Sessions ${metrics.sessions} >= ${r.sessions}\n`; }
    // Interfaces thresholds (rx/tx bps) if provided
    if (Array.isArray(r.ifaces)) {
      for (const f of r.ifaces) {
        const m = metrics.ifaces && metrics.ifaces.find(x => x.name === f.name);
        if (!m) continue;
        if (f.rx_bps && m.rx_bps != null && m.rx_bps >= f.rx_bps) { trigger = true; reason += `${f.name} rx ${m.rx_bps} >= ${f.rx_bps}\n`; }
        if (f.tx_bps && m.tx_bps != null && m.tx_bps >= f.tx_bps) { trigger = true; reason += `${f.name} tx ${m.tx_bps} >= ${f.tx_bps}\n`; }
      }
    }
    if (trigger) await fireAlert(r, id, reason, metrics);
  }
}

async function fireAlert(rule, id, reason, metrics) {
  try {
    const alertsTool = require('/opt/fazai/tools/alerts.js');
    const target = (rule.target || {});
    const subject = `[FazAI][OPNsense ${id}] Alerta: limites excedidos`;
    const message = `${reason}\nMetrics: ${JSON.stringify(metrics).slice(0,1000)}`;
    if (rule.channel === 'email') { await alertsTool.email({ to: target.to, subject, message }); }
    else if (rule.channel === 'telegram') { await alertsTool.telegram({ botToken: target.botToken, chatId: target.chatId, message }); }
    else if (rule.channel === 'whatsapp') { await alertsTool.whatsapp({ webhookUrl: target.webhookUrl, to: target.to, message }); }
    logger.info(`Alerta disparado para ${rule.channel} (fw=${id})`);
  } catch (e) {
    logger.warn(`Falha ao disparar alerta: ${e.message}`);
  }
}

// Carrega configuração
let config = {};
try {
  // Carrega configuração de arquivo (.conf), verificando caminhos padrão
  let configPath;
  const configPaths = ['/etc/fazai/fazai.conf', '/etc/fazai.conf'];
  for (const p of configPaths) {
    if (fs.existsSync(p)) {
      configPath = p;
      break;
    }
  }
  if (configPath) {
    const configContent = fs.readFileSync(configPath, 'utf8');
    // Implementação simples de parser de configuração no estilo INI
    let currentSection = '';
    configContent.split('\n').forEach(line => {
      line = line.trim();
      if (line.startsWith('#') || line === '') return;

      if (line.startsWith('[') && line.endsWith(']')) {
        currentSection = line.slice(1, -1);
        config[currentSection] = {};
      } else if (currentSection && line.includes('=')) {
        const [key, value] = line.split('=').map(part => part.trim());
        config[currentSection][key] = value;
      }
    });

    // Atualiza AI_CONFIG com valores do arquivo de configuração
    if (config.ai_provider) {
      // Gemma é núcleo essencial; não permitir override do default_provider via config
      if (config.ai_provider.provider && config.ai_provider.provider !== 'gemma_cpp') {
        logger.warn('Ignorando ai_provider.provider diferente de gemma_cpp; Gemma é núcleo do FazAI.');
      }
      AI_CONFIG.enable_fallback = config.ai_provider.enable_fallback === 'true';
      AI_CONFIG.max_retries = parseInt(config.ai_provider.max_retries) || AI_CONFIG.max_retries;
      AI_CONFIG.retry_delay = parseInt(config.ai_provider.retry_delay) || AI_CONFIG.retry_delay;
    }

    // Atualiza configurações específicas dos provedores
    ['openrouter', 'openai', 'ollama', 'anthropic', 'gemini', 'gemma_cpp', 'llama_server'].forEach(provider => {
      if (config[provider]) {
        Object.keys(config[provider]).forEach(key => {
          if (AI_CONFIG.providers[provider][key] !== undefined) {
            AI_CONFIG.providers[provider][key] = config[provider][key];
          }
        });
      }
    });

    // Auto-bootstrap Gemma se configurado e faltar binário ou pesos
    const gemma = AI_CONFIG.providers.gemma_cpp || {};
    const needBootstrap = (
      (gemma.endpoint && !fs.existsSync(gemma.endpoint)) ||
      (gemma.weights && !fs.existsSync(gemma.weights))
    );
    if (config.gemma_cpp?.enabled === 'true' && needBootstrap) {
      try {
        logger.info('Gemma ausente (binário/pesos). Executando bootstrap...');
        const bootstrapPath = '/opt/fazai/tools/gemma_bootstrap.sh';
        if (fs.existsSync(bootstrapPath)) {
          exec(`sudo -n ${bootstrapPath} || ${bootstrapPath}`, (error, stdout, stderr) => {
            if (error) {
              logger.warn(`Falha no bootstrap Gemma: ${error.message}`);
            } else {
              logger.info('Bootstrap Gemma concluído');
            }
          });
        } else {
          logger.warn('gemma_bootstrap.sh não encontrado');
        }
      } catch (e) {
        logger.warn(`Erro ao tentar bootstrap do Gemma: ${e.message}`);
      }
    }

    logger.info('Configuração carregada com sucesso');
    // Ajusta nível de log via seção [logging]
    if (config.logging && config.logging.level) {
      logger.level = config.logging.level;
      logger.info(`Nível de log ajustado para: ${logger.level}`);
    }
    // Atualiza configurações globais (API keys, limites e e-mail de fallback)
    if (config.global) {
      if (config.global.openai_api_key) CONFIG.OPENAI_API_KEY = config.global.openai_api_key;
      if (config.global.fallback_email) CONFIG.FALLBACK_EMAIL = config.global.fallback_email;
      if (config.global.max_retries) CONFIG.MAX_RETRIES = parseInt(config.global.max_retries, 10) || CONFIG.MAX_RETRIES;
      if (config.global.min_words_for_architecture) CONFIG.MIN_WORDS_FOR_ARCHITECTURE = parseInt(config.global.min_words_for_architecture, 10) || CONFIG.MIN_WORDS_FOR_ARCHITECTURE;
    }

    // Context7: se presente no conf, exporta para o ambiente do processo
    if (config.context7) {
      if (config.context7.api_key && !process.env.CONTEXT7_API_KEY) {
        process.env.CONTEXT7_API_KEY = String(config.context7.api_key);
        logger.info('Context7 API key carregada do fazai.conf');
      }
      if (config.context7.endpoint && !process.env.API7_URL) {
        // Normaliza URL base
        const base = String(config.context7.endpoint).trim();
        if (base) {
          const full = base.startsWith('http') ? base : `https://${base.replace(/\/$/, '')}`;
          process.env.API7_URL = `${full.replace(/\/$/, '')}`;
          logger.info(`Context7 endpoint configurado: ${process.env.API7_URL}`);
        }
      }
    }
  } else {
    logger.warn(
      `Arquivo de configuração não encontrado em ${configPaths.join(' ou ')}, usando valores padrão`
    );
  }
} catch (err) {
  logger.error('Erro ao carregar configuração:', err);
}

// Coerce numeric provider configurations to correct types
Object.values(AI_CONFIG.providers).forEach(pc => {
  if (typeof pc.max_tokens === 'string') {
    pc.max_tokens = parseInt(pc.max_tokens, 10);
  }
  if (typeof pc.temperature === 'string') {
    pc.temperature = parseFloat(pc.temperature);
  }
});

/**
 * Analisa comando e verifica se precisa de arquitetamento
 * @param {string} command - Comando a ser analisado
 * @returns {object} - Informações sobre o comando
 */
function analyzeCommand(command) {
  const words = command.trim().split(/\s+/);
  // Perguntas via CLI devem usar flag -q; removida detecção por '_' e '?'
  const isQuestion = false;
  const isComplex = words.length > 5;

  return {
    isQuestion,
    isComplex,
    wordCount: words.length,
    needsArchitecting: isComplex
  };
}

/**
 * Processa comandos de pergunta simples
 * @param {string} command - Comando de pergunta
 * @returns {Promise<object>} - Interpretação do comando
 */
async function processQuestion(command) {
  // Remove delimitadores ? do início e fim, se existirem
  const clean = command.replace(/^\?+\s*/, '').replace(/\?+\s*$/, '').trim();
  // Tenta responder com Gemma local (texto direto)
  try {
    const providerConfig = AI_CONFIG.providers.gemma_cpp || {};
    const bin = (providerConfig.endpoint || '/opt/fazai/bin/gemma_oneshot').trim();
    const model = (providerConfig.default_model || process.env.GEMMA_MODEL || 'gemma2-2b-it').trim();
    const weights = (providerConfig.weights || process.env.GEMMA_WEIGHTS || '/opt/fazai/models/gemma/2.0-2b-it-sfp.sbs').trim();
    const tokenizer = (providerConfig.tokenizer || process.env.GEMMA_TOKENIZER || '/opt/fazai/models/gemma/tokenizer.spm').trim();
    const prompt = `Responda com objetividade e precisão: ${clean}`;
    const args = [bin, '--weights', weights, '--model', model, '--verbosity', '0'];
    if (tokenizer) args.push('--tokenizer', tokenizer);
    const { execFileSync } = require('child_process');
    const out = execFileSync(args[0], args.slice(1), { encoding: 'utf8', input: prompt + "\n" });
    return { interpretation: `echo "${out.trim()}"`, success: true, isQuestion: true };
  } catch (e) {
    logger.warn(`Gemma (Q) indisponível: ${e.message}`);
  }
  // Se falhar, tenta primeiro provedor HTTP se habilitado; se não, Context7
  try {
    const result = await queryAIForSteps(`Explique sucintamente: ${clean}`);
    if (result && Array.isArray(result.steps) && result.steps.length) {
      const ans = String(result.steps[0] || '').trim();
      if (ans) return { interpretation: `echo "${ans.replace(/\"/g,'\\\"')}"`, success: true, isQuestion: true };
    }
  } catch (_) {}
  try {
    const docs = await doResearch([clean], 3);
    const top = (docs||[]).slice(0,3).map(d=>`${d.title} - ${d.url}`).join(' | ');
    return { interpretation: `echo "(referências) ${top}"`, success: true, isQuestion: true };
  } catch (_) {}
  return { interpretation: `echo "${clean}"`, success: true, isQuestion: true };
}

/**
 * Sistema de arquitetamento para comandos complexos
 * @param {string} command - Comando complexo a ser arquitetado
 * @returns {Promise<object>} - Plano arquitetural
 */
async function architectCommand(command) {
  logger.info(`Iniciando arquitetamento para comando complexo: "${command}"`);

      // Sistema de arquitetamento simplificado
    logger.info('Usando sistema de arquitetamento simplificado');
    // Recuperação de contexto (RAG): Qdrant -> Context7 (fallback)
    const rag = await retrieveContext(command).catch(()=>({ origin:'none', items:[] }));

    // Para comandos complexos, retorna um plano básico
    const basicPlan = {
      needs_agent: false,
      required_info: [],
      steps: [
        `echo "Comando complexo detectado: ${command}"`,
        { step: 'kb.rag', origin: rag.origin, items: (rag.items||[]).slice(0,3) },
        command
      ],
      dependencies: [],
      monitoring: [],
      notifications: [],
      estimated_time: 'variável',
      complexity: 'média'
    };
    
    return {
      interpretation: basicPlan,
      success: true,
      isArchitected: true,
      method: 'simplified'
    };
}

/**
 * Executa plano arquitetural
 * @param {object} plan - Plano arquitetural
 * @param {string} originalCommand - Comando original
 * @returns {Promise<object>} - Resultado da execução
 */
async function executePlan(plan, originalCommand) {
  logger.info('Executando plano arquitetural');

  const results = [];

  // Se precisa de agente, coleta informações primeiro
  if (plan.needs_agent && plan.required_info) {
    logger.info('Plano requer agente - coletando informações');

    return {
      interpretation: originalCommand,
      plan: plan,
      requires_interaction: true,
      required_info: plan.required_info,
      message: 'Este comando requer informações adicionais. Use a interface interativa.',
      success: true
    };
  }

  // Executa passos sequencialmente
  if (plan.steps && Array.isArray(plan.steps)) {
    for (const step of plan.steps) {
      try {
        if (typeof step === 'string' && step.startsWith('tool:')) {
          // Passo do tipo tool:<nome>[ param=json]
          const match = step.match(/^tool:([^\s]+)(?:\s+param=(.*))?$/);
          const toolName = match?.[1];
          const paramRaw = match?.[2];
          let params = {};
          if (paramRaw) { try { params = JSON.parse(paramRaw); } catch (_) {} }
          logger.info(`Executando tool: ${toolName}`);
          const tool = loadedTools[toolName];
          if (!tool || typeof tool.run !== 'function') {
            throw new Error(`Tool não encontrada ou inválida: ${toolName}`);
          }
          const out = await tool.run(params);
          // Se o passo indicar streaming SSE no daemon, pode enviar updates aqui no futuro
          results.push({ step, output: out, success: true });
        } else if (typeof step === 'object' && step?.step === 'kb.rag') {
          results.push({ step: 'kb.rag', origin: step.origin, items: step.items||[], success: true });
        } else {
          logger.info(`Executando passo: ${step}`);
          const stepResult = await executeCommand(step);
          results.push({ step, output: stepResult.stdout, success: true });
        }
      } catch (stepErr) {
        logger.error(`Erro no passo "${step}": ${stepErr.error}`);
        results.push({
          step: step,
          output: stepErr.error,
          success: false
        });

        // Se configurado para parar em erro
        if (!AI_CONFIG.continue_on_error) {
          break;
        }
      }
    }
  }

  return {
    interpretation: originalCommand,
    plan: plan,
    execution_results: results,
    success: true
  };
}



/**
 * Consulta modelo de IA para interpretar comando
 * @param {string} command - Comando a ser interpretado
 * @returns {Promise<object>} - Interpretação do comando
 */
async function queryAI(command, cwd = process.env.HOME) {
  logger.info(`Consultando IA para interpretar: "${command}"`);

  // Analisa o comando primeiro
  const analysis = analyzeCommand(command);

  // Processa perguntas simples
  if (analysis.isQuestion) {
    logger.info('Processando como pergunta simples');
    return await processQuestion(command);
  }

  // Processa comandos complexos com arquitetamento
  if (analysis.needsArchitecting) {
    logger.info('Comando complexo detectado - iniciando arquitetamento');
    const architectResult = await architectCommand(command);

    if (architectResult.success && architectResult.isArchitected) {
      return await executePlan(architectResult.interpretation, command);
    }
  }

  // Processamento normal para comandos simples
  const providers = AI_CONFIG.fallback_order;
  // Se comando é simples (não complex, não questão) e fallback_for_simple=false, restringe a Gemma local
  const onlyGemma = (!analysis.needsArchitecting && !analysis.isQuestion && AI_CONFIG.fallback_for_simple === false);
  for (let i = 0; i < providers.length; i++) {
    const provider = providers[i];
    if (onlyGemma && provider !== 'gemma_cpp') continue;
    const providerConfig = AI_CONFIG.providers[provider];
    
    // Verifica se o provedor tem chave de API configurada
    const apiKey = providerConfig.api_key || process.env[`${provider.toUpperCase()}_API_KEY`];
    if (provider !== 'ollama' && !apiKey && !providerConfig.no_auth) {
      logger.info(`Pulando ${provider} - chave de API não configurada`);
      continue;
    }
    
    try {
      logger.info(`Tentando provedor: ${provider} (tentativa ${i + 1}/${providers.length})`);
      if (provider === 'gemma_cpp') {
        // Invoca o binário local do gemma.cpp com prompt forte para comando único
        const bin = (providerConfig.endpoint || '/opt/fazai/bin/gemma_oneshot').trim();
        const model = (providerConfig.default_model || process.env.GEMMA_MODEL || 'gemma2-2b-it').trim();
        const weights = (providerConfig.weights || process.env.GEMMA_WEIGHTS || '/opt/fazai/models/gemma/2.0-2b-it-sfp.sbs').trim();
        const tokenizer = (providerConfig.tokenizer || process.env.GEMMA_TOKENIZER || '/opt/fazai/models/gemma/tokenizer.spm').trim();
        const promptPrefix = (providerConfig.prompt || 'Responda APENAS com um comando shell Linux que atenda ao pedido a seguir. Sem explicações, sem comentários, sem markdown, sem crases. Se houver várias opções, escolha a mais direta e compatível com sistemas Linux comuns. Pedido:').trim();
        const verbosity = 0;
        const args = [bin, '--weights', weights, '--model', model, '--verbosity', String(verbosity)];
        if (tokenizer) { args.push('--tokenizer', tokenizer); }
        const input = `${promptPrefix} ${command}\n`;
        const { execFileSync } = require('child_process');
        try {
          const out = execFileSync(args[0], args.slice(1), { encoding: 'utf8', input });
          return { interpretation: out.trim(), success: true };
        } catch (e) {
          throw new Error(`gemma_cpp falhou: ${e.message}`);
        }
      }
      let result = await queryProvider(provider, command, cwd);
      logger.info(`Resposta recebida do provedor ${provider}`);
      return result;
    } catch (err) {
      logger.error(`Erro ao consultar ${provider}: ${err.message}`);
      
      // Se não é o último provedor, continua para o próximo
      if (i < providers.length - 1) {
        logger.info(`Tentando próximo provedor...`);
        continue;
      }
    }
  }

  // Se todos os provedores falharam, usa fallback simples (apenas se habilitado e não simples)
  if (AI_CONFIG.enable_fallback && !onlyGemma) {
    logger.info('Todos os provedores falharam - usando fallback simples');
    return {
      interpretation: `echo "Comando não interpretado: ${command}"`,
      success: false
    };
  }

  // Fallback final
  return {
    interpretation: 'echo "Não foi possível interpretar o comando via IA."',
    success: false
  };
}

/**
 * Consulta modelo de IA para obter passos do MCPS
 * @param {string} command - Comando a ser interpretado
 * @returns {Promise<Array<string>>} - Lista de passos
 */
async function queryAIForSteps(command, cwd = process.env.HOME) {
  logger.info(`Consultando IA (MCPS) para: "${command}"`);
  try {
    // Seleciona um provedor HTTP apropriado para MCPS (gemma_cpp e binários locais não suportam /chat/completions)
    const preferred = process.env.DEFAULT_PROVIDER || AI_CONFIG.default_provider;
    const candidateOrder = [preferred, 'openrouter', 'openai', 'anthropic', 'gemini', 'llama_server', 'ollama'];
    let chosenProvider = null;
    let providerConfig = null;

    for (const name of candidateOrder) {
      const pc = AI_CONFIG.providers[name];
      if (!pc) continue;
      // Deve possuir endpoint HTTP
      const ep = (pc.endpoint || '').toString();
      const isHttp = ep.startsWith('http://') || ep.startsWith('https://');
      if (!isHttp) continue;
      // Se exige auth, precisa de API key
      const apiKey = pc.api_key || process.env[`${name.toUpperCase()}_API_KEY`];
      const requiresAuth = !pc.no_auth;
      if (requiresAuth && !apiKey) continue;
      chosenProvider = name;
      providerConfig = pc;
      break;
    }

    if (!providerConfig) {
      throw new Error('Nenhum provedor HTTP disponível para MCPS. Configure openrouter/openai/anthropic/gemini.');
    }
    const availableTools = Object.keys(loadedTools);
    const defaultPrompt = `Você está executando como root no diretório ${cwd}. ` +
      `Você deve produzir passos executáveis, um por linha. ` +
      `Quando a tarefa envolver integrações complexas ou orquestrações prontas, use ferramentas registradas no formato tool:<nome> param={...}. ` +
      `Ferramentas disponíveis: ${availableTools.join(', ')}. ` +
      `Exemplos: tool:email_relay param={"relayhost":"[smtp.example.com]:587","myhostname":"mail.example.com"}; tool:web_search param={"query":"postfix relay best practices"}. ` +
      `Caso contrário, retorne comandos bash puros. Sem explicações. ` +
      `Considere o ambiente atual: HOME=${process.env.HOME}, PWD=${cwd}, PATH=${process.env.PATH}.`;
    const prompt = config.mcps_mode?.system_prompt || defaultPrompt;

    const messages = [
      { role: 'system', content: prompt },
      { role: 'user', content: command }
    ];

    const headers = {
      'Content-Type': 'application/json',
      ...providerConfig.headers
    };
    const apiKey = providerConfig.api_key || process.env[`${chosenProvider.toUpperCase()}_API_KEY`];
    if (apiKey && !providerConfig.no_auth) {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }

    const mcpsPayload = {
      model: providerConfig.default_model,
      messages,
      //temperature: providerConfig.temperature,
      max_tokens: providerConfig.max_tokens
    };
    logger.info(`Payload MCPS enviado: ${JSON.stringify(mcpsPayload)}`);
    const response = await axios.post(`${providerConfig.endpoint}/chat/completions`, mcpsPayload, { headers });

    const text = response.data.choices[0].message.content;
    logger.info(`Passos recebidos: ${text}`);
    return text.split('\n');
  } catch (err) {
    logger.error(`Erro no MCPS: ${err.message}`);
    throw err;
  }
}

/**
 * Consulta provedor de IA unificado
 * @param {string} provider - Nome do provedor
 * @param {string} command - Comando a ser interpretado
 * @returns {Promise<object>} - Interpretação do comando
 */
async function queryProvider(provider, command, cwd = process.env.HOME) {
  const providerConfig = AI_CONFIG.providers[provider];

  if (!providerConfig) {
    throw new Error(`Provedor desconhecido: ${provider}`);
  }

  const apiKey = providerConfig.api_key || process.env[`${provider.toUpperCase()}_API_KEY`];

  if (provider !== 'ollama' && !apiKey) {
    // Permite provedores locais sem auth
    if (!providerConfig.no_auth) {
      throw new Error(`Chave de API não configurada para ${provider}`);
    }
  }

  // Verifica cache primeiro
  const cacheKey = cacheManager.generateKey(command, provider);
  const cachedResult = cacheManager.get(cacheKey);
  if (cachedResult) {
    logger.info(`Cache hit para ${provider}: ${command.substring(0, 50)}...`);
    return cachedResult;
  }

  logger.info(`Enviando requisição para ${provider} (modelo: ${providerConfig.default_model})`);

  // Monta headers: inclui Authorization sólo se api_key configurada
  const headers = {
    'Content-Type': 'application/json',
    ...providerConfig.headers
  };
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

  // Prompts configuráveis (simples e autônomo). Poderão migrar para fazai.conf
  const SIMPLE_PROMPT = `Você é um tradutor de linguagem natural para shell Linux.
Saída: apenas UM comando shell por resposta, sem aspas desnecessárias, sem backticks, sem comentários, sem explicações.
Não modifique caminhos ou nomes; não envolva em fences.
Se a tarefa exigir passos, responda com o primeiro comando executável.
Diretório atual: ${cwd}.`;

  const AUTONOMOUS_PROMPT = `Você é um operador de sistemas Linux com acesso root.
Converta a intenção do usuário em um único comando shell pronto para execução em bash -lc.

Regras de saída:
- Responda com APENAS 1 linha contendo o comando.
- Não inclua explicações, comentários, stdout artificial (echo) ou formatação.
- Não use aspas/backticks/cercas de código desnecessários.

Políticas de execução:
- Prefira comandos idempotentes e não interativos (use -y quando aplicável).
- Se faltar informação, devolva um comando de inspeção curto que ajude a obtê-la (ex.: ls, grep, cat, systemctl status).
- Evite encadear vários comandos; só use '&&' quando estritamente necessário e curto.
- Use caminhos absolutos quando fizer sentido; respeite o diretório atual: ${cwd}.
- Não faça downloads/pesquisas na internet por padrão. Pesquisa web só quando explicitamente solicitado (ex.: com a flag -w ou pedido do usuário).
- Para tarefas complexas, devolva apenas o primeiro passo mais seguro que avança a tarefa (ex.: atualizar índice antes de instalar).

Ambiente:
- PATH=${process.env.PATH}`;

  const systemPrompt = AUTONOMOUS_PROMPT;
  const payload = {
    model: providerConfig.default_model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user',   content: command }
    ],
  //  temperature: providerConfig.temperature,
    max_tokens: providerConfig.max_tokens
  };
  logger.info(`Payload para provedor ${provider}: ${JSON.stringify(payload)}`);

  try {
    let response;
    
    // Tratamento especial para Ollama
    if (provider === 'ollama') {
      logger.info('Usando API específica do Ollama');
      // Usa a API de completions do Ollama
      const ollamaPayload = {
        model: providerConfig.default_model,
        prompt: `${systemPrompt}\n\nUser: ${command}\n\nAssistant:`,
        stream: false
      };
      response = await axios.post(`${providerConfig.endpoint}/api/generate`, ollamaPayload, { headers });
    } else if (provider === 'llama_server') {
      logger.info('Usando Llama.cpp server compatível com OpenAI');
      response = await axios.post(`${providerConfig.endpoint}/chat/completions`, payload, { headers });
    } else {
      response = await axios.post(`${providerConfig.endpoint}/chat/completions`, payload, { headers });
    }

    logger.info(`Resposta recebida de ${provider}`);

    let interpretation;
    if (provider === 'ollama') {
      interpretation = response.data.response;
    } else {
      interpretation = response.data.choices[0].message.content;
    }

    const result = {
      interpretation: interpretation,
      success: true
    };

    // Salva no cache
    cacheManager.set(cacheKey, result);
    logger.info(`Resultado salvo no cache (tamanho: ${cacheManager.size()})`);

    return result;
  } catch (err) {
    logger.error(`Erro na requisição para ${provider}: ${err.message}`);
    if (err.response) {
      logger.error(`Detalhes da resposta de erro: ${JSON.stringify(err.response.data)}`);
    }
    throw err;
  }
}

// Natural language → OPNsense plan (JSON)
async function opnPlanFromNL(query) {
  const provider = 'gemma_cpp';
  const schema = `JSON com campos: {"action":"list|add|health|interfaces","id?":"<id>","name?":"<nome>","base_url?":"https://...","api_key?":"...","api_secret?":"...","verify_tls?":true|false}`;
  const prompt = `Você é integrador OPNsense. Converta o pedido a seguir em ${schema} sem explicações. Pedido: ${query}`;
  try {
    const out = await queryProvider(provider, prompt);
    const text = (out && out.interpretation) ? out.interpretation : '';
    const m = text.match(/\{[\s\S]*\}/);
    if (!m) throw new Error('Plano não reconhecido');
    const plan = JSON.parse(m[0]);
    return plan;
  } catch (e) {
    logger.warn(`opnPlanFromNL falhou: ${e.message}`);
    throw e;
  }
}



/**
 * Executa um comando no sistema
 * @param {string} command - Comando a ser executado
 * @returns {Promise<object>} - Resultado da execução
 */
function executeCommand(command, cwd = process.env.HOME) {
  return new Promise((resolve, reject) => {
    exec(command, { cwd }, (error, stdout, stderr) => {
      if (error) {
        logger.error(`Erro ao executar comando: ${command}`, error);
        reject({ error: error.message, stderr });
        return;
      }

      logger.info(`Comando executado com sucesso: ${command}`);
      resolve({ stdout, stderr });
    });
  });
}

/**
 * Executa um comando e transmite a saída via SSE
 * @param {object} res - Response do Express com cabeçalhos SSE já configurados
 * @param {string} command - Comando a executar
 * @param {string} cwd - Diretório de trabalho
 * @param {function} onClose - Callback quando o cliente desconectar
 */
function streamCommand(res, command, cwd = process.env.HOME, onClose = () => {}) {
  const send = (type, data) => {
    try {
      res.write(`event: ${type}\n`);
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    } catch (_) {
      // Ignora erros de escrita após desconexão
    }
  };

  logger.info(`Iniciando execução (stream) do comando: ${command}`);
  const child = spawn('bash', ['-lc', command], { cwd });

  const cleanup = () => {
    try { child.kill('SIGTERM'); } catch (_) {}
    onClose();
  };

  // Cliente encerrou conexão
  res.req.on('close', cleanup);

  child.stdout.on('data', (chunk) => {
    send('stdout', { chunk: chunk.toString() });
  });
  child.stderr.on('data', (chunk) => {
    send('stderr', { chunk: chunk.toString() });
  });
  child.on('error', (err) => {
    logger.error(`Falha ao spawnar comando (stream): ${err.message}`);
    send('error', { message: err.message });
  });
  child.on('close', (code) => {
    send('exit', { code });
    send('done', { success: code === 0 });
    try { res.end(); } catch (_) {}
  });
}

/**
 * Endpoint principal para receber comandos
 */
app.post('/command', async (req, res) => {
  const { command, mcps, cwd, question } = req.body;
  const currentDir = cwd || process.env.HOME;
  // Modo pergunta direta (-q): retorna resposta do modelo via prompt dedicado, sem executar comandos
  if (question) {
    logger.info(`Processando pergunta direta: "${command}"`);
    try {
      const provider = process.env.DEFAULT_PROVIDER || AI_CONFIG.default_provider;
      const providerConfig = AI_CONFIG.providers[provider] || {};
      const questionPrompt = config.question_mode?.system_prompt ||
        'Você é um assistente de perguntas e respostas para automação de servidores Linux e tecnologias correlatas. ' +
        'Responda de forma objetiva e sucinta, sem gerar comandos, a menos que solicitado.';
      // Se o provider não é HTTP (ex.: gemma_cpp), usa caminho local (processQuestion)
      const ep = String(providerConfig.endpoint || '').trim();
      const isHttp = ep.startsWith('http://') || ep.startsWith('https://');
      if (!isHttp) {
        try {
          const pq = await processQuestion(`?${command}?`);
          const ans = String(pq.interpretation || '').replace(/^echo\s+"?|"?$/g,'');
          return res.json({ question: command, answer: ans, type: 'question', success: true });
        } catch (e) {
          logger.warn(`processQuestion falhou: ${e.message}`);
        }
      }
      // Integra Context7 de forma transparente quando disponível
      let context7Note = '';
      try {
        const docs = await doResearch([command], 3);
        if (Array.isArray(docs) && docs.length) {
          const top = docs.slice(0, 3).map((d, i) => `(${i+1}) ${d.title || ''} - ${d.url || ''}`).join('\n');
          context7Note = `\nContexto de pesquisa (pode usar como referência):\n${top}`;
        }
      } catch (e) {
        logger.debug(`Context7/doResearch indisponível: ${e.message}`);
      }

      const messages = [
        { role: 'system', content: questionPrompt + context7Note },
        { role: 'user',   content: command }
      ];
      const headers = {
        'Authorization': `Bearer ${providerConfig.api_key}`,
        'Content-Type': 'application/json',
        ...providerConfig.headers
      };
      const payload = {
        model:       providerConfig.default_model,
        messages,
        max_tokens:  providerConfig.max_tokens
      };
      logger.info(`Payload para pergunta direta: ${JSON.stringify(payload)}`);
      const response = await axios.post(
        `${providerConfig.endpoint}/chat/completions`,
        payload,
        { headers }
      );
      const answer = response.data.choices[0].message.content;
      return res.json({ question: command, answer, type: 'question', success: true });
    } catch (err) {
      logger.error(`Erro ao processar pergunta direta: ${err.message}`);
      return res.status(500).json({ error: err.message, success: false });
    }
  }

  if (!command) {
    logger.error('Requisição recebida sem comando');
    return res.status(400).json({ error: 'Comando não fornecido', success: false });
  }

  logger.info(`Comando recebido: ${command}`);

  try {
    // Interpreta o comando usando IA com arquitetamento
    logger.info('Iniciando interpretação do comando via IA');
    const interpretation = await queryAI(command, currentDir);

    if (!interpretation.success) {
      logger.warn(`Interpretação falhou: ${interpretation.interpretation}`);
      return res.json({
        command,
        interpretation: interpretation.interpretation,
        error: 'Falha na interpretação do comando',
        success: false
      });
    }

    // Verifica se é uma pergunta simples
    if (interpretation.isQuestion) {
      logger.info('Processando pergunta simples');
      const result = await executeCommand(interpretation.interpretation, currentDir);
      return res.json({
        command,
        interpretation: interpretation.interpretation,
        result: result.stdout,
        type: 'question',
        success: true
      });
    }

    // Verifica se requer interação (agente)
    if (interpretation.requires_interaction) {
      logger.info('Comando requer interação do usuário');
      return res.json({
        command,
        plan: interpretation.plan,
        required_info: interpretation.required_info,
        message: interpretation.message,
        type: 'interactive',
        success: true
      });
    }

    // Verifica se tem plano de execução (comando arquitetado)
    if (interpretation.execution_results) {
      logger.info('Retornando resultados de plano arquitetado');
      return res.json({
        command,
        plan: interpretation.plan,
        execution_results: interpretation.execution_results,
        type: 'architected',
        success: true
      });
    }

    logger.info(`Comando interpretado como: ${interpretation.interpretation}`);

    if (mcps) {
      logger.info('Modo MCPS habilitado');
      const mcpsSeed = (function normalize(script){
        try {
          if (typeof script !== 'string') return '';
          let s = script.trim();
          if (s.startsWith('```')) {
            s = s.replace(/^```[a-zA-Z0-9_-]*\s*\n/, '');
            s = s.replace(/\n```\s*$/, '');
          }
          s = s.replace(/^`+/, '').replace(/`+$/, '');
          return s.trim();
        } catch (_) { return String(script || '').trim(); }
      })(interpretation.interpretation);
      const steps = await queryAIForSteps(mcpsSeed, currentDir);
      const results = [];
      for (const step of steps) {
        try {
          const execResult = await executeCommand(step, currentDir);
          results.push({ command: step, output: execResult.stdout });
        } catch (stepErr) {
          results.push({ command: step, output: stepErr.error });
        }
      }

      res.json({ 
        command, 
        interpretation: interpretation.interpretation, 
        steps: results, 
        type: 'mcps',
        success: true 
      });
    } else {
      // Executa o comando interpretado (modo tradicional)
      logger.info('Executando comando interpretado');
      const normalized = (function normalize(script){
        try {
          if (typeof script !== 'string') return '';
          let s = script.trim();
          if (s.startsWith('```')) {
            s = s.replace(/^```[a-zA-Z0-9_-]*\s*\n/, '');
            s = s.replace(/\n```\s*$/, '');
          }
          s = s.replace(/^`+/, '').replace(/`+$/, '');
          // Apenas a primeira linha para evitar texto extra
          s = s.split('\n')[0].trim();
          return s;
        } catch (_) { return String(script || '').trim(); }
      })(interpretation.interpretation);
      const result = await executeCommand(normalized, currentDir);

      logger.info('Comando executado com sucesso');
      res.json({
        command,
        interpretation: interpretation.interpretation,
        result: result.stdout,
        type: 'simple',
        success: true
      });
    }

  } catch (err) {
    // Garantir que temos valores seguros para log
    const errorMessage = err?.message || 'Erro desconhecido';
    const stackTrace = err?.stack || 'Stack trace não disponível';

    logger.error(`Erro ao processar comando: ${errorMessage}`);
    logger.error(`Stack trace: ${stackTrace}`);

    // Determina o tipo de erro para uma mensagem mais amigável
    let friendlyMessage = 'Erro interno ao processar comando';

    // ✅ CORREÇÃO PRINCIPAL - Verificar se message existe antes de usar includes
    const message = err?.message || '';

    if (message.includes('API')) {
      friendlyMessage = 'Erro de comunicação com o provedor de IA. Verifique as chaves de API e a conexão.';
    } else if (message.includes('ECONNREFUSED') || message.includes('ETIMEDOUT')) {
      friendlyMessage = 'Não foi possível conectar ao serviço de IA. Verifique sua conexão de internet.';
    } else if (message.includes('command')) {
      friendlyMessage = 'Erro ao executar o comando no sistema.';
    }

    res.status(500).json({
      command,
      error: errorMessage,
      details: err.message,
      success: false
    });
  }
});

/**
 * Endpoint SSE para receber comandos com saída em tempo real
 */
app.post('/command/stream', async (req, res) => {
  // Configura cabeçalhos SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Nginx
  if (typeof res.flushHeaders === 'function') res.flushHeaders();

  const send = (type, data) => {
    try {
      res.write(`event: ${type}\n`);
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    } catch (_) {}
  };

  try {
    const { command, mcps, cwd, question } = req.body || {};
    const currentDir = cwd || process.env.HOME;

    if (!command) {
      send('error', { message: 'Comando não fornecido' });
      return res.end();
    }

    send('received', { command, mcps: !!mcps, cwd: currentDir });

    // Modo pergunta direta
    if (question) {
      try {
        const provider = process.env.DEFAULT_PROVIDER || AI_CONFIG.default_provider;
        const providerConfig = AI_CONFIG.providers[provider];
        const questionPrompt = config.question_mode?.system_prompt ||
          'Você é um assistente de perguntas e respostas para automação de servidores Linux. E assuntos relacionados a tecnologia ' +
          'Responda de forma objetiva e sucinta, sem gerar comandos, sem que seja solicitado exemplo.';
        const messages = [
          { role: 'system', content: questionPrompt },
          { role: 'user',   content: command }
        ];
        const headers = {
          'Authorization': `Bearer ${providerConfig.api_key}`,
          'Content-Type': 'application/json',
          ...providerConfig.headers
        };
        const payload = { model: providerConfig.default_model, messages, max_tokens: providerConfig.max_tokens };
        const response = await axios.post(`${providerConfig.endpoint}/chat/completions`, payload, { headers });
        const answer = response.data.choices[0].message.content;
        send('answer', { answer });
        send('done', { success: true });
        return res.end();
      } catch (err) {
        logger.error(`Erro em pergunta (stream): ${err.message}`);
        send('error', { message: err.message });
        return res.end();
      }
    }

    // Interpreta via IA
    send('phase', { phase: 'interpreting' });
    const interpretation = await queryAI(command, currentDir);

    if (!interpretation.success) {
      send('error', { message: interpretation.interpretation || 'Falha na interpretação' });
      return res.end();
    }

    // Interativa
    if (interpretation.requires_interaction) {
      send('interactive', {
        message: interpretation.message,
        required_info: interpretation.required_info,
        plan: interpretation.plan || null
      });
      send('done', { success: true });
      return res.end();
    }

    // Plano arquitetado já executado
    if (interpretation.execution_results) {
      send('interpretation', { interpretation: interpretation.plan ? 'plan' : '' });
      send('plan_results', { execution_results: interpretation.execution_results, plan: interpretation.plan });
      send('done', { success: true });
      return res.end();
    }

    // Execução MCPS passo a passo com stream
    if (mcps) {
      send('phase', { phase: 'mcps' });
      const steps = await queryAIForSteps(interpretation.interpretation, currentDir);
      send('steps', { steps });

      for (let i = 0; i < steps.length; i++) {
        const step = steps[i];
        if (!step || !step.trim()) continue;
        send('step_start', { index: i, command: step });

        await new Promise((resolveStep) => {
          const child = spawn('bash', ['-lc', step], { cwd: currentDir });

          const onClose = () => {
            try { child.kill('SIGTERM'); } catch (_) {}
            resolveStep();
          };
          res.req.once('close', onClose);

          child.stdout.on('data', (chunk) => send('step_stdout', { index: i, chunk: chunk.toString() }));
          child.stderr.on('data', (chunk) => send('step_stderr', { index: i, chunk: chunk.toString() }));
          child.on('error', (err) => send('step_error', { index: i, message: err.message }));
          child.on('close', (code) => { send('step_end', { index: i, code }); resolveStep(); });
        });
      }

      send('done', { success: true });
      return res.end();
    }

    // Execução simples com stream
    const normalizeForExec = (script) => {
      try {
        if (typeof script !== 'string') return '';
        let s = script.trim();
        // Remove fenced code blocks
        if (s.startsWith('```')) {
          s = s.replace(/^```[a-zA-Z0-9_-]*\s*\n/, '');
          s = s.replace(/\n```\s*$/, '');
        }
        // Remove inline backticks
        s = s.replace(/^`+/, '').replace(/`+$/,'').trim();
        // Usa apenas a primeira linha
        s = s.split('\n')[0].trim();
        return s;
      } catch (_) { return String(script || '').trim(); }
    };
    const normalized = normalizeForExec(interpretation.interpretation);
    send('interpretation', { interpretation: normalized });
    streamCommand(res, normalized, currentDir);
  } catch (err) {
    const message = err?.message || 'Erro interno';
    logger.error(`Erro em /command/stream: ${message}`);
    try {
      res.write(`event: error\n`);
      res.write(`data: ${JSON.stringify({ message })}\n\n`);
    } catch (_) {}
    try { res.end(); } catch (_) {}
  }
});

/**
 * Endpoint para recarregar plugins e módulos
 */
app.post('/reload', (req, res) => {
  logger.info('Solicitação para recarregar plugins e módulos');

  // Limpa cache do Node.js
  Object.keys(require.cache).forEach(key => {
    delete require.cache[key];
  });

  // Limpa módulos carregados
  Object.keys(loadedMods).forEach(modName => {
    try {
      loadedMods[modName].fazai_mod_cleanup();
    } catch (err) {
      logger.error(`Erro ao limpar módulo ${modName}:`, err);
    }
  });

  // Recarrega plugins e módulos
  loadTools();
  loadNativeModules();
  initializeComplexModules();

  res.json({ success: true, message: 'Plugins e módulos recarregados' });
});

// Endpoint para ingestão de telemetria de agentes remotos (controlado por [telemetry].enable_ingest)
if (config.telemetry?.enable_ingest === 'true') {
  app.post('/ingest', (req, res) => {
    try {
      const payload = req.body || {};
      const host = payload.hostname || 'unknown';
      ingestCounter++;
      telemetryCounters.ingest_total++;
      telemetryStore.set(host, payload);
      logger.info(`ingest`, { type: 'telemetry', hostname: host, timestamp: payload.timestamp });
      try {
        if (payload.source === 'suricata' && payload.event?.alert?.signature) {
          const sig = String(payload.event.alert.signature);
          telemetryCounters.suricata_alert_total.set(sig, (telemetryCounters.suricata_alert_total.get(sig) || 0) + 1);
        }
        if (payload.source === 'clamav' && payload.event?.virus) {
          const v = String(payload.event.virus);
          telemetryCounters.clamav_virus_total.set(v, (telemetryCounters.clamav_virus_total.get(v) || 0) + 1);
        }
        // reputação simples por IP e /24
        const src = payload.event?.src_ip; const dst = payload.event?.dest_ip;
        const bump = (ip) => {
          if (!ip) return; const c = (ipStats.perIp.get(ip)||0)+1; ipStats.perIp.set(ip, c);
          const m = ip.match(/^(\d+)\.(\d+)\.(\d+)\./); if (m) { const s24 = `${m[1]}.${m[2]}.${m[3]}.0/24`; ipStats.perSubnet24.set(s24, (ipStats.perSubnet24.get(s24)||0)+1); }
        };
        bump(src); bump(dst);
        telemetryEvents.push({ ts: Date.now(), source: payload.source, host, event: payload.event || payload });
        // Mantém ~1h de eventos no buffer (limpeza rápida)
        const cutoff = Date.now() - 60*60*1000;
        while (telemetryEvents.length && telemetryEvents[0].ts < cutoff) telemetryEvents.shift();
        // Avaliação imediata de políticas (proatividade)
        setTimeout(() => { try { evaluateSecurityPolicies(); } catch (_) {} }, 0);
      } catch (_) {}
      res.json({ success: true });
    } catch (e) {
      logger.error(`Erro em /ingest: ${e.message}`);
      res.status(500).json({ success: false, error: e.message });
    }
  });
} else {
  app.post('/ingest', (_req, res) => res.status(404).json({ success: false, error: 'Telemetria desabilitada ([telemetry].enable_ingest=false)' }));
}

/**
 * Fluxo de atividades complexas (agente aplica soluções)
 */
app.post('/complex_flow', async (req, res) => {
  const { goal, allow_web } = req.body || {};
  if (!goal || typeof goal !== 'string') {
    return res.status(400).json({ success: false, error: 'Campo "goal" obrigatório' });
  }
  try {
    const seed = await queryAI(goal, process.env.HOME);
    const steps = [];
    if (!complexTasksManager) initializeComplexModules();
    if (goal.toLowerCase().includes('gráfico') || goal.toLowerCase().includes('chart')) {
      const ch = await complexTasksManager.executeTask('generate_chart', { type: 'line', title: 'Indicadores', xLabel: 't', yLabel: 'v' });
      steps.push({ step: 'generate_chart', result: ch });
    }
    if (goal.toLowerCase().includes('relatório') || goal.toLowerCase().includes('report')) {
      const rep = await complexTasksManager.executeTask('generate_report', { type: 'security', outputFormat: 'pdf' });
      steps.push({ step: 'generate_report', result: rep });
    }
    if (goal.toLowerCase().includes('opnsense') && mcpOPNsense) {
      const info = await mcpOPNsense.executeMCPCommand('get_system_info', {});
      steps.push({ step: 'opnsense.get_system_info', result: info });
    }
    if (allow_web) {
      try { const webSearch = require('/opt/fazai/tools/web_search.js'); const sr = await webSearch.search(goal); steps.push({ step: 'web_search', result: sr }); } catch (_) {}
    }
    return res.json({ success: true, goal, plan_seed: seed.interpretation || '', steps });
  } catch (e) {
    logger.error(`Erro em /complex_flow: ${e.message}`);
    return res.status(500).json({ success: false, error: e.message });
  }
});

// Exporta métricas no formato Prometheus
app.get('/metrics', async (_req, res) => {
  try {
    res.setHeader('Content-Type', 'text/plain; version=0.0.4');
    let out = '';
    out += `fazai_ingest_total ${telemetryCounters.ingest_total}\n`;
    try {
      if (!opnRegistry) opnRegistry = new OPNRegistry();
      const items = opnRegistry.list();
      let okc=0, degraded=0, down=0;
      const now = Date.now();
      for (const fw of items) {
        if (fw.last_error) { down++; continue; }
        const seen = fw.last_seen ? new Date(fw.last_seen).getTime() : 0;
        if (seen && now - seen < 5*60*1000) okc++; else degraded++;
      }
      out += `opnsense_fleet_ok ${okc}\nopnsense_fleet_degraded ${degraded}\nopnsense_fleet_down ${down}\nopnsense_fleet_total ${items.length}\n`;
    } catch (_) {}
    for (const [sig, val] of telemetryCounters.suricata_alert_total.entries()) {
      const esc = sig.replace(/"/g, '\\"');
      out += `suricata_alert_total{signature="${esc}"} ${val}\n`;
    }
    for (const [v, val] of telemetryCounters.clamav_virus_total.entries()) {
      const esc = v.replace(/"/g, '\\"');
      out += `clamav_virus_total{name="${esc}"} ${val}\n`;
    }
    res.end(out);
  } catch (e) {
    res.status(500).send(`# metrics error: ${e.message}`);
  }
});

// ============================
// Políticas de segurança proativa
// ============================
let secPolicies = { interval_sec: 30, rules: [] };
function loadSecPolicies(){
  try { const p = '/etc/fazai/security_policies.json'; if (fs.existsSync(p)) secPolicies = JSON.parse(fs.readFileSync(p,'utf8')); } catch (_) {}
  if (!secPolicies.interval_sec) secPolicies.interval_sec = 30;
  if (!Array.isArray(secPolicies.rules)) secPolicies.rules = [];
}
function saveSecPolicies(){ try { const p='/etc/fazai/security_policies.json'; fs.writeFileSync(p, JSON.stringify(secPolicies,null,2)); fs.chmodSync(p,0o600); } catch(_){} }
loadSecPolicies();
let secPolTimer = null;
async function applyOpnRule(fwId, rule){
  const { http, base } = await opnHttp(fwId);
  const pre = await http.post(`${base}/api/firewall/filter/searchRule`, {}).then(r=>r.data).catch(()=>null);
  const add = await http.post(`${base}/api/firewall/filter/addRule`, rule).then(r=>r.data);
  const ap = await http.post(`${base}/api/firewall/filter/apply`, {}).then(r=>r.data);
  return { pre, add, apply: ap };
}
async function actionOpnBlockIp(action, ev){
  try {
    const ip = (action.ip_side === 'dest') ? ev?.dest_ip : ev?.src_ip;
    if (!ip) return { skipped: 'no ip' };
    const rule = {
      action: 'block', interface: action.interface || 'wan', protocol: 'any', source: 'any', destination: ip,
      description: action.description || `FazAI AutoBlock ${ip}`
    };
    return await applyOpnRule(action.fw_id, rule);
  } catch (e) { return { error: e.message }; }
}
async function actionCfBlockIp(action, ev){
  try {
    const ip = ev?.src_ip || ev?.dest_ip; if (!ip) return { skipped: 'no ip' };
    const headers = { Authorization: `Bearer ${action.api_token}`, 'Content-Type':'application/json' };
    const url = `https://api.cloudflare.com/client/v4/zones/${encodeURIComponent(action.zone_id)}/firewall/rules`;
    const payload = [{ action: 'block', description: action.description || `FazAI AutoBlock ${ip}`, filter: { expression: `(ip.src eq ${ip})` } }];
    const r = await axios.post(url, payload, { headers, timeout: 20000 }).then(r=>r.data);
    return r;
  } catch (e) { return { error: e.message }; }
}
async function actionSpxQuarantine(action, ev){
  try { return await spxReq(action.base_url, action.api_key, ['quarantine','add'], action.params||{}); } catch (e) { return { error: e.message }; }
}
async function actionSpxAllowlist(action, ev){
  try { return await spxReq(action.base_url, action.api_key, ['domain','allowlist','add'], action.params||{}); } catch (e) { return { error: e.message }; }
}
async function actionSpxBlocklist(action, ev){
  try { return await spxReq(action.base_url, action.api_key, ['domain','blocklist','add'], action.params||{}); } catch (e) { return { error: e.message }; }
}
// Escolha de provedor LLM para decisões estruturadas
function pickLLMProvider(){
  // Preferir OpenRouter, depois OpenAI, depois Llama Server
  const cand = ['openrouter','openai','llama_server'];
  for (const p of cand){
    const pc = AI_CONFIG.providers[p];
    if (!pc) continue;
    if (p === 'llama_server') return { name: p, conf: pc };
    if (pc.api_key) return { name: p, conf: pc };
  }
  return null;
}
async function llmDecideJSON(systemPrompt, userPrompt){
  try {
    const prov = pickLLMProvider();
    if (!prov) throw new Error('Nenhum provedor LLM configurado');
    if (prov.name === 'openrouter' || prov.name === 'openai'){
      const pc = prov.conf;
      const endpoint = pc.endpoint;
      const headers = { 'Authorization': `Bearer ${pc.api_key}`, 'Content-Type': 'application/json', ...(pc.headers||{}) };
      const payload = { model: pc.default_model, messages: [ { role:'system', content: systemPrompt }, { role:'user', content: userPrompt } ], max_tokens: 256, temperature: 0.0 };
      const r = await axios.post(`${endpoint}/chat/completions`, payload, { headers, timeout: 20000 });
      const txt = r.data?.choices?.[0]?.message?.content || '';
      const clean = txt.trim().replace(/^```json\s*/,'').replace(/```\s*$/,'');
      return JSON.parse(clean);
    }
    if (prov.name === 'llama_server'){
      const pc = prov.conf;
      const endpoint = pc.endpoint;
      const payload = { model: pc.default_model, messages: [ { role:'system', content: systemPrompt }, { role:'user', content: userPrompt } ], max_tokens: 256, temperature: 0.0 };
      const r = await axios.post(`${endpoint}/chat/completions`, payload, { timeout: 20000 });
      const txt = r.data?.choices?.[0]?.message?.content || '';
      const clean = txt.trim().replace(/^```json\s*/,'').replace(/```\s*$/,'');
      return JSON.parse(clean);
    }
  } catch (e) { logger.warn(`llmDecideJSON falhou: ${e.message}`); }
  return null;
}
async function aiDecideLLM(rule, ev){
  const system = 'Você é um assistente de segurança. Decida uma única ação JSON válida entre: opn_block_ip (campos: fw_id, ip_side src|dest, interface, description), cf_block_ip (campos: api_token, zone_id, description), noop. Responda somente JSON.';
  const info = { kind: ev?.alert?.signature ? 'suricata' : (ev?.virus?'clamav':'event'), event: ev };
  const user = `Informações do evento:\n${JSON.stringify(info)}\nPolítica:\n${JSON.stringify({ preferred: rule?.ai||null })}\nEscolha a melhor ação.`;
  const out = await llmDecideJSON(system, user);
  if (!out || !out.action) return null;
  return out;
}

// RAG: Recupera contexto (Qdrant -> Context7 fallback)
async function retrieveContext(query){
  const out = { origin: 'none', items: [] };
  try {
    // Tenta Qdrant se configurado + temos como gerar embedding (OpenAI key)
    const qconf = config?.qdrant || {};
    const hasQ = (qconf.enabled === 'true' || qconf.enabled === true) && (qconf.url || process.env.QDRANT_ENDPOINT);
    const openaiKey = process.env.OPENAI_API_KEY || (AI_CONFIG.providers.openai?.api_key);
    if (hasQ && openaiKey) {
      const texts = [ String(query) ];
      const headers = { 'Authorization': `Bearer ${openaiKey}`, 'Content-Type': 'application/json' };
      const embPayload = { model: 'text-embedding-3-small', input: texts };
      const emb = await axios.post('https://api.openai.com/v1/embeddings', embPayload, { headers, timeout: 15000 }).then(r=>r.data.data[0].embedding);
      const base = (qconf.url || process.env.QDRANT_ENDPOINT).replace(/\/$/,'');
      const coll = qconf.collection || 'linux_networking_tech';
      const r = await axios.post(`${base}/collections/${encodeURIComponent(coll)}/points/search`, { vector: emb, limit: 5 }, { timeout: 10000 }).then(r=>r.data);
      const hits = (r?.result||[]).map(x => ({ score: x.score, text: x?.payload?.text, source: x?.payload?.source }));
      if (hits.length) { out.origin='qdrant'; out.items = hits; return out; }
    }
  } catch (e) { logger.warn(`Qdrant retrieve falhou: ${e.message}`); }
  // Fallback Context7
  try {
    const ep = config?.context7?.endpoint || process.env.CONTEXT7_ENDPOINT;
    const key = config?.context7?.api_key || process.env.CONTEXT7_API_KEY;
    if (ep && key) {
      const tool = require('/opt/fazai/tools/context7.js');
      const data = await tool.query({ query, endpoint: ep, api_key: key, timeout_ms: 20000 });
      out.origin = 'context7'; out.items = Array.isArray(data?.results) ? data.results.slice(0,5) : [data];
      return out;
    }
  } catch (e) { logger.warn(`Context7 retrieve falhou: ${e.message}`); }
  return out;
}
// Decisor AI (heurístico) para ações de segurança
function aiDecideAction(rule, ev){
  try {
    // Heurística simples por enquanto (placeholders para integração com LLM/Gemma)
    if (ev?.alert?.signature) {
      const sig = String(ev.alert.signature).toLowerCase();
      const src = ev?.src_ip; const dst = ev?.dest_ip; const ipCount = (src && ipStats.perIp.get(src)) || 0; const sub24 = (src && src.match(/^(\d+)\.(\d+)\.(\d+)\./)) ? `${RegExp.$1}.${RegExp.$2}.${RegExp.$3}.0/24` : null; const subCount = (sub24 && ipStats.perSubnet24.get(sub24)) || 0;
      const badSig = sig.includes('trojan') || sig.includes('malware') || sig.includes('exploit') || sig.includes('policy') || sig.includes('shellcode');
      if (badSig || ipCount >= (rule?.ai?.threshold_ip||3) || subCount >= (rule?.ai?.threshold_subnet||10)) {
        // Preferir bloquear IP de origem no OPNsense se configurado
        if (rule?.ai?.prefer === 'cloudflare' && rule?.ai?.cf) {
          return { type: 'cf_block_ip', ...rule.ai.cf };
        }
        if (rule?.ai?.opn) {
          return { type: 'opn_block_ip', ...rule.ai.opn };
        }
        return { type: 'opn_block_ip', fw_id: rule?.action?.fw_id, ip_side: 'src', interface: 'wan', description: 'FazAI AutoBlock (AI)' };
      }
    }
    if (ev?.virus) {
      // Para detecções de vírus, apenas alertar por enquanto (poderemos implementar quarentena/isolamento)
      return { type: 'noop' };
    }
  } catch (_) {}
  return { type: 'noop' };
}
// Execução genérica de ação normalizada
async function execSecurityAction(action, ev){
  if (!action || !action.type) return { skipped: 'no action' };
  if (action.type === 'opn_block_ip') return await actionOpnBlockIp(action, ev);
  if (action.type === 'cf_block_ip') return await actionCfBlockIp(action, ev);
  if (action.type === 'spx_call') {
    try { const data = await spxReq(action.base_url, action.api_key, [action.controller, action.call || action.action], action.params || {}); return { success: true, data }; }
    catch (e) { return { error: e.message }; }
  }
  if (action.type === 'spx_quarantine') return await actionSpxQuarantine(action, ev);
  if (action.type === 'spx_allowlist') return await actionSpxAllowlist(action, ev);
  if (action.type === 'spx_blocklist') return await actionSpxBlocklist(action, ev);
  return { skipped: `unknown action ${action.type}` };
}
async function evaluateSecurityPolicies(){
  try {
    const now = Date.now();
    // De-duplicação simples de ações em curto intervalo
    if (!evaluateSecurityPolicies._recent) evaluateSecurityPolicies._recent = new Map();
    const recent = evaluateSecurityPolicies._recent; // key -> ts
    for (const r of (secPolicies.rules||[])){
      const win = (r.window_sec || 300) * 1000;
      const from = now - win;
      if (r.type === 'suricata_signature'){
        const matches = telemetryEvents.filter(ev => ev.ts>=from && ev.source==='suricata' && ev.event?.alert?.signature && String(ev.event.alert.signature).includes(r.signature_contains||''));
        if (matches.length >= (r.threshold || 1)){
          const last = matches[matches.length-1];
          const key = `suricata:${r.signature_contains}:${last.event?.src_ip||''}:${last.event?.dest_ip||''}`;
          if (recent.get(key) && (now - recent.get(key) < 120*1000)) continue; // 2min throttle
          recent.set(key, now);
          if (r.action?.type === 'ai_decide') {
            let decided = await aiDecideLLM(r, last.event);
            if (!decided) decided = aiDecideAction(r, last.event);
            await execSecurityAction(decided, last.event);
          } else if (r.action?.type) {
            await execSecurityAction(r.action, last.event);
          }
        }
      } else if (r.type === 'clamav_virus'){
        const matches = telemetryEvents.filter(ev => ev.ts>=from && ev.source==='clamav' && ev.event?.virus && String(ev.event.virus).includes(r.name_contains||''));
        if (matches.length >= (r.threshold || 1)){
          // Ação simples: log por enquanto
          logger.warn(`Policy clamav_virus triggered: ${r.name_contains} x${matches.length}`);
        }
      }
    }
  } catch (e) { logger.warn(`evaluateSecurityPolicies: ${e.message}`); }
}
function startSecPolScheduler(){ try { if (secPolTimer) clearInterval(secPolTimer); } catch(_){}
  secPolTimer = setInterval(evaluateSecurityPolicies, Math.max(10, parseInt(secPolicies.interval_sec||30,10))*1000);
}
startSecPolScheduler();
app.get('/sec/policies', (_req,res)=>{ try { loadSecPolicies(); res.json({ success:true, policies: secPolicies }); } catch(e){ res.status(500).json({ success:false, error:e.message }); } });
    app.post('/sec/policies', (req,res)=>{ try { const body=req.body||{}; secPolicies={ interval_sec: body.interval_sec||30, rules: Array.isArray(body.rules)?body.rules:[] }; saveSecPolicies(); startSecPolScheduler(); res.json({ success:true }); } catch(e){ res.status(400).json({ success:false, error:e.message }); } });

    // ModSecurity setup (Nginx/Apache) via tool
    app.post('/security/modsecurity/setup', async (req, res) => {
      try {
        const tool = require('/opt/fazai/tools/modsecurity_setup.js');
        const out = await tool.run(req.body || {});
        res.json({ success: true, result: out });
      } catch (e) {
        res.status(500).json({ success: false, error: e.message });
      }
    });

    // Provisionamento Grafana (datasource Prometheus + dashboards FazAI)
    app.post('/grafana/provision', async (req, res) => {
      try {
        const tool = require('/opt/fazai/tools/grafana_provision.js');
        const out = await tool.run(req.body || {});
        res.json({ success: true, result: out });
      } catch (e) { res.status(500).json({ success: false, error: e.message }); }
    });

    // Config reload & runtime updates (e.g., telemetry.udp_port)
    app.post('/config/reload', async (req, res) => {
      try {
        const body = req.body || {};
        // Reload from disk if requested
        if (body.reload === true) {
          try {
            // Recarrega fazai.conf (logica simples)
            const configPaths = ['/etc/fazai/fazai.conf', '/etc/fazai.conf'];
            let configPath;
            for (const p of configPaths) { if (fs.existsSync(p)) { configPath = p; break; } }
            if (configPath) {
              const content = fs.readFileSync(configPath, 'utf8');
              const newConf = {}; let sect = '';
              content.split('\n').forEach(line => {
                line = line.trim(); if (!line || line.startsWith('#')) return;
                if (line.startsWith('[') && line.endsWith(']')) { sect = line.slice(1,-1); newConf[sect] = {}; }
                else if (sect && line.includes('=')) { const [k,v] = line.split('=').map(s=>s.trim()); newConf[sect][k] = v; }
              });
              config = newConf; // substitui runtime
            }
          } catch (e) { logger.warn(`reload config falhou: ${e.message}`); }
        }
        // Runtime overrides
        if (body.telemetry && typeof body.telemetry.udp_port !== 'undefined') {
          if (!config.telemetry) config.telemetry = {};
          config.telemetry.udp_port = String(body.telemetry.udp_port);
        }
        // Reinicia UDP listener conforme config
        try { if (typeof startUdpTelemetry === 'function') startUdpTelemetry(); } catch (_) {}
        res.json({ success: true, config: { telemetry: config.telemetry||{} } });
      } catch (e) { res.status(500).json({ success: false, error: e.message }); }
    });

    // Config file (INI-like) get/set with validation
    app.get('/config/get', (req, res) => {
      try {
        const paths = ['/etc/fazai/fazai.conf', '/etc/fazai.conf', '/etc/fazai/fazai.conf.default'];
        let p = null; for (const x of paths){ if (fs.existsSync(x)) { p = x; break; } }
        if (!p) return res.status(404).json({ success:false, error:'config não encontrado' });
        const content = fs.readFileSync(p, 'utf8');
        res.json({ success:true, path:p, content });
      } catch (e) { res.status(500).json({ success:false, error:e.message }); }
    });
    app.post('/config/set', (req, res) => {
      try {
        const { content } = req.body || {};
        if (typeof content !== 'string' || content.length > 200_000) return res.status(400).json({ success:false, error:'conteúdo inválido' });
        // Validação simples: apenas ASCII básico
        if (/[^\x09\x0A\x0D\x20-\x7E]/.test(content)) return res.status(400).json({ success:false, error:'caracteres inválidos' });
        const pathOut = '/etc/fazai/fazai.conf';
        fs.mkdirSync('/etc/fazai', { recursive: true });
        fs.writeFileSync(pathOut, content);
        fs.chmodSync(pathOut, 0o600);
        res.json({ success:true, path: pathOut });
      } catch (e) { res.status(500).json({ success:false, error:e.message }); }
    });
// Endpoint MCP OPNsense (pass-through seguro para rotas permitidas)
app.post('/opn/:id/mcp', async (req, res) => {
  try {
    const { path: p, method = 'POST', params } = req.body || {};
    if (!p || typeof p !== 'string' || !p.startsWith('/api/')) {
      return res.status(400).json({ success: false, error: 'path inválido (deve começar com /api/...)' });
    }
    const allowed = ['firewall/filter', 'unbound', 'dnsmasq', 'openvpn', 'ipsec', 'core/firmware'];
    const seg = p.replace(/^\/api\//,'');
    if (!allowed.some(a => seg.startsWith(a))) return res.status(403).json({ success: false, error: 'rota não permitida' });
    if (!opnRegistry) opnRegistry = new OPNRegistry();
    const fw = opnRegistry.get(req.params.id);
    const sec = opnRegistry.getSecrets(req.params.id);
    if (!fw || !sec) return res.status(404).json({ success: false, error: 'firewall não encontrado' });
    const https = require('https');
    const agent = fw.verify_tls ? undefined : new https.Agent({ rejectUnauthorized: false });
    const auth = Buffer.from(`${sec.api_key}:${sec.api_secret}`).toString('base64');
    const headers = { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' };
    const url = `${fw.base_url}${p}`;
    // Backup pré-apply por módulo (salva JSON atual em arquivo e empacota)
    try {
      const needBackup = /\/(set|apply|reconfigure|upgrade)(\/|$)/.test(p);
      if (needBackup) {
        let preData = null;
        if (p.startsWith('/api/unbound/')) {
          const gp = `${fw.base_url}/api/unbound/settings/get`;
          preData = await axios.get(gp, { headers, httpsAgent: agent, timeout: 10000 }).then(r=>r.data).catch(()=>null);
        } else if (p.startsWith('/api/dnsmasq/')) {
          const gp = `${fw.base_url}/api/dnsmasq/settings/get`;
          preData = await axios.get(gp, { headers, httpsAgent: agent, timeout: 10000 }).then(r=>r.data).catch(()=>null);
        } else if (p.startsWith('/api/firewall/filter')) {
          const gp = `${fw.base_url}/api/firewall/filter/searchRule`;
          preData = await axios.post(gp, {}, { headers, httpsAgent: agent, timeout: 10000 }).then(r=>r.data).catch(()=>null);
        } else if (p.startsWith('/api/openvpn/')) {
          const gp = `${fw.base_url}/api/openvpn/service/status`;
          preData = await axios.get(gp, { headers, httpsAgent: agent, timeout: 10000 }).then(r=>r.data).catch(()=>null);
        } else if (p.startsWith('/api/core/firmware')) {
          const gp = `${fw.base_url}/api/core/firmware/status`;
          preData = await axios.get(gp, { headers, httpsAgent: agent, timeout: 10000 }).then(r=>r.data).catch(()=>null);
        }
        if (preData) {
          const bdir = '/var/backups/fazai/opnsense';
          try { fs.mkdirSync(bdir, { recursive: true }); } catch(_){ }
          const file = `${bdir}/${req.params.id}_preapply_${Date.now()}.json`;
          fs.writeFileSync(file, JSON.stringify(preData, null, 2));
          try { backupPaths('opnsense', [file]); } catch(e){ logger.warn(`Backup pre-apply falhou: ${e.message}`); }
        }
      }
    } catch (e) { logger.warn(`Pré-backup falhou: ${e.message}`); }
    let out;
    if (method.toUpperCase()==='GET') out = await axios.get(url, { headers, httpsAgent: agent, timeout: 15000 }).then(r=>r.data);
    else out = await axios.post(url, params || {}, { headers, httpsAgent: agent, timeout: 15000 }).then(r=>r.data);
    res.json({ success: true, data: out });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

/**
 * Endpoint para gerenciar cache
 */
app.get('/cache', (req, res) => {
  res.json({
    success: true,
    size: cacheManager.size(),
    maxSize: cacheManager.maxSize,
    ttl: cacheManager.ttl
  });
});

app.delete('/cache', (req, res) => {
  cacheManager.clear();
  logger.info('Cache limpo via API');
  res.json({ success: true, message: 'Cache limpo com sucesso' });
});

/**
 * Endpoint para visualizar logs
 */
app.get('/logs', (req, res) => {
  const lines = parseInt(req.query.lines) || 10;
  logger.info(`Solicitação para visualizar ${lines} linhas de log`);

  try {
    if (!fs.existsSync('/var/log/fazai/fazai.log')) {
      return res.json({ 
        success: false, 
        error: 'Arquivo de log não encontrado' 
      });
    }

    const logContent = fs.readFileSync('/var/log/fazai/fazai.log', 'utf8');
    const logLines = logContent.split('\n').filter(line => line.trim() !== '');
    const lastLines = logLines.slice(-lines);

    const parsedLogs = lastLines.map(line => {
      try {
        return JSON.parse(line);
      } catch (err) {
        return { message: line, level: 'info', timestamp: new Date().toISOString() };
      }
    });

    res.json({ 
      success: true, 
      logs: parsedLogs,
      total: logLines.length
    });
  } catch (err) {
    logger.error(`Erro ao ler logs: ${err.message}`);
    res.status(500).json({ 
      success: false, 
      error: `Erro ao ler logs: ${err.message}` 
    });
  }
});

/**
 * Endpoint para limpar logs
 */
app.post('/logs/clear', (req, res) => {
  logger.info('Solicitação para limpar logs');

  try {
    const logFile = '/var/log/fazai/fazai.log';

    if (fs.existsSync(logFile)) {
      // Cria backup antes de limpar
      const backupFile = `/var/log/fazai/fazai.log.backup.${Date.now()}`;
      fs.copyFileSync(logFile, backupFile);

      // Limpa o arquivo de log
      fs.writeFileSync(logFile, '');

      logger.info('Logs limpos com sucesso');
      res.json({ 
        success: true, 
        message: 'Logs limpos com sucesso',
        backup: backupFile
      });
    } else {
      res.json({ 
        success: false, 
        error: 'Arquivo de log não encontrado' 
      });
    }
  } catch (err) {
    logger.error(`Erro ao limpar logs: ${err.message}`);
    res.status(500).json({ 
      success: false, 
      error: `Erro ao limpar logs: ${err.message}` 
    });
  }
});

/**
 * Endpoint para download de logs
 */
app.get('/logs/download', (req, res) => {
  logger.info('Solicitação para download de logs');

  try {
    const logFile = '/var/log/fazai/fazai.log';

    if (fs.existsSync(logFile)) {
      res.setHeader('Content-Type', 'application/octet-stream');
      res.setHeader('Content-Disposition', `attachment; filename="fazai-logs-${new Date().toISOString().split('T')[0]}.log"`);

      const fileStream = fs.createReadStream(logFile);
      fileStream.pipe(res);
    } else {
      res.status(404).json({ 
        success: false, 
        error: 'Arquivo de log não encontrado' 
      });
    }
  } catch (err) {
    logger.error(`Erro ao fazer download dos logs: ${err.message}`);
    res.status(500).json({ 
      success: false, 
      error: `Erro ao fazer download dos logs: ${err.message}` 
    });
  }
});

// Configurações centralizadas
const CONFIG = {
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  FALLBACK_EMAIL: process.env.FALLBACK_EMAIL || 'roger@webstorage.com.br',
  MAX_RETRIES: parseInt(process.env.MAX_RETRIES, 10) || 3,
  MIN_WORDS_FOR_ARCHITECTURE: parseInt(process.env.MIN_WORDS_FOR_ARCHITECTURE, 10) || 4
};


class FazAIDaemon extends EventEmitter {
  constructor() {
    super();
    this.config = this.loadConfig();
    this.logFile = '/var/log/fazai/fazai.log';
    this.isRunning = false;
    this.modules = new Map();
    this.architectureSystem = new ArchitectureSystem();
    this.initializeLogging();
  }

  async processCommand(command, options = {}) {
    try {
      this.log(`Processando comando: ${command}`);


      // Verificar se é um comando do sistema
      if (this.isSystemCommand(command)) {
        return await this.executeSystemCommand(command, options);
      }

      // Verificar se precisa de arquitetamento (mais de 4 palavras)
      const wordCount = command.split(' ').length;
      if (wordCount > CONFIG.MIN_WORDS_FOR_ARCHITECTURE) {
        return await this.architectureSystem.processComplexCommand(command, options);
      }

      // Processar com IA
      return await this.processWithAI(command, options);
    } catch (error) {
      this.log(`Erro ao processar comando: ${error.message}`, 'error');
      throw error;
    }
  }


  /**
   * Inicia o daemon FazAI: carrega plugins, configura endpoints e inicia o servidor HTTP
   */
  start() {
    this.log('Iniciando daemon FazAI');

    // Carrega ferramentas e módulos nativos
    loadTools();
    loadNativeModules();
    initializeComplexModules();

    // Endpoint para receber comandos via API
    app.post('/command', async (req, res) => {
      const { command, mcps } = req.body;
      try {
        const result = await this.processCommand(command, { mcps });
        res.json({ success: true, ...result });
      } catch (err) {
        this.log(`Erro no comando recebido: ${err.message}`, 'error');
        res.status(500).json({ success: false, error: err.message });
      }
    });

    // Montar rotas do agente se disponível
    if (agentHandlers) {
      agentHandlers.mountAgent(app);
      this.log('Rotas do agente inteligente montadas', 'info');
    }

    // Montar rotas do relay se disponível
    if (relayHandlers) {
      relayHandlers.mountRelay(app);
      this.log('Rotas do relay SMTP montadas', 'info');
    }

    // Health check
    app.get('/health', (_req, res) => res.sendStatus(200));
    // Ping simples (evita colidir com agregador /services real abaixo)
    app.get('/services/ping', (_req, res) => res.json({ test: 'working', status: 'ok' }));
    


    // Status de serviços (Docler, Qdrant, Prometheus, Grafana)
    app.get('/services', async (_req, res) => {
      try {
        const statuses = {};
        const http = axios.create({ timeout: 2000 });
        // Docler client/admin
        try { const r = await http.get('http://127.0.0.1:3220'); statuses.docler_client = r.status === 200 ? 'online' : 'unknown'; } catch { statuses.docler_client = 'offline'; }
        try { const r = await http.get('http://127.0.0.1:3221'); statuses.docler_admin = r.status === 200 ? 'online' : 'unknown'; } catch { statuses.docler_admin = 'offline'; }
        // Qdrant
        try { const r = await http.get('http://127.0.0.1:6333/collections'); statuses.qdrant = r.status === 200 ? 'online' : 'unknown'; } catch { statuses.qdrant = 'offline'; }
        // Prometheus
        try { const r = await http.get('http://127.0.0.1:9090/-/healthy'); statuses.prometheus = r.status === 200 ? 'online' : 'unknown'; } catch { statuses.prometheus = 'offline'; }
        // Grafana
        try { const r = await http.get('http://127.0.0.1:3000/api/health'); statuses.grafana = (r.status === 200 && r.data?.database === 'ok') ? 'online' : 'unknown'; } catch { statuses.grafana = 'offline'; }
        // Agregados OPNsense
        try {
          if (!opnRegistry) opnRegistry = new OPNRegistry();
          const items = opnRegistry.list();
          let okc=0, degraded=0, down=0;
          const now = Date.now();
          for (const fw of items) {
            if (fw.last_error) { down++; continue; }
            const seen = fw.last_seen ? new Date(fw.last_seen).getTime() : 0;
            if (seen && now - seen < 5*60*1000) okc++; else degraded++;
          }
          statuses.opnsense_fleet = { ok: okc, degraded, down, total: items.length };
        } catch (_) { statuses.opnsense_fleet = { ok: 0, degraded: 0, down: 0, total: 0 }; }
        res.json({ ok: true, statuses });
      } catch (e) {
        logger.error(`Erro em /services: ${e.message}`);
        res.status(500).json({ ok: false, error: e.message });
      }
    });

    // Registro OPNsense (multi-firewall)
    async function getOpnMetrics(id) {
      if (!opnRegistry) opnRegistry = new OPNRegistry();
      const fw = opnRegistry.get(id);
      const sec = opnRegistry.getSecrets(id);
      if (!fw || !sec) throw new Error('Firewall/segredo ausente');
      const https = require('https');
      const agent = fw.verify_tls ? undefined : new https.Agent({ rejectUnauthorized: false });
      const auth = Buffer.from(`${sec.api_key}:${sec.api_secret}`).toString('base64');
      const headers = { Authorization: `Basic ${auth}` };
      const http = axios.create({ timeout: 10000, httpsAgent: agent, headers });
      const base = fw.base_url.replace(/\/$/, '');
      const out = { id, name: fw.name, version: fw.version || null, uptime: null, cpu_percent: null, mem_percent: null, sessions: null, ifaces: [], last_seen: fw.last_seen || null };

      try {
        // Tenta firmware/status (funciona em ambientes com permissões mais restritas), depois system/info, depois version
        let info = await http.get(`${base}/api/core/firmware/status`).then(r => r.data).catch(() => null);
        if (!info) info = await http.get(`${base}/api/core/system/info`).then(r => r.data).catch(() => null);
        if (info) {
          out.version = out.version || info.version || info.product_version || info?.product?.product_version || null;
          out.uptime = info.uptime || null;
          // Alguns builds podem expor campos de uso
          out.cpu_percent = info.cpu_percent ?? info.cpu_usage ?? null;
          out.mem_percent = info.mem_percent ?? info.memory_usage ?? null;
        } else {
          const ver = await http.get(`${base}/api/core/system/version`).then(r => r.data).catch(() => null);
          if (ver) out.version = out.version || ver.version || ver.product_version || null;
        }
      } catch (_) {}

      // Interfaces básicas
      try {
        let ifs = null;
        try { ifs = await http.get(`${base}/api/interfaces/overview`).then(r => r.data); } catch (_) {}
        if (!ifs) { try { ifs = await http.get(`${base}/api/diagnostics/interface/list`).then(r => r.data); } catch (_) {}
        }
        if (ifs) {
          // Normaliza para uma lista simples (nome/descr/status se disponível)
          if (Array.isArray(ifs)) {
            out.ifaces = ifs.map(x => ({ name: x.name || x.if || x.interface || x.id || '', status: x.status || x.link || x.up || null }));
          } else if (ifs?.data && Array.isArray(ifs.data)) {
            out.ifaces = ifs.data.map(x => ({ name: x.name || x.if || x.interface || x.id || '', status: x.status || x.link || x.up || null }));
          } else if (ifs?.interfaces) {
            out.ifaces = Object.entries(ifs.interfaces).map(([k, v]) => ({ name: v?.name || k, status: v?.status || null }));
          }
        }
      } catch (_) {}

      return out;
    }

    app.post('/opn/add', async (req, res) => {
      try {
        const { name, base_url, api_key, api_secret, verify_tls = true, tags = [] } = req.body || {};
        if (!opnRegistry) opnRegistry = new OPNRegistry();
        try { backupPaths('opnsense', ['/etc/fazai/opnsense.json', '/etc/fazai/secrets/opnsense']); } catch (e) { logger.warn(`Backup opnsense falhou: ${e.message}`); }
        const out = await opnRegistry.add({ name, base_url, api_key, api_secret, verify_tls, tags });
        res.json({ success: true, ...out });
      } catch (e) {
        res.status(400).json({ success: false, error: e.message });
      }
    });

    app.get('/opn/list', (_req, res) => {
      try { if (!opnRegistry) opnRegistry = new OPNRegistry(); res.json({ success: true, items: opnRegistry.list() }); }
      catch (e) { res.status(500).json({ success: false, error: e.message }); }
    });

    app.get('/opn/:id/health', async (req, res) => {
      try { if (!opnRegistry) opnRegistry = new OPNRegistry(); const info = await opnRegistry.health(req.params.id); res.json({ success: true, info }); }
      catch (e) { res.status(500).json({ success: false, error: e.message }); }
    });

    app.get('/opn/:id/interfaces', async (req, res) => {
      try { if (!opnRegistry) opnRegistry = new OPNRegistry(); const data = await opnRegistry.interfaces(req.params.id); res.json({ success: true, data }); }
      catch (e) { res.status(500).json({ success: false, error: e.message }); }
    });

    // Helpers para chamadas OPNsense
    async function opnHttp(id) {
      if (!opnRegistry) opnRegistry = new OPNRegistry();
      const fw = opnRegistry.get(id);
      const sec = opnRegistry.getSecrets(id);
      if (!fw || !sec) throw new Error('Firewall/segredo ausente');
      const https = require('https');
      const agent = fw.verify_tls ? undefined : new https.Agent({ rejectUnauthorized: false });
      const auth = Buffer.from(`${sec.api_key}:${sec.api_secret}`).toString('base64');
      const headers = { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' };
      const base = fw.base_url.replace(/\/$/, '');
      const http = axios.create({ timeout: 15000, httpsAgent: agent, headers });
      return { http, base };
    }

    // Firewall - listar regras
    app.get('/opn/:id/firewall/rules', async (req, res) => {
      try {
        const { http, base } = await opnHttp(req.params.id);
        // OPNsense costuma exigir POST para searchRule
        const data = await http.post(`${base}/api/firewall/filter/searchRule`, {}).then(r=>r.data);
        res.json({ success: true, data });
      } catch (e) { res.status(500).json({ success: false, error: e.message }); }
    });

    // Firewall - aplicar (e opcionalmente alterar uma regra)
    app.post('/opn/:id/firewall/apply', async (req, res) => {
      try {
        const { http, base } = await opnHttp(req.params.id);
        const body = req.body || {};
        const { mode, rule, uuid } = body; // mode: add|set|del|apply_only
        let pre = null;
        try { pre = await http.post(`${base}/api/firewall/filter/searchRule`, {}).then(r=>r.data); } catch (_) {}
        let result = {};
        if (mode === 'add' && rule) {
          result.add = await http.post(`${base}/api/firewall/filter/addRule`, rule).then(r=>r.data);
        } else if (mode === 'set' && uuid && rule) {
          result.set = await http.post(`${base}/api/firewall/filter/setRule/${encodeURIComponent(uuid)}`, rule).then(r=>r.data);
        } else if (mode === 'del' && uuid) {
          result.del = await http.post(`${base}/api/firewall/filter/delRule/${encodeURIComponent(uuid)}`, {}).then(r=>r.data);
        }
        result.apply = await http.post(`${base}/api/firewall/filter/apply`, {}).then(r=>r.data);
        res.json({ success: true, pre, result });
      } catch (e) { res.status(500).json({ success: false, error: e.message }); }
    });

    // Diagnostics - estados do firewall (pf states/top)
    app.get('/opn/:id/diagnostics/states', async (req, res) => {
      try {
        const { http, base } = await opnHttp(req.params.id);
        let data = null;
        try { data = await http.get(`${base}/api/diagnostics/firewall/states`).then(r=>r.data); } catch (_) {}
        if (!data) { try { data = await http.get(`${base}/api/diagnostics/firewall/pf_top`).then(r=>r.data); } catch (_) {} }
        res.json({ success: true, data });
      } catch (e) { res.status(500).json({ success: false, error: e.message }); }
    });

    // Diagnostics - atividade do sistema
    app.get('/opn/:id/diagnostics/activity', async (req, res) => {
      try {
        const { http, base } = await opnHttp(req.params.id);
        const data = await http.get(`${base}/api/diagnostics/system/activity`).then(r=>r.data);
        res.json({ success: true, data });
      } catch (e) { res.status(500).json({ success: false, error: e.message }); }
    });

    // Logs de firewall
    app.get('/opn/:id/logs/firewall', async (req, res) => {
      try {
        const { http, base } = await opnHttp(req.params.id);
        const limit = parseInt(req.query.limit || '100', 10) || 100;
        let data = null;
        try { data = await http.get(`${base}/api/diagnostics/firewall/log?limit=${limit}`).then(r=>r.data); } catch (_) {}
        if (!data) { try { data = await http.post(`${base}/api/diagnostics/firewall/log/search`, { limit }).then(r=>r.data); } catch (_) {} }
        res.json({ success: true, data });
      } catch (e) { res.status(500).json({ success: false, error: e.message }); }
    });

    // Métricas simplificadas para UI/alertas
    app.get('/opn/:id/metrics', async (req, res) => {
      try {
        const data = await getOpnMetrics(req.params.id);
        res.json({ success: true, data });
      } catch (e) {
        res.status(500).json({ success: false, error: e.message });
      }
    });

    // Configuração de alertas (UI)
    app.get('/alerts/config', (_req, res) => {
      try { if (!alertsConfig) loadAlertsConfig(); res.json({ success: true, config: alertsConfig }); }
      catch (e) { res.status(500).json({ success: false, error: e.message }); }
    });
    app.post('/alerts/config', (req, res) => {
      try {
        const body = req.body || {};
        alertsConfig = {
          interval_sec: Math.max(15, parseInt(body.interval_sec || 60, 10) || 60),
          rules: Array.isArray(body.rules) ? body.rules : []
        };
        saveAlertsConfig();
        startAlertsScheduler();
        res.json({ success: true });
      } catch (e) {
        res.status(400).json({ success: false, error: e.message });
      }
    });

    // ============================
    // KB / Context7 / Qdrant
    // ============================
    app.post('/kb/context7/query', async (req, res) => {
      try {
        const { query, endpoint, api_key, timeout_ms } = req.body || {};
        // Prefer configs do fazai.conf se não enviados
        const ep = endpoint || config?.context7?.endpoint || process.env.CONTEXT7_ENDPOINT;
        const key = api_key || config?.context7?.api_key || process.env.CONTEXT7_API_KEY;
        if (!ep || !key) return res.status(400).json({ success: false, error: 'endpoint/api_key ausentes' });
        const tool = require('/opt/fazai/tools/context7.js');
        const data = await tool.query({ query, endpoint: ep, api_key: key, timeout_ms });
        res.json({ success: true, provider: 'context7', data });
      } catch (e) { res.status(500).json({ success: false, error: e.message }); }
    });

    // Qdrant wrappers (mínimos)
    function qdr() {
      const base = (config?.qdrant?.endpoint || process.env.QDRANT_ENDPOINT || 'http://127.0.0.1:6333').replace(/\/$/, '');
      const headers = {};
      return { base, headers };
    }
    app.get('/kb/qdrant/collections', async (_req, res) => {
      try { const { base, headers } = qdr(); const r = await axios.get(`${base}/collections`, { headers, timeout: 10000 }); res.json(r.data); }
      catch (e) { res.status(500).json({ success: false, error: e.message }); }
    });
    app.post('/kb/qdrant/upsert', async (req, res) => {
      try {
        const { collection, points } = req.body || {};
        if (!collection || !Array.isArray(points)) return res.status(400).json({ success: false, error: 'collection e points[] são obrigatórios' });
        const { base, headers } = qdr();
        const url = `${base}/collections/${encodeURIComponent(collection)}/points`;
        const r = await axios.put(url, { points }, { headers, timeout: 20000 });
        res.json(r.data);
      } catch (e) { res.status(500).json({ success: false, error: e.message }); }
    });
    app.post('/kb/qdrant/search', async (req, res) => {
      try {
        const { collection, vector, top = 5, filter } = req.body || {};
        if (!collection || !Array.isArray(vector)) return res.status(400).json({ success: false, error: 'collection e vector[] são obrigatórios' });
        const { base, headers } = qdr();
        const url = `${base}/collections/${encodeURIComponent(collection)}/points/search`;
        const r = await axios.post(url, { vector, limit: top, filter }, { headers, timeout: 20000 });
        res.json(r.data);
      } catch (e) { res.status(500).json({ success: false, error: e.message }); }
    });

    // ============================
    // NL Router (admin assistant)
    // ============================
    function findFirewallRef(opts={}){
      try { if (!opnRegistry) opnRegistry = new OPNRegistry(); } catch (_) {}
      const items = opnRegistry ? opnRegistry.list() : [];
      if (opts.id) return items.find(x => x.id === opts.id) || null;
      if (opts.name) return items.find(x => (x.name||'').toLowerCase() === String(opts.name).toLowerCase()) || null;
      return items[0] || null;
    }
    function routeNL(text='', hints={}){
      const t = String(text||'').toLowerCase();
      const steps = [];
      const any = (arr) => arr.some(w => t.includes(w));
      const has = {
        opn: /opnsense|firewall|pf/.test(t),
        list: /(listar|list|mostrar|exibir|ver)/.test(t),
        rules: /(regra|regras|rule|rules|firewall)/.test(t),
        diag: /(diagnost|estado|states|pf_top|atividade|activity)/.test(t),
        logs: /(log|logs|registro)/.test(t),
        cf: /cloudflare/.test(t),
        dns: /(dns|registro|record)/.test(t),
        create: /(criar|adicionar|add|create|atualizar|update)/.test(t),
        spx: /(spamexperts|spam experts)/.test(t),
        inbound: /(inbound|entrada)/.test(t),
        outbound: /(outbound|sa[ií]da)/.test(t),
        quarantine: /(quarenten|quarantine|quarentena)/.test(t),
        release: /(release|liberar)/.test(t),
        ctx7: /(context7|consultar conhecimento|expandir conhecimento)/.test(t)
      };
      // OPNsense
      if (has.opn && has.rules && has.list) {
        const fw = findFirewallRef(hints.opn || {}); const dis = (!fw && opnRegistry) ? { needs_disambiguation: true, options: opnRegistry.list() } : {};
        steps.push({ action: 'opn.firewall.rules', id: fw?.id || null, name: fw?.name || null, ...dis });
      } else if (has.opn && has.diag && /(states|estado|pf_top)/.test(t)) {
        const fw = findFirewallRef(hints.opn || {}); const dis = (!fw && opnRegistry) ? { needs_disambiguation: true, options: opnRegistry.list() } : {};
        steps.push({ action: 'opn.diagnostics.states', id: fw?.id || null, name: fw?.name || null, ...dis });
      } else if (has.opn && /(atividade|activity)/.test(t)) {
        const fw = findFirewallRef(hints.opn || {}); const dis = (!fw && opnRegistry) ? { needs_disambiguation: true, options: opnRegistry.list() } : {};
        steps.push({ action: 'opn.diagnostics.activity', id: fw?.id || null, name: fw?.name || null, ...dis });
      } else if (has.opn && has.logs) {
        const fw = findFirewallRef(hints.opn || {}); const dis = (!fw && opnRegistry) ? { needs_disambiguation: true, options: opnRegistry.list() } : {};
        steps.push({ action: 'opn.logs.firewall', id: fw?.id || null, name: fw?.name || null, params: { limit: 200 }, ...dis });
      }
      // Cloudflare
      if (has.cf && /(zona|zones)/.test(t) && has.list) {
        steps.push({ action: 'cf.zones.list', params: { name: hints?.cf?.name } });
      } else if (has.cf && has.dns && has.create) {
        steps.push({ action: 'cf.dns.create', params: { zone_id: hints?.cf?.zone_id, type: hints?.cf?.type, name: hints?.cf?.name, content: hints?.cf?.content, ttl: hints?.cf?.ttl, proxied: hints?.cf?.proxied } });
      }
      // SpamExperts
      if (has.spx && has.inbound && has.logs) {
        steps.push({ action: 'spx.logs.inbound', params: { domain: hints?.spx?.domain, recipient: hints?.spx?.email } });
      } else if (has.spx && has.outbound && has.logs) {
        steps.push({ action: 'spx.logs.outbound', params: { domain: hints?.spx?.domain, sender: hints?.spx?.email } });
      } else if (has.spx && has.quarantine && has.list) {
        steps.push({ action: 'spx.quarantine.list', params: { domain: hints?.spx?.domain, email: hints?.spx?.email } });
      } else if (has.spx && has.release) {
        steps.push({ action: 'spx.quarantine.release', params: { id: hints?.spx?.id } });
      }
      // Context7
      if (has.ctx7) {
        steps.push({ action: 'kb.context7.query', params: { query: hints?.kb?.query || text } });
      }
      return steps;
    }
    app.post('/nl/route', (req, res) => {
      try { const { text, hints } = req.body || {}; const steps = routeNL(text, hints||{}); res.json({ success: true, steps }); }
      catch (e) { res.status(500).json({ success: false, error: e.message }); }
    });
    app.post('/nl/execute', async (req, res) => {
      try {
        const { text, hints, auth } = req.body || {};
        const steps = routeNL(text, hints||{});
        const results = [];
        for (const s of steps) {
          if (s.action === 'opn.firewall.rules') {
            const r = await app.request?.get?.(`/opn/${s.id}/firewall/rules`) || null; // placeholder; use direct call
            const { http, base } = await opnHttp(s.id);
            const data = await http.post(`${base}/api/firewall/filter/searchRule`, {}).then(r=>r.data);
            results.push({ step: s, data });
          } else if (s.action === 'opn.diagnostics.states') {
            const { http, base } = await opnHttp(s.id);
            let data = null; try { data = await http.get(`${base}/api/diagnostics/firewall/states`).then(r=>r.data); } catch (_) {}
            if (!data) { try { data = await http.get(`${base}/api/diagnostics/firewall/pf_top`).then(r=>r.data); } catch (_) {} }
            results.push({ step: s, data });
          } else if (s.action === 'opn.diagnostics.activity') {
            const { http, base } = await opnHttp(s.id);
            const data = await http.get(`${base}/api/diagnostics/system/activity`).then(r=>r.data);
            results.push({ step: s, data });
          } else if (s.action === 'opn.logs.firewall') {
            const { http, base } = await opnHttp(s.id);
            let data = null; try { data = await http.get(`${base}/api/diagnostics/firewall/log`).then(r=>r.data); } catch (_) {}
            if (!data) { try { data = await http.post(`${base}/api/diagnostics/firewall/log/search`, { limit: (s.params||{}).limit||100 }).then(r=>r.data); } catch (_) {} }
            results.push({ step: s, data });
          } else if (s.action === 'cf.zones.list') {
            const token = auth?.cloudflare_token || req.headers['x-api-token'];
            const url = `https://api.cloudflare.com/client/v4/zones${s.params?.name?`?name=${encodeURIComponent(s.params.name)}`:''}`;
            const data = await axios.get(url, { headers: { Authorization: `Bearer ${token}` }, timeout: 20000 }).then(r=>r.data);
            results.push({ step: s, data });
          } else if (s.action === 'cf.dns.create') {
            const token = auth?.cloudflare_token || req.headers['x-api-token'];
            const z = s.params?.zone_id, p = { type: s.params?.type, name: s.params?.name, content: s.params?.content, ttl: s.params?.ttl||300, proxied: !!s.params?.proxied };
            const data = await axios.post(`https://api.cloudflare.com/client/v4/zones/${encodeURIComponent(z)}/dns_records`, p, { headers: { Authorization: `Bearer ${token}` }, timeout: 20000 }).then(r=>r.data);
            results.push({ step: s, data });
          } else if (s.action === 'spx.logs.inbound') {
            const data = await spxReq(hints?.spx?.base_url, hints?.spx?.api_key, ['report','inbound'], s.params||{});
            results.push({ step: s, data });
          } else if (s.action === 'spx.logs.outbound') {
            const data = await spxReq(hints?.spx?.base_url, hints?.spx?.api_key, ['report','outbound'], s.params||{});
            results.push({ step: s, data });
          } else if (s.action === 'spx.quarantine.list') {
            const data = await spxReq(hints?.spx?.base_url, hints?.spx?.api_key, ['quarantine','list'], s.params||{});
            results.push({ step: s, data });
          } else if (s.action === 'spx.quarantine.release') {
            const data = await spxReq(hints?.spx?.base_url, hints?.spx?.api_key, ['quarantine','release'], s.params||{});
            results.push({ step: s, data });
          } else if (s.action === 'kb.context7.query') {
            const ep = (hints?.kb?.endpoint || config?.context7?.endpoint || process.env.CONTEXT7_ENDPOINT);
            const key = (hints?.kb?.api_key || config?.context7?.api_key || process.env.CONTEXT7_API_KEY);
            const tool = require('/opt/fazai/tools/context7.js');
            const data = await tool.query({ query: s.params?.query || text, endpoint: ep, api_key: key });
            results.push({ step: s, data });
          }
        }
        res.json({ success: true, steps, results });
      } catch (e) { res.status(500).json({ success: false, error: e.message }); }
    });

    // ============================
    // Cloudflare (REST wrapper)
    // ============================
    app.get('/cf/zones', async (req, res) => {
      try {
        const apiToken = req.query.api_token || req.headers['x-api-token'];
        const name = req.query.name;
        if (!apiToken) return res.status(400).json({ success: false, error: 'api_token é obrigatório' });
        const headers = { Authorization: `Bearer ${apiToken}`, 'Content-Type': 'application/json' };
        const url = `https://api.cloudflare.com/client/v4/zones${name ? `?name=${encodeURIComponent(name)}` : ''}`;
        const r = await axios.get(url, { headers, timeout: 20000 });
        return res.json(r.data);
      } catch (e) { res.status(500).json({ success: false, error: e.message }); }
    });
    app.get('/cf/dns', async (req, res) => {
      try {
        const apiToken = req.query.api_token || req.headers['x-api-token'];
        const zoneId = req.query.zone_id;
        const name = req.query.name;
        if (!apiToken || !zoneId) return res.status(400).json({ success: false, error: 'zone_id e api_token são obrigatórios' });
        const headers = { Authorization: `Bearer ${apiToken}`, 'Content-Type': 'application/json' };
        let url = `https://api.cloudflare.com/client/v4/zones/${encodeURIComponent(zoneId)}/dns_records`;
        const q = [];
        if (name) q.push(`name=${encodeURIComponent(name)}`);
        if (q.length) url += `?${q.join('&')}`;
        const r = await axios.get(url, { headers, timeout: 20000 });
        return res.json(r.data);
      } catch (e) { res.status(500).json({ success: false, error: e.message }); }
    });
    app.post('/cf/dns', async (req, res) => {
      try {
        const { api_token, zone_id, type, name, content, ttl = 300, proxied = false } = req.body || {};
        if (!api_token || !zone_id || !type || !name || !content) return res.status(400).json({ success: false, error: 'Parâmetros obrigatórios ausentes' });
        const headers = { Authorization: `Bearer ${api_token}`, 'Content-Type': 'application/json' };
        const url = `https://api.cloudflare.com/client/v4/zones/${encodeURIComponent(zone_id)}/dns_records`;
        const r = await axios.post(url, { type, name, content, ttl, proxied }, { headers, timeout: 20000 });
        return res.json(r.data);
      } catch (e) { res.status(500).json({ success: false, error: e.message }); }
    });

    // ============================
    // SpamExperts (REST wrapper)
    // ============================
    function spxBuildUrl(base, pathParts = [], params = {}) {
      const b = base.replace(/\/$/, '');
      const segs = ['api', ...pathParts.map(s => String(s).replace(/\/+/, ''))];
      const enc = (v) => encodeURIComponent(String(v));
      let url = `${b}/${segs.join('/')}`;
      const kv = [];
      for (const [k, v] of Object.entries(params || {})) {
        if (v === undefined || v === null || v === '') continue;
        kv.push(`${enc(k)}/${enc(v)}`);
      }
      if (kv.length) url += `/${kv.join('/')}`;
      // force JSON format if not already provided
      if (!/\/format\//.test(url)) url += '/format/json';
      return url;
    }
    async function spxReq(base_url, api_key, pathParts, params) {
      if (!base_url || !api_key) throw new Error('base_url e api_key são obrigatórios');
      const headers = { 'X-API-Key': api_key };
      const url = spxBuildUrl(base_url, pathParts, params);
      const r = await axios.get(url, { headers, timeout: 20000 });
      return r.data;
    }

    // Quarantine list
    app.get('/spx/quarantine', async (req, res) => {
      try {
        const { base_url, api_key, domain, email, page, per_page, search } = req.query || {};
        const data = await spxReq(base_url, api_key, ['quarantine', 'list'], {
          domain, email, page: page || 1, per_page: per_page || 100, q: search
        });
        res.json({ success: true, data });
      } catch (e) { res.status(500).json({ success: false, error: e.message }); }
    });
    // Quarantine release
    app.post('/spx/quarantine/release', async (req, res) => {
      try {
        const { base_url, api_key, id, deliver } = req.body || {};
        if (!id) return res.status(400).json({ success: false, error: 'id é obrigatório' });
        const data = await spxReq(base_url, api_key, ['quarantine', 'release'], { id, deliver });
        res.json({ success: true, data });
      } catch (e) { res.status(500).json({ success: false, error: e.message }); }
    });
    // Inbound logs (mail log)
    app.get('/spx/logs/inbound', async (req, res) => {
      try {
        const { base_url, api_key, domain, sender, recipient, from_ts, to_ts, page, per_page } = req.query || {};
        const data = await spxReq(base_url, api_key, ['report', 'inbound'], {
          domain, sender, recipient, from: from_ts, to: to_ts, page: page || 1, per_page: per_page || 100
        });
        res.json({ success: true, data });
      } catch (e) { res.status(500).json({ success: false, error: e.message }); }
    });
    // Outbound logs
    app.get('/spx/logs/outbound', async (req, res) => {
      try {
        const { base_url, api_key, domain, sender, recipient, from_ts, to_ts, page, per_page } = req.query || {};
        const data = await spxReq(base_url, api_key, ['report', 'outbound'], {
          domain, sender, recipient, from: from_ts, to: to_ts, page: page || 1, per_page: per_page || 100
        });
        res.json({ success: true, data });
      } catch (e) { res.status(500).json({ success: false, error: e.message }); }
    });
    // Generic passthrough (whitelist controllers)
    app.post('/spx/call', async (req, res) => {
      try {
        const { base_url, api_key, controller, action, params } = req.body || {};
        const allowed = new Set(['admin','domain','email','quarantine','report','outgoingusers','incomingusers']);
        if (!allowed.has(controller)) return res.status(400).json({ success: false, error: 'controller não permitido' });
        const data = await spxReq(base_url, api_key, [controller, action], params || {});
        res.json({ success: true, data });
      } catch (e) { res.status(500).json({ success: false, error: e.message }); }
    });

    // Inicia o servidor HTTP e WebSocket interativo
    const http = require('http');
    server = http.createServer(app);
    try {
      setupInteractiveWs(server);
    } catch (e) {
      this.log(`WS interativo indisponível: ${e.message}`, 'warn');
    }
    try {
      setupAgentWs(server);
    } catch (e) {
      this.log(`WS agente indisponível: ${e.message}`, 'warn');
    }
    server.listen(PORT, '0.0.0.0', () => this.log(`Servidor ouvindo na porta ${PORT} (0.0.0.0)`));
  }

  /**
   * Carrega configurações centralizadas
   * @returns {object}
   */
  loadConfig() {
    return CONFIG;
  }

  /**
   * Inicializa o sistema de logging interno
   */
  initializeLogging() {
    this.logger = logger;
  }

  /**
   * Registra mensagem no logger
   * @param {string} message
   * @param {string} [level='info']
   */
  log(message, level = 'info') {
    this.logger.log({ level, message });
  }
}

// WebSocket interativo via node-pty
function setupInteractiveWs(httpServer) {
  let WebSocketServer, nodePty;
  try {
    WebSocketServer = require('ws').Server;
    nodePty = require('node-pty');
  } catch (e) {
    logger.warn('Dependências WS/PTY ausentes; modo interativo desabilitado');
    return;
  }

  const wss = new WebSocketServer({ server: httpServer, path: '/ws/interactive' });
  logger.info('WebSocket interativo habilitado em /ws/interactive');

  wss.on('connection', (ws, req) => {
    // Inicia um shell de login não-interativo com bash -lc, com TTY
    const shell = process.env.SHELL || 'bash';
    const pty = nodePty.spawn(shell, ['-lc', ''], {
      name: 'xterm-color',
      cols: 120,
      rows: 32,
      cwd: process.env.HOME,
      env: process.env
    });

    const send = (type, payload) => {
      try { ws.send(JSON.stringify({ type, ...payload })); } catch (_) {}
    };

    send('ready', { cols: 120, rows: 32 });

    pty.onData((data) => send('stdout', { data }));
    pty.onExit(({ exitCode, signal }) => {
      send('exit', { code: exitCode, signal });
      try { ws.close(); } catch (_) {}
    });

    ws.on('message', (msg) => {
      try {
        const m = JSON.parse(msg.toString());
        if (m.type === 'stdin' && typeof m.data === 'string') {
          pty.write(m.data);
        } else if (m.type === 'resize' && m.cols && m.rows) {
          pty.resize(m.cols, m.rows);
        } else if (m.type === 'exec' && typeof m.cmd === 'string') {
          pty.write(`${m.cmd}\n`);
        }
      } catch (_) {}
    });

    ws.on('close', () => { try { pty.kill(); } catch (_) {} });
    ws.on('error', () => { try { pty.kill(); } catch (_) {} });
  });
}

// WebSocket Agente: loop pensar -> agir -> observar
function setupAgentWs(httpServer) {
  let WebSocketServer;
  try {
    WebSocketServer = require('ws').Server;
  } catch (e) {
    logger.warn('Dependência WS ausente; modo agente desabilitado');
    return;
  }

  const wss = new WebSocketServer({ server: httpServer, path: '/ws/agent' });
  logger.info('WebSocket de agente habilitado em /ws/agent');

  // Utilitário: parse JSON robusto (aceita blocos com ```json ... ```)
  const safeParseJson = (text) => {
    try {
      if (typeof text !== 'string') return null;
      let s = text.trim();
      if (s.startsWith('```')) {
        s = s.replace(/^```[a-zA-Z0-9_-]*\s*\n/, '');
        s = s.replace(/\n```\s*$/, '');
      }
      // Tenta extrair o primeiro objeto JSON
      const start = s.indexOf('{');
      const end = s.lastIndexOf('}');
      if (start !== -1 && end !== -1 && end > start) {
        s = s.substring(start, end + 1);
      }
      return JSON.parse(s);
    } catch (_) { return null; }
  };

  // Decide próxima ação via LLM (sempre 1 ação por iteração)
  async function agentDecide(context) {
    const availableToolNames = Object.keys(loadedTools);
    const systemPrompt = [
      'Você é um agente de automação Linux do FazAI.',
      'Siga o ciclo: pensar -> agir -> observar, UMA ação por iteração.',
      'Ambiente: root, bash -lc no diretório ${CWD}.',
      'Ferramentas disponíveis:',
      `- shell: executar um único comando bash (não interativo, preferir flags -y).`,
      `- tool:<nome>: executar uma ferramenta carregada (${availableToolNames.join(', ')}).`,
      `- file_read: ler um arquivo local (params: {"path":"/abs"}).`,
      `- file_write: escrever um arquivo local (params: {"path":"/abs","content":"..."}).`,
      `- ask_user: solicitar informação ao usuário e aguardar.`,
      '',
      'Responda APENAS em JSON com o seguinte formato:',
      '{"action":"shell|tool|file_read|file_write|ask_user|stop",',
      ' "command":"<linha única>",',
      ' "tool":"<nome da tool>", "params":{...},',
      ' "confirm":true|false,',
      ' "rationale":"explicação breve"}',
      '',
      'Regras:',
      '- Nunca devolva markdown nem explicações fora do JSON.',
      '- Para ações potencialmente destrutivas, defina confirm=true.',
      '- Quando precisar de dados do usuário, use action=ask_user e pare.',
      '- Se o objetivo foi alcançado, use action=stop.'
    ].join('\n');

    const userContent = [
      `Objetivo: ${context.goal || '(não informado)'}`,
      `CWD: ${context.cwd}`,
      `Histórico (resumo curto): ${context.history.slice(-6).map(h=>`[${h.role}] ${String(h.content).slice(0,200)}`).join(' | ')}`,
      'Decida a próxima ação.'
    ].join('\n');

    const provider = process.env.DEFAULT_PROVIDER || AI_CONFIG.default_provider;
    const providerConfig = AI_CONFIG.providers[provider];
    const headers = {
      'Content-Type': 'application/json',
      ...providerConfig.headers
    };
    if (providerConfig.api_key) headers.Authorization = `Bearer ${providerConfig.api_key}`;

    const payload = {
      model: providerConfig.default_model,
      messages: [
        { role: 'system', content: systemPrompt.replace('${CWD}', context.cwd) },
        { role: 'user', content: userContent }
      ],
      max_tokens: providerConfig.max_tokens
    };

    const endpoint = `${providerConfig.endpoint}/chat/completions`;
    const resp = await axios.post(endpoint, payload, { headers });
    const content = resp.data.choices[0].message.content;
    const json = safeParseJson(content);
    if (!json || !json.action) {
      return { action: 'ask_user', rationale: 'Resposta inválida do modelo. Descreva melhor o objetivo.' };
    }
    return json;
  }

  // Executa uma ação decidida pelo agente
  async function executeAgentAction(ws, ctx, decision) {
    const send = (type, payload) => { try { ws.send(JSON.stringify({ type, ...payload })); } catch (_) {} };
    switch (decision.action) {
      case 'stop':
        send('done', { success: true, message: 'Objetivo concluído' });
        return { done: true };
      case 'ask_user':
        ctx.waiting = 'user_input';
        send('ask', { prompt: decision.prompt || 'Forneça mais detalhes para prosseguir.' });
        return { done: false };
      case 'file_read': {
        try {
          const p = String(decision.params?.path || '');
          const content = fs.readFileSync(p, 'utf8');
          ctx.history.push({ role: 'tool', content: `file_read:${p} bytes=${content.length}` });
          send('result', { action: 'file_read', path: p, length: content.length, preview: content.slice(0, 1000) });
        } catch (e) {
          send('error', { message: `file_read falhou: ${e.message}` });
        }
        return { done: false };
      }
      case 'file_write': {
        try {
          const p = String(decision.params?.path || '');
          const c = String(decision.params?.content || '');
          fs.writeFileSync(p, c);
          ctx.history.push({ role: 'tool', content: `file_write:${p} bytes=${c.length}` });
          send('result', { action: 'file_write', path: p, length: c.length });
        } catch (e) {
          send('error', { message: `file_write falhou: ${e.message}` });
        }
        return { done: false };
      }
      case 'tool': {
        const name = String(decision.tool || '').trim();
        const params = decision.params || {};
        const tool = loadedTools[name];
        if (!tool) { send('error', { message: `Tool não encontrada: ${name}` }); return { done: false }; }
        send('step_start', { kind: 'tool', tool: name, params });
        try {
          let out;
          if (typeof tool.run === 'function') out = await tool.run(params);
          else if (typeof tool.execute === 'function') out = await tool.execute('', params);
          else if (name === 'web_search' && typeof tool.search === 'function') out = await tool.search(params.query || '');
          else out = await tool(params);
          ctx.history.push({ role: 'tool', content: `tool:${name} -> ${JSON.stringify(out).slice(0,2000)}` });
          send('step_end', { kind: 'tool', tool: name, ok: true });
          send('result', { action: 'tool', tool: name, output: out });
        } catch (e) {
          send('step_end', { kind: 'tool', tool: name, ok: false });
          send('error', { message: `Tool ${name} falhou: ${e.message}` });
        }
        return { done: false };
      }
      case 'shell': {
        const cmd = String(decision.command || '').trim();
        if (!cmd) { send('error', { message: 'Comando vazio' }); return { done: false }; }
        if (decision.confirm) {
          ctx.waiting = 'confirm';
          ctx.pending = { type: 'shell', cmd };
          send('confirm_needed', { command: cmd });
          return { done: false };
        }
        return await new Promise((resolve) => {
          send('step_start', { kind: 'shell', command: cmd });
          const child = spawn('bash', ['-lc', cmd], { cwd: ctx.cwd });
          child.stdout.on('data', (d) => send('stdout', { chunk: d.toString() }));
          child.stderr.on('data', (d) => send('stderr', { chunk: d.toString() }));
          child.on('error', (e) => send('error', { message: e.message }));
          child.on('close', (code) => {
            ctx.history.push({ role: 'tool', content: `shell:${cmd} -> code=${code}` });
            send('step_end', { kind: 'shell', code });
            resolve({ done: false });
          });
        });
      }
      default:
        send('error', { message: `Ação desconhecida: ${decision.action}` });
        return { done: false };
    }
  }

  wss.on('connection', (ws) => {
    const ctx = { goal: '', cwd: process.env.HOME, history: [], waiting: null, pending: null, steps: 0, maxSteps: 20 };
    const send = (type, payload) => { try { ws.send(JSON.stringify({ type, ...payload })); } catch (_) {} };

    send('state', { status: 'ready', message: 'Agente pronto. Envie seu objetivo.' });

    const loop = async () => {
      if (ctx.waiting) return; // aguardando usuário
      if (ctx.steps >= ctx.maxSteps) { send('done', { success: false, message: 'Limite de passos atingido' }); return; }
      ctx.steps++;
      try {
        const decision = await agentDecide(ctx);
        send('thought', { rationale: decision.rationale || '' });
        const result = await executeAgentAction(ws, ctx, decision);
        if (result.done) return; // concluído
        // Se não estiver esperando input, continua a iterar automaticamente
        if (!ctx.waiting) setTimeout(loop, 10);
      } catch (e) {
        send('error', { message: e.message });
      }
    };

    ws.on('message', async (msg) => {
      let m;
      try { m = JSON.parse(msg.toString()); } catch (_) { m = { type: 'user', text: msg.toString() }; }
      if (m.type === 'start') {
        ctx.goal = String(m.goal || '').trim();
        ctx.cwd = m.cwd && typeof m.cwd === 'string' ? m.cwd : ctx.cwd;
        ctx.history.push({ role: 'user', content: `Objetivo inicial: ${ctx.goal}` });
        send('state', { status: 'running', goal: ctx.goal, cwd: ctx.cwd });
        setTimeout(loop, 10);
      } else if (m.type === 'user') {
        const text = String(m.text || '').trim();
        if (!text) return;
        if (ctx.waiting === 'confirm') {
          const ok = /^y(es)?|sim|s$/i.test(text);
          const pending = ctx.pending; ctx.pending = null; ctx.waiting = null;
          if (pending && pending.type === 'shell') {
            if (!ok) { send('result', { action: 'confirm', accepted: false }); setTimeout(loop, 10); return; }
            // Executa comando aprovado
            await executeAgentAction(ws, ctx, { action: 'shell', command: pending.cmd, confirm: false });
            setTimeout(loop, 10);
            return;
          }
        } else if (ctx.waiting === 'user_input') {
          ctx.history.push({ role: 'user', content: text });
          ctx.waiting = null;
          setTimeout(loop, 10);
          return;
        } else {
          // Novo contexto/instrução adicional
          ctx.history.push({ role: 'user', content: text });
          setTimeout(loop, 10);
          return;
        }
      }
    });

    ws.on('close', () => {});
    ws.on('error', () => {});
  });
}

// Sistema de Arquitetamento Simplificado
class ArchitectureSystem {
  constructor() {
    // Sistema simplificado sem dependências externas
  }

  async processComplexCommand(command, options = {}) {
    try {
      console.log(`Arquitetando comando complexo: ${command}`);

      // Cria um plano básico para comandos complexos
      const basicPlan = {
        needs_agent: false,
        required_info: [],
        steps: [`echo "Comando complexo detectado: ${command}"`, command],
        dependencies: [],
        monitoring: [],
        notifications: [],
        estimated_time: 'variável',
        complexity: 'média'
      };

      // Executar arquitetura planejada
      return await this.executeArchitecture(basicPlan, options);
    } catch (error) {
      console.error(`Erro no sistema de arquitetamento: ${error.message}`);
      throw error;
    }
  }

  async executeArchitecture(architecture, options = {}) {
    try {
      const steps = architecture.steps || [];
      const results = [];

      for (let i = 0; i < steps.length; i++) {
        const step = steps[i];
        console.log(`Executando passo ${i + 1}: ${step.description}`);

        const result = await this.executeStep(step, options);
        results.push(result);

        // Se o passo falhar e for crítico, parar
        if (!result.success && step.critical) {
          break;
        }
      }

      return {
        success: true,
        results: results,
        architecture: architecture
      };
    } catch (error) {
      console.error(`Erro ao executar arquitetura: ${error.message}`);
      throw error;
    }
  }

  async executeStep(step, options = {}) {
    try {
      const command = step.command || step.cmd;
      if (!command) {
        throw new Error('Comando não especificado no passo');
      }

      return new Promise((resolve, reject) => {
        exec(command, options, (error, stdout, stderr) => {
          if (error) {
            resolve({
              success: false,
              error: error.message,
              stdout: stdout,
              stderr: stderr
            });
          } else {
            resolve({
              success: true,
              stdout: stdout,
              stderr: stderr
            });
          }
        });
      });
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
}

// Inicializar daemon
const daemon = new FazAIDaemon();
daemon.start();

module.exports = FazAIDaemon;
