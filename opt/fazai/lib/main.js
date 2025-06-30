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
const ffi = require('ffi-napi');
const axios = require('axios');
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
    logger.info('Configuração carregada com sucesso');
  } else {
    logger.warn('Arquivo de configuração não encontrado, usando valores padrão');
  }
} catch (err) {
  logger.error('Erro ao carregar configuração:', err);
}

/**
 * Consulta modelo de IA para interpretar comando
 * @param {string} command - Comando a ser interpretado
 * @returns {Promise<object>} - Interpretação do comando
 */
async function queryAI(command) {
  logger.info(`Consultando IA para interpretar: "${command}"`);
  
  try {
    // Determina qual provedor de IA usar
    const provider = process.env.DEFAULT_PROVIDER || config.ai_provider?.provider || 'openai';
    
    logger.info(`Usando provedor: ${provider}`);
    
    let result;
    
    if (provider === 'openrouter') {
      result = await queryOpenRouter(command);
    } else if (provider === 'requesty') {
      result = await queryRequesty(command);
    } else {
      result = await queryOpenAI(command);
    }
    
    logger.info(`Resposta recebida do provedor ${provider}`);
    return result;
  } catch (err) {
    logger.error(`Erro ao consultar IA: ${err.message}`);
    logger.error(`Stack trace: ${err.stack}`);
    
    // Tenta fallback se habilitado
    if (process.env.ENABLE_FALLBACK === 'true' || config.ai_provider?.enable_fallback === 'true') {
      logger.info('Tentando fallback para outro provedor');
      try {
        return await queryOpenAI(command);
      } catch (fallbackErr) {
        logger.error(`Erro no fallback: ${fallbackErr.message}`);
        logger.error(`Stack trace do fallback: ${fallbackErr.stack}`);
      }
    }
    
    // Fallback final para interpretação local
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
    const provider = process.env.DEFAULT_PROVIDER || config.ai_provider?.provider || 'openai';
    const prompt = config.mcps_mode?.system_prompt ||
      'Gere uma lista de comandos shell, um por linha, necessários para executar a tarefa.';

    const messages = [
      { role: 'system', content: prompt },
      { role: 'user', content: command }
    ];

    let response;
    if (provider === 'openrouter') {
      response = await axios.post(`${config.openrouter?.endpoint || 'https://openrouter.ai/api/v1'}/chat/completions`, {
        model: config.openrouter?.default_model || 'openai/gpt-4-turbo',
        messages
      }, { headers: { 'Authorization': `Bearer ${config.openrouter?.api_key}`, 'HTTP-Referer': 'https://github.com/RLuf/FazAI', 'X-Title': 'FazAI', 'Content-Type': 'application/json' } });
    } else if (provider === 'requesty') {
      response = await axios.post(`${config.requesty?.endpoint || 'https://router.requesty.ai/v1'}/chat/completions`, {
        model: config.requesty?.default_model || 'openai/gpt-4o',
        messages
      }, { headers: { 'Authorization': `Bearer ${config.requesty?.api_key}`, 'Content-Type': 'application/json' } });
    } else {
      response = await axios.post(`${config.openai?.endpoint || 'https://api.openai.com/v1'}/chat/completions`, {
        model: config.openai?.default_model || 'gpt-4-turbo',
        messages
      }, { headers: { 'Authorization': `Bearer ${config.openai?.api_key}`, 'Content-Type': 'application/json' } });
    }

    const text = response.data.choices[0].message.content;
    logger.info(`Passos recebidos: ${text}`);
    return text.split('\n').map(l => l.trim()).filter(l => l);
  } catch (err) {
    logger.error(`Erro no MCPS: ${err.message}`);
    throw err;
  }
}

/**
 * Consulta OpenAI para interpretar comando
 * @param {string} command - Comando a ser interpretado
 * @returns {Promise<object>} - Interpretação do comando
 */
async function queryOpenAI(command) {
  const apiKey = config.openai?.api_key || process.env.OPENAI_API_KEY;
  const model = config.openai?.default_model || process.env.OPENAI_MODEL || 'gpt-4-turbo';
  const endpoint = config.openai?.endpoint || process.env.OPENAI_ENDPOINT || 'https://api.openai.com/v1';
  
  if (!apiKey) {
    throw new Error(`Chave de API da OpenAI não configurada, modelo: ${model}`);
  }
  
  logger.info(`Enviando requisição para OpenAI (modelo: ${model})`);
  
  try {
    const response = await axios.post(`${endpoint}/chat/completions`, {
      model: model,
      messages: [
        {
          role: 'system',
          content: 'Você é o FazAI, um assistente para automação de servidores Linux. Interprete o comando e forneça instruções para execução.'
        },
        {
          role: 'user',
          content: command
        }
      ]
    }, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });
    
    logger.info(`Resposta recebida da OpenAI: ${JSON.stringify(response.data.choices[0].message)}`);
    
    return {
      interpretation: response.data.choices[0].message.content,
      success: true
    };
  } catch (err) {
    logger.error(`Erro na requisição para OpenAI: ${err.message}`);
    if (err.response) {
      logger.error(`Detalhes da resposta de erro: ${JSON.stringify(err.response.data)}`);
    }
    throw err;
  }
}

