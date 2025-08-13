#!/usr/bin/env node

/**
 * FazAI Gemma Worker Provider
 * 
 * Este módulo implementa o provider para comunicação com o worker Gemma C++
 * via socket Unix, fornecendo interface para sessões, geração de tokens
 * e controle de execução.
 */

const net = require('net');
const { EventEmitter } = require('events');
const fs = require('fs');

const SOCK = process.env.FAZAI_GEMMA_SOCK || "/run/fazai/gemma.sock";

/**
 * Envia JSON para o socket
 * @param {net.Socket} sock - Socket conectado
 * @param {Object} obj - Objeto a ser enviado
 */
function sendJson(sock, obj) {
    sock.write(JSON.stringify(obj) + "\n");
}

/**
 * Aguarda um evento específico do socket
 * @param {net.Socket} sock - Socket
 * @param {string} event - Nome do evento
 * @returns {Promise} Promise que resolve quando o evento ocorre
 */
function once(sock, event) {
    return new Promise((resolve, reject) => {
        sock.once(event, resolve);
        sock.once('error', reject);
    });
}

/**
 * Lê JSON do socket
 * @param {net.Socket} sock - Socket
 * @returns {Promise<Object>} Objeto JSON lido
 */
function readJson(sock) {
    return new Promise((resolve, reject) => {
        let buffer = "";
        
        const onData = (chunk) => {
            buffer += chunk.toString();
            const newlineIndex = buffer.indexOf('\n');
            
            if (newlineIndex >= 0) {
                sock.removeListener('data', onData);
                sock.removeListener('error', onError);
                
                try {
                    const jsonStr = buffer.slice(0, newlineIndex).trim();
                    if (jsonStr) {
                        resolve(JSON.parse(jsonStr));
                    } else {
                        resolve({});
                    }
                } catch (e) {
                    reject(e);
                }
            }
        };
        
        const onError = (err) => {
            sock.removeListener('data', onData);
            reject(err);
        };
        
        sock.on('data', onData);
        sock.on('error', onError);
    });
}

/**
 * Cria uma nova sessão no worker Gemma
 * @param {Object} params - Parâmetros da sessão
 * @returns {Promise<string>} ID da sessão criada
 */
async function createSession(params = {}) {
    const sock = net.createConnection(SOCK);
    
    try {
        await once(sock, 'connect');
        
        sendJson(sock, {
            type: "create_session",
            params: params
        });
        
        const response = await readJson(sock);
        sock.end();
        
        if (!response.ok) {
            throw new Error("createSession failed: " + (response.error || "unknown error"));
        }
        
        return response.session_id;
    } catch (error) {
        sock.destroy();
        throw error;
    }
}

/**
 * Gera stream de tokens para uma sessão
 * @param {string} session_id - ID da sessão
 * @param {string} prompt - Prompt para geração
 * @returns {EventEmitter} EventEmitter com eventos 'event' e 'end'
 */
function generateStream(session_id, prompt) {
    const ee = new EventEmitter();
    const sock = net.createConnection(SOCK);
    
    let buffer = "";
    
    sock.on('connect', () => {
        sendJson(sock, {
            type: "generate",
            session_id: session_id,
            prompt: prompt,
            stream: true
        });
    });
    
    sock.on('data', (chunk) => {
        buffer += chunk.toString();
        
        // Processar mensagens completas (separadas por \n)
        let newlineIndex;
        while ((newlineIndex = buffer.indexOf('\n')) >= 0) {
            const line = buffer.slice(0, newlineIndex).trim();
            buffer = buffer.slice(newlineIndex + 1);
            
            if (line) {
                try {
                    const event = JSON.parse(line);
                    ee.emit('event', event);
                } catch (e) {
                    // Se não for JSON válido, tratar como token de texto
                    ee.emit('event', { type: 'token', text: line });
                }
            }
        }
    });
    
    sock.on('end', () => {
        ee.emit('end');
    });
    
    sock.on('error', (error) => {
        ee.emit('error', error);
    });
    
    // Métodos de controle
    ee.abort = () => {
        sendJson(sock, {
            type: "abort",
            session_id: session_id
        });
    };
    
    ee.close = () => {
        sock.end();
    };
    
    return ee;
}

/**
 * Aborta a geração de uma sessão
 * @param {string} session_id - ID da sessão
 * @returns {Promise<boolean>} Sucesso da operação
 */
async function abort(session_id) {
    const sock = net.createConnection(SOCK);
    
    try {
        await once(sock, 'connect');
        
        sendJson(sock, {
            type: "abort",
            session_id: session_id
        });
        
        const response = await readJson(sock);
        sock.end();
        
        return response.ok || false;
    } catch (error) {
        sock.destroy();
        throw error;
    }
}

/**
 * Fecha uma sessão
 * @param {string} session_id - ID da sessão
 * @returns {Promise<boolean>} Sucesso da operação
 */
async function closeSession(session_id) {
    const sock = net.createConnection(SOCK);
    
    try {
        await once(sock, 'connect');
        
        sendJson(sock, {
            type: "close_session",
            session_id: session_id
        });
        
        const response = await readJson(sock);
        sock.end();
        
        return response.ok || false;
    } catch (error) {
        sock.destroy();
        throw error;
    }
}

/**
 * Obtém status do worker
 * @returns {Promise<Object>} Informações de status
 */
async function getStatus() {
    const sock = net.createConnection(SOCK);
    
    try {
        await once(sock, 'connect');
        
        sendJson(sock, {
            type: "status"
        });
        
        const response = await readJson(sock);
        sock.end();
        
        return response;
    } catch (error) {
        sock.destroy();
        throw error;
    }
}

/**
 * Verifica se o worker está disponível
 * @returns {Promise<boolean>} True se disponível
 */
async function isAvailable() {
    try {
        // Verificar se o socket existe
        if (!fs.existsSync(SOCK)) {
            return false;
        }
        
        const status = await getStatus();
        return status.ok && status.status === 'running';
    } catch (error) {
        return false;
    }
}

module.exports = {
    createSession,
    generateStream,
    abort,
    closeSession,
    getStatus,
    isAvailable,
    SOCK
};