#!/usr/bin/env node

/**
 * FazAI Tools Code Generation
 * 
 * Este módulo implementa a geração dinâmica de ferramentas
 * baseada em especificações do agente.
 */

const fs = require('fs').promises;
const path = require('path');
const { spawn } = require('child_process');

/**
 * Gera código a partir de uma especificação
 * @param {Object} spec - Especificação da ferramenta
 * @returns {Promise<string>} Código gerado
 */
async function generateCodeFromSpec(spec) {
    // TODO: Implementar geração real com LLM
    // Por enquanto, retorna template básico
    
    const template = `#!/usr/bin/env node

/**
 * FazAI Generated Tool: ${spec.name}
 * Generated: ${new Date().toISOString()}
 * Description: ${spec.description || 'No description provided'}
 */

const fs = require('fs').promises;
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

/**
 * Main function
 * @param {Object} args - Arguments passed to the tool
 */
async function main(args) {
    console.log('Executing ${spec.name} with args:', JSON.stringify(args, null, 2));
    
    try {
        // TODO: Implement tool logic based on spec
        console.log('Tool execution completed successfully');
        
        // Return result
        return {
            success: true,
            message: 'Tool executed successfully',
            timestamp: new Date().toISOString()
        };
    } catch (error) {
        console.error('Tool execution failed:', error);
        return {
            success: false,
            error: error.message,
            timestamp: new Date().toISOString()
        };
    }
}

// Handle command line execution
if (require.main === module) {
    const args = JSON.parse(process.argv[2] || '{}');
    main(args)
        .then(result => {
            console.log(JSON.stringify(result, null, 2));
            process.exit(result.success ? 0 : 1);
        })
        .catch(error => {
            console.error('Fatal error:', error);
            process.exit(1);
        });
}

module.exports = { main };
`;

    return template;
}

/**
 * Gera e carrega uma ferramenta
 * @param {Object} spec - Especificação da ferramenta
 * @returns {Promise<Object>} Informações da ferramenta gerada
 */
async function codegenAndLoad(spec) {
    try {
        // Criar diretório para ferramentas geradas
        const toolsDir = '/opt/fazai/tools/_generated';
        const sessionDir = path.join(toolsDir, `${Date.now()}_${spec.name}`);
        
        await fs.mkdir(sessionDir, { recursive: true });
        
        // Gerar código
        const code = await generateCodeFromSpec(spec);
        
        // Salvar arquivo
        const filePath = path.join(sessionDir, `${spec.name}.mjs`);
        await fs.writeFile(filePath, code, { mode: 0o755 });
        
        // Salvar metadados
        const metadata = {
            name: spec.name,
            description: spec.description,
            parameters: spec.parameters || {},
            generated: new Date().toISOString(),
            spec: spec
        };
        
        const metadataPath = path.join(sessionDir, 'metadata.json');
        await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2));
        
        console.log(`Tool generated: ${filePath}`);
        
        return {
            dir: sessionDir,
            file: filePath,
            metadata: metadata
        };
        
    } catch (error) {
        console.error('Error generating tool:', error);
        throw error;
    }
}

/**
 * Executa uma ferramenta gerada
 * @param {string} name - Nome da ferramenta
 * @param {Object} args - Argumentos
 * @param {Function} onLog - Callback para logs
 * @returns {Promise<void>}
 */
async function useTool(name, args, onLog) {
    try {
        // Encontrar ferramenta mais recente
        const toolsDir = '/opt/fazai/tools/_generated';
        const dirs = await fs.readdir(toolsDir);
        
        if (dirs.length === 0) {
            throw new Error('No generated tools found');
        }
        
        // Ordenar por timestamp (mais recente primeiro)
        const sortedDirs = dirs
            .filter(dir => dir.includes(name))
            .sort()
            .reverse();
        
        if (sortedDirs.length === 0) {
            throw new Error(`Tool ${name} not found`);
        }
        
        const latestDir = sortedDirs[0];
        const toolPath = path.join(toolsDir, latestDir, `${name}.mjs`);
        
        // Verificar se arquivo existe
        await fs.access(toolPath);
        
        // Executar ferramenta
        await new Promise((resolve, reject) => {
            const process = spawn('node', [toolPath, JSON.stringify(args || {})], {
                stdio: ['ignore', 'pipe', 'pipe']
            });
            
            process.stdout.on('data', (data) => {
                if (onLog) {
                    onLog(data.toString(), 'stdout');
                }
            });
            
            process.stderr.on('data', (data) => {
                if (onLog) {
                    onLog(data.toString(), 'stderr');
                }
            });
            
            process.on('close', (code) => {
                if (code === 0) {
                    resolve();
                } else {
                    reject(new Error(`Tool exited with code ${code}`));
                }
            });
            
            process.on('error', (error) => {
                reject(error);
            });
        });
        
    } catch (error) {
        console.error('Error using tool:', error);
        throw error;
    }
}

/**
 * Lista ferramentas geradas
 * @returns {Promise<Array>} Lista de ferramentas
 */
async function listGeneratedTools() {
    try {
        const toolsDir = '/opt/fazai/tools/_generated';
        const dirs = await fs.readdir(toolsDir);
        
        const tools = [];
        
        for (const dir of dirs) {
            try {
                const metadataPath = path.join(toolsDir, dir, 'metadata.json');
                const metadata = JSON.parse(await fs.readFile(metadataPath, 'utf8'));
                tools.push({
                    ...metadata,
                    dir: dir
                });
            } catch (error) {
                console.warn(`Error reading metadata for ${dir}:`, error);
            }
        }
        
        return tools.sort((a, b) => new Date(b.generated) - new Date(a.generated));
        
    } catch (error) {
        console.error('Error listing tools:', error);
        return [];
    }
}

/**
 * Remove ferramentas antigas
 * @param {number} maxAge - Idade máxima em dias
 * @returns {Promise<number>} Número de ferramentas removidas
 */
async function cleanupOldTools(maxAge = 7) {
    try {
        const toolsDir = '/opt/fazai/tools/_generated';
        const dirs = await fs.readdir(toolsDir);
        
        const cutoff = Date.now() - (maxAge * 24 * 60 * 60 * 1000);
        let removed = 0;
        
        for (const dir of dirs) {
            try {
                const dirPath = path.join(toolsDir, dir);
                const stats = await fs.stat(dirPath);
                
                if (stats.birthtime.getTime() < cutoff) {
                    await fs.rm(dirPath, { recursive: true, force: true });
                    removed++;
                    console.log(`Removed old tool: ${dir}`);
                }
            } catch (error) {
                console.warn(`Error cleaning up ${dir}:`, error);
            }
        }
        
        return removed;
        
    } catch (error) {
        console.error('Error cleaning up tools:', error);
        return 0;
    }
}

/**
 * Valida especificação de ferramenta
 * @param {Object} spec - Especificação
 * @returns {Object} Resultado da validação
 */
function validateToolSpec(spec) {
    const errors = [];
    
    if (!spec.name) {
        errors.push('Tool name is required');
    }
    
    if (!spec.description) {
        errors.push('Tool description is required');
    }
    
    if (spec.parameters && typeof spec.parameters !== 'object') {
        errors.push('Parameters must be an object');
    }
    
    return {
        valid: errors.length === 0,
        errors: errors
    };
}

module.exports = {
    generateCodeFromSpec,
    codegenAndLoad,
    useTool,
    listGeneratedTools,
    cleanupOldTools,
    validateToolSpec
};