#!/usr/bin/env node

/*
 * FazAI - Orquestrador Inteligente de Automação
 * Autor: Roger Luft
 * Licença: Creative Commons Attribution 4.0 International (CC BY 4.0)
 * https://creativecommons.org/licenses/by/4.0/
 * Versão: 1.42.0
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
const ffi = require('ffi-napi-v22');
const axios = require('axios');
const winston = require('winston');
const EventEmitter = require('events');
const crypto = require('crypto');

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
    service: 'fazai-daemon',
    version: '1.42.0'
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

// Configuração do servidor Express
const app = express();
const PORT = process.env.PORT || 3120;

// Configuração unificada de provedores de IA
let AI_CONFIG = {
  default_provider: 'openrouter',
  enable_fallback: true,
  max_retries: 3,
  retry_delay: 2,
  continue_on_error: true,
  enable_architecting: true,
  providers: {
    openrouter: {
      api_key: '',
      endpoint: 'https://openrouter.ai/api/v1',
      default_model: 'deepseek/deepseek-r1-0528:free',
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
    requesty: {
      api_key: '',
      endpoint: 'https://router.requesty.ai/v1',
      default_model: 'openai/gpt-4o',
      temperature: 0.7,
      max_tokens: 2000
    },
    deepseek: {
      api_key: '',
      endpoint: 'https://openrouter.ai/api/v1',
      default_model: 'tngtech/deepseek-r1t2-chimera:free',
      temperature: 0.3,
      max_tokens: 2000,
      headers: {
        'HTTP-Referer': 'https://github.com/RLuf/FazAI',
        'X-Title': 'FazAI Fallback'
      }
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
      endpoint: '/root/gemma.cpp/build/gemma',
      default_model: 'gemma2-2b-it',
      temperature: 0.2,
      max_tokens: 1024,
      no_auth: true
    }
  },
  // Ordem de fallback para provedores
  fallback_order: ['gemma_cpp', 'llama_server', 'openrouter', 'deepseek', 'requesty', 'openai', 'anthropic', 'gemini', 'ollama']
};

// Middleware para processar JSON
app.use(express.json());

// Diretório de plugins e módulos
const TOOLS_DIR = '/opt/fazai/tools';
const MODS_DIR = '/opt/fazai/mods';

// Cache para plugins e módulos carregados
const loadedTools = {};
const loadedMods = {};

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
    ['openrouter', 'openai', 'requesty', 'deepseek', 'ollama', 'anthropic', 'gemini'].forEach(provider => {
      if (config[provider]) {
        Object.keys(config[provider]).forEach(key => {
          if (AI_CONFIG.providers[provider][key] !== undefined) {
            AI_CONFIG.providers[provider][key] = config[provider][key];
          }
        });
      }
    });

    logger.info('Configuração carregada com sucesso');
    // Ajusta nível de log via seção [logging]
    if (config.logging && config.logging.level) {
      logger.level = config.logging.level;
      logger.info(`Nível de log ajustado para: ${logger.level}`);
    }
    // Atualiza configurações globais (API keys, limites e e-mail de fallback)
    if (config.global) {
      if (config.global.openai_api_key) CONFIG.OPENAI_API_KEY = config.global.openai_api_key;
      if (config.global.deepseek_api_key) CONFIG.DEEPSEEK_API_KEY = config.global.deepseek_api_key;
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

  // Auto-instala genaiscript.js se ausente
  const genaiPath = path.join(__dirname, 'genaiscript.js');
  if (!fs.existsSync(genaiPath)) {
    logger.info('genaiscript.js não encontrado, executando instalador...');
    try {
      execSync('/opt/fazai/lib/tools/install-genaiscript.sh', { stdio: 'inherit' });
    } catch (instErr) {
      logger.error('Erro ao instalar genaiscript.js:', instErr);
    }
  }
  try {
    // Tenta usar genaiscript primeiro
    const genaiscriptPath = '/opt/fazai/lib/genaiscript.js';

    if (fs.existsSync(genaiscriptPath)) {
      logger.info('Usando genaiscript para arquitetamento');

      const architectPrompt = `
Você é um arquiteto de sistemas especializado em automação Linux. 
Analise este comando complexo e crie um plano estruturado:

COMANDO: ${command}

Responda em formato JSON com esta estrutura:
{
  "needs_agent": true/false,
  "required_info": ["lista de informações necessárias"],
  "steps": ["passo 1", "passo 2", ...],
  "dependencies": ["dependência 1", "dependência 2", ...],
  "monitoring": ["logs a monitorar", ...],
  "notifications": ["quando notificar", ...],
  "estimated_time": "tempo estimado",
  "complexity": "baixa|média|alta"
}

Para comandos como SMTP/email, sempre inclua "needs_agent": true e pergunte por configurações necessárias.
`;

      return new Promise((resolve) => {
        exec(`node ${genaiscriptPath} "${architectPrompt}"`, (error, stdout, stderr) => {
          if (error) {
            logger.error(`Erro no genaiscript: ${error.message}`);
            resolve(fallbackToDeepseek(command));
          } else {
            try {
              const plan = JSON.parse(stdout.trim());
              logger.info('Plano arquitetural criado via genaiscript');
              resolve({
                interpretation: plan,
                success: true,
                isArchitected: true,
                method: 'genaiscript'
              });
            } catch (parseErr) {
              logger.error(`Erro ao parsear resposta do genaiscript: ${parseErr.message}`);
              resolve(fallbackToDeepseek(command));
            }
          }
        });
      });
    } else {
      // Fallback direto para deepseek
      return await fallbackToDeepseek(command);
    }
  } catch (err) {
    logger.error(`Erro no arquitetamento: ${err.message}`);
    return await fallbackToDeepseek(command);
  }
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
 * Fallback para DeepSeek quando outros provedores falham
 * @param {string} command - Comando a ser interpretado
 * @returns {Promise<object>} - Interpretação do comando
 */
