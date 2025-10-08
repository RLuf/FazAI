#!/bin/bash

# FazAI Gemma Worker Build Script
# Versão: 1.0.0

set -e

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Funções de log
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Verificar dependências
check_dependencies() {
    log_info "Verificando dependências..."
    
    local missing_deps=()
    
    # Verificar CMake
    if ! command -v cmake &> /dev/null; then
        missing_deps+=("cmake")
    fi
    
    # Verificar compilador C++
    if ! command -v g++ &> /dev/null && ! command -v clang++ &> /dev/null; then
        missing_deps+=("g++ ou clang++")
    fi
    
    # Verificar make
    if ! command -v make &> /dev/null; then
        missing_deps+=("make")
    fi
    
    if [ ${#missing_deps[@]} -ne 0 ]; then
        log_error "Dependências faltando: ${missing_deps[*]}"
        log_info "Instale as dependências com:"
        echo "  Ubuntu/Debian: sudo apt-get install build-essential cmake"
        echo "  Fedora/RHEL: sudo dnf install gcc-c++ cmake make"
        echo "  Arch: sudo pacman -S base-devel cmake"
        exit 1
    fi
    
    log_success "Todas as dependências encontradas"
}

# Verificar libgemma.a ou gemma.cpp
check_libgemma() {
    log_info "Verificando Gemma.cpp..."
    
    # Check for pre-built library first
    if [ -f "lib/libgemma.a" ]; then
        log_success "Found pre-built lib/libgemma.a"
        return 0
    fi
    
    # Check for gemma.cpp source
    local gemma_paths=(
        "third_party/gemma.cpp"
        "$GEMMA_CPP_ROOT"
        "/home/rluft/gemma.cpp"
    )
    
    for path in "${gemma_paths[@]}"; do
        if [ -n "$path" ] && [ -d "$path" ]; then
            log_success "Found gemma.cpp at: $path"
            export GEMMA_CPP_ROOT="$path"
            return 0
        fi
    done
    
    # Neither library nor source found
    log_warning "Neither libgemma.a nor gemma.cpp source found"
    log_info "Worker will be built without native Gemma support"
    log_info ""
    log_info "To enable Gemma support, run:"
    log_info "  ./setup_gemma.sh"
    log_info ""
    log_info "Or manually:"
    log_info "  1. Clone gemma.cpp to third_party/gemma.cpp"
    log_info "  2. Place pre-built libgemma.a in lib/"
    log_info ""
    
    # Ask user if they want to continue
    read -p "Continue build without Gemma? [y/N] " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log_info "Build cancelled. Run ./setup_gemma.sh to set up Gemma first."
        exit 0
    fi
    
    return 0
}

# Configurar build
configure_build() {
    log_info "Configurando build..."
    
    # Criar diretório de build
    mkdir -p build
    cd build
    
    # Configurar CMake
    cmake .. \
        -DCMAKE_BUILD_TYPE=Release \
        -DCMAKE_INSTALL_PREFIX=/opt/fazai \
        -DBUILD_TESTS=OFF \
        -DBUILD_DOCS=OFF
    
    log_success "Build configurado"
}

# Compilar
compile() {
    log_info "Compilando worker..."
    # Entrar em build apenas se não estivermos já dentro
    if [ "$(basename "$PWD")" != "build" ]; then
        if [ -d "build" ]; then
            cd build
        else
            log_error "Diretório build não encontrado"
            exit 1
        fi
    fi

    # Compilar
    make -j$(nproc)
    
    log_success "Worker compilado com sucesso"
}

# Instalar
install_worker() {
    log_info "Instalando worker..."
    # Entrar em build se necessário
    if [ "$(basename "$PWD")" != "build" ]; then
        if [ -d "build" ]; then
            cd build
        else
            log_error "Diretório build não encontrado"
            exit 1
        fi
    fi

    # Instalar
    sudo make install
    
    # Configurar permissões
    sudo chmod +x /opt/fazai/bin/fazai-gemma-worker
    
    # Criar diretório para socket
    sudo mkdir -p /run/fazai
    sudo chmod 755 /run/fazai
    
    log_success "Worker instalado em /opt/fazai/bin/fazai-gemma-worker"
}

# Criar serviço systemd
create_service() {
    log_info "Criando serviço systemd..."
    
    cat > fazai-gemma-worker.service << EOF
[Unit]
Description=FazAI Gemma Worker
After=network.target

[Service]
Type=simple
User=root
Group=root
ExecStart=/opt/fazai/bin/fazai-gemma-worker
# Ensure the whole process group is killed on stop
KillMode=control-group
# Give it some time to stop gracefully
TimeoutStopSec=20s
# Restart policy: on failure only (not always)
Restart=on-failure
RestartSec=5s
# Environment
Environment=FAZAI_GEMMA_MODEL=/opt/fazai/models/gemma/2.0-2b-it-sfp.sbs
Environment=FAZAI_GEMMA_SOCKET=/run/fazai/gemma.sock
Environment=FAZAI_GEMMA_SOCK=/run/fazai/gemma.sock

# Ensure logs go to /var/log/fazai
RuntimeDirectory=fazai
PermissionsStartOnly=true
StandardOutput=append:/var/log/fazai/fazai-gemma-worker.log
StandardError=append:/var/log/fazai/fazai-gemma-worker.log

[Install]
WantedBy=multi-user.target
EOF
    
    # Instalar serviço
    sudo cp fazai-gemma-worker.service /etc/systemd/system/
    sudo systemctl daemon-reload
    
    log_success "Serviço systemd criado"
    log_info "Para iniciar o serviço:"
    echo "  sudo systemctl enable fazai-gemma-worker"
    echo "  sudo systemctl start fazai-gemma-worker"
    echo "  sudo systemctl status fazai-gemma-worker"
}

# Testar worker
test_worker() {
    log_info "Testando worker..."
    
    # Verificar se o binário existe
    if [ ! -f "/opt/fazai/bin/fazai-gemma-worker" ]; then
        log_error "Worker não encontrado"
        return 1
    fi
    
    # Testar versão
    if /opt/fazai/bin/fazai-gemma-worker --version; then
        log_success "Worker testado com sucesso"
    else
        log_error "Falha ao testar worker"
        return 1
    fi
}

# Função principal
main() {
    log_info "Iniciando build do FazAI Gemma Worker..."
    
    # Verificar se estamos no diretório correto
    if [ ! -f "CMakeLists.txt" ]; then
        log_error "Execute este script no diretório worker/"
        exit 1
    fi
    
    # Executar etapas
    check_dependencies
    check_libgemma
    configure_build
    compile
    install_worker
    create_service
    test_worker
    
    log_success "Build concluído com sucesso!"
    log_info "Próximos passos:"
    echo "  1. Configure o modelo em /opt/fazai/models/"
    echo "  2. Inicie o serviço: sudo systemctl start fazai-gemma-worker"
    echo "  3. Teste o agente: fazai agent 'teste simples'"
}

# Executar função principal
main "$@"