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

# Verificar libgemma.a
check_libgemma() {
    log_info "Verificando libgemma.a..."
    
    if [ ! -f "lib/libgemma.a" ]; then
        log_warning "libgemma.a não encontrada em lib/"
        log_info "Você pode:"
        echo "  1. Baixar uma versão pré-compilada"
        echo "  2. Compilar a partir do código fonte"
        echo "  3. Continuar sem libgemma (modo desenvolvimento)"
        
        read -p "Deseja continuar sem libgemma? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            log_error "Build cancelado"
            exit 1
        fi
        
        # Criar stub para desenvolvimento
        log_info "Criando stub para desenvolvimento..."
        mkdir -p lib
        echo "// Stub para desenvolvimento" > lib/libgemma.a
    else
        log_success "libgemma.a encontrada"
    fi
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
    
    cd build
    
    # Compilar
    make -j$(nproc)
    
    log_success "Worker compilado com sucesso"
}

# Instalar
install_worker() {
    log_info "Instalando worker..."
    
    cd build
    
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
Restart=always
RestartSec=5
Environment=FAZAI_GEMMA_MODEL=/opt/fazai/models/gemma2-2b-it-sfp.bin
Environment=FAZAI_GEMMA_SOCKET=/run/fazai/gemma.sock

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