/*
 * FazAI - Tool: ports_monitor
 * Monitora portas e conexões (ss/netstat), cruza com GeoIP e DNSBLs, aciona alertas/bloqueios
 */

const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

const geoip = require('./geoip_lookup');
const bl = require('./blacklist_check');
const cloudflare = require('./cloudflare');
const alerts = require('./alerts');

const info = {
  name: 'ports_monitor',
  description: 'Audita conexões de rede e aplica ações (alertas/bloqueios)',
  version: '1.0.0',
  author: 'FazAI Team',
  interactive: false
};

async function snapshotConnections() {
  // Usa ss se disponível, cai para netstat
  try {
    const { stdout } = await execPromise('ss -ntp || netstat -ntp');
    return stdout;
  } catch (err) {
    return '';
  }
}

function parseConnections(text) {
  const lines = text.split('\n').filter(Boolean);
  const conns = [];
  for (const line of lines.slice(1)) {
    const parts = line.trim().split(/\s+/);
    const remote = parts.find(p => p.includes(':') && !p.startsWith('127.') && !p.includes('::')) || '';
    const ip = remote.split(':')[0];
    if (ip && /^\d+\.\d+\.\d+\.\d+$/.test(ip)) {
      conns.push({ ip, raw: line });
    }
  }
  return conns;
}

async function run(params = {}) {
  const text = await snapshotConnections();
  const conns = parseConnections(text);
  const uniqueIps = [...new Set(conns.map(c => c.ip))].slice(0, params.maxIps || 50);

  const results = [];
  for (const ip of uniqueIps) {
    const [geo, blc] = await Promise.all([
      geoip.lookup({ ip }),
      bl.run({ ip })
    ]);
    results.push({ ip, geo, blacklist: blc });

    // Policy: alerta e possível bloqueio via Cloudflare expression
    if (params.cloudflare && blc?.results?.some(r => r.listed)) {
      const { apiToken, zoneId } = params.cloudflare;
      const expr = `(ip.src eq ${ip})`;
      await cloudflare.createFirewallRule({ apiToken, zoneId, filter_expression: expr, description: `Auto-block listed ${ip}` });
      if (params.alerts) {
        await alerts.run({ channel: 'email', to: params.alerts.to, subject: `IP listado: ${ip}`, message: JSON.stringify({ ip, bl: blc }) });
      }
    }
  }

  return { success: true, results };
}

module.exports = { info, run };
