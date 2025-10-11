#!/usr/bin/env node
const net = require('net');

console.log('🔍 Testando conexão com worker socket...');

const client = net.createConnection('/run/fazai/gemma.sock', () => {
    console.log('✅ Conectado ao socket');
    
    // Testar protocolo correto baseado nas strings encontradas
    const commands = [
        '{"type": "create_session"}',
        'create_session',
        '{"command": "create_session"}',
        '{"action": "create_session"}'
    ];
    
    let cmdIndex = 0;
    
    function sendNext() {
        if (cmdIndex < commands.length) {
            const cmd = commands[cmdIndex++];
            console.log(`📤 Enviando: ${cmd}`);
            client.write(cmd + '\n');
            setTimeout(sendNext, 2000); // Esperar 2s entre comandos
        } else {
            client.end();
        }
    }
    
    sendNext();
});

client.on('data', (data) => {
    console.log('📥 Resposta:', data.toString());
});

client.on('error', (err) => {
    console.log('❌ Erro:', err.message);
});

client.on('close', () => {
    console.log('🔌 Conexão fechada');
});

// Timeout de segurança
setTimeout(() => {
    console.log('⏰ Timeout - fechando conexão');
    client.destroy();
}, 10000);