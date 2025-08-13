# FazAI - Manual Completo de Utilização v1.42.3

> **Licença:** Este projeto está licenciado sob a [Creative Commons Attribution 4.0 International (CC BY 4.0)](https://creativecommons.org/licenses/by/4.0/).

## Índice

1. [Introdução](#introdução)
2. [Instalação e Configuração](#instalação-e-configuração)
3. [Interface de Linha de Comando (CLI)](#interface-de-linha-de-comando-cli)
4. [Ferramentas do Sistema](#ferramentas-do-sistema)
5. [Ferramentas de Desenvolvimento](#ferramentas-de-desenvolvimento)
6. [Ferramentas de Monitoramento](#ferramentas-de-monitoramento)
7. [Ferramentas de Segurança](#ferramentas-de-segurança)
8. [Ferramentas de Rede](#ferramentas-de-rede)
9. [Configuração Avançada](#configuração-avançada)
10. [Troubleshooting](#troubleshooting)
11. [Exemplos Práticos](#exemplos-práticos)
12. [Referência de Comandos](#referência-de-comandos)

---

## Introdução

O FazAI é um sistema de automação inteligente para servidores Linux que combina inteligência artificial com automação de tarefas. Este manual cobre todas as ferramentas e funcionalidades disponíveis na versão 1.42.3.

### Características Principais

- **IA Local**: Integração com Gemma (gemma.cpp) para operação offline
- **Automação Inteligente**: Geração dinâmica de ferramentas via `auto_tool`
- **Monitoramento Avançado**: QoS por IP, SNMP, métricas Prometheus
- **Segurança Integrada**: ModSecurity, Suricata, CrowdSec, Monit
- **Interface Flexível**: CLI, TUI, Web e WebSocket interativo

---

## Instalação e Configuração

### Requisitos do Sistema

- **Node.js**: 22.x ou superior
- **Python**: 3.10 ou superior
- **Sistema Operacional**: Debian/Ubuntu, Fedora/RedHat/CentOS, WSL
- **Memória**: Mínimo 2GB RAM
- **Disco**: Mínimo 1GB livre

### Instalação Rápida

```bash
# Clonar repositório
git clone https://github.com/RLuf/FazAI.git
cd FazAI

# Instalação automática
sudo ./install.sh

# Iniciar serviço
sudo systemctl enable fazai
sudo systemctl start fazai
```

### Configuração Inicial

```bash
# Configurar provedores de IA
fazai config

# Verificar status
fazai status

# Testar instalação
fazai system-check
```

---

## Interface de Linha de Comando (CLI)

### Comandos Básicos

```bash
fazai ajuda                    # Ajuda completa
fazai versao                   # Versão do sistema
fazai status                   # Status do serviço
fazai logs [n]                # Visualizar logs
```

### Estrutura de Comandos

```
fazai [opções] <comando> [argumentos]
```

#### Opções Globais

- `-d, --debug`: Ativa modo debug
- `-s, --stream`: Saída em tempo real
- `-q, --question`: Modo pergunta direta
- `-w, --web`: Força pesquisa web

---

## Ferramentas do Sistema

### 1. system-check.sh

**Descrição**: Verificação completa da integridade do sistema FazAI

**Uso**:
```bash
fazai system-check
# ou
/opt/fazai/tools/system-check.sh
```

**Funcionalidades**:
- Verificação de dependências
- Status dos serviços
- Integridade dos arquivos
- Permissões de diretórios
- Logs de verificação

**Exemplo de Saída**:
```
[2025-08-10 15:30:00] ✓ Todas as dependências do sistema estão instaladas
[2025-08-10 15:30:01] ✓ Serviço fazai está rodando
[2025-08-10 15:30:02] ✓ Todos os arquivos críticos estão presentes
```

### 2. version-bump.sh

**Descrição**: Script de versionamento automático para o projeto

**Uso**:
```bash
# Bump automático
./bin/tools/version-bump.sh -a

# Bump manual
./bin/tools/version-bump.sh -v 1.43.0

# Simular alterações
./bin/tools/version-bump.sh -a -d

# Com backup
./bin/tools/version-bump.sh -a -b
```

**Opções**:
- `-v, --version`: Versão específica
- `-a, --auto`: Detecção automática
- `-d, --dry-run`: Simulação
- `-b, --backup`: Criar backup

**Arquivos Atualizados**:
- `CHANGELOG.md`
- `package.json`
- `bin/fazai`
- `install.sh`
- `uninstall.sh`
- E mais 11 arquivos

### 3. sync-changes.sh

**Descrição**: Sincronização de alterações entre repositórios

**Uso**:
```bash
./bin/tools/sync-changes.sh
```

**Funcionalidades**:
- Sincronização automática
- Backup antes da sincronização
- Logs detalhados
- Tratamento de conflitos

### 4. sync-keys.sh

**Descrição**: Sincronização de chaves de API e configurações

**Uso**:
```bash
./bin/tools/sync-keys.sh
```

**Funcionalidades**:
- Backup de configurações
- Sincronização de chaves
- Validação de configurações
- Logs de operação

---

## Ferramentas de Desenvolvimento

### 5. github-setup.sh

**Descrição**: Configuração automática do ambiente GitHub

**Uso**:
```bash
./bin/tools/github-setup.sh
```

**Funcionalidades**:
- Configuração de SSH keys
- Setup de repositórios
- Configuração de hooks
- Validação de permissões

### 6. install-llamacpp.sh

**Descrição**: Instalação do llama.cpp para IA local

**Uso**:
```bash
./bin/tools/install-llamacpp.sh
```

**Funcionalidades**:
- Compilação automática
- Configuração de modelos
- Integração com FazAI
- Otimizações de performance

---

## Ferramentas de Monitoramento

### 7. net_qos_monitor

**Descrição**: Monitoramento de QoS por IP com nftables e tc

**Uso**:
```bash
# Via FazAI
fazai "monitora QoS de rede para IPs específicos"

# Direto
/opt/fazai/tools/net_qos_monitor
```

**Funcionalidades**:
- Monitoramento por IP
- Limitação de banda via tc
- Gráficos HTML em tempo real
- Top 10 IPs mais ativos

**Configuração**:
```bash
# Configurar limites
fazai "configura limite de 10Mbps para IP 192.168.1.100"

# Visualizar estatísticas
fazai "mostra estatísticas de QoS de rede"
```

### 8. snmp_monitor

**Descrição**: Consulta de OIDs via SNMP

**Uso**:
```bash
# Consulta básica
fazai "consulta SNMP host=192.168.0.1 community=public oid=1.3.6.1.2.1.1.1.0"

# Via ferramenta
tool:snmp_monitor param={"host":"192.168.0.1","community":"public","oids":["1.3.6.1.2.1.1.1.0"]}
```

**Funcionalidades**:
- Consulta de múltiplos OIDs
- Suporte a SNMP v1/v2c
- Timeout configurável
- Logs de consultas

### 9. agent_supervisor

**Descrição**: Instalação e gerenciamento de agentes remotos

**Uso**:
```bash
# Instalar agente
fazai "instala agente remoto no host 192.168.0.10"

# Via ferramenta
tool:agent_supervisor param={"hosts":["192.168.0.10"],"interval":30}
```

**Funcionalidades**:
- Instalação via SSH
- Coleta de telemetria
- Envio para endpoint `/ingest`
- Monitoramento de status

---

## Ferramentas de Segurança

### 10. modsecurity_setup

**Descrição**: Configuração do ModSecurity para Apache/Nginx

**Uso**:
```bash
fazai "configura ModSecurity para proteção contra ataques web"
```

**Funcionalidades**:
- Instalação automática
- Configuração de regras
- Logs de segurança
- Integração com Apache/Nginx

### 11. suricata_setup

**Descrição**: Configuração do Suricata IDS/IPS

**Uso**:
```bash
fazai "configura Suricata para detecção de intrusão"
```

**Funcionalidades**:
- Instalação do Suricata
- Configuração de regras
- Monitoramento de tráfego
- Alertas em tempo real

### 12. crowdsec_setup

**Descrição**: Configuração do CrowdSec para proteção colaborativa

**Uso**:
```bash
fazai "configura CrowdSec para proteção colaborativa"
```

**Funcionalidades**:
- Instalação do CrowdSec
- Configuração de cenários
- Integração com firewall
- Proteção contra bots

### 13. monit_setup

**Descrição**: Configuração do Monit para monitoramento de serviços

**Uso**:
```bash
fazai "configura Monit para monitoramento de serviços críticos"
```

**Funcionalidades**:
- Monitoramento de processos
- Verificação de portas
- Restart automático
- Alertas por email

---

## Ferramentas de Rede

### 14. qdrant_setup

**Descrição**: Configuração do Qdrant para RAG (Retrieval-Augmented Generation)

**Uso**:
```bash
# Setup básico
fazai "configura Qdrant para consultas semânticas"

# Via ferramenta
tool:qdrant_setup param={"port":6333,"collection":"linux_networking_tech"}
```

**Funcionalidades**:
- Instalação via Docker
- Criação de coleções
- Indexação de documentos
- Consultas semânticas

### 15. rag_ingest

**Descrição**: Ingestão de documentos para RAG

**Uso**:
```bash
# Ingestão de PDF
fazai "processa documento PDF para RAG"

# Via ferramenta
tool:rag_ingest param={"file":"/path/to/document.pdf","collection":"linux_tech"}
```

**Funcionalidades**:
- Suporte a PDF, DOCX, TXT
- Geração de embeddings
- Indexação no Qdrant
- Catálogo estático HTML

---

## Configuração Avançada

### Arquivo de Configuração Principal

Localização: `/etc/fazai/fazai.conf`

```ini
[ai_provider]
provider = openrouter
enable_fallback = true
max_retries = 3

[openrouter]
api_key = sua_chave_aqui
default_model = deepseek/deepseek-r1-0528:free
temperature = 0.2

[ollama]
enabled = true
endpoint = http://localhost:11434
models = ["mixtral", "llama2"]
```

### Variáveis de Ambiente

```bash
export FAZAI_API_URL="http://localhost:3120"
export FAZAI_WS_URL="ws://localhost:3120"
export FAZAI_DEBUG="true"
```

### Configuração de Logs

```bash
# Configurar nível de log
fazai "configura nível de log para DEBUG"

# Rotação de logs
fazai "configura rotação de logs para 7 dias"
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
fazai system-check
```

#### 2. Erro de conexão com API

```bash
# Verificar porta
sudo netstat -tlnp | grep 3120

# Verificar firewall
sudo ufw status

# Testar conectividade
curl http://localhost:3120/status
```

#### 3. Problemas com IA local

```bash
# Verificar Ollama
ollama list

# Verificar Gemma
ls -la /opt/fazai/bin/gemma*

# Verificar cache
fazai cache
```

### Logs de Diagnóstico

```bash
# Logs do sistema
tail -f /var/log/fazai/fazai.log

# Logs de instalação
tail -f /var/log/fazai_install.log

# Logs do systemd
sudo journalctl -u fazai -f
```

---

## Exemplos Práticos

### Monitoramento de Sistema

```bash
# Verificar saúde do sistema
fazai "verifica saúde geral do servidor e reporta problemas"

# Monitorar recursos
fazai "monitora uso de CPU, memória e disco por 1 hora"

# Backup automático
fazai "cria backup automático dos dados críticos"
```

### Segurança

```bash
# Análise de segurança
fazai "analisa segurança do servidor e sugere melhorias"

# Monitoramento de logs
fazai "monitora logs de segurança e alerta sobre tentativas de intrusão"

# Atualização de segurança
fazai "atualiza pacotes de segurança críticos"
```

### Rede

```bash
# Configuração de firewall
fazai "configura firewall para permitir apenas tráfego necessário"

# Monitoramento de rede
fazai "monitora tráfego de rede e identifica anomalias"

# QoS
fazai "configura QoS para priorizar tráfego crítico"
```

### Desenvolvimento

```bash
# Setup de ambiente
fazai "configura ambiente de desenvolvimento para Python e Node.js"

# Deploy automático
fazai "configura pipeline de deploy automático para aplicação"

# Monitoramento de aplicação
fazai "configura monitoramento para aplicação web"
```

---

## Referência de Comandos

### Comandos de Sistema

| Comando | Descrição | Exemplo |
|---------|-----------|---------|
| `ajuda` | Ajuda completa | `fazai ajuda` |
| `versao` | Versão do sistema | `fazai versao` |
| `status` | Status do serviço | `fazai status` |
| `logs [n]` | Visualizar logs | `fazai logs 20` |
| `start` | Iniciar serviço | `fazai start` |
| `stop` | Parar serviço | `fazai stop` |
| `restart` | Reiniciar serviço | `fazai restart` |

### Comandos de Informação

| Comando | Descrição | Exemplo |
|---------|-----------|---------|
| `kernel` | Versão do kernel | `fazai kernel` |
| `sistema` | Info do sistema | `fazai sistema` |
| `memoria` | Uso de memória | `fazai memoria` |
| `disco` | Uso de disco | `fazai disco` |
| `processos` | Lista processos | `fazai processos` |
| `rede` | Interfaces de rede | `fazai rede` |
| `data` | Data e hora | `fazai data` |
| `uptime` | Tempo ativo | `fazai uptime` |

### Comandos de Visualização

| Comando | Descrição | Exemplo |
|---------|-----------|---------|
| `html <tipo>` | Gráfico HTML | `fazai html memoria` |
| `tui` | Dashboard TUI | `fazai tui` |
| `web` | Interface web | `fazai web` |
| `interactive` | Sessão interativa | `fazai interactive` |

### Comandos de Configuração

| Comando | Descrição | Exemplo |
|---------|-----------|---------|
| `config` | Configuração | `fazai config` |
| `cache` | Status do cache | `fazai cache` |
| `cache-clear` | Limpar cache | `fazai cache-clear` |
| `reload` | Recarregar módulos | `fazai reload` |

### Comandos MCPS

| Comando | Descrição | Exemplo |
|---------|-----------|---------|
| `mcps <tarefa>` | Planejamento | `fazai mcps atualizar sistema` |
| `mcps --stream` | MCPS em tempo real | `fazai mcps --stream backup` |

### Ferramentas de Sistema

| Ferramenta | Descrição | Uso |
|------------|-----------|-----|
| `system-check.sh` | Verificação do sistema | `/opt/fazai/tools/system-check.sh` |
| `version-bump.sh` | Versionamento automático | `./bin/tools/version-bump.sh -a` |
| `sync-changes.sh` | Sincronização | `./bin/tools/sync-changes.sh` |
| `github-setup.sh` | Setup GitHub | `./bin/tools/github-setup.sh` |

---

## Conclusão

Este manual cobre todas as funcionalidades e ferramentas disponíveis no FazAI v1.42.3. Para suporte adicional:

- **GitHub**: https://github.com/RLuf/FazAI
- **Issues**: https://github.com/RLuf/FazAI/issues
- **Documentação**: README.md, USAGE.md
- **Logs**: `/var/log/fazai/`

### Próximos Passos

1. **Explore as ferramentas**: Teste cada ferramenta para entender suas capacidades
2. **Configure automações**: Use o MCPS para criar fluxos de trabalho automatizados
3. **Monitore o sistema**: Configure alertas e monitoramento contínuo
4. **Contribua**: Reporte bugs e sugira melhorias via GitHub

---

*Manual atualizado em: 10/08/2025*
*Versão do FazAI: 1.42.3*