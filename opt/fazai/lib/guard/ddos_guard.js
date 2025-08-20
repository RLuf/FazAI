#!/usr/bin/env node
/**
 * DDoS Guard Orquestrador
 * - RTBH/Flowspec (ex.: IX/PTT, operadoras)
 * - Cloudflare API (zone rules, IP/ASN/país)
 * - Edge local (nftables/ipset/tc)
 */

const fs = require('fs');
const { exec } = require('child_process');
const { promisify } = require('util');
const axios = require('axios');
const execAsync = promisify(exec);

async function applyLocalEdge(action, params, ctx) {
  const { logger } = ctx;
  switch (action) {
    case 'block_ipset': {
      const setName = params.set || 'bad_ips';
      const cidrList = Array.isArray(params.list) ? params.list : [params.list].filter(Boolean);
      await execAsync(`nft add table inet guard 2>/dev/null || true`);
      await execAsync(`nft add set inet guard ${setName} { type ipv4_addr; flags interval; } 2>/dev/null || true`);
      for (const cidr of cidrList) {
        await execAsync(`nft add element inet guard ${setName} { ${cidr} } 2>/dev/null || true`);
      }
      await execAsync(`nft add chain inet guard input { type filter hook input priority 0; } 2>/dev/null || true`);
      await execAsync(`nft add rule inet guard input ip saddr @${setName} drop 2>/dev/null || true`);
      logger && logger.info(`[guard] ipset ${setName} atualizado (${cidrList.length})`);
      return { edge: 'nftables', set: setName, added: cidrList.length };
    }
    case 'throttle_iface': {
      const iface = params.iface || 'eth0';
      const rate = params.rate || '100mbit';
      await execAsync(`tc qdisc replace dev ${iface} root tbf rate ${rate} burst 32k latency 400ms`);
      return { edge: 'tc', iface, rate };
    }
    default:
      return { edge: 'noop' };
  }
}

async function applyCloudflare(action, params, ctx) {
  const { logger } = ctx;
  const token = process.env.CLOUDFLARE_API_TOKEN || params.token;
  const accountId = params.account_id;
  const zoneId = params.zone_id;
  if (!token) throw new Error('Cloudflare token ausente');
  const cf = axios.create({
    baseURL: 'https://api.cloudflare.com/client/v4',
    headers: { Authorization: `Bearer ${token}` }
  });
  switch (action) {
    case 'cf_asn_block': {
      const asnList = Array.isArray(params.asn) ? params.asn : [params.asn].filter(Boolean);
      // Simplificado: criar rule expression
      const expr = asnList.map(a=>`ip.geoip.asnum eq ${String(a).replace(/^AS/i,'')}`).join(' or ');
      const body = { filter: { expression: expr, paused: false, description: 'DDoS ASN block' }, action: 'block' };
      const resp = await cf.post(`/zones/${zoneId}/firewall/rules`, [ body ]);
      logger && logger.info(`[guard] Cloudflare ASN block criado (${asnList.length})`);
      return { provider: 'cloudflare', rules_created: resp.data?.result?.length || 1 };
    }
    case 'cf_country_block': {
      const countries = Array.isArray(params.countries) ? params.countries : [params.countries].filter(Boolean);
      const expr = countries.map(c=>`ip.geoip.country eq "${c}"`).join(' or ');
      const body = { filter: { expression: expr, paused: false, description: 'DDoS Country block' }, action: 'block' };
      const resp = await cf.post(`/zones/${zoneId}/firewall/rules`, [ body ]);
      return { provider: 'cloudflare', rules_created: resp.data?.result?.length || 1 };
    }
    default:
      return { provider: 'cloudflare', noop: true };
  }
}

async function applyUpstream(action, params, ctx) {
  // Placeholder: integração com operadora/IX via API/SSH (Flowspec/RTBH)
  // Exemplo: registrar ticket, anunciar rota discard, etc.
  return { upstream: 'placeholder', action };
}

async function executeGuard(action, params = {}, ctx = {}) {
  switch (params.scope || 'edge') {
    case 'edge':
      return await applyLocalEdge(action, params, ctx);
    case 'cloudflare':
      return await applyCloudflare(action, params, ctx);
    case 'upstream':
      return await applyUpstream(action, params, ctx);
    default:
      return { noop: true };
  }
}

module.exports = { executeGuard };
