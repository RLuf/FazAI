#!/usr/bin/env node
const express = require('express');
const cors = require('cors');
const { exec, spawn, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const multer = require('multer');
const axios = require('axios');
const https = require('https');

const fetch = global.fetch ? global.fetch.bind(global) : (...args) => import('node-fetch').then(({ default: nodeFetch }) => nodeFetch(...args));
const PUBLIC_DIR = path.join(__dirname);

const dataDir = path.join(__dirname, 'data');
const settingsFile = path.join(dataDir, 'settings.json');
const notesFile = path.join(dataDir, 'notes.json');
const alertLogFile = path.join(dataDir, 'alerts.log');
const ragDataDir = path.join(dataDir, 'rag');
const ragCatalogFile = path.join(ragDataDir, 'ingest_log.json');
const cloudflareFile = path.join(dataDir, 'cloudflare_accounts.json');
const cloudflareLogFile = path.join(dataDir, 'cloudflare_logs.json');
const opnsenseFile = path.join(dataDir, 'opnsense_servers.json');

const DEFAULT_RAG_COLLECTION = process.env.FAZAI_RAG_COLLECTION || 'fazai_kb';
const QDRANT_URL = process.env.FAZAI_QDRANT_URL || 'http://localhost:6333';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: Number(process.env.FAZAI_RAG_MAX_FILE || 50 * 1024 * 1024),
    files: 12
  }
});

const defaultSettings = {
  alerts: {
    smtp: { enabled: false, host: '', port: 587, secure: false, user: '', pass: '', from: '', to: [] },
    telegram: { enabled: false, botToken: '', chatIds: [] },
    voip: { enabled: false, accountSid: '', authToken: '', from: '', to: [] }
  }
};

const sizeUnits = {
  b: 1,
  kb: 1024,
  kib: 1024,
  mb: 1024 * 1024,
  mib: 1024 * 1024,
  gb: 1024 * 1024 * 1024,
  gib: 1024 * 1024 * 1024
};

function parseSize(value = '') {
  const trimmed = String(value).trim();
  if (!trimmed || trimmed === '0') return 0;
  const match = trimmed.match(/([0-9.,]+)\s*([a-zA-Z]+)/);
  if (!match) {
    const numeric = Number(trimmed.replace(/[^0-9.-]/g, ''));
    return Number.isFinite(numeric) ? numeric : 0;
  }
  const num = Number(match[1].replace(',', '.'));
  const unit = match[2].toLowerCase();
  const factor = sizeUnits[unit] || 1;
  return Number.isFinite(num) ? num * factor : 0;
}

function parsePair(value = '', separator = '/') {
  const parts = String(value).split(separator).map((part) => part.trim());
  return [parts[0] || '', parts[1] || ''];
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function loadJson(file, fallback) {
  try {
    const text = fs.readFileSync(file, 'utf-8');
    return JSON.parse(text);
  } catch {
    return fallback;
  }
}

function saveJson(file, data) {
  ensureDir(path.dirname(file));
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

function chunkText(text, size = 1200, overlap = 240) {
  const cleaned = String(text).replace(/\s+/g, ' ').trim();
  if (!cleaned) return [];
  const chunks = [];
  let start = 0;
  while (start < cleaned.length) {
    const end = Math.min(cleaned.length, start + size);
    const slice = cleaned.slice(start, end);
    if (slice.trim()) chunks.push(slice.trim());
    if (end === cleaned.length) break;
    start = Math.max(0, end - overlap);
  }
  return chunks;
}

function normalizeVector(vec) {
  let sumSq = 0;
  for (const val of vec) sumSq += val * val;
  const norm = Math.sqrt(sumSq) || 1;
  return Array.from(vec, (val) => val / norm);
}

function textToEmbedding(text, dimension = 384) {
  const vector = new Float32Array(dimension);
  const tokens = String(text).toLowerCase().split(/[^a-z0-9áéíóúàâêôãõçü]+/i).filter(Boolean);
  if (!tokens.length) {
    vector[0] = 1;
    return Array.from(vector);
  }
  tokens.forEach((token) => {
    const hash = crypto.createHash('sha256').update(token).digest();
    for (let i = 0; i < hash.length; i += 4) {
      const idx = hash.readUInt16BE(i) % dimension;
      const sign = (hash[i + 2] & 1) ? 1 : -1;
      vector[idx] += sign;
    }
  });
  return normalizeVector(vector);
}

function flattenJsonStrings(value, acc = []) {
  if (typeof value === 'string') {
    acc.push(value);
    return acc;
  }
  if (Array.isArray(value)) {
    value.forEach((item) => flattenJsonStrings(item, acc));
    return acc;
  }
  if (value && typeof value === 'object') {
    Object.values(value).forEach((item) => flattenJsonStrings(item, acc));
  }
  return acc;
}

function parseJsonBuffer(buffer) {
  const raw = buffer.toString('utf-8');
  const strings = [];
  try {
    const parsed = JSON.parse(raw);
    flattenJsonStrings(parsed, strings);
  } catch {
    raw.split(/\r?\n/).forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed) return;
      try {
        const parsedLine = JSON.parse(trimmed);
        flattenJsonStrings(parsedLine, strings);
      } catch {
        strings.push(trimmed);
      }
    });
  }
  return strings.join('\n').trim();
}

function convertWithCommand(command, args, inputPath) {
  try {
    const result = spawnSync(command, args, { encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 });
    if (result.status === 0) return result.stdout;
    console.warn(`${command} falhou`, result.stderr || result.error?.message);
  } catch (err) {
    console.warn(`convertWithCommand erro: ${command}`, err.message);
  }
  return '';
}

function bufferToText(filename, buffer) {
  const ext = path.extname(filename || '').toLowerCase();
  if (ext === '.json') return parseJsonBuffer(buffer);
  if (ext === '.txt' || ext === '.md' || ext === '.log') return buffer.toString('utf-8');

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fazai-rag-'));
  const tmpFile = path.join(tmpDir, path.basename(filename || `upload${Date.now()}`));
  try {
    fs.writeFileSync(tmpFile, buffer);
    if (ext === '.pdf') {
      const output = convertWithCommand('pdftotext', ['-layout', tmpFile, '-']);
      if (output.trim()) return output;
    }
    if (ext === '.docx' || ext === '.doc' || ext === '.rtf') {
      const pandocOut = convertWithCommand('pandoc', ['-t', 'plain', tmpFile], tmpFile);
      if (pandocOut.trim()) return pandocOut;
      const docx2txtOut = convertWithCommand('docx2txt', [tmpFile, '-'], tmpFile);
      if (docx2txtOut.trim()) return docx2txtOut;
    }
    if (ext === '.html' || ext === '.htm') {
      const lynxOut = convertWithCommand('lynx', ['-dump', tmpFile]);
      if (lynxOut.trim()) return lynxOut;
    }
    return buffer.toString('utf-8');
  } finally {
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
  }
}

