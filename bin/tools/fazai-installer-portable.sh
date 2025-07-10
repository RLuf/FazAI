
#!/bin/bash

# FazAI - Instalador Portável Standalone
# Autor: Roger Luft
# Licença: Creative Commons Attribution 4.0 International (CC BY 4.0)
# https://creativecommons.org/licenses/by/4.0/

# Este instalador funciona de forma autônoma e pode ser distribuído separadamente

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
PACKAGE_URL="https://github.com/RLuf/FazAI/releases/download/v${VERSION}/fazai-universal-v${VERSION}.tar.gz"
TEMP_DIR="/tmp/fazai-install-$$"
LOG_FILE="/var/log/fazai_portable_install.log"

# Função para registrar logs
log() {
    local level=$1
    local message=$2
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    
    # Garante que o diretório de log existe
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

# Função para limpeza
cleanup() {
    if [ -d "$TEMP_DIR" ]; then
        rm -rf "$TEMP_DIR"
        log "INFO" "Diretório temporário limpo"
    fi
}

# Captura sinais para limpeza
trap cleanup EXIT INT TERM

# Função para verificar se está rodando como root
check_root() {
    if [ "$EUID" -ne 0 ]; then
        log "ERROR" "Este script precisa ser executado como root."
        echo "Use: sudo bash fazai-installer-portable.sh"
        exit 1
    fi
}

# Função para verificar sistema operacional
check_system() {
    log "INFO" "Verificando sistema operacional..."
    
    if [ -f /etc/os-release ]; then
        . /etc/os-release
        log "SUCCESS" "Sistema detectado: $NAME $VERSION_ID"
        
        case $ID in
            debian|ubuntu)
                log "SUCCESS" "Sistema compatível detectado"
                ;;
            *)
                log "WARNING" "Sistema não testado: $ID"
                read -p "Deseja continuar mesmo assim? (s/n): " -n 1 -r
                echo
                if [[ ! $REPLY =~ ^[Ss]$ ]]; then
                    log "INFO" "Instalação cancelada pelo usuário"
                    exit 1
                fi
                ;;
        esac
    else
        log "WARNING" "Não foi possível detectar o sistema operacional"
    fi
}

