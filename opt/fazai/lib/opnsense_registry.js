#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const axios = require('axios');
const https = require('https');

const REG_FILE = '/etc/fazai/opnsense.json';
const SEC_DIR = '/etc/fazai/secrets/opnsense';

function ensureDirs() {
  try { fs.mkdirSync(path.dirname(REG_FILE), { recursive: true }); } catch (_) {}
  try { fs.mkdirSync(SEC_DIR, { recursive: true, mode: 0o700 }); fs.chmodSync(SEC_DIR, 0o700); } catch (_) {}
}

function loadJsonSafe(file) {
  try { if (!fs.existsSync(file)) return {}; return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (_) { return {}; }
}

function saveJsonSafe(file, obj, mode) {
  const tmp = file + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(obj, null, 2));
  fs.renameSync(tmp, file);
  if (mode) fs.chmodSync(file, mode);
}

function genId(name) {
  return crypto.createHash('md5').update(`${name}:${Date.now()}:${Math.random()}`).digest('hex').slice(0, 16);
}

function secPath(id) { return path.join(SEC_DIR, `${id}.json`); }

class OPNRegistry {
  constructor() {
    ensureDirs();
    this._reg = loadJsonSafe(REG_FILE);
    if (!this._reg.firewalls) this._reg.firewalls = {};
  }

  list() {
    return Object.values(this._reg.firewalls).map(({ id, name, base_url, verify_tls, tags, created_at, updated_at, last_seen, last_error, version }) => ({ id, name, base_url, verify_tls, tags, created_at, updated_at, last_seen, last_error, version }));
  }

  get(id) {
    return this._reg.firewalls[id] || null;
  }

  getSecrets(id) {
    const p = secPath(id);
    if (!fs.existsSync(p)) return null;
    try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (_) { return null; }
  }

  async add({ name, base_url, api_key, api_secret, verify_tls = true, tags = [] }) {
    if (!name || !base_url || !api_key || !api_secret) throw new Error('Campos obrigatórios: name, base_url, api_key, api_secret');
    const id = genId(name);
    const now = new Date().toISOString();
    const entry = { id, name, base_url: base_url.replace(/\/$/, ''), verify_tls: !!verify_tls, tags, created_at: now, updated_at: now };
    this._reg.firewalls[id] = entry;
    ensureDirs();
    saveJsonSafe(secPath(id), { api_key, api_secret }, 0o600);
    saveJsonSafe(REG_FILE, this._reg);
    // test connection
    const ok = await this.health(id).catch(() => null);
    return { id, tested: !!ok, info: ok || null };
  }

  async health(id) {
    const fw = this.get(id);
    if (!fw) throw new Error('Firewall não encontrado');
    const sec = this.getSecrets(id);
    if (!sec) throw new Error('Segredos ausentes');
    const agent = fw.verify_tls ? undefined : new https.Agent({ rejectUnauthorized: false });
    const auth = Buffer.from(`${sec.api_key}:${sec.api_secret}`).toString('base64');
    const headers = { Authorization: `Basic ${auth}` };
    const tryGet = async (p) => axios.get(`${fw.base_url}${p}`, { headers, httpsAgent: agent, timeout: 10000 }).then(r => r.data);
    let info = null;
    try {
      // Prefer firmware/status (tem funcionado mesmo quando system/* não está disponível)
      info = await tryGet('/api/core/firmware/status');
    } catch (_) {
      try { info = await tryGet('/api/core/system/info'); }
      catch (_) {
        try { info = await tryGet('/api/core/system/version'); }
        catch (e1) {
          // Fallback: menu search (confirma autenticação e disponibilidade da API mesmo sem permissões)
          try { info = await tryGet('/api/core/menu/search'); }
          catch (e2) {
            fw.last_error = { when: new Date().toISOString(), message: String(e2?.message || e2) };
            this._reg.firewalls[id] = fw; saveJsonSafe(REG_FILE, this._reg);
            throw e2;
          }
        }
      }
    }
    // update registry health
    fw.last_seen = new Date().toISOString();
    try {
      // Normaliza versão a partir de várias respostas possíveis
      fw.version = info?.version || info?.product_version || info?.product?.product_version || fw.version;
    } catch (_) {}
    fw.last_error = null;
    this._reg.firewalls[id] = fw; saveJsonSafe(REG_FILE, this._reg);
    return info;
  }

  async interfaces(id) {
    const fw = this.get(id);
    const sec = this.getSecrets(id);
    if (!fw || !sec) throw new Error('Firewall/segredo ausente');
    const agent = fw.verify_tls ? undefined : new https.Agent({ rejectUnauthorized: false });
    const auth = Buffer.from(`${sec.api_key}:${sec.api_secret}`).toString('base64');
    const headers = { Authorization: `Basic ${auth}` };
    const endpoints = ['/api/interfaces/overview', '/api/diagnostics/interface/list'];
    for (const ep of endpoints) {
      try { const { data } = await axios.get(`${fw.base_url}${ep}`, { headers, httpsAgent: agent, timeout: 10000 }); return data; } catch (_) {}
    }
    throw new Error('Interfaces endpoint não disponível');
  }
}

module.exports = { OPNRegistry };
