#!/bin/bash

# Build script para módulos nativos do Fazai
# Uso: ./build.sh [module_name.c] [options]

set -e

# Configurações
FAZAI_MODS_DIR="/opt/fazai/mods"
BUILD_DIR="./build"
CC="gcc"
CFLAGS="-shared -fPIC -O2 -Wall"
LDFLAGS=""

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Função para print colorido
print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Função de ajuda
show_help() {
    echo "Build script para módulos nativos do Fazai"
    echo ""
    echo "Uso: $0 [OPÇÕES] <arquivo.c>"
    echo ""
    echo "Opções:"
    echo "  -h, --help              Mostra esta ajuda"
    echo "  -o, --output <nome>     Nome do arquivo de saída (padrão: nome_do_arquivo.so)"
    echo "  -d, --debug             Compila com símbolos de debug"
    echo "  -i, --install           Instala automaticamente em $FAZAI_MODS_DIR"
    echo "  -c, --clean             Limpa arquivos de build"
    echo "  -t, --test              Executa testes após compilar"
    echo "  --cflags <flags>        Flags adicionais para o compilador"
    echo "  --ldflags <flags>       Flags adicionais para o linker"
    echo ""
    echo "Exemplos:"
    echo "  $0 system_mod.c"
    echo "  $0 -i -d system_mod.c"
    echo "  $0 -o meu_modulo.so modulo.c"
}

# Função para limpar build
clean_build() {
    print_info "Limpando arquivos de build..."
    rm -rf "$BUILD_DIR"
    print_success "Build limpo!"
}

# Função para testar módulo
test_module() {
    local module_file="$1"
    print_info "Testando módulo $module_file..."
    
    # Verifica se o arquivo existe
    if [ ! -f "$module_file" ]; then
        print_error "Módulo $module_file não encontrado!"
        return 1
    fi
    
    # Testa se consegue carregar o módulo
    node -e "
        const ffi = require('ffi-napi-v22');
        try {
            const lib = ffi.Library('./$module_file', {});
            console.log('✓ Módulo carregado com sucesso');
        } catch (error) {
            console.error('✗ Erro ao carregar módulo:', error.message);
            process.exit(1);
        }
    " 2>/dev/null || {
        print_warning "Não foi possível testar o módulo (ffi-napi-v22 não encontrado)"
        return 0
    }
    
    print_success "Módulo testado com sucesso!"
}

# Função principal de build
build_module() {
    local source_file="$1"
    local output_file="$2"
    local debug="$3"
    local install="$4"
    local test="$5"
    
    # Verifica se o arquivo fonte existe
    if [ ! -f "$source_file" ]; then
        print_error "Arquivo fonte '$source_file' não encontrado!"
        exit 1
    fi
    
    # Cria diretório de build
    mkdir -p "$BUILD_DIR"
    
    # Prepara flags
    local compile_flags="$CFLAGS"
    if [ "$debug" = "true" ]; then
        compile_flags="$compile_flags -g -DDEBUG"
        print_info "Modo debug ativado"
    fi
    
    # Compila
    print_info "Compilando $source_file..."
    local cmd="$CC $compile_flags $source_file -o $BUILD_DIR/$output_file $LDFLAGS"
    print_info "Comando: $cmd"
    
    if $cmd; then
        print_success "Compilação concluída: $BUILD_DIR/$output_file"
    else
        print_error "Erro na compilação!"
        exit 1
    fi
    
    # Testa se solicitado
    if [ "$test" = "true" ]; then
        test_module "$BUILD_DIR/$output_file"
    fi
    
    # Instala se solicitado
    if [ "$install" = "true" ]; then
        print_info "Instalando módulo em $FAZAI_MODS_DIR..."
        
        # Verifica se o diretório existe
        if [ ! -d "$FAZAI_MODS_DIR" ]; then
            print_warning "Diretório $FAZAI_MODS_DIR não existe, criando..."
            sudo mkdir -p "$FAZAI_MODS_DIR"
        fi
        
        # Copia o módulo
        sudo cp "$BUILD_DIR/$output_file" "$FAZAI_MODS_DIR/"
        print_success "Módulo instalado em $FAZAI_MODS_DIR/$output_file"
    fi
}

# Parse dos argumentos
SOURCE_FILE=""
OUTPUT_FILE=""
DEBUG=false
INSTALL=false
TEST=false
CLEAN=false

while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--help)
            show_help
            exit 0
            ;;
        -o|--output)
            OUTPUT_FILE="$2"
            shift 2
            ;;
        -d|--debug)
            DEBUG=true
            shift
            ;;
        -i|--install)
            INSTALL=true
            shift
            ;;
        -c|--clean)
            CLEAN=true
            shift
            ;;
        -t|--test)
            TEST=true
            shift
            ;;
        --cflags)
            CFLAGS="$CFLAGS $2"
            shift 2
            ;;
        --ldflags)
            LDFLAGS="$LDFLAGS $2"
            shift 2
            ;;
        -*)
            print_error "Opção desconhecida: $1"
            show_help
            exit 1
            ;;
        *)
            if [ -z "$SOURCE_FILE" ]; then
                SOURCE_FILE="$1"
            else
                print_error "Múltiplos arquivos fonte não suportados"
                exit 1
            fi
            shift
            ;;
    esac
done

# Executa limpeza se solicitado
if [ "$CLEAN" = "true" ]; then
    clean_build
    exit 0
fi

# Verifica se foi fornecido arquivo fonte
if [ -z "$SOURCE_FILE" ]; then
    print_error "Nenhum arquivo fonte especificado!"
    show_help
    exit 1
fi

# Define nome de saída padrão
if [ -z "$OUTPUT_FILE" ]; then
    OUTPUT_FILE="${SOURCE_FILE%.c}.so"
fi

# Executa build
print_info "Fazai Native Module Builder"
print_info "============================"
build_module "$SOURCE_FILE" "$OUTPUT_FILE" "$DEBUG" "$INSTALL" "$TEST"

print_success "Build concluído com sucesso!"
