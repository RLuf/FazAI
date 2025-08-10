/*
 * FazAI - Tool: blacklist_check
 * Verificação de listas negras em tempo real (DNSBLs comuns) via consultas DNS
 */

const dns = require('dns').promises;

const info = {
  name: 'blacklist_check',
  description: 'Consulta DNSBLs (Spamhaus, Barracuda, SpamCop, etc.) para IPs',
  version: '1.0.0',
  author: 'FazAI Team',
  interactive: false
};

const DNSBLS = [
  'zen.spamhaus.org',
  'bl.spamcop.net',
  'b.barracudacentral.org',
  'dnsbl.sorbs.net',
  'cbl.abuseat.org'
];

function reverseIp(ip) {
  return ip.split('.').reverse().join('.');
}

async function checkIp(ip) {
  const rev = reverseIp(ip);
  const results = [];
  for (const bl of DNSBLS) {
    const qname = `${rev}.${bl}`;
    try {
      const addrs = await dns.resolve4(qname);
      results.push({ list: bl, listed: true, data: addrs });
    } catch (err) {
      if (err.code === 'ENOTFOUND' || err.code === 'ENODATA') {
        results.push({ list: bl, listed: false });
      } else {
        results.push({ list: bl, error: err.message });
      }
    }
  }
  return results;
}

async function run({ ip }) {
  if (!ip) return { success: false, error: 'Parâmetro ip é obrigatório' };
  const results = await checkIp(ip);
  return { success: true, ip, results };
}

module.exports = { info, run };
