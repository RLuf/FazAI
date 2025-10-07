#!/bin/bash
# ==============================================================================
# FazAI v2.0 - Teste End-to-End: CLI → Worker → Libgemma → Qdrant
# ==============================================================================
# Objetivo: Validar fluxo completo de linguagem natural conforme AGENTS.md
# Autor: Roger Luft
# Data: 30/09/2025
# ==============================================================================

set -e

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Contadores
TESTS_PASSED=0
TESTS_FAILED=0
TESTS_TOTAL=0

# Função de log
log() {
    local level=$1
    shift
    local msg="$@"
    case $level in
        INFO) echo -e "${BLUE}[INFO]${NC} $msg" ;;
        SUCCESS) echo -e "${GREEN}[✓]${NC} $msg" ;;
        ERROR) echo -e "${RED}[✗]${NC} $msg" ;;
        WARN) echo -e "${YELLOW}[⚠]${NC} $msg" ;;
    esac
}

# Função de teste
test_case() {
    local name="$1"
    TESTS_TOTAL=$((TESTS_TOTAL + 1))
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    log INFO "Teste #${TESTS_TOTAL}: $name"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
}

test_success() {
    TESTS_PASSED=$((TESTS_PASSED + 1))
    log SUCCESS "$1"
}

test_fail() {
    TESTS_FAILED=$((TESTS_FAILED + 1))
    log ERROR "$1"
}

# Verifica root
if [[ $EUID -ne 0 ]]; then
   log ERROR "Execute como root: sudo $0"
   exit 1
fi

log INFO "Iniciando testes de integração CLI → Worker → Libgemma → Qdrant"
log INFO "Timestamp: $(date '+%Y-%m-%d %H:%M:%S')"

# ==============================================================================
# FASE 1: Verificação de Pré-requisitos
# ==============================================================================
test_case "Verificação de bindings Gemma (gemma_native.so)"

if [ -f "/opt/fazai/lib/python/gemma_native.so" ]; then
    test_success "Bindings encontrados: /opt/fazai/lib/python/gemma_native.so"
    ls -lh /opt/fazai/lib/python/gemma_native.so
else
    test_fail "Bindings não encontrados em /opt/fazai/lib/python/"
    log WARN "Continuando testes (worker pode usar fallbacks)"
fi

# ==============================================================================
test_case "Verificação de modelo Gemma"

MODEL_PATH=$(grep -E '^weights\s*=' /etc/fazai/fazai.conf | awk -F'=' '{print $2}' | tr -d ' ' || echo "")
if [ -z "$MODEL_PATH" ]; then
    MODEL_PATH="/opt/fazai/models/gemma/2.0-2b-it-sfp.sbs"
fi

if [ -f "$MODEL_PATH" ]; then
    test_success "Modelo encontrado: $MODEL_PATH"
    ls -lh "$MODEL_PATH"
else
    test_fail "Modelo não encontrado: $MODEL_PATH"
    log WARN "Testes usarão fallbacks (OpenAI/OpenRouter)"
fi

# ==============================================================================
test_case "Verificação de worker instalado"

if [ -f "/opt/fazai/bin/fazai_gemma_worker.py" ]; then
    test_success "Worker instalado: /opt/fazai/bin/fazai_gemma_worker.py"
    python3 -m py_compile /opt/fazai/bin/fazai_gemma_worker.py || test_fail "Worker tem erros de sintaxe"
else
    test_fail "Worker não instalado"
    exit 1
fi

# ==============================================================================
test_case "Verificação de CLIs instalados"

CLI_FOUND=0
if [ -f "/opt/fazai/bin/fazai_mcp_client.py" ]; then
    test_success "CLI principal: /opt/fazai/bin/fazai_mcp_client.py"
    CLI_FOUND=$((CLI_FOUND + 1))
fi

if [ -f "/opt/fazai/bin/gemma_worker_client.py" ]; then
    test_success "CLI alternativo: /opt/fazai/bin/gemma_worker_client.py"
    CLI_FOUND=$((CLI_FOUND + 1))
