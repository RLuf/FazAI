/*
 * FazAI Tool: telemetry_suricata
 * Lê eventos do Suricata (eve.json) e envia para /ingest do FazAI
 */

const fs = require('fs');
const readline = require('readline');
const axios = require('axios');

exports.info = { name: 'telemetry_suricata', description: 'Coleta eventos do Suricata (eve.json) e envia para /ingest', interactive: false };

async function send(server, obj) {
  try { await axios.post(server.replace(/\/$/, '') + '/ingest', obj, { timeout: 5000 }); } catch (_) {}
}

exports.run = async function(params={}){
  const file = params.file || '/var/log/suricata/eve.json';
  const server = params.server || 'http://127.0.0.1:3120';
  const hostname = params.hostname || require('os').hostname();
  const mode = params.mode || 'scan'; // scan | follow
  if (!fs.existsSync(file)) return { success: false, error: `Arquivo não encontrado: ${file}` };
  if (mode === 'scan') {
    const rl = readline.createInterface({ input: fs.createReadStream(file, { encoding: 'utf8' }) });
    for await (const line of rl) {
      try {
        const ev = JSON.parse(line);
        if (ev.alert) {
          await send(server, { source: 'suricata', hostname, timestamp: new Date().toISOString(), event: { alert: ev.alert, src_ip: ev.src_ip, dest_ip: ev.dest_ip, proto: ev.proto } });
        }
      } catch (_) {}
    }
    return { success: true, mode };
  } else {
    // follow: lê crescimento do arquivo
    const stream = fs.createReadStream(file, { encoding: 'utf8', flags: 'r', start: fs.statSync(file).size });
    const rl = readline.createInterface({ input: stream });
    rl.on('line', async (line) => {
      try {
        const ev = JSON.parse(line);
        if (ev.alert) {
          await send(server, { source: 'suricata', hostname, timestamp: new Date().toISOString(), event: { alert: ev.alert, src_ip: ev.src_ip, dest_ip: ev.dest_ip, proto: ev.proto } });
        }
      } catch (_) {}
    });
    return { success: true, mode: 'follow' };
  }
};

