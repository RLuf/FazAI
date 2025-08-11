#!/usr/bin/env node

/**
 * FazAI - Teste de Tarefas Complexas
 * Autor: Roger Luft
 * Versão: 1.0
 * 
 * Este script demonstra as funcionalidades do módulo de tarefas complexas
 */

const { ComplexTasksManager } = require('../lib/complex_tasks');
const { MCPOPNsense } = require('../lib/mcp_opnsense.js');

// Configuração de teste
const TEST_CONFIG = {
    port: 8081, // Porta diferente para não conflitar
    host: '127.0.0.1',
    staticDir: '/tmp/fazai_test/static',
    chartsDir: '/tmp/fazai_test/charts',
    dataDir: '/tmp/fazai_test/data'
};

async function testComplexTasks() {
    console.log('🚀 Iniciando teste de tarefas complexas...\n');

    try {
        // 1. Inicializar Complex Tasks Manager
        console.log('📊 Inicializando Complex Tasks Manager...');
        const manager = new ComplexTasksManager(TEST_CONFIG);
        
        // 2. Inicializar servidor HTTP
        console.log('🌐 Iniciando servidor HTTP...');
        await manager.initializeServer();
        console.log(`✅ Servidor iniciado em http://${TEST_CONFIG.host}:${TEST_CONFIG.port}\n`);

        // 3. Testar geração de gráficos
        console.log('📈 Testando geração de gráficos...');
        
        // Gráfico de linha
        const lineChart = await manager.executeTask('generate_chart', {
            type: 'line',
            title: 'Vendas Mensais 2024',
            xLabel: 'Mês',
            yLabel: 'Vendas (milhares)',
            data: {
                labels: ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun'],
                datasets: [{
                    label: 'Vendas',
                    data: [12, 19, 3, 5, 2, 3]
                }]
            }
        });
        console.log(`✅ Gráfico de linha criado: ${lineChart.result.chartId}`);

        // Gráfico de barras
        const barChart = await manager.executeTask('generate_chart', {
            type: 'bar',
            title: 'Produtos Mais Vendidos',
            xLabel: 'Produto',
            yLabel: 'Quantidade',
            data: {
                labels: ['Produto A', 'Produto B', 'Produto C', 'Produto D'],
                datasets: [{
                    label: 'Vendas',
                    data: [45, 32, 28, 15]
                }]
            }
        });
        console.log(`✅ Gráfico de barras criado: ${barChart.result.chartId}`);

        // 4. Testar publicação de gráficos
        console.log('\n📤 Testando publicação de gráficos...');
        
        const publishResult = await manager.executeTask('publish_chart', {
            chartId: lineChart.result.chartId,
            publishType: 'web',
            destination: 'https://exemplo.com/charts'
        });
        console.log(`✅ Gráfico publicado: ${JSON.stringify(publishResult)}`);

        // 5. Testar extração de dados
        console.log('\n📊 Testando extração de dados...');
        
        const dataResult = await manager.executeTask('extract_data', {
            source: 'https://jsonplaceholder.typicode.com/posts/1',
            format: 'json',
            outputFormat: 'json'
        });
        console.log(`✅ Dados extraídos: ${dataResult.result.dataId}`);

        // 6. Testar criação de dashboard
        console.log('\n🎛️ Testando criação de dashboard...');
        
        const dashboardResult = await manager.executeTask('create_dashboard', {
            title: 'Dashboard de Vendas',
            charts: [lineChart.result.chartId, barChart.result.chartId],
            layout: 'grid',
            theme: 'modern'
        });
        console.log(`✅ Dashboard criado: ${dashboardResult.result.dashboardId}`);

        // 7. Testar monitoramento do sistema
        console.log('\n📊 Testando monitoramento do sistema...');
        
        const monitoringResult = await manager.executeTask('monitor_system', {
            metrics: ['cpu', 'memory', 'disk'],
            interval: 5,
            duration: 30
        });
        console.log(`✅ Monitoramento iniciado: ${monitoringResult.result.monitoringId}`);

        // 8. Testar geração de relatório
        console.log('\n📋 Testando geração de relatório...');
        
        const reportResult = await manager.executeTask('generate_report', {
            type: 'system_status',
            data: { status: 'operational', uptime: '24h' },
            outputFormat: 'json'
        });
        console.log(`✅ Relatório gerado: ${reportResult.result.reportFile}`);

        // 9. Listar todos os gráficos criados
        console.log('\n📋 Listando gráficos criados...');
        const charts = Array.from(manager.charts.values());
        charts.forEach(chart => {
            console.log(`  - ${chart.id}: ${chart.title} (${chart.type})`);
        });

        // 10. Listar todas as fontes de dados
        console.log('\n📊 Listando fontes de dados...');
        const dataSources = Array.from(manager.dataSources.values());
        dataSources.forEach(source => {
            console.log(`  - ${source.id}: ${source.source} (${source.outputFormat})`);
        });

        // 11. Testar APIs REST
        console.log('\n🌐 Testando APIs REST...');
        
        // Listar gráficos via API
        const chartsResponse = await fetch(`http://${TEST_CONFIG.host}:${TEST_CONFIG.port}/api/charts`);
        const chartsData = await chartsResponse.json();
        console.log(`✅ API /api/charts retornou ${chartsData.charts.length} gráficos`);

        // Listar dados via API
        const dataResponse = await fetch(`http://${TEST_CONFIG.host}:${TEST_CONFIG.port}/api/data`);
        const dataData = await dataResponse.json();
        console.log(`✅ API /api/data retornou ${dataData.dataSources.length} fontes`);

        // 12. Aguardar um pouco para o monitoramento
        console.log('\n⏳ Aguardando 10 segundos para monitoramento...');
        await new Promise(resolve => setTimeout(resolve, 10000));

        // 13. Parar monitoramento
        console.log('\n🛑 Parando monitoramento...');
        // O monitoramento para automaticamente após a duração especificada

        console.log('\n🎉 Teste de tarefas complexas concluído com sucesso!');
        console.log(`\n📱 Acesse o dashboard em: http://${TEST_CONFIG.host}:${TEST_CONFIG.port}/dashboard/${dashboardResult.result.dashboardId}`);
        console.log(`📊 Visualize gráficos em: http://${TEST_CONFIG.host}:${TEST_CONFIG.port}/charts/`);

        // Manter servidor rodando para inspeção
        console.log('\n⏸️ Servidor mantido rodando para inspeção...');
        console.log('Pressione Ctrl+C para parar');

    } catch (error) {
        console.error('❌ Erro durante o teste:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

async function testMCPOPNsense() {
    console.log('\n🔒 Testando MCP OPNsense...\n');

    try {
        // Configuração de teste (substitua pelos valores reais)
        const opnsenseConfig = {
            host: '192.168.1.1',
            port: 443,
            username: 'admin',
            password: 'test_password',
            useSSL: true
        };

        console.log('🔐 Inicializando MCP OPNsense...');
        const mcp = new MCPOPNsense(opnsenseConfig);

        // Testar autenticação
        console.log('🔑 Testando autenticação...');
        try {
            const authResult = await mcp.authenticate();
            console.log(`✅ Autenticação: ${authResult ? 'Sucesso' : 'Falha'}`);
        } catch (error) {
            console.log(`⚠️ Autenticação falhou (esperado em ambiente de teste): ${error.message}`);
        }

        // Testar comandos MCP
        console.log('📋 Testando comandos MCP...');
        
        const commands = [
            { command: 'get_system_info', description: 'Informações do sistema' },
            { command: 'get_firewall_rules', description: 'Regras do firewall' },
            { command: 'get_interfaces', description: 'Interfaces de rede' },
            { command: 'get_services', description: 'Serviços do sistema' }
        ];

        for (const cmd of commands) {
            try {
                console.log(`  - Testando: ${cmd.description}...`);
                const result = await mcp.executeMCPCommand(cmd.command, {});
                console.log(`    ✅ ${cmd.command}: ${result.success ? 'Sucesso' : 'Falha'}`);
            } catch (error) {
                console.log(`    ⚠️ ${cmd.command}: Erro (esperado em ambiente de teste): ${error.message}`);
            }
        }

        console.log('\n✅ Teste MCP OPNsense concluído!');

    } catch (error) {
        console.error('❌ Erro durante teste MCP OPNsense:', error.message);
        console.error(error.stack);
    }
}

// Função principal
async function main() {
    console.log('🧪 FAZAI - Teste de Tarefas Complexas');
    console.log('=====================================\n');

    // Testar tarefas complexas
    await testComplexTasks();

    // Testar MCP OPNsense
    await testMCPOPNsense();

    console.log('\n🎯 Todos os testes concluídos!');
}

// Tratamento de sinais para limpeza
process.on('SIGINT', async () => {
    console.log('\n\n🛑 Recebido sinal de interrupção...');
    console.log('🧹 Limpando recursos...');
    
    // Aqui você pode adicionar limpeza se necessário
    
    console.log('👋 Saindo...');
    process.exit(0);
});

// Executar teste
if (require.main === module) {
    main().catch(error => {
        console.error('❌ Erro fatal:', error);
        process.exit(1);
    });
}

module.exports = {
    testComplexTasks,
    testMCPOPNsense
};