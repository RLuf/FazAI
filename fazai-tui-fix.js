#!/usr/bin/env node

/**
 * FazAI - Interface de Configuração TUI (CORRIGIDA)
 * 
 * Correção do problema que estava travando na instalação
 */

const blessed = require('blessed');
const fs = require('fs');
const path = require('path');

// Configurações
const CONFIG_FILE = '/etc/fazai/fazai.conf';
const CONFIG_BACKUP = '/etc/fazai/fazai.conf.bak';

// Função para verificar se está rodando como root
function checkRoot() {
  if (process.getuid && process.getuid() !== 0) {
    console.log('AVISO: Execute como root para modificar configurações do sistema');
    console.log('Modo somente leitura ativado');
    return false;
  }
  return true;
}

const isRoot = checkRoot();

// Inicializa a interface TUI
const screen = blessed.screen({
  smartCSR: true,
  title: 'FazAI - Interface de Configuração'
});

// Cria elementos da interface
const header = blessed.box({
  top: 0,
  left: 'center',
  width: '80%',
  height: 3,
  content: '{center}{bold}FazAI - Interface de Configuração{/bold}{/center}',
  tags: true,
  border: {
    type: 'line'
  },
  style: {
    fg: 'blue',
    border: {
      fg: 'blue'
    }
  }
});

const menu = blessed.list({
  top: 4,
  left: 'center',
  width: '80%',
  height: 10,
  items: [
    '1. Verificar status do sistema',
    '2. Configurar chaves de API', 
    '3. Configurações de sistema',
    '4. Ver logs do serviço',
    '5. Reiniciar serviço FazAI',
    '6. Testar instalação',
    '7. Sair'
  ],
  tags: true,
  border: {
    type: 'line'
  },
  style: {
    fg: 'white',
    border: {
      fg: 'white'
    },
    selected: {
      fg: 'green',
      bold: true
    }
  }
});

const output = blessed.box({
  top: 15,
  left: 'center',
  width: '80%',
  height: 8,
  content: 'Selecione uma opção do menu acima...',
  tags: true,
  border: {
    type: 'line'
  },
  style: {
    fg: 'white',
    border: {
      fg: 'cyan'
    }
  },
  scrollable: true,
  alwaysScroll: true
});

const footer = blessed.box({
  bottom: 0,
  left: 'center',
  width: '80%',
  height: 3,
  content: '{center}Use as setas ↑↓ para navegar e Enter para selecionar • ESC ou Q para sair{/center}',
  tags: true,
  border: {
    type: 'line'
  },
  style: {
    fg: 'blue',
    border: {
      fg: 'blue'
    }
  }
});

// Adiciona os elementos à tela
screen.append(header);
screen.append(menu);
screen.append(output);
screen.append(footer);

// Funções para cada opção do menu
function checkSystemStatus() {
  let status = '{bold}=== STATUS DO SISTEMA ==={/bold}\n\n';
  
  try {
    // Verifica Node.js
    const { execSync } = require('child_process');
    const nodeVersion = execSync('node --version', { encoding: 'utf8' }).trim();
    status += `✓ Node.js: ${nodeVersion}\n`;
    
    // Verifica npm
    const npmVersion = execSync('npm --version', { encoding: 'utf8' }).trim();
    status += `✓ npm: ${npmVersion}\n`;
    
    // Verifica se o FazAI está instalado
    if (fs.existsSync('/opt/fazai/lib/main.js')) {
      status += '✓ FazAI instalado em /opt/fazai\n';
    } else {
      status += '✗ FazAI não encontrado em /opt/fazai\n';
    }
    
    // Verifica serviço systemd
    try {
      const serviceStatus = execSync('systemctl is-active fazai', { encoding: 'utf8' }).trim();
      status += `✓ Serviço FazAI: ${serviceStatus}\n`;
    } catch (e) {
      status += '✗ Serviço FazAI: inativo ou não configurado\n';
    }
    
    // Verifica configuração
    if (fs.existsSync(CONFIG_FILE)) {
      status += '✓ Arquivo de configuração encontrado\n';
    } else {
      status += '✗ Arquivo de configuração não encontrado\n';
    }
    
  } catch (error) {
    status += `✗ Erro ao verificar sistema: ${error.message}\n`;
  }
  
  output.setContent(status);
  screen.render();
}

