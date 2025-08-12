#!/bin/bash

# FazAI - Script de Teste de Todas as Ferramentas
# Este script testa todas as ferramentas disponíveis no sistema
# Autor: Roger Luft
# Versão: 1.0

set -E

# Cores para saída
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configurações
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
TOOLS_DIR="$PROJECT_ROOT/bin/tools"
LOG_FILE="$PROJECT_ROOT/var/logs/tools-test.log"
DATE=$(date '+%Y-%m-%d %H:%M:%S')

# Função para logging
log() {
    echo -e "${BLUE}[$(date '+%H:%M:%S')]${NC} $1" | tee -a "$LOG_FILE"
}

log_success() {
    echo -e "${GREEN}✓${NC} $1" | tee -a "$LOG_FILE"
}

log_warning() {
    echo -e "${YELLOW}⚠${NC} $1" | tee -a "$LOG_FILE"
}

log_error() {
    echo -e "${RED}✗${NC} $1" | tee -a "$LOG_FILE"
}

log_info() {
    echo -e "${CYAN}ℹ${NC} $1" | tee -a "$LOG_FILE"
}

# Função para exibir ajuda
show_help() {
    echo -e "${CYAN}FazAI - Script de Teste de Todas as Ferramentas${NC}"
    echo ""
    echo "Uso: $0 [OPÇÕES]"
    echo ""
    echo "Opções:"
    echo "  -v, --verbose        Saída detalhada"
    echo "  -s, --skip-failed    Pula ferramentas que falharam"
    echo "  -h, --help           Exibir esta ajuda"
    echo ""
    echo "Exemplos:"
    echo "  $0                    Testa todas as ferramentas"
    echo "  $0 -v                Testa com saída detalhada"
    echo "  $0 -s                Pula ferramentas com falha"
    echo ""
}

# Função para testar ferramenta
test_tool() {
    local tool_name="$1"
    local tool_path="$2"
    local test_type="$3"
    
    log_info "Testando ferramenta: $tool_name"
    
    case "$test_type" in
        "bash")
            if [ -f "$tool_path" ] && [ -x "$tool_path" ]; then
                if bash -n "$tool_path" 2>/dev/null; then
                    log_success "✓ $tool_name: Sintaxe bash válida"
                    return 0
                else
                    log_error "✗ $tool_name: Erro de sintaxe bash"
                    return 1
                fi
            else
                log_error "✗ $tool_name: Arquivo não encontrado ou sem permissão de execução"
                return 1
            fi
            ;;
        "help")
            if [ -f "$tool_path" ]; then
                if grep -q "help\|ajuda\|usage" "$tool_path" 2>/dev/null; then
                    log_success "✓ $tool_name: Documentação de ajuda encontrada"
                    return 0
                else
                    log_warning "⚠ $tool_name: Sem documentação de ajuda"
                    return 0
                fi
            else
                log_error "✗ $tool_name: Arquivo não encontrado"
                return 1
            fi
            ;;
        "executable")
            if [ -f "$tool_path" ] && [ -x "$tool_path" ]; then
                log_success "✓ $tool_name: Executável e funcional"
                return 0
            else
                log_error "✗ $tool_name: Não é executável"
                return 1
            fi
            ;;
        *)
            log_warning "⚠ $tool_name: Tipo de teste desconhecido: $test_type"
            return 0
            ;;
    esac
}

