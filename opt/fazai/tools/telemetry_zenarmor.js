/*
 * FazAI Tool: telemetry_zenarmor (Sensei)
 * Coleta eventos dos logs do Zenarmor/Sensei e envia para /ingest
 */

const fs = require('fs');
const readline = require('readline');
const axios = require('axios');

exports.info = { name: 'telemetry_zenarmor', description: 'Coleta eventos do Zenarmor/Sensei e envia para /ingest', interactive: false };

async function send(server, obj) {
  try { await axios.post(server.replace(/\/$/, '') + '/ingest', obj, { timeout: 5000 }); } catch (_) {}
}

exports.run = async function(params={}){
  const file = params.file || '/var/log/zenarmor/events.log';
  const server = params.server || 'http://127.0.0.1:3120';
  const hostname = params.hostname || require('os').hostname();
  const mode = params.mode || 'scan'; // scan | follow
  if (!fs.existsSync(file)) return { success: false, error: `Arquivo não encontrado: ${file}` };
  const emit = async (line) => {
    try {
      let ev;
      try { ev = JSON.parse(line); } catch { ev = { raw: line }; }
      await send(server, { source: 'zenarmor', hostname, timestamp: new Date().toISOString(), event: ev });
    } catch (_) {}
  };
  if (mode === 'scan') {
    const rl = readline.createInterface({ input: fs.createReadStream(file, { encoding: 'utf8' }) });
    for await (const line of rl) { await emit(line); }
    return { success: true, mode };
  } else {
    const stream = fs.createReadStream(file, { encoding: 'utf8', flags: 'r', start: fs.statSync(file).size });
    const rl = readline.createInterface({ input: stream });
    rl.on('line', (line) => { emit(line); });
    return { success: true, mode: 'follow' };
  }
};

