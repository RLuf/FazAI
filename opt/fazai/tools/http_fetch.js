/*
 * FazAI - Tool: http_fetch
 * Faz requisições HTTP/HTTPS simples para permitir pesquisas e integrações web
 */

const https = require('https');
const http = require('http');

const info = {
  name: 'http_fetch',
  description: 'Efetua requisições HTTP/HTTPS (GET/POST) e retorna corpo e status',
  version: '1.0.0',
  author: 'FazAI Team',
  interactive: false
};

function request(method, url, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    try {
      const isHttps = url.startsWith('https://');
      const lib = isHttps ? https : http;
      const u = new URL(url);

      const options = {
        method,
        hostname: u.hostname,
        port: u.port || (isHttps ? 443 : 80),
        path: u.pathname + (u.search || ''),
        headers: {
          'User-Agent': 'FazAI/1.0',
          ...headers
        }
      };

      const req = lib.request(options, (res) => {
        let data = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          resolve({ statusCode: res.statusCode, headers: res.headers, body: data });
        });
      });

      req.on('error', reject);
      if (body) {
        const payload = typeof body === 'string' ? body : JSON.stringify(body);
        req.write(payload);
      }
      req.end();
    } catch (err) {
      reject(err);
    }
  });
}

async function fetchGet(url, headers = {}) {
  return await request('GET', url, null, headers);
}

async function fetchPost(url, body, headers = { 'Content-Type': 'application/json' }) {
  return await request('POST', url, body, headers);
}

module.exports = {
  info,
  fetchGet,
  fetchPost,
};
