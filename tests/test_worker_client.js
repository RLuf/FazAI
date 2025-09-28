#!/usr/bin/env node

/**
 * Cliente de teste para worker FazAI via socket
 * Testa comunicação IPC com fazai-gemma-worker
 */

const net = require('net');
const fs = require('fs');

const SOCKET_PATH = '/run/fazai/gemma.sock';

async function testWorkerConnection() {
    console.log('🔗 Testando conexão com worker via socket...');
    
    if (!fs.existsSync(SOCKET_PATH)) {
        console.error('❌ Socket não encontrado:', SOCKET_PATH);
        process.exit(1);
    }
    
    return new Promise((resolve, reject) => {
        const client = net.createConnection(SOCKET_PATH);
        let response = '';
        
        client.on('connect', () => {
            console.log('✅ Conectado ao worker');
            
            // Enviar comando de teste
            const testRequest = {
                type: 'status'
            };
            
            console.log('📤 Enviando:', JSON.stringify(testRequest));
            client.write(JSON.stringify(testRequest) + '\n');
        });
        
        client.on('data', (data) => {
            response += data.toString();
            console.log('📥 Resposta recebida:', data.toString().trim());
            
            try {
                const parsed = JSON.parse(response.trim());
                console.log('✅ Resposta válida:', parsed);
                client.end();
                resolve(parsed);
            } catch (e) {
                // Aguardar mais dados
                console.log('⏳ Aguardando mais dados...');
            }
        });
        
        client.on('error', (err) => {
            console.error('❌ Erro de conexão:', err.message);
            reject(err);
        });
        
        client.on('close', () => {
            console.log('🔚 Conexão fechada');
            if (response) {
                resolve(response);
            }
        });
        
        // Timeout de 10 segundos
        setTimeout(() => {
            client.destroy();
            reject(new Error('Timeout na conexão'));
        }, 10000);
    });
}

async function testGeneration() {
    console.log('\n🧠 Testando geração de texto...');
    
    return new Promise((resolve, reject) => {
        const client = net.createConnection(SOCKET_PATH);
        let response = '';
        
        client.on('connect', () => {
            console.log('✅ Conectado para geração');
            
            // Criar sessão primeiro
            const createSessionRequest = {
                type: 'create_session',
                params: {}
            };
            
            console.log('📤 Criando sessão...');
            client.write(JSON.stringify(createSessionRequest) + '\n');
        });
        
        client.on('data', (data) => {
            const dataStr = data.toString();
            console.log('📥 Dados recebidos:', dataStr.trim());
            
            try {
                const lines = dataStr.split('\n').filter(line => line.trim());
                for (const line of lines) {
                    const parsed = JSON.parse(line);
                    console.log('✅ Parsed:', parsed);
                    
                    if (parsed.session_id) {
                        console.log('🎯 Sessão criada:', parsed.session_id);
                        
                        // Agora enviar prompt
                        const generateRequest = {
                            type: 'generate',
                            session_id: parsed.session_id,
                            prompt: 'Olá, como você está?'
                        };
                        
                        console.log('📤 Enviando prompt...');
                        client.write(JSON.stringify(generateRequest) + '\n');
                    }
                    
                    if (parsed.type === 'token') {
                        process.stdout.write(parsed.text);
                    }
                    
                    if (parsed.type === 'stop') {
                        console.log('\n✅ Geração completa!');
                        client.end();
                        resolve('Sucesso!');
                        return;
                    }
                }
            } catch (e) {
                console.log('⏳ Aguardando JSON válido...');
            }
        });
        
        client.on('error', (err) => {
            console.error('❌ Erro:', err.message);
            reject(err);
        });
        
        client.on('close', () => {
            console.log('🔚 Conexão de geração fechada');
        });
        
        setTimeout(() => {
            client.destroy();
            reject(new Error('Timeout na geração'));
        }, 30000);
    });
}

async function main() {
    try {
        console.log('🚀 Iniciando teste do cliente worker...\n');
        
        // Teste 1: Status
        await testWorkerConnection();
        
        // Aguardar um pouco
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Teste 2: Geração
        await testGeneration();
        
        console.log('\n🎉 Todos os testes foram bem-sucedidos!');
        
    } catch (error) {
        console.error('\n💥 Erro nos testes:', error.message);
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}

module.exports = { testWorkerConnection, testGeneration };