async function ensureQdrantCollection(collection, vectorSize = 384) {
  const baseUrl = QDRANT_URL.replace(/\/$/, '');
  try {
    await axios.get(`${baseUrl}/collections/${collection}`, { timeout: 5000 });
    return;
  } catch (err) {
    if (err.response && err.response.status === 404) {
      await axios.put(`${baseUrl}/collections/${collection}`, {
        vectors: {
          size: vectorSize,
          distance: 'Cosine'
        }
      }, { timeout: 10000 });
      return;
    }
    throw new Error(`Falha ao verificar coleção Qdrant: ${err.message}`);
  }
}

async function upsertInQdrant(collection, points) {
  if (!points.length) return;
  const baseUrl = QDRANT_URL.replace(/\/$/, '');
  await axios.put(`${baseUrl}/collections/${collection}/points`, { points }, { timeout: 20000 });
}

function appendRagLog(entry) {
  ensureDir(ragDataDir);
  let current = [];
  try {
    current = JSON.parse(fs.readFileSync(ragCatalogFile, 'utf-8'));
  } catch {}
  const enriched = [{ id: Date.now(), ...entry }, ...current].slice(0, 200);
  fs.writeFileSync(ragCatalogFile, JSON.stringify(enriched, null, 2));
}

async function ingestDocuments(documents, options = {}) {
  if (!documents.length) return { chunks: 0 };
  const collection = options.collection || DEFAULT_RAG_COLLECTION;
  await ensureQdrantCollection(collection, 384);
  const points = [];
  const catalogEntries = [];
  documents.forEach((doc, index) => {
    const chunks = chunkText(doc.text, options.chunkSize || 1200, options.chunkOverlap || 240);
    chunks.forEach((chunk, idx) => {
      const vector = textToEmbedding(chunk, 384);
      const id = `${Date.now()}-${index}-${idx}-${Math.random().toString(16).slice(2, 8)}`;
      const payload = {
        text: chunk,
        source: doc.source,
        title: doc.title || doc.source,
        tags: options.tags || doc.tags || [],
        ingested_at: new Date().toISOString(),
        extra: doc.extra || {}
      };
      points.push({ id, vector, payload });
      catalogEntries.push({
        id,
        source: payload.source,
        title: payload.title,
        tags: payload.tags,
        collection,
        preview: chunk.slice(0, 280) + (chunk.length > 280 ? '…' : ''),
        ingested_at: payload.ingested_at
      });
    });
  });
  if (!points.length) return { chunks: 0 };
  await upsertInQdrant(collection, points);
  appendRagLog({
    collection,
    count: points.length,
    documents: documents.map((d) => ({ source: d.source, title: d.title })),
    tags: options.tags || []
  });
  return { collection, chunks: points.length, documents: documents.length, catalog: catalogEntries };
}

function loadCloudflareState() {
  const data = loadJson(cloudflareFile, { accounts: [] });
  data.accounts = Array.isArray(data.accounts) ? data.accounts : [];
  return data;
}

function saveCloudflareState(state) {
  saveJson(cloudflareFile, state);
}

function appendCloudflareLog(entry) {
  const current = loadJson(cloudflareLogFile, []);
  current.unshift({ ts: new Date().toISOString(), ...entry });
  saveJson(cloudflareLogFile, current.slice(0, 200));
}

function getCloudflareAccount(id) {
  const state = loadCloudflareState();
  return state.accounts.find((acc) => String(acc.id) === String(id));
}

async function cloudflareRequest(account, method, endpoint, data, params) {
  if (!account?.token) {
    throw new Error('Conta Cloudflare inválida ou token ausente');
  }
  const baseUrl = 'https://api.cloudflare.com/client/v4';
  const url = `${baseUrl}${endpoint.startsWith('/') ? endpoint : '/' + endpoint}`;
  const headers = {
    'Authorization': `Bearer ${account.token}`,
    'Content-Type': 'application/json'
  };
  if (account.email) headers['X-Auth-Email'] = account.email;
  try {
    const response = await axios({
      method,
      url,
      data,
      params,
      timeout: 20000,
      headers
    });
    return response.data;
  } catch (err) {
    if (err.response?.data) {
      const errors = err.response.data.errors || err.response.data.messages || err.response.data;
      throw new Error(typeof errors === 'string' ? errors : JSON.stringify(errors));
    }
    throw new Error(err.message || 'Falha na requisição Cloudflare');
  }
}

function loadOpnsenseServers() {
  const data = loadJson(opnsenseFile, { servers: [] });
  data.servers = Array.isArray(data.servers) ? data.servers : [];
  return data;
}

function saveOpnsenseServers(data) {
  saveJson(opnsenseFile, data);
}

function getOpnsenseServer(id) {
  const data = loadOpnsenseServers();
  return data.servers.find((srv) => String(srv.id) === String(id));
}

async function opnsenseRequest(server, method, endpoint, body) {
  if (!server) throw new Error('Servidor OPNsense não encontrado');
  if (!server.baseUrl || !server.key || !server.secret) {
    throw new Error('Servidor OPNsense sem credenciais completas');
  }
  const base = server.baseUrl.replace(/\/$/, '');
  const url = `${base}${endpoint.startsWith('/') ? endpoint : '/' + endpoint}`;
  const headers = {
    'Authorization': 'Basic ' + Buffer.from(`${server.key}:${server.secret}`).toString('base64'),
    'Content-Type': 'application/json'
  };
  if (server.csrfToken) headers['X-CSRFToken'] = server.csrfToken;
  let httpsAgent;
  try {
    const parsed = new URL(base);
    if (parsed.protocol === 'https:' && server.verifyTls === false) {
      httpsAgent = new https.Agent({ rejectUnauthorized: false });
    }
  } catch { /* ignore URL parsing errors */ }
  try {
    const response = await axios({
      method,
      url,
      headers,
      data: body,
      timeout: 20000,
      httpsAgent,
      validateStatus: (code) => code >= 200 && code < 300
    });
    return response.data;
  } catch (err) {
    if (err.response?.data) {
      throw new Error(typeof err.response.data === 'string' ? err.response.data : JSON.stringify(err.response.data));
    }
    throw new Error(err.message || 'Falha na requisição OPNsense');
  }
}

function loadSettings() {
  try {
    return JSON.parse(fs.readFileSync(settingsFile, 'utf-8'));
  } catch {
    return JSON.parse(JSON.stringify(defaultSettings));
  }
}

function saveSettings(settings) {
  fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(settingsFile, JSON.stringify(settings, null, 2));
}

function loadNotes() {
  try {
    return JSON.parse(fs.readFileSync(notesFile, 'utf-8'));
  } catch {
    return [];
  }
}

function saveNotes(notes) {
  fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(notesFile, JSON.stringify(notes, null, 2));
}

