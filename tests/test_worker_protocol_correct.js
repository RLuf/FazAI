#!/usr/bin/env node
const net = require('net');

console.log('🚀 Testando protocolo CORRETO com worker Gemma...');

function testCommand(cmdName, jsonData, timeout = 5000) {
    return new Promise((resolve) => {
        console.log(`\n🧪 Testando: ${cmdName}`);
        console.log(`📤 Enviando: ${JSON.stringify(jsonData)}`);
        
        const client = net.createConnection('/run/fazai/gemma.sock', () => {
            console.log('✅ Conectado ao socket');
            client.write(JSON.stringify(jsonData) + '\n');
        });
        
        let response = '';
        
        client.on('data', (data) => {
            response += data.toString();
            console.log('📥 Resposta:', data.toString());
        });
        
        client.on('error', (err) => {
            console.log('❌ Erro:', err.message);
            resolve({ success: false, error: err.message });
        });
        
        client.on('close', () => {
            console.log('🔌 Conexão fechada');
            resolve({ success: true, response });
        });
        
        setTimeout(() => {
            client.end();
            console.log('⏰ Timeout - fechando conexão');
        }, timeout);
    });
}

async function testProtocol() {
    // 1. Testar status primeiro
    await testCommand('STATUS', { 
        type: 'status' 
    });
    
    // 2. Testar model_info
    await testCommand('MODEL_INFO', { 
        type: 'model_info' 
    });
    
    // 3. Testar create_session com parâmetros
    await testCommand('CREATE_SESSION', { 
        type: 'create_session',
        params: {
            max_tokens: 100,
            temperature: 0.8,
            top_p: 0.9
        }
    });
    
    // 4. Testar generate com session_id e prompt
    await testCommand('GENERATE', { 
        type: 'generate',
        session_id: 'test_session_123',
        prompt: 'Olá, como está?',
        params: {
            max_tokens: 50
        }
    });
    
    console.log('\n✅ Teste de protocolo concluído!');
}

testProtocol().catch(console.error);