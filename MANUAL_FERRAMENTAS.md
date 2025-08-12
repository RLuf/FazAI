# FazAI - Manual Completo de Ferramentas v1.42.3

Este manual apresenta todas as ferramentas disponíveis no FazAI, organizadas por categoria funcional, com exemplos práticos de uso e explicações detalhadas.

## Índice

1. [Ferramentas de Sistema e Monitoramento](#ferramentas-de-sistema-e-monitoramento)
2. [Ferramentas de Segurança e Telemetria](#ferramentas-de-segurança-e-telemetria)
3. [Ferramentas de Desenvolvimento e Versionamento](#ferramentas-de-desenvolvimento-e-versionamento)
4. [Ferramentas de Integração e APIs](#ferramentas-de-integração-e-apis)
5. [Ferramentas de Monitoramento de Rede](#ferramentas-de-monitoramento-de-rede)
6. [Ferramentas de IA e RAG](#ferramentas-de-ia-e-rag)
7. [Ferramentas de Configuração e Gerenciamento](#ferramentas-de-configuração-e-gerenciamento)

---

## Ferramentas de Sistema e Monitoramento

### 1. system-check.sh

**Descrição**: Script de verificação completa do sistema FazAI, incluindo dependências, serviços e integridade de arquivos.

**Localização**: `bin/tools/system-check.sh`

**Uso**:
```bash
# Executar verificação completa
sudo ./bin/tools/system-check.sh

# Verificar apenas dependências
sudo ./bin/tools/system-check.sh --deps-only

# Verificar apenas serviços
sudo ./bin/tools/system-check.sh --services-only
```

**Funcionalidades**:
- Verifica dependências do sistema (Node.js 22+, Python 3.10+)
- Valida status dos serviços (fazai, ollama, mcp-server)
- Verifica integridade de arquivos críticos
- Valida permissões de diretórios
- Gera relatório detalhado em `/var/log/fazai/system-check.log`

**Exemplo de Saída**:
```
[2025-08-10 15:30:00] ✓ Todas as dependências do sistema estão instaladas
[2025-08-10 15:30:01] ✓ Serviço fazai está rodando
[2025-08-10 15:30:02] ✓ Todos os arquivos críticos estão presentes
[2025-08-10 15:30:03] ✓ Todas as permissões estão corretas
```

### 2. sync-changes.sh

**Descrição**: Sincroniza alterações entre diferentes ambientes de desenvolvimento e produção.

**Localização**: `bin/tools/sync-changes.sh`

**Uso**:
```bash
# Sincronizar alterações para produção
sudo ./bin/tools/sync-changes.sh --env=prod

# Sincronizar com backup
sudo ./bin/tools/sync-changes.sh --env=prod --backup

# Simular sincronização (dry-run)
sudo ./bin/tools/sync-changes.sh --env=prod --dry-run
```

**Funcionalidades**:
- Sincronização de arquivos de configuração
- Backup automático antes da sincronização
- Validação de integridade após sincronização
- Suporte a múltiplos ambientes
- Logs detalhados de todas as operações

---

## Ferramentas de Segurança e Telemetria

### 3. modsecurity_setup

**Descrição**: Configura e gerencia o ModSecurity para proteção contra ataques web.

**Uso via FazAI**:
```bash
# Configurar ModSecurity para Apache
fazai configure modsecurity for apache with rules=OWASP_CRS

# Verificar status do ModSecurity
fazai check modsecurity status

# Atualizar regras do ModSecurity
fazai update modsecurity rules
```

**Funcionalidades**:
- Instalação automática do ModSecurity
- Configuração de regras OWASP CRS
- Integração com Apache/Nginx
- Monitoramento de ataques em tempo real
- Logs de segurança estruturados

### 4. suricata_setup

**Descrição**: Configura o Suricata para detecção de intrusão em rede (IDS/IPS).

**Uso via FazAI**:
```bash
# Instalar e configurar Suricata
fazai setup suricata with mode=ids rules=emerging-threats

# Configurar regras personalizadas
fazai configure suricata rules from file=/path/to/custom.rules

# Monitorar alertas do Suricata
fazai monitor suricata alerts
```

**Funcionalidades**:
- Detecção de ataques em tempo real
- Regras Emerging Threats atualizadas
- Integração com sistemas de log
- Alertas configuráveis
- Performance otimizada para redes de alta velocidade

### 5. crowdsec_setup

**Descrição**: Configura o CrowdSec para proteção colaborativa contra ataques.

**Uso via FazAI**:
```bash
# Instalar CrowdSec
fazai install crowdsec with bouncer=nginx

# Configurar cenários personalizados
fazai configure crowdsec scenarios for web_application

# Verificar reputação de IPs
fazai check crowdsec reputation for ip=192.168.1.1
```

**Funcionalidades**:
- Proteção colaborativa baseada em comunidade
- Bouncers para diferentes serviços
- Cenários configuráveis
- API para integração
- Dashboard web de monitoramento

### 6. monit_setup

**Descrição**: Configura o Monit para monitoramento de processos e serviços.

**Uso via FazAI**:
```bash
# Configurar Monit para monitorar serviços
fazai setup monit to monitor services=nginx,mysql,redis

# Configurar alertas por email
fazai configure monit alerts via email=sysadmin@company.com

# Verificar status dos serviços monitorados
fazai check monit status
```

**Funcionalidades**:
- Monitoramento de processos
- Restart automático de serviços
- Alertas configuráveis
- Interface web de monitoramento
- Logs de eventos estruturados

---

## Ferramentas de Desenvolvimento e Versionamento

### 7. version-bump.sh

**Descrição**: Script automatizado para incremento de versão em todos os arquivos do projeto.

**Localização**: `bin/tools/version-bump.sh`

**Uso**:
```bash
# Bump automático (próxima versão patch)
sudo ./bin/tools/version-bump.sh -a

# Bump manual para versão específica
sudo ./bin/tools/version-bump.sh -v 1.43.0

# Simular bump (dry-run)
sudo ./bin/tools/version-bump.sh -a -d

# Bump com backup automático
sudo ./bin/tools/version-bump.sh -a -b
```

**Funcionalidades**:
- Detecção automática da versão atual
- Cálculo automático da próxima versão
- Atualização de 16+ arquivos simultaneamente
- Backup automático antes das alterações
- Validação das alterações aplicadas
- Modo dry-run para simulação
- Logs coloridos e detalhados

**Arquivos Atualizados**:
- `package.json`
- `bin/fazai`
- `opt/fazai/lib/main.js`
- `install.sh`
- `uninstall.sh`
- `CHANGELOG.md`
- E outros arquivos de documentação

**Exemplo de Uso**:
```bash
# Antes: v1.42.2
sudo ./bin/tools/version-bump.sh -a

# Após: v1.42.3 (automático)
# Todos os arquivos atualizados
# Backup criado em /var/backups/version-bump/
# Logs detalhados da operação
```

### 8. github-setup.sh

**Descrição**: Configura ambiente de desenvolvimento GitHub com hooks e workflows.

**Localização**: `bin/tools/github-setup.sh`

**Uso**:
```bash
# Configurar hooks do GitHub
sudo ./bin/tools/github-setup.sh --hooks

# Configurar workflows CI/CD
sudo ./bin/tools/github-setup.sh --workflows

# Configuração completa
sudo ./bin/tools/github-setup.sh --all
```

**Funcionalidades**:
- Configuração de hooks de pre-commit
- Setup de workflows GitHub Actions
- Configuração de branches protegidas
- Integração com sistemas de qualidade de código
- Templates de issues e pull requests

---

## Ferramentas de Integração e APIs

### 9. cloudflare

**Descrição**: Integração com a API da Cloudflare para gerenciamento de DNS, firewall e zonas.

**Uso via FazAI**:
```bash
# Criar registro DNS A
fazai use cloudflare api to create A record domain=example.com name=www value=192.168.1.100

# Configurar regras de firewall
fazai configure cloudflare firewall rules for zone=example.com

# Verificar status de uma zona
fazai check cloudflare zone status for domain=example.com

# Gerenciar certificados SSL
fazai manage cloudflare ssl certificates for domain=example.com
```

**Funcionalidades**:
- Gerenciamento completo de DNS
- Configuração de firewall
- Gerenciamento de certificados SSL
- Análise de tráfego
- Proteção DDoS
- Integração com WAF

### 10. spamexperts

**Descrição**: Integração com SpamExperts para proteção contra spam e malware.

**Uso via FazAI**:
```bash
# Configurar domínio no SpamExperts
fazai setup spamexperts for domain=example.com

# Configurar políticas anti-spam
fazai configure spamexperts policies for domain=example.com

# Verificar estatísticas de spam
fazai check spamexperts stats for domain=example.com

# Gerenciar listas de permissão/bloqueio
fazai manage spamexperts whitelist for domain=example.com
```

**Funcionalidades**:
- Proteção contra spam
- Filtros de malware
- Políticas configuráveis
- Relatórios detalhados
- Integração com servidores de email

---

## Ferramentas de Monitoramento de Rede

### 11. snmp_monitor

**Descrição**: Monitoramento de dispositivos de rede via SNMP.

**Uso via FazAI**:
```bash
# Consultar OIDs específicos
fazai monitor snmp host=192.168.1.1 community=public oids=1.3.6.1.2.1.1.1.0

# Monitorar interface de rede
fazai monitor snmp interface=eth0 on host=192.168.1.1

# Configurar monitoramento contínuo
fazai setup snmp monitoring for host=192.168.1.1 interval=30s
```

**Funcionalidades**:
- Consulta de OIDs SNMP
- Monitoramento de interfaces
- Coleta de estatísticas de rede
- Alertas configuráveis
- Integração com sistemas de monitoramento

### 12. net_qos_monitor

**Descrição**: Monitoramento de qualidade de serviço de rede com limitação de tráfego.

**Uso via FazAI**:
```bash
# Monitorar tráfego por IP
fazai monitor network qos for ip=192.168.1.100

# Limitar largura de banda
fazai limit bandwidth for ip=192.168.1.100 to 10Mbps

# Gerar gráfico de top IPs
fazai generate network graph for top_ips
```

**Funcionalidades**:
- Monitoramento de tráfego por IP
- Limitação via tc (HTB)
- Gráficos HTML em tempo real
- Integração com nftables
- Dashboard web em `/var/www/html/fazai/top_ips.html`

### 13. prometheus

**Descrição**: Configuração e gerenciamento do Prometheus para coleta de métricas.

**Uso via FazAI**:
```bash
# Instalar Prometheus
fazai setup prometheus with storage=local retention=30d

# Configurar targets de monitoramento
fazai configure prometheus targets for services=nginx,mysql,redis

# Verificar status do Prometheus
fazai check prometheus status
```

**Funcionalidades**:
- Coleta de métricas
- Armazenamento de séries temporais
- Alertas configuráveis
- Integração com Grafana
- API REST para consultas

### 14. grafana

**Descrição**: Configuração e gerenciamento do Grafana para visualização de dados.

**Uso via FazAI**:
```bash
# Instalar Grafana
fazai setup grafana with port=3000

# Configurar datasource Prometheus
fazai configure grafana datasource prometheus url=http://localhost:9090

# Criar dashboard padrão
fazai create grafana dashboard for fazai_metrics
```

**Funcionalidades**:
- Visualização de métricas
- Dashboards configuráveis
- Alertas visuais
- Integração com múltiplas fontes de dados
- API para automação

---

## Ferramentas de IA e RAG

### 15. qdrant_setup

**Descrição**: Configuração do Qdrant para busca semântica e RAG (Retrieval-Augmented Generation).

**Uso via FazAI**:
```bash
# Instalar Qdrant via Docker
fazai setup qdrant with port=6333 collection=linux_networking

# Criar coleção para documentação técnica
fazai create qdrant collection name=linux_docs dimension=384

# Indexar documentos
fazai index documents in qdrant collection=linux_docs
```

**Funcionalidades**:
- Banco de dados vetorial
- Busca semântica
- Indexação de documentos
- API REST para consultas
- Integração com modelos de IA

### 16. rag_ingest

**Descrição**: Ferramenta para ingestão de documentos e geração de embeddings para RAG.

**Uso via FazAI**:
```bash
# Indexar documento PDF
fazai ingest document type=pdf path=/path/to/document.pdf

# Indexar URL
fazai ingest url https://example.com/documentation

# Gerar catálogo de documentos
fazai generate rag catalog for collection=linux_docs
```

**Funcionalidades**:
- Suporte a PDF, DOCX, TXT
- Geração de embeddings
- Indexação no Qdrant
- Catálogo estático em HTML
- Backend OpenAI ou Python local

### 17. auto_tool

**Descrição**: Geração dinâmica de ferramentas a partir de descrição em linguagem natural.

**Uso via FazAI**:
```bash
# Gerar ferramenta para monitoramento de spam
fazai generate tool for "monitor spam emails and block suspicious senders"

# Criar ferramenta de backup
fazai create tool for "automated backup of critical files with rotation"

# Gerar ferramenta de monitoramento de rede
fazai generate tool for "network traffic analysis with anomaly detection"
```

**Funcionalidades**:
- Geração automática de código
- Integração com daemon FazAI
- Recarregamento automático
- Validação de código gerado
- Documentação automática

---

## Ferramentas de Configuração e Gerenciamento

### 18. agent_supervisor

**Descrição**: Gerenciamento de agentes remotos para coleta de telemetria.

**Uso via FazAI**:
```bash
# Instalar agente em host remoto
fazai deploy agent to host=192.168.1.100 via ssh

# Configurar coleta de telemetria
fazai configure agent telemetry for host=192.168.1.100

# Monitorar status dos agentes
fazai monitor agents status
```

**Funcionalidades**:
- Deploy via SSH
- Coleta de telemetria
- Monitoramento de processos
- Análise de rede e I/O
- Envio para endpoint `/ingest`

### 19. install-llamacpp.sh

**Descrição**: Script de instalação do llama.cpp para modelos locais de IA.

**Localização**: `bin/tools/install-llamacpp.sh`

**Uso**:
```bash
# Instalar llama.cpp
sudo ./bin/tools/install-llamacpp.sh

# Instalar com suporte a GPU
sudo ./bin/tools/install-llamacpp.sh --with-gpu

# Instalar versão específica
sudo ./bin/tools/install-llamacpp.sh --version=0.2.20
```

**Funcionalidades**:
- Compilação otimizada
- Suporte a CPU/GPU
- Modelos pré-compilados
- Integração com FazAI
- Configuração automática

---

## Comandos de Sistema Rápido

### Informações do Sistema
```bash
fazai kernel              # Versão do kernel
fazai sistema             # Informações completas do sistema
fazai memoria             # Uso de memória
fazai disco               # Uso de disco
fazai processos           # Lista de processos
fazai rede                # Interfaces de rede
fazai data                # Data e hora
fazai uptime              # Tempo de atividade
```

### Visualização e Interface
```bash
fazai html <tipo> [graf]  # Gráficos HTML
fazai tui                  # Dashboard TUI
fazai interactive          # Sessão interativa
fazai web                  # Interface web
```

### Gerenciamento de Serviços
```bash
fazai start                # Iniciar serviço
fazai stop                 # Parar serviço
fazai restart              # Reiniciar serviço
fazai status               # Status do serviço
fazai reload               # Recarregar plugins
```

### Configuração e Cache
```bash
fazai config               # Configuração interativa
fazai cache                # Status do cache
fazai cache-clear          # Limpar cache
```

---

## Modo MCPS (Planejamento Passo a Passo)

### Uso Básico
```bash
# Planejar atualização do sistema
fazai mcps atualizar o sistema

# Planejar instalação de pacote
fazai mcps instalar nginx

# Planejar configuração de rede
fazai mcps configurar rede para servidor web
```

### Com Stream em Tempo Real
```bash
# Executar com saída em tempo real
fazai mcps --stream atualizar o sistema

# Com modo debug
fazai mcps -d --stream configurar firewall
```

---

## Integração com Sistemas Externos

### Prometheus/Grafana
```bash
# Setup completo
fazai setup monitoring stack with prometheus and grafana

# Configurar métricas customizadas
fazai configure prometheus metrics for fazai_operations

# Criar dashboard
fazai create grafana dashboard for system_monitoring
```

### SNMP
```bash
# Monitorar dispositivo
fazai monitor snmp device=192.168.1.1

# Configurar alertas
fazai setup snmp alerts for critical_oids
```

### APIs de Terceiros
```bash
# Cloudflare
fazai configure cloudflare for domain=example.com

# SpamExperts
fazai setup spamexperts for email_protection
```

---

## Troubleshooting e Resolução de Problemas

### Problemas Comuns

#### 1. Serviço não inicia
```bash
# Verificar status
fazai status

# Verificar logs
fazai logs 50

# Verificar dependências
fazai check-deps

# Reiniciar serviço
fazai restart
```

#### 2. Erro de API
```bash
# Verificar configuração
fazai config

# Testar conectividade
fazai check-deps

# Verificar chaves de API
cat /etc/fazai/fazai.conf
```

#### 3. Problemas de Performance
```bash
# Verificar uso de recursos
fazai memoria
fazai disco
fazai processos

# Verificar cache
fazai cache

# Limpar cache se necessário
fazai cache-clear
```

### Logs e Diagnóstico
```bash
# Ver logs em tempo real
fazai logs 100

# Ver logs de erro
tail -f /var/log/fazai/fazai_error.log

# Ver logs de instalação
tail -f /var/log/fazai_install.log

# Verificar integridade do sistema
sudo ./bin/tools/system-check.sh
```

---

## Exemplos Práticos de Uso

### Cenário 1: Monitoramento de Servidor Web
```bash
# 1. Verificar status atual
fazai status
fazai memoria
fazai disco

# 2. Configurar monitoramento
fazai setup prometheus for web_services
fazai configure grafana dashboard for web_monitoring

# 3. Configurar alertas
fazai setup monit for services=nginx,mysql
fazai configure snmp monitoring for network_devices

# 4. Monitorar em tempo real
fazai tui
fazai html memoria line
```

### Cenário 2: Atualização de Sistema
```bash
# 1. Planejar atualização
fazai mcps atualizar sistema operacional e pacotes

# 2. Executar com monitoramento
fazai mcps --stream atualizar sistema

# 3. Verificar resultado
fazai sistema
fazai check-deps

# 4. Backup de configurações
fazai backup config files
```

### Cenário 3: Configuração de Segurança
```bash
# 1. Setup de ferramentas de segurança
fazai setup modsecurity for apache
fazai setup suricata for ids
fazai setup crowdsec for protection

# 2. Configurar firewall
fazai configure firewall rules for web_server

# 3. Monitorar ataques
fazai monitor security events
fazai check modsecurity logs
```

---

## Conclusão

Este manual cobre todas as ferramentas disponíveis no FazAI v1.42.3, fornecendo exemplos práticos e explicações detalhadas para cada funcionalidade. Para obter ajuda adicional ou reportar problemas, consulte:

- **Documentação**: README.md, USAGE.md
- **Logs**: `/var/log/fazai/`
- **Configuração**: `/etc/fazai/fazai.conf`
- **GitHub**: https://github.com/RLuf/FazAI

O FazAI é uma plataforma completa de automação e monitoramento, projetada para simplificar tarefas complexas de administração de sistemas e infraestrutura.