function logAlert(entry) {
  fs.mkdirSync(dataDir, { recursive: true });
  try {
    fs.appendFileSync(alertLogFile, JSON.stringify({ ts: new Date().toISOString(), ...entry }) + '\n');
  } catch (err) {
    console.error('logAlert error', err.message);
  }
}

function mergeAlertSettings(current, incoming) {
  const result = { ...current };
  if (!incoming) return result;
  ['smtp', 'telegram', 'voip'].forEach((key) => {
    if (incoming[key]) {
      const base = result[key] || {};
      result[key] = { ...base, ...incoming[key] };
      if (incoming[key].to) {
        result[key].to = Array.isArray(incoming[key].to) ? incoming[key].to : [incoming[key].to];
      }
      if (incoming[key].chatIds) {
        result[key].chatIds = Array.isArray(incoming[key].chatIds) ? incoming[key].chatIds : [incoming[key].chatIds];
      }
    }
  });
  return result;
}

const app = express();
const PORT = process.env.PORT || 5050;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static(PUBLIC_DIR));

function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const proc = spawn(command, args, { shell: false, ...options });
    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', (data) => (stdout += data.toString()));
    proc.stderr.on('data', (data) => (stderr += data.toString()));
    proc.on('close', (code) => {
      if (code === 0) resolve({ stdout, stderr });
      else reject({ code, stdout, stderr });
    });
    proc.on('error', (err) => reject({ code: -1, stderr: err.message }));
  });
}

function execShell(cmd, timeout = 15000) {
  return new Promise((resolve, reject) => {
    exec(cmd, { timeout }, (error, stdout, stderr) => {
      if (error) {
        reject({ error: error.message, stdout, stderr });
      } else {
        resolve({ stdout, stderr });
      }
    });
  });
}

async function sendSMTPAlert(config, { subject, text }) {
  if (!config?.enabled || !config.host || !(config.to && config.to.length)) return null;
  const transporter = nodemailer.createTransport({
    host: config.host,
    port: Number(config.port) || 587,
    secure: Boolean(config.secure),
    auth: config.user ? { user: config.user, pass: config.pass } : undefined
  });
  const recipients = Array.isArray(config.to) ? config.to.join(',') : config.to;
  return transporter.sendMail({
    from: config.from || config.user || 'fazai@localhost',
    to: recipients,
    subject: subject || 'Alerta FazAI',
    text: text || ''
  });
}

async function sendTelegramAlerts(config, message) {
  if (!config?.enabled || !config.botToken || !(config.chatIds && config.chatIds.length)) return [];
  const responses = [];
  for (const chatId of config.chatIds) {
    try {
      const resp = await fetch(`https://api.telegram.org/bot${config.botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text: message })
      });
      responses.push(await resp.json());
    } catch (err) {
      responses.push({ ok: false, error: err.message, chatId });
    }
  }
  return responses;
}

async function sendVoipAlerts(config, message) {
  if (!config?.enabled || !config.accountSid || !config.authToken || !config.from || !(config.to && config.to.length)) return [];
  const results = [];
  for (const to of config.to) {
    try {
      const url = `https://api.twilio.com/2010-04-01/Accounts/${config.accountSid}/Calls.json`;
      const params = new URLSearchParams({ From: config.from, To: to, Twiml: message });
      const resp = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': 'Basic ' + Buffer.from(`${config.accountSid}:${config.authToken}`).toString('base64')
        },
        body: params
      });
      results.push(await resp.json());
    } catch (err) {
      results.push({ ok: false, error: err.message, to });
    }
  }
  return results;
}

app.get('/api/ping', async (req, res) => {
  const target = req.query.target;
  if (!target) return res.status(400).json({ error: 'target obrigatório' });
  try {
    const result = await runCommand('ping', ['-c', '4', target]);
    res.json({ ok: true, output: result.stdout });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.stderr || err.stdout || err.error });
  }
});

app.get('/api/traceroute', async (req, res) => {
  const target = req.query.target;
  if (!target) return res.status(400).json({ error: 'target obrigatório' });
  try {
    const command = fs.existsSync('/usr/bin/traceroute') ? 'traceroute' : 'tracepath';
    const args = command === 'traceroute' ? ['-m', '20', target] : [target];
    const result = await runCommand(command, args);
    res.json({ ok: true, output: result.stdout });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.stderr || err.stdout || err.error });
  }
});

app.get('/api/nmap', async (req, res) => {
  const target = req.query.target;
  if (!target) return res.status(400).json({ error: 'target obrigatório' });
  try {
    const result = await runCommand('nmap', ['-Pn', '-n', target]);
    res.json({ ok: true, output: result.stdout });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.stderr || err.stdout || err.error });
  }
});

app.get('/api/netstat', async (_req, res) => {
  try {
    const cmd = fs.existsSync('/bin/ss') ? 'ss' : 'netstat';
    const args = cmd === 'ss' ? ['-tupan'] : ['-tupan'];
    const result = await runCommand(cmd, args);
    res.json({ ok: true, output: result.stdout });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.stderr || err.stdout || err.error });
  }
});

app.get('/api/port-check', async (req, res) => {
  const { target, port } = req.query;
  if (!target || !port) return res.status(400).json({ error: 'target e port obrigatórios' });
  const cmd = `timeout 5 bash -lc "nc -zv ${target} ${port}"`;
  try {
    const result = await execShell(cmd, 7000);
    res.json({ ok: true, output: result.stdout || result.stderr });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.stderr || err.stdout || err.error });
  }
});

app.get('/api/http-check', async (req, res) => {
  const target = req.query.target;
  if (!target) return res.status(400).json({ error: 'target obrigatório' });
  const url = target.startsWith('http') ? target : `http://${target}`;
  try {
    const resp = await fetch(url, { method: 'HEAD' });
    res.json({ ok: resp.ok, status: resp.status, statusText: resp.statusText });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.post('/api/exec', async (req, res) => {
  const { command } = req.body;
  if (!command) return res.status(400).json({ error: 'command obrigatório' });
  try {
    const result = await execShell(command, 20000);
    res.json({ ok: true, stdout: result.stdout, stderr: result.stderr });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.error, stdout: err.stdout, stderr: err.stderr });
  }
});

const defaultLogs = [
  '/var/log/syslog',
  '/var/log/messages',
  '/var/log/auth.log',
  '/var/log/fazai/fazai.log',
  '/var/log/fazai/gemma-worker.log'
];

app.get('/api/logs/list', (req, res) => {
  const logs = (req.query.extra ? req.query.extra.split(',') : [])
    .concat(defaultLogs)
    .filter((file, idx, arr) => file && arr.indexOf(file) === idx && fs.existsSync(file));
  res.json({ ok: true, files: logs });
});

app.get('/api/logs/stream', (req, res) => {
  const file = req.query.file;
  if (!file) return res.status(400).json({ error: 'file obrigatório' });
  if (!fs.existsSync(file)) return res.status(404).json({ error: 'arquivo não encontrado' });

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive'
  });

  const tail = spawn('tail', ['-n', '200', '-f', file]);
  tail.stdout.on('data', (data) => {
    res.write(`data: ${JSON.stringify(data.toString())}\n\n`);
  });
  tail.stderr.on('data', (data) => {
    res.write(`event: error\ndata: ${JSON.stringify(data.toString())}\n\n`);
  });
  tail.on('close', () => {
    res.write('event: end\ndata: ""\n\n');
    res.end();
  });
  req.on('close', () => {
    tail.kill('SIGTERM');
  });
});

