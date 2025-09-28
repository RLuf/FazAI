#!/usr/bin/env node

const net = require('net');

function testFormat(format, data) {
    return new Promise((resolve) => {
        console.log(`\n🧪 Testando formato: ${format}`);
        const client = net.createConnection('/run/fazai/gemma.sock');
        
        client.on('connect', () => {
            console.log('✅ Conectado');
            client.write(data);
        });
        
        client.on('data', (response) => {
            console.log('📥 Resposta:', response.toString());
            client.end();
            resolve(response.toString());
        });
        
        client.on('error', (err) => {
            console.log('❌ Erro:', err.message);
            resolve(null);
        });
        
        client.on('close', () => {
            console.log('🔚 Fechado');
            resolve(null);
        });
        
        setTimeout(() => {
            client.destroy();
            resolve(null);
        }, 3000);
    });
}

async function main() {
    console.log('🧪 Testando diferentes formatos de protocolo...');
    
    // Teste 1: String simples
    await testFormat('string simples', 'status\n');
    
    // Teste 2: JSON com quebra de linha
    await testFormat('JSON c/ \\n', JSON.stringify({type: "status"}) + '\n');
    
    // Teste 3: JSON sem quebra de linha
    await testFormat('JSON s/ \\n', JSON.stringify({type: "status"}));
    
    // Teste 4: Comando texto
    await testFormat('comando texto', 'help\n');
    
    // Teste 5: Prompt direto
    await testFormat('prompt direto', 'Olá, como você está?\n');
}

main().catch(console.error);