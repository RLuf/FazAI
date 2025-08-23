#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

function ensureDir(p) { try { fs.mkdirSync(p, { recursive: true }); } catch (_) {} }
function ts() { const d = new Date(); return d.toISOString().replace(/[:-]/g,'').replace(/\..+/, '').replace('T','_'); }

function tarGz(outFile, items) {
  const args = ['-czf', outFile, '--warning=no-file-changed'];
  items.forEach(i => args.push('-C', '/', i.replace(/^\//,'')));
  const r = spawnSync('tar', args, { encoding: 'utf8' });
  if (r.status !== 0) throw new Error(r.stderr || 'tar failed');
}

function backupPaths(label, paths) {
  const base = '/var/backups/fazai';
  const dir = path.join(base, label);
  ensureDir(dir);
  const stamp = ts();
  const out = path.join(dir, `${label}-${stamp}.tar.gz`);
  const existing = (paths || []).filter(p => fs.existsSync(p));
  if (existing.length === 0) {
    // create empty note
    fs.writeFileSync(path.join(dir, `EMPTY_${stamp}.txt`), `No paths to backup for label=${label} at ${new Date().toISOString()}\n`);
    return { ok: true, file: null, note: 'no_paths' };
  }
  tarGz(out, existing);
  return { ok: true, file: out, count: existing.length };
}

module.exports = { backupPaths };

