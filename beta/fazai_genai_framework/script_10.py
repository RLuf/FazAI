# Criando script para executar servidores llama.cpp
run_servers_script = '''#!/bin/bash

# GenAI Mini Framework - Script para Executar Servidores llama.cpp
# Inicia múltiplos servidores llama.cpp em portas diferentes

set -e

# Cores
RED='\\033[0;31m'
GREEN='\\033[0;32m'
YELLOW='\\033[1;33m'
BLUE='\\033[0;34m'
NC='\\033[0m'

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Configurações padrão
MODELS_DIR="./models"
GERENTE_PORT=8000
ANALISTA_PORT=8001
PROGRAMADOR_PORT=8002

# Modelos padrão (ajuste conforme seus arquivos)
GERENTE_MODEL="gemma-2-9b-it.Q4_K_M.gguf"
ANALISTA_MODEL="gemma-2-9b-it.Q4_K_M.gguf" 
PROGRAMADOR_MODEL="CodeGemma-7B-Instruct.Q4_K_M.gguf"

echo "🚀 GenAI Mini Framework - Servidor llama.cpp Manager"
echo

# Verificar se llama-cpp-python está instalado
if ! python -c "import llama_cpp" 2>/dev/null; then
    log_error "llama-cpp-python não encontrado"
    echo "Instale com: pip install llama-cpp-python"
    exit 1
fi

# Verificar diretório de modelos
if [ ! -d "$MODELS_DIR" ]; then
    log_warning "Diretório $MODELS_DIR não encontrado"
    read -p "Especifique o caminho dos modelos: " MODELS_DIR
    
    if [ ! -d "$MODELS_DIR" ]; then
        log_error "Diretório não existe: $MODELS_DIR"
        exit 1
    fi
fi

log_info "Usando diretório de modelos: $MODELS_DIR"

# Função para verificar se modelo existe
check_model() {
    local model_path="$MODELS_DIR/$1"
    if [ ! -f "$model_path" ]; then
        log_warning "Modelo não encontrado: $model_path"
        return 1
    fi
    return 0
}

# Função para iniciar servidor
start_server() {
    local name=$1
    local port=$2
    local model=$3
    local model_path="$MODELS_DIR/$model"
    
    log_info "Iniciando servidor $name na porta $port..."
    
    # Verificar se porta está em uso
    if lsof -i :$port >/dev/null 2>&1; then
        log_warning "Porta $port já está em uso"
        read -p "Matar processo existente? (y/n): " KILL_EXISTING
        
        if [[ $KILL_EXISTING == "y" || $KILL_EXISTING == "Y" ]]; then
            fuser -k ${port}/tcp 2>/dev/null || true
            sleep 2
        else
            log_error "Porta $port não disponível"
            return 1
        fi
    fi
    
    # Iniciar servidor em background
    python -m llama_cpp.server \\
        --model "$model_path" \\
        --host 0.0.0.0 \\
        --port $port \\
        --n_gpu_layers -1 \\
        --n_ctx 4096 \\
        --n_batch 512 \\
        --verbose False > "${name}_server.log" 2>&1 &
    
    local pid=$!
    echo $pid > "${name}_server.pid"
    
    log_info "Servidor $name iniciado (PID: $pid)"
    
    # Aguardar inicialização
    log_info "Aguardando servidor $name ficar disponível..."
    local max_wait=60
    local wait_time=0
    
    while ! curl -s "http://localhost:$port/health" >/dev/null 2>&1; do
        if [ $wait_time -ge $max_wait ]; then
            log_error "Timeout aguardando servidor $name"
            kill $pid 2>/dev/null || true
            return 1
        fi
        
        sleep 2
        wait_time=$((wait_time + 2))
        echo -n "."
    done
    
    echo
    log_success "Servidor $name disponível em http://localhost:$port"
    return 0
}

# Função para parar servidores
stop_servers() {
    log_info "Parando servidores..."
    
    for name in "gerente" "analista" "programador"; do
        if [ -f "${name}_server.pid" ]; then
            local pid=$(cat "${name}_server.pid")
            if kill -0 $pid 2>/dev/null; then
                log_info "Parando servidor $name (PID: $pid)"
                kill $pid
                wait $pid 2>/dev/null || true
            fi
            rm -f "${name}_server.pid"
        fi
    done
    
    log_success "Servidores parados"
}

# Função para verificar status
check_status() {
    echo "📊 Status dos Servidores:"
    echo
    
    local servers=(
        "gerente:$GERENTE_PORT"
        "analista:$ANALISTA_PORT" 
        "programador:$PROGRAMADOR_PORT"
    )
    
    for server_info in "${servers[@]}"; do
        local name=${server_info%:*}
        local port=${server_info#*:}
        
        if curl -s "http://localhost:$port/health" >/dev/null 2>&1; then
            log_success "$name (porta $port) - ONLINE"
        else
            log_error "$name (porta $port) - OFFLINE"
        fi
    done
}

# Processar argumentos
case "${1:-start}" in
    "start")
        log_info "Iniciando todos os servidores..."
        
        # Verificar modelos
        models_ok=true
        for model in "$GERENTE_MODEL" "$ANALISTA_MODEL" "$PROGRAMADOR_MODEL"; do
            if ! check_model "$model"; then
                models_ok=false
            fi
        done
        
        if [ "$models_ok" = false ]; then
            echo
            log_warning "Alguns modelos não foram encontrados"
            echo "Modelos disponíveis em $MODELS_DIR:"
            ls -la "$MODELS_DIR"/*.gguf 2>/dev/null || echo "Nenhum arquivo .gguf encontrado"
            echo
            read -p "Continuar mesmo assim? (y/n): " CONTINUE
            if [[ $CONTINUE != "y" && $CONTINUE != "Y" ]]; then
                exit 1
            fi
        fi
        
        # Iniciar servidores
        start_server "gerente" $GERENTE_PORT "$GERENTE_MODEL"
        start_server "analista" $ANALISTA_PORT "$ANALISTA_MODEL"  
        start_server "programador" $PROGRAMADOR_PORT "$PROGRAMADOR_MODEL"
        
        echo
        log_success "Todos os servidores iniciados!"
        echo
        echo "📋 URLs dos servidores:"
        echo "  Gerente:     http://localhost:$GERENTE_PORT"
        echo "  Analista:    http://localhost:$ANALISTA_PORT" 
        echo "  Programador: http://localhost:$PROGRAMADOR_PORT"
        echo
        echo "📝 Logs em: gerente_server.log, analista_server.log, programador_server.log"
        echo "🛑 Para parar: $0 stop"
        ;;
        
    "stop")
        stop_servers
        ;;
        
    "status")
        check_status
        ;;
        
    "restart")
        stop_servers
        sleep 3
        exec $0 start
        ;;
        
    *)
        echo "Uso: $0 {start|stop|status|restart}"
        echo
        echo "Comandos:"
        echo "  start   - Inicia todos os servidores"
        echo "  stop    - Para todos os servidores"
        echo "  status  - Verifica status dos servidores"
        echo "  restart - Reinicia todos os servidores"
        exit 1
        ;;
esac
'''

with open('run_servers.sh', 'w') as f:
    f.write(run_servers_script)

# Tornar executável
os.chmod('run_servers.sh', 0o755)

print("✅ Script run_servers.sh criado com sucesso!")