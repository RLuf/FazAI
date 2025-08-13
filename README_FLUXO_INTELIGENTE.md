# FazAI - Fluxo Inteligente

## Visão Geral

O FazAI foi transformado num sistema de **fluxo inteligente** que opera como um "piloto" operacional para servidores e serviços. Ele não se limita a responder perguntas: analisa, decide, executa e aprende — tudo em ciclos iterativos, com saída em tempo real no terminal.

## 🚀 Características Principais

### 🤖 Agente Persistente
- Mantém raciocínio contínuo sobre um objetivo até concluí-lo
- Sessões persistentes com KV cache para reduzir latência
- Streaming em tempo real de tokens, ações e observações

### 🧠 Inteligência Distribuída
- **Modelo Local**: Via libgemma.a para raciocínio rápido e contextual
- **Recuperação de Contexto**: Qdrant (memória operacional) + Context7 (documentos técnicos)
- **Pesquisa Online**: Acesso à internet para soluções quando necessário
- **Síntese Dinâmica**: Gera ferramentas sob demanda, carrega e executa

### 🔄 Fluxo Iterativo
- **Uma ação por iteração** para controle e rastreabilidade
- **Protocolo ND-JSON** para comunicação estruturada
- **Observação contínua** com feedback em tempo real
- **Base de conhecimento** que cresce com o uso

## 📋 Protocolo de Ações

O agente opera através de ações estruturadas em formato ND-JSON:

### 1. Plan
```json
{"type":"plan","steps":["inventário","instalar","configurar","testar"]}
```

### 2. Ask
```json
{"type":"ask","question":"Qual relayhost usar?","options":["smtp.gmail.com","smtp.office365.com"]}
```

### 3. Research
```json
{"type":"research","queries":["postfix relay configuration","rspamd setup"],"maxDocs":5}
```

### 4. Shell
```json
{"type":"shell","command":"apt-get update && apt-get install -y postfix rspamd"}
```

### 5. ToolSpec + UseTool
```json
{"type":"tool_spec","name":"configure_postfix_relay","description":"Configura Postfix como relay"}
{"type":"use_tool","name":"configure_postfix_relay","args":{"relayhost":"smtp.gmail.com"}}
```

### 6. Observe
```json
{"type":"observe","summary":"Postfix instalado e configurado como relay"}
```

### 7. CommitKB
```json
{"type":"commit_kb","title":"Postfix Relay Setup","tags":["postfix","relay","email"],"status":"verified"}
```

### 8. Done
```json
{"type":"done","result":"Servidor de email relay configurado com sucesso"}
```

## 🛠️ Instalação

### 1. Pré-requisitos
```bash
# Ubuntu/Debian
sudo apt-get install build-essential cmake nodejs npm

# Fedora/RHEL
sudo dnf install gcc-c++ cmake nodejs npm

# Arch
sudo pacman -S base-devel cmake nodejs npm
```

### 2. Compilar Worker
```bash
cd worker
./build.sh
```

### 3. Configurar Modelo
```bash
# Baixar modelo Gemma (opcional)
sudo mkdir -p /opt/fazai/models/gemma
# Coloque o arquivo do modelo em /opt/fazai/models/gemma2-2b-it-sfp.bin
```

### 4. Iniciar Serviços
```bash
# Iniciar worker
sudo systemctl enable fazai-gemma-worker
sudo systemctl start fazai-gemma-worker

# Iniciar daemon principal
sudo systemctl enable fazai
sudo systemctl start fazai
```

## 🎯 Uso

### Comando Básico
```bash
fazai agent "configurar servidor de email relay com antispam e antivirus"
```

### Exemplos de Objetivos

#### Configuração de Serviços
```bash
# Email relay
fazai agent "criar servidor de email somente relay com antispam e antivirus"

# Proxy reverso
fazai agent "configurar nginx como proxy reverso com SSL e rate limiting"

# Firewall
fazai agent "configurar iptables com regras para servidor web e SSH"
```

#### Manutenção de Sistema
```bash
# Atualização
fazai agent "atualizar sistema, verificar logs de erro e otimizar performance"

# Monitoramento
fazai agent "configurar monitoramento de sistema com alertas por email"

# Backup
fazai agent "configurar backup automático de arquivos importantes"
```

#### Desenvolvimento
```bash
# Ambiente de desenvolvimento
fazai agent "configurar ambiente de desenvolvimento Python com virtualenv e dependências"

# CI/CD
fazai agent "configurar pipeline CI/CD com Jenkins e Docker"
```

## 🔧 Configuração

### Arquivo de Configuração
```bash
sudo nano /etc/fazai/agent.conf
```

### Principais Seções

#### Worker Gemma
```ini
[gemma_worker]
enabled = true
socket = /run/fazai/gemma.sock
model = /opt/fazai/models/gemma2-2b-it-sfp.bin
temperature = 0.2
max_tokens = 1024
```

#### Agente
```ini
[agent]
enabled = true
max_iterations = 32
action_per_iteration = 1
fallback_enabled = true
```