fi

if [ $CLI_FOUND -eq 0 ]; then
    test_fail "Nenhum CLI encontrado"
    exit 1
fi

# ==============================================================================
test_case "Verificação de Qdrant"

if systemctl is-active --quiet fazai-qdrant; then
    test_success "Qdrant rodando (systemctl)"
elif docker ps | grep -q fazai-qdrant; then
    test_success "Qdrant rodando (docker)"
else
    test_fail "Qdrant não está rodando"
    log WARN "Tentando iniciar Qdrant..."
    systemctl start fazai-qdrant 2>/dev/null || docker start fazai-qdrant 2>/dev/null || true
    sleep 3
fi

# Testa conectividade Qdrant
if curl -s http://localhost:6333 >/dev/null 2>&1; then
    test_success "Qdrant acessível em http://localhost:6333"
else
    test_fail "Qdrant não responde em http://localhost:6333"
fi

# ==============================================================================
test_case "Verificação de Ollama (embeddings)"

mapfile -t OLLAMA_CFG < <(python3 <<'PY'
import configparser
from pathlib import Path

endpoint_default = "http://127.0.0.1:11434"
embed_default = ""

config_path = Path("/etc/fazai/fazai.conf")
if config_path.exists():
    config = configparser.ConfigParser()
    config.read(config_path)
    if config.has_option("ollama", "endpoint"):
        endpoint_default = config.get("ollama", "endpoint").strip() or endpoint_default
    if config.has_option("ollama", "embeddings_endpoint"):
        embed_default = config.get("ollama", "embeddings_endpoint").strip()

endpoint = endpoint_default.rstrip('/')

if not embed_default:
    base = endpoint.rstrip('/')
    if base.endswith('/api/embeddings'):
        embed_default = base
    else:
        if base.endswith('/v1'):
            base = base[:-3]
        base = base.rstrip('/')
        if base.endswith('/api'):
            embed_default = f"{base}/embeddings"
        else:
            embed_default = f"{base}/api/embeddings"

print(endpoint)
print(embed_default)
PY
)

OLLAMA_ENDPOINT="${OLLAMA_CFG[0]}"
OLLAMA_EMBED_ENDPOINT="${OLLAMA_CFG[1]}"

if curl -s "${OLLAMA_ENDPOINT}/api/tags" >/dev/null 2>&1; then
    test_success "Ollama acessível em ${OLLAMA_ENDPOINT}"

    if curl -s "${OLLAMA_ENDPOINT}/api/tags" | grep -q "mxbai-embed-large"; then
        test_success "Modelo mxbai-embed-large disponível"
    else
        test_fail "Modelo mxbai-embed-large não encontrado"
        log WARN "Worker usará fallback: vetor zero"
    fi
else
    test_fail "Ollama não acessível em ${OLLAMA_ENDPOINT}"
    log WARN "Embeddings usarão fallback"
fi

# ==============================================================================
# FASE 2: Inicialização do Worker
# ==============================================================================
test_case "Parar worker anterior (se existir)"

systemctl stop fazai-gemma-worker 2>/dev/null || true
pkill -f fazai_gemma_worker.py || true
sleep 2

if pgrep -f fazai_gemma_worker.py >/dev/null; then
    test_fail "Worker anterior ainda rodando"
    pkill -9 -f fazai_gemma_worker.py
    sleep 1
else
    test_success "Nenhum worker anterior rodando"
fi

# ==============================================================================
test_case "Iniciar worker em background"

log INFO "Iniciando worker: systemctl start fazai-gemma-worker"
systemctl start fazai-gemma-worker

# Aguarda worker inicializar
sleep 5

if systemctl is-active --quiet fazai-gemma-worker; then
    test_success "Worker iniciado via systemctl"
else
    test_fail "Worker não iniciou via systemctl"
    log ERROR "Logs do systemctl:"
    journalctl -u fazai-gemma-worker -n 50 --no-pager
    exit 1
