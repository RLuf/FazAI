#!/usr/bin/env node

/**
 * FazAI - Orquestrador Inteligente de Automação
 * 
 * main.js - Daemon principal responsável por receber comandos,
 * interpretar, orquestrar execuções, interagir com modelos de IA,
 * gerenciar logs e coordenar plugins/mods.
 */

const express = require('express');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

// Configurações
const PORT = process.env.FAZAI_PORT || 3000;
const LOG_FILE = '/var/log/fazai/fazai.log';
const TOOLS_DIR = path.join(__dirname, 'tools');

// Inicialização do Express
const app = express();
app.use(express.json());

// Sistema de Logs
const logMessage = (level, message) => {
  const timestamp = new Date().toISOString();
  const logEntry = `[${timestamp}] [${level}] ${message}\n`;
  
  // Em ambiente de desenvolvimento, podemos usar console.log
  console.log(logEntry.trim());
  
  // Em produção, escrevemos no arquivo de log
  try {
    fs.appendFileSync(LOG_FILE, logEntry);
  } catch (error) {
    console.error(`Erro ao escrever no log: ${error.message}`);
  }
};

// Carregamento dinâmico de plugins
const loadPlugins = () => {
  const plugins = {};
  
  try {
    const files = fs.readdirSync(TOOLS_DIR);
    
    files.forEach(file => {
      if (file.endsWith('.js')) {
        try {
          const pluginPath = path.join(TOOLS_DIR, file);
          const plugin = require(pluginPath);
          const pluginName = file.replace('.js', '');
          
          if (typeof plugin.execute === 'function') {
            plugins[pluginName] = plugin;
            logMessage('INFO', `Plugin carregado: ${pluginName}`);
          } else {
            logMessage('WARN', `Plugin inválido (sem método execute): ${pluginName}`);
          }
        } catch (error) {
          logMessage('ERROR', `Erro ao carregar plugin ${file}: ${error.message}`);
        }
      }
    });
  } catch (error) {
    logMessage('ERROR', `Erro ao ler diretório de plugins: ${error.message}`);
  }
  
  return plugins;
};

// Carregamento de módulos nativos (C)
// Será implementado posteriormente usando ffi-napi ou node-ffi

// Processamento de comandos
const processCommand = async (command) => {
  logMessage('INFO', `Processando comando: ${command}`);
  
  try {
    // Pré-processamento do comando
    const tokens = command.split(' ');
    const action = tokens[0].toLowerCase();
    
    // Verificar se é uma pergunta
    if (command.endsWith('?')) {
      return await handleQuestion(command);
    }
    
    // Verificar se é um comando para um plugin específico
    const plugins = loadPlugins();
    for (const [pluginName, plugin] of Object.entries(plugins)) {
      if (action === pluginName || command.includes(`${pluginName} `)) {
        logMessage('INFO', `Executando plugin: ${pluginName}`);
        return await plugin.execute(command);
      }
    }
    
    // Processamento baseado em IA para comandos não reconhecidos
    return await processWithAI(command);
    
  } catch (error) {
    logMessage('ERROR', `Erro ao processar comando: ${error.message}`);
    return {
      success: false,
      message: `Erro ao processar comando: ${error.message}`,
      error: error.toString()
    };
  }
};

// Processamento de perguntas
const handleQuestion = async (question) => {
  logMessage('INFO', `Processando pergunta: ${question}`);
  
  // Aqui implementaremos a consulta ao modelo de IA
  // Por enquanto, retornamos uma resposta simples
  return {
    success: true,
    message: `Processando sua pergunta: "${question}"`,
    answer: "Esta funcionalidade será implementada em breve."
  };
};

// Processamento com IA
const processWithAI = async (command) => {
  logMessage('INFO', `Processando com IA: ${command}`);
  
  // Aqui implementaremos a integração com OpenAI ou outro modelo
  // Por enquanto, tentamos executar como comando shell
  try {
    const { stdout, stderr } = await execPromise(command);
    return {
      success: true,
      message: `Comando executado: ${command}`,
      stdout,
      stderr
    };
  } catch (error) {
    return {
      success: false,
      message: `Não foi possível executar o comando: ${command}`,
      error: error.toString()
    };
  }
};

// Rotas da API
app.post('/api/command', async (req, res) => {
  const { command } = req.body;
  
  if (!command) {
    return res.status(400).json({
      success: false,
      message: 'Comando não fornecido'
    });
  }
  
  logMessage('INFO', `Recebido comando via API: ${command}`);
  
  try {
    const result = await processCommand(command);
    res.json(result);
  } catch (error) {
    logMessage('ERROR', `Erro ao processar comando via API: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Erro interno ao processar comando',
      error: error.toString()
    });
  }
});

// Rota de status
app.get('/api/status', (req, res) => {
  res.json({
    status: 'online',
    version: '0.1.0',
    uptime: process.uptime()
  });
});

// Inicialização do servidor
app.listen(PORT, () => {
  logMessage('INFO', `FazAI daemon iniciado na porta ${PORT}`);
});

// Tratamento de sinais para encerramento gracioso
process.on('SIGTERM', () => {
  logMessage('INFO', 'Recebido sinal SIGTERM, encerrando...');
  process.exit(0);
});

process.on('SIGINT', () => {
  logMessage('INFO', 'Recebido sinal SIGINT, encerrando...');
  process.exit(0);
});

logMessage('INFO', 'FazAI daemon inicializado');
