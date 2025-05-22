#!/bin/bash

# FazAI - Script de Instalação Portable/Standalone
# Este script instala a versão portable do FazAI com dependências pré-empacotadas

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

# Cabeçalho
echo -e "${BLUE}=================================================${NC}"
echo -e "${BLUE}   FazAI - Instalação Portable/Standalone        ${NC}"
echo -e "${BLUE}=================================================${NC}"
echo

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
        print_error "Arquitetura não suportada: $ARCH"
        exit 1
        ;;
esac
print_success "Arquitetura detectada: $ARCH ($ARCH_DIR)"

# Cria diretórios
print_message "Criando diretórios..."
mkdir -p /opt/fazai/{bin,lib,tools,mods,conf} /etc/fazai /var/log/fazai /var/lib/fazai/{history,cache,training}
print_success "Diretórios criados."

# Copia arquivos (sem instalar dependências)
print_message "Copiando arquivos..."

# Verifica se estamos em um pacote portable ou no diretório do projeto
if [ -d "bin" ] && [ -d "lib" ] && [ -d "tools" ]; then
    # Estamos em um pacote portable
    cp -r bin/* /opt/fazai/bin/
    cp -r lib/* /opt/fazai/lib/
    cp -r tools/* /opt/fazai/tools/
    
    # Copia módulos nativos específicos para a arquitetura
    if [ -d "mods/$ARCH_DIR" ]; then
        cp -r mods/$ARCH_DIR/* /opt/fazai/mods/
    else
        print_warning "Módulos nativos para $ARCH_DIR não encontrados. Usando módulos genéricos."
        cp -r mods/* /opt/fazai/mods/
    fi
    
    # Copia arquivo de configuração padrão
    cp conf/fazai.conf.default /etc/fazai/fazai.conf
    cp conf/fazai.conf.default /opt/fazai/conf/fazai.conf.default
    
    # Copia node_modules pré-instalados
    if [ -d "node_modules" ]; then
        print_message "Copiando dependências pré-instaladas..."
        cp -r node_modules /opt/fazai/
    else
        print_error "Dependências pré-instaladas não encontradas. Este não é um pacote portable válido."
        exit 1
    fi
    
    # Copia serviço systemd
    if [ -d "systemd" ]; then
        cp systemd/fazai.service /etc/systemd/system/
    else
        print_warning "Arquivo de serviço systemd não encontrado no pacote portable."
        # Tenta criar um arquivo de serviço básico
        cat > /etc/systemd/system/fazai.service << EOF
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
else
    # Estamos no diretório do projeto
    print_warning "Este não parece ser um pacote portable. Tentando instalar a partir do diretório do projeto..."
    
    # Copia arquivos do daemon para /opt/fazai
    cp -r etc/fazai/tools/* /opt/fazai/tools/
    cp -r etc/fazai/mods/* /opt/fazai/mods/
    cp etc/fazai/main.js /opt/fazai/lib/
    chmod 755 /opt/fazai/lib/main.js
    
    # Copia arquivo de configuração padrão
    cp etc/fazai/fazai.conf.example /opt/fazai/conf/fazai.conf.default
    if [ ! -f "/etc/fazai/fazai.conf" ]; then
        cp etc/fazai/fazai.conf.example /etc/fazai/fazai.conf
        print_success "Arquivo de configuração padrão criado em /etc/fazai/fazai.conf"
    else
        print_message "Arquivo de configuração existente mantido em /etc/fazai/fazai.conf"
    fi
    
    # Copia CLI
    cp bin/fazai /opt/fazai/bin/
    
    # Copia serviço systemd
    sed "s|ExecStart=/usr/bin/node /etc/fazai/main.js|ExecStart=/usr/bin/node /opt/fazai/lib/main.js|" etc/fazai/fazai.service > /etc/systemd/system/fazai.service
    
    # Verifica se temos node_modules para copiar
    if [ -d "node_modules" ]; then
        print_message "Copiando dependências existentes..."
        cp -r node_modules /opt/fazai/
    else
        print_error "Dependências não encontradas. Este não é um pacote portable válido."
        exit 1
    fi
fi

# Configura permissões
chmod +x /opt/fazai/bin/fazai
ln -sf /opt/fazai/bin/fazai /usr/local/bin/fazai
print_message "CLI instalado em /usr/local/bin/fazai"

print_success "Arquivos copiados."

# Verifica se os módulos nativos precisam ser compilados
if [ ! -f "/opt/fazai/mods/system_mod.so" ]; then
    print_warning "Módulo nativo system_mod.so não encontrado. Tentando compilar..."
    
    # Verifica se o gcc está instalado
    if ! command -v gcc &> /dev/null; then
        print_warning "gcc não encontrado. Instalando..."
        apt-get install -y build-essential
        
        if ! command -v gcc &> /dev/null; then
            print_error "Falha ao instalar gcc. Por favor, instale manualmente."
            exit 1
        fi
    fi
    
    # Compila módulos nativos
    cd /opt/fazai/mods
    gcc -shared -fPIC -o system_mod.so system_mod.c
    if [ $? -ne 0 ]; then
        print_error "Falha ao compilar módulos nativos."
        exit 1
    fi
    cd - > /dev/null
    print_success "Módulos nativos compilados."
else
    print_success "Módulos nativos pré-compilados encontrados."
fi

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

# Verifica se o CLI pode ser executado corretamente
print_message "Verificando se o CLI pode ser executado..."
if ! /usr/local/bin/fazai --version &> /dev/null; then
    print_error "O CLI não pode ser executado corretamente. Verifique as dependências."
    print_warning "Tente executar 'fazai --version' manualmente para ver o erro."
else
    print_success "CLI verificado com sucesso."
fi

# Conclusão
echo
echo -e "${GREEN}=================================================${NC}"
echo -e "${GREEN}   FazAI Portable instalado com sucesso!         ${NC}"
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
echo -e "${YELLOW}[NOTA]${NC} Esta é uma instalação portable com dependências pré-empacotadas."
echo -e "Isso significa que você não precisa de acesso à internet para instalar dependências."
echo

exit 0
