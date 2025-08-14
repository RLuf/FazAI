#!/usr/bin/env node

/*
 * FazAI - Orquestrador Inteligente de Automação
 * Autor: Roger Luft
 * Licença: Creative Commons Attribution 4.0 International (CC BY 4.0)
 * https://creativecommons.org/licenses/by/4.0/
 * Versão: 1.42.2
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
// Guard de DDoS (RTBH/Flowspec/Cloudflare/ASN/País)
let ddosGuard = null;
try { ddosGuard = require('./guard/ddos_guard'); } catch(_) {}

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
    version: '1.42.2',
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

// Servir frontend web diretamente pelo daemon para evitar problemas com file://
try {
  const staticDir = '/opt/fazai/tools';
  app.use('/web', express.static(staticDir));
  // Redireciona raiz para /ui
  app.get('/', (_req, res) => res.redirect('/ui'));
  // Página principal da UI
  app.get('/ui', (_req, res) => {
    try {
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

// Diretório de plugins e módulos
const TOOLS_DIR = '/opt/fazai/tools';
const MODS_DIR = '/opt/fazai/mods';

// Cache para plugins e módulos carregados
const loadedTools = {};
const loadedMods = {};

// Instâncias globais dos módulos de tarefas complexas
let complexTasksManager = null;
let mcpOPNsense = null;

// Telemetria em memória para /metrics
const telemetryStore = new Map(); // hostname -> last payload
let ingestCounter = 0;

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
    if (config.complex_tasks?.enable_server !== false) {
      complexTasksManager.initializeServer()
        .then(() => {
          logger.info('Servidor de tarefas complexas iniciado com sucesso');
        })
        .catch(err => {
          logger.error('Erro ao iniciar servidor de tarefas complexas:', err);
        });
    }

    // Inicializar MCP OPNsense se configurado
    if (config.opnsense?.enabled) {
      mcpOPNsense = new MCPOPNsense({
        host: config.opnsense.host,
        port: config.opnsense.port || 443,
        username: config.opnsense.username,
        password: config.opnsense.password,
        apiKey: config.opnsense.api_key,
        useSSL: config.opnsense.use_ssl !== false
      });

      logger.info('MCP OPNsense inicializado com sucesso');
    }

    logger.info('Módulos de tarefas complexas inicializados');
  } catch (err) {
    logger.error('Erro ao inicializar módulos de tarefas complexas:', err);
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
      AI_CONFIG.default_provider = config.ai_provider.provider || AI_CONFIG.default_provider;
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
  // Remove _ do início e ? do final
  const cleanCommand = command.substring(1, command.length - 1);

  return {
    interpretation: `echo "${cleanCommand}"`,
    success: true,
    isQuestion: true
  };
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
    
    // Para comandos complexos, retorna um plano básico
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

  // Processamento normal para comandos simples com fallback inteligente
  const providers = AI_CONFIG.fallback_order;
  
  for (let i = 0; i < providers.length; i++) {
    const provider = providers[i];
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

  // Se todos os provedores falharam, usa fallback simples
  if (AI_CONFIG.enable_fallback) {
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
    const provider = process.env.DEFAULT_PROVIDER || AI_CONFIG.default_provider;
    const providerConfig = AI_CONFIG.providers[provider];
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
      'Authorization': `Bearer ${providerConfig.api_key}`,
      'Content-Type': 'application/json',
      ...providerConfig.headers
    };

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

// Endpoint para ingestão de telemetria de agentes remotos
app.post('/ingest', (req, res) => {
  try {
    const payload = req.body || {};
    const host = payload.hostname || 'unknown';
    ingestCounter++;
    telemetryStore.set(host, payload);
    logger.info(`ingest`, { type: 'telemetry', hostname: host, timestamp: payload.timestamp });
    // TODO: persistência (MySQL) e forwarding (Kafka/Prom) podem ser plugados aqui
    res.json({ success: true });
  } catch (e) {
    logger.error(`Erro em /ingest: ${e.message}`);
    res.status(500).json({ success: false, error: e.message });
  }
});

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

// Endpoint MCP OPNsense
app.post('/opnsense', async (req, res) => {
  try {
    if (!mcpOPNsense) {
      return res.status(500).json({ success: false, error: 'MCP OPNsense não inicializado. Verifique a seção [opnsense] em /etc/fazai/fazai.conf.' });
    }
    const { command, params } = req.body || {};
    if (!command) return res.status(400).json({ success: false, error: 'Campo "command" obrigatório' });
    const out = await mcpOPNsense.executeMCPCommand(String(command), params || {});
    return res.json({ success: true, command, result: out });
  } catch (e) {
    logger.error(`Erro em /opnsense: ${e.message}`);
    return res.status(500).json({ success: false, error: e.message });
  }
});

// Endpoint de busca web simples usando tool web_search
app.post('/search', async (req, res) => {
  try {
    const query = (req.body && (req.body.q || req.body.query || req.body.command)) || '';
    if (!query || typeof query !== 'string') {
      return res.status(400).json({ success: false, error: 'Parâmetro q/query/command inválido' });
    }
    const webSearchPath = '/opt/fazai/tools/web_search.js';
    if (!fs.existsSync(webSearchPath)) {
      return res.status(500).json({ success: false, error: 'web_search tool ausente' });
    }
    const webSearch = require(webSearchPath);
    const result = await webSearch.search(query);
    if (!result.success) {
      return res.status(500).json({ success: false, error: result.error || 'Falha na pesquisa' });
    }
    const first = Array.isArray(result.results) && result.results.length > 0 ? result.results[0] : null;
    return res.json({ success: true, total: result.results.length, first, results: result.results });
  } catch (e) {
    logger.error(`Erro em /search: ${e.message}`);
    return res.status(500).json({ success: false, error: e.message });
  }
});

// Endpoint DDoS Guard: orquestra ações de mitigação upstream/edge
app.post('/guard', async (req, res) => {
  try {
    if (!ddosGuard || typeof ddosGuard.executeGuard !== 'function') {
      return res.status(500).json({ success: false, error: 'ddos_guard indisponível' });
    }
    const payload = req.body || {};
    const out = await ddosGuard.executeGuard(payload.action, payload.params || {}, { configPath: CONFIG_PATH, logger });
    return res.json({ success: true, action: payload.action, result: out });
  } catch (e) {
    logger.error(`Erro em /guard: ${e.message}`);
    return res.status(500).json({ success: false, error: e.message });
  }
});

// Endpoint Prometheus metrics
app.get('/metrics', (_req, res) => {
  try {
    let lines = [];
    lines.push('# HELP fazai_ingest_total Total de payloads recebidos em /ingest');
    lines.push('# TYPE fazai_ingest_total counter');
    lines.push(`fazai_ingest_total ${ingestCounter}`);

    lines.push('# HELP fazai_host_load1 Load average 1m por host');
    lines.push('# TYPE fazai_host_load1 gauge');
    lines.push('# HELP fazai_host_mem_total_bytes Memória total por host');
    lines.push('# TYPE fazai_host_mem_total_bytes gauge');
    lines.push('# HELP fazai_host_mem_free_bytes Memória livre por host');
    lines.push('# TYPE fazai_host_mem_free_bytes gauge');

    for (const [host, payload] of telemetryStore.entries()) {
      const load1 = Array.isArray(payload.os?.load) ? payload.os.load[0] : null;
      const memTotal = payload.os?.mem?.total ?? null;
      const memFree = payload.os?.mem?.free ?? null;
      if (load1 !== null) lines.push(`fazai_host_load1{host="${host}"} ${load1}`);
      if (memTotal !== null) lines.push(`fazai_host_mem_total_bytes{host="${host}"} ${memTotal}`);
      if (memFree !== null) lines.push(`fazai_host_mem_free_bytes{host="${host}"} ${memFree}`);
    }
    res.setHeader('Content-Type', 'text/plain; version=0.0.4');
    res.send(lines.join('\n') + '\n');
  } catch (e) {
    logger.error(`Erro em /metrics: ${e.message}`);
    res.status(500).send('');
  }
});

/**
 * Endpoint para verificar status do daemon
 */
app.get('/status', (req, res) => {
  logger.info('Verificação de status solicitada');
  res.json({ 
    success: true, 
    status: 'online',
    timestamp: new Date().toISOString(),
            version: '1.42.2',
    cache: {
      size: cacheManager.size(),
      maxSize: cacheManager.maxSize
    }
  });
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