function configureApiKeys() {
  let content = '{bold}=== CONFIGURAÇÃO DE CHAVES DE API ==={/bold}\n\n';
  
  if (!isRoot) {
    content += '{red}✗ Permissões insuficientes. Execute como root para configurar.{/red}\n';
    output.setContent(content);
    screen.render();
    return;
  }
  
  content += 'APIs suportadas:\n';
  content += '• OpenAI (GPT-3.5/GPT-4)\n';
  content += '• Anthropic (Claude)\n';
  content += '• Google (Gemini)\n';
  content += '• Azure OpenAI\n\n';
  content += 'Para configurar, edite: /etc/fazai/fazai.conf\n';
  content += 'Ou use: fazai config set api.openai.key "sua-chave-aqui"';
  
  output.setContent(content);
  screen.render();
}

function viewLogs() {
  let logs = '{bold}=== LOGS DO SERVIÇO ==={/bold}\n\n';
  
  try {
    const { execSync } = require('child_process');
    const logOutput = execSync('journalctl -u fazai --no-pager -n 20', { encoding: 'utf8' });
    logs += logOutput;
  } catch (error) {
    logs += `Erro ao ler logs: ${error.message}\n`;
    logs += 'Tente: journalctl -u fazai --no-pager -n 20';
  }
  
  output.setContent(logs);
  screen.render();
}

function restartService() {
  let result = '{bold}=== REINICIAR SERVIÇO ==={/bold}\n\n';
  
  if (!isRoot) {
    result += '{red}✗ Permissões insuficientes. Execute como root.{/red}\n';
    output.setContent(result);
    screen.render();
    return;
  }
  
  try {
    const { execSync } = require('child_process');
    result += 'Reiniciando serviço FazAI...\n';
    execSync('systemctl restart fazai');
    result += '✓ Serviço reiniciado com sucesso\n';
    
    // Verifica status
    const status = execSync('systemctl is-active fazai', { encoding: 'utf8' }).trim();
    result += `Status atual: ${status}`;
  } catch (error) {
    result += `✗ Erro ao reiniciar: ${error.message}`;
  }
  
  output.setContent(result);
  screen.render();
}

function testInstallation() {
  let test = '{bold}=== TESTE DE INSTALAÇÃO ==={/bold}\n\n';
  
  try {
    const { execSync } = require('child_process');
    
    test += 'Testando CLI...\n';
    try {
      const cliOutput = execSync('/usr/local/bin/fazai --version', { encoding: 'utf8' });
      test += `✓ CLI funcionando: ${cliOutput.trim()}\n`;
    } catch (e) {
      test += '✗ CLI não responde\n';
    }
    
    test += '\nTestando módulos Node.js...\n';
    const modules = ['axios', 'express', 'winston', 'blessed'];
    modules.forEach(mod => {
      try {
        require.resolve(mod);
        test += `✓ ${mod}\n`;
      } catch (e) {
        test += `✗ ${mod} - não encontrado\n`;
      }
    });
    
  } catch (error) {
    test += `Erro durante teste: ${error.message}`;
  }
  
  output.setContent(test);
  screen.render();
}

// Define ações para o menu
menu.on('select', (item, index) => {
  switch (index) {
    case 0:
      checkSystemStatus();
      break;
    case 1:
      configureApiKeys();
      break;
    case 2:
      output.setContent('{bold}=== CONFIGURAÇÕES DE SISTEMA ==={/bold}\n\nEm desenvolvimento...\nPor enquanto, edite manualmente: /etc/fazai/fazai.conf');
      screen.render();
      break;
    case 3:
      viewLogs();
      break;
    case 4:
      restartService();
      break;
    case 5:
      testInstallation();
      break;
    case 6:
      // Sair
      screen.destroy();
      process.exit(0);
      break;
  }
});

// Atalhos de teclado
screen.key(['escape', 'q', 'C-c'], () => {
  screen.destroy();
  process.exit(0);
});

// Foca no menu
menu.focus();

// Renderiza a interface
screen.render();

// Mostra status inicial
checkSystemStatus();