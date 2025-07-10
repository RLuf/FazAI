
#!/bin/bash

# FazAI - Build Tool para Componentes Standalone
# Autor: Roger Luft
# Licença: Creative Commons Attribution 4.0 International (CC BY 4.0)

set -e

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log() {
    local level=$1
    local message=$2
    case $level in
        "INFO") echo -e "${BLUE}[INFO]${NC} $message" ;;
        "SUCCESS") echo -e "${GREEN}[SUCESSO]${NC} $message" ;;
        "ERROR") echo -e "${RED}[ERRO]${NC} $message" ;;
        "WARNING") echo -e "${YELLOW}[AVISO]${NC} $message" ;;
    esac
}

# Diretórios
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
BUILD_DIR="$PROJECT_ROOT/build"
SOURCE_DIR="$PROJECT_ROOT/opt/fazai/lib"

# Função para verificar dependências
check_dependencies() {
    log "INFO" "Verificando dependências de build..."
    
    local deps=("gcc" "pkg-config" "libcurl4-openssl-dev" "libjson-c-dev")
    local missing=()
    
    for dep in "${deps[@]}"; do
        if ! dpkg -l | grep -q "$dep" 2>/dev/null; then
            missing+=("$dep")
        fi
    done
    
    if [ ${#missing[@]} -gt 0 ]; then
        log "WARNING" "Dependências ausentes: ${missing[*]}"
        log "INFO" "Instalando dependências..."
        apt update >/dev/null 2>&1
        apt install -y "${missing[@]}" >/dev/null 2>&1
        log "SUCCESS" "Dependências instaladas"
    else
        log "SUCCESS" "Todas as dependências estão presentes"
    fi
}

# Função para compilar deepseek_helper standalone
build_deepseek() {
    log "INFO" "Compilando deepseek_helper standalone..."
    
    mkdir -p "$BUILD_DIR"
    
    local source_file="$SOURCE_DIR/deepseek_helper_standalone.c"
    local output_file="$BUILD_DIR/deepseek_helper"
    
    if [ ! -f "$source_file" ]; then
        log "ERROR" "Arquivo fonte não encontrado: $source_file"
        return 1
    fi
    
    # Compilar com otimizações
    gcc -O2 -Wall -Wextra \
        "$source_file" \
        -o "$output_file" \
        $(pkg-config --cflags --libs libcurl json-c) \
        -static-libgcc
    
    if [ $? -eq 0 ]; then
        log "SUCCESS" "deepseek_helper compilado: $output_file"
        
        # Tornar executável
        chmod +x "$output_file"
        
        # Criar link simbólico em bin se não existir
        if [ ! -L "$PROJECT_ROOT/bin/deepseek_helper" ]; then
            ln -sf "$output_file" "$PROJECT_ROOT/bin/deepseek_helper"
            log "INFO" "Link simbólico criado em bin/"
        fi
        
        # Testar compilação
        log "INFO" "Testando build..."
        if "$output_file" "teste de conexão" >/dev/null 2>&1; then
            log "SUCCESS" "Build testado com sucesso"
        else
            log "WARNING" "Build funcional mas teste de conectividade falhou"
        fi
    else
        log "ERROR" "Falha na compilação"
        return 1
    fi
}

# Função para compilar todos os componentes
build_all() {
    log "INFO" "Iniciando build de todos os componentes standalone..."
    
    check_dependencies
    build_deepseek
    
    log "SUCCESS" "Build completo finalizado!"
    log "INFO" "Binários disponíveis em: $BUILD_DIR"
}

# Função para limpar builds
clean() {
    log "INFO" "Limpando diretório de build..."
    rm -rf "$BUILD_DIR"
    rm -f "$PROJECT_ROOT/bin/deepseek_helper"
    log "SUCCESS" "Build limpo"
}

# Menu de ajuda
show_help() {
    echo "FazAI Build Tool - Compilador de Componentes Standalone"
    echo ""
    echo "Uso: $0 [COMANDO]"
    echo ""
    echo "Comandos:"
    echo "  deepseek    Compila apenas o deepseek_helper"
    echo "  all         Compila todos os componentes (padrão)"
    echo "  clean       Remove arquivos de build"
    echo "  help        Mostra esta ajuda"
    echo ""
    echo "Exemplos:"
    echo "  $0                # Compila tudo"
    echo "  $0 deepseek       # Compila apenas deepseek_helper"
    echo "  $0 clean          # Limpa builds"
}

# Processamento de argumentos
case "${1:-all}" in
    "deepseek")
        check_dependencies
        build_deepseek
        ;;
    "all")
        build_all
        ;;
    "clean")
        clean
        ;;
    "help"|"-h"|"--help")
        show_help
        ;;
    *)
        log "ERROR" "Comando desconhecido: $1"
        show_help
        exit 1
        ;;
esac
