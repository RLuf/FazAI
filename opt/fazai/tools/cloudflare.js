/*
 * FazAI - Tool: cloudflare
 * Integra operações básicas com a API Cloudflare (Zones, DNS, Firewall Rules)
 */

const { fetchGet, fetchPost } = require('./http_fetch');

const info = {
  name: 'cloudflare',
  description: 'Opera na API Cloudflare: listar zonas, criar DNS, criar firewall rules',
  version: '1.0.0',
  author: 'FazAI Team',
  interactive: false
};

function authHeaders(apiToken) {
  return { 'Authorization': `Bearer ${apiToken}`, 'Content-Type': 'application/json' };
}

async function listZones({ apiToken, name } = {}) {
  if (!apiToken) return { success: false, error: 'apiToken é obrigatório' };
  const url = `https://api.cloudflare.com/client/v4/zones${name ? `?name=${encodeURIComponent(name)}` : ''}`;
  const { statusCode, body } = await fetchGet(url, authHeaders(apiToken));
  let data; try { data = JSON.parse(body); } catch { return { success: false, error: 'JSON inválido' }; }
  return { success: data.success, result: data.result, errors: data.errors };
}

async function createDnsRecord({ apiToken, zoneId, type, name, content, ttl = 300, proxied = false } = {}) {
  if (!apiToken || !zoneId || !type || !name || !content) return { success: false, error: 'Parâmetros obrigatórios ausentes' };
  const url = `https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records`;
  const payload = { type, name, content, ttl, proxied };
  const { statusCode, body } = await fetchPost(url, payload, authHeaders(apiToken));
  let data; try { data = JSON.parse(body); } catch { return { success: false, error: 'JSON inválido' }; }
  return { success: data.success, result: data.result, errors: data.errors };
}

async function createFirewallRule({ apiToken, zoneId, description, filter_expression, action = 'block' } = {}) {
  if (!apiToken || !zoneId || !filter_expression) return { success: false, error: 'Parâmetros obrigatórios ausentes' };
  const url = `https://api.cloudflare.com/client/v4/zones/${zoneId}/firewall/rules`;
  const payload = [{ action, description: description || 'FazAI rule', filter: { expression: filter_expression } }];
  const { statusCode, body } = await fetchPost(url, payload, authHeaders(apiToken));
  let data; try { data = JSON.parse(body); } catch { return { success: false, error: 'JSON inválido' }; }
  return { success: data.success, result: data.result, errors: data.errors };
}

module.exports = { info, listZones, createDnsRecord, createFirewallRule, run: listZones };
