#!/usr/bin/env node

/**
 * FazAI Helper - Fallback para interpretação de comandos
 * Este arquivo serve como fallback quando outros provedores de IA falham
 */

const { exec } = require('child_process');

// Comandos simples de fallback baseados em palavras-chave
const fallbackCommands = {
  'status': 'systemctl status',
  'start': 'systemctl start',
  'stop': 'systemctl stop',
  'restart': 'systemctl restart',
  'install': 'apt-get install -y',
  'update': 'apt-get update',
  'upgrade': 'apt-get upgrade -y',
  'remove': 'apt-get remove -y',
  'list': 'ls -la',
  'process': 'ps aux',
  'memory': 'free -h',
  'disk': 'df -h',
  'network': 'ip addr show',
  'service': 'systemctl',
  'log': 'journalctl',
  'user': 'useradd',
  'group': 'groupadd',
  'permission': 'chmod',
  'owner': 'chown',
  'copy': 'cp',
  'move': 'mv',
  'delete': 'rm',
  'create': 'mkdir',
  'view': 'cat',
  'edit': 'nano',
  'search': 'grep',
  'find': 'find',
  'grep': 'grep',
  'tar': 'tar',
  'zip': 'zip',
  'unzip': 'unzip',
  'wget': 'wget',
  'curl': 'curl',
  'ping': 'ping',
  'ssh': 'ssh',
  'scp': 'scp',
  'rsync': 'rsync',
  'cron': 'crontab',
  'backup': 'tar -czf',
  'monitor': 'htop',
  'top': 'top',
  'kill': 'kill',
  'signal': 'kill -HUP',
  'port': 'netstat -tulpn',
  'firewall': 'ufw',
  'iptables': 'iptables',
  'route': 'ip route',
  'dns': 'nslookup',
  'dig': 'dig',
  'host': 'host',
  'whois': 'whois',
  'ssl': 'openssl',
  'cert': 'openssl x509',
  'key': 'openssl genrsa',
  'hash': 'sha256sum',
  'md5': 'md5sum',
  'compress': 'gzip',
  'decompress': 'gunzip',
  'mount': 'mount',
  'umount': 'umount',
  'fstab': 'cat /etc/fstab',
  'passwd': 'passwd',
  'sudo': 'sudo',
  'su': 'su',
  'who': 'who',
  'w': 'w',
  'last': 'last',
  'history': 'history',
  'alias': 'alias',
  'export': 'export',
  'source': 'source',
  'echo': 'echo',
  'printf': 'printf',
  'date': 'date',
  'time': 'time',
  'sleep': 'sleep',
  'wait': 'wait',
  'test': 'test',
  'if': 'if',
  'for': 'for',
  'while': 'while',
  'case': 'case',
  'function': 'function',
  'return': 'return',
  'exit': 'exit',
  'break': 'break',
  'continue': 'continue',
  'shift': 'shift',
  'set': 'set',
  'unset': 'unset',
  'read': 'read',
  'select': 'select',
  'trap': 'trap',
  'ulimit': 'ulimit',
  'umask': 'umask',
  'cd': 'cd',
  'pwd': 'pwd',
  'pushd': 'pushd',
  'popd': 'popd',
  'dirs': 'dirs',
  'jobs': 'jobs',
  'bg': 'bg',
  'fg': 'fg',
  'kill': 'kill',
  'wait': 'wait',
  'disown': 'disown',
  'suspend': 'suspend',
  'logout': 'logout',
  'exec': 'exec',
  'eval': 'eval',
  'command': 'command',
  'type': 'type',
  'hash': 'hash',
  'builtin': 'builtin',
  'enable': 'enable',
  'help': 'help'
};

/**
 * Interpreta um comando usando fallback simples
 * @param {string} command - Comando a ser interpretado
 * @returns {string} - Comando interpretado
 */
function interpretCommand(command) {
  if (!command || typeof command !== 'string') {
    return 'echo "Comando inválido"';
  }

  const words = command.toLowerCase().trim().split(/\s+/);
  
  // Se for uma pergunta simples, retorna echo
  if (command.includes('?') || command.startsWith('_')) {
    return `echo "${command.replace(/^_/, '').replace(/\?$/, '')}"`;
  }

  // Procura por palavras-chave conhecidas
  for (const [keyword, fallback] of Object.entries(fallbackCommands)) {
    if (words.some(word => word.includes(keyword))) {
      return fallback;
    }
  }

  // Se não encontrar palavra-chave, retorna o comando original
  return command;
}

// Se executado diretamente
if (require.main === module) {
  const command = process.argv[2];
  if (!command) {
    console.error('Uso: node fazai_helper.js <comando>');
    process.exit(1);
  }

  const interpreted = interpretCommand(command);
  console.log(interpreted);
}

module.exports = {
  interpretCommand
};