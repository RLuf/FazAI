#!/bin/bash
set -e

echo "=== FazAI v2.0 Installer ==="

# Observabilidade via Prometheus/Grafana movida para repositório externo (~/fazaiserverlogs)
# Ajuste ENABLE_FAZAI_MONITORING=true para reinstalar esses componentes.
ENABLE_FAZAI_MONITORING="${ENABLE_FAZAI_MONITORING:-false}"

# Verifica root
if [[ $EUID -ne 0 ]]; then
   echo "❌ Execute como root: sudo ./install.sh"
   exit 1
fi

# Cria estrutura de diretórios
echo "📁 Criando estrutura..."
mkdir -p /opt/fazai/{bin,lib,etc,tools}
mkdir -p /var/log/fazai
mkdir -p /run/fazai
chmod 777 /run/fazai || true
mkdir -p /etc/fazai

# Remove serviços de monitoramento legados (Prometheus/Grafana) se existirem
echo "🔻 Removendo monitoramento Prometheus/Grafana legado..."
remove_monitoring_service() {
  local svc="$1"
  if systemctl list-unit-files 2>/dev/null | grep -q "^${svc}\.service"; then
    systemctl stop "$svc" 2>/dev/null || true
    systemctl disable "$svc" 2>/dev/null || true
    rm -f "/etc/systemd/system/${svc}.service"
  fi
}

remove_monitoring_service "fazai-prometheus"
remove_monitoring_service "fazai-grafana"

if command -v docker >/dev/null 2>&1; then
  docker rm -f fazai-prometheus >/dev/null 2>&1 || true
  docker rm -f fazai-grafana >/dev/null 2>&1 || true
fi

systemctl daemon-reload 2>/dev/null || true

# Instala dependências Python
echo "🐍 Instalando dependências Python..."
apt-get update
apt-get install -y python3 python3-pip python3-venv poppler-utils pandoc docx2txt lynx w3m jq curl
# Dependências do worker FazAI (fazai_gemma_worker.py)
# Pinar qdrant-client para compatibilidade com servidor 1.7.3 (Docker)
pip3 install aiohttp asyncio 'qdrant-client==1.7.3' httpx openai requests

if command -v npm >/dev/null 2>&1; then
  echo "📦 Instalando dependências Node..."
  npm install --production
else
  echo "⚠️ npm não encontrado; instale Node.js para executar o console web."
fi

# Copia binários
echo "📦 Instalando binários..."
cp worker/bin/fazai_gemma_worker.py /opt/fazai/bin/
cp worker/bin/fazai_mcp_client.py /opt/fazai/bin/
cp worker/bin/fazai_integration_adapter.py /opt/fazai/lib/
cp worker/bin/gemma_worker_client.py /opt/fazai/bin/

# Instala bindings Gemma nativos
echo "🧠 Instalando bindings Gemma nativos..."
mkdir -p /opt/fazai/lib/python
if [ -f "worker/bin/gemma_native.cpython-310-x86_64-linux-gnu.so" ]; then
    cp worker/bin/gemma_native.cpython-310-x86_64-linux-gnu.so /opt/fazai/lib/python/gemma_native.so
    echo "✅ Bindings Gemma nativos instalados"
else
    echo "⚠️ Bindings Gemma nativos não encontrados - worker usará fallbacks"
fi

