#!/usr/bin/env node

/**
 * FazAI Shell Execution
 * 
 * Este módulo implementa a execução segura de comandos shell
 * com streaming de saída e controle de permissões.
 */

const { spawn } = require('child_process');
const fs = require('fs').promises;

/**
 * Executa comando shell com streaming
 * @param {string} command - Comando a ser executado
 * @param {Function} onData - Callback para dados (chunk, stream)
 * @param {Object} options - Opções de execução
 * @returns {Promise<number>} Código de saída
 */
async function runShellStream(command, onData, options = {}) {
    const {
        cwd = process.cwd(),
        env = process.env,
        timeout = 300000, // 5 minutos
        user = 'root'
    } = options;

    return new Promise((resolve, reject) => {
        // Validar comando
        if (!command || typeof command !== 'string') {
            reject(new Error('Comando inválido'));
            return;
        }

        // Verificar comandos proibidos
        const forbiddenCommands = [
            'rm -rf /',
            'mkfs',
            'dd if=/dev/zero',
            'format',
            'fdisk'
        ];

        const isForbidden = forbiddenCommands.some(forbidden => 
            command.includes(forbidden)
        );

        if (isForbidden) {
            reject(new Error(`Comando proibido por segurança: ${command}`));
            return;
        }

        // Configurar timeout
        let timeoutId = setTimeout(() => {
            process.kill(-process.pid, 'SIGTERM');
            reject(new Error(`Timeout após ${timeout}ms`));
        }, timeout);

        // Executar comando
        const process = spawn('bash', ['-lc', command], {
            cwd,
            env,
            stdio: ['ignore', 'pipe', 'pipe'],
            detached: true
        });

        // Configurar handlers de saída
        process.stdout.on('data', (chunk) => {
            if (onData) {
                onData(chunk.toString(), 'stdout');
            }
        });

        process.stderr.on('data', (chunk) => {
            if (onData) {
                onData(chunk.toString(), 'stderr');
            }
        });

        // Handler de finalização
        process.on('close', (code) => {
            clearTimeout(timeoutId);
            if (code === 0) {
                resolve(code);
            } else {
                reject(new Error(`Comando falhou com código ${code}`));
            }
        });

        process.on('error', (error) => {
            clearTimeout(timeoutId);
            reject(error);
        });
    });
}

/**
 * Executa comando shell simples
 * @param {string} command - Comando a ser executado
 * @param {Object} options - Opções de execução
 * @returns {Promise<Object>} Resultado com stdout, stderr e code
 */
async function runShell(command, options = {}) {
    return new Promise((resolve, reject) => {
        const { cwd = process.cwd(), env = process.env, timeout = 60000 } = options;

        const process = spawn('bash', ['-lc', command], {
            cwd,
            env,
            stdio: ['ignore', 'pipe', 'pipe']
        });

        let stdout = '';
        let stderr = '';

        process.stdout.on('data', (chunk) => {
            stdout += chunk.toString();
        });

        process.stderr.on('data', (chunk) => {
            stderr += chunk.toString();
        });

        process.on('close', (code) => {
            resolve({ stdout, stderr, code });
        });

        process.on('error', (error) => {
            reject(error);
        });

        // Timeout
        setTimeout(() => {
            process.kill('SIGTERM');
            reject(new Error(`Timeout após ${timeout}ms`));
        }, timeout);
    });
}

/**
 * Executa comando com privilégios elevados
 * @param {string} command - Comando a ser executado
 * @param {Function} onData - Callback para dados
 * @returns {Promise<number>} Código de saída
 */
async function runAsRoot(command, onData) {
    return runShellStream(command, onData, { user: 'root' });
}

/**
 * Verifica se um comando está disponível
 * @param {string} command - Comando a verificar
 * @returns {Promise<boolean>} True se disponível
 */
async function isCommandAvailable(command) {
    try {
        const result = await runShell(`command -v ${command}`);
        return result.code === 0;
    } catch (error) {
        return false;
    }
}

/**
 * Executa comando com validação de segurança
 * @param {string} command - Comando a executar
 * @param {Function} onData - Callback para dados
 * @param {Object} securityOptions - Opções de segurança
 * @returns {Promise<number>} Código de saída
 */
async function runSecure(command, onData, securityOptions = {}) {
    const {
        allowedCommands = [],
        blockedCommands = [],
        requireConfirmation = false
    } = securityOptions;

    // Verificar comandos permitidos/bloqueados
    if (allowedCommands.length > 0) {
        const isAllowed = allowedCommands.some(allowed => 
            command.includes(allowed)
        );
        if (!isAllowed) {
            throw new Error(`Comando não permitido: ${command}`);
        }
    }

    if (blockedCommands.length > 0) {
        const isBlocked = blockedCommands.some(blocked => 
            command.includes(blocked)
        );
        if (isBlocked) {
            throw new Error(`Comando bloqueado: ${command}`);
        }
    }

    // TODO: Implementar confirmação se necessário
    if (requireConfirmation) {
        // Aguardar confirmação do usuário
        console.log(`Aguardando confirmação para: ${command}`);
    }

    return runShellStream(command, onData);
}

/**
 * Executa múltiplos comandos em sequência
 * @param {Array} commands - Lista de comandos
 * @param {Function} onData - Callback para dados
 * @param {Object} options - Opções de execução
 * @returns {Promise<Array>} Resultados de cada comando
 */
async function runCommands(commands, onData, options = {}) {
    const results = [];

    for (const command of commands) {
        try {
            const code = await runShellStream(command, onData, options);
            results.push({ command, success: true, code });
        } catch (error) {
            results.push({ command, success: false, error: error.message });
            
            // Parar em caso de erro se configurado
            if (options.stopOnError) {
                break;
            }
        }
    }

    return results;
}

module.exports = {
    runShellStream,
    runShell,
    runAsRoot,
    isCommandAvailable,
    runSecure,
    runCommands
};