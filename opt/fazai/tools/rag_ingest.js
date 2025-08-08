// FazAI Tool: rag_ingest
// Ingesta documentos (pdf, docx, txt) e URLs, gera embeddings e grava no Qdrant
// Backends de embedding: OpenAI (padrão) ou Python sentence-transformers (opcional)

const { execSync, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

exports.info = { name: 'rag_ingest', description: 'Gera embeddings e indexa no Qdrant', interactive: false };

function sh(cmd) { return execSync(cmd, { encoding: 'utf8' }); }

function readFileAsText(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  try {
    if (ext === '.pdf') {
      try { sh('pdftotext -v >/dev/null 2>&1'); } catch { throw new Error('pdftotext não encontrado'); }
      return sh(`pdftotext -layout "${filePath}" - 2>/dev/null`);
    }
    if (ext === '.docx') {
      try { sh('pandoc -v >/dev/null 2>&1'); return sh(`pandoc -t plain "${filePath}"`); } catch {}
      try { sh('docx2txt -V >/dev/null 2>&1'); return sh(`docx2txt "${filePath}" -`); } catch {}
      throw new Error('Sem conversor para DOCX (instale pandoc ou docx2txt)');
    }
    // fallback: txt/markdown/etc.
    return fs.readFileSync(filePath, 'utf8');
  } catch (e) {
    return '';
  }
}

async function fetchUrlAsText(url) {
  try {
    // Tenta usar lynx/w3m para renderizar texto
    try { sh('lynx -version >/dev/null 2>&1'); return sh(`curl -fsSL "${url}" | lynx -dump -stdin`); } catch {}
    try { sh('w3m -version >/dev/null 2>&1'); return sh(`w3m -dump "${url}"`); } catch {}
    const { data } = await axios.get(url, { timeout: 15000 });
    return String(data).replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<[^>]+>/g, ' ');
  } catch { return ''; }
}

function chunkText(text, maxLen = 2000, overlap = 200) {
  const chunks = [];
  let i = 0;
  while (i < text.length) {
    const end = Math.min(text.length, i + maxLen);
    chunks.push(text.slice(i, end));
    if (end === text.length) break;
    i = end - overlap;
    if (i < 0) i = 0;
  }
  return chunks;
}

async function embedWithOpenAI(texts, model, apiKey) {
  const endpoint = 'https://api.openai.com/v1/embeddings';
  const payload = { model: model || 'text-embedding-3-small', input: texts };
  const headers = { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' };
  const { data } = await axios.post(endpoint, payload, { headers });
  return data.data.map(x => x.embedding);
}

function embedWithPython(texts, model) {
  const code = `import sys,json\ntexts=json.load(sys.stdin)\nfrom sentence_transformers import SentenceTransformer\nmodel=SentenceTransformer('${model or 'sentence-transformers/all-MiniLM-L6-v2'}')\nvecs=model.encode(texts, normalize_embeddings=True).tolist()\njson.dump(vecs, sys.stdout)`;
  const proc = spawnSync('python3', ['-c', code], { input: JSON.stringify(texts), encoding: 'utf8' });
  if (proc.status !== 0) throw new Error(proc.stderr || 'embedding python failure');
  return JSON.parse(proc.stdout);
}

async function qdrantUpsert(url, collection, vectors, payloads) {
  const points = vectors.map((v, i) => ({ id: Date.now() + i, vector: v, payload: payloads[i] }));
  await axios.put(`${url.replace(/\/$/, '')}/collections/${collection}/points`, { points }, { timeout: 30000 });
}

exports.run = async function(params = {}) {
  const qUrl = params.qdrant_url || 'http://localhost:6333';
  const collection = params.collection || 'linux_networking_tech';
  const backend = (params.backend || 'openai').toLowerCase();
  const openaiKey = params.openai_api_key || process.env.OPENAI_API_KEY;
  const model = params.model; // embedding backend model
  const paths = Array.isArray(params.source_files) ? params.source_files : [];
  const dirs = Array.isArray(params.source_dirs) ? params.source_dirs : [];
  const urls = Array.isArray(params.urls) ? params.urls : [];

  // aggregate texts
  let docs = [];
  for (const p of paths) {
    const abs = path.resolve(p);
    const text = readFileAsText(abs);
    if (text) docs.push({ text, meta: { source: abs, type: 'file' } });
  }
  for (const d of dirs) {
    const absd = path.resolve(d);
    const entries = fs.readdirSync(absd).map(f => path.join(absd, f));
    for (const e of entries) {
      if (fs.statSync(e).isFile()) {
        const text = readFileAsText(e);
        if (text) docs.push({ text, meta: { source: e, type: 'file' } });
      }
    }
  }
  for (const u of urls) {
    const text = await fetchUrlAsText(u);
    if (text) docs.push({ text, meta: { source: u, type: 'url' } });
  }

  // chunk
  const allChunks = [];
  for (const d of docs) {
    for (const ch of chunkText(d.text)) {
      allChunks.push({ text: ch, meta: d.meta });
    }
  }
  if (allChunks.length === 0) return { success: false, error: 'Nenhum conteúdo encontrado' };

  // embed
  const texts = allChunks.map(x => x.text);
  let vectors;
  if (backend === 'python') {
    vectors = embedWithPython(texts, model);
  } else {
    if (!openaiKey) return { success: false, error: 'OPENAI_API_KEY ausente para backend openai' };
    vectors = await embedWithOpenAI(texts, model, openaiKey);
  }

  // upsert
  const payloads = allChunks.map(x => ({ text: x.text, source: x.meta.source, type: x.meta.type }));
  await qdrantUpsert(qUrl, collection, vectors, payloads);

  // write a simple catalog
  const www = '/var/www/html/fazai/rag';
  try { fs.mkdirSync(www, { recursive: true }); } catch {}
  fs.writeFileSync(path.join(www, 'INGEST_LOG.json'), JSON.stringify({ when: new Date().toISOString(), count: allChunks.length, collection, url: qUrl }, null, 2));

  return { success: true, collection, qdrant_url: qUrl, chunks_indexed: allChunks.length };
};
