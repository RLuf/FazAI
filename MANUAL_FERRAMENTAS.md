# Manual de Utilização das Ferramentas do FazAI

## Visão Geral

Este manual documenta todas as ferramentas disponíveis no sistema FazAI, incluindo suas funcionalidades, parâmetros de configuração e exemplos de uso.

## Índice

1. [Ferramentas de Sistema](#ferramentas-de-sistema)
2. [Ferramentas de Segurança](#ferramentas-de-segurança)
3. [Ferramentas de Monitoramento](#ferramentas-de-monitoramento)
4. [Ferramentas de IA e RAG](#ferramentas-de-ia-e-rag)
5. [Ferramentas de Rede](#ferramentas-de-rede)
6. [Ferramentas de Configuração](#ferramentas-de-configuração)
7. [Ferramentas de Visualização](#ferramentas-de-visualização)
8. [Ferramentas de Desenvolvimento](#ferramentas-de-desenvolvimento)

---

## Ferramentas de Sistema

### 1. system-check.sh

**Descrição**: Verifica integridade, dependências e status dos serviços do sistema FazAI.

**Localização**: `/opt/fazai/tools/system-check.sh`

**Uso**:
```bash
# Verificação completa do sistema
sudo ./system-check.sh

# Verificação com log detalhado
sudo ./system-check.sh --verbose
```

**Funcionalidades**:
- Verificação de dependências (Node.js, Python, ferramentas do sistema)
- Status dos serviços (fazai, ollama, mcp-server)
- Integridade dos arquivos críticos
- Verificação de permissões
- Logs detalhados em `/var/log/fazai/system-check.log`

**Exemplo de Saída**:
```
[2025-08-10 15:30:00] ✓ Todas as dependências do sistema estão instaladas
[2025-08-10 15:30:01] ✓ Serviço fazai está rodando
[2025-08-10 15:30:02] ✓ Todos os arquivos críticos estão presentes
```

### 2. version-bump.sh

**Descrição**: Script automatizado para bump de versão do sistema FazAI.

**Localização**: `/opt/fazai/tools/version-bump.sh`

**Uso**:
```bash
# Bump automático (próxima versão patch)
./version-bump.sh -a

# Bump manual para versão específica
./version-bump.sh -v 1.43.0

# Simular bump (dry-run)
./version-bump.sh -a -d

# Bump com backup
./version-bump.sh -a -b
```

**Funcionalidades**:
- Detecção automática da versão atual
- Cálculo automático da próxima versão
- Atualização de 16+ arquivos simultaneamente
- Backup automático antes das alterações
- Validação das alterações aplicadas

**Arquivos Atualizados**:
- `package.json`
- `bin/fazai`
- `CHANGELOG.md`
- `install.sh`
- `uninstall.sh`
- E outros arquivos de configuração

---

## Ferramentas de Segurança

### 3. modsecurity_setup.js

**Descrição**: Configura e gerencia o ModSecurity para proteção de aplicações web.

**Localização**: `/opt/fazai/tools/modsecurity_setup.js`

**Uso**:
```bash
# Configuração automática
fazai "configure modsecurity for nginx"

# Verificação de status
fazai "check modsecurity status"

# Atualização de regras
fazai "update modsecurity rules"
```

**Funcionalidades**:
- Instalação automática do ModSecurity
- Configuração para Apache e Nginx
- Atualização de regras OWASP
- Monitoramento de logs de segurança
- Configuração de whitelist/blacklist

**Configuração**:
```ini
[modsecurity]
enabled = true
engine = on
rules_dir = /etc/modsecurity/rules
log_dir = /var/log/modsecurity
```

### 4. suricata_setup.js

**Descrição**: Configura o Suricata IDS/IPS para detecção de intrusões.

**Localização**: `/opt/fazai/tools/suricata_setup.js`

**Uso**:
```bash
# Instalação e configuração
fazai "install and configure suricata ids"

# Verificação de status
fazai "check suricata status"

# Atualização de regras
fazai "update suricata rules"
```

**Funcionalidades**:
- Instalação automática do Suricata
- Configuração de regras de detecção
- Integração com iptables/nftables
- Monitoramento em tempo real
- Alertas por email/Slack

### 5. crowdsec_setup.js

**Descrição**: Configura o CrowdSec para proteção colaborativa contra ataques.

**Localização**: `/opt/fazai/tools/crowdsec_setup.js`

**Uso**:
```bash
# Instalação e configuração
fazai "install and configure crowdsec"

# Verificação de status
fazai "check crowdsec status"

# Visualização de alertas
fazai "show crowdsec alerts"
```

**Funcionalidades**:
- Instalação automática do CrowdSec
- Configuração de bouncers
- Integração com firewalls
- Dashboard web de monitoramento
- Alertas em tempo real

---

## Ferramentas de Monitoramento

### 6. net_qos_monitor.js

**Descrição**: Monitora tráfego de rede por IP e aplica QoS (Quality of Service).

**Localização**: `/opt/fazai/tools/net_qos_monitor.js`

**Uso**:
```bash
# Iniciar monitoramento
fazai "start network qos monitoring"

# Verificar top IPs
fazai "show top network ips"

# Aplicar limitação de banda
fazai "limit bandwidth for ip 192.168.1.100 to 10Mbps"
```

**Funcionalidades**:
- Monitoramento de tráfego por IP
- Aplicação de QoS via tc (HTB)
- Gráficos HTML em tempo real
- Limitação automática de banda
- Relatórios de uso

**Dashboard**: `/var/www/html/fazai/top_ips.html`

### 7. ports_monitor.js

**Descrição**: Monitora portas de rede e detecta serviços não autorizados.

**Localização**: `/opt/fazai/tools/ports_monitor.js`

**Uso**:
```bash
# Iniciar monitoramento de portas
fazai "start port monitoring"

# Verificar portas abertas
fazai "show open ports"

# Configurar alertas
fazai "configure port alerts"
```

**Funcionalidades**:
- Monitoramento contínuo de portas
- Detecção de serviços não autorizados
- Alertas por email/notificação
- Relatórios de segurança
- Integração com firewall

### 8. snmp_monitor.js

**Descrição**: Monitora dispositivos de rede via SNMP.

**Localização**: `/opt/fazai/tools/snmp_monitor.js`

**Uso**:
```bash
# Configurar monitoramento SNMP
fazai "configure snmp monitoring for 192.168.1.1"

# Verificar status de dispositivos
fazai "check snmp devices status"

# Configurar alertas SNMP
fazai "setup snmp alerts"
```

**Funcionalidades**:
- Monitoramento via SNMP v1/v2c/v3
- Coleta de métricas de dispositivos
- Alertas baseados em thresholds
- Dashboard de monitoramento
- Integração com sistemas de monitoramento

---

## Ferramentas de IA e RAG

### 9. rag_ingest.js

**Descrição**: Sistema de RAG (Retrieval-Augmented Generation) para ingestão e indexação de documentos.

**Localização**: `/opt/fazai/tools/rag_ingest.js`

**Uso**:
```bash
# Ingerir documento PDF
fazai "ingest pdf document.pdf"

# Ingerir URL
fazai "ingest url https://example.com"

# Buscar informações
fazai "search rag for network configuration"
```

**Funcionalidades**:
- Suporte a PDF, DOCX, TXT, URLs
- Geração de embeddings via OpenAI ou Python
- Indexação no Qdrant
- Catálogo estático em `/var/www/html/fazai/rag/`
- Busca semântica de documentos

**Backends Suportados**:
- OpenAI (GPT embeddings)
- Python (sentence-transformers)
- Local (via Gemma)

### 10. auto_tool.js

**Descrição**: Gera ferramentas dinamicamente a partir de descrições em linguagem natural.

**Localização**: `/opt/fazai/tools/auto_tool.js`

**Uso**:
```bash
# Criar ferramenta para monitoramento de logs
fazai "create tool for log monitoring with email alerts"

# Criar ferramenta para backup automático
fazai "generate tool for automatic database backup"

# Listar ferramentas criadas
fazai "list auto-generated tools"
```

**Funcionalidades**:
- Geração automática de ferramentas
- Instalação automática em `/opt/fazai/tools/`
- Recarregamento automático do daemon
- Validação de código gerado
- Documentação automática

### 11. agent_supervisor.js

**Descrição**: Gerencia agentes remotos para coleta de telemetria e monitoramento.

**Localização**: `/opt/fazai/tools/agent_supervisor.js`

**Uso**:
```bash
# Instalar agente em servidor remoto
fazai "install agent on 192.168.1.100"

# Verificar status dos agentes
fazai "check agents status"

# Coletar telemetria
fazai "collect telemetry from all agents"
```

**Funcionalidades**:
- Instalação remota via SSH
- Coleta de telemetria (processos, rede, I/O)
- Envio para endpoint `/ingest`
- Monitoramento de saúde dos agentes
- Dashboard de agentes ativos

---

## Ferramentas de Rede

### 12. cloudflare.js

**Descrição**: Integração com Cloudflare para gerenciamento de DNS, firewall e zonas.

**Localização**: `/opt/fazai/tools/cloudflare.js`

**Uso**:
```bash
# Verificar status de zona
fazai "check cloudflare zone status for example.com"

# Configurar regra de firewall
fazai "add firewall rule to block 192.168.1.100"

# Atualizar registro DNS
fazai "update dns record for api.example.com to 10.0.0.1"
```

**Funcionalidades**:
- Gerenciamento de zonas DNS
- Configuração de regras de firewall
- Atualização de registros DNS
- Monitoramento de tráfego
- Análise de segurança

**Configuração**:
```ini
[cloudflare]
api_token = seu_token_aqui
zone_id = seu_zone_id_aqui
```

### 13. spamexperts.js

**Descrição**: Integração com SpamExperts para proteção anti-spam.

**Localização**: `/opt/fazai/tools/spamexperts.js`

**Uso**:
```bash
# Verificar status de domínio
fazai "check spamexperts status for example.com"

# Configurar política anti-spam
fazai "configure spam policy for example.com"

# Verificar relatórios
fazai "show spam reports for example.com"
```

**Funcionalidades**:
- Gerenciamento de domínios
- Configuração de políticas anti-spam
- Relatórios de spam
- Whitelist/blacklist
- Estatísticas de proteção

### 14. qdrant_setup.js

**Descrição**: Configura e gerencia o Qdrant para armazenamento de embeddings.

**Localização**: `/opt/fazai/tools/qdrant_setup.js`

**Uso**:
```bash
# Iniciar Qdrant via Docker
fazai "start qdrant vector database"

# Criar coleção para RAG
fazai "create rag collection in qdrant"

# Verificar status
fazai "check qdrant status"
```

**Funcionalidades**:
- Instalação via Docker
- Criação de coleções
- Configuração de índices
- Monitoramento de performance
- Backup e restauração

---

## Ferramentas de Configuração

### 15. fazai-config.js

**Descrição**: Ferramenta de configuração interativa para o sistema FazAI.

**Localização**: `/opt/fazai/tools/fazai-config.js`

**Uso**:
```bash
# Abrir configuração interativa
fazai config

# Editar configuração específica
fazai "edit openai configuration"

# Verificar configuração
fazai "show current configuration"
```

**Funcionalidades**:
- Interface TUI para configuração
- Validação de configurações
- Backup automático
- Teste de conectividade
- Gerenciamento de chaves de API

### 16. github-setup.sh

**Descrição**: Configura integração com GitHub para sincronização de código.

**Localização**: `/opt/fazai/tools/github-setup.sh`

**Uso**:
```bash
# Configurar integração GitHub
./github-setup.sh

# Configurar webhook
./github-setup.sh --webhook

# Verificar configuração
./github-setup.sh --check
```

**Funcionalidades**:
- Configuração de repositório
- Setup de webhooks
- Configuração de SSH keys
- Sincronização automática
- Deploy automático

---

## Ferramentas de Visualização

### 17. fazai_html_v1.sh

**Descrição**: Gera visualizações HTML para dados do sistema.

**Localização**: `/opt/fazai/tools/fazai_html_v1.sh`

**Uso**:
```bash
# Gerar gráfico de memória
fazai html memoria

# Gerar gráfico de disco
fazai html disco bar

# Gerar gráfico de processos
fazai html processos pie
```

**Funcionalidades**:
- Gráficos de barras, linha, pizza
- Dados em tempo real
- Exportação para HTML
- Personalização de cores
- Responsivo para mobile

**Tipos de Dados**:
- `memoria`: Uso de memória RAM
- `disco`: Uso de espaço em disco
- `processos`: Processos em execução
- `rede`: Estatísticas de rede
- `sistema`: Informações gerais do sistema

### 18. fazai_tui.js

**Descrição**: Dashboard TUI (Text User Interface) para monitoramento do sistema.

**Localização**: `/opt/fazai/tools/fazai_tui.js`

**Uso**:
```bash
# Abrir dashboard TUI
fazai tui

# Conectar via WebSocket
fazai interactive
```

**Funcionalidades**:
- Dashboard em tempo real
- Navegação por teclas
- Métricas do sistema
- Status dos serviços
- Logs em tempo real

**Atalhos**:
- `I`: Sessão interativa
- `S`: Status dos serviços
- `L`: Visualizar logs
- `Q`: Sair

### 19. fazai_web.sh

**Descrição**: Interface web para gerenciamento do sistema FazAI.

**Localização**: `/opt/fazai/tools/fazai_web.sh`

**Uso**:
```bash
# Iniciar interface web
fazai web

# Abrir no navegador
fazai web --open
```

**Funcionalidades**:
- Dashboard web responsivo
- Gerenciamento de ferramentas
- Configuração via web
- Monitoramento em tempo real
- Logs e relatórios

---

## Ferramentas de Desenvolvimento

### 20. sync-changes.sh

**Descrição**: Sincroniza mudanças entre diferentes ambientes de desenvolvimento.

**Localização**: `/opt/fazai/tools/sync-changes.sh`

**Uso**:
```bash
# Sincronizar mudanças
./sync-changes.sh

# Sincronizar com backup
./sync-changes.sh --backup

# Verificar diferenças
./sync-changes.sh --diff
```

**Funcionalidades**:
- Sincronização automática
- Backup antes da sincronização
- Detecção de conflitos
- Logs de sincronização
- Rollback automático

### 21. sync-keys.sh

**Descrição**: Sincroniza chaves de API entre diferentes ambientes.

**Localização**: `/opt/fazai/tools/sync-keys.sh`

**Uso**:
```bash
# Sincronizar chaves
./sync-keys.sh

# Verificar chaves
./sync-keys.sh --check

# Backup de chaves
./sync-keys.sh --backup
```

**Funcionalidades**:
- Sincronização de chaves de API
- Criptografia de chaves sensíveis
- Backup seguro
- Validação de chaves
- Logs de sincronização

---

## Comandos de Sistema

### Comandos Básicos

```bash
# Informações do sistema
fazai kernel          # Versão do kernel
fazai sistema         # Informações completas do sistema
fazai memoria         # Uso de memória
fazai disco           # Uso de disco
fazai processos       # Lista de processos
fazai rede            # Interfaces de rede
fazai data            # Data e hora
fazai uptime          # Tempo de atividade
```

### Comandos de Serviço

```bash
# Gerenciamento de serviço
fazai start           # Iniciar serviço
fazai stop            # Parar serviço
fazai restart         # Reiniciar serviço
fazai status          # Status do serviço
fazai reload          # Recarregar módulos
```

### Comandos de Logs

```bash
# Gerenciamento de logs
fazai logs [n]        # Últimas n entradas de log
fazai limpar-logs     # Limpar arquivo de log
fazai web             # Interface web de logs
```

### Comandos de IA

```bash
# Modo MCPS (planejamento passo a passo)
fazai mcps "atualizar sistema"
fazai mcps "instalar pacote nginx"
fazai mcps "configurar firewall"

# Perguntas diretas
fazai -q "como configurar nginx?"
fazai --question "qual a melhor prática para backup?"

# Pesquisa web
fazai -w "configuração nginx ubuntu"
fazai --web "melhores práticas firewall"
```

---

## Configuração do Sistema

### Arquivo de Configuração Principal

**Localização**: `/etc/fazai/fazai.conf`

**Estrutura**:
```ini
[ai_provider]
provider = openrouter
enable_fallback = true
max_retries = 3

[openrouter]
api_key = sua_chave_aqui
default_model = deepseek/deepseek-r1-0528:free

[ollama]
enabled = true
endpoint = http://localhost:11434
models = ["mixtral", "llama2"]

[cache]
enabled = true
max_size = 1000
ttl = 3600

[logs]
level = info
rotation = true
max_size = 10MB
backups = 5
```

### Variáveis de Ambiente

```bash
# Configuração da API
export FAZAI_API_URL="http://localhost:3120"

# Configuração do WebSocket
export FAZAI_WS_URL="ws://localhost:3120"

# Modo debug
export FAZAI_DEBUG="true"
```

---

## Troubleshooting

### Problemas Comuns

#### 1. Serviço não inicia

```bash
# Verificar status
sudo systemctl status fazai

# Verificar logs
sudo journalctl -u fazai -f

# Verificar dependências
fazai check-deps

# Reiniciar serviço
sudo systemctl restart fazai
```

#### 2. Erro de conexão com API

```bash
# Verificar se o daemon está rodando
sudo systemctl status fazai

# Verificar porta
sudo netstat -tlnp | grep 3120

# Verificar firewall
sudo ufw status
```

#### 3. Problemas com provedores de IA

```bash
# Verificar configuração
fazai config

# Testar conectividade
fazai "test openai connection"

# Verificar chaves de API
cat /etc/fazai/fazai.conf | grep api_key
```

#### 4. Problemas com ferramentas

```bash
# Verificar permissões
ls -la /opt/fazai/tools/

# Verificar dependências
fazai check-deps

# Recarregar módulos
fazai reload
```

### Logs e Debug

#### Localização dos Logs

```bash
# Log principal
/var/log/fazai/fazai.log

# Log de erros
/var/log/fazai/fazai-error.log

# Log do sistema
/var/log/fazai/system-check.log

# Log de sincronização
/var/log/fazai/sync-changes.log
```

#### Modo Debug

```bash
# Ativar debug
fazai -d "comando"

# Debug com stream
fazai -d -s "comando"

# Debug com logs detalhados
export FAZAI_DEBUG="true"
fazai "comando"
```

---

## Integração com Outros Sistemas

### Prometheus

**Endpoint**: `/metrics`

**Métricas Disponíveis**:
- `fazai_commands_total`: Total de comandos executados
- `fazai_cache_hits`: Hits do cache
- `fazai_cache_misses`: Misses do cache
- `fazai_api_requests`: Requisições para APIs de IA
- `fazai_response_time`: Tempo de resposta

### Grafana

**Dashboard**: Disponível em `/var/www/html/fazai/grafana/`

**Gráficos**:
- Uso de recursos do sistema
- Performance das ferramentas
- Status dos serviços
- Métricas de rede

### Webhooks

**Configuração**:
```ini
[webhooks]
enabled = true
endpoint = https://seu-webhook.com/fazai
events = command_executed, error_occurred, service_status_changed
```

---

## Desenvolvimento e Extensibilidade

### Criando Novas Ferramentas

#### Estrutura Básica

```javascript
// /opt/fazai/tools/minha_ferramenta.js
const { Tool } = require('@fazai/core');

class MinhaFerramenta extends Tool {
    constructor() {
        super({
            name: 'minha_ferramenta',
            description: 'Descrição da minha ferramenta',
            parameters: {
                param1: { type: 'string', required: true },
                param2: { type: 'number', required: false }
            }
        });
    }

    async execute(params) {
        // Lógica da ferramenta
        return { success: true, result: 'Resultado' };
    }
}

module.exports = MinhaFerramenta;
```

#### Instalação

```bash
# Copiar para diretório de ferramentas
sudo cp minha_ferramenta.js /opt/fazai/tools/

# Definir permissões
sudo chmod +x /opt/fazai/tools/minha_ferramenta.js

# Recarregar módulos
fazai reload
```

### Plugins

#### Estrutura de Plugin

```javascript
// /opt/fazai/mods/meu_plugin.js
module.exports = {
    name: 'meu_plugin',
    version: '1.0.0',
    description: 'Descrição do plugin',
    
    onLoad: async (fazai) => {
        // Inicialização do plugin
    },
    
    onCommand: async (command, context) => {
        // Processamento de comandos
    },
    
    onUnload: async () => {
        // Limpeza do plugin
    }
};
```

---

## Conclusão

Este manual cobre todas as ferramentas disponíveis no sistema FazAI, fornecendo informações detalhadas sobre uso, configuração e troubleshooting. Para suporte adicional, consulte:

- **Documentação Online**: https://github.com/RLuf/FazAI
- **Issues**: https://github.com/RLuf/FazAI/issues
- **Wiki**: https://github.com/RLuf/FazAI/wiki
- **Logs**: `/var/log/fazai/`

---

*Última atualização: 10/08/2025*
*Versão do FazAI: 1.42.3*