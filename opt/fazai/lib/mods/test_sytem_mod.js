const ffi = require('ffi-napi-v22');
const ref = require('ref-napi');
const path = require('path');

// Define tipos personalizados
const charPtr = ref.refType(ref.types.char);

// Carrega a biblioteca
const systemMod = ffi.Library(path.join(__dirname, 'system_mod.so'), {
    // Funções básicas
    'fazai_mod_init': ['int', []],
    'fazai_mod_exec': ['int', ['string', 'string', charPtr, 'int']],
    'fazai_test': ['int', []],
    'fazai_get_pid': ['int', []],
    'fazai_get_timestamp': ['long', []],
    'fazai_health_check': ['int', []],
    'fazai_heavy_work': ['int', ['int']],
    'fazai_get_system_info': ['int', [charPtr, 'int']],
    'fazai_mod_cleanup': ['void', []]
});

// Função para testar o módulo
function testSystemMod() {
    console.log('=== Testando Módulo Sistema Fazai ===\n');
    
    // Inicializa o módulo
    console.log('1. Inicializando módulo...');
    const initResult = systemMod.fazai_mod_init();
    console.log(`   Status: ${initResult === 0 ? 'OK' : 'ERRO'}\n`);
    
    // Teste básico
    console.log('2. Teste básico...');
    const testResult = systemMod.fazai_test();
    console.log(`   Resultado: ${testResult}\n`);
    
    // PID do processo
    console.log('3. PID do processo...');
    const pid = systemMod.fazai_get_pid();
    console.log(`   PID: ${pid}\n`);
    
    // Timestamp atual
    console.log('4. Timestamp atual...');
    const timestamp = systemMod.fazai_get_timestamp();
    const date = new Date(timestamp * 1000);
    console.log(`   Timestamp: ${timestamp} (${date.toLocaleString()})\n`);
    
    // Informações do sistema
    console.log('5. Informações do sistema...');
    const buffer = Buffer.alloc(1024);
    const sysResult = systemMod.fazai_get_system_info(buffer, 1024);
    if (sysResult === 0) {
        console.log(`   ${buffer.toString('utf8', 0, buffer.indexOf(0))}\n`);
    } else {
        console.log('   Erro ao obter informações do sistema\n');
    }
    
    // Trabalho pesado
    console.log('6. Teste de performance...');
    const startTime = Date.now();
    const heavyResult = systemMod.fazai_heavy_work(1000000);
    const endTime = Date.now();
    console.log(`   Resultado: ${heavyResult}`);
    console.log(`   Tempo: ${endTime - startTime}ms\n`);
    
    // Health check
    console.log('7. Verificação de saúde...');
    const healthResult = systemMod.fazai_health_check();
    console.log(`   Status: ${healthResult === 1 ? 'Saudável' : 'Problemas'}\n`);
    
    // Finaliza o módulo
    console.log('8. Testando fazai_mod_exec...');
    const outputBuffer = Buffer.alloc(1024);
    
    // Teste comando help
    const helpResult = systemMod.fazai_mod_exec('help', null, outputBuffer, 1024);
    console.log(`   Help result: ${helpResult}`);
    console.log(`   Help output: ${outputBuffer.toString('utf8', 0, outputBuffer.indexOf(0))}\n`);
    
    // Teste comando test
    outputBuffer.fill(0);
    const testExecResult = systemMod.fazai_mod_exec('test', null, outputBuffer, 1024);
    console.log(`   Test exec result: ${testExecResult}`);
    console.log(`   Test exec output: ${outputBuffer.toString('utf8', 0, outputBuffer.indexOf(0))}\n`);
    
    // Teste comando work
    outputBuffer.fill(0);
    const workExecResult = systemMod.fazai_mod_exec('work', '5000', outputBuffer, 1024);
    console.log(`   Work exec result: ${workExecResult}`);
    console.log(`   Work exec output: ${outputBuffer.toString('utf8', 0, outputBuffer.indexOf(0))}\n`);
    
    // Finaliza o módulo
    console.log('9. Finalizando módulo...');
    systemMod.fazai_mod_cleanup();
    
    console.log('\n=== Teste concluído ===');
}

// Executa o teste
try {
    testSystemMod();
} catch (error) {
    console.error('Erro durante o teste:', error.message);
}
