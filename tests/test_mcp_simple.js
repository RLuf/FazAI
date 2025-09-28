// Teste simples para integração MCP com context7.com
const https = require('https');

const MCP_CONFIG = {
    apiKey: 'ctx7sk-f5999612-afbb-4341-8377-8fbf83832ca9',
    endpoint: 'https://api.context7.com/v1/mcp',
    contextWindowSize: 32000
};

async function testMCP() {
    console.log('=== Testando Integração MCP com context7.com ===\n');
    
    // Verificar conexão básica
    console.log('1. Verificando conexão com a API...');
    try {
        const response = await fetch(`${MCP_CONFIG.endpoint}/health`, {
            headers: {
                'Authorization': `Bearer ${MCP_CONFIG.apiKey}`,
                'Content-Type': 'application/json'
            }
        });
        
        const data = await response.json();
        console.log('✅ Status da API:', data.status || 'Conectado');
        
        // Testar pesquisa sobre libgemma
        console.log('\n2. Pesquisando sobre libgemma...');
        const searchResult = await searchAboutLibgemma();
        
        console.log('\n=== Resultados da Pesquisa ===');
        console.log(searchResult);
        
    } catch (error) {
        console.error('❌ Erro ao testar integração MCP:', error.message);
    }
}

async function searchAboutLibgemma() {
    const query = {
        query: 'libgemma model features and usage',
        max_results: 3,
        context_window: 2000
    };
    
    const response = await fetch(`${MCP_CONFIG.endpoint}/search`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${MCP_CONFIG.apiKey}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(query)
    });
    
    if (!response.ok) {
        throw new Error(`Erro na pesquisa: ${response.statusText}`);
    }
    
    return await response.json();
}

// Polyfill simples para fetch
function fetch(url, options = {}) {
    return new Promise((resolve, reject) => {
        const req = https.request(url, {
            method: options.method || 'GET',
            headers: options.headers || {},
            ...url.startsWith('https:') && {
                rejectUnauthorized: false // Apenas para teste
            }
        }, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                try {
                    res.data = data ? JSON.parse(data) : {};
                    resolve({
                        ok: res.statusCode >= 200 && res.statusCode < 300,
                        status: res.statusCode,
                        statusText: res.statusMessage,
                        json: () => Promise.resolve(res.data),
                        text: () => Promise.resolve(data)
                    });
                } catch (e) {
                    reject(e);
                }
            });
        });
        
        req.on('error', reject);
        
        if (options.body) {
            req.write(options.body);
        }
        
        req.end();
    });
}

// Executar o teste
testMCP().catch(console.error);
