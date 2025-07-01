#!/bin/bash

# FazAI - Script para Criação de Pacote Portable
# Este script gera um pacote portable do FazAI com dependências pré-empacotadas

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

# Cabeçalho
echo -e "${BLUE}=================================================${NC}"
echo -e "${BLUE}   FazAI - Criação de Pacote Portable            ${NC}"
echo -e "${BLUE}=================================================${NC}"
echo

# Obtém a versão do package.json
if [ ! -f "package.json" ]; then
    print_error "Arquivo package.json não encontrado. Execute este script no diretório raiz do projeto."
    exit 1
fi

VERSION=$(grep '"version"' package.json | cut -d'"' -f4)
if [ -z "$VERSION" ]; then
    print_error "Não foi possível determinar a versão do projeto."
    exit 1
fi

print_message "Versão detectada: $VERSION"

# Define o diretório de distribuição
DIST_DIR="fazai-portable-v$VERSION"

# Limpa diretório anterior
print_message "Limpando diretório de distribuição anterior..."
rm -rf $DIST_DIR
mkdir -p $DIST_DIR/{bin,lib,tools,mods,conf,systemd}
print_success "Diretório de distribuição criado: $DIST_DIR"

# Instala dependências localmente
print_message "Instalando dependências de produção..."
npm install --production

if [ $? -ne 0 ]; then
    print_error "Falha ao instalar dependências. Verifique os erros acima."
    exit 1
fi

print_success "Dependências instaladas com sucesso."

# Detecta arquitetura do sistema
print_message "Detectando arquitetura do sistema..."
ARCH=$(uname -m)
case $ARCH in
    x86_64)
        ARCH_DIR="linux-x64"
        ;;
    aarch64|arm64)
        ARCH_DIR="linux-arm64"
        ;;
    # Outras arquiteturas...
    *)
        print_warning "Arquitetura não reconhecida: $ARCH. Usando 'linux-x64' como padrão."
        ARCH_DIR="linux-x64"
        ;;
esac
print_success "Arquitetura detectada: $ARCH ($ARCH_DIR)"

# Cria diretório para módulos nativos específicos da arquitetura
mkdir -p $DIST_DIR/mods/$ARCH_DIR

# Copia arquivos
print_message "Copiando arquivos para o pacote portable..."