app.post('/api/spamexperts', async (req, res) => {
  const { host, endpoint = '/api/v2/user', method = 'GET', token, body } = req.body || {};
  if (!host || !token) return res.status(400).json({ error: 'host e token obrigatórios' });
  const url = `${host.replace(/\/$/, '')}${endpoint}`;
  try {
    const resp = await fetch(url, {
      method,
      headers: {
        'Accept': 'application/json',
        'X-API-KEY': token,
        'Content-Type': 'application/json'
      },
      body: body ? JSON.stringify(body) : undefined
    });
    const data = await resp.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/cloudflare/accounts', (_req, res) => {
  const state = loadCloudflareState();
  res.json({ ok: true, accounts: state.accounts });
});

app.post('/api/cloudflare/accounts', (req, res) => {
  const { id, name, email, token, accountId, notes } = req.body || {};
  if (!token) return res.status(400).json({ ok: false, error: 'token obrigatório' });
  const state = loadCloudflareState();
  let account = null;
  if (id) {
    account = state.accounts.find((acc) => String(acc.id) === String(id));
  }
  if (account) {
    Object.assign(account, {
      name: name || account.name,
      email: email || account.email,
      token,
      accountId: accountId || account.accountId,
      notes: notes || account.notes,
      updatedAt: new Date().toISOString()
    });
  } else {
    state.accounts.push({
      id: id || Date.now().toString(16),
      name: name || 'Sem nome',
      email: email || '',
      token,
      accountId: accountId || '',
      notes: notes || '',
      createdAt: new Date().toISOString()
    });
  }
  saveCloudflareState(state);
  res.json({ ok: true, accounts: state.accounts });
});

app.delete('/api/cloudflare/accounts/:id', (req, res) => {
  const state = loadCloudflareState();
  const next = state.accounts.filter((acc) => String(acc.id) !== String(req.params.id));
  saveCloudflareState({ accounts: next });
  res.json({ ok: true, accounts: next });
});

app.get('/api/cloudflare/accounts/:id/zones', async (req, res) => {
  const account = getCloudflareAccount(req.params.id);
  if (!account) return res.status(404).json({ ok: false, error: 'Conta não encontrada' });
  try {
    const data = await cloudflareRequest(account, 'GET', '/zones', null, {
      per_page: Math.min(Number(req.query.per_page) || 50, 200),
      page: Number(req.query.page) || 1
    });
    appendCloudflareLog({ accountId: account.id, type: 'zones_list', status: 'ok' });
    res.json({ ok: true, zones: data.result || [] });
  } catch (err) {
    appendCloudflareLog({ accountId: account.id, type: 'zones_list', status: 'error', error: err.message });
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.post('/api/cloudflare/accounts/:id/zones', async (req, res) => {
  const account = getCloudflareAccount(req.params.id);
  if (!account) return res.status(404).json({ ok: false, error: 'Conta não encontrada' });
  if (!account.accountId) return res.status(400).json({ ok: false, error: 'accountId obrigatório para criação de zonas' });
  const { name, jump_start = true, type = 'full', plan = 'free' } = req.body || {};
  if (!name) return res.status(400).json({ ok: false, error: 'Nome do domínio obrigatório' });
  try {
    const data = await cloudflareRequest(account, 'POST', '/zones', {
      name,
      account: { id: account.accountId },
      jump_start,
      type,
      plan: { name: plan }
    });
    appendCloudflareLog({ accountId: account.id, type: 'zone_create', target: name, status: 'ok' });
    res.json({ ok: true, zone: data.result });
  } catch (err) {
    appendCloudflareLog({ accountId: account.id, type: 'zone_create', target: name, status: 'error', error: err.message });
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.get('/api/cloudflare/accounts/:id/zones/:zoneId/records', async (req, res) => {
  const account = getCloudflareAccount(req.params.id);
  if (!account) return res.status(404).json({ ok: false, error: 'Conta não encontrada' });
  try {
    const data = await cloudflareRequest(account, 'GET', `/zones/${req.params.zoneId}/dns_records`, null, {
      per_page: Math.min(Number(req.query.per_page) || 50, 500),
      page: Number(req.query.page) || 1,
      type: req.query.type || undefined,
      name: req.query.name || undefined
    });
    res.json({ ok: true, records: data.result || [] });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.post('/api/cloudflare/accounts/:id/zones/:zoneId/records', async (req, res) => {
  const account = getCloudflareAccount(req.params.id);
  if (!account) return res.status(404).json({ ok: false, error: 'Conta não encontrada' });
  const { type, name, content, ttl = 1, priority, proxied } = req.body || {};
  if (!type || !name || !content) {
    return res.status(400).json({ ok: false, error: 'type, name e content são obrigatórios' });
  }
  try {
    const payload = { type, name, content, ttl: Number(ttl) || 1 };
    if (priority !== undefined) payload.priority = Number(priority);
    if (proxied !== undefined) payload.proxied = Boolean(proxied);
    const data = await cloudflareRequest(account, 'POST', `/zones/${req.params.zoneId}/dns_records`, payload);
    appendCloudflareLog({ accountId: account.id, type: 'record_create', target: name, status: 'ok' });
    res.json({ ok: true, record: data.result });
  } catch (err) {
    appendCloudflareLog({ accountId: account.id, type: 'record_create', target: name, status: 'error', error: err.message });
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.put('/api/cloudflare/accounts/:id/zones/:zoneId/records/:recordId', async (req, res) => {
  const account = getCloudflareAccount(req.params.id);
  if (!account) return res.status(404).json({ ok: false, error: 'Conta não encontrada' });
  try {
    const data = await cloudflareRequest(account, 'PUT', `/zones/${req.params.zoneId}/dns_records/${req.params.recordId}`, req.body || {});
    appendCloudflareLog({ accountId: account.id, type: 'record_update', target: req.params.recordId, status: 'ok' });
    res.json({ ok: true, record: data.result });
  } catch (err) {
    appendCloudflareLog({ accountId: account.id, type: 'record_update', target: req.params.recordId, status: 'error', error: err.message });
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.delete('/api/cloudflare/accounts/:id/zones/:zoneId/records/:recordId', async (req, res) => {
  const account = getCloudflareAccount(req.params.id);
  if (!account) return res.status(404).json({ ok: false, error: 'Conta não encontrada' });
  try {
    await cloudflareRequest(account, 'DELETE', `/zones/${req.params.zoneId}/dns_records/${req.params.recordId}`);
    appendCloudflareLog({ accountId: account.id, type: 'record_delete', target: req.params.recordId, status: 'ok' });
    res.json({ ok: true });
  } catch (err) {
    appendCloudflareLog({ accountId: account.id, type: 'record_delete', target: req.params.recordId, status: 'error', error: err.message });
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.get('/api/cloudflare/accounts/:id/users', async (req, res) => {
  const account = getCloudflareAccount(req.params.id);
  if (!account || !account.accountId) {
    return res.status(400).json({ ok: false, error: 'Conta não encontrada ou accountId ausente' });
  }
  try {
    const data = await cloudflareRequest(account, 'GET', `/accounts/${account.accountId}/members`, null, {
      page: Number(req.query.page) || 1,
      per_page: Math.min(Number(req.query.per_page) || 50, 100)
    });
    res.json({ ok: true, members: data.result || [] });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.post('/api/cloudflare/accounts/:id/users', async (req, res) => {
  const account = getCloudflareAccount(req.params.id);
  if (!account || !account.accountId) {
    return res.status(400).json({ ok: false, error: 'Conta não encontrada ou accountId ausente' });
  }
  const { email, role_ids = [], policies = [] } = req.body || {};
  if (!email) return res.status(400).json({ ok: false, error: 'email obrigatório' });
  try {
    const data = await cloudflareRequest(account, 'POST', `/accounts/${account.accountId}/members`, {
      email,
      roles: role_ids,
      policies
    });
    appendCloudflareLog({ accountId: account.id, type: 'user_invite', target: email, status: 'ok' });
    res.json({ ok: true, member: data.result });
  } catch (err) {
    appendCloudflareLog({ accountId: account.id, type: 'user_invite', target: email, status: 'error', error: err.message });
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.get('/api/cloudflare/accounts/:id/tunnels', async (req, res) => {
  const account = getCloudflareAccount(req.params.id);
  if (!account || !account.accountId) {
    return res.status(400).json({ ok: false, error: 'Conta não encontrada ou accountId ausente' });
  }
  try {
    const data = await cloudflareRequest(account, 'GET', `/accounts/${account.accountId}/cfd_tunnel`, null, {
      page: Number(req.query.page) || 1,
      per_page: Math.min(Number(req.query.per_page) || 20, 100)
    });
    res.json({ ok: true, tunnels: data.result || [] });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.post('/api/cloudflare/accounts/:id/tunnels', async (req, res) => {
  const account = getCloudflareAccount(req.params.id);
  if (!account || !account.accountId) {
    return res.status(400).json({ ok: false, error: 'Conta não encontrada ou accountId ausente' });
  }
  const { name, config } = req.body || {};
  if (!name) return res.status(400).json({ ok: false, error: 'nome do túnel obrigatório' });
  try {
    const data = await cloudflareRequest(account, 'POST', `/accounts/${account.accountId}/cfd_tunnel`, {
      name,
      config: config || {}
    });
    appendCloudflareLog({ accountId: account.id, type: 'tunnel_create', target: name, status: 'ok' });
    res.json({ ok: true, tunnel: data.result });
  } catch (err) {
    appendCloudflareLog({ accountId: account.id, type: 'tunnel_create', target: name, status: 'error', error: err.message });
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.delete('/api/cloudflare/accounts/:id/tunnels/:tunnelId', async (req, res) => {
  const account = getCloudflareAccount(req.params.id);
  if (!account || !account.accountId) {
    return res.status(400).json({ ok: false, error: 'Conta não encontrada ou accountId ausente' });
  }
  try {
    await cloudflareRequest(account, 'DELETE', `/accounts/${account.accountId}/cfd_tunnel/${req.params.tunnelId}`);
    appendCloudflareLog({ accountId: account.id, type: 'tunnel_delete', target: req.params.tunnelId, status: 'ok' });
    res.json({ ok: true });
  } catch (err) {
    appendCloudflareLog({ accountId: account.id, type: 'tunnel_delete', target: req.params.tunnelId, status: 'error', error: err.message });
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.get('/api/cloudflare/accounts/:id/logs', async (req, res) => {
  const account = getCloudflareAccount(req.params.id);
  if (!account || !account.accountId) {
    return res.status(400).json({ ok: false, error: 'Conta não encontrada ou accountId ausente' });
  }
  try {
    const params = {};
    if (req.query.direction) params.direction = req.query.direction;
    if (req.query.page) params.page = req.query.page;
    if (req.query.per_page) params.per_page = Math.min(Number(req.query.per_page), 100);
    if (req.query.action) params.action = req.query.action;
    const data = await cloudflareRequest(account, 'GET', `/accounts/${account.accountId}/audit/logs`, null, params);
    res.json({ ok: true, logs: data.result || [] });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.get('/api/cloudflare/logs/local', (_req, res) => {
  res.json({ ok: true, logs: loadJson(cloudflareLogFile, []) });
});

app.get('/api/opnsense/servers', (_req, res) => {
  const data = loadOpnsenseServers();
  res.json({ ok: true, servers: data.servers });
});

app.post('/api/opnsense/servers', (req, res) => {
  const data = loadOpnsenseServers();
  const { id, name, baseUrl, key, secret, verifyTls = false, notes } = req.body || {};
  if (!baseUrl || !key || !secret) {
    return res.status(400).json({ ok: false, error: 'baseUrl, key e secret são obrigatórios' });
  }
  let server = null;
  if (id) server = data.servers.find((srv) => String(srv.id) === String(id));
  if (server) {
    Object.assign(server, {
      name: name || server.name,
      baseUrl,
      key,
      secret,
      verifyTls: Boolean(verifyTls),
      notes: notes || server.notes,
      updatedAt: new Date().toISOString()
    });
  } else {
    data.servers.push({
      id: id || Date.now().toString(16),
      name: name || baseUrl,
      baseUrl,
      key,
      secret,
      verifyTls: Boolean(verifyTls),
      notes: notes || '',
      createdAt: new Date().toISOString()
    });
  }
  saveOpnsenseServers(data);
  res.json({ ok: true, servers: data.servers });
});

app.delete('/api/opnsense/servers/:id', (req, res) => {
  const data = loadOpnsenseServers();
  const next = data.servers.filter((srv) => String(srv.id) !== String(req.params.id));
  saveOpnsenseServers({ servers: next });
  res.json({ ok: true, servers: next });
});

app.post('/api/opnsense/:id/request', async (req, res) => {
  const server = getOpnsenseServer(req.params.id);
  if (!server) return res.status(404).json({ ok: false, error: 'Servidor não encontrado' });
  const { method = 'GET', endpoint = '/api/core/system/information', payload } = req.body || {};
  try {
    const data = await opnsenseRequest(server, method, endpoint, payload);
    res.json({ ok: true, result: data });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.get('/api/opnsense/:id/users', async (req, res) => {
  const server = getOpnsenseServer(req.params.id);
  if (!server) return res.status(404).json({ ok: false, error: 'Servidor não encontrado' });
  try {
    const data = await opnsenseRequest(server, 'GET', '/api/core/system/user/search');
    res.json({ ok: true, users: data.rows || data.result || data });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.post('/api/opnsense/:id/users', async (req, res) => {
  const server = getOpnsenseServer(req.params.id);
  if (!server) return res.status(404).json({ ok: false, error: 'Servidor não encontrado' });
  const payload = req.body || {};
  if (!payload || !payload.username) {
    return res.status(400).json({ ok: false, error: 'username obrigatório' });
  }
  try {
    const data = await opnsenseRequest(server, 'POST', '/api/core/system/user/adduser', payload);
    res.json({ ok: true, result: data });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.delete('/api/opnsense/:id/users/:uuid', async (req, res) => {
  const server = getOpnsenseServer(req.params.id);
  if (!server) return res.status(404).json({ ok: false, error: 'Servidor não encontrado' });
  try {
    await opnsenseRequest(server, 'POST', `/api/core/system/user/deluser/${req.params.uuid}`);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.get('/api/opnsense/:id/vpn/openvpn/status', async (req, res) => {
  const server = getOpnsenseServer(req.params.id);
  if (!server) return res.status(404).json({ ok: false, error: 'Servidor não encontrado' });
  try {
    const data = await opnsenseRequest(server, 'GET', '/api/openvpn/status');
    res.json({ ok: true, status: data });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.post('/api/opnsense/:id/vpn/openvpn/reconfigure', async (req, res) => {
  const server = getOpnsenseServer(req.params.id);
  if (!server) return res.status(404).json({ ok: false, error: 'Servidor não encontrado' });
  try {
    const data = await opnsenseRequest(server, 'POST', '/api/openvpn/service/reconfigure', req.body || {});
    res.json({ ok: true, result: data });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.get('/api/opnsense/:id/firewall/rules', async (req, res) => {
  const server = getOpnsenseServer(req.params.id);
  if (!server) return res.status(404).json({ ok: false, error: 'Servidor não encontrado' });
  try {
    const data = await opnsenseRequest(server, 'GET', '/api/filter/rule/search');
    res.json({ ok: true, rules: data.rows || data.result || data });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.post('/api/opnsense/:id/firewall/rules', async (req, res) => {
  const server = getOpnsenseServer(req.params.id);
  if (!server) return res.status(404).json({ ok: false, error: 'Servidor não encontrado' });
  try {
    const data = await opnsenseRequest(server, 'POST', '/api/filter/rule/add', req.body || {});
    res.json({ ok: true, result: data });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.post('/api/opnsense/:id/firewall/apply', async (req, res) => {
  const server = getOpnsenseServer(req.params.id);
  if (!server) return res.status(404).json({ ok: false, error: 'Servidor não encontrado' });
  try {
    const data = await opnsenseRequest(server, 'POST', '/api/filter/apply');
    res.json({ ok: true, result: data });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.get('/api/opnsense/:id/logs/system', async (req, res) => {
  const server = getOpnsenseServer(req.params.id);
  if (!server) return res.status(404).json({ ok: false, error: 'Servidor não encontrado' });
  try {
    const data = await opnsenseRequest(server, 'GET', '/api/diagnostics/system/log/primary/get');
    res.json({ ok: true, logs: data.log || data });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.get('/api/opnsense/:id/logs/firewall', async (req, res) => {
  const server = getOpnsenseServer(req.params.id);
  if (!server) return res.status(404).json({ ok: false, error: 'Servidor não encontrado' });
  try {
    const data = await opnsenseRequest(server, 'GET', '/api/diagnostics/firewall/log/get');
    res.json({ ok: true, logs: data.log || data });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.get('/api/opnsense/:id/packages', async (req, res) => {
  const server = getOpnsenseServer(req.params.id);
  if (!server) return res.status(404).json({ ok: false, error: 'Servidor não encontrado' });
  try {
    const data = await opnsenseRequest(server, 'GET', '/api/core/firmware/status');
    res.json({ ok: true, status: data });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.post('/api/opnsense/:id/packages/upgrade', async (req, res) => {
  const server = getOpnsenseServer(req.params.id);
  if (!server) return res.status(404).json({ ok: false, error: 'Servidor não encontrado' });
  try {
    const data = await opnsenseRequest(server, 'POST', '/api/core/firmware/upgrade', req.body || {});
    res.json({ ok: true, result: data });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.get('/api/opnsense/:id/interfaces', async (req, res) => {
  const server = getOpnsenseServer(req.params.id);
  if (!server) return res.status(404).json({ ok: false, error: 'Servidor não encontrado' });
  try {
    const data = await opnsenseRequest(server, 'GET', '/api/interface/overview');
    res.json({ ok: true, interfaces: data || [] });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.get('/api/opnsense/:id/routes', async (req, res) => {
  const server = getOpnsenseServer(req.params.id);
  if (!server) return res.status(404).json({ ok: false, error: 'Servidor não encontrado' });
  try {
    const data = await opnsenseRequest(server, 'GET', '/api/routes/status');
    res.json({ ok: true, routes: data || [] });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.post('/api/smtp/test', async (req, res) => {
  const { host, port, secure, user, pass, from, to, subject, text } = req.body || {};
  if (!host || !to) return res.status(400).json({ error: 'host e to obrigatórios' });
  try {
    const transporter = nodemailer.createTransport({
      host,
      port: Number(port) || 587,
      secure: Boolean(secure),
      auth: user ? { user, pass } : undefined
    });
    const info = await transporter.sendMail({
      from: from || user || 'fazai@localhost',
      to,
      subject: subject || 'Teste SMTP FazAI',
      text: text || 'Mensagem de teste FazAI Ops Console.'
    });
    res.json({ ok: true, info });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/telegram/send', async (req, res) => {
  const { botToken, chatId, text } = req.body || {};
  if (!botToken || !chatId || !text) return res.status(400).json({ error: 'botToken, chatId e text obrigatórios' });
  try {
    const resp = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text })
    });
    const data = await resp.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/instagram/send', async (req, res) => {
  const { accessToken, igUserId, recipientId, text } = req.body || {};
  if (!accessToken || !igUserId || !recipientId || !text) {
    return res.status(400).json({ error: 'accessToken, igUserId, recipientId, text obrigatórios' });
  }
  try {
    const url = `https://graph.facebook.com/v18.0/${igUserId}/messages`;
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        recipient: { id: recipientId },
        message: { text },
        messaging_type: 'RESPONSE',
        access_token: accessToken
      })
    });
    const data = await resp.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/voip/call', async (req, res) => {
  const { accountSid, authToken, from, to, twiml } = req.body || {};
  if (!accountSid || !authToken || !from || !to) {
    return res.status(400).json({ error: 'accountSid, authToken, from, to obrigatórios' });
  }
  try {
    const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Calls.json`;
    const params = new URLSearchParams({ From: from, To: to, Twiml: twiml || '<Response><Say>FazAI alerta.</Say></Response>' });
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64')
      },
      body: params
    });
    const data = await resp.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/settings', (_req, res) => {
  res.json(loadSettings());
});

app.post('/api/settings', (req, res) => {
  const incoming = req.body || {};
  const current = loadSettings();
  const updated = { ...current, ...incoming };
  updated.alerts = mergeAlertSettings(current.alerts || defaultSettings.alerts, incoming.alerts);
  saveSettings(updated);
  res.json({ ok: true, settings: updated });
});

app.get('/api/notes', (_req, res) => {
  res.json({ ok: true, notes: loadNotes() });
});

app.post('/api/notes', (req, res) => {
  const { text } = req.body || {};
  if (!text) return res.status(400).json({ error: 'text obrigatório' });
  const notes = loadNotes();
  const note = { id: Date.now(), text, createdAt: new Date().toISOString() };
  notes.push(note);
  saveNotes(notes);
  res.json({ ok: true, note });
});

app.delete('/api/notes/:id', (req, res) => {
  const id = Number(req.params.id);
  const notes = loadNotes().filter((n) => n.id !== id);
  saveNotes(notes);
  res.json({ ok: true });
});

app.post('/api/alerts/notify', async (req, res) => {
  const { subject = 'Alerta FazAI', message = '', severity = 'warning', target, details } = req.body || {};
  const settings = loadSettings();
  const alerts = settings.alerts || defaultSettings.alerts;
  const results = {};
  try {
    if (alerts.smtp?.enabled) {
      results.smtp = await sendSMTPAlert(alerts.smtp, { subject, text: message });
    }
    if (alerts.telegram?.enabled) {
      results.telegram = await sendTelegramAlerts(alerts.telegram, `${subject}
${message}`);
    }
    if (alerts.voip?.enabled) {
      results.voip = await sendVoipAlerts(alerts.voip, alerts.voip.twiml || `<Response><Say>${message || 'Alerta FazAI'}</Say></Response>`);
    }
    logAlert({ subject, message, severity, target, details });
    res.json({ ok: true, results });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message, results });
  }
});

app.post('/api/gemma/generate', async (req, res) => {
  const { prompt } = req.body || {};
  if (!prompt) return res.status(400).json({ error: 'prompt obrigatório' });
  const script = [
    'import sys',
    'import json',
    'import gemma_native',
    "text = json.loads(sys.stdin.read())",
    "prompt = text.get('prompt', '')",
    'print(gemma_native.generate(prompt))'
  ].join('\n');
  const env = { ...process.env, PYTHONPATH: process.env.PYTHONPATH ? process.env.PYTHONPATH + ':/home/rluft/fazai' : '/home/rluft/fazai' };
  const proc = spawn('python3', ['-c', script], { env });
  proc.stdin.write(JSON.stringify({ prompt }));
  proc.stdin.end();
  let stdout = '';
  let stderr = '';
  proc.stdout.on('data', (d) => (stdout += d.toString()));
  proc.stderr.on('data', (d) => (stderr += d.toString()));
  proc.on('close', (code) => {
    if (code === 0) res.json({ ok: true, output: stdout.trim() });
    else res.status(500).json({ ok: false, error: stderr || 'erro gemma' });
  });
  proc.on('error', (err) => res.status(500).json({ error: err.message }));
});

app.post('/api/snmp/get', async (req, res) => {
  const { host, community = 'public', oid = '.1.3.6.1.2.1.1.1.0' } = req.body || {};
  if (!host) return res.status(400).json({ error: 'host obrigatório' });
  const binary = fs.existsSync('/usr/bin/snmpget') ? 'snmpget' : null;
  if (!binary) return res.status(500).json({ error: 'snmpget não encontrado no host' });
  try {
    const result = await runCommand(binary, ['-v2c', '-c', community, host, oid]);
    res.json({ ok: true, output: result.stdout });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.stderr || err.stdout || err.error });
  }
});

app.get('/api/docker/ps', async (_req, res) => {
  try {
    const result = await execShell('docker ps --format "{{json .}}"');
    const lines = result.stdout.trim().split('\n').filter(Boolean).map((line) => {
      try { return JSON.parse(line); } catch { return line; }
    });
    res.json({ ok: true, containers: lines });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.stderr || err.stdout || err.error });
  }
});

app.get('/api/docker/metrics', async (_req, res) => {
  try {
    const statsResult = await execShell('docker stats --no-stream --format "{{json .}}"');
    const lines = statsResult.stdout.trim().split('\n').filter(Boolean);
    if (!lines.length) {
      return res.json({ ok: true, containers: [] });
    }
    const containers = lines.map((line) => {
      try {
        return JSON.parse(line.trim());
      } catch {
        return null;
      }
    }).filter(Boolean);

    const ids = containers.map((item) => item.ID || item.Container || item.Name).filter(Boolean);
    let inspectData = [];
    if (ids.length) {
      try {
        const inspectResult = await execShell(`docker inspect ${ids.join(' ')}`);
        inspectData = JSON.parse(inspectResult.stdout || '[]');
      } catch (err) {
        console.warn('docker inspect falhou', err.stderr || err.error || err.message);
      }
    }
    const inspectMap = new Map();
    inspectData.forEach((entry) => {
      if (entry && entry.Id) inspectMap.set(entry.Id, entry);
      if (entry && entry.Name) inspectMap.set(entry.Name.replace(/^\//, ''), entry);
    });

    const result = containers.map((container) => {
      const id = container.ID || container.Container;
      const name = container.Name || container.Names || id;
      const inspect = inspectMap.get(id) || inspectMap.get(name) || {};
      const [memUsageRaw, memLimitRaw] = parsePair(container.MemUsage || '');
      const [netRxRaw, netTxRaw] = parsePair(container.NetIO || '');
      const [blockReadRaw, blockWriteRaw] = parsePair(container.BlockIO || '');
      const cpuPerc = Number(String(container.CPUPerc || '').replace('%', '').trim()) || 0;
      const memPerc = Number(String(container.MemPerc || '').replace('%', '').trim()) || 0;

      return {
        id,
        name,
        image: container.Image,
        state: inspect.State?.Status || container.State,
        status: inspect.State?.Status || container.Status,
        cpu: {
          raw: container.CPUPerc,
          percent: cpuPerc
        },
        memory: {
          raw: container.MemUsage,
          percent: memPerc,
          usageBytes: parseSize(memUsageRaw),
          limitBytes: parseSize(memLimitRaw)
        },
        network: {
          raw: container.NetIO,
          rxBytes: parseSize(netRxRaw),
          txBytes: parseSize(netTxRaw)
        },
        io: {
          raw: container.BlockIO,
          readBytes: parseSize(blockReadRaw),
          writeBytes: parseSize(blockWriteRaw)
        },
        pids: Number(container.PIDs) || inspect.State?.Pid || 0,
        ip: inspect.NetworkSettings?.IPAddress || '',
        hostname: inspect.Config?.Hostname || '',
        user: inspect.Config?.User || '',
        createdAt: inspect.Created || null,
        command: inspect.Config?.Cmd || [],
        labels: inspect.Config?.Labels || {}
      };
    });

    res.json({ ok: true, containers: result });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.stderr || err.stdout || err.error || err.message });
  }
});

app.post('/api/docker/:action', async (req, res) => {
  const { action } = req.params;
  const { container } = req.body || {};
  if (!container) return res.status(400).json({ error: 'container obrigatório' });
  const allowed = ['start', 'stop', 'restart', 'logs'];
  if (!allowed.includes(action)) return res.status(400).json({ error: 'ação não suportada' });
  try {
    let output;
    if (action === 'logs') {
      const result = await execShell(`docker logs --tail 200 ${container}`);
      output = result.stdout;
    } else {
      const result = await execShell(`docker ${action} ${container}`);
      output = result.stdout;
    }
    res.json({ ok: true, output });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.stderr || err.stdout || err.error });
  }
});

const iloFile = path.join(__dirname, 'data', 'ilo-drac.json');
function loadILOData() {
  try {
    return JSON.parse(fs.readFileSync(iloFile, 'utf-8'));
  } catch {
    return [];
  }
}

function saveILOData(data) {
  fs.mkdirSync(path.dirname(iloFile), { recursive: true });
  fs.writeFileSync(iloFile, JSON.stringify(data, null, 2));
}

app.get('/api/ilo-drac', (_req, res) => {
  res.json({ ok: true, entries: loadILOData() });
});

app.post('/api/ilo-drac', (req, res) => {
  const { name, host, user, password, type } = req.body || {};
  if (!name || !host) return res.status(400).json({ error: 'name e host obrigatórios' });
  const entries = loadILOData();
  const existing = entries.find((e) => e.name === name);
  if (existing) {
    Object.assign(existing, { host, user, password, type });
  } else {
    entries.push({ id: Date.now(), name, host, user, password, type });
  }
  saveILOData(entries);
  res.json({ ok: true });
});

app.delete('/api/ilo-drac/:id', (req, res) => {
  const id = Number(req.params.id);
  const entries = loadILOData().filter((e) => e.id !== id);
  saveILOData(entries);
  res.json({ ok: true });
});

app.post('/api/crawler/network', async (req, res) => {
  const { range = '192.168.0.0/24', mode = 'quick' } = req.body || {};
  const args = ['-n'];
  if (mode === 'quick') args.push('-sn');
  args.push(range);
  try {
    const result = await runCommand('nmap', args);
    res.json({ ok: true, output: result.stdout });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.stderr || err.stdout || err.error });
  }
});

app.post('/api/rag/upload', upload.array('files', 12), async (req, res) => {
  try {
    const collection = req.body.collection || DEFAULT_RAG_COLLECTION;
    const tags = (req.body.tags || '')
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean);

    const documents = [];
    (req.files || []).forEach((file) => {
      const text = bufferToText(file.originalname, file.buffer);
      if (!text) return;
      documents.push({
        text,
        source: file.originalname,
        title: req.body[`title_${file.originalname}`] || file.originalname,
        tags,
        extra: { size: file.size, mimetype: file.mimetype }
      });
    });

    if (req.body.text) {
      const inline = String(req.body.text).trim();
      if (inline) {
        documents.push({
          text: inline,
          source: req.body.source || 'manual_input',
          title: req.body.title || 'Conteúdo manual',
          tags
        });
      }
    }

    if (!documents.length) {
      return res.status(400).json({ ok: false, error: 'Nenhum conteúdo processado' });
    }

    const result = await ingestDocuments(documents, { collection, tags });
    res.json({ ok: true, ...result });
  } catch (err) {
    console.error('rag upload erro', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.post('/api/rag/text', async (req, res) => {
  const { text, title, source, tags = [], collection } = req.body || {};
  if (!text || !String(text).trim()) {
    return res.status(400).json({ ok: false, error: 'text obrigatório' });
  }
  try {
    const tagList = Array.isArray(tags) ? tags : String(tags)
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
    const doc = {
      text: String(text),
      source: source || 'manual_input',
      title: title || 'Conteúdo manual',
      tags: tagList
    };
    const result = await ingestDocuments([doc], { collection: collection || DEFAULT_RAG_COLLECTION, tags: tagList });
    res.json({ ok: true, ...result });
  } catch (err) {
    console.error('rag text erro', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.get('/api/rag/catalog', (_req, res) => {
  try {
    const content = fs.readFileSync(ragCatalogFile, 'utf-8');
    res.json({ ok: true, entries: JSON.parse(content) });
  } catch {
    res.json({ ok: true, entries: [] });
  }
});

app.get('/api/rag/collections', async (_req, res) => {
  try {
    const baseUrl = QDRANT_URL.replace(/\/$/, '');
    const { data } = await axios.get(`${baseUrl}/collections`, { timeout: 5000 });
    res.json({ ok: true, collections: data.collections || [] });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.post('/api/rag/search', async (req, res) => {
  const { collection, query, limit = 5, filterTags } = req.body || {};
  if (!query) return res.status(400).json({ ok: false, error: 'query obrigatória' });
  const targetCollection = collection || DEFAULT_RAG_COLLECTION;
  try {
    await ensureQdrantCollection(targetCollection, 384);
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }

  try {
    const vector = textToEmbedding(query, 384);
    const baseUrl = QDRANT_URL.replace(/\/$/, '');
    const body = {
      vector,
      limit: Math.max(1, Math.min(Number(limit) || 5, 20)),
      with_payload: true,
      with_vectors: false
    };
    if (filterTags && filterTags.length) {
      const tags = Array.isArray(filterTags) ? filterTags : String(filterTags)
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);
      if (tags.length) {
        body.filter = {
          must: tags.map((tag) => ({
            key: 'tags',
            match: { value: tag }
          }))
        };
      }
    }
    const { data } = await axios.post(`${baseUrl}/collections/${targetCollection}/points/search`, body, { timeout: 15000 });
    res.json({ ok: true, collection: targetCollection, results: data.result || [] });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`FazAI Ops backend rodando em http://localhost:${PORT}`);
});