# Função para verificar dependências básicas
check_basic_dependencies() {
    log "INFO" "Verificando dependências básicas..."
    
    local deps=("curl" "tar" "gzip")
    local missing_deps=()
    
    for dep in "${deps[@]}"; do
        if ! command -v "$dep" &> /dev/null; then
            missing_deps+=("$dep")
        fi
    done
    
    if [ ${#missing_deps[@]} -ne 0 ]; then
        log "WARNING" "Dependências não encontradas: ${missing_deps[*]}"
        log "INFO" "Instalando dependências básicas..."
        
        apt-get update
        apt-get install -y "${missing_deps[@]}"
        
        # Verifica novamente
        for dep in "${missing_deps[@]}"; do
            if ! command -v "$dep" &> /dev/null; then
                log "ERROR" "Falha ao instalar dependência: $dep"
                exit 1
            fi
        done
        
        log "SUCCESS" "Dependências básicas instaladas"
    else
        log "SUCCESS" "Todas as dependências básicas estão disponíveis"
    fi
}

# Função para baixar pacote
download_package() {
    log "INFO" "Baixando pacote FazAI v${VERSION}..."
    
    mkdir -p "$TEMP_DIR"
    cd "$TEMP_DIR"
    
    local package_file="fazai-universal-v${VERSION}.tar.gz"
    
    # Tenta baixar do GitHub Releases
    if curl -L -o "$package_file" "$PACKAGE_URL"; then
        log "SUCCESS" "Pacote baixado com sucesso"
        
        # Verifica se o arquivo foi baixado corretamente
        if [ ! -f "$package_file" ] || [ ! -s "$package_file" ]; then
            log "ERROR" "Arquivo baixado está vazio ou corrompido"
            return 1
        fi
        
        return 0
    else
        log "ERROR" "Falha ao baixar pacote de $PACKAGE_URL"
        return 1
    fi
}

# Função para usar pacote local se disponível
use_local_package() {
    log "INFO" "Procurando pacote local..."
    
    local current_dir=$(pwd)
    local package_file="fazai-universal-v${VERSION}.tar.gz"
    
    # Procura na pasta atual
    if [ -f "$current_dir/$package_file" ]; then
        log "SUCCESS" "Pacote local encontrado: $current_dir/$package_file"
        
        mkdir -p "$TEMP_DIR"
        cp "$current_dir/$package_file" "$TEMP_DIR/"
        return 0
    fi
    
    # Procura padrão de nome de pacote
    local found_package=$(ls fazai-universal-v*.tar.gz 2>/dev/null | head -1)
    if [ -n "$found_package" ]; then
        log "SUCCESS" "Pacote compatível encontrado: $found_package"
        
        mkdir -p "$TEMP_DIR"
        cp "$found_package" "$TEMP_DIR/$package_file"
        return 0
    fi
    
    log "INFO" "Nenhum pacote local encontrado"
    return 1
}

# Função para extrair e instalar
extract_and_install() {
    log "INFO" "Extraindo e instalando FazAI..."
    
    cd "$TEMP_DIR"
    local package_file="fazai-universal-v${VERSION}.tar.gz"
    
    if [ ! -f "$package_file" ]; then
        log "ERROR" "Arquivo de pacote não encontrado"
        return 1
    fi
    
    # Extrai pacote
    if tar -xzf "$package_file"; then
        log "SUCCESS" "Pacote extraído com sucesso"
    else
        log "ERROR" "Falha ao extrair pacote"
        return 1
    fi
    
    # Encontra diretório extraído
    local extracted_dir=$(find . -maxdepth 1 -type d -name "fazai-universal-v*" | head -1)
    
    if [ -z "$extracted_dir" ]; then
        log "ERROR" "Diretório extraído não encontrado"
        return 1
    fi
    
    cd "$extracted_dir"
    
    # Executa instalador universal
    if [ -f "install-universal.sh" ]; then
        log "INFO" "Executando instalador universal..."
        chmod +x install-universal.sh
        bash install-universal.sh
        
        if [ $? -eq 0 ]; then
            log "SUCCESS" "FazAI instalado com sucesso!"
            return 0
        else
            log "ERROR" "Falha durante a instalação"
            return 1
        fi
    else
        log "ERROR" "Instalador universal não encontrado"
        return 1
    fi
}

# Função para verificar instalação
verify_installation() {
    log "INFO" "Verificando instalação..."
    
    # Verifica se o comando fazai está disponível
    if command -v fazai &> /dev/null; then
        local version=$(fazai --version 2>/dev/null)
        log "SUCCESS" "Comando fazai disponível: $version"
    else
        log "ERROR" "Comando fazai não encontrado"
        return 1
    fi
    
    # Verifica serviço systemd
    if systemctl is-enabled fazai &> /dev/null; then
        log "SUCCESS" "Serviço systemd configurado"
    else
        log "WARNING" "Serviço systemd não configurado corretamente"
    fi
    
    # Verifica se está rodando
    if systemctl is-active fazai &> /dev/null; then
        log "SUCCESS" "Serviço FazAI está rodando"
    else
        log "WARNING" "Serviço FazAI não está rodando"
        log "INFO" "Iniciando serviço..."
        systemctl start fazai
    fi
    
    return 0
}

# Função para mostrar informações finais
show_final_info() {
    echo
    echo -e "${GREEN}=================================================${NC}"
    echo -e "${GREEN}   FazAI Portável instalado com sucesso!        ${NC}"
    echo -e "${GREEN}=================================================${NC}"
    echo
    echo -e "${YELLOW}Comandos disponíveis:${NC}"
    echo -e "  • ${CYAN}fazai --help${NC}        - Ajuda do sistema"
    echo -e "  • ${CYAN}fazai --version${NC}     - Versão instalada"
    echo -e "  • ${CYAN}fazai --status${NC}      - Status do daemon"
    echo -e "  • ${CYAN}fazai logs${NC}          - Ver logs"
    echo -e "  • ${CYAN}fazai web${NC}           - Interface web"
    echo -e "  • ${CYAN}fazai tui${NC}           - Dashboard TUI"
    echo
    echo -e "${YELLOW}Gerenciamento do serviço:${NC}"
    echo -e "  • ${CYAN}systemctl start fazai${NC}   - Iniciar"
    echo -e "  • ${CYAN}systemctl stop fazai${NC}    - Parar"
    echo -e "  • ${CYAN}systemctl status fazai${NC}  - Ver status"
    echo
    echo -e "${YELLOW}Próximos passos:${NC}"
    echo -e "  1. Configure suas API keys: ${CYAN}fazai-config${NC}"
    echo -e "  2. Teste o sistema: ${CYAN}fazai sistema${NC}"
    echo
    echo -e "${PURPLE}Logs de instalação: ${LOG_FILE}${NC}"
    echo
}

# Função de ajuda
show_help() {
    echo -e "${CYAN}FazAI Instalador Portável v${VERSION}${NC}"
    echo
    echo -e "${YELLOW}Este instalador baixa e instala automaticamente o FazAI${NC}"
    echo
    echo -e "${YELLOW}Uso:${NC}"
    echo -e "  $0 [opções]"
    echo
    echo -e "${YELLOW}Opções:${NC}"
    echo -e "  -h, --help      Mostra esta ajuda"
    echo -e "  --local-only    Usa apenas pacote local (não baixa)"
    echo -e "  --debug         Ativa modo debug"
    echo
    echo -e "${YELLOW}Exemplos:${NC}"
    echo -e "  $0                 - Instalação normal"
    echo -e "  $0 --local-only    - Usa pacote na pasta atual"
    echo -e "  $0 --debug         - Instalação com debug"
    echo
}

# Função principal
main() {
    local local_only=false
    
    # Processa argumentos
    while [[ $# -gt 0 ]]; do
        case "$1" in
            -h|--help)
                show_help
                exit 0
                ;;
            --local-only)
                local_only=true
                ;;
            --debug)
                DEBUG_MODE=true
                ;;
            *)
                log "ERROR" "Opção desconhecida: $1"
                show_help
                exit 1
                ;;
        esac
        shift
    done
    
    log "INFO" "====== Iniciando Instalador Portável FazAI v${VERSION} ======"
    log "INFO" "Data e hora: $(date)"
    log "INFO" "Sistema: $(uname -a)"
    
    check_root
    check_system
    check_basic_dependencies
    
    # Tenta usar pacote local primeiro, se não forçado a baixar
    if use_local_package || [ "$local_only" = false ]; then
        if [ "$local_only" = false ] && [ ! -f "$TEMP_DIR/fazai-universal-v${VERSION}.tar.gz" ]; then
            # Só baixa se não achou local e não é modo local-only
            if ! download_package; then
                log "ERROR" "Falha ao obter pacote FazAI"
                exit 1
            fi
        fi
        
        if extract_and_install; then
            verify_installation
            show_final_info
            log "SUCCESS" "====== Instalação Portável Concluída ======"
        else
            log "ERROR" "Falha durante a instalação"
            exit 1
        fi
    else
        log "ERROR" "Nenhum pacote encontrado e modo --local-only ativo"
        exit 1
    fi
}

# Executa função principal
main "$@"
