/**
 * FazAI - Plugin de Monitoramento do Sistema
 * 
 * Este plugin lida com comandos relacionados ao monitoramento e exibição
 * de informações do sistema, como processos em execução, uso de recursos, etc.
 */

const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);
const fs = require('fs');
const os = require('os');
const path = require('path');

/**
 * Obtém a lista de processos em execução
 * @returns {Promise<Object>} - Resultado da operação
 */
const getRunningProcesses = async () => {
  try {
    // Usa o comando ps para listar processos
    const { stdout } = await execPromise('ps aux --sort=-%cpu | head -11');
    
    return {
      success: true,
      message: 'Processos em execução (ordenados por uso de CPU):',
      stdout
    };
  } catch (error) {
    return {
      success: false,
      message: `Erro ao obter processos: ${error.message}`,
      error: error.toString()
    };
  }
};

/**
 * Obtém informações sobre o uso de recursos do sistema
 * @returns {Promise<Object>} - Resultado da operação
 */
const getSystemResources = async () => {
  try {
    // Coleta informações de CPU
    const cpuInfo = os.cpus();
    const cpuCount = cpuInfo.length;
    const cpuModel = cpuInfo[0].model;
    
    // Coleta informações de memória
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const memUsagePercent = ((usedMem / totalMem) * 100).toFixed(2);
    
    // Coleta informações de disco
    const { stdout: diskInfo } = await execPromise('df -h / | tail -n 1');
    
    // Coleta informações de carga do sistema
    const loadAvg = os.loadavg();
    
    // Formata a saída
    const output = `
Informações do Sistema:
---------------------
Hostname: ${os.hostname()}
Plataforma: ${os.platform()} ${os.release()}
Uptime: ${(os.uptime() / 3600).toFixed(2)} horas

CPU:
  Modelo: ${cpuModel}
  Núcleos: ${cpuCount}
  Carga (1m, 5m, 15m): ${loadAvg[0].toFixed(2)}, ${loadAvg[1].toFixed(2)}, ${loadAvg[2].toFixed(2)}

Memória:
  Total: ${(totalMem / 1024 / 1024 / 1024).toFixed(2)} GB
  Livre: ${(freeMem / 1024 / 1024 / 1024).toFixed(2)} GB
  Uso: ${memUsagePercent}%

Disco:
${diskInfo}
`;
    
    return {
      success: true,
      message: 'Informações de recursos do sistema:',
      stdout: output
    };
  } catch (error) {
    return {
      success: false,
      message: `Erro ao obter informações de recursos: ${error.message}`,
      error: error.toString()
    };
  }
};

/**
 * Gera um gráfico de consumo de recursos
 * @param {number} updateInterval - Intervalo de atualização em minutos
 * @param {string} outputPort - Porta para o servidor HTTP
 * @returns {Promise<Object>} - Resultado da operação
 */