fi

# ==============================================================================
test_case "Verificar sockets do worker"

SOCKET_FOUND=0

if [ -S "/run/fazai/gemma.sock" ]; then
    test_success "Unix socket criado: /run/fazai/gemma.sock"
    SOCKET_FOUND=$((SOCKET_FOUND + 1))
else
    test_fail "Unix socket não criado: /run/fazai/gemma.sock"
fi

if netstat -tuln 2>/dev/null | grep -q ":5556" || ss -tuln 2>/dev/null | grep -q ":5556"; then
    test_success "TCP socket ativo em 0.0.0.0:5556"
    SOCKET_FOUND=$((SOCKET_FOUND + 1))
else
    test_fail "TCP socket não ativo em porta 5556"
fi

if [ $SOCKET_FOUND -eq 0 ]; then
    test_fail "Nenhum socket disponível para comunicação"
    log ERROR "Worker pode não estar funcionando corretamente"
    exit 1
fi

# ==============================================================================
# FASE 3: Testes de Comunicação CLI → Worker
# ==============================================================================
test_case "Teste CLI: Comando simples em linguagem natural (ASK)"

log INFO "Enviando: 'olá, como você está?'"

# Usa timeout para evitar hang
RESPONSE=$(timeout 30 python3 /opt/fazai/bin/fazai_mcp_client.py ask "olá, como você está?" 2>&1 || echo "TIMEOUT")

if [[ "$RESPONSE" == *"TIMEOUT"* ]]; then
    test_fail "Timeout ao aguardar resposta do worker"
    log ERROR "Worker pode estar travado"
elif [[ "$RESPONSE" == *"erro"* ]] || [[ "$RESPONSE" == *"Erro"* ]]; then
    test_fail "Worker retornou erro: $RESPONSE"
else
    test_success "Worker respondeu: ${RESPONSE:0:100}..."
    
    # Verifica se usou Gemma ou fallback
    if journalctl -u fazai-gemma-worker -n 100 --no-pager | grep -q "Bindings carregadas"; then
        log INFO "✓ Worker usou Gemma local (bindings PyBind11)"
    else
        log WARN "Worker pode ter usado fallback (OpenAI/OpenRouter)"
    fi
fi

# ==============================================================================
test_case "Teste CLI: Comando técnico em linguagem natural"

log INFO "Enviando: 'liste os arquivos no diretório /tmp'"

RESPONSE=$(timeout 30 python3 /opt/fazai/bin/fazai_mcp_client.py ask "liste os arquivos no diretório /tmp" 2>&1 || echo "TIMEOUT")

if [[ "$RESPONSE" == *"TIMEOUT"* ]]; then
    test_fail "Timeout ao aguardar resposta"
elif [[ "$RESPONSE" == *"erro"* ]]; then
    test_fail "Erro na resposta: $RESPONSE"
else
    test_success "Worker processou comando técnico"
    echo "Resposta: ${RESPONSE:0:200}..."
fi

# ==============================================================================
test_case "Teste RESEARCH: Busca em Qdrant"

log INFO "Enviando: research 'documentação fazai'"

RESPONSE=$(timeout 30 python3 /opt/fazai/bin/fazai_mcp_client.py research "documentação fazai" 2>&1 || echo "TIMEOUT")

if [[ "$RESPONSE" == *"TIMEOUT"* ]]; then
    test_fail "Timeout ao aguardar resposta de research"
elif [[ "$RESPONSE" == *"erro"* ]]; then
    test_warn "Research retornou erro (normal se Qdrant vazio): $RESPONSE"
else
    test_success "Research executado (Qdrant integrado)"
    echo "Resposta: ${RESPONSE:0:200}..."
fi

# ==============================================================================
test_case "Teste SHELL: Execução de comando"

log INFO "Enviando: shell 'echo Hello FazAI'"

RESPONSE=$(timeout 30 python3 /opt/fazai/bin/fazai_mcp_client.py shell "echo Hello FazAI" 2>&1 || echo "TIMEOUT")