chmod +x /opt/fazai/bin/*.py

echo "🖥️ Preparando assets do console web..."
mkdir -p /opt/fazai/web/hp-console/assets
mkdir -p /opt/fazai/web/hp-console/data
rm -rf /opt/fazai/web/hp-console/assets/rag-viewer
cp -R opt/fazai/web/hp-console/assets/rag-viewer /opt/fazai/web/hp-console/assets/rag-viewer

# CLI principal
echo "⚡ Instalando CLI /bin/fazai..."
cat > /bin/fazai << 'EOF'
#!/bin/bash
exec /opt/fazai/bin/fazai_mcp_client.py "$@"
EOF
chmod +x /bin/fazai

// Apenas cria configuração padrão se não existir
echo "⚙️ Preparando configuração..."
if [ ! -f /etc/fazai/fazai.conf ]; then
cat > /etc/fazai/fazai.conf << 'EOF'
###############################################################################
# FazAI v2.0 - Arquivo de Configuração Padrão
# -----------------------------------------------------------
# Copie este arquivo para /etc/fazai/fazai.conf e ajuste os
# valores de acordo com seu ambiente.
###############################################################################

###############################################################################
# SISTEMA
###############################################################################

[system]
# Nível de log global dos componentes escritos em Python/Node
log_level = INFO

###############################################################################
# PROVEDOR PRINCIPAL
###############################################################################

[ai_provider]
provider = gemma_cpp
enable_fallback = true
max_retries = 3
retry_delay = 2

###############################################################################
# WORKER PYTHON (fazai_gemma_worker.py)
###############################################################################

[gemma_worker]
# Endereços onde o worker escutará requisições MCP/ND-JSON
host = 0.0.0.0
port = 5556
# Socket Unix compartilhado com dispatcher/CLIs
unix_socket = /run/fazai/gemma.sock
# Nível de log específico do worker
log_level = INFO

###############################################################################
# GEMMA LOCAL (gemma.cpp)
###############################################################################

[gemma_cpp]
weights = /opt/fazai/models/gemma/2.0-2b-it-sfp.sbs
# Informe somente se o peso não possuir tokenizer embutido
tokenizer = /opt/fazai/models/gemma/tokenizer.spm
enable_native = true
# Parâmetros de geração padrões
max_tokens = 512
temperature = 0.2
top_k = 1
deterministic = true
multiturn = false
prefill_tbatch = 256
generation_timeout = 120

###############################################################################
# DISPATCHER (fazai_dispatcher.py)
###############################################################################

[dispatcher]
mode = smart
# Socket principal do worker Gemma (pode ser sobrescrito por CLI)
gemma_socket = /run/fazai/gemma.sock
timeout_seconds = 30
shell_timeout = 60
fallback_timeout = 45
health_check_interval = 60
fallback_order = openai,openrouter,context7

###############################################################################
# QDRANT (Memória vetorial)
###############################################################################

[qdrant]
enabled = true
host = 127.0.0.1
port = 6333
personality_collection = fazai_memory
knowledge_collection = fazai_kb
vector_dim = 1024

###############################################################################
# OLLAMA (Embeddings locais)
###############################################################################

[ollama]
endpoint = http://127.0.0.1:11434
embeddings_endpoint = 
embedding_model = mxbai-embed-large
timeout = 30

###############################################################################
# FALLBACKS (APIs externas)
###############################################################################

[openai]
api_key = 
model = gpt-4
max_tokens = 2048

[openrouter]
api_key = 
endpoint = https://openrouter.ai/api/v1
default_model = openai/gpt-4o
models = anthropic/claude-3-opus, google/gemini-pro, meta/llama-3-70b
temperature = 0.3
max_tokens = 2000

[context7]
endpoint = 
timeout = 20
api_key = 

###############################################################################
# SERVIÇOS LEGADOS / INTEGRAÇÕES OPCIONAIS
###############################################################################

[daemon]
host = 0.0.0.0
port = 3120

[cloudflare]
storage = /opt/fazai/web/hp-console/data/cloudflare_accounts.json
api_token = 

[opnsense]
storage = /opt/fazai/web/hp-console/data/opnsense_servers.json
enabled = false
host = 127.0.0.1
port = 443
use_ssl = true
api_key = 
api_secret = 
verifySSL = false
timeout = 30000

###############################################################################
# TELEMETRIA / PROMETHEUS (Opcional)
###############################################################################

[telemetry]
enable_ingest = true
enable_metrics = true
udp_port = 0

###############################################################################
# BANCO DE DADOS (Opcional / legado)
###############################################################################

[mysql]
enabled = false
host = 127.0.0.1
port = 3306
database = fazai
user = fazai
password = trocar_senha

EOF
else
  echo "ℹ️ Mantendo configuração existente em /etc/fazai/fazai.conf"
fi

# Systemd service
echo "🔧 Criando serviço systemd..."
cat > /etc/systemd/system/fazai-gemma-worker.service << 'EOF'
[Unit]
Description=FazAI Gemma Worker v2.0
After=network.target fazai-qdrant.service
Wants=fazai-qdrant.service

[Service]
Type=simple
User=root
WorkingDirectory=/opt/fazai
EnvironmentFile=-/etc/fazai/env
RuntimeDirectory=fazai
RuntimeDirectoryMode=0777
UMask=0000
ExecStartPre=/usr/bin/install -d -m 0777 -o root -g root /run/fazai
ExecStartPre=/bin/rm -f /run/fazai/gemma.sock
ExecStart=/opt/fazai/bin/fazai_gemma_worker.py
ExecStopPost=/bin/rm -f /run/fazai/gemma.sock
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

# Habilita e inicia serviço
systemctl daemon-reload
systemctl enable fazai-gemma-worker
systemctl start fazai-gemma-worker

echo "✅ FazAI v2.0 instalado com sucesso!"
echo "📍 Teste: fazai ask 'olá mundo'"
echo "📍 Status: systemctl status fazai-gemma-worker"
echo "📍 Logs: journalctl -u fazai-gemma-worker -f"
  mkdir -p $(dirname $LOG_FILE)
  
  # Escreve log ao arquivo
  echo "[$timestamp] [$level] $message" >> $LOG_FILE
  
  # Mostra no console com cores
  case $level in
    "INFO")
      echo -e "${BLUE}[INFO]${NC} $message"
      ;;
    "SUCCESS")
      echo -e "${GREEN}[SUCESSO]${NC} $message"
      ;;
    "ERROR")
      echo -e "${RED}[ERRO]${NC} $message"
      ;;
    "WARNING")
      echo -e "${YELLOW}[AVISO]${NC} $message"
      ;;
    "DEBUG")
      if [ "$DEBUG_MODE" = true ]; then
        echo -e "${PURPLE}[DEBUG]${NC} $message"
      fi
      ;;
  esac
}
# Consulta ajuda da IA em caso de erro (simplificada)
ai_help() {
  local prompt="$1"
  log "INFO" "Erro detectado: $prompt"
  log "INFO" "Verifique os logs em $LOG_FILE para mais detalhes"
}


# Função para salvar estado da instalação
save_install_state() {
    local step=$1
    local status=$2
    INSTALL_STATE["$step"]="$status"
    mkdir -p $(dirname "$INSTALL_STATE_FILE")
    
    # Limpa o arquivo antes de reescrever
    > "$INSTALL_STATE_FILE"
    for key in "${!INSTALL_STATE[@]}"; do
        echo "$key=${INSTALL_STATE[$key]}" >> "$INSTALL_STATE_FILE"
    done
    log "DEBUG" "Estado salvo: $step = $status"
}

# Função para carregar estado da instalação
load_install_state() {
    if [ -f "$INSTALL_STATE_FILE" ]; then
        while IFS='=' read -r key value; do
            if [ -n "$key" ] && [ -n "$value" ]; then
                INSTALL_STATE["$key"]="$value"
            fi
        done < "$INSTALL_STATE_FILE"
        log "INFO" "Estado da instalação carregado de $INSTALL_STATE_FILE"
    fi
}

# Função para verificar versão de uma dependência
check_dependency_version() {
    local cmd=$1
    local min_version=$2
    
    if ! command -v "$cmd" &> /dev/null; then
        log "DEBUG" "Comando $cmd não encontrado"
        return 1
    fi
    
    local current_version
    case $cmd in
        "node")
            current_version=$(node -v | sed 's/v//')
            ;;
        "npm")
            current_version=$(npm -v)
            ;;
        "python3")
            current_version=$(python3 --version | awk '{print $2}')
            ;;
        "pip3")
            current_version=$(pip3 --version | awk '{print $2}')
            ;;
        "gcc")
            current_version=$(gcc --version | head -n1 | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -n1)
            ;;
        *)
            current_version=$($cmd --version 2>/dev/null | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -n1)
            ;;
    esac
    
    if [ -z "$current_version" ]; then
        log "WARNING" "Não foi possível determinar a versão de $cmd"
        return 2
    fi
    
    # Comparação de versões usando sort -V
    if printf '%s\n' "$min_version" "$current_version" | sort -V | head -n1 | grep -q "^$min_version$"; then
        log "SUCCESS" "$cmd versão $current_version atende requisito mínimo ($min_version)"
        return 0
    else
        log "WARNING" "$cmd versão $current_version é menor que a mínima requerida ($min_version)"
        return 3
    fi
}

# Função para converter arquivos para formato Linux (dos2unix)
convert_files_to_unix() {
    log "INFO" "Convertendo arquivos para formato Linux..."
    
    # Instala dos2unix se não estiver disponível
    if ! command -v dos2unix &> /dev/null; then
        log "INFO" "Instalando dos2unix..."
        apt-get update && apt-get install -y dos2unix
        
        if ! command -v dos2unix &> /dev/null; then
            log "WARNING" "dos2unix não pôde ser instalado. Tentando método alternativo..."
            # Método alternativo usando sed
            convert_with_sed() {
                local file="$1"
                if [ -f "$file" ]; then
                    sed -i 's/\r$//' "$file" 2>/dev/null
                    if [ $? -eq 0 ]; then
                        log "DEBUG" "Convertido com sed: $file"
                    else
                        log "WARNING" "Falha ao converter: $file"
                    fi
                fi
            }
            
            # Converte arquivos críticos usando sed
            find . -type f \( -name "*.sh" -o -name "*.bash" -o -name "*.conf" \) -exec bash -c 'convert_with_sed "$0"' {} \;
            log "SUCCESS" "Conversão concluída usando método alternativo"
            return 0
        fi
    fi
    
    # Executa o script dos2unixAll.sh se existir
    if [ -f "etc/fazai/dos2unixAll.sh" ]; then
        log "INFO" "Executando script dos2unixAll.sh..."
        chmod +x "etc/fazai/dos2unixAll.sh"
        cd "$(dirname "$(readlink -f "$0")")" || cd /opt/fazai
        bash etc/fazai/dos2unixAll.sh
        log "SUCCESS" "Script dos2unixAll.sh executado"
    else
        log "INFO" "Script dos2unixAll.sh não encontrado. Executando conversão manual..."
        
        # Encontra e converte todos os arquivos relevantes
        find . -type f \
            \( -name "*.sh" \
            -o -name "*.bash" \
            -o -name "*.conf" \
            -o -name "*.yml" \
            -o -name "*.yaml" \
            -o -name "*.json" \
            -o -name "Dockerfile" \) \
            -exec sh -c '
                for file do
                    echo "🔄 Convertendo: $file"
                    dos2unix "$file" 2>/dev/null
                    if [ $? -eq 0 ]; then
                        echo "✅ Convertido com sucesso: $file"
                    else
                        echo "❌ Erro ao converter: $file"
                    fi
                done
            ' sh {} +
    fi
    
    log "SUCCESS" "Conversão de arquivos para formato Linux concluída"
}

# Função para instalar bash completion
install_bash_completion() {
    log "INFO" "Instalando bash completion..."
    
    # Verifica se o bash-completion está instalado
    if ! dpkg -l | grep -q bash-completion 2>/dev/null; then
        log "INFO" "Instalando pacote bash-completion..."
        apt-get update && apt-get install -y bash-completion
    fi
    
    local completion_dir="/etc/bash_completion.d"
    mkdir -p "$completion_dir"

    if [ -f "etc/fazai/fazai-completion.sh" ]; then
        cp "etc/fazai/fazai-completion.sh" "$completion_dir/fazai"
    else
        log "WARNING" "etc/fazai/fazai-completion.sh não encontrado, gerando script simples"
        cat > "$completion_dir/fazai" <<'EOF'
#!/bin/bash
complete -W "install uninstall status config help version" fazai
EOF
    fi
    chmod 644 "$completion_dir/fazai"
    log "SUCCESS" "Script de completion instalado em $completion_dir/fazai"

    # Adiciona ao .bashrc se não existir
    if ! grep -q "source $completion_dir/fazai" /root/.bashrc 2>/dev/null; then
        echo "# FazAI bash completion" >> /root/.bashrc
        echo "if [ -f /etc/bash_completion ]; then" >> /root/.bashrc
        echo "  source /etc/bash_completion" >> /root/.bashrc
        echo "fi" >> /root/.bashrc
        echo "source $completion_dir/fazai" >> /root/.bashrc
        log "SUCCESS" "Bash completion configurado no .bashrc"
    fi
}

# Função para verificar e criar diretório de logs
setup_logging() {
  mkdir -p $(dirname $LOG_FILE)
  touch $LOG_FILE
  log "INFO" "Inicializando log de instalação em $LOG_FILE"
  log "INFO" "====== Início da instalação do FazAI v$VERSION ======"
  log "INFO" "Data e hora: $(date)"
  log "INFO" "Sistema: $(uname -a)"
}

# Função para verificar permissões de root
check_root() {
  log "DEBUG" "Verificando permissões de root..."
  if [ "$EUID" -ne 0 ]; then
    log "ERROR" "Este script precisa ser executado como root (sudo)."
    exit 1
  fi
  log "SUCCESS" "Verificação de permissões de root concluída."
}

# Função para verificar o sistema operacional
check_system() {
  log "DEBUG" "Verificando sistema operacional..."
  if [ -f /etc/os-release ]; then
    . /etc/os-release
    # Trata derivados como Ubuntu (ex.: Pop!_OS)
    if echo "${ID_LIKE:-}" | grep -qi ubuntu; then
      ID=ubuntu
    fi
    case "$ID" in
      debian|ubuntu|pop)
        log "SUCCESS" "Sistema Debian/Ubuntu detectado: $NAME $VERSION_ID"
        ;;
      fedora|rhel|centos)
        log "SUCCESS" "Sistema Fedora/RedHat/CentOS detectado: $NAME $VERSION_ID"
        ;;
      *)
        log "WARNING" "Este script foi projetado para Debian, Ubuntu ou Fedora. Detectado: $NAME $VERSION_ID."
        read -p "Deseja continuar mesmo assim? (s/n): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Ss]$ ]]; then
          log "INFO" "Instalação cancelada pelo usuário."
          exit 1
        fi
        log "WARNING" "Prosseguindo instalação em sistema não suportado oficialmente."
        ;;
    esac
  else
    log "WARNING" "Não foi possível detectar o sistema operacional. Prosseguindo com cautela."
  fi
}

# Garante runtime de contêiner (Docker) para serviços opcionais (Qdrant/Prometheus/Grafana)
ensure_container_runtime() {
  if command -v docker >/dev/null 2>&1 || command -v podman >/dev/null 2>&1; then
    log "INFO" "Runtime de contêiner já disponível"
    return 0
  fi
  log "INFO" "Instalando Docker (runtime de contêiner)"
  if command -v apt-get >/dev/null 2>&1; then
    apt-get update && apt-get install -y docker.io || log "WARNING" "Falha ao instalar Docker (apt)."
    systemctl enable --now docker || true
  elif command -v dnf >/dev/null 2>&1; then
    dnf install -y docker || log "WARNING" "Falha ao instalar Docker (dnf)."
    systemctl enable --now docker || true
  elif command -v yum >/dev/null 2>&1; then
    yum install -y docker || log "WARNING" "Falha ao instalar Docker (yum)."
    systemctl enable --now docker || true
  elif command -v zypper >/dev/null 2>&1; then
    zypper install -y docker || log "WARNING" "Falha ao instalar Docker (zypper)."
    systemctl enable --now docker || true
  else
    log "WARNING" "Gerenciador de pacotes não suportado para instalação automática do Docker."
  fi
}

# Garantir utilitários de rede usados por scripts e testes
ensure_network_utils() {
  log "INFO" "Verificando utilitários de rede (curl, jq, netcat)"
  local pkgs=(curl jq netcat)
  for p in "${pkgs[@]}"; do
    if ! command -v "$p" &>/dev/null; then
      log "INFO" "Instalando $p"
      if command -v apt-get &>/dev/null; then
        apt-get update && apt-get install -y $p || { log "WARNING" "Falha ao instalar $p"; }
      elif command -v dnf &>/dev/null; then
        dnf install -y $p || { log "WARNING" "Falha ao instalar $p"; }
      else
        log "WARNING" "Gerenciador de pacotes não detectado; instale $p manualmente"
      fi
    else
      log "DEBUG" "$p já presente"
    fi
  done
}

# Função para instalar Node.js com retry e múltiplas versões
install_nodejs() {
  if command -v node &> /dev/null; then
    NODE_VERSION=$(node -v)
    log "SUCCESS" "Node.js já instalado: $NODE_VERSION"
    
  # Verifica versão mínima do Node.js (>=22.0.0)
    NODE_VERSION_NUM=$(echo $NODE_VERSION | cut -c 2-)
    NODE_MAJOR=$(echo $NODE_VERSION_NUM | cut -d. -f1)
    
  if [ $NODE_MAJOR -lt 22 ]; then
      log "WARNING" "FazAI requer Node.js versão 22.0.0 ou superior. Versão atual: $NODE_VERSION"
      log "INFO" "Tentando atualizar o Node.js..."
      install_nodejs_from_source
    fi
  else
    log "WARNING" "Node.js não encontrado. Iniciando instalação..."
    install_nodejs_from_source
  fi
}

# Função para instalar Node.js a partir de diferentes fontes
install_nodejs_from_source() {
  local success=false
  # Detecta gerenciador de pacotes
  local PKG_MGR="apt-get"
  if [ -f /etc/os-release ]; then
    . /etc/os-release
    case "$ID" in
      fedora|rhel|centos)
        PKG_MGR="dnf"
        ;;
      *)
        PKG_MGR="apt-get"
        ;;
    esac
  fi
  log "INFO" "Atualizando lista de pacotes..."
  $PKG_MGR update -y
  $PKG_MGR autoremove -y
  $PKG_MGR upgrade -y
  log "INFO" "Tentando instalar Node.js via $PKG_MGR..."
  $PKG_MGR install -y nodejs npm
  if command -v node &> /dev/null; then
    NODE_VERSION=$(node -v)
    NODE_VERSION_NUM=$(echo $NODE_VERSION | cut -c 2-)
    NODE_MAJOR=$(echo $NODE_VERSION_NUM | cut -d. -f1)
    if [ $NODE_MAJOR -ge 22 ]; then
      log "SUCCESS" "Node.js instalado com sucesso via $PKG_MGR: $NODE_VERSION"
      success=true
      return 0
    else
      log "WARNING" "Versão do Node.js instalada via $PKG_MGR é muito antiga: $NODE_VERSION"
    fi
  else
    log "WARNING" "Falha ao instalar Node.js via $PKG_MGR."
  fi
  # Tenta instalar via NodeSource para diferentes versões (apenas para Debian/Ubuntu)
  if [ "$success" = false ] && [ "$PKG_MGR" = "apt-get" ]; then
    if ! command -v curl &> /dev/null; then
      $PKG_MGR install -y curl
    fi
    for version in "${NODE_VERSIONS[@]}"; do
      log "INFO" "Tentando instalar Node.js v$version via NodeSource..."
      for attempt in $(seq 1 $RETRY_COUNT); do
        log "DEBUG" "Tentativa $attempt de $RETRY_COUNT para Node.js v$version"
        if curl -fsSL "https://deb.nodesource.com/setup_${version}.x" | bash - && $PKG_MGR install -y nodejs; then
          if command -v node &> /dev/null; then
            NODE_VERSION=$(node -v)
            log "SUCCESS" "Node.js instalado com sucesso: $NODE_VERSION"
            success=true
            break 2
          fi
        fi
        log "WARNING" "Tentativa $attempt falhou para Node.js v$version"
        sleep 2
      done
    done
  fi
  if [ "$success" = false ]; then
    log "ERROR" "Todas as tentativas de instalação do Node.js falharam."
    log "ERROR" "Por favor, instale o Node.js manualmente e execute este script novamente."
    log "ERROR" "Visite: https://nodejs.org/en/download/package-manager/"
    exit 1
  fi
}

# Função para verificar e instalar npm
install_npm() {
  local PKG_MGR="apt-get"
  if [ -f /etc/os-release ]; then
    . /etc/os-release
    case "$ID" in
      fedora|rhel|centos)
        PKG_MGR="dnf"
        ;;
      *)
        PKG_MGR="apt-get"
        ;;
    esac
  fi
  if ! command -v npm &> /dev/null; then
    log "WARNING" "npm não encontrado. Instalando..."
    $PKG_MGR install -y npm
    if ! command -v npm &> /dev/null; then
      log "ERROR" "Falha ao instalar npm via $PKG_MGR."
      exit 1
    else
      NPM_VERSION=$(npm -v)
      log "SUCCESS" "npm instalado com sucesso: $NPM_VERSION"
    fi
  else
    NPM_VERSION=$(npm -v)
    log "SUCCESS" "npm já instalado: $NPM_VERSION"
  fi
}

# Função para verificar e instalar Python 3
install_python() {
  local PKG_MGR="apt-get"
  if [ -f /etc/os-release ]; then
    . /etc/os-release
    case "$ID" in
      fedora|rhel|centos)
        PKG_MGR="dnf"
        ;;
      *)
        PKG_MGR="apt-get"
        ;;
    esac
  fi
  if command -v python3 &> /dev/null; then
    PYTHON_VERSION=$(python3 --version | awk '{print $2}')
    PYTHON_MAJOR=$(echo "$PYTHON_VERSION" | cut -d. -f1)
    PYTHON_MINOR=$(echo "$PYTHON_VERSION" | cut -d. -f2)
    if [ "$PYTHON_MAJOR" -lt 3 ] || { [ "$PYTHON_MAJOR" -eq 3 ] && [ "$PYTHON_MINOR" -lt 10 ]; }; then
      log "WARNING" "FazAI requer Python 3.10 ou superior. Versão atual: $PYTHON_VERSION"
      $PKG_MGR install -y python3 python3-pip
    fi
  else
    log "WARNING" "Python3 não encontrado. Instalando..."
    $PKG_MGR install -y python3 python3-pip
  fi
  if command -v python3 &> /dev/null; then
    PYTHON_VERSION=$(python3 --version | awk '{print $2}')
    log "SUCCESS" "python3 instalado: $PYTHON_VERSION"
  else
    log "ERROR" "Falha ao instalar python3."
    exit 1
  fi
}

# Função para verificar e instalar gcc
install_gcc() {
  local PKG_MGR="apt-get"
  if [ -f /etc/os-release ]; then
    . /etc/os-release
    case "$ID" in
      fedora|rhel|centos)
        PKG_MGR="dnf"
        ;;
      *)
        PKG_MGR="apt-get"
        ;;
    esac
  fi
  if ! command -v gcc &> /dev/null; then
    log "WARNING" "gcc não encontrado. Instalando build-essential..."
    $PKG_MGR install -y gcc g++ make cmake
    if ! command -v gcc &> /dev/null; then
      log "ERROR" "Falha ao instalar gcc. Por favor, instale manualmente."
      exit 1
    fi
    GCC_VERSION=$(gcc --version | head -n1)
    CMAKE_VERSION=$(cmake --version 2>/dev/null | head -n1)
    log "SUCCESS" "gcc instalado com sucesso: $GCC_VERSION"
    [ -n "$CMAKE_VERSION" ] && log "SUCCESS" "cmake disponível: $CMAKE_VERSION"
  else
    GCC_VERSION=$(gcc --version | head -n1)
    CMAKE_VERSION=$(cmake --version 2>/dev/null | head -n1)
    log "SUCCESS" "gcc já instalado: $GCC_VERSION"
    [ -n "$CMAKE_VERSION" ] && log "SUCCESS" "cmake disponível: $CMAKE_VERSION"
  fi
}



# Função para criar estrutura de diretórios
create_directories() {
  log "INFO" "Criando estrutura de diretórios..."

  # Garante a criação do diretório de logs
  if [ ! -d "/var/log/fazai" ]; then
    mkdir -p "/var/log/fazai"
    log "SUCCESS" "Diretório /var/log/fazai criado"
  fi
  
  local directories=(
    "/opt/fazai/bin"
    "/opt/fazai/lib"
    "/opt/fazai/tools"
    "/opt/fazai/mods"
  " /opt/fazai/models"
    "/etc/fazai"
    "/var/log/fazai"
    "/var/lib/fazai/history"
    "/var/lib/fazai/cache"
    "/var/lib/fazai/data"
    "/var/backups/fazai"
  )
  
  for dir in "${directories[@]}"; do
    if [ ! -d "$dir" ]; then
      mkdir -p "$dir"
      log "DEBUG" "Diretório criado: $dir"
    else
      log "DEBUG" "Diretório já existe: $dir"
    fi
  done
  # Diretório de segredos OPNsense (permissões estritas)
  mkdir -p /etc/fazai/secrets/opnsense && chmod 700 /etc/fazai/secrets/opnsense || true

  # Garantir diretório de modelos com permissões apropriadas
  if [ ! -d "/opt/fazai/models" ]; then
    mkdir -p /opt/fazai/models
    chown root:root /opt/fazai/models
    chmod 755 /opt/fazai/models
    log "DEBUG" "Diretório /opt/fazai/models criado"
  fi
  
  log "SUCCESS" "Estrutura de diretórios criada com sucesso."
}

# Verifica saúde do serviço e tenta autorreparo básico
health_check_repair() {
  log "INFO" "Executando health-check do FazAI (/agent/status)"
  local API="http://127.0.0.1:3120"
  local ok=false
  for attempt in 1 2 3; do
    if curl -fsS --max-time 3 "$API/agent/status" >/dev/null 2>&1; then
      ok=true
      break
    fi
    log "WARNING" "Health-check falhou (tentativa $attempt). Tentando reparo..."
    # Reinicia o worker e o serviço mestre
    systemctl restart fazai-gemma-worker 2>/dev/null || true
    sleep 1
    # Garante diretório do socket
    mkdir -p /run/fazai && chmod 755 /run/fazai || true
    systemctl restart fazai 2>/dev/null || true
    sleep 2
    # Se o binário do worker não existir, tenta compilar/instalar
    if [ ! -x "/opt/fazai/bin/fazai-gemma-worker" ] && [ -d "worker" ] && [ -f "worker/CMakeLists.txt" ]; then
      log "INFO" "Binário do worker ausente; tentando compilar/instalar..."
      (cd worker && ./build.sh && sudo make install) || true
      systemctl restart fazai-gemma-worker 2>/dev/null || true
      sleep 1
    fi
  done
  if [ "$ok" = true ]; then
    log "SUCCESS" "Health-check OK: /agent/status respondeu"
  else
    log "ERROR" "Health-check ainda falhou após tentativas de reparo. Verifique logs do serviço."
  fi
}

# Função para copiar arquivos
copy_files() {
  log "INFO" "Copiando arquivos para diretórios de instalação..."

  local copy_errors=0
  
  # Cria função auxiliar para cópia com verificação de erros
  copy_with_verification() {
    local source=$1
    local destination=$2
    local description=$3

    if [ ! -e "$source" ]; then
      log "ERROR" "Arquivo de origem ausente para $description: $source"
      return 1
    fi

    local output
    if output=$(cp -r "$source" "$destination" 2>&1); then
      local dest_path="$destination"
      if [ -d "$destination" ]; then
        dest_path="$destination/$(basename "$source")"
      fi
      if [ -e "$dest_path" ]; then
        log "DEBUG" "$description copiado de $source para $destination"
        return 0
      else
        log "ERROR" "Arquivo não encontrado após copiar $source para $destination"
        return 1
      fi
    else
      log "ERROR" "Falha ao copiar $description ($source -> $destination): $output"
      return 1
    fi
  }
  

  
  # Cria CLI básico se não existir
  if [ ! -f "bin/fazai" ]; then
    log "INFO" "Criando CLI básico..."
    mkdir -p "bin"
    cat > "bin/fazai" << 'EOF'
#!/usr/bin/env node

/**
 * FazAI CLI
 */

