#!/bin/bash

# FazAI - Script de Instalação
# Este script instala o FazAI em sistemas Debian/Ubuntu

# Cores para saída no terminal
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Função para exibir mensagens
print_message() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCESSO]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERRO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[AVISO]${NC} $1"
}

# Verifica se está sendo executado como root
if [ "$EUID" -ne 0 ]; then
    print_error "Este script precisa ser executado como root (sudo)."
    exit 1
fi

# Verifica se está em um sistema Debian/Ubuntu
if [ ! -f /etc/debian_version ]; then
    print_warning "Este script foi projetado para sistemas Debian/Ubuntu."
    read -p "Deseja continuar mesmo assim? (s/n): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Ss]$ ]]; then
        exit 1
    fi
fi

# Cabeçalho
echo -e "${BLUE}=================================================${NC}"
echo -e "${BLUE}       FazAI - Instalação Automatizada           ${NC}"
echo -e "${BLUE}=================================================${NC}"
echo

# Verifica dependências
print_message "Verificando dependências..."

# Verifica se o Node.js está instalado
if ! command -v node &> /dev/null; then
    print_warning "Node.js não encontrado. Instalando..."
    
    # Adiciona repositório NodeSource
    curl -fsSL https://deb.nodesource.com/setup_16.x | bash -
    
    # Instala Node.js
    apt-get install -y nodejs
    
    if ! command -v node &> /dev/null; then
        print_error "Falha ao instalar Node.js. Por favor, instale manualmente."
        exit 1
    fi
    
    print_success "Node.js instalado com sucesso."
else
    NODE_VERSION=$(node -v)
    print_success "Node.js já instalado: $NODE_VERSION"
fi

# Verifica se o npm está instalado
if ! command -v npm &> /dev/null; then
    print_warning "npm não encontrado. Instalando..."
    apt-get install -y npm
    
    if ! command -v npm &> /dev/null; then
        print_error "Falha ao instalar npm. Por favor, instale manualmente."
        exit 1
    fi
    
    print_success "npm instalado com sucesso."
else
    NPM_VERSION=$(npm -v)
    print_success "npm já instalado: $NPM_VERSION"
fi

# Verifica se o gcc está instalado
if ! command -v gcc &> /dev/null; then
    print_warning "gcc não encontrado. Instalando..."
    apt-get install -y build-essential
    
    if ! command -v gcc &> /dev/null; then
        print_error "Falha ao instalar gcc. Por favor, instale manualmente."
        exit 1
    fi
    
    print_success "gcc instalado com sucesso."
else
    GCC_VERSION=$(gcc --version | head -n1)
    print_success "gcc já instalado: $GCC_VERSION"
fi

# Cria diretórios
print_message "Criando diretórios..."
mkdir -p /etc/fazai/tools /etc/fazai/mods /var/log
print_success "Diretórios criados."

# Copia arquivos
print_message "Copiando arquivos..."

# Copia arquivos do daemon
cp -r etc/fazai/* /etc/fazai/
chmod 755 /etc/fazai/main.js

# Copia CLI
cp bin/fazai /bin/
chmod 755 /bin/fazai

# Copia serviço systemd
cp etc/fazai/fazai.service /etc/systemd/system/

print_success "Arquivos copiados."

# Instala dependências do Node.js
print_message "Instalando dependências do Node.js..."
npm install
print_success "Dependências instaladas."

# Compila módulos nativos
print_message "Compilando módulos nativos..."
cd /etc/fazai/mods
gcc -shared -fPIC -o system_mod.so system_mod.c
if [ $? -ne 0 ]; then
    print_error "Falha ao compilar módulos nativos."
    exit 1
fi
cd - > /dev/null
print_success "Módulos nativos compilados."

# Configura serviço systemd
print_message "Configurando serviço systemd..."
systemctl daemon-reload
systemctl enable fazai
print_success "Serviço configurado."

# Inicia o serviço
print_message "Iniciando serviço FazAI..."
systemctl start fazai
if [ $? -ne 0 ]; then
    print_error "Falha ao iniciar o serviço. Verifique os logs com 'journalctl -u fazai'."
    exit 1
fi
print_success "Serviço iniciado."

# Verifica se o serviço está em execução
if systemctl is-active --quiet fazai; then
    print_success "FazAI está em execução."
else
    print_error "FazAI não está em execução. Verifique os logs com 'journalctl -u fazai'."
    exit 1
fi

# Conclusão
echo
echo -e "${GREEN}=================================================${NC}"
echo -e "${GREEN}       FazAI instalado com sucesso!              ${NC}"
echo -e "${GREEN}=================================================${NC}"
echo
echo -e "Para usar o FazAI, execute: ${BLUE}fazai <comando>${NC}"
echo -e "Exemplos:"
echo -e "  ${BLUE}fazai ajuda${NC}"
echo -e "  ${BLUE}fazai informações do sistema${NC}"
echo -e "  ${BLUE}fazai mostra os processos em execucao${NC}"
echo
echo -e "Para verificar o status do serviço: ${BLUE}systemctl status fazai${NC}"
echo -e "Para ver os logs: ${BLUE}fazai logs${NC} ou ${BLUE}journalctl -u fazai${NC}"
echo

exit 0
