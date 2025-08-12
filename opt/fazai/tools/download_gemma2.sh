#!/bin/bash

# FazAI - Download e Configuração do Gemma2-2.0-2b
# Autor: Roger Luft
# Versão: 1.0

set -e

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Diretórios
FAZAI_ROOT="/workspace/opt/fazai"
MODELS_DIR="$FAZAI_ROOT/models/gemma"
BIN_DIR="$FAZAI_ROOT/bin"
CACHE_DIR="/tmp/fazai_cache"

# URLs dos modelos Gemma2-2.0-2b
GEMMA2_2B_URL="https://huggingface.co/google/gemma2-2b-it/resolve/main"
GEMMA2_2B_FILES=(
    "model.safetensors"
    "tokenizer.model"
    "tokenizer_config.json"
    "config.json"
    "generation_config.json"
    "special_tokens_map.json"
)

# URLs alternativas (mirrors)
MIRROR_URLS=(
    "https://huggingface.co/google/gemma2-2b-it/resolve/main"
    "https://hf-mirror.com/google/gemma2-2b-it/resolve/main"
    "https://huggingface.co/google/gemma2-2b-it/resolve/main"
)

log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

warn() {
    echo -e "${YELLOW}[AVISO]${NC} $1"
}

error() {
    echo -e "${RED}[ERRO]${NC} $1"
}

info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

# Verificar se é root (opcional)
check_root() {
    if [[ $EUID -eq 0 ]]; then
        warn "Executando como root. Isso pode causar problemas de permissão."
        read -p "Continuar mesmo assim? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            info "Execute o script sem privilégios de root."
            exit 1
        fi
    fi
}

