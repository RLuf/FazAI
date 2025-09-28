#!/bin/bash
set -e

# ===============================
# FazAI v2.0 Installer - Constants
# ===============================
VERSION="2.0.0"
LOG_FILE="/var/log/fazai_install.log"
INSTALL_STATE_FILE="/tmp/fazai_install_state"
DEBUG_MODE=false
WITH_LLAMA=false
BLUE='\033[0;34m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

# Arrays de dependências
NODE_VERSIONS=(22 20 18)
RETRY_COUNT=3
DEPENDENCY_MODULES=("express" "winston" "axios" "chalk" "figlet" "inquirer")

# Array de estado da instalação
declare -A INSTALL_STATE

# ===============================
# FUNÇÕES PRINCIPAIS
# ===============================

# Função de logging centralizada
log() {
  local level="$1"
  local message="$2"
  local timestamp=$(date '+%Y-%m-%d %H:%M:%S')

  # Cria diretório de logs se necessário
  mkdir -p "$(dirname "$LOG_FILE")" 2>/dev/null || true

  # Escreve log ao arquivo
  echo "[$timestamp] [$level] $message" >> "$LOG_FILE" 2>/dev/null || true

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

# Função para salvar estado da instalação
save_install_state() {
    local step=$1
    local status=$2
    INSTALL_STATE["$step"]="$status"
    mkdir -p "$(dirname "$INSTALL_STATE_FILE")" 2>/dev/null || true

    # Limpa o arquivo antes de reescrever
    > "$INSTALL_STATE_FILE" 2>/dev/null || true
    for key in "${!INSTALL_STATE[@]}"; do
        echo "$key=${INSTALL_STATE[$key]}" >> "$INSTALL_STATE_FILE" 2>/dev/null || true
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

echo "=== FazAI v${VERSION} Installer ==="

# ===============================
# INÍCIO DA INSTALAÇÃO
# ===============================

# Verifica se está rodando como root
if [[ $EUID -ne 0 ]]; then
   echo "❌ Execute como root: sudo ./install.sh"
   exit 1
fi

# Carrega estado anterior se existir
load_install_state

# ===============================
# FUNÇÕES DE INSTALAÇÃO
# ===============================

# Função para verificar e instalar dependências do sistema
install_system_dependencies() {
  log "INFO" "Verificando e instalando dependências do sistema..."

  # Atualiza lista de pacotes
  apt-get update || { log "WARNING" "Falha ao atualizar lista de pacotes"; return 1; }

  # Instala dependências Python
  log "INFO" "Instalando dependências Python..."
  apt-get install -y python3 python3-pip python3-venv poppler-utils pandoc docx2txt lynx w3m jq curl || {
    log "WARNING" "Falha ao instalar dependências Python"
    return 1
  }

  # Instala dependências com sudo -H para corrigir problemas de cache
  pip3 install --user aiohttp asyncio 2>/dev/null || sudo -H pip3 install aiohttp asyncio || {
    log "WARNING" "Falha ao instalar dependências Python via pip"
  }

  log "SUCCESS" "Dependências do sistema instaladas"
}

# Função para instalar Node.js e npm
install_nodejs() {
  log "INFO" "Verificando e instalando Node.js..."

  if command -v node >/dev/null 2>&1; then
    local NODE_VERSION=$(node -v | sed 's/v//')
    local NODE_MAJOR=$(echo "$NODE_VERSION" | cut -d. -f1)
    log "INFO" "Node.js já instalado: v$NODE_VERSION"

    if [ "$NODE_MAJOR" -lt 22 ]; then
      log "WARNING" "FazAI requer Node.js v22+. Tentando atualizar..."
      install_nodejs_from_source
    fi
  else
    log "WARNING" "Node.js não encontrado. Instalando..."
    install_nodejs_from_source
  fi
}

# Função auxiliar para instalar Node.js de diferentes fontes
install_nodejs_from_source() {
  local success=false

  # Tenta via gerenciador de pacotes
  if command -v apt-get >/dev/null 2>&1; then
    apt-get update -y
    apt-get install -y nodejs npm

    if command -v node >/dev/null 2>&1; then
      local NODE_VERSION=$(node -v)
      log "SUCCESS" "Node.js instalado via apt-get: $NODE_VERSION"
      success=true
    fi
  fi

  # Se falhou, tenta via NodeSource
  if [ "$success" = false ]; then
    for version in "${NODE_VERSIONS[@]}"; do
      log "INFO" "Tentando instalar Node.js v$version via NodeSource..."
      if command -v curl >/dev/null 2>&1; then
        if curl -fsSL "https://deb.nodesource.com/setup_${version}.x" | bash - && apt-get install -y nodejs; then
          if command -v node >/dev/null 2>&1; then
            local NODE_VERSION=$(node -v)
            log "SUCCESS" "Node.js instalado via NodeSource: $NODE_VERSION"
            success=true
            break
          fi
        fi
      fi
    done
  fi

  if [ "$success" = false ]; then
    log "ERROR" "Falha ao instalar Node.js. Instale manualmente e execute novamente."
    exit 1
  fi
}

# Função para instalar dependências Node.js
install_node_dependencies() {
  log "INFO" "Instalando dependências Node.js..."

  if command -v npm >/dev/null 2>&1; then
    # Instala dependências no diretório atual
    if [ -f "package.json" ]; then
      npm install --production --no-audit || log "WARNING" "Falha na instalação inicial de dependências"
    fi

    # Instala em /opt/fazai
    if [ -d "/opt/fazai" ]; then
      cp package.json /opt/fazai/ 2>/dev/null || true
      (cd /opt/fazai && npm install --production --no-audit) || log "WARNING" "Falha ao instalar dependências em /opt/fazai"
    fi

    log "SUCCESS" "Dependências Node.js instaladas"
  else
    log "WARNING" "npm não encontrado. Dependências Node.js não foram instaladas."
  fi
}

# Função para criar estrutura de diretórios
create_directories() {
  log "INFO" "Criando estrutura de diretórios..."

  local directories=(
    "/opt/fazai/bin"
    "/opt/fazai/lib"
    "/opt/fazai/tools"
    "/opt/fazai/mods"
    "/opt/fazai/models"
    "/opt/fazai/web/hp-console/assets"
    "/opt/fazai/web/hp-console/data"
    "/etc/fazai"
    "/etc/fazai/secrets/opnsense"
    "/var/log/fazai"
    "/var/lib/fazai/history"
    "/var/lib/fazai/cache"
    "/var/lib/fazai/data"
    "/var/backups/fazai"
    "/run/fazai"
  )

  for dir in "${directories[@]}"; do
    mkdir -p "$dir" 2>/dev/null || log "WARNING" "Falha ao criar diretório: $dir"
    log "DEBUG" "Diretório criado/verificado: $dir"
  done

  # Define permissões específicas
  chmod 700 /etc/fazai/secrets/opnsense 2>/dev/null || true
  chmod 755 /opt/fazai/models 2>/dev/null || true

  log "SUCCESS" "Estrutura de diretórios criada"
}

# Função para copiar arquivos
copy_files() {
  log "INFO" "Copiando arquivos para diretórios de instalação..."

  local copy_errors=0

  # Cria função auxiliar para cópia com verificação
  copy_with_verification() {
    local source=$1
    local destination=$2
    local description=$3

    if [ ! -e "$source" ]; then
      log "WARNING" "Arquivo de origem ausente: $source"
      return 1
    fi

    if cp -r "$source" "$destination" 2>/dev/null; then
      log "DEBUG" "$description copiado com sucesso"
      return 0
    else
      log "ERROR" "Falha ao copiar $description"
      return 1
    fi
  }

  # Copia binários do worker
  if [ -d "worker/bin" ]; then
    for bin_file in worker/bin/fazai_gemma_worker.py worker/bin/fazai-gemma-worker.py worker/bin/fazai-mcp-client.py worker/bin/fazai_integration_adapter.py; do
      if [ -f "$bin_file" ]; then
        copy_with_verification "$bin_file" "/opt/fazai/bin/" "$(basename "$bin_file")" || copy_errors=$((copy_errors+1))
      fi
    done
    chmod +x /opt/fazai/bin/*.py 2>/dev/null || true
  fi

  # Copia biblioteca principal
  if [ -d "opt/fazai/lib" ]; then
    copy_with_verification "opt/fazai/lib" "/opt/fazai/" "Biblioteca FazAI" || copy_errors=$((copy_errors+1))
    chmod 755 /opt/fazai/lib/main.js 2>/dev/null || true
  fi

  # Copia ferramentas
  if [ -d "opt/fazai/tools" ]; then
    copy_with_verification "opt/fazai/tools" "/opt/fazai/" "Ferramentas FazAI" || copy_errors=$((copy_errors+1))
    chmod +x /opt/fazai/tools/*.sh /opt/fazai/tools/*.js 2>/dev/null || true
  fi

  # Copia interface web
  if [ -d "opt/fazai/web" ]; then
    copy_with_verification "opt/fazai/web" "/opt/fazai/" "Interface Web" || copy_errors=$((copy_errors+1))
  fi

  # Cria CLI principal
  cat > "/bin/fazai" << 'EOF'
#!/bin/bash
exec /opt/fazai/bin/fazai-mcp-client.py "$@"
EOF
  chmod +x /bin/fazai

  # Cria configuração padrão
  cat > "/etc/fazai/fazai.conf" << 'EOF'
[daemon]
host = 0.0.0.0
port = 3120

[gemma_worker]
host = 0.0.0.0
port = 5555

[dispatcher]
timeout_seconds = 30
shell_timeout = 60

[qdrant]
host = 127.0.0.1
port = 6333
personality_collection = fazai_memory
knowledge_collection = fazai_kb
vector_dim = 384

[rag]
default_collection = fazai_kb

[cloudflare]
storage = /opt/fazai/web/hp-console/data/cloudflare_accounts.json

[opnsense]
storage = /opt/fazai/web/hp-console/data/opnsense_servers.json
EOF

  if [ $copy_errors -eq 0 ]; then
    log "SUCCESS" "Todos os arquivos copiados com sucesso"
    return 0
  else
    log "WARNING" "$copy_errors erro(s) ao copiar arquivos"
    return 1
  fi
}

# Função para configurar serviços systemd
configure_systemd() {
  log "INFO" "Configurando serviços systemd..."

  # Para serviços existentes
  local services=("fazai" "fazai-gemma-worker" "fazai-docler" "fazai-qdrant")
  for service in "${services[@]}"; do
    systemctl stop "$service" 2>/dev/null || true
    systemctl disable "$service" 2>/dev/null || true
  done

  # Cria serviço principal
  cat > "/etc/systemd/system/fazai.service" << 'EOF'
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
LimitNOFILE=65535
LimitMEMLOCK=512M

[Install]
WantedBy=multi-user.target
EOF

  # Cria serviço do Gemma Worker
  if [ -x "/opt/fazai/bin/fazai-gemma-worker" ]; then
    cat > "/etc/systemd/system/fazai-gemma-worker.service" << 'EOF'
[Unit]
Description=FazAI Gemma Worker
After=network.target
PartOf=fazai.service

[Service]
Type=simple
User=root
Group=root
ExecStart=/opt/fazai/bin/fazai-gemma-worker
Restart=always
RestartSec=5
Environment=FAZAI_GEMMA_SOCKET=/run/fazai/gemma.sock
Environment=FAZAI_GEMMA_SOCK=/run/fazai/gemma.sock
Environment=FAZAI_GEMMA_MODEL=/opt/fazai/models/gemma/2.0-2b-it-sfp.sbs
RuntimeDirectory=fazai
PermissionsStartOnly=true
StandardOutput=append:/var/log/fazai/fazai-gemma-worker.log
StandardError=append:/var/log/fazai/fazai-gemma-worker.log

[Install]
WantedBy=multi-user.target
EOF
  fi

  # Cria serviço Qdrant
  if command -v docker >/dev/null 2>&1; then
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
  fi

  # Recarrega e habilita serviços
  systemctl daemon-reload
  systemctl enable fazai 2>/dev/null || true
  systemctl enable fazai-gemma-worker 2>/dev/null || true
  systemctl enable fazai-qdrant 2>/dev/null || true

  log "SUCCESS" "Serviços systemd configurados"
}

# Função para configurar segurança
configure_security() {
  log "INFO" "Configurando segurança..."

  # Cria usuário e grupo fazai
  if ! getent group fazai >/dev/null 2>&1; then
    groupadd -r fazai 2>/dev/null || log "WARNING" "Falha ao criar grupo fazai"
  fi

  if ! getent passwd fazai >/dev/null 2>&1; then
    useradd -r -g fazai -s /bin/false -d /opt/fazai fazai 2>/dev/null || log "WARNING" "Falha ao criar usuário fazai"
  fi

  # Define permissões
  chown -R fazai:fazai /opt/fazai 2>/dev/null || true
  chown -R fazai:fazai /var/log/fazai 2>/dev/null || true
  chown -R fazai:fazai /var/lib/fazai 2>/dev/null || true
  chmod 750 /opt/fazai 2>/dev/null || true
  chmod 640 /etc/fazai/fazai.conf 2>/dev/null || true

  # Cria sudoers
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
    chmod 440 /etc/sudoers.d/fazai 2>/dev/null || true
  fi

  log "SUCCESS" "Configuração de segurança aplicada"
}

# Função para validar instalação
validate_installation() {
  log "INFO" "Validando instalação..."

  local validation_errors=0

  # Verifica arquivos essenciais
  local essential_files=(
    "/opt/fazai/lib/main.js"
    "/opt/fazai/bin/fazai"
    "/etc/fazai/fazai.conf"
    "/usr/local/bin/fazai"
  )

  for file in "${essential_files[@]}"; do
    if [ ! -f "$file" ]; then
      log "ERROR" "Arquivo essencial não encontrado: $file"
      validation_errors=$((validation_errors + 1))
    fi
  done

  # Verifica comandos
  if ! command -v fazai >/dev/null 2>&1; then
    log "ERROR" "Comando 'fazai' não está disponível"
    validation_errors=$((validation_errors + 1))
  fi

  if [ $validation_errors -eq 0 ]; then
    log "SUCCESS" "Validação da instalação concluída com sucesso!"
    return 0
  else
    log "ERROR" "Validação falhou com $validation_errors erro(s)"
    return 1
  fi
}



# ===============================
# EXECUÇÃO PRINCIPAL
# ===============================

# Executa instalação passo a passo
main_install() {
  log "INFO" "Iniciando instalação do FazAI v$VERSION"

  # Verifica se já foi instalado
  if [ "${INSTALL_STATE[installation_complete]}" = "completed" ]; then
    log "INFO" "FazAI já está instalado. Use --clean para reinstalar."
    exit 0
  fi

  # Instala dependências do sistema
  install_system_dependencies || log "WARNING" "Problemas na instalação de dependências do sistema"

  # Instala Node.js
  install_nodejs || log "ERROR" "Falha ao instalar Node.js"

  # Instala dependências Node.js
  install_node_dependencies || log "WARNING" "Problemas na instalação de dependências Node.js"

  # Cria estrutura de diretórios
  create_directories || log "ERROR" "Falha ao criar estrutura de diretórios"

  # Copia arquivos
  copy_files || log "ERROR" "Falha ao copiar arquivos"

  # Configura serviços
  configure_systemd || log "WARNING" "Problemas na configuração de serviços"

  # Configura segurança
  configure_security || log "WARNING" "Problemas na configuração de segurança"

  # Valida instalação
  if validate_installation; then
    log "SUCCESS" "FazAI v$VERSION instalado com sucesso!"
    save_install_state "installation_complete" "completed"

    # Tenta iniciar serviços
    systemctl start fazai 2>/dev/null || log "WARNING" "Falha ao iniciar serviço FazAI"
    systemctl start fazai-gemma-worker 2>/dev/null || log "WARNING" "Falha ao iniciar serviço Gemma Worker"
    systemctl start fazai-qdrant 2>/dev/null || log "WARNING" "Falha ao iniciar serviço Qdrant"

    # Mostra informações finais
    echo -e "\n${GREEN}✓ FazAI v$VERSION instalado com sucesso!${NC}\n"
    echo -e "${BLUE}Comandos disponíveis:${NC}"
    echo "  • fazai --help          - Ajuda do sistema"
    echo "  • fazai --version       - Versão instalada"
    echo "  • fazai --status        - Status do daemon"
    echo ""
    echo -e "${BLUE}Gerenciamento do serviço:${NC}"
    echo "  • systemctl start fazai    - Iniciar"
    echo "  • systemctl stop fazai     - Parar"
    echo "  • systemctl status fazai   - Ver status"
    echo ""
    echo -e "${YELLOW}Próximos passos:${NC}"
    echo "  1. Configure suas API keys editando /etc/fazai/fazai.conf"
    echo "  2. Inicie o serviço: systemctl start fazai"
    echo "  3. Teste o sistema: fazai --status"
  else
    log "ERROR" "Instalação falhou. Verifique os logs em $LOG_FILE"
    exit 1
  fi
}

# ===============================
# ARGUMENTOS DE LINHA DE COMANDO
# ===============================

while [[ $# -gt 0 ]]; do
  case "$1" in
    --debug)
      DEBUG_MODE=true
      log "INFO" "Modo debug ativado"
      ;;
    --clean)
      rm -f "$INSTALL_STATE_FILE" 2>/dev/null || true
      log "INFO" "Estado de instalação limpo"
      ;;
    --help)
      echo "FazAI Installer v$VERSION"
      echo "Uso: $0 [opções]"
      echo ""
      echo "Opções:"
      echo "  --debug       Ativa modo debug com logs detalhados"
      echo "  --clean       Remove estado de instalação anterior"
      echo "  --help        Mostra esta ajuda"
      exit 0
      ;;
  esac
  shift
done

# ===============================
# EXECUTA INSTALAÇÃO
# ===============================

main_install
