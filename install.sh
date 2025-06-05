#!/usr/bin/bash

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
    
    # Verifica a versão mínima do Node.js (>=14.0.0)
    NODE_VERSION_NUM=$(echo $NODE_VERSION | cut -c 2-)
    NODE_MAJOR=$(echo $NODE_VERSION_NUM | cut -d. -f1)
    
    if [ $NODE_MAJOR -lt 14 ]; then
        print_error "FazAI requer Node.js versão 14.0.0 ou superior. Versão atual: $NODE_VERSION"
        print_warning "Por favor, atualize o Node.js para continuar."
        exit 1
    fi
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
else$ https://github.com/RLuf/Fazai
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
mkdir -p /opt/fazai/{bin,lib,tools,mods,conf} /etc/fazai /var/log/fazai /var/lib/fazai/{history,cache,training}
print_success "Diretórios criados."

# Copia arquivos
print_message "Copiando arquivos..."

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

# Verifica se existe arquivo .env em /root
if [ -f "/root/.env" ]; then
    print_message "Arquivo .env encontrado em /root. Deseja importar configurações? (s/n)"
    read -n 1 -r
    echo
    if [[ $REPLY =~ ^[Ss]$ ]]; then
        print_message "Importando configurações de /root/.env..."
        # Extrai chave da OpenAI
        OPENAI_KEY=$(grep "OPENAI_API_KEY" /root/.env | cut -d'=' -f2)
        if [ ! -z "$OPENAI_KEY" ]; then
            # Atualiza a configuração
            sed -i "s/api_key = sua_chave_openai_aqui/api_key = $OPENAI_KEY/" /etc/fazai/fazai.conf
            print_success "Chave da OpenAI importada com sucesso."
        fi
    fi
fi

# Copia CLI
cp bin/fazai /opt/fazai/bin/
chmod 755 /opt/fazai/bin/fazai
ln -sf /opt/fazai/bin/fazai /usr/local/bin/fazai
print_message "CLI instalado em /usr/local/bin/fazai"

# Atualiza o serviço systemd para apontar para o novo local
sed "s|ExecStart=/usr/bin/node /etc/fazai/main.js|ExecStart=/usr/bin/node /opt/fazai/lib/main.js|" etc/fazai/fazai.service > /etc/systemd/system/fazai.service
chmod 644 /etc/systemd/system/fazai.service

print_success "Arquivos copiados."

# Instala dependências do Node.js
print_message "Instalando dependências do Node.js..."
echo -e "${BLUE}[INFO]${NC} Executando npm install com verbose para melhor diagnóstico..."
npm install --verbose

# Verifica se a instalação foi bem-sucedida
if [ $? -ne 0 ]; then
    print_error "Falha ao instalar dependências do Node.js. Verifique os erros acima."
    exit 1
fi

# Verifica se as dependências críticas foram instaladas corretamente
print_message "Verificando dependências críticas..."

# Verifica se o módulo axios está instalado
if [ ! -d "node_modules/axios" ]; then
    print_error "Módulo 'axios' não foi instalado corretamente."
    print_warning "Tentando instalar axios explicitamente..."
    npm install axios --verbose
    
    if [ ! -d "node_modules/axios" ]; then
        print_error "Falha ao instalar o módulo 'axios'. Por favor, instale manualmente."
        exit 1
    fi
fi

# Verifica se o módulo express está instalado
if [ ! -d "node_modules/express" ]; then
    print_error "Módulo 'express' não foi instalado corretamente."
    print_warning "Tentando instalar express explicitamente..."
    npm install express --verbose
    
    if [ ! -d "node_modules/express" ]; then
        print_error "Falha ao instalar o módulo 'express'. Por favor, instale manualmente."
        exit 1
    fi
fi

# Verifica se o módulo winston está instalado
if [ ! -d "node_modules/winston" ]; then
    print_error "Módulo 'winston' não foi instalado corretamente."
    print_warning "Tentando instalar winston explicitamente..."
    npm install winston --verbose
    
    if [ ! -d "node_modules/winston" ]; then
        print_error "Falha ao instalar o módulo 'winston'. Por favor, instale manualmente."
        exit 1
    fi
fi

# Verifica se o módulo ffi-napi está instalado
if [ ! -d "node_modules/ffi-napi" ]; then
    print_error "Módulo 'ffi-napi' não foi instalado corretamente."
    print_warning "Tentando instalar ffi-napi explicitamente..."
    npm install ffi-napi --verbose
    
    if [ ! -d "node_modules/ffi-napi" ]; then
        print_error "Falha ao instalar o módulo 'ffi-napi'. Por favor, instale manualmente."
        exit 1
    fi
fi

print_success "Todas as dependências críticas foram instaladas."

# Instala dependências no diretório /opt/fazai
print_message "Instalando dependências no diretório de instalação..."
cp package.json /opt/fazai/
cd /opt/fazai
npm install --verbose

if [ $? -ne 0 ]; then
    print_error "Falha ao instalar dependências em /opt/fazai. Verifique os erros acima."
    print_warning "Deseja tentar a instalação portable com dependências pré-empacotadas? (s/n)"
    read -n 1 -r
    echo
    if [[ $REPLY =~ ^[Ss]$ ]]; then
        if [ -f "./install-portable.sh" ]; then
            print_message "Iniciando instalação portable..."
            bash ./install-portable.sh
            exit $?
        else
            print_error "Instalação portable não disponível. Baixe o pacote portable em:"
            print_message "https://github.com/RLuf/FazAI/releases/latest/download/fazai-portable.tar.gz"
            print_message "E execute: tar -xzf fazai-portable.tar.gz && cd fazai-portable && sudo ./install-portable.sh"
        fi
    fi
    cd - > /dev/null
    exit 1
fi

cd - > /dev/null
print_success "Dependências instaladas em /opt/fazai."

# Compila módulos nativos
print_message "Compilando módulos nativos..."
cd /opt/fazai/mods
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

# Verifica se o CLI pode ser executado corretamente
print_message "Verificando se o CLI pode ser executado..."
if ! /bin/fazai --version &> /dev/null; then
    print_error "O CLI não pode ser executado corretamente. Verifique as dependências."
    print_warning "Tente executar 'fazai --version' manualmente para ver o erro."
else
    print_success "CLI verificado com sucesso."
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
echo -e "${YELLOW}[IMPORTANTE]${NC} Se encontrar erros relacionados a módulos Node.js faltantes:"
echo -e "  1. Verifique se todas as dependências foram instaladas: ${BLUE}npm list${NC}"
echo -e "  2. Instale manualmente qualquer dependência faltante: ${BLUE}npm install <nome-do-pacote> --save${NC}"
echo -e "  3. Copie o package.json atualizado para /etc/fazai/ e execute ${BLUE}cd /etc/fazai && npm install${NC}"
echo

exit 0