/**
 * Consulta OpenRouter para interpretar comando
 * @param {string} command - Comando a ser interpretado
 * @returns {Promise<object>} - Interpretação do comando
 */
async function queryOpenRouter(command) {
  const apiKey = config.openrouter?.api_key || process.env.OPENROUTER_API_KEY;
  const model = config.openrouter?.default_model || process.env.OPENROUTER_MODEL || 'openai/gpt-4-turbo';
  const endpoint = config.openrouter?.endpoint || process.env.OPENROUTER_ENDPOINT || 'https://openrouter.ai/api/v1';
  
  if (!apiKey) {
    throw new Error('Chave de API do OpenRouter não configurada');
  }
  
  logger.info(`Enviando requisição para OpenRouter (modelo: ${model})`);
  
  try {
    const response = await axios.post(`${endpoint}/chat/completions`, {
      model: model,
      messages: [
        {
          role: 'system',
          content: 'Você é o FazAI, um assistente para automação de servidores Linux. Interprete o comando e forneça instruções para execução.'
        },
        {
          role: 'user',
          content: command
        }
      ]
    }, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': 'https://github.com/RLuf/FazAI',
        'X-Title': 'FazAI',
        'Content-Type': 'application/json'
      }
    });
    
    logger.info(`Resposta recebida do OpenRouter: ${JSON.stringify(response.data.choices[0].message)}`);
    
    return {
      interpretation: response.data.choices[0].message.content,
      success: true
    };
  } catch (err) {
    logger.error(`Erro na requisição para OpenRouter: ${err.message}`);
    if (err.response) {
      logger.error(`Detalhes da resposta de erro: ${JSON.stringify(err.response.data)}`);
    }
    throw err;
  }
}

/**
 * Consulta Requesty para interpretar comando
 * @param {string} command - Comando a ser interpretado
 * @returns {Promise<object>} - Interpretação do comando
 */
async function queryRequesty(command) {
  const apiKey = config.requesty?.api_key || process.env.REQUESTY_API_KEY;
  const model = config.requesty?.default_model || process.env.REQUESTY_MODEL || 'openai/gpt-4o';
  const endpoint = config.requesty?.endpoint || process.env.REQUESTY_ENDPOINT || 'https://router.requesty.ai/v1';
  
  if (!apiKey) {
    throw new Error('Chave de API do Requesty não configurada');
  }
  
  logger.info(`Enviando requisição para Requesty (modelo: ${model})`);
  
  try {
    const response = await axios.post(`${endpoint}/chat/completions`, {
      model: model,
      messages: [
        {
          role: 'system',
          content: 'Você é o FazAI, um assistente para automação de servidores Linux. Interprete o comando e forneça instruções para execução.'
        },
        {
          role: 'user',
          content: command
        }
      ]
    }, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });
    
    logger.info(`Resposta recebida do Requesty: ${JSON.stringify(response.data.choices[0].message)}`);
    
    return {
      interpretation: response.data.choices[0].message.content,
      success: true
    };
  } catch (err) {
    logger.error(`Erro na requisição para Requesty: ${err.message}`);
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
    // Interpreta o comando usando IA
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

      res.json({ command, interpretation: interpretation.interpretation, steps: results, success: true });
    } else {
      // Executa o comando interpretado
      logger.info('Executando comando interpretado');
      const result = await executeCommand(interpretation.interpretation);

      logger.info('Comando executado com sucesso');
      res.json({
        command,
        interpretation: interpretation.interpretation,
        result: result.stdout,
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
    version: '1.40'
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

// Inicialização do servidor
app.listen(PORT, () => {
  logger.info(`Daemon FazAI iniciado na porta ${PORT}`);
  
  // Carrega plugins e módulos na inicialização
  loadTools();
  loadNativeModules();
});

// Tratamento de sinais para encerramento limpo
process.on('SIGTERM', () => {
  logger.info('Sinal SIGTERM recebido, encerrando daemon');
  
  // Limpa módulos nativos
  Object.keys(loadedMods).forEach(modName => {
    try {
      loadedMods[modName].fazai_mod_cleanup();
    } catch (err) {
      logger.error(`Erro ao limpar módulo ${modName}:`, err);
    }
  });
  
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('Sinal SIGINT recebido, encerrando daemon');
  
  // Limpa módulos nativos
  Object.keys(loadedMods).forEach(modName => {
    try {
      loadedMods[modName].fazai_mod_cleanup();
    } catch (err) {
      logger.error(`Erro ao limpar módulo ${modName}:`, err);
    }
  });
  
  process.exit(0);
});

// Tratamento de exceções não capturadas
process.on('uncaughtException', (err) => {
  logger.error('Exceção não capturada:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Rejeição não tratada:', reason);
});
