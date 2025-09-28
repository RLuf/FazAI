#!/bin/bash
# Teste interativo para o worker FazAI com suporte a debug e cores

set -euo pipefail

# Cores para saída
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configurações
WORKER_BIN="/opt/fazai/bin/fazai-gemma-worker"
TEST_SOCKET="/tmp/fazai-prompt-test.sock"
LOG_FILE="/tmp/worker-test-$(date +%s).log"
MODEL_PATH="/opt/fazai/models/gemma/2.0-2b-it-sfp.sbs-org"

# Variáveis de controle
INTERACTIVE=0
PROMPT=""
FOREGROUND=0

# Função para exibir ajuda
show_help() {
    echo -e "${BLUE}Uso: $0 [OPÇÕES]${NC}"
    echo -e "Teste interativo para o worker FazAI com suporte a debug e cores\n"
    echo -e "Opções:"
    echo -e "  -f, --foreground  Executa o worker em primeiro plano com saída colorida"
    echo -e "  -i, --interactive Modo interativo para enviar múltiplos prompts"
    echo -e "  -p, --prompt TEXT Envia um único prompt e exibe a resposta"
    echo -e "  -h, --help        Mostra esta ajuda\n"
    echo -e "Exemplos:"
    echo -e "  ${YELLOW}$0 -f${NC}           # Executa em primeiro plano com cores"
    echo -e "  ${YELLOW}$0 -p "Olá"${NC}     # Envia um único prompt"
    echo -e "  ${YELLOW}$0 -i${NC}           # Modo interativo"
    exit 0
}

# Processa argumentos
while [[ $# -gt 0 ]]; do
    case $1 in
        -f|--foreground)
            FOREGROUND=1
            shift
            ;;
        -i|--interactive)
            INTERACTIVE=1
            shift
            ;;
        -p|--prompt)
            PROMPT="$2"
            shift 2
            ;;
        -h|--help)
            show_help
            ;;
        *)
            echo -e "${RED}Erro: Argumento inválido: $1${NC}"
            show_help
            ;;
    esac
done

# Verifica se o arquivo do modelo existe
if [ ! -f "$MODEL_PATH" ]; then
    echo -e "${RED}❌ Modelo não encontrado em: $MODEL_PATH${NC}"
    exit 1
fi

# Função para limpar recursos
cleanup() {
    echo -e "\n${BLUE}🔄 Limpando recursos...${NC}"
    
    # Encerra o worker se estiver rodando
    if [ -n "$WORKER_PID" ] && ps -p "$WORKER_PID" > /dev/null; then
        echo -e "${YELLOW}⏳ Encerrando worker (PID: $WORKER_PID)...${NC}"
        kill -TERM "$WORKER_PID" 2>/dev/null || true
        sleep 1
        
        # Força o encerramento se necessário
        if ps -p "$WORKER_PID" > /dev/null; then
            echo -e "${YELLOW}⏳ Forçando encerramento...${NC}"
            kill -9 "$WORKER_PID" 2>/dev/null || true
        fi
    fi
    
    # Remove o socket
    rm -f "$TEST_SOCKET"
    
    echo -e "${GREEN}✅ Limpeza concluída${NC}" 
}

# Configura o trap para limpeza ao sair
trap cleanup EXIT

# Inicializa o worker
start_worker() {
    echo -e "${BLUE}🚀 Iniciando worker...${NC}"
    
    # Configura as variáveis de ambiente
    export FAZAI_GEMMA_SOCKET="$TEST_SOCKET"
    export FAZAI_GEMMA_MODEL="$MODEL_PATH"
    
    # Limpa instâncias anteriores
    pkill -f "$WORKER_BIN" || true
    rm -f "$TEST_SOCKET"
    
    # Inicia o worker em foreground ou background
    if [ "$FOREGROUND" -eq 1 ]; then
        # Modo foreground com cores
        "$WORKER_BIN" | sed -u "s/^/\x1b[36m[WORKER] \x1b[0m/" &
        WORKER_PID=$!
    else
        # Modo background com log
        "$WORKER_BIN" > "$LOG_FILE" 2>&1 &
        WORKER_PID=$!
        echo -e "${GREEN}✅ Worker iniciado em background (PID: $WORKER_PID)${NC}"
        echo -e "Logs disponíveis em: $LOG_FILE"
    fi
    
    # Aguarda o socket ficar disponível
    echo -ne "${YELLOW}⏳ Aguardando socket...${NC}"
    for i in {1..10}; do
        if [ -S "$TEST_SOCKET" ]; then
            echo -e "\r${GREEN}✅ Socket pronto em: $TEST_SOCKET${NC}             "
            return 0
        fi
        echo -n "."
        sleep 1
    done
    
    echo -e "\n${RED}❌ Timeout ao aguardar socket${NC}"
    return 1
}