#### Base de Conhecimento
```ini
[qdrant]
enabled = true
url = http://127.0.0.1:6333
collection = fazai_kb
```

## 🏗️ Arquitetura

### Componentes Principais

1. **Worker Gemma (C++)**
   - Processo residente com modelo carregado
   - Comunicação via socket Unix
   - Gerenciamento de sessões com KV cache

2. **Provider Node.js**
   - Cliente para comunicação com worker
   - Streaming de tokens
   - Controle de sessões

3. **Handlers do Agente**
   - Processamento de ações ND-JSON
   - Execução de comandos shell
   - Geração dinâmica de ferramentas

4. **Módulos Core**
   - **Prompt**: Construção de prompts estruturados
   - **Retrieval**: Recuperação de contexto
   - **Research**: Pesquisa online
   - **Shell**: Execução segura de comandos
   - **Tools**: Geração dinâmica de ferramentas
   - **KB**: Base de conhecimento

5. **CLI Inteligente**
   - Subcomando `agent`
   - Streaming SSE em tempo real
   - Interface interativa

### Fluxo de Dados

```
Usuário → CLI → Daemon → Provider → Worker
                ↓
            Handlers → Core Modules
                ↓
            SSE → CLI → Usuário
```

## 🔍 Monitoramento

### Logs
```bash
# Logs do worker
sudo journalctl -u fazai-gemma-worker -f

# Logs do daemon
sudo journalctl -u fazai -f

# Logs específicos do agente
tail -f /var/log/fazai/fazai.log | grep agent
```

### Status dos Serviços
```bash
# Status do worker
sudo systemctl status fazai-gemma-worker

# Status do daemon
sudo systemctl status fazai

# Status do agente via API
curl http://localhost:3120/agent/status
```

### Métricas
```bash
# Métricas Prometheus
curl http://localhost:3120/metrics
```

## 🛡️ Segurança

### Comandos Bloqueados
- `rm -rf /`
- `mkfs`
- `dd if=/dev/zero`
- `format`
- `fdisk`

### Validações
- Comandos proibidos são bloqueados
- Execução como root (configurável)
- Timeout por ação
- Rate limiting

### Auditoria
- Logs estruturados de todas as ações
- Histórico completo de sessões
- Diffs de configurações alteradas

## 🔄 Desenvolvimento

### Estrutura do Projeto
```
/worker/                    # Worker C++
  ├── src/
  │   ├── main.cpp         # Ponto de entrada
  │   ├── worker.cpp       # Engine Gemma
  │   ├── worker.hpp       # Header do worker
  │   ├── ipc.cpp          # Comunicação IPC
  │   └── ipc.hpp          # Header IPC
  ├── CMakeLists.txt       # Build system
  └── build.sh             # Script de build

/opt/fazai/lib/
  ├── providers/
  │   └── gemma-worker.js  # Provider Node.js
  ├── handlers/
  │   └── agent.js         # Handlers do agente
  └── core/
      ├── prompt/          # Construção de prompts
      ├── retrieval.js     # Recuperação de contexto
      ├── research.js      # Pesquisa online
      ├── shell.js         # Execução shell
      ├── tools_codegen.js # Geração de ferramentas
      └── kb.js           # Base de conhecimento
```

### Compilação
```bash
cd worker
mkdir build
cd build
cmake ..
make -j$(nproc)
sudo make install
```

### Testes
```bash
# Testar worker
/opt/fazai/bin/fazai-gemma-worker --version

# Testar provider
node -e "const p = require('/opt/fazai/lib/providers/gemma-worker'); console.log('Provider OK')"

# Testar agente
fazai agent "teste simples"
```

## 🚀 Próximos Passos

### Melhorias Planejadas
1. **Integração com Qdrant real** para base de conhecimento
2. **Pesquisa online real** com APIs de busca
3. **Geração de ferramentas com LLM** real
4. **Interface web** para visualização de sessões
5. **Agentes distribuídos** para orquestração multi-servidor
6. **Políticas de segurança** avançadas

### Extensões
1. **Conectores OPNsense** para gerenciamento de firewall
2. **Agentes Linux** para telemetria distribuída
3. **MCP (Model Context Protocol)** para extensões
4. **Webhooks** para notificações
5. **Dashboards** para monitoramento

## 📚 Documentação Adicional

- [FLUXO_INTELIGENTE.md](FLUXO_INTELIGENTE.md) - Documentação técnica detalhada
- [AGENTS.md](AGENTS.md) - Especificação de agentes
- [CONTEXT.md](CONTEXT.md) - Contexto e arquitetura
- [MANUAL_COMPLETO.md](MANUAL_COMPLETO.md) - Manual completo do sistema

## 🤝 Contribuição

Para contribuir com o desenvolvimento:

1. Fork o repositório
2. Crie uma branch para sua feature
3. Implemente as mudanças
4. Adicione testes
5. Envie um pull request

## 📄 Licença

Este projeto está licenciado sob a Creative Commons Attribution 4.0 International (CC BY 4.0).

---

**FazAI - Transformando automação em inteligência operacional**