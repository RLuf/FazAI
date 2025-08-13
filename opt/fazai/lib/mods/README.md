# Módulos FazAI - Tarefas Complexas e MCP OPNsense

## Visão Geral

Este diretório contém módulos especializados para o FazAI que implementam funcionalidades avançadas:

- **Complex Tasks Manager**: Sistema completo para geração de gráficos, publicação HTTP e automação de workflows
- **MCP OPNsense**: Integração com firewall OPNsense via Model Context Protocol

## Complex Tasks Manager

### Funcionalidades Principais

#### 1. Geração de Gráficos
- **Tipos suportados**: Linha, barras, pizza, área, dispersão
- **Formatos de saída**: PNG, JPG, SVG, PDF
- **Bibliotecas**: Python + matplotlib, numpy
- **Estilos**: Seaborn, personalizável

#### 2. Servidor HTTP Integrado
- **Porta configurável** (padrão: 8080)
- **APIs REST** para todas as operações
- **Interface web** para visualização
- **CORS habilitado** para integração externa

#### 3. Sistema de Publicação
- **Web**: Upload para servidores HTTP/FTP
- **Email**: Envio automático de gráficos
- **API**: Integração com sistemas externos
- **FTP/SFTP**: Upload para servidores de arquivos

#### 4. Extração de Dados
- **URLs**: APIs REST, páginas web
- **Arquivos**: CSV, JSON, XML, Excel
- **Bancos de dados**: MySQL, PostgreSQL, SQLite
- **Sistema**: Métricas, logs, processos

#### 5. Dashboards Interativos
- **Layouts**: Grid, flexbox, responsivo
- **Temas**: Claro, escuro, personalizado
- **Widgets**: Gráficos, tabelas, métricas
- **Exportação**: PDF, HTML, imagem

#### 6. Monitoramento do Sistema
- **Métricas**: CPU, memória, disco, rede
- **Intervalos configuráveis** (padrão: 60s)
- **Duração limitada** para evitar sobrecarga
- **Alertas**: Notificações por email/webhook

#### 7. Geração de Relatórios
- **Tipos**: Status do sistema, performance, segurança
- **Templates**: HTML, Markdown, LaTeX
- **Formatos**: PDF, HTML, JSON, CSV
- **Automação**: Agendamento, triggers

### API REST

#### Endpoints Principais

```
GET  /api/charts          - Lista todos os gráficos
GET  /api/charts/:id      - Obtém gráfico específico
POST /api/tasks           - Executa tarefa complexa
GET  /api/data            - Lista fontes de dados
GET  /api/data/:source    - Obtém dados específicos
```

#### Exemplo de Uso

```bash
# Gerar gráfico
curl -X POST http://localhost:8080/api/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "type": "generate_chart",
    "params": {
      "type": "line",
      "title": "Vendas Mensais",
      "xLabel": "Mês",
      "yLabel": "Vendas (milhares)"
    }
  }'

# Publicar gráfico
curl -X POST http://localhost:8080/api/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "type": "publish_chart",
    "params": {
      "chartId": "chart_123",
      "publishType": "web",
      "destination": "https://exemplo.com/charts"
    }
  }'
```

### Configuração

```ini
[complex_tasks]
enabled = true
enable_server = true
port = 8080
host = 0.0.0.0
static_dir = /var/www/fazai
charts_dir = /var/cache/fazai/charts
data_dir = /var/lib/fazai/data
default_chart_format = png
chart_dpi = 300
```

## MCP OPNsense

### Funcionalidades

#### 1. Autenticação
- **Username/Password**: Autenticação tradicional
- **API Key**: Autenticação segura para produção
- **SSL/TLS**: Suporte a certificados
- **Timeout configurável**: Evita travamentos

#### 2. Gerenciamento de Firewall
- **Listar regras**: Obter todas as regras ativas
- **Criar regras**: Adicionar novas regras de firewall
- **Atualizar regras**: Modificar regras existentes
- **Deletar regras**: Remover regras obsoletas

#### 3. Controle de Interfaces
- **Status**: Verificar estado das interfaces
- **Configuração**: Obter configurações de rede
- **Estatísticas**: Bytes enviados/recebidos
- **Monitoramento**: Latência, perda de pacotes

#### 4. Gerenciamento de Serviços
- **Iniciar/Parar**: Controle de serviços do sistema
- **Status**: Verificar estado dos serviços
- **Configuração**: Aplicar mudanças
- **Logs**: Acesso aos logs de sistema

#### 5. Backup e Restauração
- **Configuração**: Backup das configurações
- **Histórico**: Versões anteriores
- **Restauração**: Rollback para versão anterior
- **Exportação**: Backup para sistemas externos

