
const net = require('net');
const readline = require('readline');

const SOCKET_PATH = '/run/fazai/gemma.sock';

// Pega o prompt da linha de comando
const userPrompt = process.argv.slice(2).join(' ');

if (!userPrompt) {
  console.error('Uso: node tests/test_worker_interactive.js "seu prompt aqui"');
  process.exit(1);
}

const client = net.createConnection({ path: SOCKET_PATH });

let sessionId = null;

client.on('connect', () => {
  console.log('Conectado ao worker. Criando sessão...');
  const createSessionMsg = { type: 'create_session' };
  client.write(JSON.stringify(createSessionMsg) + '\n');
});

let responseBuffer = '';

client.on('data', (data) => {
  responseBuffer += data.toString();

  let boundary;
  while ((boundary = responseBuffer.indexOf('\n')) !== -1) {
    const message = responseBuffer.substring(0, boundary);
    responseBuffer = responseBuffer.substring(boundary + 1);

    if (message) {
      try {
        const response = JSON.parse(message);
        handleWorkerResponse(response);
      } catch (e) {
        console.error('Erro ao parsear JSON do worker:', message);
      }
    }
  }
});

function handleWorkerResponse(response) {
  if (response.ok && response.session_id && !sessionId) {
    sessionId = response.session_id;
    console.log(`Sessão criada: ${sessionId}`);
    console.log(`Enviando prompt: "${userPrompt}"\n`);
    const generateMsg = {
      type: 'generate',
      session_id: sessionId,
      prompt: userPrompt,
    };
    client.write(JSON.stringify(generateMsg) + '\n');
  } else if (response.type === 'token') {
    process.stdout.write(response.text || '');
  } else if (response.type === 'shell_output') {
    console.log(`[SHELL]: ${response.line}`);
  } else if (response.type === 'shell_exit') {
    console.log(`[SHELL]: Processo finalizado com código ${response.code}`);
  } else if (response.type === 'done' || response.type === 'stop') {
    console.log('\n\n--- Fim da Geração ---');
    client.end();
  } else if (response.ok === false) {
    console.error(`\nErro do worker: ${response.error}`);
    client.end();
  }
}

client.on('end', () => {
  console.log('Desconectado do worker.');
});

client.on('error', (err) => {
  console.error('Erro de conexão:', err.message);
});