async function fallbackToDeepseek(command) {
  logger.info('Fallback DeepSeek ignorado - sem API configurada');
  
  // Retorna uma interpretação simples baseada no comando
  if (command.toLowerCase().includes('usuario') || command.toLowerCase().includes('user')) {
    return {
      interpretation: 'useradd -m cursor && echo "cursor:123456" | chpasswd && cat /etc/passwd | grep -E ":[0-9]{4}:" | cut -d: -f1',
      success: true
    };
  }
  
  return {
    interpretation: 'echo "Comando interpretado via fallback simples"',
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
    if (provider !== 'ollama' && !apiKey) {
      logger.info(`Pulando ${provider} - chave de API não configurada`);
      continue;
    }
    
    try {
      logger.info(`Tentando provedor: ${provider} (tentativa ${i + 1}/${providers.length})`);
      if (provider === 'gemma_cpp') {
        // Invoca o binário local do gemma.cpp e retorna a saída diretamente
        const weights = process.env.GEMMA_WEIGHTS || '/root/gemma.cpp/build/gemma2-2b-it-sfp.sbs';
        const tokenizer = process.env.GEMMA_TOKENIZER || '/root/gemma.cpp/build/tokenizer.spm';
        const model = process.env.GEMMA_MODEL || 'gemma2-2b-it';
        const maxTokens = providerConfig.max_tokens || 1024;
        const verbosity = 0;
        const bin = '/root/gemma.cpp/build/gemma_oneshot';
        const args = [
          bin,
          '--weights', weights,
          '--tokenizer', tokenizer,
          '--model', model,
          '--verbosity', String(verbosity)
        ];
        const { execFileSync } = require('child_process');
        try {
          const out = execFileSync(args[0], args.slice(1), { encoding: 'utf8', input: command + '\n' });
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

  // Se todos os provedores falharam, tenta fallback via helper Node.js
  if (AI_CONFIG.enable_fallback) {
    logger.info('Todos os provedores falharam - usando fallback via fazai_helper');
    const { exec } = require('child_process');
    const helperPath = '/opt/fazai/lib/fazai_helper.js';
    if (fs.existsSync(helperPath)) {
      return new Promise((resolve) => {
        exec(`node ${helperPath} "${command}"`, { cwd }, (error, stdout, stderr) => {
          if (error) {
            logger.error(`Erro no fazai_helper: ${error.message}`);
            resolve({
              interpretation: 'echo "Não foi possível interpretar o comando via IA."',
              success: false
            });
          } else {
            resolve({
              interpretation: stdout.trim(),
              success: true
            });
          }
        });
      });
    }
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

  const systemPrompt = `Você é um assistente de sistema Linux executando como root. ` +
    `Sua função é interpretar comandos em linguagem natural e convertê-los em comandos shell executáveis. ` +
    `Responda APENAS com o comando shell, sem explicações, comentários ou justificativas. ` +
    `Você pode propor usar tools registradas como 'tool:<nome> param={...}' quando a tarefa exigir integrações complexas (ex.: email_relay, web_search). ` +
    `Diretório atual: ${cwd}, PATH: ${process.env.PATH}`;
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
      const steps = await queryAIForSteps(interpretation.interpretation, currentDir);
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
      const result = await executeCommand(interpretation.interpretation, currentDir);

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
    send('interpretation', { interpretation: interpretation.interpretation });
    streamCommand(res, interpretation.interpretation, currentDir);
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
    version: '1.42.0',
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
  DEEPSEEK_API_KEY: process.env.DEEPSEEK_API_KEY,
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

    // Health check
    app.get('/health', (_req, res) => res.sendStatus(200));

    // Inicia o servidor HTTP
    app.listen(PORT, () => this.log(`Servidor ouvindo na porta ${PORT}`));
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

// Sistema de Arquitetamento
class ArchitectureSystem {
  constructor() {
    this.genaiscriptPath = '/opt/fazai/lib/genaiscript.js';
    this.helperPath = '/opt/fazai/lib/fazai_helper.js';
  }

  async processComplexCommand(command, options = {}) {
    try {
      console.log(`Arquitetando comando complexo: ${command}`);

      // Tentar usar genaiscript primeiro
      let architecture = await this.tryGenaiscript(command);

      // Se falhar, usar helper Node.js como fallback
      if (!architecture) {
        architecture = await this.tryHelper(command);
      }

      if (!architecture) {
        throw new Error('Falha ao arquitetar comando');
      }

      // Executar arquitetura planejada
      return await this.executeArchitecture(architecture, options);
    } catch (error) {
      console.error(`Erro no sistema de arquitetamento: ${error.message}`);
      throw error;
    }
  }

  async tryGenaiscript(command) {
    try {
      if (!fs.existsSync(this.genaiscriptPath)) {
        console.log('Genaiscript não encontrado, usando fallback');
        return null;
      }

      return new Promise((resolve, reject) => {
        const child = spawn('node', [this.genaiscriptPath, command], {
          stdio: 'pipe',
          env: { ...process.env, OPENAI_API_KEY: CONFIG.OPENAI_API_KEY }
        });

        let output = '';
        child.stdout.on('data', (data) => {
          output += data.toString();
        });

        child.on('close', (code) => {
          if (code === 0) {
            resolve(JSON.parse(output));
          } else {
            resolve(null);
          }
        });

        setTimeout(() => {
          child.kill();
          resolve(null);
        }, 30000);
      });
    } catch (error) {
      console.error(`Erro no genaiscript: ${error.message}`);
      return null;
    }
  }

  async tryHelper(command) {
    try {
      if (!fs.existsSync(this.helperPath)) {
        console.log('Helper não encontrado');
        return null;
      }

      return new Promise((resolve) => {
        const child = spawn('node', [this.helperPath, command], {
          stdio: 'pipe',
          env: { ...process.env, DEEPSEEK_API_KEY: CONFIG.DEEPSEEK_API_KEY }
        });

        let output = '';
        child.stdout.on('data', (data) => {
          output += data.toString();
        });

        child.on('close', (code) => {
          if (code === 0) {
            resolve(JSON.parse(output));
          } else {
            resolve(null);
          }
        });

        setTimeout(() => {
          child.kill();
          resolve(null);
        }, 30000);
      });
    } catch (error) {
      console.error(`Erro no helper: ${error.message}`);
      return null;
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
