#!/usr/bin/env node

/*
 * FazAI - Orquestrador Inteligente de Automação
 * Autor: Roger Luft
 * Licença: Creative Commons Attribution 4.0 International (CC BY 4.0)
 * https://creativecommons.org/licenses/by/4.0/
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
const { deepseekFallback } = require("./deepseek_helper");
const winston = require('winston');

// Configuração do logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  defaultMeta: { service: 'fazai-daemon' },
  transports: [
    new winston.transports.File({ filename: '/var/log/fazai/fazai.log' }),
    new winston.transports.Console()
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
  continue_on_error: false,
  enable_architecting: true,
  providers: {
    openrouter: {
      api_key: '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',
      endpoint: 'https://openrouter.ai/api/v1',
      default_model: 'deepseek/deepseek-r1-0528:free',
      temperature: 0.7,
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
      temperature: 0.7,
      max_tokens: 2000
    },
    requesty: {
      api_key: '',
      endpoint: 'https://router.requesty.ai/v1',
      default_model: 'openai/gpt-4o',
      temperature: 0.7,
      max_tokens: 2000
    }
  }
};

// Middleware para processar JSON
app.use(express.json());

// Diretório de plugins e módulos
const TOOLS_DIR = '/opt/fazai/tools';
const MODS_DIR = '/opt/fazai/mods';

// Cache para plugins e módulos carregados
const loadedTools = {};
const loadedMods = {};

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
  const configPath = '/etc/fazai/fazai.conf';
  if (fs.existsSync(configPath)) {
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
    ['openrouter', 'openai', 'requesty'].forEach(provider => {
      if (config[provider]) {
        Object.keys(config[provider]).forEach(key => {
          if (AI_CONFIG.providers[provider][key] !== undefined) {
            AI_CONFIG.providers[provider][key] = config[provider][key];
          }
        });
      }
    });

    logger.info('Configuração carregada com sucesso');
  } else {
    logger.warn('Arquivo de configuração não encontrado, usando valores padrão');
  }
} catch (err) {
  logger.error('Erro ao carregar configuração:', err);
}

/**
 * Analisa comando e verifica se precisa de arquitetamento
 * @param {string} command - Comando a ser analisado
 * @returns {object} - Informações sobre o comando
 */
