/*
 * FazAI - Orquestrador Inteligente de Automação
 * Autor: Roger Luft
 * Licença: Creative Commons Attribution 4.0 International (CC BY 4.0)
 * https://creativecommons.org/licenses/by/4.0/
 */

const os = require('os');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

/**
 * Informações do plugin
 */
const pluginInfo = {
  name: 'system_info',
  description: 'Fornece informações sobre o sistema',
  version: '1.0.0',
  author: 'FazAI Team'
};

/**
 * Obtém informações básicas do sistema
 * @returns {Promise<object>} - Informações do sistema
 */
async function getSystemInfo() {
  const cpus = os.cpus();
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totalMem - freeMem;
  const memPercent = ((usedMem / totalMem) * 100).toFixed(2);
  
  return {
    hostname: os.hostname(),
    platform: os.platform(),
    release: os.release(),
    uptime: formatUptime(os.uptime()),
    cpus: {
      model: cpus[0].model,
      cores: cpus.length,
      speed: `${cpus[0].speed} MHz`
    },
    memory: {
      total: formatBytes(totalMem),
      free: formatBytes(freeMem),
      used: formatBytes(usedMem),
      percent: `${memPercent}%`
    },
    network: getNetworkInterfaces()
  };
}

/**
 * Obtém lista de processos em execução
 * @returns {Promise<Array>} - Lista de processos
 */
async function getProcesses() {
  try {
    const { stdout } = await execPromise('ps -eo pid,ppid,user,%cpu,%mem,stat,start,time,command --sort=-%cpu | head -n 11');
    
    const lines = stdout.trim().split('\n');
    const header = lines[0];
    const processes = lines.slice(1).map(line => {
      const parts = line.trim().split(/\s+/);
      const pid = parts[0];
      const ppid = parts[1];
      const user = parts[2];
      const cpu = parts[3];
      const mem = parts[4];
      const stat = parts[5];
      const start = parts[6];
      const time = parts[7];
      const command = parts.slice(8).join(' ');
      
      return { pid, ppid, user, cpu, mem, stat, start, time, command };
    });
    
    return { header, processes };
  } catch (err) {
    throw new Error(`Erro ao obter processos: ${err.message}`);
  }
}

/**
 * Obtém informações de uso de disco
 * @returns {Promise<Array>} - Informações de uso de disco
 */
async function getDiskUsage() {
  try {
    const { stdout } = await execPromise('df -h --output=source,fstype,size,used,avail,pcent,target -x tmpfs -x devtmpfs');
    
    const lines = stdout.trim().split('\n');
    const header = lines[0];
    const disks = lines.slice(1).map(line => {
      const parts = line.trim().split(/\s+/);
      const source = parts[0];
      const fstype = parts[1];
      const size = parts[2];
      const used = parts[3];
      const avail = parts[4];
      const pcent = parts[5];
      const target = parts.slice(6).join(' ');
      
      return { source, fstype, size, used, avail, pcent, target };
    });
    
    return { header, disks };
  } catch (err) {
    throw new Error(`Erro ao obter uso de disco: ${err.message}`);
  }
}

/**
 * Obtém informações de interfaces de rede
 * @returns {object} - Informações de interfaces de rede
 */
function getNetworkInterfaces() {
  const interfaces = os.networkInterfaces();
  const result = {};
  
  Object.keys(interfaces).forEach(name => {
    result[name] = interfaces[name].map(iface => ({
      address: iface.address,
      netmask: iface.netmask,
      family: iface.family,
      mac: iface.mac,
      internal: iface.internal
    }));
  });
  
  return result;
}

/**
 * Formata bytes para unidades legíveis
 * @param {number} bytes - Número de bytes
 * @returns {string} - Valor formatado
 */
function formatBytes(bytes) {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let value = bytes;
  let unitIndex = 0;
  
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex++;
  }
  
  return `${value.toFixed(2)} ${units[unitIndex]}`;
}

/**
 * Formata tempo de atividade em formato legível
 * @param {number} seconds - Tempo em segundos
 * @returns {string} - Tempo formatado
 */