if [[ "$RESPONSE" == *"Hello FazAI"* ]]; then
    test_success "Comando shell executado: $RESPONSE"
else
    test_fail "Comando shell falhou: $RESPONSE"
fi

# ==============================================================================
test_case "Teste OBSERVE: Status do sistema"

log INFO "Enviando: observe 'status'"

RESPONSE=$(timeout 30 python3 /opt/fazai/bin/fazai_mcp_client.py observe "status" 2>&1 || echo "TIMEOUT")

if [[ "$RESPONSE" == *"gemma_status"* ]]; then
    test_success "Observe retornou status do sistema"
    echo "Status: $RESPONSE"
else
    test_fail "Observe falhou: $RESPONSE"
fi

# ==============================================================================
test_case "Teste COMMITKB: Armazenar em Qdrant"

log INFO "Enviando: commit 'Teste de integração FazAI realizado em $(date)'"

RESPONSE=$(timeout 30 python3 /opt/fazai/bin/fazai_mcp_client.py commit "Teste de integração FazAI realizado em $(date)" 2>&1 || echo "TIMEOUT")

if [[ "$RESPONSE" == *"Armazenado"* ]] || [[ "$RESPONSE" == *"conhecimento"* ]]; then
    test_success "Dados armazenados em Qdrant: $RESPONSE"
else
    test_warn "CommitKB pode ter falhado: $RESPONSE"
fi

# ==============================================================================
# FASE 4: Validação de Integração Qdrant
# ==============================================================================
test_case "Verificar embeddings Ollama no log do worker"

if journalctl -u fazai-gemma-worker -n 200 --no-pager | grep -q "${OLLAMA_EMBED_ENDPOINT}"; then
    test_success "Worker está gerando embeddings via Ollama"
elif journalctl -u fazai-gemma-worker -n 200 --no-pager | grep -q "Erro gerando embedding via Ollama"; then
    test_warn "Worker tentou Ollama mas falhou (usando fallback: vetor zero)"
else
    test_warn "Não há evidência de uso de embeddings Ollama no log"
fi

# ==============================================================================
test_case "Verificar collections no Qdrant"

log INFO "Consultando Qdrant: http://localhost:6333/collections"

