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
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  defaultMeta: { service: 'fazai-daemon' },
  transports: [
    new winston.transports.File({ filename: '/var/log/fazai.log' }),
    new winston.transports.Console()
  ]
});

// Configuração do servidor Express
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware para processar JSON
app.use(express.json());

// Diretório de plugins e módulos
const TOOLS_DIR = '/etc/fazai/tools';
const MODS_DIR = '/etc/fazai/mods';

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

/**
 * Consulta modelo de IA para interpretar comando
 * @param {string} command - Comando a ser interpretado
 * @returns {Promise<object>} - Interpretação do comando
 */
async function queryAI(command) {
  logger.info(`Consultando IA para interpretar: "${command}"`);
  
  try {
    // Aqui seria a integração com a API da OpenAI ou outro modelo
    // Este é um exemplo simplificado
    const response = await axios.post('https://api.openai.com/v1/chat/completions', {
      model: 'gpt-4',
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
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });
    
    return {
      interpretation: response.data.choices[0].message.content,
      success: true
    };
  } catch (err) {
    logger.error('Erro ao consultar IA:', err);
    
    // Fallback para modelo secundário ou interpretação local
    return {
      interpretation: 'Não foi possível interpretar o comando via IA. Executando fallback.',
      success: false
    };
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
  const { command } = req.body;
  
  if (!command) {
    return res.status(400).json({ error: 'Comando não fornecido' });
  }
  
  logger.info(`Comando recebido: ${command}`);
  
  try {
    // Interpreta o comando usando IA
    const interpretation = await queryAI(command);
    
    // Executa o comando interpretado
    // Aqui seria implementada a lógica para decidir como executar
    // baseado na interpretação da IA
    const result = await executeCommand(interpretation.interpretation);
    
    res.json({
      command,
      interpretation: interpretation.interpretation,
      result: result.stdout,
      success: true
    });
  } catch (err) {
    logger.error('Erro ao processar comando:', err);
    
    res.status(500).json({
      command,
      error: err.message,
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
