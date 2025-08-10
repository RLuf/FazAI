/*
 * FazAI - Tool: web_search
 * Pesquisa simples na web via API pública (DuckDuckGo HTML) ou mecanismo configurável
 */

const { fetchGet } = require('./http_fetch');

const info = {
  name: 'web_search',
  description: 'Realiza pesquisa básica na web e retorna títulos/links/resumos',
  version: '1.0.0',
  author: 'FazAI Team',
  interactive: false
};

function parseDuckDuckGoHtml(html) {
  const results = [];
  const regex = /<a rel="nofollow" class="result__a" href="(.*?)".*?>(.*?)<\/a>[\s\S]*?<a class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g;
  let match;
  while ((match = regex.exec(html)) !== null) {
    const url = match[1];
    const title = match[2].replace(/<[^>]+>/g, '');
    const snippet = match[3].replace(/<[^>]+>/g, '').trim();
    results.push({ title, url, snippet });
    if (results.length >= 10) break;
  }
  return results;
}

async function search(query) {
  // Fallback: DuckDuckGo HTML (sem API key)
  const url = `https://duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
  const { statusCode, body } = await fetchGet(url, { 'Accept-Language': 'pt-BR,pt;q=0.9' });
  if (statusCode !== 200) {
    return { success: false, error: `HTTP ${statusCode}` };
  }
  const results = parseDuckDuckGoHtml(body);
  return { success: true, results };
}

module.exports = {
  info,
  search,
};
