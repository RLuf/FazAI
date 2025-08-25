#!/usr/bin/env node

/*
 * FazAI - Ferramenta de Configuração
 * Versão: 1.42.1
 * Autor: Roger Luft
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const CONFIG_FILE = '/etc/fazai/fazai.conf';
const CONFIG_EXAMPLE = '/etc/fazai/fazai.conf.example';

// Cores para output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSuccess(message) {
  log(`✅ ${message}`, 'green');
}

function logError(message) {
  log(`❌ ${message}`, 'red');
}

function logInfo(message) {
  log(`ℹ️  ${message}`, 'blue');
}

function logWarning(message) {
  log(`⚠️  ${message}`, 'yellow');
}

// Interface de linha de comando
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

// Função para ler arquivo de configuração
function readConfig() {
  try {
    if (!fs.existsSync(CONFIG_FILE)) {
      if (fs.existsSync(CONFIG_EXAMPLE)) {
        fs.copyFileSync(CONFIG_EXAMPLE, CONFIG_FILE);
        logInfo('Arquivo de configuração criado a partir do exemplo');
      } else {
        throw new Error('Arquivo de exemplo não encontrado');
      }
    }
    
    const content = fs.readFileSync(CONFIG_FILE, 'utf8');
    return parseConfig(content);
  } catch (error) {
    logError(`Erro ao ler configuração: ${error.message}`);
    process.exit(1);
  }
}

// Função para parsear arquivo de configuração
function parseConfig(content) {
  const config = {};
  let currentSection = null;
  
  const lines = content.split('\n');
  
  for (const line of lines) {
    const trimmedLine = line.trim();
    
    // Pula linhas vazias e comentários
    if (!trimmedLine || trimmedLine.startsWith('#')) {
      continue;
    }
    
    // Seção
    if (trimmedLine.startsWith('[') && trimmedLine.endsWith(']')) {
      currentSection = trimmedLine.slice(1, -1);
      config[currentSection] = {};
      continue;
    }
    
    // Chave = valor
    if (currentSection && trimmedLine.includes('=')) {
      const [key, ...valueParts] = trimmedLine.split('=');
      const value = valueParts.join('=').trim();
      
      // Remove aspas se existirem
      const cleanValue = value.replace(/^["']|["']$/g, '');
      config[currentSection][key.trim()] = cleanValue;
    }
  }
  
  return config;
}

// Função para salvar configuração
function saveConfig(config) {
  try {
    let content = `###############################################################################
# FazAI - Arquivo de Configuração Principal
# Versão: 1.42.1
# Gerado automaticamente em: ${new Date().toISOString()}
###############################################################################

`;

    for (const [section, values] of Object.entries(config)) {
      content += `[${section}]\n`;
      
      for (const [key, value] of Object.entries(values)) {
        content += `${key} = ${value}\n`;
      }
      
      content += '\n';
    }
    
    fs.writeFileSync(CONFIG_FILE, content);
    logSuccess('Configuração salva com sucesso');
  } catch (error) {
    logError(`Erro ao salvar configuração: ${error.message}`);
    process.exit(1);
  }
}

// Função para configurar provedor de IA
async function configureAIProvider() {
  logInfo('Configuração de Provedor de IA');
  log('Provedores disponíveis:');
  log('1. OpenRouter (recomendado)');
  log('2. OpenAI');
  log('3. Requesty');
  log('4. Anthropic (Claude)');
  log('5. Google Gemini');
  log('6. Ollama (local)');
  
  const choice = await question('\nEscolha o provedor (1-6): ');
  
  const providers = {
    '1': 'openrouter',
    '2': 'openai',
    '3': 'requesty',
    '4': 'anthropic',
    '5': 'gemini',
    '6': 'ollama'
  };
  
  const provider = providers[choice];
  if (!provider) {
    logError('Opção inválida');
    return;
  }
  
  const apiKey = await question(`Digite sua chave de API para ${provider}: `);
  
  return { provider, apiKey };
}

// Função para mostrar status da configuração
function showConfigStatus(config) {
  logInfo('Status da Configuração Atual');
  log('─'.repeat(50));
  
  // Gemma é o motor padrão fixo
  log(`Motor padrão (fixo): gemma_cpp`);
  const aiProvider = config.ai_provider?.provider || 'gemma_cpp (fixo)';
  
  const providers = ['openrouter', 'openai', 'requesty', 'anthropic', 'gemini', 'ollama'];
  
  for (const provider of providers) {
    const section = config[provider];
    if (section && section.api_key && section.api_key !== 'sua_chave_openrouter_aqui') {
      log(`✅ ${provider}: configurado`, 'green');
    } else {
      log(`❌ ${provider}: não configurado`, 'red');
    }
  }
  
  log('─'.repeat(50));
}

// Função para testar conectividade
async function testConnectivity(config) {
  logInfo('Testando conectividade com provedores de fallback...');
  
  const axios = require('axios');
  const providers = ['openrouter', 'openai', 'requesty', 'anthropic', 'gemini'];
  
  for (const provider of providers) {
    const section = config[provider];
    if (!section || !section.api_key || section.api_key === 'sua_chave_openrouter_aqui') {
      continue;
    }
    
    try {
      log(`Testando ${provider}...`);
      
      const headers = {
        'Authorization': `Bearer ${section.api_key}`,
        'Content-Type': 'application/json'
      };
      
      const payload = {
        model: section.default_model || 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: 'test' }],
        max_tokens: 10
      };
      
      const response = await axios.post(
        `${section.endpoint}/chat/completions`,
        payload,
        { headers, timeout: 10000 }
      );
      
      if (response.status === 200) {
        log(`✅ ${provider}: conectividade OK`, 'green');
      } else {
        log(`⚠️  ${provider}: resposta inesperada`, 'yellow');
      }
    } catch (error) {
      log(`❌ ${provider}: ${error.message}`, 'red');
    }
  }
}

// Função principal
async function main() {
  log('FazAI - Ferramenta de Configuração v1.42.1', 'bright');
  log('─'.repeat(50));
  
  const config = readConfig();
  
  while (true) {
    log('\nOpções disponíveis:');
    log('1. Mostrar status da configuração');
    log('2. Configurar fallback de IA (OpenRouter, OpenAI, etc.)');
    log('3. Testar conectividade');
    log('4. Editar configuração manualmente');
    log('5. Restaurar configuração padrão');
    log('6. Sair');
    
    const choice = await question('\nEscolha uma opção (1-6): ');
    
    switch (choice) {
      case '1':
        showConfigStatus(config);
        break;
        
      case '2':
        const aiConfig = await configureAIProvider();
        if (aiConfig) {
          // Gemma é o motor padrão; aqui apenas habilitamos provedores de fallback
          config.ai_provider = config.ai_provider || {};
          if (typeof config.ai_provider.enable_fallback === 'undefined') {
            config.ai_provider.enable_fallback = true;
          }
          // Armazena a chave no bloco do provedor escolhido
          config[aiConfig.provider] = config[aiConfig.provider] || {};
          config[aiConfig.provider].api_key = aiConfig.apiKey;
          saveConfig(config);
        }
        break;
        
      case '3':
        await testConnectivity(config);
        break;
        
      case '4':
        logInfo('Editando configuração manualmente...');
        const editor = process.env.EDITOR || 'nano';
        require('child_process').spawn(editor, [CONFIG_FILE], { stdio: 'inherit' });
        break;
        
      case '5':
        const confirm = await question('Tem certeza? Isso irá sobrescrever a configuração atual (s/N): ');
        if (confirm.toLowerCase() === 's') {
          if (fs.existsSync(CONFIG_EXAMPLE)) {
            fs.copyFileSync(CONFIG_EXAMPLE, CONFIG_FILE);
            logSuccess('Configuração restaurada para padrão');
          } else {
            logError('Arquivo de exemplo não encontrado');
          }
        }
        break;
        
      case '6':
        logInfo('Saindo...');
        rl.close();
        process.exit(0);
        break;
        
      default:
        logError('Opção inválida');
    }
  }
}

// Tratamento de erros
process.on('uncaughtException', (error) => {
  logError(`Erro não tratado: ${error.message}`);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logError(`Promise rejeitada: ${reason}`);
  process.exit(1);
});

// Executar se chamado diretamente
if (require.main === module) {
  main().catch((error) => {
    logError(`Erro na execução: ${error.message}`);
    process.exit(1);
  });
}

module.exports = {
  readConfig,
  saveConfig,
  parseConfig,
  showConfigStatus,
  testConnectivity
};
