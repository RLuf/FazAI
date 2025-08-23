#!/usr/bin/env node

/*
 * FazAI - TUI (Node.js + blessed)
 * Mostra header com ASCII art (rosto + logo), status, logs e ações rápidas.
 */

const blessed = require('blessed');
const axios = require('axios');

const API_URL = process.env.FAZAI_API_URL || 'http://localhost:3120';

const ASCII_FACE = `
            ___________
           /           \
          /  _     _    \
         |   o\   /o     |
         |       ^       |
         |     \___/     |
          \   \_____/   /
           \___________/
`;

const ASCII_LOGO = `
  ______          _      _ 
 |  ____|        | |    (_)
 | |__ __ _  __ _| |__   _  ___ 
 |  __/ _` + "`" + `_ \/ _` + "`" + ` | '_ \ | |/ _ \
 | | | (_| | (_| | | | || |  __/
 |_|  \__,_|\__, |_| |_|/ |\___|
             __/ |     | |      
            |___/      |_|      
`;

const CREDIT = 'Roger Luft, Andarilho dos Véus. 2025';

async function fetchJSON(path) {
  const res = await axios.get(`${API_URL}${path}`);
  return res.data;
}

async function main() {
  const screen = blessed.screen({ smartCSR: true, title: 'FazAI TUI' });

  const header = blessed.box({
    top: 0,
    left: 'center',
    width: '100%',
    height: 12,
    tags: true,
    content: `${ASCII_FACE}{center}${ASCII_LOGO}{/center}{center}${CREDIT}{/center}`,
    style: { fg: 'cyan' }
  });

  const statusBox = blessed.box({
    label: ' Status ',
    top: 12,
    left: 0,
    width: '50%',
    height: 6,
    border: { type: 'line' },
    style: { border: { fg: 'blue' } },
    tags: true,
    content: 'Carregando status...'
  });

  const actions = blessed.box({
    label: ' Ações Rápidas ',
    top: 12,
    left: '50%',
    width: '50%',
    height: 6,
    border: { type: 'line' },
    style: { border: { fg: 'blue' } },
    tags: true,
    content: [
      'q: sair   r: recarregar tools   s: status   L: logs   M: métricas',
      'N: net_qos_monitor   A: agentes   P: Qdrant   S: SNMP   I: interativo',
    ].join('\n')
  });

  const logBox = blessed.log({
    label: ' Logs Recentes ',
    top: 18,
    left: 0,
    width: '100%',
    height: '100%-18',
    border: { type: 'line' },
    style: { border: { fg: 'blue' } },
    scrollback: 2000,
    scrollbar: { ch: ' ', inverse: true }
  });

  screen.append(header);
  screen.append(statusBox);
  screen.append(actions);
  screen.append(logBox);

  // Ajuda rápida (fallbacks de IA)
  const helpBox = blessed.box({
    label: ' Ajuda (H) ',
    top: 'center', left: 'center', width: '80%', height: '60%',
    border: { type: 'line' }, style: { border: { fg: 'yellow' } },
    tags: true, hidden: true,
    scrollable: true, keys: true, vi: true, alwaysScroll: true,
    content: [
      '{bold}Gemma é o motor padrão (fixo).{/bold}',
      'Para configurar fallbacks de IA (OpenRouter/OpenAI):',
      '',
      '1) sudo node /opt/fazai/tools/fazai-config.js',
      '   → "Configurar fallback de IA (OpenRouter, OpenAI, etc.)"',
      '',
      '2) Ou edite /etc/fazai/fazai.conf:',
      '   [ai_provider]',
      '   enable_fallback = true',
      '   [openrouter] api_key=... endpoint=https://openrouter.ai/api/v1',
      '   [openai]     api_key=... endpoint=https://api.openai.com/v1',
      '',
      'Depois: sudo systemctl restart fazai',
    ].join('\n')
  });
  screen.append(helpBox);

  async function refreshStatus() {
    try {
      const st = await fetchJSON('/status');
      statusBox.setContent(`{bold}Status:{/bold} ${st.status}\n{bold}Versão:{/bold} ${st.version}\n{bold}Cache:{/bold} ${st.cache.size}/${st.cache.maxSize}`);
    } catch (e) {
      statusBox.setContent(`Erro ao obter status: ${e.message}`);
    }
    screen.render();
  }

  async function loadLogs() {
    try {
      const res = await axios.get(`${API_URL}/logs?lines=50`);
      if (res.data && res.data.logs) {
        logBox.setContent('');
        for (const entry of res.data.logs) {
          const line = typeof entry === 'string' ? entry : `${entry.timestamp || ''} ${entry.level || ''} ${entry.message || ''}`;
          logBox.add(line);
        }
      }
    } catch (e) {
      logBox.add(`Erro ao obter logs: ${e.message}`);
    }
    screen.render();
  }

  // Key bindings
  screen.key(['q', 'C-c'], () => process.exit(0));
  screen.key(['s'], refreshStatus);
  screen.key(['L'], loadLogs);
  screen.key(['h', 'H'], () => {
    helpBox.hidden = !helpBox.hidden;
    screen.render();
  });
  screen.key(['r'], async () => {
    try { await axios.post(`${API_URL}/reload`); logBox.add('Reload OK'); } catch (e) { logBox.add('Reload falhou'); }
    screen.render();
  });
  screen.key(['M'], async () => {
    try { const res = await axios.get(`${API_URL}/metrics`); logBox.setContent(res.data || res); } catch (e) { logBox.add('Erro /metrics'); }
    screen.render();
  });
  screen.key(['N'], async () => {
    logBox.add('Exemplo: tool net_qos_monitor');
    try {
      const body = { command: 'tool:net_qos_monitor param={"cidr":"192.168.0.0/24","sample_seconds":30,"apply_shaping":false}', mcps: false };
      const res = await axios.post(`${API_URL}/command`, body);
      logBox.add(JSON.stringify(res.data));
    } catch (e) { logBox.add('Falha net_qos_monitor'); }
    screen.render();
  });
  screen.key(['A'], async () => {
    logBox.add('Exemplo: tool agent_supervisor');
    screen.render();
  });
  screen.key(['P'], async () => {
    logBox.add('Exemplo: tool qdrant_setup');
    screen.render();
  });
  screen.key(['S'], async () => {
    logBox.add('Exemplo: tool snmp_monitor');
    screen.render();
  });

  // Inicia cliente interativo básico (WS)
  screen.key(['I'], async () => {
    logBox.add('Abrindo sessão interativa WS... Ctrl+C encerra no terminal externo');
    try {
      const WebSocket = require('ws');
      const wsUrl = (process.env.FAZAI_WS_URL || API_URL.replace('http', 'ws')) + '/ws/interactive';
      const ws = new WebSocket(wsUrl);
      ws.on('open', () => logBox.add('WS conectado'));
      ws.on('message', (msg) => {
        try { const m = JSON.parse(msg.toString()); if (m.type === 'stdout') logBox.add(m.data); } catch (_) {}
        screen.render();
      });
      ws.on('close', () => logBox.add('WS fechado'));
      ws.on('error', (e) => logBox.add(`WS erro: ${e.message}`));
    } catch (e) {
      logBox.add('Falha ao abrir WS');
    }
    screen.render();
  });

  await refreshStatus();
  await loadLogs();
  screen.render();
}

// Executar TUI apenas se chamado diretamente
if (require.main === module) {
  main().catch(err => { console.error(err); process.exit(1); });
}

module.exports = {
  main,
  info: {
    name: 'FazAI TUI',
    description: 'Interface TUI para gerenciamento do FazAI',
    interactive: true
  }
};
