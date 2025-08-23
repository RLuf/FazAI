/*
 * FazAI - Tool: context7
 * Consulta Context7 MCP/API para recuperar contexto adicional (RAG auxiliar)
 */

const axios = require('axios');

const info = {
  name: 'context7',
  description: 'Consulta Context7 para contexto técnico auxiliar',
  version: '1.0.0',
  author: 'FazAI Team',
  interactive: false
};

async function query({ query, endpoint, api_key, timeout_ms = 20000 } = {}) {
  if (!endpoint) throw new Error('endpoint é obrigatório');
  if (!api_key) throw new Error('api_key é obrigatório');
  if (!query || String(query).trim() === '') throw new Error('query é obrigatória');
  const headers = { 'Authorization': `Bearer ${api_key}`, 'Content-Type': 'application/json' };
  const payload = { query: String(query) };
  const resp = await axios.post(endpoint.replace(/\/$/, '') + '/query', payload, { headers, timeout: timeout_ms });
  return resp.data;
}

module.exports = { info, query, run: query };

