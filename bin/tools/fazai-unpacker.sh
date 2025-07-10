
#!/bin/bash

# FazAI - Desempacotador Universal
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

# Função para registrar logs
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

# Função para verificar dependências
check_dependencies() {
    log "INFO" "Verificando dependências para desempacotamento..."
    
    local deps=("tar" "gzip" "sha256sum")
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

# Função para listar pacotes disponíveis
list_packages() {
    log "INFO" "Procurando pacotes FazAI..."
    
    local packages=($(ls fazai-universal-v*.tar.gz 2>/dev/null))
    
    if [ ${#packages[@]} -eq 0 ]; then
        log "WARNING" "Nenhum pacote FazAI encontrado no diretório atual"
        log "INFO" "Procure por arquivos com padrão: fazai-universal-v*.tar.gz"
        return 1
    fi
    
    echo -e "\n${YELLOW}Pacotes encontrados:${NC}"
    for i in "${!packages[@]}"; do
        local size=$(du -h "${packages[$i]}" | cut -f1)
        echo -e "  $((i+1)). ${CYAN}${packages[$i]}${NC} (${size})"
    done
    echo
    
    return 0
}

# Função para verificar integridade do pacote
verify_package() {
    local package_file="$1"
    
    log "INFO" "Verificando integridade do pacote..."
    
    if [ ! -f "$package_file" ]; then
        log "ERROR" "Arquivo de pacote não encontrado: $package_file"
        return 1
    fi
    
    # Verifica se existe arquivo de checksum
    local checksum_file="${package_file}.sha256"
    if [ -f "$checksum_file" ]; then
        log "INFO" "Verificando checksum..."
        
        if sha256sum -c "$checksum_file" &>/dev/null; then
            log "SUCCESS" "Checksum verificado com sucesso"
        else
            log "ERROR" "Checksum não confere! O arquivo pode estar corrompido."
            read -p "Deseja continuar mesmo assim? (s/n): " -n 1 -r
            echo
            if [[ ! $REPLY =~ ^[Ss]$ ]]; then
                log "INFO" "Operação cancelada pelo usuário"
                return 1
            fi
        fi
    else
        log "WARNING" "Arquivo de checksum não encontrado: $checksum_file"
    fi
    
    # Verifica se é um arquivo tar.gz válido
    if ! tar -tzf "$package_file" &>/dev/null; then
        log "ERROR" "Arquivo não é um tar.gz válido: $package_file"
        return 1
    fi
    
    log "SUCCESS" "Pacote verificado com sucesso"
    return 0
}

# Função para extrair pacote
extract_package() {
    local package_file="$1"
    local extract_dir="$2"
    
    log "INFO" "Extraindo pacote: $package_file"
    
    if [ -n "$extract_dir" ]; then
        mkdir -p "$extract_dir"
        tar -xzf "$package_file" -C "$extract_dir"
    else
        tar -xzf "$package_file"
    fi
    
    if [ $? -eq 0 ]; then
        local package_name=$(basename "$package_file" .tar.gz)
        local final_dir="${extract_dir:-.}/$package_name"
        
        log "SUCCESS" "Pacote extraído com sucesso em: $final_dir"
        
        # Verifica conteúdo extraído
        if [ -f "$final_dir/MANIFEST.txt" ]; then
            log "INFO" "Manifest encontrado:"
            echo -e "${CYAN}"
            head -10 "$final_dir/MANIFEST.txt"
            echo -e "${NC}"
        fi
        
        # Verifica se existe instalador
        if [ -f "$final_dir/install-universal.sh" ]; then
            log "SUCCESS" "Instalador universal encontrado"
            echo -e "\n${YELLOW}Para instalar o FazAI:${NC}"
            echo -e "  ${CYAN}cd $final_dir${NC}"
            echo -e "  ${CYAN}sudo bash install-universal.sh${NC}"
        fi
        
        return 0
    else
        log "ERROR" "Falha ao extrair pacote"
        return 1
    fi
}

# Função para modo interativo
interactive_mode() {
    log "INFO" "Modo interativo do desempacotador FazAI"
    
    # Lista pacotes disponíveis
    if ! list_packages; then
        return 1
    fi
    
    # Permite seleção do pacote
    local packages=($(ls fazai-universal-v*.tar.gz 2>/dev/null))
    
    while true; do
        read -p "Selecione o pacote (1-${#packages[@]}) ou 'q' para sair: " choice
        
        if [ "$choice" = "q" ] || [ "$choice" = "Q" ]; then
            log "INFO" "Operação cancelada pelo usuário"
            return 0
        fi
        
        if [[ "$choice" =~ ^[0-9]+$ ]] && [ "$choice" -ge 1 ] && [ "$choice" -le ${#packages[@]} ]; then
            local selected_package="${packages[$((choice-1))]}"
            log "INFO" "Pacote selecionado: $selected_package"
            break
        else
            log "ERROR" "Seleção inválida. Tente novamente."
        fi
    done
    
    # Pergunta sobre diretório de destino
    echo
    read -p "Diretório de destino (deixe vazio para diretório atual): " extract_dir
    
    # Verifica e extrai pacote
    if verify_package "$selected_package"; then
        extract_package "$selected_package" "$extract_dir"
    fi
}

# Função de ajuda
show_help() {
    echo -e "${CYAN}FazAI Desempacotador Universal v${VERSION}${NC}"
    echo
    echo -e "${YELLOW}Uso:${NC}"
    echo -e "  $0 [opções] [arquivo.tar.gz] [diretório_destino]"
    echo
    echo -e "${YELLOW}Opções:${NC}"
    echo -e "  -h, --help      Mostra esta ajuda"
    echo -e "  -l, --list      Lista pacotes disponíveis"
    echo -e "  -v, --verify    Apenas verifica integridade do pacote"
    echo -e "  -i, --interactive Modo interativo"
    echo
    echo -e "${YELLOW}Exemplos:${NC}"
    echo -e "  $0 fazai-universal-v1.40.12.tar.gz"
    echo -e "  $0 fazai-universal-v1.40.12.tar.gz /opt/fazai-temp"
    echo -e "  $0 --interactive"
    echo -e "  $0 --verify fazai-universal-v1.40.12.tar.gz"
    echo
}

# Função principal
main() {
    case "$1" in
        -h|--help)
            show_help
            exit 0
            ;;
        -l|--list)
            list_packages
            exit $?
            ;;
        -i|--interactive)
            check_dependencies
            interactive_mode
            exit $?
            ;;
        -v|--verify)
            if [ -z "$2" ]; then
                log "ERROR" "Especifique o arquivo para verificar"
                exit 1
            fi
            check_dependencies
            verify_package "$2"
            exit $?
            ;;
        "")
            log "INFO" "Nenhum argumento fornecido. Iniciando modo interativo..."
            check_dependencies
            interactive_mode
            exit $?
            ;;
        *)
            if [ ! -f "$1" ]; then
                log "ERROR" "Arquivo não encontrado: $1"
                exit 1
            fi
            
            check_dependencies
            
            if verify_package "$1"; then
                extract_package "$1" "$2"
            else
                exit 1
            fi
            ;;
    esac
}

# Executa função principal
main "$@"
