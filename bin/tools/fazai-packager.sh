
#!/bin/bash

# FazAI - Empacotador Universal
# Autor: Roger Luft
# Licença: Creative Commons Attribution 4.0 International (CC BY 4.0)
# https://creativecommons.org/licenses/by/4.0/

# Cores para saída no terminal
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuração
VERSION="1.40.12"
PACKAGE_NAME="fazai-universal-v${VERSION}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Função para registrar logs
log() {
    local level=$1
    local message=$2
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    
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
    esac
}

# Função para verificar dependências
check_dependencies() {
    log "INFO" "Verificando dependências para empacotamento..."
    
    local deps=("tar" "gzip" "find" "cp" "chmod")
    local missing_deps=()
    
    for dep in "${deps[@]}"; do
        if ! command -v "$dep" &> /dev/null; then
            missing_deps+=("$dep")
        fi
    done
    
    if [ ${#missing_deps[@]} -ne 0 ]; then
        log "ERROR" "Dependências não encontradas: ${missing_deps[*]}"
        log "ERROR" "Instale com: sudo apt-get install ${missing_deps[*]}"
        exit 1
    fi
    
    log "SUCCESS" "Todas as dependências estão disponíveis"
}

# Função para criar estrutura do pacote
create_package_structure() {
    log "INFO" "Criando estrutura do pacote..."
    
    # Remove pacote anterior se existir
    rm -rf "$PACKAGE_NAME"
    
    # Cria estrutura de diretórios
    mkdir -p "$PACKAGE_NAME"/{bin,lib,tools,mods,conf,systemd,scripts}
    
    log "SUCCESS" "Estrutura do pacote criada"
}

# Função para copiar arquivos essenciais
copy_essential_files() {
    log "INFO" "Copiando arquivos essenciais..."
    
    cd "$PROJECT_ROOT"
    
    # Copia binários
    if [ -f "bin/fazai" ]; then
        cp "bin/fazai" "$PACKAGE_NAME/bin/"
        chmod +x "$PACKAGE_NAME/bin/fazai"
        log "SUCCESS" "CLI fazai copiado"
    fi
    
    if [ -f "bin/fazai_c.c" ]; then
        cp "bin/fazai_c.c" "$PACKAGE_NAME/bin/"
        log "SUCCESS" "CLI C fazai_c.c copiado"
    fi
    
    # Copia biblioteca principal
    if [ -f "opt/fazai/lib/main.js" ]; then
        cp "opt/fazai/lib/main.js" "$PACKAGE_NAME/lib/"
        log "SUCCESS" "Biblioteca principal copiada"
    fi
    
    if [ -f "opt/fazai/lib/deepseek_helper.js" ]; then
        cp "opt/fazai/lib/deepseek_helper.js" "$PACKAGE_NAME/lib/"
        log "SUCCESS" "DeepSeek helper copiado"
    fi
    
    # Copia ferramentas
    if [ -d "opt/fazai/tools" ]; then
        cp -r opt/fazai/tools/* "$PACKAGE_NAME/tools/" 2>/dev/null || true
        chmod +x "$PACKAGE_NAME/tools"/*.sh 2>/dev/null || true
        log "SUCCESS" "Ferramentas copiadas"
    fi
    
    if [ -d "bin/tools" ]; then
        cp -r bin/tools/* "$PACKAGE_NAME/tools/" 2>/dev/null || true
        chmod +x "$PACKAGE_NAME/tools"/*.sh 2>/dev/null || true
        log "SUCCESS" "Ferramentas do bin copiadas"
    fi
    
    # Copia módulos nativos
    if [ -d "opt/fazai/mods" ]; then
        cp -r opt/fazai/mods/* "$PACKAGE_NAME/mods/" 2>/dev/null || true
        log "SUCCESS" "Módulos nativos copiados"
    fi
    
    # Copia configurações
    if [ -f "etc/fazai/fazai.conf.example" ]; then
        cp "etc/fazai/fazai.conf.example" "$PACKAGE_NAME/conf/"
        log "SUCCESS" "Configuração exemplo copiada"
    fi
    
    # Copia serviço systemd
    if [ -f "etc/fazai/fazai.service" ]; then
        cp "etc/fazai/fazai.service" "$PACKAGE_NAME/systemd/"
        log "SUCCESS" "Serviço systemd copiado"
    fi
    
    # Copia scripts de instalação
    if [ -f "install.sh" ]; then
        cp "install.sh" "$PACKAGE_NAME/scripts/"
        chmod +x "$PACKAGE_NAME/scripts/install.sh"
        log "SUCCESS" "Script de instalação copiado"
    fi
    
    if [ -f "uninstall.sh" ]; then
        cp "uninstall.sh" "$PACKAGE_NAME/scripts/"
        chmod +x "$PACKAGE_NAME/scripts/uninstall.sh"
        log "SUCCESS" "Script de desinstalação copiado"
    fi
    
    # Copia documentação
    for doc in README.md CHANGELOG.md LICENSE AGENTS.md; do
        if [ -f "$doc" ]; then
            cp "$doc" "$PACKAGE_NAME/"
            log "SUCCESS" "Documentação $doc copiada"
        fi
    done
}

# Função para criar instalador universal
create_universal_installer() {
    log "INFO" "Criando instalador universal..."
    
    cat > "$PACKAGE_NAME/install-universal.sh" << 'EOF'
#!/bin/bash

# FazAI - Instalador Universal
# Instalador autônomo para sistemas Debian/Ubuntu

# Cores para saída no terminal
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m'

VERSION="1.40.12"

log() {
    local level=$1
    local message=$2
    
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
    esac
}

# Verifica se está rodando como root
if [ "$EUID" -ne 0 ]; then
    log "ERROR" "Este script precisa ser executado como root."
    echo "Use: sudo bash install-universal.sh"
    exit 1
fi

log "INFO" "====== Início da instalação do FazAI Universal v$VERSION ======"

# Verifica sistema operacional
if [ ! -f /etc/debian_version ] && [ ! -f /etc/ubuntu_version ]; then
    log "WARNING" "Este instalador foi projetado para sistemas Debian/Ubuntu."
    read -p "Deseja continuar mesmo assim? (s/n): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Ss]$ ]]; then
        log "INFO" "Instalação cancelada pelo usuário."
        exit 1
    fi
fi

# Atualiza sistema
log "INFO" "Atualizando sistema..."
apt-get update

# Instala Node.js se necessário
if ! command -v node &> /dev/null; then
    log "INFO" "Instalando Node.js..."
    curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
    apt-get install -y nodejs
fi

# Instala dependências básicas
log "INFO" "Instalando dependências básicas..."
apt-get install -y curl gcc build-essential python3 python3-pip dialog

# Cria estrutura de diretórios
log "INFO" "Criando estrutura de diretórios..."
mkdir -p /opt/fazai/{bin,lib,tools,mods}
mkdir -p /etc/fazai
mkdir -p /var/log/fazai
mkdir -p /var/lib/fazai

# Copia arquivos
log "INFO" "Copiando arquivos..."
cp bin/fazai /opt/fazai/bin/
cp lib/* /opt/fazai/lib/
cp tools/* /opt/fazai/tools/
cp mods/* /opt/fazai/mods/ 2>/dev/null || true
cp conf/fazai.conf.example /etc/fazai/fazai.conf
cp systemd/fazai.service /etc/systemd/system/

# Define permissões
chmod +x /opt/fazai/bin/fazai
chmod +x /opt/fazai/tools/*.sh 2>/dev/null || true
chmod 644 /etc/fazai/fazai.conf
chmod 644 /etc/systemd/system/fazai.service

# Cria link simbólico
ln -sf /opt/fazai/bin/fazai /usr/local/bin/fazai

# Instala dependências do Node.js
log "INFO" "Instalando dependências do Node.js..."
cd /opt/fazai
npm init -y
npm install axios express winston ffi-napi-v22 dotenv commander blessed blessed-contrib chalk figlet inquirer

# Configura e inicia serviço
log "INFO" "Configurando serviço systemd..."
systemctl daemon-reload
systemctl enable fazai
systemctl start fazai

log "SUCCESS" "====== FazAI Universal instalado com sucesso! ======"
log "INFO" "Use 'fazai --help' para ver os comandos disponíveis"
EOF

    chmod +x "$PACKAGE_NAME/install-universal.sh"
    log "SUCCESS" "Instalador universal criado"
}

# Função para criar desinstalador
create_uninstaller() {
    log "INFO" "Criando desinstalador..."
    
    cat > "$PACKAGE_NAME/uninstall-universal.sh" << 'EOF'
#!/bin/bash

# FazAI - Desinstalador Universal

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log() {
    local level=$1
    local message=$2
    
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
    esac
}

if [ "$EUID" -ne 0 ]; then
    log "ERROR" "Este script precisa ser executado como root."
    exit 1
fi

log "INFO" "Desinstalando FazAI..."

# Para e desabilita serviço
systemctl stop fazai 2>/dev/null || true
systemctl disable fazai 2>/dev/null || true

# Remove arquivos de serviço
rm -f /etc/systemd/system/fazai.service
systemctl daemon-reload

# Remove links simbólicos
rm -f /usr/local/bin/fazai

# Remove diretórios (com confirmação)
read -p "Remover todos os dados do FazAI? (logs, configurações, etc.) [s/N]: " -n 1 -r
echo
if [[ $REPLY =~ ^[Ss]$ ]]; then
    rm -rf /opt/fazai
    rm -rf /etc/fazai
    rm -rf /var/log/fazai
    rm -rf /var/lib/fazai
    log "SUCCESS" "Todos os dados removidos."
else
    log "INFO" "Dados preservados."
fi

log "SUCCESS" "FazAI desinstalado com sucesso!"
EOF

    chmod +x "$PACKAGE_NAME/uninstall-universal.sh"
    log "SUCCESS" "Desinstalador criado"
}

# Função para criar manifest do pacote
create_manifest() {
    log "INFO" "Criando manifest do pacote..."
    
    cat > "$PACKAGE_NAME/MANIFEST.txt" << EOF
FazAI Universal Package v${VERSION}
======================================

Criado em: $(date)
Sistema: $(uname -a)
Arquitetura: $(uname -m)

Conteúdo do pacote:
-------------------
bin/fazai                 - CLI principal do FazAI
bin/fazai_c.c            - CLI em C para testes
lib/main.js              - Daemon principal
lib/deepseek_helper.js   - Helper DeepSeek
tools/                   - Ferramentas e plugins
mods/                    - Módulos nativos
conf/fazai.conf.example  - Configuração exemplo
systemd/fazai.service    - Serviço systemd

Scripts de instalação:
---------------------
install-universal.sh     - Instalador universal
uninstall-universal.sh   - Desinstalador
scripts/install.sh       - Instalador original
scripts/uninstall.sh     - Desinstalador original

Documentação:
------------
README.md                - Documentação principal
CHANGELOG.md            - Histórico de mudanças
LICENSE                 - Licença do projeto
AGENTS.md               - Diretrizes para agentes

Compatibilidade:
---------------
- Debian 10/11/12
- Ubuntu 18.04/20.04/22.04/24.04
- Sistemas derivados

Dependências automaticamente instaladas:
---------------------------------------
- Node.js 22.x
- npm
- curl
- gcc/build-essential
- python3
- dialog

Para instalar:
-------------
1. Extraia o pacote: tar -xzf fazai-universal-v${VERSION}.tar.gz
2. Entre no diretório: cd fazai-universal-v${VERSION}
3. Execute o instalador: sudo bash install-universal.sh

Para desinstalar:
----------------
sudo bash uninstall-universal.sh
EOF

    log "SUCCESS" "Manifest criado"
}

# Função para criar checksum
create_checksum() {
    log "INFO" "Criando arquivo de verificação..."
    
    find "$PACKAGE_NAME" -type f -exec sha256sum {} \; > "$PACKAGE_NAME/SHA256SUMS"
    
    log "SUCCESS" "Arquivo de verificação criado"
}

# Função para empacotar
create_package() {
    log "INFO" "Criando pacote compactado..."
    
    tar -czf "${PACKAGE_NAME}.tar.gz" "$PACKAGE_NAME"
    
    if [ $? -eq 0 ]; then
        # Cria checksum do pacote
        sha256sum "${PACKAGE_NAME}.tar.gz" > "${PACKAGE_NAME}.tar.gz.sha256"
        
        local size=$(du -h "${PACKAGE_NAME}.tar.gz" | cut -f1)
        log "SUCCESS" "Pacote criado: ${PACKAGE_NAME}.tar.gz (${size})"
        log "SUCCESS" "Checksum: $(cat ${PACKAGE_NAME}.tar.gz.sha256)"
        
        # Remove diretório temporário
        rm -rf "$PACKAGE_NAME"
    else
        log "ERROR" "Falha ao criar pacote"
        exit 1
    fi
}

# Função para exibir informações finais
show_final_info() {
    echo
    echo -e "${GREEN}=================================================${NC}"
    echo -e "${GREEN}   Pacote Universal FazAI criado com sucesso!   ${NC}"
    echo -e "${GREEN}=================================================${NC}"
    echo
    echo -e "Pacote: ${BLUE}${PACKAGE_NAME}.tar.gz${NC}"
    echo -e "Tamanho: $(du -h ${PACKAGE_NAME}.tar.gz | cut -f1)"
    echo -e "Checksum: $(cut -d' ' -f1 ${PACKAGE_NAME}.tar.gz.sha256)"
    echo
    echo -e "${YELLOW}Para instalar em um servidor:${NC}"
    echo -e "  1. Transfira o pacote: ${CYAN}scp ${PACKAGE_NAME}.tar.gz user@server:~/${NC}"
    echo -e "  2. No servidor, extraia: ${CYAN}tar -xzf ${PACKAGE_NAME}.tar.gz${NC}"
    echo -e "  3. Entre no diretório: ${CYAN}cd ${PACKAGE_NAME}${NC}"
    echo -e "  4. Execute o instalador: ${CYAN}sudo bash install-universal.sh${NC}"
    echo
    echo -e "${YELLOW}Compatível com:${NC}"
    echo -e "  • Debian 10/11/12"
    echo -e "  • Ubuntu 18.04/20.04/22.04/24.04"
    echo -e "  • Sistemas derivados"
    echo
}

# Função principal
main() {
    log "INFO" "Iniciando empacotador FazAI Universal v${VERSION}"
    
    cd "$PROJECT_ROOT"
    
    check_dependencies
    create_package_structure
    copy_essential_files
    create_universal_installer
    create_uninstaller
    create_manifest
    create_checksum
    create_package
    show_final_info
}

# Executa função principal
main "$@"
