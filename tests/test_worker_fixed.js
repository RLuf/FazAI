#!/usr/bin/env node
const net = require('net');

console.log('🔧 Testando worker com JSON corrigido...');

function testWorker() {
    const client = net.createConnection('/run/fazai/gemma.sock', () => {
        console.log('✅ Conectado ao worker');
        
        // JSON bem formado com newline
        const cmd = {"type": "status"};
        const jsonStr = JSON.stringify(cmd) + '\n';
        
        console.log('📤 Enviando JSON válido:', JSON.stringify(cmd));
        console.log('📤 String raw:', JSON.stringify(jsonStr));
        
        client.write(jsonStr);
    });
    
    client.on('data', (data) => {
        console.log('🎉 SUCESSO! Resposta:', data.toString());
    });
    
    client.on('error', (err) => {
        console.log('❌ Erro:', err.message);
    });
    
    client.on('close', () => {
        console.log('🔌 Conexão fechada');
        
        // Testar create_session agora
        testCreateSession();
    });
    
    setTimeout(() => {
        client.end();
    }, 3000);
}

function testCreateSession() {
    console.log('\n🧪 Testando create_session...');
    
    const client = net.createConnection('/run/fazai/gemma.sock', () => {
        console.log('✅ Conectado para create_session');
        
        const cmd = {
            "type": "create_session",
            "params": {
                "temperature": 0.8,
                "max_tokens": 100
            }
        };
        
        const jsonStr = JSON.stringify(cmd) + '\n';
        console.log('📤 Enviando create_session:', JSON.stringify(cmd));
        
        client.write(jsonStr);
    });
    
    client.on('data', (data) => {
        console.log('🎉 Create session resposta:', data.toString());
    });
    
    client.on('error', (err) => {
        console.log('❌ Erro create_session:', err.message);
    });
    
    setTimeout(() => {
        client.end();
    }, 3000);
}

testWorker();