# Copia binários e scripts
cp -r bin/* $DIST_DIR/bin/
chmod +x $DIST_DIR/bin/fazai

# Copia bibliotecas principais
if [ -f "opt/fazai/lib/main.js" ]; then
    mkdir -p $DIST_DIR/lib
    cp opt/fazai/lib/main.js $DIST_DIR/lib/
else
    print_error "Arquivo main.js não encontrado em opt/fazai/lib/"
    exit 1
fi

# Copia ferramentas e plugins
if [ -d "etc/fazai/tools" ]; then
    cp -r etc/fazai/tools/* $DIST_DIR/tools/
else
    print_warning "Diretório de ferramentas não encontrado."
    mkdir -p $DIST_DIR/tools
fi

# Copia módulos nativos
if [ -d "etc/fazai/mods" ]; then
    # Compila módulos nativos se necessário
    if [ -f "etc/fazai/mods/system_mod.c" ]; then
        print_message "Compilando módulos nativos para a arquitetura atual..."
        cd etc/fazai/mods
        gcc -shared -fPIC -o system_mod.so system_mod.c
        if [ $? -ne 0 ]; then
            cd - > /dev/null
            print_error "Falha ao compilar módulos nativos."
            exit 1
        fi
        cd - > /dev/null
        print_success "Módulos nativos compilados."
    fi
    
    # Copia módulos nativos para o diretório específico da arquitetura
    cp etc/fazai/mods/*.so $DIST_DIR/mods/$ARCH_DIR/
    cp etc/fazai/mods/*.h $DIST_DIR/mods/
    cp etc/fazai/mods/*.c $DIST_DIR/mods/
else
    print_warning "Diretório de módulos nativos não encontrado."
    mkdir -p $DIST_DIR/mods/$ARCH_DIR
fi

# Copia arquivo de configuração padrão
if [ -f "etc/fazai/fazai.conf.example" ]; then
    cp etc/fazai/fazai.conf.example $DIST_DIR/conf/fazai.conf.default
else
    print_warning "Arquivo de configuração exemplo não encontrado."
    # Cria um arquivo de configuração básico
    cat > $DIST_DIR/conf/fazai.conf.default << EOF
# FazAI - Arquivo de Configuração Padrão

[general]
log_level = info
cache_enabled = true
max_tokens = 4096

[ai_provider]
provider = openai
api_key = sua_chave_openai_aqui
model = gpt-4

[orchestration]
planning_mode = true
action_mode = true
EOF
fi

# Copia serviço systemd
if [ -f "etc/fazai/fazai.service" ]; then
    # Modifica o serviço para apontar para o novo local
    sed "s|ExecStart=/usr/bin/node /etc/fazai/main.js|ExecStart=/usr/bin/node /opt/fazai/lib/main.js|" etc/fazai/fazai.service > $DIST_DIR/systemd/fazai.service
else
    print_warning "Arquivo de serviço systemd não encontrado."
    # Cria um arquivo de serviço básico
    cat > $DIST_DIR/systemd/fazai.service << EOF
[Unit]
Description=FazAI - Orquestrador Inteligente de Automação
After=network.target

[Service]
Type=simple
User=root
ExecStart=/usr/bin/node /opt/fazai/lib/main.js
Restart=on-failure
RestartSec=10
StandardOutput=syslog
StandardError=syslog
SyslogIdentifier=fazai

[Install]
WantedBy=multi-user.target
EOF
fi

# Copia node_modules
print_message "Copiando dependências pré-instaladas..."
cp -r node_modules $DIST_DIR/

# Copia script de instalação portable
print_message "Copiando script de instalação portable..."
cp install-portable.sh $DIST_DIR/

# Gera checksums para verificação de integridade
print_message "Gerando checksums para verificação de integridade..."
cd $DIST_DIR
find . -type f -exec sha256sum {} \; > SHA256SUMS
cd - > /dev/null

# Cria pacote
print_message "Criando pacote portable..."
tar -czf fazai-portable-v$VERSION.tar.gz $DIST_DIR

if [ $? -ne 0 ]; then
    print_error "Falha ao criar o pacote portable."
    exit 1
fi

# Gera checksum para o pacote
sha256sum fazai-portable-v$VERSION.tar.gz > fazai-portable-v$VERSION.tar.gz.sha256

print_success "Pacote portable criado: fazai-portable-v$VERSION.tar.gz"
print_success "Checksum: $(cat fazai-portable-v$VERSION.tar.gz.sha256)"

# Conclusão
echo
echo -e "${GREEN}=================================================${NC}"
echo -e "${GREEN}   Pacote Portable FazAI criado com sucesso!     ${NC}"
echo -e "${GREEN}=================================================${NC}"
echo
echo -e "Pacote: ${BLUE}fazai-portable-v$VERSION.tar.gz${NC}"
echo -e "Tamanho: $(du -h fazai-portable-v$VERSION.tar.gz | cut -f1)"
echo
echo -e "Para instalar o pacote portable:"
echo -e "  1. Transfira o pacote para o servidor de destino"
echo -e "  2. Execute: ${BLUE}tar -xzf fazai-portable-v$VERSION.tar.gz${NC}"
echo -e "  3. Execute: ${BLUE}cd $DIST_DIR && sudo ./install-portable.sh${NC}"
echo
echo -e "${YELLOW}[NOTA]${NC} Este pacote contém todas as dependências pré-instaladas"
echo -e "e pode ser usado em sistemas sem acesso à internet."
echo

exit 0
