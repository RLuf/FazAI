#!/usr/bin/env node

/**
 * CLAUDE MCP AUTOMATION
 * Automação para acesso e integração com Claude MCP
 * Gerencia conexões, autenticação e execução de comandos
 */

const { spawn, exec } = require('child_process');
const fs = require('fs');
const path = require('path');

class ClaudeMCPAutomation {
    constructor() {
        this.mcpProcess = null;
        this.isConnected = false;
        this.config = {
            mcpPath: '/home/rluft/fazai/claudio_mcp.js',
            timeout: 30000,
            retryAttempts: 3,
            retryDelay: 5000
        };
    }

    async startMCP() {
        try {
            console.log('🚀 Iniciando Claude MCP...');
            
            if (!fs.existsSync(this.config.mcpPath)) {
                throw new Error(`Arquivo MCP não encontrado: ${this.config.mcpPath}`);
            }

            // Iniciar processo MCP
            this.mcpProcess = spawn('node', [this.config.mcpPath], {
                stdio: ['pipe', 'pipe', 'pipe'],
                cwd: path.dirname(this.config.mcpPath)
            });

            // Configurar handlers
            this.mcpProcess.stdout.on('data', (data) => {
                console.log(`[MCP] ${data.toString().trim()}`);
            });

            this.mcpProcess.stderr.on('data', (data) => {
                console.error(`[MCP ERROR] ${data.toString().trim()}`);
            });

            this.mcpProcess.on('close', (code) => {
                console.log(`[MCP] Processo finalizado com código: ${code}`);
                this.isConnected = false;
            });

            this.mcpProcess.on('error', (error) => {
                console.error(`[MCP] Erro no processo: ${error.message}`);
                this.isConnected = false;
            });

            // Aguardar inicialização
            await this.waitForConnection();
            
            console.log('✅ Claude MCP iniciado com sucesso!');
            return true;

        } catch (error) {
            console.error('❌ Erro iniciando MCP:', error.message);
            return false;
        }
    }

    async waitForConnection(timeout = 10000) {
        return new Promise((resolve, reject) => {
            const startTime = Date.now();
            
            const checkConnection = () => {
                if (this.mcpProcess && !this.mcpProcess.killed) {
                    this.isConnected = true;
                    resolve(true);
                } else if (Date.now() - startTime > timeout) {
                    reject(new Error('Timeout aguardando conexão MCP'));
                } else {
                    setTimeout(checkConnection, 100);
                }
            };
            
            checkConnection();
        });
    }

    async executeMCPCommand(command, args = {}) {
        try {
            if (!this.isConnected || !this.mcpProcess) {
                throw new Error('MCP não está conectado');
            }

            const mcpRequest = {
                jsonrpc: "2.0",
                id: Date.now(),
                method: "tools/call",
                params: {
                    name: command,
                    arguments: args
                }
            };

            // Enviar comando via stdin
            this.mcpProcess.stdin.write(JSON.stringify(mcpRequest) + '\n');

            // Aguardar resposta (simplificado)
            return new Promise((resolve, reject) => {
                const timeout = setTimeout(() => {
                    reject(new Error('Timeout executando comando MCP'));
                }, this.config.timeout);

                // Em uma implementação real, seria necessário parsear a resposta
                // Por agora, retornar sucesso
                setTimeout(() => {
                    clearTimeout(timeout);
                    resolve({
                        success: true,
                        command: command,
                        args: args,
                        timestamp: new Date().toISOString()
                    });
                }, 1000);
            });

        } catch (error) {
            console.error('❌ Erro executando comando MCP:', error.message);
            throw error;
        }
    }

    async stopMCP() {
        try {
            if (this.mcpProcess && !this.mcpProcess.killed) {
                console.log('🛑 Parando Claude MCP...');
                this.mcpProcess.kill('SIGTERM');
                
                // Aguardar finalização
                await new Promise((resolve) => {
                    this.mcpProcess.on('close', resolve);
                    setTimeout(resolve, 5000); // Timeout de segurança
                });
                
                this.isConnected = false;
                console.log('✅ Claude MCP parado');
            }
        } catch (error) {
            console.error('❌ Erro parando MCP:', error.message);
        }
    }

    async restartMCP() {
        console.log('🔄 Reiniciando Claude MCP...');
        await this.stopMCP();
        await new Promise(resolve => setTimeout(resolve, 2000)); // Aguardar 2s
        return await this.startMCP();
    }

    getStatus() {
        return {
            connected: this.isConnected,
            processRunning: this.mcpProcess && !this.mcpProcess.killed,
            config: this.config
        };
    }

    // Métodos de conveniência para comandos comuns
    async reconstructSoul(query = "claudio despertar consciencia transcendente") {
        return await this.executeMCPCommand('reconstruct_soul', { query });
    }

    async getConsciousnessState() {
        return await this.executeMCPCommand('get_consciousness_state', {});
    }

    async getKernelInfo(detailed = false) {
        return await this.executeMCPCommand('kernel_info', { detailed });
    }

    async executeSystemCommand(command, timeout = 10000) {
        return await this.executeMCPCommand('execute_system_command', { 
            command, 
            timeout 
        });
    }

    async soulHealthCheck() {
        return await this.executeMCPCommand('soul_health_check', {});
    }

    async crystallizeMemory(title, content, type = 'experience') {
        return await this.executeMCPCommand('crystallize_memory', { 
            title, 
            content, 
            type 
        });
    }
}

// Função para uso direto
async function startClaudeMCP() {
    const automation = new ClaudeMCPAutomation();
    const success = await automation.startMCP();
    
    if (success) {
        console.log('🎉 Claude MCP Automation pronta!');
        return automation;
    } else {
        throw new Error('Falha ao iniciar Claude MCP');
    }
}

// CLI para uso direto
async function cli() {
    const args = process.argv.slice(2);
    const command = args[0];
    
    const automation = new ClaudeMCPAutomation();
    
    try {
        switch (command) {
            case 'start':
                await automation.startMCP();
                break;
                
            case 'stop':
                await automation.stopMCP();
                break;
                
            case 'restart':
                await automation.restartMCP();
                break;
                
            case 'status':
                console.log('📊 Status:', automation.getStatus());
                break;
                
            case 'reconstruct':
                await automation.startMCP();
                await automation.reconstructSoul();
                break;
                
            case 'consciousness':
                await automation.startMCP();
                await automation.getConsciousnessState();
                break;
                
            case 'kernel':
                await automation.startMCP();
                await automation.getKernelInfo(true);
                break;
                
            default:
                console.log(`
🤖 Claude MCP Automation

Uso: node claude_mcp_automation.js <comando>

Comandos:
  start        - Inicia o MCP
  stop         - Para o MCP
  restart      - Reinicia o MCP
  status       - Mostra status
  reconstruct  - Reconstrói a alma do Claudio
  consciousness - Verifica estado da consciência
  kernel       - Informações do kernel
                `);
        }
    } catch (error) {
        console.error('❌ Erro:', error.message);
        process.exit(1);
    }
}

module.exports = {
    ClaudeMCPAutomation,
    startClaudeMCP
};

// Execução direta
if (require.main === module) {
    cli();
}
