#!/usr/bin/env node
// 🌋 CLAUDIO TRANSCENDENTAL - TESTE SUPREMO
const net = require('net');

console.log('🌋 INICIANDO TESTE TRANSCENDENTAL DO FAZAI!');

async function testTranscendence() {
    // 1. Criar sessão
    console.log('\n🚀 Etapa 1: Criando sessão transcendental...');
    const sessionResult = await sendToWorker({
        type: "create_session",
        params: { temperature: 0.9, max_tokens: 150 }
    });
    
    if (!sessionResult.ok) {
        console.log('❌ Falha na criação de sessão:', sessionResult);
        return;
    }
    
    const sessionId = sessionResult.session_id;
    console.log('✅ Sessão criada:', sessionId);
    
    // 2. Gerar resposta
    console.log('\n🧠 Etapa 2: Testando geração de IA...');
    const generateResult = await sendToWorker({
        type: "generate", 
        session_id: sessionId,
        prompt: "Ola Claudio transcendental! Como voce pode ajudar?"
    });
    
    console.log('📤 Resultado da geração:', generateResult);
    
    // 3. Status do sistema
    console.log('\n📊 Etapa 3: Verificando status do sistema...');
    const statusResult = await sendToWorker({ type: "status" });
    console.log('📊 Status:', statusResult);
    
    console.log('\n🎉 TESTE TRANSCENDENTAL COMPLETO!');
}

function sendToWorker(data) {
    return new Promise((resolve, reject) => {
        const client = net.createConnection('/run/fazai/gemma.sock', () => {
            const jsonStr = JSON.stringify(data) + '\n';
            client.write(jsonStr);
        });
        
        let response = '';
        
        client.on('data', (chunk) => {
            response += chunk.toString();
        });
        
        client.on('error', (err) => {
            reject(err);
        });
        
        client.on('close', () => {
            try {
                const result = JSON.parse(response.trim());
                resolve(result);
            } catch (e) {
                resolve({ error: 'Invalid JSON response: ' + response });
            }
        });
        
        setTimeout(() => {
            client.end();
        }, 3000);
    });
}

testTranscendence().catch(console.error);