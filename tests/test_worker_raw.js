#!/usr/bin/env node
const net = require('net');

console.log('🔍 Testando comunicação RAW com worker...');

// Testar diferentes formatos sem JSON
function testRaw(name, data) {
    return new Promise((resolve) => {
        console.log(`\n🧪 ${name}: ${data}`);
        
        const client = net.createConnection('/run/fazai/gemma.sock', () => {
            console.log('✅ Conectado');
            client.write(data);
        });
        
        client.on('data', (chunk) => {
            console.log('📥 Resposta RAW:', chunk.toString());
        });
        
        client.on('error', (err) => {
            console.log('❌ Erro:', err.message);
            resolve();
        });
        
        setTimeout(() => {
            client.end();
            resolve();
        }, 2000);
    });
}

async function testFormats() {
    // 1. Comando simples como string
    await testRaw('String simples', 'status\n');
    
    // 2. JSON mais básico possível
    await testRaw('JSON básico', '{"action":"status"}\n');
    
    // 3. Testar se expects um header ou length
    await testRaw('Com length header', 'Content-Length: 17\r\n\r\n{"type":"status"}\n');
    
    // 4. Teste binário simples
    await testRaw('Binário', Buffer.from([0x01, 0x02, 0x03]));
}

testFormats().catch(console.error);