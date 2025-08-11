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

function parseBingHtml(html) {
  const results = [];
  // Bing search result pattern
  const regex = /<h2[^>]*><a[^>]*href="([^"]*)"[^>]*>([^<]*)<\/a><\/h2>[\s\S]*?<p[^>]*>([^<]*)<\/p>/g;
  let match;
  while ((match = regex.exec(html)) !== null) {
    const url = match[1];
    const title = match[2].trim();
    const snippet = match[3].trim();
    if (url && title && !url.startsWith('javascript:') && !url.startsWith('#')) {
      results.push({ title, url, snippet });
      if (results.length >= 10) break;
    }
  }
  return results;
}

async function search(query) {
  try {
    // For now, return a mock result to test the endpoint
    // TODO: Implement proper web search functionality
    const mockResults = [
      {
        title: `Search results for: ${query}`,
        url: `https://example.com/search?q=${encodeURIComponent(query)}`,
        snippet: `This is a placeholder result for the search query: "${query}". The web search functionality is currently being updated to work with modern search engines.`
      },
      {
        title: `Development Note`,
        url: 'https://github.com/fazai-project',
        snippet: 'The web search module is being updated to handle modern search engine redirects and anti-bot measures. Please check back later for full functionality.'
      }
    ];
    
    return { 
      success: true, 
      results: mockResults, 
      engine: 'Mock Search (Development Mode)',
      note: 'This is a temporary mock response while web search is being updated'
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

module.exports = {
  info,
  search,
};