function formatUptime(seconds) {
  const days = Math.floor(seconds / 86400);
  seconds %= 86400;
  
  const hours = Math.floor(seconds / 3600);
  seconds %= 3600;
  
  const minutes = Math.floor(seconds / 60);
  seconds = Math.floor(seconds % 60);
  
  const parts = [];
  
  if (days > 0) {
    parts.push(`${days} dia${days !== 1 ? 's' : ''}`);
  }
  
  if (hours > 0) {
    parts.push(`${hours} hora${hours !== 1 ? 's' : ''}`);
  }
  
  if (minutes > 0) {
    parts.push(`${minutes} minuto${minutes !== 1 ? 's' : ''}`);
  }
  
  if (seconds > 0 || parts.length === 0) {
    parts.push(`${seconds} segundo${seconds !== 1 ? 's' : ''}`);
  }
  
  return parts.join(', ');
}

/**
 * Processa comandos relacionados a informações do sistema
 * @param {string} command - Comando a ser processado
 * @returns {Promise<object>} - Resultado do processamento
 */
async function processCommand(command) {
  const lowerCommand = command.toLowerCase();
  
  // Verifica se o comando está relacionado a este plugin
  if (lowerCommand.includes('processos') || 
      lowerCommand.includes('mostra os processos') || 
      lowerCommand.includes('listar processos')) {
    const processes = await getProcesses();
    return {
      success: true,
      result: formatProcessesOutput(processes),
      type: 'processes'
    };
  }
  
  if (lowerCommand.includes('uso de disco') || 
      lowerCommand.includes('espaço em disco') || 
      lowerCommand.includes('armazenamento')) {
    const diskUsage = await getDiskUsage();
    return {
      success: true,
      result: formatDiskUsageOutput(diskUsage),
      type: 'disk'
    };
  }
  
  if (lowerCommand.includes('informações do sistema') || 
      lowerCommand.includes('sistema') || 
      lowerCommand.includes('info')) {
    const sysInfo = await getSystemInfo();
    return {
      success: true,
      result: formatSystemInfoOutput(sysInfo),
      type: 'system'
    };
  }
  
  // Se o comando não for reconhecido por este plugin
  return {
    success: false,
    handled: false,
    message: 'Comando não reconhecido pelo plugin de informações do sistema'
  };
}

/**
 * Formata a saída de informações do sistema
 * @param {object} info - Informações do sistema
 * @returns {string} - Saída formatada
 */
function formatSystemInfoOutput(info) {
  return `
=== Informações do Sistema ===

Hostname: ${info.hostname}
Sistema: ${info.platform} ${info.release}
Tempo de Atividade: ${info.uptime}

=== CPU ===
Modelo: ${info.cpus.model}
Núcleos: ${info.cpus.cores}
Velocidade: ${info.cpus.speed}

=== Memória ===
Total: ${info.memory.total}
Usada: ${info.memory.used} (${info.memory.percent})
Livre: ${info.memory.free}

=== Interfaces de Rede ===
${Object.keys(info.network).map(name => {
  return `${name}:\n${info.network[name].map(iface => 
    `  - ${iface.family}: ${iface.address} (${iface.internal ? 'interna' : 'externa'})`
  ).join('\n')}`;
}).join('\n\n')}
`;
}

/**
 * Formata a saída de processos
 * @param {object} processes - Informações de processos
 * @returns {string} - Saída formatada
 */
function formatProcessesOutput(processes) {
  return `
=== Processos em Execução (Top 10 por CPU) ===

${processes.header}
${processes.processes.map(proc => 
  `${proc.pid.padEnd(6)} ${proc.ppid.padEnd(6)} ${proc.user.padEnd(8)} ${proc.cpu.padEnd(5)} ${proc.mem.padEnd(5)} ${proc.stat.padEnd(4)} ${proc.start.padEnd(5)} ${proc.time.padEnd(8)} ${proc.command}`
).join('\n')}
`;
}

/**
 * Formata a saída de uso de disco
 * @param {object} diskUsage - Informações de uso de disco
 * @returns {string} - Saída formatada
 */
function formatDiskUsageOutput(diskUsage) {
  return `
=== Uso de Disco ===

${diskUsage.header}
${diskUsage.disks.map(disk => 
  `${disk.source.padEnd(15)} ${disk.fstype.padEnd(8)} ${disk.size.padEnd(6)} ${disk.used.padEnd(6)} ${disk.avail.padEnd(6)} ${disk.pcent.padEnd(6)} ${disk.target}`
).join('\n')}
`;
}

// Exporta as funções e informações do plugin
module.exports = {
  info: pluginInfo,
  processCommand,
  getSystemInfo,
  getProcesses,
  getDiskUsage
};
