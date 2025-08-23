/*
 * FazAI Tool: grafana_provision
 * Cria datasource Prometheus e importa dashboards gerados por grafana_dashboards.js
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');

exports.info = { name: 'grafana_provision', description: 'Provisiona Grafana: datasource Prometheus + dashboards FazAI', interactive: false };

async function ensureDatasource({ base, user, pass, token, promUrl }) {
  const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
  const auth = token ? undefined : { username: user||'admin', password: pass||'admin' };
  const ds = {
    name: 'Prometheus', type: 'prometheus', access: 'proxy', url: promUrl || 'http://localhost:9090', basicAuth: false, isDefault: true
  };
  // Try to create or update
  try {
    // Find existing
    const list = await axios.get(`${base}/api/datasources`, { headers, auth, timeout: 10000 }).then(r=>r.data);
    const found = (list||[]).find(x => x.type==='prometheus');
    if (found) {
      await axios.put(`${base}/api/datasources/${found.id}`, ds, { headers, auth, timeout: 10000 });
      return { updated:true, id: found.id };
    }
  } catch (_) {}
  const r = await axios.post(`${base}/api/datasources`, ds, { headers, auth, timeout: 10000 }).then(r=>r.data);
  return { created:true, id: r?.id };
}

async function importDashboard({ base, user, pass, token, file }) {
  const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
  const auth = token ? undefined : { username: user||'admin', password: pass||'admin' };
  const json = JSON.parse(fs.readFileSync(file, 'utf8'));
  const payload = { dashboard: json, overwrite: true, inputs: [] };
  const r = await axios.post(`${base}/api/dashboards/db`, payload, { headers, auth, timeout: 15000 }).then(r=>r.data);
  return r;
}

exports.run = async function(params={}){
  const base = (params.base || 'http://127.0.0.1:3000').replace(/\/$/, '');
  const prom = params.prom || 'http://127.0.0.1:9090';
  const user = params.user || process.env.GRAFANA_USER || 'admin';
  const pass = params.pass || process.env.GRAFANA_PASS || 'admin';
  const token = params.token || process.env.GRAFANA_TOKEN || '';
  const outDir = '/var/lib/fazai/dashboards';
  try { fs.mkdirSync(outDir, { recursive: true }); } catch {}
  // Gera dashboards se necessário
  const gen = require('./grafana_dashboards.js');
  await gen.run();
  const ds = await ensureDatasource({ base, user, pass, token, promUrl: prom });
  const files = fs.readdirSync(outDir).filter(f => f.endsWith('.json')).map(f => path.join(outDir, f));
  const results = [];
  for (const f of files) {
    try { const r = await importDashboard({ base, user, pass, token, file: f }); results.push({ file: path.basename(f), result: r }); } catch (e) { results.push({ file: path.basename(f), error: e.message }); }
  }
  return { success: true, datasource: ds, dashboards: results };
};

