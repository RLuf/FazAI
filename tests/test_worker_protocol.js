#!/usr/bin/env node

const net = require('net');

async function testProtocol(testName, data) {
    return new Promise((resolve) => {
        console.log(`\n🧪 ${testName}`);
        
        const client = net.createConnection('/run/fazai/gemma.sock');
        let response = '';
        let timeout;
        
        client.on('connect', () => {
            console.log('✅ Conectado');
            client.write(data);
            
            // Timeout de 5 segundos
            timeout = setTimeout(() => {
                console.log('⏱️  Timeout');
                client.destroy();
                resolve(null);
            }, 5000);
        });
        
        client.on('data', (chunk) => {
            response += chunk.toString();
            console.log('📥 Resposta:', chunk.toString().trim());
        });
        
        client.on('error', (err) => {
            console.log('❌ Erro:', err.message);
            clearTimeout(timeout);
            resolve(null);
        });
        
        client.on('close', () => {
            console.log('🔚 Conexão fechada');
            clearTimeout(timeout);
            resolve(response);
        });
    });
}

async function main() {
    console.log('🚀 Testando protocolos do worker...\n');
    
    // Teste 1: JSON status (formato esperado baseado nas strings)
    await testProtocol('Status JSON', JSON.stringify({
        type: "status"
    }) + '\n');
    
    // Teste 2: JSON create_session
    await testProtocol('Criar Sessão', JSON.stringify({
        type: "create_session",
        params: {}
    }) + '\n');
    
    // Teste 3: Apenas line break para ver resposta
    await testProtocol('Somente \\n', '\n');
    
    // Teste 4: String vazia para manter conexão
    await testProtocol('String vazia', '');
    
    console.log('\n🎯 Testes concluídos');
}

main().catch(console.error);