function analyzeCommand(command) {
  const words = command.trim().split(/\s+/);
  const isQuestion = command.startsWith('_') && command.endsWith('?');
  const isComplex = words.length > 4 && !isQuestion;

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

  try {
    // Tenta usar genaiscript primeiro
    const genaiscriptPath = '/home/runner/workspace/dev/genaiscript.js';

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
 * Fallback para deepseek_helper em arquitetamento
 * @param {string} command - Comando a ser arquitetado
 * @returns {Promise<object>} - Plano via deepseek
 */
async function fallbackToDeepseek(command) {
  logger.info('Usando deepseek_helper para arquitetamento');

  const architectPrompt = `
Analise este comando Linux complexo e crie um plano de execução estruturado:

COMANDO: ${command}

Crie um plano JSON com:
1. Lista de passos sequenciais
2. Dependências necessárias  
3. Informações que precisam ser coletadas do usuário
4. Monitoramento de logs necessário
5. Pontos de notificação

Responda apenas com JSON válido.
`;

  try {
    const result = await deepseekFallback(architectPrompt);

    if (result.success) {
      try {
        const plan = JSON.parse(result.content);
        return {
          interpretation: plan,
          success: true,
          isArchitected: true,
          method: 'deepseek'
        };
      } catch (parseErr) {
        // Se não conseguir parsear, trata como plano textual
        return {
          interpretation: {
            steps: result.content.split('\n').filter(line => line.trim()),
            needs_agent: true,
            complexity: "alta"
          },
          success: true,
          isArchitected: true,
          method: 'deepseek_text'
        };
      }
    } else {
      throw new Error(result.error);
    }
  } catch (err) {
    logger.error(`Erro no fallback deepseek: ${err.message}`);
    return {
      interpretation: {
        steps: ['echo "Erro no arquitetamento. Execute manualmente."'],
        complexity: "alta",
        error: err.message
      },
      success: false,
      isArchitected: true,
      method: 'error'
    };
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
        logger.info(`Executando passo: ${step}`);
        const stepResult = await executeCommand(step);
        results.push({
          step: step,
          output: stepResult.stdout,
          success: true
        });
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
async function queryAI(command) {
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
  try {
    const provider = process.env.DEFAULT_PROVIDER || AI_CONFIG.default_provider;
    logger.info(`Usando provedor: ${provider}`);

    let result = await queryProvider(provider, command);
    logger.info(`Resposta recebida do provedor ${provider}`);
    return result;
  } catch (err) {
    logger.error(`Erro ao consultar IA: ${err.message}`);

    // Tenta fallback se habilitado
    if (AI_CONFIG.enable_fallback) {
      logger.info('Tentando fallback para deepseek_helper');
      try {
        // Usa deepseek_helper standalone se disponível
        const { exec } = require('child_process');
        const deepseekPath = '/opt/fazai/build/deepseek_helper';

        if (fs.existsSync(deepseekPath)) {
          return new Promise((resolve) => {
            exec(`${deepseekPath} "${command}"`, (error, stdout, stderr) => {
              if (error) {
                logger.error(`Erro no deepseek_helper standalone: ${error.message}`);
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
        } else {
          // Fallback para versão Node.js
          return await deepseekFallback(command);
        }
      } catch (fallbackErr) {
        logger.error(`Erro no fallback: ${fallbackErr.message}`);
      }
    }

    // Fallback final
    return {
      interpretation: 'echo "Não foi possível interpretar o comando via IA."',
      success: false
    };
  }
}

/**
 * Consulta modelo de IA para obter passos do MCPS
 * @param {string} command - Comando a ser interpretado
 * @returns {Promise<Array<string>>} - Lista de passos
 */
async function queryAIForSteps(command) {
  logger.info(`Consultando IA (MCPS) para: "${command}"`);
  try {
    const provider = process.env.DEFAULT_PROVIDER || AI_CONFIG.default_provider;
    const providerConfig = AI_CONFIG.providers[provider];
    const prompt = config.mcps_mode?.system_prompt ||
      'Gere uma lista de comandos shell, um por linha, necessários para executar a tarefa.';

    const messages = [
      { role: 'system', content: prompt },
      { role: 'user', content: command }
    ];

    const headers = {
      'Authorization': `Bearer ${providerConfig.api_key}`,
      'Content-Type': 'application/json',
      ...providerConfig.headers
    };

    const response = await axios.post(`${providerConfig.endpoint}/chat/completions`, {
      model: providerConfig.default_model,
      messages,
      temperature: providerConfig.temperature,
      max_tokens: providerConfig.max_tokens
    }, { headers });

    const text = response.data.choices[0].message.content;
    logger.info(`Passos recebidos: ${text}`);
    return text.split('\n').map(l => l.trim()).filter(l => l);
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
async function queryProvider(provider, command) {
  const providerConfig = AI_CONFIG.providers[provider];

  if (!providerConfig) {
    throw new Error(`Provedor desconhecido: ${provider}`);
  }

  const apiKey = providerConfig.api_key || process.env[`${provider.toUpperCase()}_API_KEY`];

  if (!apiKey) {
    throw new Error(`Chave de API não configurada para ${provider}`);
  }

  logger.info(`Enviando requisição para ${provider} (modelo: ${providerConfig.default_model})`);

  const headers = {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    ...providerConfig.headers
  };

  const payload = {
    model: providerConfig.default_model,
    messages: [
      {
        role: 'system',
        content: 'Você é o FazAI, um assistente para automação de servidores Linux. Interprete o comando e forneça instruções para execução.'
      },
      {
        role: 'user',
        content: command
      }
    ],
    temperature: providerConfig.temperature,
    max_tokens: providerConfig.max_tokens
  };

  try {
    const response = await axios.post(`${providerConfig.endpoint}/chat/completions`, payload, { headers });

    logger.info(`Resposta recebida de ${provider}`);

    return {
      interpretation: response.data.choices[0].message.content,
      success: true
    };
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
function executeCommand(command) {
  return new Promise((resolve, reject) => {
    exec(command, (error, stdout, stderr) => {
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
 * Endpoint principal para receber comandos
 */
app.post('/command', async (req, res) => {
  const { command, mcps } = req.body;

  if (!command) {
    logger.error('Requisição recebida sem comando');
    return res.status(400).json({ error: 'Comando não fornecido', success: false });
  }

  logger.info(`Comando recebido: ${command}`);

  try {
    // Interpreta o comando usando IA com arquitetamento
    logger.info('Iniciando interpretação do comando via IA');
    const interpretation = await queryAI(command);

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
      const result = await executeCommand(interpretation.interpretation);
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
      const steps = await queryAIForSteps(interpretation.interpretation);
      const results = [];
      for (const step of steps) {
        try {
          const execResult = await executeCommand(step);
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
      const result = await executeCommand(interpretation.interpretation);

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

/**
 * Endpoint para verificar status do daemon
 */
app.get('/status', (req, res) => {
  logger.info('Verificação de status solicitada');
  res.json({ 
    success: true, 
    status: 'online',
    timestamp: new Date().toISOString(),
    version: '1.40.12'
  });
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
  OPENAI_API_KEY: ''
  DEEPSEEK_API_KEY: '',
  FALLBACK_EMAIL: 'roger@webstorage.com.br',
  MAX_RETRIES: 3,
  MIN_WORDS_FOR_ARCHITECTURE: 4
};

const fs = require('fs');
const path = require('path');
const { spawn, exec } = require('child_process');
const EventEmitter = require('events');

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

      // Verificar se é uma pergunta simples (_pergunta?)
      if (command.startsWith('_') && command.endsWith('?')) {
        return await this.processSimpleQuestion(command);
      }

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
    }Applying the provided changes to implement the architecture system with genaiscript and deepseek_helper, update configurations, and address git issues.```text
       this.log(`Erro ao processar comando: ${error.message}`, 'error');
      throw error;
    }
  }

  async processSimpleQuestion(question) {
    try {
      const cleanQuestion = question.substring(1, question.length - 1);
      const response = `echo "${cleanQuestion}"`;

      return new Promise((resolve, reject) => {
        exec(response, (error, stdout, stderr) => {
          if (error) {
            reject(error);
          } else {
            resolve(stdout.trim());
          }
        });
      });
    } catch (error) {
      this.log(`Erro ao processar pergunta simples: ${error.message}`, 'error');
      throw error;
    }
  }
}

// Sistema de Arquitetamento
class ArchitectureSystem {
  constructor() {
    this.genaiscriptPath = '/home/runner/workspace/dev/genaiscript.js';
    this.deepseekHelperPath = '/home/runner/workspace/opt/fazai/lib/deepseek_helper_standalone';
  }

  async processComplexCommand(command, options = {}) {
    try {
      console.log(`Arquitetando comando complexo: ${command}`);

      // Tentar usar genaiscript primeiro
      let architecture = await this.tryGenaiscript(command);

      // Se falhar, usar deepseek_helper como fallback
      if (!architecture) {
        architecture = await this.tryDeepseekHelper(command);
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

  async tryDeepseekHelper(command) {
    try {
      if (!fs.existsSync(this.deepseekHelperPath)) {
        console.log('DeepSeek helper não encontrado');
        return null;
      }

      return new Promise((resolve, reject) => {
        const child = spawn(this.deepseekHelperPath, [command], {
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
      console.error(`Erro no deepseek helper: ${error.message}`);
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