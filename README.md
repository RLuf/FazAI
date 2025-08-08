# FazAI - Orquestrador Inteligente de Automação

> **Licença:** Este projeto está licenciado sob a [Creative Commons Attribution 4.0 International (CC BY 4.0)](https://creativecommons.org/licenses/by/4.0/).

FazAI é um sistema de automação inteligente para servidores Linux, que permite executar comandos complexos usando linguagem natural e inteligência artificial.

## Principais recursos (v1.42.0)

- IA local com Gemma (gemma.cpp) integrada: baixa latência e operação offline
- Geração dinâmica de ferramentas (auto_tool) a partir de linguagem natural
- Monitoração e QoS por IP (nftables + tc) com gráfico HTML (top 10 IPs)
- Agentes remotos com ingestão em `/ingest` e métricas Prometheus em `/metrics`
- Integrações de segurança ativas: ModSecurity, Suricata, CrowdSec, Monit
- SNMP (consultas de OIDs) para equipamentos de rede
- APIs de terceiros prontas: Cloudflare (DNS/Firewall) e SpamExperts (domínios/políticas)
- Suporte a Qdrant (RAG) para consultas semânticas de redes/Linux

Consulte o [CHANGELOG](CHANGELOG.md) para histórico completo de alterações.

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

# Instalar
sudo ./install.sh
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

### Instalação via Docker

O FazAI pode ser executado em um container Docker, facilitando a instalação e execução em qualquer ambiente. A imagem inclui o daemon, ferramentas e endpoints (`/status`, `/logs`, `/ingest`, `/metrics`).

```bash
# Construir a imagem
docker build -t fazai:latest .

# Executar o container
docker run -d --name fazai \
  -p 3120:3120 \
  -v /etc/fazai:/etc/fazai \
  -v /var/log/fazai:/var/log/fazai \
  -e FAZAI_PORT=3120 \
  fazai:latest
```

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

## Configuração

O arquivo principal de configuração está em `/etc/fazai/fazai.conf`. Para criar:

```bash
sudo cp /etc/fazai/fazai.conf.example /etc/fazai/fazai.conf
sudo nano /etc/fazai/fazai.conf
```

### Provedores de IA Suportados

- **OpenRouter** (https://openrouter.ai/api/v1) - Padrão, múltiplos modelos
- **OpenAI** (https://api.openai.com/v1) - GPT-4, GPT-3.5-turbo
- **Anthropic** (https://api.anthropic.com/v1) - Claude 3 Opus, Sonnet, Haiku
- **Google Gemini** (https://generativelanguage.googleapis.com/v1beta) - Gemini Pro, Pro Vision
- **Requesty** (https://router.requesty.ai/v1) - Gateway para múltiplos provedores
- **Ollama** (http://127.0.0.1:11434/v1) - Modelos locais (llama3.2, mixtral, etc.)
- **Gemma local (gemma.cpp)** - Via provedor interno `gemma_cpp` (requer pesos/tokenizer)

### Sistema de Fallback

O FazAI implementa um sistema de fallback robusto que garante alta disponibilidade:

1. **Fallback entre Provedores**: Ordem automática: gemma_cpp → Llama server → OpenRouter → Requesty → OpenAI → Anthropic → Gemini → Ollama
2. **Fallback Local**: `fazai_helper.js` para operação offline (DeepSeek removido)
3. **GenaiScript**: Arquitetamento de comandos complexos usando modelos locais
4. **Cache Inteligente**: Reduz latência e custos para comandos repetidos

### Telemetria e Observabilidade

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
