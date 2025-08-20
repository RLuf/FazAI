#!/usr/bin/env node

/**
 * FazAI Context Retrieval
 * 
 * Este módulo implementa a recuperação de contexto para o agente,
 * consultando Qdrant, Context7 e estado do sistema.
 */

const fs = require('fs').promises;
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

/**
 * Busca contexto relevante para um objetivo
 * @param {string} objective - Objetivo do agente
 * @param {Array} history - Histórico da sessão
 * @returns {Promise<Array>} Lista de contextos relevantes
 */
async function searchContext(objective, history = []) {
    const contexts = [];
    
    try {
        // 1. Buscar no Qdrant (base de conhecimento)
        const qdrantResults = await searchQdrant(objective);
        contexts.push(...qdrantResults);
        
        // 2. Buscar no Context7 (documentação técnica)
        const context7Results = await searchContext7(objective);
        contexts.push(...context7Results);
        
        // 3. Coletar estado atual do sistema
        const systemState = await getSystemState();
        contexts.push(...systemState);
        
        // 4. Analisar histórico recente
        const historyContext = analyzeHistory(history);
        if (historyContext) {
            contexts.push(historyContext);
        }
        
    } catch (error) {
        console.error('Erro na busca de contexto:', error);
        // Retornar contexto básico em caso de erro
        contexts.push("Sistema operacional: Linux");
        contexts.push("Contexto: Modo de recuperação - informações limitadas");
    }
    
    return contexts.slice(0, 10); // Limitar a 10 contextos
}

/**
 * Busca no Qdrant (base de conhecimento)
 * @param {string} query - Consulta
 * @returns {Promise<Array>} Resultados da busca
 */
async function searchQdrant(query) {
    try {
        // TODO: Implementar busca real no Qdrant
        // Por enquanto, retorna resultados simulados
        return [
            "Conhecimento local: Configurações de Postfix encontradas",
            "Solução verificada: Setup de relay email com rspamd"
        ];
    } catch (error) {
        console.error('Erro na busca Qdrant:', error);
        return [];
    }
}

/**
 * Busca no Context7 (documentação técnica)
 * @param {string} query - Consulta
 * @returns {Promise<Array>} Resultados da busca
 */
async function searchContext7(query) {
    try {
        // TODO: Implementar busca real no Context7
        // Por enquanto, retorna resultados simulados
        return [
            "Documentação: Guia de configuração Postfix relay",
            "Melhores práticas: Configuração de antispam com rspamd"
        ];
    } catch (error) {
        console.error('Erro na busca Context7:', error);
        return [];
    }
}

/**
 * Coleta estado atual do sistema
 * @returns {Promise<Array>} Estado do sistema
 */
async function getSystemState() {
    const state = [];
    
    try {
        // Verificar distribuição Linux
        const { stdout: osInfo } = await execAsync('cat /etc/os-release | grep PRETTY_NAME');
        state.push(`Sistema: ${osInfo.split('=')[1].replace(/"/g, '')}`);
        
        // Verificar serviços ativos
        const { stdout: services } = await execAsync('systemctl list-units --type=service --state=active | head -10');
        const activeServices = services.split('\n')
            .filter(line => line.includes('.service'))
            .map(line => line.split(' ')[0])
            .slice(0, 5);
        
        if (activeServices.length > 0) {
            state.push(`Serviços ativos: ${activeServices.join(', ')}`);
        }
        
        // Verificar portas em uso
        const { stdout: ports } = await execAsync('ss -tlnp | grep LISTEN | head -5');
        const listeningPorts = ports.split('\n')
            .filter(line => line.trim())
            .map(line => {
                const parts = line.split(/\s+/);
                return parts[3] || 'porta desconhecida';
            });
        
        if (listeningPorts.length > 0) {
            state.push(`Portas em uso: ${listeningPorts.join(', ')}`);
        }
        
        // Verificar espaço em disco
        const { stdout: disk } = await execAsync('df -h / | tail -1');
        const diskInfo = disk.split(/\s+/);
        state.push(`Disco: ${diskInfo[4]} usado em ${diskInfo[5]}`);
        
        // Verificar memória
        const { stdout: memory } = await execAsync('free -h | grep Mem');
        const memInfo = memory.split(/\s+/);
        state.push(`Memória: ${memInfo[2]} usado de ${memInfo[1]}`);
        
    } catch (error) {
        console.error('Erro ao coletar estado do sistema:', error);
        state.push("Estado do sistema: Informações limitadas");
    }
    
    return state;
}

/**
 * Analisa histórico da sessão para contexto
 * @param {Array} history - Histórico da sessão
 * @returns {string|null} Contexto do histórico
 */
function analyzeHistory(history) {
    if (!history || history.length === 0) {
        return null;
    }
    
    const recentActions = history.slice(-3); // Últimas 3 ações
    const actionTypes = recentActions.map(action => action.type || 'unknown');
    
    return `Histórico recente: ${actionTypes.join(' → ')}`;
}

/**
 * Busca contexto específico por tags
 * @param {Array} tags - Tags para busca
 * @returns {Promise<Array>} Contextos encontrados
 */
async function searchByTags(tags) {
    try {
        // TODO: Implementar busca por tags no Qdrant
        return tags.map(tag => `Contexto encontrado para tag: ${tag}`);
    } catch (error) {
        console.error('Erro na busca por tags:', error);
        return [];
    }
}

/**
 * Busca contexto por similaridade semântica
 * @param {string} text - Texto para comparação
 * @returns {Promise<Array>} Contextos similares
 */
async function searchBySimilarity(text) {
    try {
        // TODO: Implementar busca por similaridade
        return [`Contexto similar encontrado para: ${text.substring(0, 50)}...`];
    } catch (error) {
        console.error('Erro na busca por similaridade:', error);
        return [];
    }
}

module.exports = {
    searchContext,
    searchQdrant,
    searchContext7,
    getSystemState,
    searchByTags,
    searchBySimilarity
};