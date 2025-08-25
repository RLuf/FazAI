# 🤖 FazAI v2.0 - Sistema de Fluxo Inteligente

> **Licença:** Este projeto está licenciado sob a [Creative Commons Attribution 4.0 International (CC BY 4.0)](https://creativecommons.org/licenses/by/4.0/).

**FazAI v2.0** representa uma transformação revolucionária: de um simples orquestrador para um **sistema de agente inteligente cognitivo e persistente** que mantém raciocínio contínuo, aprende continuamente e executa ações complexas de forma autônoma.

## 🚀 Principais recursos (v2.0.0)

### 🤖 **Agente Inteligente Cognitivo**
- **Sistema de Agente Persistente**: Raciocínio contínuo até concluir objetivos
- **Worker Gemma (C++)**: Processo residente com modelo libgemma.a para latência mínima
- **Protocolo ND-JSON**: 9 tipos de ação estruturada (plan, ask, research, shell, toolSpec, observe, commitKB, done)
- **Streaming em Tempo Real**: Server-Sent Events (SSE) para tokens e ações
- **Base de Conhecimento**: Aprendizado contínuo com Qdrant para persistência
- **Geração Dinâmica de Ferramentas**: Criação e execução sob demanda

### 📊 **Integração Enterprise**
- **Relay SMTP Inteligente**: Automação completa com SpamExperts e Zimbra
- **Monitoramento Avançado**: Detecção de ataques e análise de padrões
- **Resposta Automática**: Sistema inteligente de resposta a ameaças
- **Configuração Automática**: IA que configura e otimiza sistemas

### 🔧 **Recursos Legados Mantidos**
- IA local com Gemma integrada: baixa latência e operação offline
- Monitoração e QoS por IP (nftables + tc) com gráfico HTML
- Agentes remotos com ingestão em `/ingest` e métricas Prometheus
- Integrações de segurança: ModSecurity, Suricata, CrowdSec, Monit
- APIs de terceiros: Cloudflare (DNS/Firewall) e SpamExperts
- Suporte a Qdrant (RAG) para consultas semânticas



Consulte o [CHANGELOG](CHANGELOG.md) para histórico completo de alterações.

## 🎯 Exemplos de Uso Rápido

### **Agente Inteligente**
```bash
# Configuração automática completa
fazai agent "configurar servidor de email relay com antispam e antivirus"

# Otimização inteligente
fazai agent "otimizar performance do sistema e detectar gargalos"

# Resposta automática a ataques
fazai agent "detectar ataque de spam em massa e implementar contramedidas"
```

### **Relay SMTP Inteligente**
```bash
# Análise e configuração
fazai relay analyze                    # Analisa configuração atual
fazai relay configure                  # Configura automaticamente
fazai relay monitor                    # Monitora em tempo real
fazai relay stats                      # Estatísticas completas

# Integração Enterprise
fazai relay spamexperts                # Integra com SpamExperts
fazai relay zimbra                     # Integra com Zimbra
fazai relay blacklist 192.168.1.100    # Blacklist dinâmica
```

**Para instruções detalhadas de uso, consulte [Instruções de Uso](USAGE.md).**

## Requisitos

- Node.js 22.x ou superior
- npm 10.x ou superior
- Python 3.10 ou superior
- Sistema operacional: Debian/Ubuntu, Fedora/RedHat/CentOS ou WSL com Debian/Ubuntu

## Instalação Rápida

### Linux (Debian/Ubuntu)

```bash
# Clonar o repositório
git clone https://github.com/RLuf/FazAI.git
cd FazAI

# Instalar (use --clean para sobrescrever binários existentes)
sudo ./install.sh --clean
# O instalador detecta seu próprio caminho, permitindo
# executá-lo de qualquer diretório. Exemplo:
# sudo /caminho/para/install.sh
# Opcional: incluir suporte ao llama.cpp
# sudo ./install.sh --with-llama

# Iniciar o serviço
sudo systemctl enable fazai
sudo systemctl start fazai
```

### Linux (Fedora/RedHat/CentOS)

```bash
# Clonar o repositório
git clone https://github.com/RLuf/FazAI.git
cd FazAI

# Instalar (usa dnf automaticamente)
sudo ./install.sh
# O instalador detecta Fedora/RedHat/CentOS e usa dnf para dependências.
# Opcional: incluir suporte ao llama.cpp
# sudo ./install.sh --with-llama

# Iniciar o serviço
sudo systemctl enable fazai
sudo systemctl start fazai
```

### Windows (via WSL)

1. Instale o WSL com Debian/Ubuntu:
```powershell
# No PowerShell como administrador
wsl --install
wsl --install -d Debian
```

2. Instale o FazAI:
```bash
npm run install-wsl
```

### Instalação Portable

Para ambientes com restrições de rede ou onde a instalação normal falha:

```bash
# Baixar e instalar versão portable
wget https://github.com/RLuf/FazAI/releases/latest/download/fazai-portable.tar.gz
tar -xzf fazai-portable.tar.gz
cd fazai-portable-*
sudo ./install.sh
# Assim como na instalação principal, o script pode ser
# chamado de qualquer pasta, pois detecta seu próprio caminho.
```

### Docker e Compose

Opção A — Docker Compose (recomendado)
```bash
# 1) Traga seus pesos para o host em ./opt/models/gemma
#    Ex.: ./opt/models/gemma/2.0-2b-it-sfp.sbs

# 2) Suba com Compose
docker compose up -d --build

# 3) Teste
curl http://localhost:3120/agent/status
```

Opção B — Docker direto
```bash
docker build -t rluf/fazai:latest .
docker run -d --name fazai \
  -p 3120:3120 -p 3220:3220 -p 3221:3221 \
  -e FAZAI_PORT=3120 \
  -e FAZAI_GEMMA_MODEL=/opt/fazai/models/gemma/2.0-2b-it-sfp.sbs \
  -v $(pwd)/etc/fazai:/etc/fazai \
  -v $(pwd)/var/log/fazai:/var/log/fazai \
  -v $(pwd)/opt/models/gemma:/opt/fazai/models/gemma \
  rluf/fazai:latest
```

Notas
- O container inicia o Gemma Worker (C++) e o daemon Node no mesmo serviço, usando socket Unix em `/run/fazai/gemma.sock`.
- Monte seus pesos do modelo em `/opt/fazai/models/gemma` e aponte `FAZAI_GEMMA_MODEL` se necessário.
- Qdrant opcional disponível via serviço `qdrant` no `docker-compose.yml` (porta 6333).

#### Portas Oficiais do FazAI

O FazAI utiliza a seguinte faixa de portas reservada:
- **3120**: Porta padrão do FazAI
- **3120-3125**: Range reservado para serviços do FazAI

#### Volumes do Container

- `/etc/fazai`: Configurações do sistema
- `/var/log/fazai`: Logs do sistema

#### Variáveis de Ambiente

- `FAZAI_PORT`: Porta de execução (padrão: 3120)
- `NODE_ENV`: Ambiente de execução (padrão: production)

## Uso Básico

```bash
# Exibir ajuda
fazai ajuda

# Informações do sistema
fazai sistema

# Criar usuário
fazai cria um usuario com nome teste com a senha teste321 no grupo printers

# Instalar pacotes
fazai instale os modulos mod_security do apache

# Alterar configurações
fazai altere a porta do ssh de 22 para 31052

# Modo MCPS passo a passo
fazai mcps atualizar sistema

# Stream em tempo real (SSE)
fazai -s "ls -la /; sleep 1; echo fim"

# Sessão interativa (WebSocket + PTY)
fazai interactive

# Pergunta direta (-q) sem executar comandos
fazai -q "o que é kernel?"

# Pergunta direta com stream (-s -q)
fazai -s -q "pesquise por kernel e retorne um link relevante"
```

### Modo Debug

Para exibir detalhes de conexão e resposta HTTP em tempo real (verbose), use a flag `-d` ou `--debug`:

```bash
fazai -d sistema
```

## Estrutura de Diretórios

```
/opt/fazai/           # Código e binários
/etc/fazai/           # Configurações
/var/log/fazai/       # Logs
/var/lib/fazai/       # Dados persistentes
/usr/local/bin/fazai  # Link simbólico para o CLI
```

## Interface TUI

Se o `cargo` estiver disponível durante a instalação, o FazAI compila um painel
TUI em Rust (`ratatui`) com cabeçalho em ASCII (rosto + "FazAI" + assinatura).
O binário resultante é instalado em `/usr/local/bin/fazai-tui`.

Caso o Rust não esteja presente ou a compilação falhe, o instalador mantém o
painel Bash tradicional localizado em `/opt/fazai/tools/fazai-tui.sh` (com os
mesmos elementos de identidade visual em ASCII).

Atalhos: `q` (sair), futuras integrações: `l` (logs), `s` (status), `m` (métricas).

Nota: DOCLER é a interface web do FazAI (servidor Node em `/opt/fazai/web/docler-server.js`) e não tem relação com Docker. A seção “Instalação via Docker” refere-se ao empacotamento/execução do FazAI em contêineres.

## Configuração

O arquivo principal de configuração está em `/etc/fazai/fazai.conf`. Para criar:

```bash
sudo cp /etc/fazai/fazai.conf.example /etc/fazai/fazai.conf
sudo nano /etc/fazai/fazai.conf
```

### Telemetria (flags)
- `[telemetry].enable_ingest`: habilita o endpoint `POST /ingest` para receber telemetria de agentes/hosts.
- `[telemetry].enable_metrics`: habilita o endpoint `GET /metrics` (formato Prometheus) com contadores e métricas agregadas.
Se um flag estiver desabilitado ou ausente, o endpoint correspondente retorna 404.

Atalhos via CLI:
```bash
# Habilitar ambos e reiniciar o serviço
fazai telemetry --enable

# Desabilitar ambos e reiniciar
fazai telemetry --disable

# Smoke test (valida retornos esperados)
fazai telemetry-smoke
```

### Interface Web / Docler
- Serviço: `fazai-docler` (portas 3220 cliente, 3221 admin), executa como usuário não-root `fazai-web`.
- Iniciado pelo installer. Acesse:
  - Cliente: http://localhost:3220
  - Admin: http://localhost:3221
- A UI em http://localhost:3120/ui (servida pelo daemon) inclui tile de status e botões para alternar telemetria.

### Qdrant (RAG)
- Installer configura `fazai-qdrant` via Docker (porta 6333) se Docker estiver presente.
- Integração com Gemma via endpoints internos e tool `rag_ingest.js`.
- Exemplo (via API/UI):
  - Ingestão por URL: `POST /kb/ingest {"url":"https://exemplo.com/doc.pdf"}`
  - Ingestão por texto: `POST /kb/ingest {"text":"conteúdo a indexar"}`

### OPNsense (Multiserver)
- Cadastro e consulta via UI ou linguagem natural (CLI):
  - Adicionar via UI: cartão “OPNsense” (nome, base_url, key/secret, TLS)
  - Listar: `fazai opn "listar firewalls"`
  - Health: `fazai opn "health do fw-01"`
  - Interfaces: `fazai opn "listar interfaces do fw-01"`
- API NL: `POST /opn/nl {"query":"..."}`
- Registro: `/etc/fazai/opnsense.json` e segredos em `/etc/fazai/secrets/opnsense/<id>.json`
- Baseado na API oficial: https://docs.opnsense.org/development/api.html

### Alertas & Diagnóstico
- Configuração via `/ui` (cartão “Alertas & Diagnóstico”) ou REST:
  - GET/POST `/alerts/config` com `{ interval_sec, rules: [...] }`
  - Regra exemplo: `{ "id":"fw-01", "cpu_percent":85, "mem_percent":90, "sessions":2000, "ifaces":[{"name":"em0","rx_bps":100000000}], "channel":"email", "target":{"to":"root@example"} }`
  - Canais suportados: email, telegram, whatsapp (webhook)
- Diagnóstico OPNsense (pass-through seguro): `POST /opn/:id/diagnostics { path:"/api/core/diagnostics/...", params:{} }`

### IA: Motor e Fallbacks

- **Motor padrão (core)**: Gemma local (gemma.cpp). Operação offline, baixa latência. Não configurável como “provedor” — é o mecanismo do FazAI.
- **APIs de IA (fallback)**:
  - OpenRouter (https://openrouter.ai/api/v1) — múltiplos modelos
  - OpenAI (https://api.openai.com/v1) — GPT‑4, GPT‑3.5‑turbo
  - Anthropic (https://api.anthropic.com/v1) — Claude 3 Opus/Sonnet/Haiku
  - Google Gemini (https://generativelanguage.googleapis.com/v1beta)
  - Requesty (https://router.requesty.ai/v1)
  - Ollama (http://127.0.0.1:11434/v1)

### Sistema de Fallback

O FazAI usa Gemma como motor primário. Em falha grave/indisponibilidade, aciona fallback em APIs externas disponíveis:

1. **Ordem padrão**: gemma_cpp → llama_server → openrouter → openai → anthropic → gemini → ollama
2. **Configuração**: habilite fallbacks e chaves em `/etc/fazai/fazai.conf` ou via `fazai-config`.
3. **Cache**: respostas e prompts são cacheados para reduzir custos/latência.

Exemplos de configuração:

```ini
[ai_provider]
enable_fallback = true
max_retries = 3
retry_delay = 2

[openrouter]
api_key = SUA_CHAVE
endpoint = https://openrouter.ai/api/v1
default_model = openai/gpt-4o

[openai]
api_key = SUA_CHAVE
endpoint = https://api.openai.com/v1
default_model = gpt-4o
```

Via CLI interativo:

```bash
sudo node /opt/fazai/tools/fazai-config.js
# Opção: "Configurar fallback de IA (OpenRouter, OpenAI, etc.)"
```

### Telemetria e Observabilidade
Endpoints adicionais relevantes:

- `POST /sec/policies` — políticas proativas; ações: `opn_block_ip`, `cf_block_ip`, `ai_decide`, `spx_quarantine`, `spx_allowlist`, `spx_blocklist`.
- `POST /security/modsecurity/setup` — instala/configura ModSecurity (Nginx/Apache). 
- `POST /config/reload` — recarrega conf e/ou define `telemetry.udp_port` em runtime; reinicia listener UDP.
- `GET /config/get` / `POST /config/set` — ler/gravar `/etc/fazai/fazai.conf` (persistente).
- RAG (arquitetamento): Qdrant→Context7 — injeta passo `kb.rag` com `origin` e amostras.

## Bash Completion

O instalador provisiona `/etc/bash_completion.d/fazai`. Para recarregar num shell atual:

```
source /etc/bash_completion
source /etc/bash_completion.d/fazai
```
### Llama.cpp (opcional, para uso com Ollama/llama server/execução local)

Para compilar e instalar o llama.cpp com CMake e dependências adequadas (incluindo libcurl dev):

```
bash bin/tools/install-llamacpp.sh
```

O script irá:
- Instalar build tools/CMake e libcurl-dev (apt/dnf)
- Clonar/puxar `ggerganov/llama.cpp`
- Compilar com CMake em `build/`
- Instalar binários (se permitido) e baixar um modelo de exemplo opcional

Caso já esteja compilando manualmente, basta garantir que o `cmake`, `gcc/g++` e `libcurl-dev` estão presentes.

### Modo Interativo

O modo interativo abre um PTY remoto via WebSocket no daemon (semelhante a um terminal). Útil para tarefas que exigem entrada do usuário.

```
fazai interactive
```

Requer dependências `ws` e `node-pty` instaladas no `/opt/fazai` (o instalador cuida disso). Se não estiverem presentes, o daemon segue funcionando sem o WS interativo.

### Flags do CLI

- `-s, --stream`: saída em tempo real via SSE
- `-q, --question`: pergunta direta (IA) sem executar comandos
- `-w, --web`: força pesquisa web (tool web_search) e retorna um link relevante

Exemplos:

```
fazai -s "ls -la /; sleep 1; echo fim"
fazai -q "o que é kernel?"
fazai -w "kernel linux"
fazai -s -q "pesquise por kernel e retorne um link relevante"
```

### OPNsense MCP (Model Context Protocol)

Para habilitar a integração com OPNsense, adicione a seção abaixo em `/etc/fazai/fazai.conf` e preencha os campos. Coloque o conteúdo da chave em `api_key` (ou aponte para um arquivo próprio, se preferir):

```
[opnsense]
enabled = true
host = firewall.exemplo.com
port = 443
use_ssl = true
username = root
password = 
api_key = (conteúdo da sua .MCP_OPNSENSE.key)
```

Após ajustar, reinicie o serviço:

```
sudo systemctl restart fazai
```


- Agentes remotos: envio periódico para `POST /ingest`
- Endpoint Prometheus: `GET /metrics` (integração fácil com Grafana)
- Gráficos HTML gerados por ferramentas (ex.: top IPs)

### Ferramentas inclusas (seleção)

- `auto_tool`: gera ferramentas sob demanda a partir de descrição
- `net_qos_monitor`: monitora por IP (nftables), gera gráfico top10, aplica `tc`
- `agent_supervisor`: instala/inicia agentes remotos (via SSH)
- `snmp_monitor`: consultas SNMP v2c a OIDs
- `modsecurity_setup`, `suricata_setup`, `crowdsec_setup`, `monit_setup`: wrappers/instaladores de segurança
- `qdrant_setup`: sobe Qdrant via Docker e cria coleção para RAG
- `cloudflare`, `spamexperts`: APIs de terceiros

### Comandos de Configuração

```bash
# Configurar provedores de IA
fazai config

# Verificar status do cache
fazai cache

# Limpar cache
fazai cache-clear

# Verificar status do sistema
fazai status
```

## Desenvolvimento

### Plugins

Crie plugins JavaScript em `/opt/fazai/tools/` implementando:
- Função `processCommand(command)`
- Informações do plugin (nome, descrição, versão, autor)

### Módulos Nativos

Crie módulos C em `/opt/fazai/mods/` implementando as funções definidas em `fazai_mod.h`.

## Testes

Execute a suíte de testes com:

```bash
npm test
```

## Desinstalação

```bash
sudo ./uninstall.sh
```

## Reinstalação

```bash
sudo ./reinstall.sh
```

## Segurança

Recomendações básicas:
- Limitar acesso ao comando `fazai`
- Implementar autenticação
- Configurar firewall
- Auditar logs regularmente

## Solução de Problemas

Consulte o arquivo de log `/var/log/fazai_install.log` para detalhes.

## Autor

Roger Luft, Fundador do FazAI
## OPNsense Multiserver (integração nativa)

O FazAI integra múltiplos firewalls OPNsense via API nativa (Basic Auth), sem agente remoto.

Endpoints do daemon:
- `POST /opn/add` { name, base_url, api_key, api_secret, verify_tls?, tags? } → testa e salva
- `GET /opn/list` → lista com health resumido (last_seen, last_error, version)
- `GET /opn/:id/health` → consulta de saúde (usa firmware/status ou system/info/version)
- `GET /opn/:id/interfaces` → inventário de interfaces
- `GET /opn/:id/metrics` → pacote básico (versão, uptime, CPU/Mem se exposto, interfaces)
- `GET /services` → inclui agregados `opnsense_fleet` (ok/degraded/down/total)

UI Docler:
- Página “OPNsense Fleet”: tabela de firewalls, agregados, detalhes (Dashboard/Interfaces)
- Modal “Adicionar Firewall” (Testar & Salvar) → chama `POST /opn/add`

Segurança:
- Segredos em `/etc/fazai/secrets/opnsense/<id>.json` (0600)
- TLS opcional (defina `verify_tls=false` para certificados self-signed)

Observações:
- Em alguns appliances, endpoints `/api/core/system/*` podem estar restritos. O FazAI usa `core/firmware/status` e fallback para `core/menu/search` no health, mantendo operações somente leitura.
s