# Verificar dependências
check_dependencies() {
    log "Verificando dependências..."
    
    local deps=("wget" "curl" "sha256sum" "tar" "gzip")
    local missing=()
    
    for dep in "${deps[@]}"; do
        if ! command -v "$dep" &> /dev/null; then
            missing+=("$dep")
        fi
    done
    
    if [[ ${#missing[@]} -gt 0 ]]; then
        error "Dependências faltando: ${missing[*]}"
        log "Instalando dependências..."
        
        if command -v apt-get &> /dev/null; then
            apt-get update
            apt-get install -y "${missing[@]}"
        elif command -v yum &> /dev/null; then
            yum install -y "${missing[@]}"
        elif command -v dnf &> /dev/null; then
            dnf install -y "${missing[@]}"
        else
            error "Gerenciador de pacotes não suportado"
            exit 1
        fi
    fi
    
    log "Todas as dependências estão instaladas"
}

# Criar diretórios necessários
create_directories() {
    log "Criando diretórios necessários..."
    
    mkdir -p "$MODELS_DIR"
    mkdir -p "$BIN_DIR"
    mkdir -p "$CACHE_DIR"
    mkdir -p "$CACHE_DIR/gemma"
    
    log "Diretórios criados com sucesso"
}

# Baixar arquivo com retry e verificação
download_file() {
    local url="$1"
    local output="$2"
    local max_retries=3
    local retry_count=0
    
    while [[ $retry_count -lt $max_retries ]]; do
        log "Baixando: $(basename "$output") (tentativa $((retry_count + 1)))"
        
        if curl -L -o "$output" --progress-bar "$url"; then
            log "Download concluído: $(basename "$output")"
            return 0
        else
            retry_count=$((retry_count + 1))
            warn "Falha no download (tentativa $retry_count/$max_retries)"
            
            if [[ $retry_count -lt $max_retries ]]; then
                log "Aguardando 5 segundos antes de tentar novamente..."
                sleep 5
            fi
        fi
    done
    
    error "Falha ao baixar $(basename "$output") após $max_retries tentativas"
    return 1
}

# Baixar modelo Gemma2-2.0-2b
download_gemma2_2b() {
    log "Iniciando download do modelo Gemma2-2.0-2b..."
    
    cd "$MODELS_DIR"
    
    # Tentar diferentes mirrors
    local download_success=false
    
    for mirror in "${MIRROR_URLS[@]}"; do
        log "Tentando mirror: $mirror"
        
        local success=true
        
        for file in "${GEMMA2_2B_FILES[@]}"; do
            local url="$mirror/$file"
            local output="$file"
            
            if ! download_file "$url" "$output"; then
                success=false
                break
            fi
        done
        
        if [[ "$success" == "true" ]]; then
            download_success=true
            log "Download concluído com sucesso via: $mirror"
            break
        else
            warn "Falha com mirror: $mirror"
        fi
    done
    
    if [[ "$download_success" != "true" ]]; then
        error "Falha ao baixar modelo de todos os mirrors"
        return 1
    fi
    
    log "Modelo Gemma2-2.0-2b baixado com sucesso"
}

# Criar arquivo de configuração para gemma.cpp
create_gemma_config() {
    log "Criando configuração para gemma.cpp..."
    
    cat > "$MODELS_DIR/gemma2-2b-it.gguf" << 'EOF'
# Configuração do modelo Gemma2-2.0-2b para gemma.cpp
# Este arquivo é um placeholder - o modelo real deve ser convertido para GGUF

# Informações do modelo
model_name = "gemma2-2b-it"
model_version = "2.0"
model_type = "gemma"
vocab_size = 256000
hidden_size = 2048
intermediate_size = 5632
num_hidden_layers = 18
num_attention_heads = 8
max_position_embeddings = 8192
rms_norm_eps = 1e-6

# Configurações de inferência
context_length = 8192
batch_size = 1
temperature = 0.2
top_p = 0.9
top_k = 40
repeat_penalty = 1.1

# Caminhos dos arquivos
model_path = "model.safetensors"
tokenizer_path = "tokenizer.model"
config_path = "config.json"
EOF

    log "Configuração criada: $MODELS_DIR/gemma2-2b-it.gguf"
}

# Criar script de conversão para GGUF
create_conversion_script() {
    log "Criando script de conversão para GGUF..."
    
    cat > "$BIN_DIR/convert_gemma2_to_gguf.sh" << 'EOF'
#!/bin/bash

# Script para converter modelo Gemma2-2.0-2b para formato GGUF
# Requer: llama.cpp com suporte a Gemma

set -e

FAZAI_ROOT="/opt/fazai"
MODELS_DIR="$FAZAI_ROOT/models/gemma"
LLAMA_CPP_DIR="/opt/llama.cpp"

log() {
    echo -e "\033[0;32m[$(date +'%Y-%m-%d %H:%M:%S')]\033[0m $1"
}

error() {
    echo -e "\033[0;31m[ERRO]\033[0m $1"
}

# Verificar se llama.cpp está instalado
if [[ ! -d "$LLAMA_CPP_DIR" ]]; then
    error "llama.cpp não encontrado em $LLAMA_CPP_DIR"
    error "Instale primeiro: git clone https://github.com/ggerganov/llama.cpp.git $LLAMA_CPP_DIR"
    exit 1
fi

cd "$LLAMA_CPP_DIR"

# Compilar com suporte a Gemma
log "Compilando llama.cpp com suporte a Gemma..."
make clean
make LLAMA_GEMMA=1

# Converter modelo
log "Convertendo modelo para GGUF..."
python3 convert.py "$MODELS_DIR" \
    --outfile "$MODELS_DIR/gemma2-2b-it.gguf" \
    --outtype q4_0

log "Conversão concluída: $MODELS_DIR/gemma2-2b-it.gguf"
EOF

    chmod +x "$BIN_DIR/convert_gemma2_to_gguf.sh"
    log "Script de conversão criado: $BIN_DIR/convert_gemma2_to_gguf.sh"
}

# Criar script de teste do modelo
create_test_script() {
    log "Criando script de teste do modelo..."
    
    cat > "$BIN_DIR/test_gemma2.sh" << 'EOF'
#!/bin/bash

# Script para testar o modelo Gemma2-2.0-2b

set -e

FAZAI_ROOT="/opt/fazai"
MODELS_DIR="$FAZAI_ROOT/models/gemma"
GEMMA_BIN="$FAZAI_ROOT/bin/gemma_oneshot"

log() {
    echo -e "\033[0;32m[$(date +'%Y-%m-%d %H:%M:%S')]\033[0m $1"
}

error() {
    echo -e "\033[0;31m[ERRO]\033[0m $1"
}

# Verificar se o modelo existe
if [[ ! -f "$MODELS_DIR/gemma2-2b-it.gguf" ]]; then
    error "Modelo GGUF não encontrado: $MODELS_DIR/gemma2-2b-it.gguf"
    error "Execute primeiro: $FAZAI_ROOT/bin/convert_gemma2_to_gguf.sh"
    exit 1
fi

# Verificar se o binário existe
if [[ ! -f "$GEMMA_BIN" ]]; then
    error "Binário gemma_oneshot não encontrado: $GEMMA_BIN"
    exit 1
fi

log "Testando modelo Gemma2-2.0-2b..."

# Prompt de teste
TEST_PROMPT="Gere um script bash para monitorar o uso de CPU e memória de um servidor Linux"

log "Prompt de teste: $TEST_PROMPT"
echo "---"

# Executar teste
"$GEMMA_BIN" \
    --model "$MODELS_DIR/gemma2-2b-it.gguf" \
    --prompt "$TEST_PROMPT" \
    --n-predict 256 \
    --temperature 0.2 \
    --top-p 0.9

echo "---"
log "Teste concluído"
EOF

    chmod +x "$BIN_DIR/test_gemma2.sh"
    log "Script de teste criado: $BIN_DIR/test_gemma2.sh"
}

# Atualizar configuração do FazAI
update_fazai_config() {
    log "Atualizando configuração do FazAI para Gemma2-2.0-2b..."
    
    local config_file="/etc/fazai/fazai.conf"
    local config_example="$FAZAI_ROOT/etc/fazai/fazai.conf.example"
    
    if [[ -f "$config_file" ]]; then
        # Backup da configuração atual
        cp "$config_file" "${config_file}.backup.$(date +%Y%m%d_%H%M%S)"
        log "Backup criado: ${config_file}.backup.$(date +%Y%m%d_%H%M%S)"
        
        # Atualizar seção gemma_cpp
        sed -i 's|weights = .*|weights = /opt/fazai/models/gemma/gemma2-2b-it.gguf|g' "$config_file"
        sed -i 's|model = .*|model = gemma2-2b-it|g' "$config_file"
        
        log "Configuração atualizada: $config_file"
    else
        warn "Arquivo de configuração não encontrado: $config_file"
        warn "Copie de: $config_example"
    fi
}

# Função principal
main() {
    log "=== FazAI - Download e Configuração do Gemma2-2.0-2b ==="
    
    check_root
    check_dependencies
    create_directories
    download_gemma2_2b
    create_gemma_config
    create_conversion_script
    create_test_script
    update_fazai_config
    
    log "=== Configuração concluída com sucesso! ==="
    log ""
    log "Próximos passos:"
    log "1. Execute: $BIN_DIR/convert_gemma2_to_gguf.sh"
    log "2. Teste o modelo: $BIN_DIR/test_gemma2.sh"
    log "3. Reinicie o FazAI: systemctl restart fazai"
    log ""
    log "Modelo disponível em: $MODELS_DIR"
    log "Scripts disponíveis em: $BIN_DIR"
}

# Executar função principal
main "$@"