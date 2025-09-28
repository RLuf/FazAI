#!/bin/bash

# Test para o Completion Verification Agent
# Versão: 1.0

set -e

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"
AGENT_SCRIPT="$REPO_ROOT/opt/fazai/tools/completion_verification_agent.sh"

# Função de teste
test_log() {
    local level=$1
    local message=$2
    case $level in
        "PASS")
            echo -e "${GREEN}[PASS]${NC} $message"
            ;;
        "FAIL")
            echo -e "${RED}[FAIL]${NC} $message"
            ;;
        "INFO")
            echo -e "${BLUE}[INFO]${NC} $message"
            ;;
    esac
}

# Teste 1: Verifica se o script existe e é executável
test_agent_exists() {
    test_log "INFO" "Testando existência do agente..."
    
    if [[ -f "$AGENT_SCRIPT" ]]; then
        test_log "PASS" "Agente encontrado em $AGENT_SCRIPT"
    else
        test_log "FAIL" "Agente não encontrado em $AGENT_SCRIPT"
        return 1
    fi
    
    if [[ -x "$AGENT_SCRIPT" ]]; then
        test_log "PASS" "Agente é executável"
    else
        test_log "FAIL" "Agente não é executável"
        return 1
    fi
    
    return 0
}

# Teste 2: Verifica se a ajuda funciona
test_agent_help() {
    test_log "INFO" "Testando comando de ajuda..."
    
    if "$AGENT_SCRIPT" help >/dev/null 2>&1; then
        test_log "PASS" "Comando help funciona"
    else
        test_log "FAIL" "Comando help falhou"
        return 1
    fi
    
    return 0
}

# Teste 3: Verifica se o script de completion fonte existe
test_source_completion_exists() {
    test_log "INFO" "Testando existência do script de completion fonte..."
    
    local source_script="$REPO_ROOT/etc/fazai/fazai-completion.sh"
    
    if [[ -f "$source_script" ]]; then
        test_log "PASS" "Script de completion fonte encontrado"
    else
        test_log "FAIL" "Script de completion fonte não encontrado em $source_script"
        return 1
    fi
    
    # Verifica conteúdo básico
    if grep -q "_fazai_completions" "$source_script"; then
        test_log "PASS" "Script contém função _fazai_completions"
    else
        test_log "FAIL" "Script não contém função _fazai_completions"
        return 1
    fi
    
    return 0
}

# Teste 4: Testa funcionalidade de verificação (sem privilégios de root)
test_agent_check_no_root() {
    test_log "INFO" "Testando verificação sem privilégios de root..."
    
    # Este teste vai falhar porque não temos /etc/bash_completion.d/fazai
    # mas deve executar sem erro fatal
    if "$AGENT_SCRIPT" check >/dev/null 2>&1; then
        test_log "INFO" "Verificação executou (pode ter encontrado problemas, mas não falhou fatalmente)"
    else
        local exit_code=$?
        if [[ $exit_code -eq 1 ]]; then
            test_log "PASS" "Verificação executou e detectou problemas conforme esperado"
        else
            test_log "FAIL" "Verificação falhou com código inesperado: $exit_code"
            return 1
        fi
    fi
    
    return 0
}

# Teste 5: Testa se o script pode gerar completion de fallback
test_agent_can_generate_fallback() {
    test_log "INFO" "Testando capacidade de gerar fallback..."
    
    # Cria diretório temporário para teste
    local temp_dir=$(mktemp -d)
    local temp_completion="$temp_dir/fazai"
    
    # Modifica temporariamente o agente para usar diretório de teste
    export FALLBACK_COMPLETION_DIR="$temp_dir"
    
    # Executa reparo (que deve gerar fallback se não encontrar fonte)
    if COMPLETION_SCRIPT="$temp_completion" SOURCE_COMPLETION="/path/inexistente" "$AGENT_SCRIPT" repair >/dev/null 2>&1; then
        if [[ -f "$temp_completion" ]]; then
            test_log "PASS" "Agente gerou script de fallback com sucesso"
        else
            test_log "FAIL" "Agente não gerou script de fallback"
            rm -rf "$temp_dir"
            return 1
        fi
    else
        test_log "FAIL" "Agente falhou ao executar reparo"
        rm -rf "$temp_dir"
        return 1
    fi
    
    # Limpa
    rm -rf "$temp_dir"
    return 0
}

# Teste 6: Verifica se completion funciona quando carregado
test_completion_loading() {
    test_log "INFO" "Testando carregamento do script de completion..."
    
    local source_script="$REPO_ROOT/etc/fazai/fazai-completion.sh"
    
    # Tenta carregar o script
    if source "$source_script" 2>/dev/null; then
        test_log "PASS" "Script de completion carregou sem erros"
    else
        test_log "FAIL" "Erro ao carregar script de completion"
        return 1
    fi
    
    # Verifica se função foi registrada
    if complete -p fazai >/dev/null 2>&1; then
        test_log "PASS" "Completion para 'fazai' registrado com sucesso"
    else
        test_log "FAIL" "Completion para 'fazai' não foi registrado"
        return 1
    fi
    
    return 0
}

# Função principal de teste
run_all_tests() {
    echo "=== Testes do Completion Verification Agent ==="
    echo ""
    
    local tests_passed=0
    local tests_total=0
    
    # Lista de testes
    local test_functions=(
        "test_agent_exists"
        "test_agent_help"
        "test_source_completion_exists"
        "test_agent_check_no_root"
        "test_agent_can_generate_fallback"
        "test_completion_loading"
    )
    
    for test_func in "${test_functions[@]}"; do
        ((tests_total++))
        echo ""
        if $test_func; then
            ((tests_passed++))
        fi
    done
    
    echo ""
    echo "=== Resumo dos Testes ==="
    echo "Passou: $tests_passed/$tests_total testes"
    
    if [[ $tests_passed -eq $tests_total ]]; then
        test_log "PASS" "Todos os testes passaram!"
        return 0
    else
        test_log "FAIL" "Alguns testes falharam"
        return 1
    fi
}

# Executa testes se chamado diretamente
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    run_all_tests
fi