/*
 * FazAI - Tool: spamexperts
 * Integração básica com SpamExperts (SolarWinds Email Security). Endpoints podem variar conforme tenant.
 */

const { fetchGet, fetchPost } = require('./http_fetch');

const info = {
  name: 'spamexperts',
  description: 'Operações básicas SpamExperts: listar domínios, criar política (placeholder)',
  version: '1.0.0',
  author: 'FazAI Team',
  interactive: false
};

async function listDomains({ baseUrl, apiKey } = {}) {
  if (!baseUrl || !apiKey) return { success: false, error: 'baseUrl e apiKey são obrigatórios' };
  const url = `${baseUrl.replace(/\/$/, '')}/api/domains`;
  const { statusCode, body } = await fetchGet(url, { 'X-API-Key': apiKey });
  if (statusCode !== 200) return { success: false, error: `HTTP ${statusCode}` };
  let data; try { data = JSON.parse(body); } catch { return { success: false, error: 'JSON inválido' }; }
  return { success: true, result: data };
}

async function createPolicy({ baseUrl, apiKey, domain, policy } = {}) {
  if (!baseUrl || !apiKey || !domain || !policy) return { success: false, error: 'Parâmetros obrigatórios ausentes' };
  const url = `${baseUrl.replace(/\/$/, '')}/api/policies`;
  const { statusCode, body } = await fetchPost(url, { domain, policy }, { 'X-API-Key': apiKey, 'Content-Type': 'application/json' });
  let data; try { data = JSON.parse(body); } catch { return { success: false, error: 'JSON inválido' }; }
  return { success: true, result: data };
}

module.exports = { info, listDomains, createPolicy, run: listDomains };
