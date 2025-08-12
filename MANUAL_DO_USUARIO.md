# Manual do Usuário - FazAI v1.42.2

## Índice

1. [Introdução](#introdução)
2. [Instalação e Configuração](#instalação-e-configuração)
3. [Comandos Básicos](#comandos-básicos)
4. [Ferramentas Disponíveis](#ferramentas-disponíveis)
5. [Configuração Avançada](#configuração-avançada)
6. [Provedores de IA](#provedores-de-ia)
7. [Exemplos de Uso](#exemplos-de-uso)
8. [Solução de Problemas](#solução-de-problemas)

## Introdução

O FazAI é um Orquestrador Inteligente de Automação que permite gerenciar servidores Linux através de comandos em linguagem natural, utilizando diversos provedores de IA para interpretar e executar tarefas complexas.

### Características Principais

- **Suporte Multiplataforma**: Debian/Ubuntu, Fedora/RedHat/CentOS, WSL
- **Múltiplos Provedores de IA**: OpenRouter, OpenAI, Anthropic, Google Gemini, Ollama, Gemma local
- **Sistema de Fallback Inteligente**: Tenta automaticamente o próximo provedor em caso de falha
- **Interface TUI (Terminal User Interface)**: Dashboard completo em ncurses
- **Cache Inteligente**: Sistema de cache com TTL configurável
- **Logs Rotativos**: Sistema de logs com rotação automática e formatação colorida

## Instalação e Configuração

### Requisitos do Sistema

- **Node.js**: 22+ 
- **Python**: 3.10+
- **Dependências**: gcc, dialog, dos2unix

### Instalação Rápida

#### Debian/Ubuntu
```bash
sudo apt update && sudo apt install -y nodejs npm python3 python3-pip gcc dialog dos2unix
sudo ./install.sh
```

#### Fedora/RedHat/CentOS
```bash
sudo dnf install -y nodejs npm python3 python3-pip gcc dialog dos2unix
sudo ./install.sh
```

### Primeira Configuração

Após a instalação, execute:
```bash
sudo fazai config
```

Isso abrirá a interface de configuração onde você pode:
- Configurar chaves de API
- Selecionar provedores de IA
- Ajustar configurações do daemon
- Testar conectividade

## Comandos Básicos

### Sintaxe Geral
```bash
fazai [-d|--debug] [--stream|-s] [-q] <comando>
```

### Comandos de Sistema
- `fazai ajuda` ou `fazai help` - Exibe ajuda completa
- `fazai versao` ou `fazai version` - Exibe versão atual
- `fazai check-deps` - Verifica dependências do sistema

### Comandos de Serviço
- `fazai start` - Inicia o serviço FazAI
- `fazai stop` - Para o serviço FazAI
- `fazai restart` - Reinicia o serviço FazAI
- `fazai status` - Mostra status do serviço
- `fazai reload` - Recarrega plugins e módulos

### Comandos de Logs
- `fazai logs [n]` - Exibe últimas n entradas (padrão: 10)
- `fazai limpar-logs` - Limpa logs (cria backup)
- `fazai web` - Abre interface web de gerenciamento

### Comandos de Sistema Rápido
- `fazai kernel` - Versão do kernel (uname -r)
- `fazai sistema` - Informações do sistema (uname -a)
- `fazai memoria` - Uso de memória (free -h)
- `fazai disco` - Uso de disco (df -h)
- `fazai processos` - Lista processos (ps aux)
- `fazai rede` - Interfaces de rede (ip a)
- `fazai data` - Data e hora atual
- `fazai uptime` - Tempo de atividade

### Comandos de Visualização
- `fazai html <tipo>` - Gera gráfico HTML (memoria, disco, processos)
- `fazai tui` - Abre dashboard TUI (ncurses)
- `fazai interactive` - Sessão interativa (WebSocket PTY)

### Comandos de Configuração
- `fazai config` - Ferramenta de configuração interativa
- `fazai cache` - Status do cache de IA
- `fazai cache-clear` - Limpa cache de IA

## Ferramentas Disponíveis

### Ferramentas de Monitoramento

#### system_info
**Descrição**: Fornece informações detalhadas sobre o sistema
**Uso**: Automaticamente chamada para consultas sobre sistema
**Funcionalidades**:
- Informações de CPU e memória
- Uso de disco e partições
- Processos em execução
- Interfaces de rede
- Estatísticas de uptime

#### net_qos_monitor
**Descrição**: Monitor de tráfego por IP com QoS e gráficos
**Funcionalidades**:
- Monitora tráfego por IP em sub-redes
- Gera gráficos HTML em `/var/www/html/fazai/top_ips.html`
- Aplica limitação de banda com tc (HTB)
- Usa nftables para contadores

#### ports_monitor
**Descrição**: Monitora portas abertas e conexões
**Funcionalidades**:
- Lista portas em uso
- Monitora conexões ativas
- Detecta serviços por porta

#### snmp_monitor
**Descrição**: Consulta dispositivos via SNMP
**Funcionalidades**:
- Consulta OIDs customizados
- Suporte a SNMP v1/v2c/v3
- Integração com net-snmp

### Ferramentas de Segurança

#### modsecurity_setup
**Descrição**: Instala e configura ModSecurity + OWASP CRS
**Funcionalidades**:
- Suporte para Nginx e Apache
- Instalação automática de dependências
- Configuração do OWASP Core Rule Set
- Modo de detecção por padrão

#### suricata_setup
**Descrição**: Instala e configura Suricata IDS/IPS
**Funcionalidades**:
- Detecção de intrusão em tempo real
- Configuração automática de regras
- Integração com logs do sistema

#### crowdsec_setup
**Descrição**: Instala e configura CrowdSec
**Funcionalidades**:
- Proteção colaborativa contra ataques
- Configuração automática de collections
- Integração com firewalls

#### monit_setup
**Descrição**: Instala e configura Monit para monitoramento
**Funcionalidades**:
- Monitoramento de serviços críticos
- Alertas automáticos
- Interface web de gerenciamento

### Ferramentas de Nuvem e APIs

#### cloudflare
**Descrição**: Integração com API Cloudflare
**Funcionalidades**:
- Gerenciamento de zonas DNS
- Criação de registros DNS
- Configuração de regras de firewall
- Listagem de domínios

#### spamexperts
**Descrição**: Integração com SpamExperts
**Funcionalidades**:
- Gerenciamento de políticas antispam
- Configuração de domínios
- Relatórios de spam

### Ferramentas de RAG e IA

#### rag_ingest
**Descrição**: Sistema de RAG (Retrieval-Augmented Generation)
**Funcionalidades**:
- Ingesta documentos PDF, DOCX, TXT, URLs
- Gera embeddings usando OpenAI ou sentence-transformers
- Indexa no Qdrant para consultas semânticas
- Gera catálogo estático em `/var/www/html/fazai/rag/`

#### qdrant_setup
**Descrição**: Configuração do banco vetorial Qdrant
**Funcionalidades**:
- Instalação via Docker
- Criação de coleções iniciais
- Configuração para RAG

#### auto_tool
**Descrição**: Geração dinâmica de ferramentas
**Funcionalidades**:
- Cria ferramentas a partir de especificação em linguagem natural
- Instala automaticamente em `/opt/fazai/tools`
- Recarrega daemon automaticamente
- Suporte a código fornecido pelo usuário

### Ferramentas de Gerenciamento

#### agent_supervisor
**Descrição**: Gerenciamento de agentes remotos
**Funcionalidades**:
- Instala agentes via SSH em servidores remotos
- Coleta telemetria (processos, rede, I/O)
- Envia dados para endpoint `/ingest`
- Configuração de intervalo de coleta

#### fazai-config
**Descrição**: Configuração interativa do sistema
**Funcionalidades**:
- Interface em linha de comando
- Configuração de provedores de IA
- Teste de conectividade
- Backup e restore de configurações

#### fazai_tui
**Descrição**: Interface TUI (Terminal User Interface)
**Funcionalidades**:
- Dashboard completo em ncurses
- Gerenciamento de logs
- Controle do daemon
- Informações do sistema em tempo real

### Ferramentas Utilitárias

#### http_fetch
**Descrição**: Cliente HTTP avançado
**Funcionalidades**:
- Requisições GET/POST/PUT/DELETE
- Suporte a headers customizados
- Tratamento de erros robusto

#### web_search
**Descrição**: Pesquisa web integrada
**Funcionalidades**:
- Busca na internet para informações atualizadas
- Integração com provedores de pesquisa
- Resultados estruturados

#### geoip_lookup
**Descrição**: Lookup de geolocalização por IP
**Funcionalidades**:
- Identificação de país/região por IP
- Suporte a IPv4 e IPv6
- Integração com bases de dados GeoIP

#### blacklist_check
**Descrição**: Verificação de blacklists
**Funcionalidades**:
- Verifica IPs em múltiplas blacklists
- Relatórios detalhados
- Suporte a domínios e IPs

#### weather
**Descrição**: Informações meteorológicas
**Funcionalidades**:
- Previsão do tempo por localização
- Dados meteorológicos detalhados
- Integração com APIs de clima

#### alerts
**Descrição**: Sistema de alertas
**Funcionalidades**:
- Notificações por email/SMS
- Alertas baseados em métricas
- Configuração de limites

### Ferramentas de Interface

#### fazai_web
**Descrição**: Interface web do FazAI
**Funcionalidades**:
- Dashboard web completo
- Controle remoto via navegador
- Visualização de logs e métricas

#### fazai_html_v1
**Descrição**: Gerador de gráficos HTML
**Funcionalidades**:
- Gráficos de sistema em HTML/CSS/JS
- Visualização de métricas históricas
- Exportação de relatórios

## Configuração Avançada

### Arquivo de Configuração

O arquivo principal de configuração está em `/etc/fazai/fazai.conf`:

```javascript
{
  "port": 3120,
  "portRange": [3120, 3125],
  "providers": {
    "openrouter": {
      "enabled": true,
      "apiKey": "your-api-key",
      "baseURL": "https://openrouter.ai/api/v1",
      "model": "deepseek/deepseek-r1:nitro"
    },
    "openai": {
      "enabled": false,
      "apiKey": "",
      "model": "gpt-4"
    }
  },
  "cache": {
    "enabled": true,
    "ttl": 3600,
    "maxSize": 1000
  },
  "logging": {
    "level": "info",
    "rotate": true,
    "maxFiles": 5,
    "maxSize": "10m"
  }
}
```

### Variáveis de Ambiente

Você pode usar variáveis de ambiente para configurações sensíveis:

```bash
export OPENROUTER_API_KEY="your-key"
export OPENAI_API_KEY="your-key"
export ANTHROPIC_API_KEY="your-key"
export GOOGLE_API_KEY="your-key"
```

## Provedores de IA

### Ordem de Fallback

O FazAI tenta os provedores na seguinte ordem:

1. **Gemma (local)** - Modelo local sem necessidade de API
2. **Llama server** - Servidor local Llama
3. **OpenRouter** - Gateway para múltiplos modelos
4. **Requesty** - Gateway alternativo
5. **OpenAI** - GPT-4, GPT-3.5-turbo
6. **Anthropic** - Claude 3 Opus, Sonnet, Haiku
7. **Google Gemini** - Gemini Pro, Pro Vision
8. **Ollama** - Modelos locais (llama3.2, mixtral, etc.)

### Configuração de Provedores

#### OpenRouter (Recomendado)
```bash
fazai config
# Selecione OpenRouter e configure sua chave API
```

#### Ollama (Local)
```bash
# Instalar Ollama
curl -fsSL https://ollama.ai/install.sh | sh

# Baixar modelo
ollama pull llama3.2

# Configurar no FazAI
fazai config
```

#### Gemma (Local)
```bash
# O FazAI compila automaticamente o Gemma.cpp
# Verifique em /opt/fazai/bin/gemma*
```

## Modo MCPS (Monte Carlo Planning Search)

O modo MCPS permite planejamento passo a passo de tarefas complexas:

```bash
# Modo básico
fazai mcps atualizar sistema completo

# Modo stream (tempo real)
fazai mcps --stream configurar firewall avançado

# Exemplos de tarefas
fazai mcps instalar servidor web nginx com ssl
fazai mcps configurar backup automatizado
fazai mcps otimizar performance do servidor
```

## Exemplos de Uso

### Administração Básica

```bash
# Verificar status do sistema
fazai "mostra informações completas do sistema"

# Criar usuário
fazai "cria usuario 'joao' com senha 'senha123' no grupo 'developers'"

# Instalar software
fazai "instala nginx e configura para iniciar automaticamente"

# Configurar firewall
fazai "configura firewall para permitir apenas ssh, http e https"
```

### Monitoramento

```bash
# Ver processos que mais consomem CPU
fazai "lista os 10 processos que mais consomem CPU"

# Monitorar disco
fazai "verifica uso de disco e alerta se alguma partição estiver acima de 80%"

# Verificar logs
fazai "analisa logs do apache dos últimos 30 minutos"
```

### Segurança

```bash
# Configurar ModSecurity
fazai "instala e configura modsecurity para nginx"

# Verificar tentativas de login
fazai "mostra tentativas de login falhidas nas últimas 24 horas"

# Atualizar sistema
fazai "atualiza todos os pacotes do sistema"
```

### Rede

```bash
# Verificar conectividade
fazai "testa conectividade com google.com"

# Monitorar tráfego
fazai "monitora tráfego de rede da subrede 192.168.1.0/24"

# Configurar QoS
fazai "limita banda do IP 192.168.1.100 a 1Mbps"
```

### Backup e Restauração

```bash
# Criar backup
fazai "cria backup do diretório /home para /backup/home-$(date +%Y%m%d)"

# Sincronizar arquivos
fazai "sincroniza /var/www com servidor backup via rsync"
```

## Interface TUI (Terminal User Interface)

### Acessar o TUI

```bash
fazai tui
```

### Funcionalidades do TUI

- **Dashboard Principal**: Visão geral do sistema
- **Logs em Tempo Real**: Visualização de logs com filtros
- **Controle de Serviços**: Start/stop/restart do daemon
- **Configurações**: Acesso às configurações do sistema
- **Métricas**: Gráficos de CPU, memória, disco, rede
- **Terminal Integrado**: Acesso a terminal dentro do TUI

### Atalhos do TUI

- `q` - Sair
- `r` - Atualizar dados
- `l` - Ver logs
- `c` - Configurações
- `s` - Status de serviços
- `h` - Ajuda
- `i` - Modo interativo

## Interface Web

### Acessar Interface Web

```bash
fazai web
```

A interface será aberta em `http://localhost:3120`

### Funcionalidades Web

- **Dashboard Responsivo**: Funciona em desktop e mobile
- **Controle Remoto**: Execute comandos via navegador
- **Visualização de Logs**: Interface moderna para logs
- **Gráficos Interativos**: Métricas em tempo real
- **Configuração Visual**: Configure o sistema via interface gráfica

## Cache e Performance

### Gerenciamento de Cache

```bash
# Ver status do cache
fazai cache

# Limpar cache
fazai cache-clear

# Configurar TTL (no arquivo de configuração)
"cache": {
  "enabled": true,
  "ttl": 3600,  # 1 hora
  "maxSize": 1000
}
```

### Otimização de Performance

- **Cache Inteligente**: Respostas similares são cacheadas
- **Conexões Persistentes**: Reutilização de conexões HTTP
- **Fallback Rápido**: Troca automática entre provedores
- **Logs Rotativos**: Evita crescimento excessivo de logs

## Solução de Problemas

### Problemas Comuns

#### Daemon Não Inicia

```bash
# Verificar logs
fazai logs 50

# Verificar dependências
fazai check-deps

# Reiniciar serviço
sudo systemctl restart fazai
```

#### Erro de Conexão com IA

```bash
# Verificar configuração
fazai config

# Testar conectividade
curl -H "Authorization: Bearer YOUR_KEY" \
  https://openrouter.ai/api/v1/models

# Verificar cache
fazai cache-clear
```

#### Performance Lenta

```bash
# Verificar recursos do sistema
fazai sistema
fazai memoria
fazai disco

# Otimizar cache
fazai cache-clear
fazai config  # Ajustar TTL do cache
```

#### Problemas de Permissão

```bash
# Verificar permissões dos arquivos
ls -la /opt/fazai/
ls -la /etc/fazai/

# Recriar com permissões corretas
sudo ./install.sh
```

### Logs e Diagnóstico

#### Localização dos Logs

- **Log principal**: `/var/log/fazai/fazai.log`
- **Log de erro**: `/var/log/fazai/fazai_error.log`
- **Log de instalação**: `/var/log/fazai_install.log`

#### Níveis de Log

- `error` - Apenas erros críticos
- `warn` - Avisos e erros
- `info` - Informações gerais (padrão)
- `debug` - Detalhes de debug

#### Debug Mode

```bash
# Ativar modo debug
fazai -d "comando de teste"

# Ver logs em tempo real
tail -f /var/log/fazai/fazai.log
```

### Suporte e Comunidade

- **GitHub**: https://github.com/RLuf/FazAI
- **Issues**: Reporte problemas no GitHub Issues
- **Documentação**: README.md, USAGE.md, CHANGELOG.md

### Backup e Restauração

#### Fazer Backup da Configuração

```bash
# Backup manual
sudo cp -r /etc/fazai /backup/fazai-config-$(date +%Y%m%d)

# Usando o TUI
fazai tui  # Navegar para Backup/Restore
```

#### Restaurar Configuração

```bash
# Restauração manual
sudo cp -r /backup/fazai-config-20250110 /etc/fazai

# Reiniciar serviço
sudo systemctl restart fazai
```

## Atualizações

### Atualização Manual

```bash
# Fazer backup
sudo cp -r /etc/fazai /backup/fazai-backup-$(date +%Y%m%d)

# Baixar nova versão
git pull origin main

# Executar instalação
sudo ./install.sh
```

### Versionamento Automático

```bash
# Script de bump de versão (para desenvolvedores)
./bin/tools/version-bump.sh -a    # Próxima versão automaticamente
./bin/tools/version-bump.sh -v 1.43.0  # Versão específica
./bin/tools/version-bump.sh -a -d      # Dry run (simular)
```

---

**FazAI v1.42.2** - Manual do Usuário  
Para suporte técnico, visite: https://github.com/RLuf/FazAI