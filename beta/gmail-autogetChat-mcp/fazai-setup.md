# 🔧 Configuração FazAI - Guia Completo

Este guia explica como configurar o FazAI para funcionar perfeitamente com o MCP Server.

## 🚀 Instalação do FazAI

### Método 1: Instalação Automática (Recomendado)
```bash
# Instalar FazAI via script oficial
curl -fsSL https://github.com/RLuf/FazAI/raw/master/scripts/install.sh | bash

# Verificar instalação
fazai --version
```

### Método 2: Instalação Manual
```bash
# Clonar repositório
git clone https://github.com/RLuf/FazAI.git
cd FazAI

# Instalar dependências
npm install

# Build
npm run build

# Link global
npm link

# Testar
fazai --version
```

### Método 3: Via NPX (Sem Instalação)
```bash
# Executar diretamente
npx fazai --version
```

## ⚙️ Configuração Inicial

### 1. Arquivo de Configuração
```bash
# Criar diretório de configuração
mkdir -p ~/.fazai

# Copiar arquivo de exemplo
cp fazai.conf.example fazai.conf

# Editar configurações
nano fazai.conf
```

### 2. Configurações Essenciais
```bash
# fazai.conf - Configurações mínimas

# API Keys (escolha uma ou mais)
ANTHROPIC_API_KEY=sk-ant-api03-xxxxx     # Claude (recomendado)
OPENAI_API_KEY=sk-xxxxx                  # GPT-4 (alternativa)

# Configurações de sistema
FAZAI_CONFIG_PATH=~/.fazai/config
LOG_LEVEL=info

# MCP Integration
MCP_CONTEXT7_URL=https://context7.com/api/v1/search
MCP_CONTEXT7_API_KEY=ctx7sk-xxxxx

# Web search fallback
WEB_SEARCH_PROVIDER=duckduckgo
```

### 3. Obter API Keys

#### Claude/Anthropic (Recomendado)
```bash
# 1. Acesse: https://console.anthropic.com
# 2. Crie conta (ganha $5 grátis)
# 3. Generate new API key
# 4. Copie a chave: sk-ant-api03-xxxxx
# 5. Cole no fazai.conf
```

#### OpenAI (Alternativa)  
```bash
# 1. Acesse: https://platform.openai.com/api-keys
# 2. Create new secret key
# 3. Copie: sk-xxxxx
# 4. Cole no fazai.conf
```

## 🧪 Teste Inicial

### Teste Básico
```bash
# Testar configuração
fazai config

# Teste em modo simulação
fazai --dry-run

# Inserir comando de teste: "mostrar data atual"
# Deve gerar: date
```

### Teste Interativo
```bash
# Modo CLI com chat
fazai --cli

# Comandos de teste no CLI:
/help                    # Ajuda
/exec mostrar processos  # Teste de execução
/memory clear           # Limpar memória
/quit                   # Sair
```

### Teste Admin
```bash
# Modo administrador (cuidado!)
fazai

# Comandos seguros para testar:
"mostrar informações do sistema"
"verificar espaço em disco"  
"listar usuários conectados"
"mostrar versão do kernel"
```

## 🔧 Configuração para MCP

### 1. Configurações Específicas MCP
```bash
# Adicionar ao fazai.conf
# Configurações otimizadas para MCP

# Timeouts aumentados para MCP
FAZAI_TIMEOUT=60000
FAZAI_MAX_RETRIES=3

# Modo não interativo por padrão
FAZAI_DEFAULT_MODE=auto

# Log estruturado para MCP
FAZAI_LOG_FORMAT=json
FAZAI_LOG_FILE=/var/log/fazai/mcp.log

# Desativar pesquisas quando não necessário
FAZAI_DISABLE_RESEARCH=false
```

### 2. Verificar Integração
```bash
# Testar se FazAI responde ao MCP
echo "mostrar data" | fazai --no-confirm sonnet35

# Output esperado:
# 🔧 Comando 1: Mostrar data atual
# Comando: date
# Risco: LOW
# ✅ Sucesso: Wed Nov  5 12:45:00 -03 2025
```

## 🛡️ Configurações de Segurança

### 1. Níveis de Risco
```bash
# Configurar confirmações por risco
# No fazai.conf:

FAZAI_RISK_CRITICAL=confirm_always    # Sempre confirmar
FAZAI_RISK_HIGH=confirm_always        # Sempre confirmar  
FAZAI_RISK_MEDIUM=confirm_default     # Confirmar por padrão
FAZAI_RISK_LOW=auto_execute           # Executar automaticamente
```

### 2. Comandos Bloqueados
```bash
# Lista de padrões bloqueados (automático no FazAI)
# rm -rf /
# dd if=/dev/zero  
# mkfs.*
# fdisk
# chmod 777 -R /
```

