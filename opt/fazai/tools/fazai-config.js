#!/usr/bin/env node

/**
 * FazAI - Interface de Configuração TUI
 * Este script fornece uma interface de texto para configurar o FazAI
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { spawn } = require('child_process');
const os = require('os');

// Configurações padrão
const CONFIG_FILE = '/etc/fazai/fazai.conf';
const CONFIG_TEMPLATE = '/etc/fazai/fazai.conf.default';
const ENV_FILE = '/etc/fazai/env';
const LOG_DIR = '/var/log/fazai';

// Cores para output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  underscore: '\x1b[4m',
  blink: '\x1b[5m',
  reverse: '\x1b[7m',
  hidden: '\x1b[8m',
  
  black: '\x1b[30m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  
  bgBlack: '\x1b[40m',
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m',
  bgBlue: '\x1b[44m',
  bgMagenta: '\x1b[45m',
  bgCyan: '\x1b[46m',
  bgWhite: '\x1b[47m'
};

// Cria interface de readline
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Função para limpar a tela
function clearScreen() {
  process.stdout.write('\x1Bc');
}

// Função para mostrar banner
function showBanner() {
  console.log(`${colors.blue}======================================================${colors.reset}`);
  console.log(`${colors.blue}${colors.bright}               FazAI - Configuração                 ${colors.reset}`);
  console.log(`${colors.blue}======================================================${colors.reset}`);
  console.log('');
}

// Função para perguntar com cor
function colorPrompt(question, defaultValue = '') {
  return new Promise((resolve) => {
    const defaultStr = defaultValue ? ` (${defaultValue})` : '';
    rl.question(`${colors.green}${question}${defaultStr}: ${colors.reset}`, (answer) => {
      resolve(answer || defaultValue);
    });
  });
}

// Função para mostrar menu
function showMenu() {
  clearScreen();
  showBanner();
  console.log(`${colors.yellow}Menu Principal:${colors.reset}`);
  console.log('');
  console.log(`${colors.cyan}1.${colors.reset} Configurar Chaves de API`);
  console.log(`${colors.cyan}2.${colors.reset} Configurar Diretórios`);
  console.log(`${colors.cyan}3.${colors.reset} Configurar Recursos do Sistema`);
  console.log(`${colors.cyan}4.${colors.reset} Visualizar Configuração Atual`);
  console.log(`${colors.cyan}5.${colors.reset} Verificar Status do Serviço`);
  console.log(`${colors.cyan}6.${colors.reset} Aplicar Configurações e Reiniciar Serviço`);
  console.log(`${colors.cyan}0.${colors.reset} Sair`);
  console.log('');
  return colorPrompt('Escolha uma opção');
}

// Função para carregar configuração
function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const configData = fs.readFileSync(CONFIG_FILE, 'utf8');
      return parseConfigFile(configData);
    } else if (fs.existsSync(CONFIG_TEMPLATE)) {
      console.log(`${colors.yellow}Arquivo de configuração não encontrado. Usando template...${colors.reset}`);
      const configData = fs.readFileSync(CONFIG_TEMPLATE, 'utf8');
      return parseConfigFile(configData);
    } else {
      console.log(`${colors.red}Nenhum arquivo de configuração encontrado. Criando configuração padrão...${colors.reset}`);
      return {
        general: {
          log_level: 'info',
          data_dir: '/var/lib/fazai/data',
          cache_dir: '/var/lib/fazai/cache',
        },
        apis: {
          openai_api_key: '',
          anthropic_api_key: '',
          google_api_key: '',
        },
        system: {
          max_memory: '512M',
          threads: '4',
          port: '3210',
          host: 'localhost',
        }
      };
    }
  } catch (error) {
    console.error(`${colors.red}Erro ao carregar configuração:${colors.reset}`, error.message);
    process.exit(1);
  }
}

// Função para analisar arquivo de configuração
function parseConfigFile(configData) {
  const config = {
    general: {},
    apis: {},
    system: {}
  };
  
  let currentSection = '';
  const lines = configData.split('\n');
  
  for (const line of lines) {
    const trimmedLine = line.trim();
    
    // Ignora linhas vazias e comentários
    if (!trimmedLine || trimmedLine.startsWith('#') || trimmedLine.startsWith(';')) {
      continue;
    }
    
    // Verifica se é uma seção
    if (trimmedLine.startsWith('[') && trimmedLine.endsWith(']')) {
      currentSection = trimmedLine.slice(1, -1).toLowerCase();
      continue;
    }
    
    // Se estamos em uma seção válida e a linha contém um '='
    if (currentSection && trimmedLine.includes('=')) {
      const [key, value] = trimmedLine.split('=').map(part => part.trim());
      
      if (!config[currentSection]) {
        config[currentSection] = {};
      }
      
      config[currentSection][key] = value;
    }
  }
  
  return config;
}

// Função para salvar configuração
function saveConfig(config) {
  try {
    let configStr = '';
    
    // Função para adicionar seção
    const addSection = (section, data) => {
      configStr += `[${section}]\n`;
      for (const [key, value] of Object.entries(data)) {
        configStr += `${key} = ${value}\n`;
      }
      configStr += '\n';
    };
    
    // Adiciona seções de configuração
    for (const [section, data] of Object.entries(config)) {
      if (Object.keys(data).length > 0) {
        addSection(section, data);
      }
    }
    
    // Garante que o diretório existe
    const configDir = path.dirname(CONFIG_FILE);
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }
    
    // Escreve o arquivo
    fs.writeFileSync(CONFIG_FILE, configStr);
    console.log(`${colors.green}Configuração salva com sucesso em ${CONFIG_FILE}${colors.reset}`);
    
    // Também salva variáveis de ambiente
    let envStr = '';
    if (config.apis && config.apis.openai_api_key) {
      envStr += `OPENAI_API_KEY=${config.apis.openai_api_key}\n`;
    }
    if (config.apis && config.apis.anthropic_api_key) {
      envStr += `ANTHROPIC_API_KEY=${config.apis.anthropic_api_key}\n`;
    }
    
    fs.writeFileSync(ENV_FILE, envStr);
    console.log(`${colors.green}Variáveis de ambiente salvas em ${ENV_FILE}${colors.reset}`);
    
    return true;
  } catch (error) {
    console.error(`${colors.red}Erro ao salvar configuração:${colors.reset}`, error.message);
    return false;
  }
}

// Função para configurar chaves de API
async function configureApiKeys(config) {
  clearScreen();
  showBanner();
  console.log(`${colors.yellow}Configuração de Chaves de API:${colors.reset}`);
  console.log('');
  
  if (!config.apis) {
    config.apis = {};
  }
  
  config.apis.openai_api_key = await colorPrompt('Chave da API OpenAI', config.apis.openai_api_key || '');
  config.apis.anthropic_api_key = await colorPrompt('Chave da API Anthropic', config.apis.anthropic_api_key || '');
  config.apis.google_api_key = await colorPrompt('Chave da API Google', config.apis.google_api_key || '');
  
  console.log('');
  console.log(`${colors.green}Chaves de API configuradas!${colors.reset}`);
  await new Promise(resolve => setTimeout(resolve, 1500));
  return config;
}

// Função para configurar diretórios
async function configureDirectories(config) {
  clearScreen();
  showBanner();
  console.log(`${colors.yellow}Configuração de Diretórios:${colors.reset}`);
  console.log('');
  
  if (!config.general) {
    config.general = {};
  }
  
  config.general.data_dir = await colorPrompt('Diretório de dados', config.general.data_dir || '/var/lib/fazai/data');
  config.general.cache_dir = await colorPrompt('Diretório de cache', config.general.cache_dir || '/var/lib/fazai/cache');
  config.general.log_dir = await colorPrompt('Diretório de logs', config.general.log_dir || '/var/log/fazai');
  
  console.log('');
  console.log(`${colors.green}Diretórios configurados!${colors.reset}`);
  await new Promise(resolve => setTimeout(resolve, 1500));
  return config;
}

// Função para configurar recursos do sistema
async function configureSystemResources(config) {
  clearScreen();
  showBanner();
  console.log(`${colors.yellow}Configuração de Recursos do Sistema:${colors.reset}`);
  console.log('');
  
  if (!config.system) {
    config.system = {};
  }
  
  const cpuCount = os.cpus().length;
  const totalMemory = Math.floor(os.totalmem() / (1024 * 1024));
  
  console.log(`${colors.cyan}Informações do Sistema:${colors.reset}`);
  console.log(`- CPUs disponíveis: ${cpuCount}`);
  console.log(`- Memória total: ${totalMemory}MB`);
  console.log('');
  
  config.system.threads = await colorPrompt('Número de threads a utilizar', config.system.threads || Math.max(1, cpuCount - 1).toString());
  config.system.max_memory = await colorPrompt('Limite de memória (ex: 512M, 1G)', config.system.max_memory || '512M');
  config.system.port = await colorPrompt('Porta HTTP', config.system.port || '3000');
  config.system.host = await colorPrompt('Host HTTP', config.system.host || 'localhost');
  
  console.log('');
  console.log(`${colors.green}Recursos do sistema configurados!${colors.reset}`);
  await new Promise(resolve => setTimeout(resolve, 1500));
  return config;
}

// Função para mostrar configuração atual
async function viewCurrentConfig(config) {
  clearScreen();
  showBanner();
  console.log(`${colors.yellow}Configuração Atual:${colors.reset}`);
  console.log('');
  
  // Mostra configuração geral
  console.log(`${colors.cyan}[general]${colors.reset}`);
  for (const [key, value] of Object.entries(config.general || {})) {
    console.log(`${key} = ${value}`);
  }
  console.log('');
  
  // Mostra configuração de APIs
  console.log(`${colors.cyan}[apis]${colors.reset}`);
  for (const [key, value] of Object.entries(config.apis || {})) {
    // Mascara as chaves de API para segurança
    const maskedValue = key.includes('api_key') && value 
      ? value.substring(0, 4) + '...' + value.substring(value.length - 4) 
      : value;
    console.log(`${key} = ${maskedValue}`);
  }
  console.log('');
  
  // Mostra configuração do sistema
  console.log(`${colors.cyan}[system]${colors.reset}`);
  for (const [key, value] of Object.entries(config.system || {})) {
    console.log(`${key} = ${value}`);
  }
  console.log('');
  
  await colorPrompt('Pressione ENTER para voltar ao menu');
  return config;
}

// Função para verificar status do serviço
async function checkServiceStatus() {
  clearScreen();
  showBanner();
  console.log(`${colors.yellow}Status do Serviço FazAI:${colors.reset}`);
  console.log('');
  
  try {
    const statusProcess = spawn('systemctl', ['status', 'fazai']);
    
    statusProcess.stdout.on('data', (data) => {
      process.stdout.write(data.toString());
    });
    
    statusProcess.stderr.on('data', (data) => {
      process.stderr.write(colors.red + data.toString() + colors.reset);
    });
    
    await new Promise((resolve) => {
      statusProcess.on('close', (code) => {
        console.log('');
        console.log(`${colors.cyan}Logs Recentes:${colors.reset}`);
        
        const journalProcess = spawn('journalctl', ['-u', 'fazai', '-n', '10']);
        
        journalProcess.stdout.on('data', (data) => {
          process.stdout.write(data.toString());
        });
        
        journalProcess.on('close', (code) => {
          resolve();
        });
      });
    });
  } catch (error) {
    console.error(`${colors.red}Erro ao verificar status:${colors.reset}`, error.message);
  }
  
  console.log('');
  await colorPrompt('Pressione ENTER para voltar ao menu');
}

// Função para aplicar configurações e reiniciar serviço
async function applyConfigAndRestart(config) {
  clearScreen();
  showBanner();
  console.log(`${colors.yellow}Aplicando Configurações e Reiniciando Serviço:${colors.reset}`);
  console.log('');
  
  // Salva a configuração
  if (!saveConfig(config)) {
    console.log(`${colors.red}Falha ao salvar configuração. Reinicialização abortada.${colors.reset}`);
    await colorPrompt('Pressione ENTER para voltar ao menu');
    return;
  }
  
  console.log(`${colors.green}Configuração salva com sucesso!${colors.reset}`);
  
  // Cria diretórios necessários
  try {
    if (config.general) {
      const dirs = [
        config.general.data_dir,
        config.general.cache_dir,
        config.general.log_dir || LOG_DIR
      ];
      
      for (const dir of dirs) {
        if (dir && !fs.existsSync(dir)) {
          console.log(`Criando diretório: ${dir}`);
          fs.mkdirSync(dir, { recursive: true });
        }
      }
    }
  } catch (error) {
    console.error(`${colors.red}Erro ao criar diretórios:${colors.reset}`, error.message);
  }
  
  // Reinicia o serviço
  console.log(`${colors.cyan}Reiniciando serviço FazAI...${colors.reset}`);
  
  try {
    const restartProcess = spawn('systemctl', ['restart', 'fazai']);
    
    await new Promise((resolve) => {
      restartProcess.on('close', (code) => {
        if (code === 0) {
          console.log(`${colors.green}Serviço reiniciado com sucesso!${colors.reset}`);
        } else {
          console.log(`${colors.red}Falha ao reiniciar serviço (código de saída: ${code})${colors.reset}`);
        }
        resolve();
      });
    });
    
    // Verifica status após reiniciar
    console.log(`${colors.cyan}Verificando status do serviço...${colors.reset}`);
    
    const statusProcess = spawn('systemctl', ['is-active', 'fazai']);
    let isActive = false;
    
    statusProcess.stdout.on('data', (data) => {
      const status = data.toString().trim();
      isActive = status === 'active';
      console.log(`Status do serviço: ${isActive ? colors.green + 'ativo' + colors.reset : colors.red + 'inativo' + colors.reset}`);
    });
    
    await new Promise((resolve) => {
      statusProcess.on('close', resolve);
    });
    
    if (!isActive) {
      console.log(`${colors.red}O serviço não está ativo após a reinicialização. Verificando logs...${colors.reset}`);
      
      const journalProcess = spawn('journalctl', ['-u', 'fazai', '-n', '20']);
      
      journalProcess.stdout.on('data', (data) => {
        process.stdout.write(data.toString());
      });
      
      await new Promise((resolve) => {
        journalProcess.on('close', resolve);
      });
    }
  } catch (error) {
    console.error(`${colors.red}Erro ao reiniciar serviço:${colors.reset}`, error.message);
  }
  
  console.log('');
  await colorPrompt('Pressione ENTER para voltar ao menu');
}

// Função principal
async function main() {
  let config = loadConfig();
  let running = true;
  
  while (running) {
    const option = await showMenu();
    
    switch (option) {
      case '1':
        config = await configureApiKeys(config);
        break;
      case '2':
        config = await configureDirectories(config);
        break;
      case '3':
        config = await configureSystemResources(config);
        break;
      case '4':
        await viewCurrentConfig(config);
        break;
      case '5':
        await checkServiceStatus();
        break;
      case '6':
        await applyConfigAndRestart(config);
        break;
      case '0':
        running = false;
        break;
      default:
        console.log(`${colors.red}Opção inválida!${colors.reset}`);
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  clearScreen();
  showBanner();
  console.log(`${colors.green}Obrigado por usar o FazAI Configurator!${colors.reset}`);
  rl.close();
}

// Verifica se é executado como root
if (process.getuid && process.getuid() !== 0) {
  console.error(`${colors.red}Este script precisa ser executado como root (sudo).${colors.reset}`);
  process.exit(1);
}

// Inicia a aplicação
main().catch((error) => {
  console.error(`${colors.red}Erro na aplicação:${colors.reset}`, error);
  process.exit(1);
});
