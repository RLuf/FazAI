// FazAI Tool: net_qos_monitor
// Monitor per-IP traffic in a CIDR with nftables counters,
// generate a simple HTML chart, and optionally apply tc shaping.

const { execSync } = require('child_process');
const fs = require('fs');

exports.info = {
  name: 'net_qos_monitor',
  description: 'Monitor trafego por IP em uma sub-rede, gera grafico e aplica limite opcional com tc',
  interactive: false
};

function sh(cmd) {
  return execSync(cmd, { encoding: 'utf8' });
}

function detectDefaultInterface() {
  try {
    const out = sh("ip route show default | awk '{print $5; exit}'").trim();
    return out || null;
  } catch { return null; }
}

function ensureHttpRoot() {
  const path = '/var/www/html/fazai';
  try { fs.mkdirSync(path, { recursive: true }); } catch (_) {}
  return path;
}

function setupNftMonitoring(cidr) {
  // idempotent create
  sh('nft list table inet fazai_mon || true');
  try { sh('nft add table inet fazai_mon'); } catch (_) {}
  try { sh('nft add map inet fazai_mon ip2cnt { type ipv4_addr : counter; }'); } catch (_) {}
  try { sh('nft add chain inet fazai_mon mon { type filter hook prerouting priority 0; }'); } catch (_) {}
  // remove prior rule to avoid duplicates
  try { sh("nft list chain inet fazai_mon mon | awk '/handle/ {print $NF}' | xargs -r -I{} nft delete rule inet fazai_mon mon handle {} "); } catch (_) {}
  sh(`nft add rule inet fazai_mon mon ip saddr ${cidr} update @ip2cnt { ip saddr }`);
}

function collectNftCounters() {
  const out = sh('nft --json list map inet fazai_mon ip2cnt');
  const data = JSON.parse(out);
  const entries = (((data || {}).nftables || []).find(x => x.map) || {}).map || {};
  const elem = (entries.data || {}).elem || [];
  const perIp = [];
  for (const e of elem) {
    // e looks like { key: [ { prefix: { addr: '192.168.0.1', len: 32 } } ], counter: { packets: N, bytes: M } }
    const key = e.key?.[0]?.prefix?.addr || e.key?.[0]?.addr || null;
    const bytes = e.counter?.bytes || 0;
    if (key) perIp.push({ ip: key, bytes });
  }
  perIp.sort((a, b) => b.bytes - a.bytes);
  return perIp;
}

function generateHtml(perIp, outputPath) {
  const labels = perIp.map(x => x.ip);
  const values = perIp.map(x => x.bytes);
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Top IPs</title>
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  </head><body><h2>Top IPs por bytes</h2><canvas id="c" height="120"></canvas>
  <script>
  const ctx = document.getElementById('c');
  new Chart(ctx, { type: 'bar', data: { labels: ${JSON.stringify(labels)}, datasets: [{ label: 'Bytes', data: ${JSON.stringify(values)} }] }, options: { responsive: true, scales: { y: { beginAtZero: true } } } });
  </script></body></html>`;
  fs.writeFileSync(outputPath, html, 'utf8');
}

function applyShaping(ifname, topIps, limitMbit) {
  // Simple HTB egress shaping; top IPs get 100mbit, resto  limitMbit
  const hiRate = 100; // mbit
  const defRate = limitMbit; // mbit
  // Cleanup first
  sh(`tc qdisc del dev ${ifname} root || true`);
  // Root qdisc and classes
  sh(`tc qdisc add dev ${ifname} root handle 1: htb default 30`);
  sh(`tc class add dev ${ifname} parent 1: classid 1:1 htb rate ${hiRate}mbit`);
  sh(`tc class add dev ${ifname} parent 1:1 classid 1:30 htb rate ${defRate}mbit ceil ${defRate}mbit`);
  sh(`tc qdisc add dev ${ifname} parent 1:30 handle 30: sfq perturb 10`);
  let idx = 10;
  for (const ip of topIps) {
    const cls = `1:${idx}`;
    sh(`tc class add dev ${ifname} parent 1:1 classid ${cls} htb rate ${hiRate}mbit ceil ${hiRate}mbit`);
    sh(`tc qdisc add dev ${ifname} parent ${cls} handle ${idx}: sfq perturb 10`);
    // Match destination IP for egress (adjust if needed)
    sh(`tc filter add dev ${ifname} protocol ip parent 1: prio 1 u32 match ip dst ${ip}/32 flowid ${cls}`);
    idx++;
  }
}

exports.run = async function(params = {}) {
  const cidr = params.cidr || '192.168.0.0/24';
  const sampleSeconds = Number(params.sample_seconds || 30);
  const apply = !!params.apply_shaping;
  const limitMBps = Number(params.limit_mb_per_s || 1);
  const limitMbit = Math.max(1, Math.round(limitMBps * 8));
  const ifname = params.ifname || detectDefaultInterface();

  if (!ifname) throw new Error('Interface de rede padrao nao encontrada');
  // Ensure nft
  try { sh('nft --version >/dev/null 2>&1'); } catch { throw new Error('nftables nao instalado'); }

  setupNftMonitoring(cidr);
  // wait sampling
  await new Promise(r => setTimeout(r, sampleSeconds * 1000));
  const perIp = collectNftCounters();
  const top = perIp.slice(0, 10).map(x => x.ip);

  if (apply) {
    applyShaping(ifname, top, limitMbit);
  }

  const www = ensureHttpRoot();
  const outFile = `${www}/top_ips.html`;
  generateHtml(perIp.slice(0, 10), outFile);

  return {
    success: true,
    interface: ifname,
    cidr,
    sampled_seconds: sampleSeconds,
    top10: perIp.slice(0, 10),
    shaping_applied: apply,
    default_limit_mbit: limitMbit,
    report: outFile
  };
};