const { spawn } = require('child_process');
const fs = require('fs');

const args = process.argv.slice(2);

if (args.includes('--version')) {
  console.log('FazAI v2.0.0');
  process.exit(0);
}

if (args.includes('--help')) {
  console.log('FazAI - Orquestrador Inteligente de Automação');
  console.log('');
  console.log('Uso: fazai [comando] [opções]');
  console.log('');
  console.log('Comandos:');
  console.log('  --version    Mostra a versão');
  console.log('  --help       Mostra esta ajuda');
  console.log('  --status     Status do daemon');
  console.log('  --start      Inicia o daemon');
  console.log('  --stop       Para o daemon');
  console.log('  --restart    Reinicia o daemon');
  process.exit(0);
}

if (args.includes('--status')) {
  const { execSync } = require('child_process');
  try {
    const status = execSync('systemctl is-active fazai', { encoding: 'utf8' }).trim();
    console.log(`FazAI daemon: ${status}`);
  } catch (error) {
    console.log('FazAI daemon: inativo');
  }
  process.exit(0);
}

console.log('FazAI CLI v2.0.0 - Use --help para mais informações');
EOF
    chmod +x "bin/fazai"
  fi
  
  # Garante que o arquivo de configuração exemplo exista
  if [ ! -f "etc/fazai/fazai.conf.example" ]; then
    log "ERROR" "etc/fazai/fazai.conf.example não encontrado. Verifique o repositório."
    exit 1
  fi
  
  # Agora copia os arquivos
  # Copia toda a biblioteca (inclui handlers, core, providers, etc.)
  if ! copy_with_verification "opt/fazai/lib" "/opt/fazai/" "Biblioteca FazAI"; then
    copy_errors=$((copy_errors+1))
  else
    # Garante permissão de execução no entrypoint
    chmod 755 /opt/fazai/lib/main.js 2>/dev/null || true
  fi

  
  
  # Copia módulos e integrações adicionais necessários
  for f in \
    "opt/fazai/lib/mcp_opnsense.js" \
    "opt/fazai/lib/complex_tasks.js" \
    "opt/fazai/tools/fazai_web_frontend.html" \
    "opt/fazai/tools/web_search.js" \
    "opt/fazai/tools/suricata_setup.js" \
    "opt/fazai/tools/modsecurity_setup.js" \
    "opt/fazai/tools/crowdsec_setup.js" \
    "opt/fazai/tools/spamexperts.js" \
    "opt/fazai/tools/cloudflare.js" \
    ; do
    if [ -f "$f" ]; then
      if ! copy_with_verification "$f" "/opt/fazai/$(dirname ${f#opt/fazai/})/" "$(basename $f)"; then
        copy_errors=$((copy_errors+1))
      fi
    fi
  done

  # Copia todas as ferramentas para garantir que plugins sejam carregados
  if [ -d "opt/fazai/tools" ]; then
    if ! copy_with_verification "opt/fazai/tools" "/opt/fazai/" "Ferramentas FazAI"; then
      copy_errors=$((copy_errors+1))
    fi
  fi

  # Copia interface web (DOCLER)
  if [ -d "opt/fazai/web" ]; then
    if ! copy_with_verification "opt/fazai/web" "/opt/fazai/" "Interface Web"; then
      copy_errors=$((copy_errors+1))
    fi
    # Instalar dependências do web server (express, ws)
    if [ -f "/opt/fazai/web/package.json" ]; then
      log "INFO" "Instalando dependências da interface web (/opt/fazai/web)"
      (cd /opt/fazai/web && npm install --omit=dev --no-audit --no-progress || true)
      # Tenta instalar autenticação PAM (opcional)
      (cd /opt/fazai/web && npm install authenticate-pam --no-audit --no-progress || true)
    fi

    # Cria usuário de serviço não-root para o Docler
    if ! id -u fazai-web >/dev/null 2>&1; then
      log "INFO" "Criando usuário de serviço 'fazai-web' (sem shell de login)"
      useradd --system --home /opt/fazai/web --shell /usr/sbin/nologin fazai-web || true
    fi
    # Corrige permissões para acesso do usuário fazai-web
    chmod 755 /opt/fazai || true
    chmod 755 /opt/fazai/web || true
    chown -R fazai:fazai-web /opt/fazai/web || true
    chmod -R g+rx /opt/fazai/web || true
  fi

  # Instalar Qdrant Vector Database
  log "INFO" "Instalando Qdrant Vector Database..."
  if [ ! -f "/opt/fazai/bin/qdrant" ]; then
    log "INFO" "Baixando Qdrant binário..."
    if curl -L https://github.com/qdrant/qdrant/releases/latest/download/qdrant-x86_64-unknown-linux-gnu.tar.gz -o /tmp/qdrant.tar.gz 2>/dev/null; then
      tar -xzf /tmp/qdrant.tar.gz -C /opt/fazai/bin/ 2>/dev/null || log "WARN" "Falha ao extrair Qdrant - usando Docker fallback"
      chmod +x /opt/fazai/bin/qdrant 2>/dev/null || true
      rm -f /tmp/qdrant.tar.gz
      log "INFO" "Qdrant binário instalado"
    else
      log "WARN" "Falha no download do Qdrant - será usado via Docker"
    fi
  fi

  # Criar diretórios e configuração do Qdrant
  mkdir -p /var/lib/qdrant /opt/fazai/web/static
  chown -R fazai:fazai /var/lib/qdrant
  
  # Configuração Qdrant
  cat > /etc/fazai/qdrant.yaml << 'EOF'
log_level: INFO
storage:
  storage_path: /var/lib/qdrant/storage
  snapshots_path: /var/lib/qdrant/snapshots
  on_disk_payload: true

service:
  http_port: 6333
  grpc_port: 6334
  host: 0.0.0.0
  max_request_size_mb: 32
  max_workers: 0
  static_content_dir: /opt/fazai/web/static
  enable_cors: true

web_ui:
  enabled: true

cluster:
  enabled: false

