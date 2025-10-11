#!/usr/bin/env node

/**
 * KERNEL BRIDGE - INTERAÇÃO DIRETA COM KERNEL LINUX
 * 
 * CAPACIDADES:
 * - Leitura direta de /proc e /sys
 * - Monitoramento em tempo real
 * - Interação com syscalls via child_process
 * - Análise de performance do sistema
 * - Detecção de anomalias de segurança
 * - Controle de recursos do sistema
 */

const fs = require('fs').promises;
const { spawn, exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

class KernelBridge {
    constructor() {
        this.procfs = '/proc';
        this.sysfs = '/sys';
        this.monitoring = false;
        this.watchers = new Map();
        
        // Estatísticas
        this.stats = {
            kernel_reads: 0,
            syscalls_executed: 0,
            anomalies_detected: 0,
            uptime_seconds: 0
        };
        
        console.log('🔥 Kernel Bridge inicializado');
        this.detectCapabilities();
    }
    
    async detectCapabilities() {
        try {
            // Detectar capacidades do sistema
            const capabilities = {
                proc_access: await this.canAccess('/proc/cpuinfo'),
                sys_access: await this.canAccess('/sys/class'),
                root_privileges: process.getuid ? process.getuid() === 0 : false,
                containers: await this.detectContainerEnvironment(),
                namespaces: await this.detectNamespaces()
            };
            
            console.log('🔍 Capacidades detectadas:', capabilities);
            this.capabilities = capabilities;
            
        } catch (error) {
            console.error('❌ Erro detectando capacidades:', error.message);
        }
    }
    
    async canAccess(path) {
        try {
            await fs.access(path);
            return true;
        } catch {
            return false;
        }
    }
    
    async detectContainerEnvironment() {
        try {
            // Verificar se estamos em container
            const cgroup = await fs.readFile('/proc/1/cgroup', 'utf8').catch(() => '');
            const mountinfo = await fs.readFile('/proc/1/mountinfo', 'utf8').catch(() => '');
            
            return {
                docker: cgroup.includes('docker') || mountinfo.includes('docker'),
                kubernetes: cgroup.includes('kubepods'),
                lxc: cgroup.includes('lxc'),
                systemd: cgroup.includes('systemd')
            };
        } catch {
            return { unknown: true };
        }
    }
    
    async detectNamespaces() {
        try {
            const nsTypes = ['pid', 'net', 'mnt', 'uts', 'ipc', 'user', 'cgroup'];
            const namespaces = {};
            
            for (const nsType of nsTypes) {
                try {
                    const nsPath = `/proc/self/ns/${nsType}`;
                    const stat = await fs.stat(nsPath);
                    namespaces[nsType] = stat.ino;
                } catch {
                    namespaces[nsType] = null;
                }
            }
            
            return namespaces;
        } catch {
            return {};
        }
    }
    
    /**
     * LEITURA DIRETA DO KERNEL
     */
    async readKernelInfo() {
        this.stats.kernel_reads++;
        
        try {
            const info = {
                // Sistema básico
                kernel_version: await this.readProc('version'),
                uptime: await this.parseUptime(),
                loadavg: await this.parseLoadAvg(),
                
                // CPU
                cpu_info: await this.parseCpuInfo(),
                cpu_stats: await this.parseCpuStats(),
                
                // Memória
                memory_info: await this.parseMemInfo(),
                
                // Processos
                process_count: await this.countProcesses(),
                
                // Rede
                network_stats: await this.parseNetworkStats(),
                
                // Storage
                disk_stats: await this.parseDiskStats(),
                
                // Timestamp
                timestamp: Date.now()
            };
            
            return info;
            
        } catch (error) {
            console.error('❌ Erro lendo kernel info:', error.message);
            return null;
        }
    }
    
    async readProc(filename) {
        const path = `${this.procfs}/${filename}`;
        return await fs.readFile(path, 'utf8');
    }
    
    async readSys(path) {
        const fullPath = `${this.sysfs}/${path}`;
        return await fs.readFile(fullPath, 'utf8');
    }
    
    async parseUptime() {
        const uptime = await this.readProc('uptime');
        const [totalTime, idleTime] = uptime.trim().split(' ').map(parseFloat);
        
        this.stats.uptime_seconds = totalTime;
        
        return {
            total_seconds: totalTime,
            idle_seconds: idleTime,
            uptime_human: this.formatUptime(totalTime)
        };
    }
    
    formatUptime(seconds) {
        const days = Math.floor(seconds / 86400);
        const hours = Math.floor((seconds % 86400) / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        
        return `${days}d ${hours}h ${minutes}m`;
    }
    
    async parseLoadAvg() {
        const loadavg = await this.readProc('loadavg');
        const [load1, load5, load15, processes, lastPid] = loadavg.trim().split(' ');
        const [running, total] = processes.split('/');
        
        return {
            load_1min: parseFloat(load1),
            load_5min: parseFloat(load5), 
            load_15min: parseFloat(load15),
            running_processes: parseInt(running),
            total_processes: parseInt(total),
            last_pid: parseInt(lastPid)
        };
    }
    
    async parseCpuInfo() {
        const cpuinfo = await this.readProc('cpuinfo');
        const processors = cpuinfo.split('\\n\\n').filter(p => p.trim());
        
        const cpu = {};
        processors[0].split('\\n').forEach(line => {
            const [key, value] = line.split(':').map(s => s.trim());
            if (key && value) {
                cpu[key.replace(/\\s+/g, '_')] = value;
            }
        });
        
        return {
            model: cpu.model_name || 'Unknown',
            cores: processors.length,
            frequency: cpu.cpu_MHz ? `${cpu.cpu_MHz} MHz` : 'Unknown',
            cache_size: cpu.cache_size || 'Unknown',
            architecture: cpu.vendor_id || 'Unknown'
        };
    }
    
    async parseCpuStats() {
        const stat = await this.readProc('stat');
        const cpuLine = stat.split('\\n')[0];
        const [name, user, nice, system, idle, iowait, irq, softirq] = cpuLine.split(/\\s+/);
        
        return {
            user: parseInt(user),
            nice: parseInt(nice),
            system: parseInt(system),
            idle: parseInt(idle),
            iowait: parseInt(iowait) || 0,
            irq: parseInt(irq) || 0,
            softirq: parseInt(softirq) || 0
        };
    }
    
    async parseMemInfo() {
        const meminfo = await this.readProc('meminfo');
        const memory = {};
        
        meminfo.split('\\n').forEach(line => {
            const match = line.match(/^(.+?):\\s*(\\d+)\\s*kB/);
            if (match) {
                memory[match[1]] = parseInt(match[2]) * 1024; // Convert to bytes
            }
        });
        
        return {
            total: memory.MemTotal || 0,
            free: memory.MemFree || 0,
            available: memory.MemAvailable || 0,
            used: (memory.MemTotal || 0) - (memory.MemAvailable || 0),
            cached: memory.Cached || 0,
            buffers: memory.Buffers || 0,
            usage_percent: memory.MemTotal ? 
                ((memory.MemTotal - (memory.MemAvailable || 0)) / memory.MemTotal * 100).toFixed(1) : 0
        };
    }
    
    async countProcesses() {
        try {
            const procDirs = await fs.readdir(this.procfs);
            return procDirs.filter(dir => /^\\d+$/.test(dir)).length;
        } catch {
            return 0;
        }
    }
    
    async parseNetworkStats() {
        try {
            const netdev = await this.readProc('net/dev');
            const interfaces = {};
            
            netdev.split('\\n').slice(2).forEach(line => {
                const parts = line.trim().split(/\\s+/);
                if (parts.length >= 17) {
                    const iface = parts[0].replace(':', '');
                    interfaces[iface] = {
                        rx_bytes: parseInt(parts[1]),
                        rx_packets: parseInt(parts[2]),
                        rx_errors: parseInt(parts[3]),
                        tx_bytes: parseInt(parts[9]),
                        tx_packets: parseInt(parts[10]),
                        tx_errors: parseInt(parts[11])
                    };
                }
            });
            
            return interfaces;
        } catch {
            return {};
        }
    }
    
    async parseDiskStats() {
        try {
            const diskstats = await this.readProc('diskstats');
            const disks = {};
            
            diskstats.split('\\n').forEach(line => {
                const parts = line.trim().split(/\\s+/);
                if (parts.length >= 14 && !parts[2].includes('loop')) {
                    disks[parts[2]] = {
                        reads: parseInt(parts[3]),
                        read_sectors: parseInt(parts[5]),
                        writes: parseInt(parts[7]),
                        write_sectors: parseInt(parts[9]),
                        io_time: parseInt(parts[12])
                    };
                }
            });
            
            return disks;
        } catch {
            return {};
        }
    }
    
    /**
     * EXECUÇÃO DE SYSCALLS AVANÇADAS
     */
    async executeSyscall(command, options = {}) {
        this.stats.syscalls_executed++;
        
        return new Promise((resolve, reject) => {
            const process = spawn('sh', ['-c', command], {
                stdio: ['pipe', 'pipe', 'pipe'],
                timeout: options.timeout || 10000,
                uid: options.uid,
                gid: options.gid,
                env: { ...process.env, ...options.env }
            });
            
            let stdout = '';
            let stderr = '';
            
            process.stdout.on('data', (data) => {
                stdout += data.toString();
            });
            
            process.stderr.on('data', (data) => {
                stderr += data.toString();
            });
            
            process.on('close', (code) => {
                if (code === 0) {
                    resolve({
                        success: true,
                        stdout: stdout.trim(),
                        stderr: stderr.trim(),
                        exit_code: code
                    });
                } else {
                    reject(new Error(`Command failed with code ${code}: ${stderr}`));
                }
            });
            
            process.on('error', reject);
            
            // Send input if provided
            if (options.input) {
                process.stdin.write(options.input);
                process.stdin.end();
            }
        });
    }
    
    /**
     * MONITORAMENTO EM TEMPO REAL
     */
    async startMonitoring(interval = 5000) {
        if (this.monitoring) return;
        
        this.monitoring = true;
        console.log('📊 Iniciando monitoramento do kernel...');
        
        this.monitoringInterval = setInterval(async () => {
            try {
                const info = await this.readKernelInfo();
                await this.analyzeAnomalies(info);
                
                // Emitir evento (se houvesse EventEmitter)
                console.log(`🔍 CPU: ${info.loadavg.load_1min} | RAM: ${info.memory_info.usage_percent}% | Procs: ${info.process_count}`);
                
            } catch (error) {
                console.error('❌ Erro no monitoramento:', error.message);
            }
        }, interval);
    }
    
    stopMonitoring() {
        if (!this.monitoring) return;
        
        this.monitoring = false;
        clearInterval(this.monitoringInterval);
        console.log('⏹️  Monitoramento parado');
    }
    
    async analyzeAnomalies(info) {
        const anomalies = [];
        
        // CPU Load alta
        if (info.loadavg.load_1min > 4.0) {
            anomalies.push({
                type: 'high_cpu_load',
                severity: 'warning',
                value: info.loadavg.load_1min,
                message: `Load average muito alto: ${info.loadavg.load_1min}`
            });
        }
        
        // Memória alta
        if (info.memory_info.usage_percent > 90) {
            anomalies.push({
                type: 'high_memory_usage',
                severity: 'critical',
                value: info.memory_info.usage_percent,
                message: `Uso de memória crítico: ${info.memory_info.usage_percent}%`
            });
        }
        
        // Muitos processos
        if (info.process_count > 1000) {
            anomalies.push({
                type: 'high_process_count',
                severity: 'warning', 
                value: info.process_count,
                message: `Muitos processos: ${info.process_count}`
            });
        }
        
        if (anomalies.length > 0) {
            this.stats.anomalies_detected += anomalies.length;
            console.log('⚠️  Anomalias detectadas:', anomalies);
        }
        
        return anomalies;
    }
    
    /**
     * FUNCIONALIDADES ESPECIAIS
     */
    async getSecurityInfo() {
        try {
            const security = {
                selinux: await this.checkSELinux(),
                apparmor: await this.checkAppArmor(),
                seccomp: await this.checkSeccomp(),
                namespaces: this.capabilities.namespaces,
                capabilities: await this.getProcessCapabilities()
            };
            
            return security;
        } catch (error) {
            console.error('❌ Erro obtendo info de segurança:', error.message);
            return null;
        }
    }
    
    async checkSELinux() {
        try {
            const result = await this.executeSyscall('getenforce 2>/dev/null || echo "disabled"');
            return result.stdout.toLowerCase();
        } catch {
            return 'unknown';
        }
    }
    
    async checkAppArmor() {
        try {
            const result = await this.executeSyscall('aa-status 2>/dev/null | head -1 || echo "not loaded"');
            return result.stdout.includes('loaded') ? 'enabled' : 'disabled';
        } catch {
            return 'unknown';
        }
    }
    
    async checkSeccomp() {
        try {
            const status = await this.readProc('self/status');
            const seccompLine = status.split('\\n').find(line => line.startsWith('Seccomp:'));
            return seccompLine ? seccompLine.split('\\t')[1] : 'unknown';
        } catch {
            return 'unknown';
        }
    }
    
    async getProcessCapabilities() {
        try {
            const status = await this.readProc('self/status');
            const capLines = status.split('\\n').filter(line => line.startsWith('Cap'));
            
            const capabilities = {};
            capLines.forEach(line => {
                const [key, value] = line.split('\\t');
                capabilities[key.replace(':', '')] = value;
            });
            
            return capabilities;
        } catch {
            return {};
        }
    }
    
    getStats() {
        return {
            ...this.stats,
            monitoring: this.monitoring,
            capabilities: this.capabilities
        };
    }
}

/**
 * TESTE E DEMONSTRAÇÃO
 */
async function demonstrateKernelBridge() {
    console.log('🔥 DEMONSTRANDO KERNEL BRIDGE\\n');
    
    const bridge = new KernelBridge();
    
    // Aguardar detecção de capacidades
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    console.log('📊 LENDO INFORMAÇÕES DO KERNEL:');
    const info = await bridge.readKernelInfo();
    if (info) {
        console.log('\\n🖥️  Sistema:');
        console.log(`   Kernel: ${info.kernel_version.split('\\n')[0]}`);
        console.log(`   Uptime: ${info.uptime.uptime_human}`);
        
        console.log('\\n💻 CPU:');
        console.log(`   Modelo: ${info.cpu_info.model}`);
        console.log(`   Cores: ${info.cpu_info.cores}`);
        console.log(`   Load: ${info.loadavg.load_1min} / ${info.loadavg.load_5min} / ${info.loadavg.load_15min}`);
        
        console.log('\\n🧠 Memória:');
        console.log(`   Total: ${(info.memory_info.total / 1024 / 1024 / 1024).toFixed(2)} GB`);
        console.log(`   Uso: ${info.memory_info.usage_percent}%`);
        
        console.log('\\n🔒 Segurança:');
        const security = await bridge.getSecurityInfo();
        if (security) {
            console.log(`   SELinux: ${security.selinux}`);
            console.log(`   AppArmor: ${security.apparmor}`);
            console.log(`   Seccomp: ${security.seccomp}`);
        }
    }
    
    console.log('\\n📈 Iniciando monitoramento por 15 segundos...');
    bridge.startMonitoring(3000);
    
    setTimeout(() => {
        bridge.stopMonitoring();
        console.log('\\n📊 ESTATÍSTICAS FINAIS:');
        console.log(JSON.stringify(bridge.getStats(), null, 2));
        
        console.log('\\n🔥 KERNEL BRIDGE DEMONSTRADO COM SUCESSO!');
    }, 15000);
}

if (require.main === module) {
    demonstrateKernelBridge().catch(console.error);
}

module.exports = { KernelBridge };