### 3. Modo Seguro para MCP
```bash
# Configurar modo extra-seguro para uso via MCP
export FAZAI_MCP_SAFE_MODE=true
export FAZAI_REQUIRE_CONFIRMATION=true
export FAZAI_DISABLE_DANGEROUS_COMMANDS=true
```

## 📊 Monitoramento e Logs

### 1. Configurar Logs
```bash
# Criar diretório de logs
sudo mkdir -p /var/log/fazai
sudo chown $USER:$USER /var/log/fazai

# Configurar no fazai.conf
LOG_FILE=/var/log/fazai/fazai.log
LOG_LEVEL=info
```

### 2. Monitorar Execuções  
```bash
# Ver logs em tempo real
tail -f /var/log/fazai/fazai.log

# Filtrar logs do MCP
grep "MCP" /var/log/fazai/fazai.log

# Histórico de comandos
fazai history
```

## 🔄 Integração com Vetor Store

### 1. Configurar Qdrant (Recomendado)
```bash
# No fazai.conf:
VECTOR_PROVIDER=qdrant
QDRANT_URL=http://localhost:6333
QDRANT_API_KEY=opcional

# Validar collections
fazai vector validate
```

### 2. Configurar Milvus (Alternativa)
```bash
# No fazai.conf:
VECTOR_PROVIDER=milvus
MILVUS_ADDRESS=localhost:19530
MILVUS_USERNAME=admin
MILVUS_PASSWORD=password

# Recriar collections
fazai vector recreate --provider milvus
```

## 🤖 Modelos Disponíveis

### Claude (Anthropic)
```bash
fazai sonnet35    # Claude 3.5 Sonnet (padrão, mais inteligente)
fazai haiku       # Claude Haiku (rápido, barato)
```

### OpenAI 
```bash
fazai gpt4o       # GPT-4o (mais recente)
fazai gpt4mini    # GPT-4 Mini (rápido, barato)
```

### Ollama (Local)
```bash
# Instalar Ollama primeiro
curl -fsSL https://ollama.com/install.sh | sh

# Baixar modelo
ollama pull llama3.2

# Usar no FazAI
fazai llama32
```

## 🧪 Testes de Integração MCP

### Teste 1: Comando Simples
```bash
# Via MCP server (simulado):
{
  "tool": "fazai_execute",
  "args": {
    "command": "verificar uso de disco",
    "dryRun": false
  }
}

# Esperado: Execução com df -h
```

### Teste 2: Comando Complexo  
```bash
# Via MCP server:
{
  "tool": "fazai_execute", 
  "args": {
    "command": "instalar e configurar nginx como proxy reverso",
    "dryRun": true,
    "model": "sonnet35"
  }
}

# Esperado: Múltiplos comandos gerados
```

### Teste 3: Status e Configuração
```bash
# Via MCP server:
{
  "tool": "fazai_status",
  "args": {}
}

# Esperado: Informações de versão e config
```

## ❗ Resolução de Problemas

### Problema: "FazAI não encontrado"
```bash
# Verificar PATH
echo $PATH | grep -o '[^:]*fazai[^:]*'

# Verificar instalação
which fazai

# Reinstalar se necessário  
curl -fsSL https://github.com/RLuf/FazAI/raw/master/scripts/install.sh | bash
```

### Problema: "API key inválida"
```bash
# Verificar configuração
fazai config

# Reconfigurar API key
rm ~/.fazai/config
fazai config  # Será solicitado novo key
```

### Problema: "Comando falha"
```bash
# Verificar logs
tail -f /var/log/fazai/fazai.log

# Testar em modo debug
fazai --debug --dry-run

# Verificar permissões
ls -la $(which fazai)
```

### Problema: "Timeout no MCP"
```bash
# Aumentar timeout no .env do MCP server:
FAZAI_TIMEOUT=120000

# Ou usar modelo mais rápido:
fazai haiku  # Em vez de sonnet35
```

## 📚 Comandos Úteis

### Administração
```bash
fazai config              # Ver configurações
fazai --help              # Ajuda completa  
fazai completion          # Auto-complete
fazai vector validate     # Validar vector store
fazai revert             # Reverter última execução
```

### Desenvolvimento
```bash
fazai --debug             # Modo debug
fazai --verbose           # Output verboso
fazai --log-file custom.log  # Log customizado
fazai --dry-run           # Modo simulação
```

### CLI Interativo
```bash
fazai --cli               # Modo chat
/help                     # Ajuda CLI
/exec <comando>          # Executar comando
/history                 # Ver histórico  
/memory clear            # Limpar memória
```

## ✅ Verificação Final

Após configurar tudo:

```bash
# Teste completo
fazai ask "Como verificar se nginx está rodando?"

# Deve retornar explicação sobre:
# systemctl status nginx
# ps aux | grep nginx
# curl localhost
```

**🎉 FazAI configurado e pronto para integração MCP!**

**📞 Suporte:**
- GitHub: https://github.com/RLuf/FazAI/issues  
- Discord: https://discord.gg/fazai
- Docs: https://fazai.dev/docs