# Envia um comando para o worker e retorna a resposta
send_command() {
    local cmd="$1"
    local timeout="${2:-5}" # Timeout padrão de 5 segundos
    
    if [ ! -S "$TEST_SOCKET" ]; then
        echo -e "${RED}❌ Socket não encontrado: $TEST_SOCKET${NC}"
        return 1
    fi
    
    # Envia o comando e captura a resposta
    local response
    response=$(echo -e "$cmd" | nc -U -w "$timeout" "$TEST_SOCKET" 2>/dev/null || true)
    
    if [ -z "$response" ]; then
        echo -e "${YELLOW}⚠️  Nenhuma resposta recebida${NC}"
        return 1
    fi
    
    # Exibe a resposta formatada
    echo -e "${BLUE}📤 Enviado:${NC} $cmd"
    echo -e "${GREEN}📥 Resposta:${NC}\n$response"
    
    # Retorna a resposta para processamento posterior
    echo "$response"
}

# Cria uma nova sessão
create_session() {
    echo -e "\n${BLUE}🆕 Criando nova sessão...${NC}"
    
    local request='{"action": "create_session", "params": {"temperature": 0.7, "max_tokens": 500}}'
    local response
    
    response=$(send_command "$request" 10)
    
    # Extrai o ID da sessão
    local session_id
    session_id=$(echo "$response" | jq -r '.session_id // empty' 2>/dev/null)
    
    if [ -z "$session_id" ]; then
        echo -e "${RED}❌ Falha ao criar sessão${NC}"
        echo "Resposta: $response"
        return 1
    fi
    
    echo -e "${GREEN}✅ Sessão criada: $session_id${NC}"
    echo "$session_id"
}

# Envia um prompt para geração
generate_text() {
    local session_id="$1"
    local prompt="$2"
    
    echo -e "\n${BLUE}💬 Enviando prompt:${NC} $prompt"
    
    local request='{"action": "generate", "session_id": "'$session_id'", "prompt": "'${prompt//"/\\"}'"}'
    
    # Envia o comando e processa a resposta em tempo real
    echo -e "${YELLOW}⏳ Gerando resposta...${NC}"
    send_command "$request" 30
}

# Loop interativo
interactive_loop() {
    echo -e "\n${GREEN}✨ Modo interativo ativado (Ctrl+C para sair)${NC}"
    
    # Cria uma nova sessão
    local session_id
    session_id=$(create_session)
    
    if [ -z "$session_id" ]; then
        echo -e "${RED}❌ Não foi possível iniciar a sessão interativa${NC}"
        return 1
    fi
    
    # Loop principal
    while true; do
        echo -e "\n${BLUE}❔ Digite sua pergunta (ou 'sair' para encerrar):${NC}"
        read -r user_prompt
        
        # Verifica se o usuário quer sair
        if [[ "$user_prompt" =~ ^(sair|exit|quit|q)$ ]]; then
            echo -e "${YELLOW}👋 Encerrando sessão interativa...${NC}"
            break
        fi
        
        # Envia o prompt para geração
        generate_text "$session_id" "$user_prompt"
    done
    
    # Fecha a sessão
    echo -e "\n${BLUE}🚪 Fechando sessão...${NC}"
    send_command '{"action": "close_session", "session_id": "'$session_id'"}' 5
}

# Fluxo principal
main() {
    # Inicia o worker
    if ! start_worker; then
        echo -e "${RED}❌ Falha ao iniciar o worker${NC}"
        exit 1
    fi
    
    # Modo de operação baseado nos argumentos
    if [ -n "$PROMPT" ]; then
        # Modo de prompt único
        echo -e "\n${BLUE}📝 Modo de prompt único${NC}"
        session_id=$(create_session)
        if [ -n "$session_id" ]; then
            generate_text "$session_id" "$PROMPT"
            send_command '{"action": "close_session", "session_id": "'$session_id'"}' 5
        fi
    elif [ "$INTERACTIVE" -eq 1 ]; then
        # Modo interativo
        interactive_loop
    else
        # Modo padrão: teste rápido
        echo -e "\n${BLUE}🔍 Executando teste rápido...${NC}"
        session_id=$(create_session)
        if [ -n "$session_id" ]; then
            generate_text "$session_id" "Explique em uma frase o que é inteligência artificial."
            send_command '{"action": "close_session", "session_id": "'$session_id'"}' 5
        fi
    fi
}

# Executa o fluxo principal
main