const generateResourceGraph = async (updateInterval = 5, outputPort = 8080) => {
  try {
    // Diretório para armazenar os dados e o HTML
    const dataDir = path.join(os.tmpdir(), 'fazai-monitor');
    
    // Cria o diretório se não existir
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    
    // Arquivo HTML para o gráfico
    const htmlFile = path.join(dataDir, 'index.html');
    
    // Cria o arquivo HTML com o gráfico
    const htmlContent = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>FazAI - Monitor de Recursos</title>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <style>
        body {
            font-family: Arial, sans-serif;
            margin: 20px;
            background-color: #f5f5f5;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
            background-color: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        h1 {
            color: #333;
            text-align: center;
        }
        .chart-container {
            position: relative;
            height: 300px;
            margin-bottom: 30px;
        }
        .info-box {
            background-color: #f9f9f9;
            border: 1px solid #ddd;
            padding: 15px;
            border-radius: 5px;
            margin-top: 20px;
        }
        .update-time {
            text-align: right;
            color: #666;
            font-size: 0.9em;
            margin-top: 10px;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>FazAI - Monitor de Recursos do Sistema</h1>
        
        <div class="chart-container">
            <canvas id="cpuChart"></canvas>
        </div>
        
        <div class="chart-container">
            <canvas id="memoryChart"></canvas>
        </div>
        
        <div class="chart-container">
            <canvas id="diskIOChart"></canvas>
        </div>
        
        <div class="info-box">
            <h3>Informações do Sistema</h3>
            <div id="systemInfo">Carregando...</div>
        </div>
        
        <div class="update-time">
            Última atualização: <span id="lastUpdate">-</span>
        </div>
    </div>

    <script>
        // Configuração dos gráficos
        const cpuCtx = document.getElementById('cpuChart').getContext('2d');
        const memoryCtx = document.getElementById('memoryChart').getContext('2d');
        const diskIOCtx = document.getElementById('diskIOChart').getContext('2d');
        
        // Dados iniciais
        const initialData = {
            labels: [],
            cpu: [],
            memory: [],
            diskRead: [],
            diskWrite: []
        };
        
        // Criar gráficos
        const cpuChart = new Chart(cpuCtx, {
            type: 'line',
            data: {
                labels: initialData.labels,
                datasets: [{
                    label: 'Uso de CPU (%)',
                    data: initialData.cpu,
                    borderColor: 'rgb(75, 192, 192)',
                    tension: 0.1,
                    fill: false
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 100
                    }
                }
            }
        });
        
        const memoryChart = new Chart(memoryCtx, {
            type: 'line',
            data: {
                labels: initialData.labels,
                datasets: [{
                    label: 'Uso de Memória (%)',
                    data: initialData.memory,
                    borderColor: 'rgb(153, 102, 255)',
                    tension: 0.1,
                    fill: false
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 100
                    }
                }
            }
        });
        
        const diskIOChart = new Chart(diskIOCtx, {
            type: 'line',
            data: {
                labels: initialData.labels,
                datasets: [
                    {
                        label: 'Leitura de Disco (MB/s)',
                        data: initialData.diskRead,
                        borderColor: 'rgb(255, 99, 132)',
                        tension: 0.1,
                        fill: false
                    },
                    {
                        label: 'Escrita de Disco (MB/s)',
                        data: initialData.diskWrite,
                        borderColor: 'rgb(54, 162, 235)',
                        tension: 0.1,
                        fill: false
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false
            }
        });
        
        // Função para atualizar os dados
        function updateData() {
            fetch('/api/system-stats')
                .then(response => response.json())
                .then(data => {
                    // Atualizar dados dos gráficos
                    const now = new Date().toLocaleTimeString();
                    
                    // Limitar o número de pontos no gráfico
                    const maxPoints = 20;
                    
                    if (cpuChart.data.labels.length >= maxPoints) {
                        cpuChart.data.labels.shift();
                        cpuChart.data.datasets[0].data.shift();
                        
                        memoryChart.data.labels.shift();
                        memoryChart.data.datasets[0].data.shift();
                        
                        diskIOChart.data.labels.shift();
                        diskIOChart.data.datasets[0].data.shift();
                        diskIOChart.data.datasets[1].data.shift();
                    }
                    
                    // Adicionar novos dados
                    cpuChart.data.labels.push(now);
                    cpuChart.data.datasets[0].data.push(data.cpu);
                    cpuChart.update();
                    
                    memoryChart.data.labels.push(now);
                    memoryChart.data.datasets[0].data.push(data.memory);
                    memoryChart.update();
                    
                    diskIOChart.data.labels.push(now);
                    diskIOChart.data.datasets[0].data.push(data.diskRead);
                    diskIOChart.data.datasets[1].data.push(data.diskWrite);
                    diskIOChart.update();
                    
                    // Atualizar informações do sistema
                    document.getElementById('systemInfo').innerHTML = \`
                        <p><strong>Hostname:</strong> \${data.hostname}</p>
                        <p><strong>Sistema:</strong> \${data.platform} \${data.release}</p>
                        <p><strong>Uptime:</strong> \${data.uptime} horas</p>
                        <p><strong>CPU:</strong> \${data.cpuModel} (\${data.cpuCores} núcleos)</p>
                        <p><strong>Carga:</strong> \${data.loadAvg.join(', ')}</p>
                    \`;
                    
                    // Atualizar hora da última atualização
                    document.getElementById('lastUpdate').textContent = new Date().toLocaleString();
                })
                .catch(error => console.error('Erro ao atualizar dados:', error));
        }
        
        // Atualizar dados iniciais
        updateData();
        
        // Configurar intervalo de atualização (em milissegundos)
        setInterval(updateData, ${updateInterval * 60 * 1000});
    </script>
</body>
</html>
    `;
    
    fs.writeFileSync(htmlFile, htmlContent);
    
    // Inicia um servidor HTTP simples
    const http = require('http');
    const server = http.createServer((req, res) => {
      if (req.url === '/api/system-stats') {
        // Endpoint para fornecer dados em tempo real
        getSystemResourcesData().then(data => {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(data));
        }).catch(error => {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: error.message }));
        });
      } else {
        // Serve o arquivo HTML
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(fs.readFileSync(htmlFile));
      }
    });
    
    // Inicia o servidor na porta especificada
    server.listen(outputPort, () => {
      console.log(`Servidor de monitoramento iniciado em http://localhost:${outputPort}`);
    });
    
    return {
      success: true,
      message: `Gráfico de recursos iniciado em http://localhost:${outputPort}`,
      stdout: `Monitor de recursos do sistema iniciado com atualização a cada ${updateInterval} minutos.\nAcesse http://localhost:${outputPort} para visualizar.`
    };
  } catch (error) {
    return {
      success: false,
      message: `Erro ao gerar gráfico de recursos: ${error.message}`,
      error: error.toString()
    };
  }
};

/**
 * Obtém dados de recursos do sistema para o gráfico
 * @returns {Promise<Object>} - Dados de recursos
 */
const getSystemResourcesData = async () => {
  // Coleta informações de CPU
  const cpuInfo = os.cpus();
  const cpuCount = cpuInfo.length;
  const cpuModel = cpuInfo[0].model;
  
  // Calcula uso de CPU (média de todos os núcleos)
  let totalIdle = 0;
  let totalTick = 0;
  
  cpuInfo.forEach(cpu => {
    for (const type in cpu.times) {
      totalTick += cpu.times[type];
    }
    totalIdle += cpu.times.idle;
  });
  
  const cpuUsage = 100 - (totalIdle / totalTick * 100);
  
  // Coleta informações de memória
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const memUsagePercent = ((totalMem - freeMem) / totalMem * 100).toFixed(2);
  
  // Simula dados de I/O de disco (em uma implementação real, usaríamos iostat ou similar)
  const diskRead = Math.random() * 50; // MB/s
  const diskWrite = Math.random() * 30; // MB/s
  
  return {
    timestamp: new Date().toISOString(),
    hostname: os.hostname(),
    platform: os.platform(),
    release: os.release(),
    uptime: (os.uptime() / 3600).toFixed(2),
    cpuModel,
    cpuCores: cpuCount,
    loadAvg: os.loadavg().map(val => val.toFixed(2)),
    cpu: parseFloat(cpuUsage.toFixed(2)),
    memory: parseFloat(memUsagePercent),
    diskRead: parseFloat(diskRead.toFixed(2)),
    diskWrite: parseFloat(diskWrite.toFixed(2))
  };
};

/**
 * Executa o plugin com base no comando fornecido
 * @param {string} command - Comando completo
 * @returns {Promise<Object>} - Resultado da operação
 */
exports.execute = async (command) => {
  // Comando para mostrar processos em execução
  if (command.includes('mostra') && command.includes('processos')) {
    return await getRunningProcesses();
  }
  
  // Comando para mostrar informações de recursos do sistema
  if ((command.includes('mostra') || command.includes('exibe')) && 
      (command.includes('recursos') || command.includes('sistema'))) {
    return await getSystemResources();
  }
  
  // Comando para gerar gráfico de recursos
  if (command.includes('gere') && command.includes('grafico') && command.includes('recursos')) {
    // Extrai o intervalo de atualização, se especificado
    let updateInterval = 5; // padrão: 5 minutos
    let outputPort = 8080; // padrão: porta 8080
    
    // Procura por padrões como "atualiza em X minutos"
    const intervalMatch = command.match(/atualiza\s+em\s+(\d+)\s+minutos?/i);
    if (intervalMatch) {
      updateInterval = parseInt(intervalMatch[1]);
    }
    
    // Procura por padrões como "porta X"
    const portMatch = command.match(/porta\s+(\d+)/i);
    if (portMatch) {
      outputPort = parseInt(portMatch[1]);
    }
    
    return await generateResourceGraph(updateInterval, outputPort);
  }
  
  // Comando não reconhecido por este plugin
  return {
    success: false,
    message: 'Comando não reconhecido pelo plugin de sistema.'
  };
};