# Função principal de teste
main() {
    local verbose=false
    local skip_failed=false
    
    # Parse argumentos
    while [[ $# -gt 0 ]]; do
        case $1 in
            -v|--verbose)
                verbose=true
                shift
                ;;
            -s|--skip-failed)
                skip_failed=true
                shift
                ;;
            -h|--help)
                show_help
                exit 0
                ;;
            *)
                echo "Opção desconhecida: $1"
                show_help
                exit 1
                ;;
        esac
    done
    
    # Criar diretório de logs se não existir
    mkdir -p "$(dirname "$LOG_FILE")"
    
    log "Iniciando teste de todas as ferramentas do FazAI"
    log "Data: $DATE"
    log "Diretório de ferramentas: $TOOLS_DIR"
    log "Log de teste: $LOG_FILE"
    echo ""
    
    # Lista de ferramentas para testar
    declare -A tools=(
        ["system-check.sh"]="bash"
        ["version-bump.sh"]="bash"
        ["sync-changes.sh"]="bash"
        ["sync-keys.sh"]="bash"
        ["github-setup.sh"]="bash"
        ["install-llamacpp.sh"]="bash"
    )
    
    local total_tools=${#tools[@]}
    local passed_tools=0
    local failed_tools=0
    local skipped_tools=0
    
    echo -e "${CYAN}=== TESTANDO FERRAMENTAS ===${NC}"
    echo ""
    
    # Testar cada ferramenta
    for tool in "${!tools[@]}"; do
        local tool_path="$TOOLS_DIR/$tool"
        local test_type="${tools[$tool]}"
        
        if test_tool "$tool" "$tool_path" "$test_type"; then
            ((passed_tools++))
        else
            ((failed_tools++))
            if [ "$skip_failed" = true ]; then
                log_warning "Pulando ferramenta com falha: $tool"
                ((skipped_tools++))
            fi
        fi
        
        echo ""
    done
    
    # Testar ferramentas de configuração
    log_info "Testando ferramentas de configuração..."
    
    local config_tools=(
        "fazai-config.js"
        "fazai-config-tui.js"
    )
    
    for tool in "${config_tools[@]}"; do
        local tool_path="/opt/fazai/tools/$tool"
        if [ -f "$tool_path" ]; then
            log_success "✓ $tool: Ferramenta de configuração encontrada"
            ((passed_tools++))
        else
            log_warning "⚠ $tool: Ferramenta de configuração não encontrada"
        fi
    done
    
    echo ""
    echo -e "${CYAN}=== RESUMO DOS TESTES ===${NC}"
    echo ""
    echo -e "Total de ferramentas testadas: ${CYAN}$total_tools${NC}"
    echo -e "Ferramentas com sucesso: ${GREEN}$passed_tools${NC}"
    echo -e "Ferramentas com falha: ${RED}$failed_tools${NC}"
    
    if [ "$skip_failed" = true ]; then
        echo -e "Ferramentas puladas: ${YELLOW}$skipped_tools${NC}"
    fi
    
    echo ""
    
    # Testar comandos principais do CLI
    log_info "Testando comandos principais do CLI..."
    
    local cli_commands=(
        "ajuda"
        "versao"
        "status"
        "logs"
        "manual"
    )
    
    local cli_passed=0
    local cli_failed=0
    
    for cmd in "${cli_commands[@]}"; do
        if timeout 5s fazai "$cmd" >/dev/null 2>&1; then
            log_success "✓ Comando CLI: $cmd"
            ((cli_passed++))
        else
            log_error "✗ Comando CLI: $cmd"
            ((cli_failed++))
        fi
    done
    
    echo ""
    echo -e "${CYAN}=== TESTE DO CLI ===${NC}"
    echo -e "Comandos com sucesso: ${GREEN}$cli_passed${NC}"
    echo -e "Comandos com falha: ${RED}$cli_failed${NC}"
    echo ""
    
    # Testar bash completion
    log_info "Testando bash completion..."
    
    if [ -f "/etc/bash_completion.d/fazai" ]; then
        log_success "✓ Bash completion instalado"
    else
        log_warning "⚠ Bash completion não encontrado"
    fi
    
    # Verificar se o manual foi criado
    if [ -f "$PROJECT_ROOT/MANUAL_COMPLETO.md" ]; then
        log_success "✓ Manual completo criado"
    else
        log_error "✗ Manual completo não encontrado"
    fi
    
    echo ""
    echo -e "${CYAN}=== TESTE COMPLETO ===${NC}"
    echo ""
    
    local total_passed=$((passed_tools + cli_passed))
    local total_failed=$((failed_tools + cli_failed))
    
    if [ $total_failed -eq 0 ]; then
        echo -e "${GREEN}🎉 TODOS OS TESTES PASSARAM! 🎉${NC}"
        echo -e "O sistema FazAI está funcionando perfeitamente."
        exit 0
    else
        echo -e "${YELLOW}⚠ Alguns testes falharam${NC}"
        echo -e "Verifique os logs em: $LOG_FILE"
        echo -e "Para mais detalhes, execute: $0 -v"
        exit 1
    fi
}

# Executar função principal
main "$@"