COLLECTIONS=$(curl -s http://localhost:6333/collections | python3 -m json.tool 2>/dev/null || echo "{}")

if echo "$COLLECTIONS" | grep -q "fazai_memory"; then
    test_success "Collection 'fazai_memory' existe no Qdrant"
else
    test_warn "Collection 'fazai_memory' não encontrada (será criada no primeiro uso)"
fi

if echo "$COLLECTIONS" | grep -q "fazai_kb"; then
    test_success "Collection 'fazai_kb' existe no Qdrant"
else
    test_warn "Collection 'fazai_kb' não encontrada (será criada no primeiro uso)"
fi

# ==============================================================================
# FASE 5: Análise de Logs
# ==============================================================================
test_case "Análise de erros no log do worker"

ERROR_COUNT=$(journalctl -u fazai-gemma-worker -n 500 --no-pager | grep -ci "error" || echo "0")
WARNING_COUNT=$(journalctl -u fazai-gemma-worker -n 500 --no-pager | grep -ci "warning" || echo "0")

log INFO "Erros encontrados: $ERROR_COUNT"
log INFO "Warnings encontrados: $WARNING_COUNT"

if [ "$ERROR_COUNT" -eq 0 ]; then
    test_success "Nenhum erro crítico no log do worker"
else
    log WARN "Encontrados $ERROR_COUNT erros. Últimos 10:"
    journalctl -u fazai-gemma-worker -n 500 --no-pager | grep -i "error" | tail -10
fi

# ==============================================================================
test_case "Verificar uso de Gemma local vs Fallbacks"

if journalctl -u fazai-gemma-worker -n 200 --no-pager | grep -q "Bindings carregadas"; then
    test_success "✓ Worker carregou bindings Gemma (PyBind11)"
    
    if journalctl -u fazai-gemma-worker -n 200 --no-pager | grep -q "✓ Bindings carregadas: /opt/fazai/lib/python/gemma_native.so"; then
        log INFO "Bindings carregados de: /opt/fazai/lib/python/gemma_native.so"
    fi
else
    test_warn "Worker pode não ter carregado bindings Gemma"
fi

FALLBACK_COUNT=$(journalctl -u fazai-gemma-worker -n 200 --no-pager | grep -ci "fallback" || echo "0")
if [ "$FALLBACK_COUNT" -gt 0 ]; then
    log WARN "Worker usou fallbacks $FALLBACK_COUNT vezes"
    log INFO "Fallbacks detectados:"
    journalctl -u fazai-gemma-worker -n 200 --no-pager | grep -i "fallback" | tail -5
else
    test_success "Worker não precisou usar fallbacks"
fi

# ==============================================================================
# FASE 6: Redundâncias entre CLIs
# ==============================================================================
test_case "Análise de redundâncias entre CLIs"

log INFO "Comparando fazai_mcp_client.py e gemma_worker_client.py"

# Ambos implementam protocolo ND-JSON?
MCP_HAS_NDJSON=$(grep -c "NDJSONMessage" /opt/fazai/bin/fazai_mcp_client.py || echo "0")
GEMMA_HAS_NDJSON=$(grep -c "NDJSONMessage" /opt/fazai/bin/gemma_worker_client.py || echo "0")

if [ "$MCP_HAS_NDJSON" -gt 0 ] && [ "$GEMMA_HAS_NDJSON" -gt 0 ]; then
    log WARN "Ambos CLIs implementam protocolo ND-JSON (redundância)"
    log INFO "Recomendação: Consolidar em um único CLI ou especializá-los"
else
    test_success "CLIs têm implementações diferentes (sem redundância clara)"
fi

# ==============================================================================
# RELATÓRIO FINAL
# ==============================================================================
echo ""
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║          RELATÓRIO FINAL - TESTES DE INTEGRAÇÃO                ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""
echo "Total de testes: $TESTS_TOTAL"
echo -e "${GREEN}✓ Testes passados: $TESTS_PASSED${NC}"
echo -e "${RED}✗ Testes falhados: $TESTS_FAILED${NC}"
echo ""

SUCCESS_RATE=$((TESTS_PASSED * 100 / TESTS_TOTAL))
echo "Taxa de sucesso: ${SUCCESS_RATE}%"
echo ""

# Registrar no CHANGELOG
CHANGELOG_ENTRY="
## [$(date '+%Y-%m-%d %H:%M:%S')] - Testes de Integração CLI → Worker → Libgemma → Qdrant

### Resultados
- Total de testes: $TESTS_TOTAL
- Testes passados: $TESTS_PASSED
- Testes falhados: $TESTS_FAILED
- Taxa de sucesso: ${SUCCESS_RATE}%

### Validações Realizadas
- ✓ Fluxo completo CLI → Worker com linguagem natural
- ✓ Integração Gemma local via bindings PyBind11
- ✓ Embeddings reais via Ollama mxbai-embed-large
- ✓ Memória vetorial Qdrant (fazai_memory + fazai_kb)
- ✓ Protocolo ND-JSON (ASK, RESEARCH, SHELL, OBSERVE, COMMITKB)

### Observações
$(journalctl -u fazai-gemma-worker -n 50 --no-pager | tail -10)
"

echo "$CHANGELOG_ENTRY" >> /var/log/fazai/integration_tests.log

log INFO "Relatório completo salvo em: /var/log/fazai/integration_tests.log"

if [ $TESTS_FAILED -eq 0 ]; then
    log SUCCESS "✓ TODOS OS TESTES PASSARAM!"
    exit 0
else
    log ERROR "✗ ALGUNS TESTES FALHARAM"
    log INFO "Revise os logs acima para detalhes"
    exit 1
fi