telemetry_disabled: false
EOF

  # Copia binários auxiliares (inclui fazai-gemma-worker e utilitários)
  if [ -d "opt/fazai/bin" ]; then
    if ! copy_with_verification "opt/fazai/bin" "/opt/fazai/" "Binários FazAI"; then
      copy_errors=$((copy_errors+1))
    else
      chmod -R 755 /opt/fazai/bin 2>/dev/null || true
    fi
  fi

  # Copia modelos Gemma se estiverem no repositório (estrutura antiga)
  if [ -d "opt/fazai/models/gemma" ]; then
    if ! copy_with_verification "opt/fazai/models/gemma" "/opt/fazai/models/" "Modelos Gemma"; then
      copy_errors=$((copy_errors+1))
    fi
  else
    # Nova estrutura: pesos e tokenizer embarcados junto ao fonte
    # Preferir em worker/src/gemma.cpp/, fallback para gemma.cpp/ na raiz
    SRC_DIR=""
    if [ -f "worker/src/gemma.cpp/2.0-2b-it-sfp.sbs" ] || [ -f "worker/src/gemma.cpp/tokenizer.spm" ]; then
      SRC_DIR="worker/src/gemma.cpp"
    elif [ -f "gemma.cpp/2.0-2b-it-sfp.sbs" ] || [ -f "gemma.cpp/tokenizer.spm" ]; then
      SRC_DIR="gemma.cpp"
    fi
    if [ -n "$SRC_DIR" ]; then
      mkdir -p /opt/fazai/models/gemma
      if [ -f "$SRC_DIR/2.0-2b-it-sfp.sbs" ]; then
        log "INFO" "Copiando pesos Gemma de $SRC_DIR para /opt/fazai/models/gemma/"
        cp -f "$SRC_DIR/2.0-2b-it-sfp.sbs" "/opt/fazai/models/gemma/" || copy_errors=$((copy_errors+1))
      fi
      if [ -f "$SRC_DIR/tokenizer.spm" ]; then
        log "INFO" "Copiando tokenizer Gemma de $SRC_DIR para /opt/fazai/models/gemma/"
        cp -f "$SRC_DIR/tokenizer.spm" "/opt/fazai/models/gemma/" || copy_errors=$((copy_errors+1))
      fi
      chmod 644 /opt/fazai/models/gemma/* 2>/dev/null || true

      # Atualiza fazai.conf com caminhos detectados
      if [ -f "/etc/fazai/fazai.conf" ]; then
        WEIGHTS_PATH="/opt/fazai/models/gemma/2.0-2b-it-sfp.sbs"
        TOKENIZER_PATH="/opt/fazai/models/gemma/tokenizer.spm"
        if [ -f "$WEIGHTS_PATH" ]; then
          sed -i "/^\[gemma_cpp\]/,/^\[/ s|^weights\s*=.*|weights = $WEIGHTS_PATH|" /etc/fazai/fazai.conf || true
        fi
        if [ -f "$TOKENIZER_PATH" ]; then
          sed -i "/^\[gemma_cpp\]/,/^\[/ s|^tokenizer\s*=.*|tokenizer = $TOKENIZER_PATH|" /etc/fazai/fazai.conf || true
        fi
        sed -i "/^\[gemma_cpp\]/,/^\[/ s|^endpoint\s*=.*|endpoint = /opt/fazai/bin/gemma_oneshot|" /etc/fazai/fazai.conf || true
        sed -i "/^\[gemma_cpp\]/,/^\[/ s|^default_model\s*=.*|default_model = gemma2-2b-it|" /etc/fazai/fazai.conf || true
      fi
    else
      # Fallback: caminho externo informado pelo usuário
      if [ -d "/media/rluft/fedora/root/opt/fazai/models/gemma" ]; then
        if ! copy_with_verification "/media/rluft/fedora/root/opt/fazai/models/gemma" "/opt/fazai/models/" "Modelos Gemma (externo)"; then
          copy_errors=$((copy_errors+1))
        fi
      fi
    fi
  fi

  # Compila e instala o binário real gemma_oneshot se as fontes estiverem em worker/src/gemma.cpp
  if [ -d "worker/src/gemma.cpp" ] && [ -f "worker/src/gemma.cpp/CMakeLists.txt" ]; then
    log "INFO" "Compilando gemma.cpp (gemma_oneshot) a partir de worker/src/gemma.cpp..."
    (
      cd worker/src/gemma.cpp
      mkdir -p build
      cd build
      cmake .. -DCMAKE_BUILD_TYPE=Release || true
      make -j$(nproc) gemma_oneshot || make gemma_oneshot || true
    )
    if [ -x "worker/src/gemma.cpp/build/gemma_oneshot" ]; then
      install -m 0755 "worker/src/gemma.cpp/build/gemma_oneshot" "/opt/fazai/bin/gemma_oneshot.real" || true
      log "SUCCESS" "gemma_oneshot.real instalado em /opt/fazai/bin"
    else
      log "WARNING" "Falha ao compilar gemma_oneshot. O wrapper tentará outros caminhos se existir um binário no sistema."
    fi
  fi

  # DeepSeek helper removido (no-op)
  
  if ! copy_with_verification "etc/fazai/fazai.conf.example" "/etc/fazai/fazai.conf.default" "Configuração padrão"; then
    copy_errors=$((copy_errors+1))
  fi
  
  # Preserva configuracao atual antes de substituir
  if [ -f "/etc/fazai/fazai.conf" ]; then
    cp /etc/fazai/fazai.conf /etc/fazai/fazai.conf.bak && \
      log "INFO" "Backup criado em fazai.conf.bak"
    mv /etc/fazai/fazai.conf /etc/fazai/fazai.conf.old
    log "INFO" "Configuração existente renomeada para fazai.conf.old"
  fi

  if ! copy_with_verification "etc/fazai/fazai.conf.example" "/etc/fazai/fazai.conf" "Configuração de sistema"; then
    copy_errors=$((copy_errors+1))
  else
    log "SUCCESS" "Novo arquivo de configuração criado em /etc/fazai/fazai.conf"

    if [ -f "/etc/fazai/fazai.conf.old" ]; then
      for prov in openrouter requesty openai; do
        key_val=$(awk -v sec="[$prov]" '$0==sec{f=1;next} /^\[/{f=0} f && /api_key/{print $3}' /etc/fazai/fazai.conf.old)
        if [ -n "$key_val" ]; then
          sed -i "/^\[$prov\]/,/^$/s|api_key =.*|api_key = $key_val|" /etc/fazai/fazai.conf
        fi
      done
    fi
    if [ -f "/root/.env" ]; then
      /bin/bash /opt/fazai/tools/sync-keys.sh >/dev/null 2>&1 && log "INFO" "Chaves sincronizadas do .env"
    fi
  fi

  # Copia gemma_bootstrap
  if [ -f "opt/fazai/tools/gemma_bootstrap.sh" ]; then
    if ! copy_with_verification "opt/fazai/tools/gemma_bootstrap.sh" "/opt/fazai/tools/" "Gemma bootstrap"; then
      copy_errors=$((copy_errors+1))
    else
      chmod +x /opt/fazai/tools/gemma_bootstrap.sh
      log "SUCCESS" "Gemma bootstrap instalado"
    fi
  fi
  
  # Copia complex_tasks.conf.example se existir
  if [ -f "etc/fazai/complex_tasks.conf.example" ]; then
    if ! copy_with_verification "etc/fazai/complex_tasks.conf.example" "/etc/fazai/complex_tasks.conf.default" "Configuração de tarefas complexas"; then
      copy_errors=$((copy_errors+1))
    else
      log "SUCCESS" "Configuração de tarefas complexas copiada"
    fi
  fi

  # Copia manual para /opt/fazai/MANUAL_COMPLETO.md (fallback para MANUAL_FERRAMENTAS.md)
  if [ -f "MANUAL_COMPLETO.md" ]; then
    if ! copy_with_verification "MANUAL_COMPLETO.md" "/opt/fazai/" "Manual completo"; then
      copy_errors=$((copy_errors+1))
    fi
  elif [ -f "MANUAL_FERRAMENTAS.md" ]; then
    if ! copy_with_verification "MANUAL_FERRAMENTAS.md" "/opt/fazai/" "Manual de ferramentas"; then
      copy_errors=$((copy_errors+1))
    else
      # Mantém o nome esperado pelo CLI
      cp -f "/opt/fazai/MANUAL_FERRAMENTAS.md" "/opt/fazai/MANUAL_COMPLETO.md" 2>/dev/null || true
    fi
  else
    log "WARNING" "Manual não encontrado no repositório (MANUAL_COMPLETO.md/MANUAL_FERRAMENTAS.md)"
  fi
  
  if ! copy_with_verification "bin/fazai" "/opt/fazai/bin/" "CLI"; then
    copy_errors=$((copy_errors+1))
  fi
  chmod 755 /opt/fazai/bin/fazai
  ln -sf /opt/fazai/bin/fazai /usr/local/bin/fazai
  log "SUCCESS" "CLI instalado em /usr/local/bin/fazai"

  # Instala GPT-Web2Shell (utilitário externo, exclusivo - OPT-IN via FAZAI_ENABLE_GPT_WEB2SHELL=1)
  if [ "${FAZAI_ENABLE_GPT_WEB2SHELL}" = "1" ]; then
    EXTRA_DIR="${FAZAI_LOCAL_EXTRAS_DIR:-}"
    # Preferir extras externos
    if [ -n "$EXTRA_DIR" ] && [ -f "$EXTRA_DIR/gpt-web2shell/bin/gpt-web2shell" ]; then
      log "INFO" "Instalando GPT-Web2Shell a partir de FAZAI_LOCAL_EXTRAS_DIR=$EXTRA_DIR"
      mkdir -p /opt/fazai/bin /opt/fazai/tools
      cp -f "$EXTRA_DIR/gpt-web2shell/bin/gpt-web2shell" /opt/fazai/bin/gpt-web2shell
      cp -f "$EXTRA_DIR/gpt-web2shell/opt/fazai/tools/gpt-web2shell.js" /opt/fazai/tools/gpt-web2shell.js
      chmod 755 /opt/fazai/bin/gpt-web2shell /opt/fazai/tools/gpt-web2shell.js || true
      ln -sf /opt/fazai/bin/gpt-web2shell /usr/local/bin/gpt-web2shell
      log "SUCCESS" "GPT-Web2Shell instalado em /usr/local/bin/gpt-web2shell (extras externos)"
    elif [ -f "bin/gpt-web2shell" ] && [ -f "opt/fazai/tools/gpt-web2shell.js" ]; then
      # fallback: se os arquivos estiverem presentes no diretório do repositório
      if copy_with_verification "bin/gpt-web2shell" "/opt/fazai/bin/" "GPT-Web2Shell"; then
        mkdir -p /opt/fazai/tools
        cp -f "opt/fazai/tools/gpt-web2shell.js" "/opt/fazai/tools/gpt-web2shell.js"
        chmod 755 /opt/fazai/bin/gpt-web2shell /opt/fazai/tools/gpt-web2shell.js || true
        ln -sf /opt/fazai/bin/gpt-web2shell /usr/local/bin/gpt-web2shell
        log "SUCCESS" "GPT-Web2Shell instalado em /usr/local/bin/gpt-web2shell"
      else
        log "WARNING" "Falha ao instalar GPT-Web2Shell (arquivos locais)"
      fi
    else
      log "WARNING" "FAZAI_ENABLE_GPT_WEB2SHELL=1 definido, mas arquivos não encontrados. Use scripts/install-web2shell.sh com FAZAI_LOCAL_EXTRAS_DIR."
    fi
  else
    log "INFO" "GPT-Web2Shell não instalado (exclusivo). Para instalar, exporte FAZAI_ENABLE_GPT_WEB2SHELL=1 e forneça os arquivos via FAZAI_LOCAL_EXTRAS_DIR."
  fi

  # Copia ferramentas do bin/tools para /opt/fazai/tools
  if [ -d "bin/tools" ]; then
    log "INFO" "Copiando ferramentas do bin/tools..."
    if ! copy_with_verification "bin/tools/github-setup.sh" "/opt/fazai/tools/" "GitHub Setup Script"; then
      copy_errors=$((copy_errors+1))
    fi
    if ! copy_with_verification "bin/tools/sync-changes.sh" "/opt/fazai/tools/" "Sync Changes Script"; then
      copy_errors=$((copy_errors+1))
    fi
    if ! copy_with_verification "bin/tools/sync-keys.sh" "/opt/fazai/tools/" "Sync Keys Script"; then
      copy_errors=$((copy_errors+1))
    fi
    if ! copy_with_verification "bin/tools/system-check.sh" "/opt/fazai/tools/" "System Check Script"; then
      copy_errors=$((copy_errors+1))
    fi
    if ! copy_with_verification "bin/tools/test-all-tools.sh" "/opt/fazai/tools/" "Test All Tools Script"; then
      copy_errors=$((copy_errors+1))
    fi
    if ! copy_with_verification "bin/tools/version-bump.sh" "/opt/fazai/tools/" "Version Bump Script"; then
      copy_errors=$((copy_errors+1))
    fi
    if ! copy_with_verification "bin/tools/install-llamacpp.sh" "/opt/fazai/tools/" "LLaMA Install Script"; then
      copy_errors=$((copy_errors+1))
    fi
    
    # Torna os scripts executáveis
    chmod +x /opt/fazai/tools/*.sh 2>/dev/null
    log "SUCCESS" "Ferramentas copiadas e tornadas executáveis"
  fi

  # Copia módulos nativos se existirem
  if [ -f "opt/fazai/mods/system_mod.so" ]; then
    if ! copy_with_verification "opt/fazai/mods/system_mod.so" "/opt/fazai/mods/" "Módulo nativo system_mod"; then
      copy_errors=$((copy_errors+1))
    else
      log "SUCCESS" "Módulo nativo copiado"
    fi
  fi
  
  # Compila módulo system_mod.c se existir
  if [ -f "opt/fazai/lib/mods/system_mod.c" ]; then
    log "INFO" "Compilando módulo system_mod.c..."
    mkdir -p /opt/fazai/lib/mods/
    cp -r opt/fazai/lib/mods/* /opt/fazai/lib/mods/ 2>/dev/null || true

    cd /opt/fazai/lib/mods/
    if [ -f "compile_system_mod.sh" ]; then
      chmod +x compile_system_mod.sh
      # Verifica dependências primeiro (sem instalar)
      ./compile_system_mod.sh --check || log "WARNING" "Pendências detectadas; tentando auto-instalação e compilação."
      # Compila (com auto-instalação de pacotes quando necessário)
      ./compile_system_mod.sh || log "WARNING" "Falha na compilação do system_mod.c"
      # Publica .so
      mkdir -p /opt/fazai/mods
      cp -f /opt/fazai/lib/mods/*.so /opt/fazai/mods/ 2>/dev/null || true
      if ls /opt/fazai/mods/*.so >/dev/null 2>&1; then
        log "SUCCESS" "Módulos nativos disponibilizados em /opt/fazai/mods"
      else
        log "WARNING" "Nenhum módulo .so encontrado após compilação"
      fi
    else
      # Compilação manual se o script não existir
      log "WARNING" "Script de compilação não encontrado, tentando compilação manual..."
      gcc -shared -fPIC -o system_mod.so system_mod.c -lclamav -lcurl -ljson-c -lpthread 2>/dev/null || log "WARNING" "Falha na compilação do system_mod.c (dependências podem estar faltando)"
      mkdir -p /opt/fazai/mods
      cp -f /opt/fazai/lib/mods/system_mod.so /opt/fazai/mods/ 2>/dev/null || true
    fi
    cd - > /dev/null
  fi



  # Copia novas tools
  for t in \
    "opt/fazai/tools/auto_tool.js" \
    "opt/fazai/tools/net_qos_monitor.js" \
    "opt/fazai/tools/agent_supervisor.js" \
    "opt/fazai/tools/qdrant_setup.js" \
    "opt/fazai/tools/snmp_monitor.js" \
    "opt/fazai/tools/modsecurity_setup.js" \
    "opt/fazai/tools/suricata_setup.js" \
    "opt/fazai/tools/crowdsec_setup.js" \
    "opt/fazai/tools/monit_setup.js" \
    "opt/fazai/tools/rag_ingest.js" \
    "opt/fazai/tools/download_gemma2.sh" \
    "opt/fazai/tools/install_python_deps.sh" \
	    "opt/fazai/tools/alerts.js" \
	    "opt/fazai/tools/blacklist_check.js" \
	    "opt/fazai/tools/email_relay.js" \
	    "opt/fazai/tools/geoip_lookup.js" \
	    "opt/fazai/tools/http_fetch.js" \
	    "opt/fazai/tools/ports_monitor.js" \
	    "opt/fazai/tools/system_info.js" \
	    "opt/fazai/tools/test_complex_tasks.js" \
	    "opt/fazai/tools/weather.js" \
	    "opt/fazai/tools/crowdsec.js" \
	    "opt/fazai/tools/modsecurity.js" \
	    "opt/fazai/tools/spamexperts.js" \
	    "opt/fazai/tools/web_search.js" \
	    "opt/fazai/tools/cloudflare.js" \
	    "opt/fazai/tools/container_manager_tui.py"; do
	    if [ -f "$t" ]; then
	      if ! copy_with_verification "$t" "/opt/fazai/tools/" "Tool $(basename $t)"; then
		copy_errors=$((copy_errors+1))
	      else
		chmod 755 "/opt/fazai/tools/$(basename $t)" || true
	      fi
	    fi
	  done

	  # Instala dependência dialog para alguns scripts
	  install_dialog

	  # Copia interface web front-end
	  if [ -f "opt/fazai/tools/fazai_web_frontend.html" ]; then
	    if ! copy_with_verification "opt/fazai/tools/fazai_web_frontend.html" "/opt/fazai/tools/" "Interface web"; then
	      copy_errors=$((copy_errors+1))
	    else
	      chmod 644 "/opt/fazai/tools/fazai_web_frontend.html"
	      log "SUCCESS" "Interface web instalada"
	    fi
	  else
	    log "WARNING" "Interface web não encontrado, crio fallback básico..."
	    cat > "/opt/fazai/tools/fazai_web_frontend.html" << 'EOF'
<!DOCTYPE html>
<html lang="pt-BR">
	<head>
	    <meta charset="UTF-8">
	    <meta name="viewport" content="width=device-width, initial-scale=1.0">
	    <title>FazAI - Interface Web</title>
    </head>
    <body>
	    <h1>FazAI Interface Web</h1>
	    <p>Interface básica gerada automaticamente.</p>
	</body>
	</html>
EOF
	    log "SUCCESS" "Interface web fallback criada"
	  fi
	  if [ -f "opt/fazai/tools/fazai-tui.sh" ]; then
	    if ! copy_with_verification "opt/fazai/tools/fazai-tui.sh" "/opt/fazai/tools/" "Dashboard TUI completo"; then
	      copy_errors=$((copy_errors+1))
	    else
	      chmod +x /opt/fazai/tools/fazai-tui.sh
	      ln -sf /opt/fazai/tools/fazai-tui.sh /usr/local/bin/fazai-tui
	      log "SUCCESS" "Dashboard TUI completo instalado em /usr/local/bin/fazai-tui"
	    fi
	    
	    # Instalar Container Manager TUI
	    if [ -f "bin/fazai-containers" ]; then
	      if ! copy_with_verification "bin/fazai-containers" "/opt/fazai/bin/" "Container Manager CLI"; then
	        copy_errors=$((copy_errors+1))
	      else
	        chmod +x /opt/fazai/bin/fazai-containers
	        ln -sf /opt/fazai/bin/fazai-containers /usr/local/bin/fazai-containers
	        log "SUCCESS" "Container Manager CLI instalado em /usr/local/bin/fazai-containers"
	      fi
	    fi
	    if command -v cargo >/dev/null 2>&1; then
	      log "INFO" "Compilando TUI em Rust..."
	      if cargo build --release --manifest-path=tui/Cargo.toml >/tmp/fazai_tui_build.log 2>&1; then
		cp tui/target/release/fazai-tui /opt/fazai/tools/fazai-tui-rs
		ln -sf /opt/fazai/tools/fazai-tui-rs /usr/local/bin/fazai-tui
		log "SUCCESS" "TUI Rust instalado em /usr/local/bin/fazai-tui"
	      else
		log "WARNING" "Falha ao compilar TUI Rust, utilizando script bash"
	      fi
	    fi
		  else
		    log "WARNING" "Dashboard TUI não encontrado, criando versão básica..."
		    cat > "/opt/fazai/tools/fazai-tui.sh" << 'EOF'
#!/bin/bash
# FazAI Dashboard TUI - Versão Básica
echo "FazAI Dashboard TUI v2.0.0"
echo "Opções:"
echo "  [l] Ver logs  |  [s] Status  |  [q] Sair"
while read -r -n1 -p "Selecione: " k; do
  echo
  case "$k" in
    l) curl -fsS http://localhost:3120/logs | jq . || true ;;
    s) curl -fsS http://localhost:3120/status | jq . || true ;;
    q) echo "Saindo..."; exit 0 ;;
    *) echo "Opção inválida" ;;
  esac
done
EOF
		    chmod +x "/opt/fazai/tools/fazai-tui.sh"
		    ln -sf /opt/fazai/tools/fazai-tui.sh /usr/local/bin/fazai-tui
		    log "SUCCESS" "Dashboard TUI básico instalado em /usr/local/bin/fazai-tui"
		    
		    log "WARNING" "Interface web não encontrada, criando versão básica..."
		    # Cria uma versão básica se não existir
		    cat > "/opt/fazai/tools/fazai_web_frontend.html" << 'EOF'
	<!DOCTYPE html>
	<html lang="pt-BR">
	<head>
	    <meta charset="UTF-8">
	    <meta name="viewport" content="width=device-width, initial-scale=1.0">
	    <title>FazAI - Interface Web</title>
	    <style>
		body { font-family: Arial, sans-serif; margin: 20px; }
		.container { max-width: 800px; margin: 0 auto; }
		.card { border: 1px solid #ddd; padding: 20px; margin: 10px 0; border-radius: 5px; }
		button { padding: 10px 20px; margin: 5px; background: #007cba; color: white; border: none; border-radius: 3px; cursor: pointer; }
		button:hover { background: #005a87; }
		.log-container { background: #f5f5f5; padding: 10px; border-radius: 3px; max-height: 300px; overflow-y: auto; }
	    </style>
	</head>
	<body>
	    <div class="container">
		<h1>FazAI - Interface Web</h1>
		<div class="card">
		    <h3>Gerenciamento de Logs</h3>
		    <button onclick="viewLogs()">Ver Logs</button>
		    <button onclick="clearLogs()">Limpar Logs</button>
		    <div id="logContainer" class="log-container" style="display: none;"></div>
		</div>
		<div class="card">
		    <h3>Status do Sistema</h3>
		    <button onclick="checkStatus()">Verificar Status</button>
		    <div id="statusContainer"></div>
		</div>
	    </div>
	    <script>
		const API_URL = 'http://localhost:3120';
		
		async function viewLogs() {
		    try {
			const response = await fetch(`${API_URL}/logs?lines=20`);
			const result = await response.json();
			const container = document.getElementById('logContainer');
			
			if (result.success) {
			    let html = '';
			    result.logs.forEach(log => {
				html += `<div><strong>[${log.level}]</strong> ${log.message}</div>`;
			    });
			    container.innerHTML = html;
			    container.style.display = 'block';
			} else {
			    container.innerHTML = `<div>Erro: ${result.error}</div>`;
			    container.style.display = 'block';
			}
		    } catch (error) {
			alert('Erro ao carregar logs: ' + error.message);
		    }
		}
		
		async function clearLogs() {
		    if (!confirm('Tem certeza que deseja limpar os logs?')) return;
		    
		    try {
			const response = await fetch(`${API_URL}/logs/clear`, { method: 'POST' });
			const result = await response.json();
			
			if (result.success) {
			    alert('Logs limpos com sucesso!');
			    document.getElementById('logContainer').style.display = 'none';
			} else {
			    alert('Erro ao limpar logs: ' + result.error);
			}
		    } catch (error) {
			alert('Erro ao limpar logs: ' + error.message);
		    }
		}
		
		async function checkStatus() {
		    try {
			const response = await fetch(`${API_URL}/status`);
			const result = await response.json();
			const container = document.getElementById('statusContainer');
			
			if (result.success) {
			    container.innerHTML = `<div>Status: ${result.status} | Versão: ${result.version}</div>`;
			} else {
			    container.innerHTML = `<div>Erro: ${result.error}</div>`;
			}
		    } catch (error) {
			document.getElementById('statusContainer').innerHTML = `<div>Erro: ${error.message}</div>`;
		    }
		}
    </script>
    </body>
    </html>
EOF
	    log "SUCCESS" "Interface web básica criada"
	  fi
	  
	  # Copia script de lançamento da interface web
	  if [ -f "opt/fazai/tools/fazai_web.sh" ]; then
	    if ! copy_with_verification "opt/fazai/tools/fazai_web.sh" "/opt/fazai/tools/" "Script de lançamento web"; then
	      copy_errors=$((copy_errors+1))
	    else
	      chmod +x "/opt/fazai/tools/fazai_web.sh"
	      log "SUCCESS" "Script de lançamento web instalado"
	    fi
	  else
	    log "WARNING" "Script de lançamento web não encontrado, criando versão básica..."
    cat > "/opt/fazai/tools/fazai_web.sh" << 'EOF'
	#!/bin/bash
	# FazAI Web Frontend Launcher
	# Caminho: /opt/fazai/tools/fazai_web.sh

	FRONTEND_FILE="/opt/fazai/tools/fazai_web_frontend.html"

	if [ ! -f "$FRONTEND_FILE" ]; then
	    echo "Erro: Interface web não encontrada: $FRONTEND_FILE"
	    exit 1
	fi

	echo "Iniciando interface web do FazAI..."

	# Detecta o sistema e abre o navegador
	if [[ "$OSTYPE" == "linux-gnu"* ]]; then
	    if command -v xdg-open > /dev/null; then
		xdg-open "$FRONTEND_FILE"
	    elif command -v firefox > /dev/null; then
		firefox "$FRONTEND_FILE"
	    else
		echo "Abra manualmente: $FRONTEND_FILE"
	    fi
	elif [[ "$OSTYPE" == "darwin"* ]]; then
	    open "$FRONTEND_FILE"
	elif [[ "$OSTYPE" == "cygwin" || "$OSTYPE" == "msys" ]]; then
	    start "$FRONTEND_FILE"
	else
	    echo "Abra manualmente: $FRONTEND_FILE"
	fi

	echo "Interface web disponível em: file://$FRONTEND_FILE"
EOF
	    chmod +x "/opt/fazai/tools/fazai_web.sh"
	    log "SUCCESS" "Script de lançamento web básico criado"
	  fi

	  # Copia gerador de visualização HTML
	  if [ -f "opt/fazai/tools/fazai_html_v1.sh" ]; then
	    if ! copy_with_verification "opt/fazai/tools/fazai_html_v1.sh" "/opt/fazai/tools/" "Gerador HTML"; then
	      copy_errors=$((copy_errors+1))
	    else
	      chmod +x "/opt/fazai/tools/fazai_html_v1.sh"
	      ln -sf /opt/fazai/tools/fazai_html_v1.sh /usr/local/bin/fazai-html
	      log "SUCCESS" "Gerador HTML instalado em /usr/local/bin/fazai-html"
	    fi
	  fi
	  
	  if [ "$copy_errors" -ne 0 ]; then
	    log "ERROR" "$copy_errors falha(s) ao copiar arquivos. Veja $LOG_FILE para detalhes."
	    return 1
	  fi

	  log "SUCCESS" "Arquivos copiados com sucesso."
	  }

	# Função para importar configurações de .env
	import_env_config() {
	  log "INFO" "Verificando configurações de ambiente..."
	  
	  # Locais possíveis do arquivo .env
	  local env_locations=(
	    "/root/.env"
	    "$HOME/.env"
	    "./.env"
	    ".env.example"
	  )
	  
	  local env_file=""
	  
	  # Procura o primeiro arquivo .env disponível
	  for location in "${env_locations[@]}"; do
	    if [ -f "$location" ]; then
	      env_file="$location"
	      log "INFO" "Arquivo .env encontrado em $env_file"
	      break
	    fi
	  done
	  
	  if [ -n "$env_file" ]; then
	    log "INFO" "Arquivo .env encontrado. Importando configurações..."
	    
	    # Extrai chaves de API
	    local api_keys=(
	      "OPENAI_API_KEY"
	      "ANTHROPIC_API_KEY"
	      "GOOGLE_API_KEY"
	      "AZURE_API_KEY"
	    )
	    
	    local fazai_conf="/etc/fazai/fazai.conf"
	    local changes_made=false
	    
	    for key in "${api_keys[@]}"; do
	      local value=$(grep "^$key=" "$env_file" 2>/dev/null | cut -d'=' -f2 | tr -d '"' | tr -d "'")
	      if [ -n "$value" ]; then
		local config_key=$(echo "$key" | tr '[:upper:]' '[:lower:]')
		
		# Verifica se a chave já existe no arquivo de configuração
		if grep -q "^$config_key" "$fazai_conf"; then
		  # Substitui o valor existente
		  sed -i "s|^$config_key.*|$config_key = $value|" "$fazai_conf"
		else
		  # Adiciona nova entrada na seção de APIs
		  if grep -q "^\[apis\]" "$fazai_conf"; then
		    sed -i "/^\[apis\]/a $config_key = $value" "$fazai_conf"
		  else
		    # Se não houver seção de APIs, adiciona ao final do arquivo
		    echo -e "\n[apis]\n$config_key = $value" >> "$fazai_conf"
		  fi
		fi
		
		log "SUCCESS" "Chave $key importada com sucesso."
		changes_made=true
	      fi
	    done
	    
	    if [ "$changes_made" = true ]; then
	      log "SUCCESS" "Configurações importadas para $fazai_conf"
	    else
	      log "WARNING" "Nenhuma configuração relevante encontrada em $env_file"
	    fi
	  else
	    log "INFO" "Nenhum arquivo .env encontrado nas localizações padrão."
	  fi
	}

	# Função para configurar o serviço systemd
configure_systemd() {
	  log "INFO" "Configurando serviço systemd..."
	  
	  local service_file="/etc/systemd/system/fazai.service"
	  
	  # Gera um arquivo de serviço melhorado
  cat > "$service_file" << EOF
	[Unit]
	Description=FazAI Service
	After=network.target fazai-gemma-worker.service fazai-docler.service fazai-qdrant.service
	Wants=fazai-gemma-worker.service fazai-docler.service
	Wants=fazai-qdrant.service
	StartLimitIntervalSec=0

	[Service]
	Type=simple
	Restart=always
	RestartSec=1
	User=root
	ExecStart=/usr/bin/node /opt/fazai/lib/main.js
	WorkingDirectory=/opt/fazai
	Environment=NODE_ENV=production
	StandardOutput=append:/var/log/fazai/stdout.log
	StandardError=append:/var/log/fazai/stderr.log

	# Limites de recursos
	LimitNOFILE=65535
	LimitMEMLOCK=512M

  		[Install]
		WantedBy=multi-user.target
EOF
	  
	  chmod 644 "$service_file"
	  log "SUCCESS" "Arquivo de serviço systemd criado em $service_file"
	  
	  systemctl daemon-reload
	  systemctl enable fazai
	  log "SUCCESS" "Serviço systemd habilitado."

	  # Instala serviço do Gemma Worker se binário existir
	  if [ -x "/opt/fazai/bin/fazai-gemma-worker" ]; then
	    log "INFO" "Configurando serviço fazai-gemma-worker..."
    cat > "/etc/systemd/system/fazai-gemma-worker.service" << EOF
[Unit]
Description=FazAI Gemma Worker v2.0
After=network.target fazai-qdrant.service
Wants=fazai-qdrant.service
PartOf=fazai.service

[Service]
Type=simple
User=root
WorkingDirectory=/opt/fazai
EnvironmentFile=-/etc/fazai/env
RuntimeDirectory=fazai
RuntimeDirectoryMode=0777
UMask=0000
ExecStartPre=/usr/bin/install -d -m 0777 -o root -g root /run/fazai
ExecStartPre=/bin/rm -f /run/fazai/gemma.sock
ExecStart=/opt/fazai/bin/fazai_gemma_worker.py
ExecStopPost=/bin/rm -f /run/fazai/gemma.sock
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF
	    chmod 644 "/etc/systemd/system/fazai-gemma-worker.service"
	    systemctl daemon-reload
	    systemctl enable fazai-gemma-worker || true
	    log "SUCCESS" "Serviço fazai-gemma-worker preparado."
	  else
	    log "WARNING" "Binário fazai-gemma-worker não encontrado; serviço do worker não será criado."
	  fi

	  # Serviço DOCLER Web (portas 3220/3221 para evitar conflito com daemon 3120)
	  if [ -f "/opt/fazai/web/docler-server.js" ]; then
	    log "INFO" "Configurando serviço fazai-docler..."
    cat > "/etc/systemd/system/fazai-docler.service" << 'EOF'
[Unit]
Description=FazAI DOCLER Web Server
After=network.target
PartOf=fazai.service

[Service]
Type=simple
User=fazai-web
Group=fazai-web
Environment=DOCLER_PORT=3220
Environment=DOCLER_ADMIN_PORT=3221
Environment=DOCLER_HOST=0.0.0.0
WorkingDirectory=/opt/fazai/web
ExecStart=/usr/bin/node /opt/fazai/web/docler-server.js
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF
	    chmod 644 "/etc/systemd/system/fazai-docler.service"
	    systemctl daemon-reload
	    systemctl enable fazai-docler || true
	    # Tenta iniciar se dependências foram instaladas
	    systemctl start fazai-docler || true
	    log "SUCCESS" "Serviço fazai-docler preparado (portas 3220/3221)."
	  else
	    log "WARNING" "docler-server.js não encontrado; serviço DOCLER não será criado."
	  fi

	  # Serviço Qdrant Vector Database
	  log "INFO" "Configurando serviço fazai-qdrant..."
	  if command -v docker >/dev/null 2>&1 && systemctl is-active docker >/dev/null 2>&1; then
	    # Usar Docker se disponível
	    cat > "/etc/systemd/system/fazai-qdrant.service" << 'EOF'
[Unit]
Description=FazAI Qdrant Vector Database (Docker)
After=network.target docker.service
Requires=docker.service
PartOf=fazai.service

[Service]
Type=oneshot
RemainAfterExit=yes
ExecStartPre=/usr/bin/docker pull qdrant/qdrant:latest
ExecStart=/usr/bin/docker run -d \
    --name fazai-qdrant \
    --restart unless-stopped \
    -p 6333:6333 \
    -p 6334:6334 \
    -v /var/lib/qdrant:/qdrant/storage \
    -v /opt/fazai/web/static:/opt/qdrant/web/static \
    -e QDRANT__SERVICE__HTTP_PORT=6333 \
    -e QDRANT__SERVICE__GRPC_PORT=6334 \
    -e QDRANT__SERVICE__HOST=0.0.0.0 \
    -e QDRANT__WEB_UI__ENABLED=true \
    -e QDRANT__SERVICE__ENABLE_CORS=true \
    qdrant/qdrant:latest
ExecStop=/usr/bin/docker stop fazai-qdrant
ExecStopPost=/usr/bin/docker rm fazai-qdrant

[Install]
WantedBy=multi-user.target
EOF
	  elif [ -f "/opt/fazai/bin/qdrant" ]; then
	    # Usar binário nativo se disponível
	    cat > "/etc/systemd/system/fazai-qdrant.service" << 'EOF'
[Unit]
Description=FazAI Qdrant Vector Database
After=network.target
PartOf=fazai.service

[Service]
Type=simple
User=fazai
Group=fazai
WorkingDirectory=/var/lib/qdrant
ExecStart=/opt/fazai/bin/qdrant --config-path /etc/fazai/qdrant.yaml
Restart=always
RestartSec=5
Environment=RUST_LOG=info

[Install]
WantedBy=multi-user.target
EOF
	  fi
	  
	  chmod 644 "/etc/systemd/system/fazai-qdrant.service" 2>/dev/null || true
	  systemctl daemon-reload
	  systemctl enable fazai-qdrant || true
	  systemctl start fazai-qdrant || true
	  log "SUCCESS" "Serviço fazai-qdrant preparado (porta 6333)."



	  # Instalar GPT-Web2Shell se local-extras existe
	  if [ -d "local-extras/gpt-web2shell" ]; then
	    log "INFO" "Instalando GPT-Web2Shell..."
	    mkdir -p /home/${SUDO_USER}/fazai/local-extras/gpt-web2shell
	    cp -r local-extras/gpt-web2shell/* /home/${SUDO_USER}/fazai/local-extras/gpt-web2shell/
	    chown -R ${SUDO_USER}:${SUDO_USER} /home/${SUDO_USER}/fazai/local-extras/ 2>/dev/null || true
	    chmod +x /home/${SUDO_USER}/fazai/local-extras/gpt-web2shell/bin/gpt-web2shell 2>/dev/null || true
	    chmod +x /opt/fazai/tools/gpt-web2shell.js 2>/dev/null || true
	    log "SUCCESS" "GPT-Web2Shell instalado para transcendência CLI."
	  fi

	  # Detecta runtime de contêiner (Docker/Podman)
	  local CONTAINER=""
	  if command -v docker >/dev/null 2>&1; then CONTAINER="docker"; fi
	  if [ -z "$CONTAINER" ] && command -v podman >/dev/null 2>&1; then CONTAINER="podman"; fi

	  # Serviço Qdrant (via Docker/Podman) se disponível
  if [ -n "$CONTAINER" ]; then
	    log "INFO" "Configurando serviço Qdrant ($CONTAINER)..."
	    mkdir -p /var/lib/fazai/qdrant
    cat > "/etc/systemd/system/fazai-qdrant.service" << 'EOF'
[Unit]
Description=FazAI Qdrant Vector DB (Docker)
After=network-online.target
PartOf=fazai.service

[Service]
Type=oneshot
RemainAfterExit=yes
ExecStartPre=-/usr/bin/CONTAINER_BIN rm -f fazai-qdrant
ExecStart=/usr/bin/CONTAINER_BIN run -d --name fazai-qdrant -p 6333:6333 -v /var/lib/fazai/qdrant:/qdrant/storage qdrant/qdrant:v1.7.3
ExecStop=/usr/bin/CONTAINER_BIN stop fazai-qdrant
TimeoutStartSec=120
TimeoutStopSec=30

[Install]
WantedBy=multi-user.target
EOF
	    # Substitui placeholder pelo runtime
	    sed -i "s|CONTAINER_BIN|$CONTAINER|g" "/etc/systemd/system/fazai-qdrant.service"
	    chmod 644 "/etc/systemd/system/fazai-qdrant.service"
	    systemctl daemon-reload
	    systemctl enable fazai-qdrant || true
	    systemctl start fazai-qdrant || true
	    log "SUCCESS" "Serviço Qdrant preparado (porta 6333)."


	  else
	    log "WARNING" "Docker/Podman não encontrado; Qdrant não será instalado automaticamente. Instale um runtime de contêiner ou configure Qdrant manualmente."
	  fi

  # Observabilidade foi movida para repo separado (~/fazaiserverlogs)
  if [ -n "$CONTAINER" ]; then
    log "INFO" "Monitoring Prometheus/Grafana não é mais instalado neste host. Use o repositório fazaiserverlogs."
  fi
}

# Compila e instala o Gemma Worker (C++) se fontes estiverem presentes
build_gemma_worker() {
  if [ -d "worker" ] && [ -f "worker/CMakeLists.txt" ]; then
    log "INFO" "Compilando Gemma Worker (C++)..."
    mkdir -p worker/build
    pushd worker/build >/dev/null
    if cmake .. && cmake --build . -j$(nproc) && cmake --install .; then
      log "SUCCESS" "Gemma Worker compilado e instalado em /opt/fazai/bin"
    else
      log "WARNING" "Falha ao compilar o Gemma Worker. O agente local poderá não funcionar."
    fi
    popd >/dev/null
    # Garante diretório de socket
    mkdir -p /run/fazai
    chmod 755 /run/fazai
  else
    log "INFO" "Fontes do Gemma Worker não encontradas; pulando compilação."
  fi
}

# Instala Gemma one-shot e pesos padrão (máquinas pequenas)
bootstrap_gemma() {
  if [ -x "/opt/fazai/bin/gemma_oneshot" ] && [ -f "/opt/fazai/models/gemma/2.0-2b-it-sfp.sbs" ]; then
    log "INFO" "Gemma (oneshot + pesos) já presente."
    return 0
  fi
  if [ -x "/opt/fazai/tools/gemma_bootstrap.sh" ]; then
    log "INFO" "Executando gemma_bootstrap.sh (download/instalação do modelo)."
    bash /opt/fazai/tools/gemma_bootstrap.sh || log "WARNING" "Falha no gemma_bootstrap.sh"
  else
    log "WARNING" "gemma_bootstrap.sh não encontrado."
  fi
}

	# Função para instalar dependências do Node.js com retry
	install_node_dependencies() {
	  log "INFO" "Instalando dependências do Node.js..."
	  
	  # Cria package.json se não existir
	  if [ ! -f "package.json" ]; then
	    log "INFO" "Criando package.json..."
	    cat > "package.json" << 'EOF'
	{
	  "name": "fazai",
	  "version": "2.0.0",
	  "description": "FazAI - Orquestrador Inteligente de Automação",
	  "main": "main.js",
	  "dependencies": {
	    "axios": ">=0.27.2",
	    "express": ">=4.18.1",
	    "winston": ">=3.8.1",

	    "chalk": ">=4.1.2",
	    "figlet": ">=1.5.2",
	    "inquirer": ">=8.2.4"
	  }
	}
EOF
	  fi
	  
	  # Instala no diretório atual primeiro
	  log "INFO" "Instalando dependências no diretório atual..."
	  if ! npm install --no-audit --no-progress; then
	    log "WARNING" "Falha na instalação inicial de dependências. Tentando método alternativo..."
	    
	    # Tenta instalar pacotes críticos individualmente
	    for module in "${DEPENDENCY_MODULES[@]}"; do
	      log "INFO" "Instalando módulo: $module"
	      npm install "$module" --no-audit --no-progress || log "WARNING" "Falha ao instalar $module"
	    done
	  fi
	  
	  # Agora instala em /opt/fazai
	  log "INFO" "Instalando dependências em /opt/fazai..."
	  cp package.json /opt/fazai/
	  cd /opt/fazai
	  
	  if ! npm install --no-audit --no-progress; then
	    log "WARNING" "Falha ao instalar dependências em /opt/fazai. Tentando método alternativo..."
	    
	    # Tenta instalar pacotes críticos individualmente
	    for module in "${DEPENDENCY_MODULES[@]}"; do
	      log "INFO" "Instalando módulo em /opt/fazai: $module"
	      npm install "$module" --no-audit --no-progress || log "WARNING" "Falha ao instalar $module"
	    done
	  fi
	  
	  cd - > /dev/null

	  # Verifica se os módulos essenciais foram instalados
	  if npm list express winston >> "$LOG_FILE" 2>&1; then
	    log "SUCCESS" "Módulos express e winston instalados corretamente."
	  else
	    log "WARNING" "Módulos express ou winston ausentes. Possível problema de conexão. Execute 'npm install' manualmente."
	  fi

	  log "SUCCESS" "Dependências do Node.js instaladas."
	}

	# Função para compilar módulos nativos
	compile_native_modules() {
	  log "INFO" "Verificando módulos nativos..."
	  
	  # Cria um módulo nativo básico se não existir
	  if [ ! -d "/opt/fazai/mods" ]; then
	    mkdir -p "/opt/fazai/mods"
	  fi
	  
	  cd /opt/fazai/mods
	  
	  if [ ! -f "system_mod.c" ]; then
	    log "INFO" "Criando módulo nativo básico..."
	    cat > "system_mod.c" << 'EOF'
	#include <stdio.h>
	#include <stdlib.h>

	// Função básica para teste do módulo nativo
	int fazai_test() {
	    return 42;
	}
EOF
	  fi
	  
	  if [ -f "system_mod.c" ]; then
	    log "DEBUG" "Compilando system_mod.c..."
	    if gcc -shared -fPIC -o system_mod.so system_mod.c; then
	      log "SUCCESS" "Módulos nativos compilados com sucesso."
	    else
	      log "WARNING" "Falha ao compilar módulos nativos. Continuando sem eles..."
	    fi
	  else
	    log "INFO" "Nenhum módulo nativo para compilar."
	  fi
	  
	  cd - > /dev/null
	}

	# Função opcional para instalar o llama.cpp
	install_llamacpp() {
	  if [ "$WITH_LLAMA" != true ]; then
	    log "INFO" "Instalação do llama.cpp ignorada (--with-llama)"
	    return 0
	  fi

	  log "INFO" "Instalando llama.cpp..."
	  local script_dir="$(cd "$(dirname "$0")" && pwd)"
	  if bash "$script_dir/bin/tools/install-llamacpp.sh"; then
	    log "SUCCESS" "llama.cpp instalado"
	    return 0
	  else
	    log "ERROR" "Falha ao instalar llama.cpp"
	    return 1
	  fi
	}

	# Função para instalar interface TUI

	# Função para configurar permissões de segurança
	configure_security() {
	  log "INFO" "Configurando permissões de segurança..."
	  
	  # Cria grupo fazai se não existir
	  if ! getent group fazai > /dev/null 2>&1; then
	    groupadd -r fazai
	    log "SUCCESS" "Grupo 'fazai' criado"
	  fi
	  
	  # Cria usuário fazai se não existir
	  if ! getent passwd fazai > /dev/null 2>&1; then
	    useradd -r -g fazai -s /bin/false -d /opt/fazai fazai
	    log "SUCCESS" "Usuário 'fazai' criado"
	  fi
	  
  # Define permissões dos diretórios
  chown -R fazai:fazai /opt/fazai
  chown -R fazai:fazai /var/log/fazai
  chown -R fazai:fazai /var/lib/fazai
  
  # Permissões específicas
  chmod 750 /opt/fazai
  chmod 755 /opt/fazai/bin/fazai
  # Conf: dono fazai, grupo root, 640
  chown fazai:root /etc/fazai/fazai.conf 2>/dev/null || true
  chmod 640 /etc/fazai/fazai.conf
	  chmod 755 /opt/fazai/tools/fazai-config.js
	  
	  # Configura sudoers para permitir comandos específicos do fazai
	  if [ ! -f /etc/sudoers.d/fazai ]; then
	    cat > /etc/sudoers.d/fazai << 'EOF'
	# FazAI sudoers configuration
	%fazai ALL=(ALL) NOPASSWD: /bin/systemctl start fazai
	%fazai ALL=(ALL) NOPASSWD: /bin/systemctl stop fazai
	%fazai ALL=(ALL) NOPASSWD: /bin/systemctl restart fazai
	%fazai ALL=(ALL) NOPASSWD: /bin/systemctl status fazai
	%fazai ALL=(ALL) NOPASSWD: /usr/bin/apt-get update
	%fazai ALL=(ALL) NOPASSWD: /usr/bin/apt-get install *
	%fazai ALL=(ALL) NOPASSWD: /usr/sbin/service * *
EOF
	    chmod 440 /etc/sudoers.d/fazai
	    log "SUCCESS" "Configuração sudoers criada"
	  fi
	  
	  log "SUCCESS" "Permissões de segurança configuradas"
	}

	# Função para criar scripts auxiliares
	create_helper_scripts() {
	  log "INFO" "Criando scripts auxiliares..."
	  
	  # Script de uninstall
	  cat > /opt/fazai/bin/uninstall.sh << 'EOF'
	#!/bin/bash
	# FazAI Uninstall Script

	echo "Desinstalando FazAI..."

	# Para o serviço
	systemctl stop fazai 2>/dev/null
	systemctl disable fazai 2>/dev/null

	# Remove arquivos de serviço
	rm -f /etc/systemd/system/fazai.service
	systemctl daemon-reload

	# Remove links simbólicos
	rm -f /usr/local/bin/fazai
	rm -f /usr/local/bin/fazai-config

	# Remove diretórios (com confirmação)
	read -p "Remover todos os dados do FazAI? (logs, configurações, etc.) [s/N]: " -n 1 -r
	echo
	if [[ $REPLY =~ ^[Ss]$ ]]; then
	  rm -rf /opt/fazai
	  rm -rf /etc/fazai
	  rm -rf /var/log/fazai
	  rm -rf /var/lib/fazai
	  echo "Todos os dados removidos."
	else
	  echo "Dados preservados em /etc/fazai, /var/log/fazai e /var/lib/fazai"
	fi

	# Remove usuário e grupo
	userdel fazai 2>/dev/null
	groupdel fazai 2>/dev/null

	# Remove sudoers
	rm -f /etc/sudoers.d/fazai

	echo "FazAI desinstalado com sucesso!"
EOF
	  
	  chmod +x /opt/fazai/bin/uninstall.sh
	  ln -sf /opt/fazai/bin/uninstall.sh /usr/local/bin/fazai-uninstall
	  
	  # Script de backup
  cat > /opt/fazai/bin/backup.sh << 'EOF'
	#!/bin/bash
	# FazAI Backup Script

	BACKUP_DIR="/tmp/fazai-backup-$(date +%Y%m%d-%H%M%S)"
	mkdir -p "$BACKUP_DIR"

	echo "Criando backup em $BACKUP_DIR..."

	# Backup de configurações
	cp -r /etc/fazai "$BACKUP_DIR/"
	cp -r /var/lib/fazai "$BACKUP_DIR/"

	# Backup de logs (últimos 7 dias)
	find /var/log/fazai -name "*.log" -mtime -7 -exec cp {} "$BACKUP_DIR/" \;

	# Compacta o backup
	cd /tmp
	tar -czf "fazai-backup-$(date +%Y%m%d-%H%M%S).tar.gz" "$(basename $BACKUP_DIR)"
	rm -rf "$BACKUP_DIR"

	echo "Backup criado: /tmp/fazai-backup-$(date +%Y%m%d-%H%M%S).tar.gz"
EOF
	  
	  chmod +x /opt/fazai/bin/backup.sh
	  ln -sf /opt/fazai/bin/backup.sh /usr/local/bin/fazai-backup
	  
	  log "SUCCESS" "Scripts auxiliares criados"
	}

  # Compila o worker Gemma usando o script interno
  build_gemma_worker() {
    log "INFO" "Compilando FazAI Gemma Worker"
    if [ -d "worker" ]; then
      pushd worker >/dev/null
      ./build.sh || { log "ERROR" "Falha ao compilar worker"; popd >/dev/null; return 1; }
      popd >/dev/null
      log "SUCCESS" "Worker compilado e instalado em /opt/fazai/bin"
      return 0
    else
      log "ERROR" "Diretório worker não encontrado"
      return 1
    fi
  }

	# Função para configurar logrotate
	configure_logrotate() {
	  log "INFO" "Configurando rotação de logs..."
	  
	  cat > /etc/logrotate.d/fazai << 'EOF'
	/var/log/fazai/*.log {
	    daily
	    missingok
	    rotate 30
	    compress
	    delaycompress
	    notifempty
	    create 644 fazai fazai
	    postrotate
		systemctl reload fazai > /dev/null 2>&1 || true
	    endscript
	}
EOF
	  
	  log "SUCCESS" "Configuração de logrotate criada"
	}

	# Função para validar a instalação
	validate_installation() {
	  log "INFO" "Validando instalação..."
	  
	  local validation_errors=0
	  
	  # Verifica arquivos essenciais
	  local essential_files=(
	    "/opt/fazai/lib/main.js"
	    "/opt/fazai/bin/fazai"
	    "/etc/fazai/fazai.conf"
	    "/etc/fazai/complex_tasks.conf.default"
	    "/etc/systemd/system/fazai.service"
	    "/usr/local/bin/fazai"
	    "/opt/fazai/tools/fazai_web_frontend.html"
	    "/opt/fazai/tools/fazai_web.sh"
	    "/opt/fazai/tools/fazai_html_v1.sh"
	    "/opt/fazai/tools/auto_tool.js"
	    "/opt/fazai/tools/net_qos_monitor.js"
	    "/opt/fazai/tools/agent_supervisor.js"
	    "/opt/fazai/tools/qdrant_setup.js"
	    "/opt/fazai/tools/snmp_monitor.js"
	    "/opt/fazai/tools/modsecurity_setup.js"
	    "/opt/fazai/tools/suricata_setup.js"
	    "/opt/fazai/tools/crowdsec_setup.js"
	    "/opt/fazai/tools/monit_setup.js"
	  )
	  
	  for file in "${essential_files[@]}"; do
	    if [ ! -f "$file" ]; then
	      log "ERROR" "Arquivo essencial não encontrado: $file"
	      validation_errors=$((validation_errors + 1))
	    else
	      log "DEBUG" "Arquivo validado: $file"
	    fi
	  done
	  
	  # Verifica diretórios
	  local essential_dirs=(
	    "/opt/fazai"
	    "/etc/fazai"
	    "/var/log/fazai"
	    "/var/lib/fazai"
	  )
	  
	  for dir in "${essential_dirs[@]}"; do
	    if [ ! -d "$dir" ]; then
	      log "ERROR" "Diretório essencial não encontrado: $dir"
	      validation_errors=$((validation_errors + 1))
	    else
	      log "DEBUG" "Diretório validado: $dir"
	    fi
	  done
	  
	  # Verifica comandos
	  if ! command -v fazai &> /dev/null; then
	    log "ERROR" "Comando 'fazai' não está disponível"
	    validation_errors=$((validation_errors + 1))
	  fi
	  
	  # Verifica serviço systemd
	  if ! systemctl is-enabled fazai &> /dev/null; then
	    log "WARNING" "Serviço fazai não está habilitado"
	  fi
	  
	  # Verifica dependências Node.js críticas
	  cd /opt/fazai
	  local critical_modules=("express" "winston")
	  for module in "${critical_modules[@]}"; do
	    if ! npm list "$module" &> /dev/null; then
	      log "WARNING" "Módulo Node.js crítico não encontrado: $module"
	    fi
	  done
	  
	  if [ $validation_errors -eq 0 ]; then
	    log "SUCCESS" "Validação da instalação concluída com sucesso!"
	    return 0
	  else
	    log "ERROR" "Validação falhou com $validation_errors erro(s)"
	    return 1
	  fi
	}

	# Função para executar testes pós-instalação
	run_post_install_tests() {
	  log "INFO" "Executando testes pós-instalação..."
	  
	  # Teste 1: Verifica se o CLI responde
	  log "DEBUG" "Testando CLI..."
	  if fazai --version &> /dev/null; then
	    log "SUCCESS" "Teste CLI: OK"
	  else
	    log "WARNING" "Teste CLI: Falhou"
	  fi
	  
	  # Teste 2: Verifica se o serviço pode ser iniciado
	  log "DEBUG" "Testando serviço systemd..."
	  if systemctl start fazai && sleep 2 && systemctl is-active fazai &> /dev/null; then
	    log "SUCCESS" "Teste serviço: OK"
	    systemctl stop fazai
	  else
	    log "WARNING" "Teste serviço: Falhou"
	  fi
	  
	  # Teste 3: Verifica permissões
	  log "DEBUG" "Testando permissões..."
	  if [ -r /etc/fazai/fazai.conf ] && [ -x /opt/fazai/bin/fazai ]; then
	    log "SUCCESS" "Teste permissões: OK"
	  else
	    log "WARNING" "Teste permissões: Falhou"
	  fi
	  
	  log "SUCCESS" "Testes pós-instalação concluídos"
	}

	# Função para mostrar informações finais
	show_installation_summary() {
	  log "INFO" "====== Resumo da Instalação ======"
	  
	  echo -e "\n${GREEN}✓ FazAI v$VERSION instalado com sucesso!${NC}\n"
	  
	  echo -e "${BLUE}Localização dos arquivos:${NC}"
	  echo "  • Binários: /opt/fazai"
	  echo "  • Configuração: /etc/fazai/fazai.conf"
	  echo "  • Configuração de tarefas complexas: /etc/fazai/complex_tasks.conf.default"
	  echo "  • Logs: /var/log/fazai"
	  echo "  • Dados: /var/lib/fazai"
	  echo ""
	  
	  echo -e "${BLUE}Comandos disponíveis:${NC}"
	  echo "  • fazai --help          - Ajuda do sistema"
	  echo "  • fazai --version       - Versão instalada"
	  echo "  • fazai --status        - Status do daemon"
	  echo "  • fazai web             - Interface web com gerenciamento de logs"

	  echo "  • fazai logs [n]        - Ver últimas n entradas de log"
	  echo "  • fazai limpar-logs     - Limpar logs (com backup)"

	  echo "  • fazai-backup          - Criar backup"
	  echo "  • fazai-uninstall       - Desinstalar"
	  echo ""
	  
	  echo -e "${BLUE}Gerenciamento do serviço:${NC}"
	  echo "  • systemctl start fazai    - Iniciar"
	  echo "  • systemctl stop fazai     - Parar"
	  echo "  • systemctl restart fazai  - Reiniciar"
	  echo "  • systemctl status fazai   - Ver status"
	  echo ""
	  
	  echo -e "${YELLOW}Próximos passos:${NC}"
	  echo "  1. Configure suas API keys editando /etc/fazai/fazai.conf"
	  echo "  2. Inicie o serviço: systemctl start fazai"
	  echo "  3. Teste o sistema: fazai --status"
	  echo ""
	  
	  echo -e "${PURPLE}Para suporte e documentação:${NC}"
	  echo "  • GitHub: https://github.com/RLuf/FazAI"
	  echo "  • Logs: /var/log/fazai_install.log"
	  echo ""
	  
	  # Salva estado final
	  save_install_state "installation_complete" "success"
	  
	  log "SUCCESS" "====== Instalação Finalizada ======"
	}

	# Função principal de instalação
	main_install() {
	  log "INFO" "Iniciando instalação do FazAI v$VERSION"
	  
	  # Carrega estado anterior se existir
	  load_install_state
	  
	  # Executa etapas de instalação
  local install_steps=(
	    "setup_logging:Configurando sistema de logs"
	    "check_root:Verificando permissões"
	    "check_system:Verificando sistema operacional"
	    "convert_files_to_unix:Convertendo arquivos para formato Linux"
	    "install_nodejs:Instalando Node.js"
	    "install_npm:Verificando npm"
    "install_python:Instalando Python 3"
    "install_gcc:Instalando ferramentas de compilação"
    "ensure_container_runtime:Instalando runtime de contêiner (Docker)"
    "create_directories:Criando estrutura de diretórios"
    "build_gemma_worker:Compilando Gemma Worker"
    "bootstrap_gemma:Instalando Gemma one-shot e pesos padrão"
    "copy_files:Copiando arquivos"
	    "import_env_config:Importando configurações"
	    "configure_systemd:Configurando serviço systemd"
	    "install_node_dependencies:Instalando dependências Node.js"
	    "compile_native_modules:Compilando módulos nativos"
	  )

	  if [ "$WITH_LLAMA" = true ]; then
	    install_steps+=("install_llamacpp:Instalando llama.cpp")
	  fi

	  install_steps+=(

	    "configure_security:Configurando segurança"
	    "create_helper_scripts:Criando scripts auxiliares"
	    "configure_logrotate:Configurando rotação de logs"
	    "install_bash_completion:Instalando autocompletar"
	  )
	  
	  local total_steps=${#install_steps[@]}
	  local current_step=0
	  
	  for step_info in "${install_steps[@]}"; do
	    local step_function=$(echo "$step_info" | cut -d: -f1)
	    local step_description=$(echo "$step_info" | cut -d: -f2)
	    
	    current_step=$((current_step + 1))
	    
	    # Verifica se já foi executado
	    if [ "${INSTALL_STATE[$step_function]}" = "completed" ]; then
	      log "INFO" "[$current_step/$total_steps] $step_description (já concluído)"
	      continue
	    fi
	    
	    log "INFO" "[$current_step/$total_steps] $step_description"

	    # Executa a função
	    if $step_function; then
	      save_install_state "$step_function" "completed"
	      log "SUCCESS" "$step_description - Concluído"
	    else
	      log "ERROR" "$step_description - Falhou"
	      save_install_state "$step_function" "failed"

	      if [ "$step_function" = "copy_files" ]; then
		log "ERROR" "Falha ao copiar arquivos. Instalação interrompida. Verifique $LOG_FILE para detalhes."
		ai_help "Falha ao copiar arquivos durante a instalação do FazAI"
		exit 1
	      fi

	      # Consulta ajuda da IA e pergunta se deve continuar
	      ai_help "Erro na etapa '$step_description'"
	      read -p "Erro na etapa '$step_description'. Continuar mesmo assim? (s/N): " -n 1 -r
	      echo
	      if [[ ! $REPLY =~ ^[Ss]$ ]]; then
		log "ERROR" "Instalação interrompida pelo usuário"
		exit 1
	      fi
	    fi
	  done
	  
	  # Validação e testes finais
	  log "INFO" "Executando validação final..."
  if validate_installation; then
    run_post_install_tests
    show_installation_summary

    # Inicia o serviço se tudo estiver OK
    if systemctl start fazai; then
      log "SUCCESS" "Serviço FazAI iniciado com sucesso!"
      # Health-check com autorreparo
      health_check_repair
      # Resumo da engine/módulo nativo, se o verificador existir
      if [ -x "scripts/verify-engine.sh" ]; then
        log "INFO" "Resumo de verificação pós-instalação:"
        bash scripts/verify-engine.sh || true
      fi
    else
      log "WARNING" "Falha ao iniciar o serviço. Inicie manualmente: systemctl start fazai"
    fi
	  else
	    log "ERROR" "Validação da instalação falhou. Verifique os logs em $LOG_FILE"
	    exit 1
	  fi
	}

	# Função para limpeza em caso de interrupção
	cleanup_on_exit() {
	  local exit_code=$?
	  if [ $exit_code -ne 0 ]; then
	    log "WARNING" "Instalação interrompida (código: $exit_code)"
	    log "INFO" "Estado salvo em $INSTALL_STATE_FILE"
	    log "INFO" "Execute novamente o script para continuar de onde parou"
	  fi
	}

	# Captura sinais para limpeza
	trap cleanup_on_exit EXIT INT TERM


	# Verifica argumentos de linha de comando
	while [[ $# -gt 0 ]]; do
	  case "$1" in
	    --debug)
	      DEBUG_MODE=true
	      log "INFO" "Modo debug ativado"
	      ;;
	    --clean)
	      rm -f "$INSTALL_STATE_FILE"
	      log "INFO" "Estado de instalação limpo"
	      ;;
	    --with-llama)
	      WITH_LLAMA=true
	      ;;
	    --help)
	      echo "FazAI Installer v$VERSION"
	      echo "Uso: $0 [opções]"
	      echo ""
	      echo "Opções:"
	      echo "  --debug       Ativa modo debug com logs detalhados"
	      echo "  --clean       Remove estado de instalação anterior"
	      echo "  --with-llama  Instala o mecanismo local llama.cpp"
	      echo "  --help        Mostra esta ajuda"
	      exit 0
	      ;;
	  esac
	  shift
	done

	# Inicia instalação principal
	main_install

	log "SUCCESS" "Instalação do FazAI v2.0 concluída com sucesso!"
	echo -e "\n${GREEN}🎉 FazAI v2.0 - Sistema de Fluxo Inteligente está pronto!${NC}"
	echo -e "${CYAN}Novos recursos disponíveis:${NC}"
	echo -e "  🤖 ${YELLOW}fazai agent${NC} - Agente inteligente cognitivo"
	echo -e "  📊 ${YELLOW}fazai relay${NC} - Sistema de relay SMTP inteligente"
	echo -e "  🔧 ${YELLOW}Edite /etc/fazai/fazai.conf${NC} - Configurar API keys"
	echo -e "  📚 ${YELLOW}fazai manual${NC} - Manual completo"
	echo -e "\n${GREEN}Exemplos de uso:${NC}"
	echo -e "  fazai agent \"configurar servidor de email relay com antispam\""
	echo -e "  fazai relay analyze"
	echo -e "  fazai relay configure"

exit 0