### Comandos MCP

```javascript
// Informações do sistema
await mcp.executeMCPCommand('get_system_info', {});

// Listar regras do firewall
await mcp.executeMCPCommand('get_firewall_rules', {});

// Criar regra de firewall
await mcp.executeMCPCommand('create_firewall_rule', {
  interface: 'WAN',
  direction: 'in',
  protocol: 'tcp',
  source: 'any',
  destination: '192.168.1.100',
  port: '80',
  description: 'Web Server Access'
});

// Iniciar serviço
await mcp.executeMCPCommand('start_service', {
  service: 'unbound'
});

// Aplicar configuração
await mcp.executeMCPCommand('apply_config', {});
```

### Configuração

```ini
[opnsense]
enabled = true
host = 192.168.1.1
port = 443
use_ssl = true
username = admin
password = your_password_here
# OU
api_key = your_api_key_here
timeout = 30000
retry_attempts = 3
cache_enabled = true
```

## Integração com FazAI

### Carregamento Automático

Os módulos são carregados automaticamente pelo sistema principal:

1. **Inicialização**: Durante o startup do daemon
2. **Recarregamento**: Via endpoint `/reload`
3. **Configuração**: Baseada em arquivos .conf

### Ferramentas Disponíveis

Após o carregamento, as seguintes ferramentas ficam disponíveis:

- `complex_tasks`: Gerenciador de tarefas complexas
- `opnsense`: Integração MCP com OPNsense

### Exemplo de Uso no FazAI

```bash
# Via CLI
fazai "gere um gráfico de linha com dados de vendas mensais"

# Via API
curl -X POST http://localhost:3000/command \
  -H "Content-Type: application/json" \
  -d '{
    "command": "crie um dashboard com métricas do sistema e publique na web"
  }'
```

## Testes

### Executar Testes

```bash
# Teste completo
node opt/fazai/tools/test_complex_tasks.js

# Teste específico
node -e "
const { testComplexTasks } = require('./opt/fazai/tools/test_complex_tasks.js');
testComplexTasks();
"
```

### Verificar Funcionamento

1. **Servidor HTTP**: http://localhost:8080
2. **APIs**: http://localhost:8080/api/charts
3. **Dashboards**: http://localhost:8080/dashboard/
4. **Gráficos**: http://localhost:8080/charts/

## Dependências

### Python
- matplotlib >= 3.5.0
- numpy >= 1.21.0
- seaborn >= 0.11.0

### Node.js
- express >= 4.18.1
- axios >= 0.27.2
- winston >= 3.8.1

### Sistema
- Python 3.8+
- Node.js 18+
- Acesso a diretórios de sistema

## Troubleshooting

### Problemas Comuns

1. **Erro de permissão**: Verificar acesso aos diretórios
2. **Porta em uso**: Alterar porta na configuração
3. **Dependências Python**: Instalar matplotlib/numpy
4. **SSL OPNsense**: Verificar certificados

### Logs

- **Complex Tasks**: `/var/log/fazai/complex_tasks.log`
- **FazAI Principal**: `/var/log/fazai/fazai.log`
- **Sistema**: `journalctl -u fazai`

### Debug

```bash
# Habilitar logs detalhados
export LOG_LEVEL=debug

# Testar módulo específico
node -e "
const { ComplexTasksManager } = require('./opt/fazai/lib/complex_tasks.js');
const manager = new ComplexTasksManager({ port: 8082 });
manager.initializeServer().then(() => console.log('OK'));
"
```

## Contribuição

### Estrutura de Arquivos

```
opt/fazai/lib/mods/
├── complex_tasks.js      # Módulo principal de tarefas complexas
├── mcp_opnsense.js      # Integração MCP com OPNsense
├── README.md            # Esta documentação
└── build.sh            # Script de compilação (se aplicável)
```

### Padrões de Código

- **ES6+**: Usar sintaxe moderna do JavaScript
- **Async/Await**: Preferir promises assíncronas
- **Error Handling**: Tratar erros adequadamente
- **Logging**: Usar winston para logs estruturados
- **Documentação**: Comentar funções complexas

### Testes

- **Unitários**: Testar funções individuais
- **Integração**: Testar módulos completos
- **E2E**: Testar fluxos completos
- **Performance**: Verificar escalabilidade

## Licença

Creative Commons Attribution 4.0 International (CC BY 4.0)

## Suporte

- **Issues**: GitHub Issues
- **Documentação**: Este README
- **Exemplos**: Scripts de teste incluídos
- **Comunidade**: Contribuições bem-vindas