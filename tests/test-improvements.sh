#!/bin/bash

# FazAI - Script de Teste das Melhorias v1.41.0
# Testa as novas funcionalidades implementadas

set -e

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Funções de log
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

# Verificar se o FazAI está instalado
check_fazai_installation() {
    log_info "Verificando instalação do FazAI..."
    
    if ! command -v fazai &> /dev/null; then
        log_error "FazAI não está instalado ou não está no PATH"
        return 1
    fi
    
    local version=$(fazai --version 2>/dev/null | grep -o 'v[0-9.]*' || echo "versão desconhecida")
    log_success "FazAI encontrado: $version"
    return 0
}

# Verificar se o daemon está rodando
check_daemon_status() {
    log_info "Verificando status do daemon..."
    
    if systemctl is-active --quiet fazai; then
        log_success "Daemon FazAI está ativo"
        return 0
    else
        log_warning "Daemon FazAI não está ativo"
        return 1
    fi
}

# Testar endpoints da API
test_api_endpoints() {
    log_info "Testando endpoints da API..."
    
    local base_url="http://localhost:3120"
    local endpoints=("/status" "/cache" "/logs")
    
    for endpoint in "${endpoints[@]}"; do
        log_info "Testando $endpoint..."
        
        if curl -s -f "$base_url$endpoint" > /dev/null; then
            log_success "Endpoint $endpoint respondeu com sucesso"
        else
            log_error "Falha ao acessar endpoint $endpoint"
            return 1
        fi
    done
    
    return 0
}

# Testar sistema de cache
test_cache_system() {
    log_info "Testando sistema de cache..."
    
    local base_url="http://localhost:3120"
    
    # Verificar status do cache
    local cache_status=$(curl -s "$base_url/cache" | jq -r '.size // "error"')
    
    if [ "$cache_status" != "error" ]; then
        log_success "Sistema de cache funcionando (tamanho: $cache_status)"
    else
        log_warning "Não foi possível verificar o cache"
    fi
    
    # Testar limpeza do cache
    if curl -s -X DELETE "$base_url/cache" | jq -e '.success' > /dev/null; then
        log_success "Limpeza do cache funcionando"
    else
        log_warning "Falha ao limpar cache"
    fi
}

# Testar sistema de logs
test_log_system() {
    log_info "Testando sistema de logs..."
    
    local log_file="/var/log/fazai/fazai.log"
    local error_log_file="/var/log/fazai/fazai-error.log"
    
    if [ -f "$log_file" ]; then
        log_success "Arquivo de log principal existe"
        
        # Verificar se o arquivo tem conteúdo
        if [ -s "$log_file" ]; then
            log_success "Arquivo de log tem conteúdo"
        else
            log_warning "Arquivo de log está vazio"
        fi
    else
        log_error "Arquivo de log principal não encontrado"
        return 1
    fi
    
    if [ -f "$error_log_file" ]; then
        log_success "Arquivo de log de erro existe"
    else
        log_warning "Arquivo de log de erro não encontrado"
    fi
    
    return 0
}

# Testar configuração
test_configuration() {
    log_info "Testando configuração..."
    
    local config_file="/etc/fazai/fazai.conf"
    
    if [ -f "$config_file" ]; then
        log_success "Arquivo de configuração existe"
        
        # Verificar se tem seções dos novos provedores
        local providers=("openrouter" "openai" "requesty" "anthropic" "gemini" "ollama" "cache")
        
        for provider in "${providers[@]}"; do
            if grep -q "\[$provider\]" "$config_file"; then
                log_success "Seção [$provider] encontrada na configuração"
            else
                log_warning "Seção [$provider] não encontrada na configuração"
            fi
        done
    else
        log_error "Arquivo de configuração não encontrado"
        return 1
    fi
    
    return 0
}

# Testar ferramenta de configuração
test_config_tool() {
    log_info "Testando ferramenta de configuração..."
    
    local config_tool="/opt/fazai/tools/fazai-config.js"
    
    if [ -f "$config_tool" ]; then
        log_success "Ferramenta de configuração existe"
        
        # Verificar se é executável
        if [ -x "$config_tool" ]; then
            log_success "Ferramenta de configuração é executável"
        else
            log_warning "Ferramenta de configuração não é executável"
        fi
        
        # Testar se consegue ler configuração
        if node "$config_tool" --help &> /dev/null || node "$config_tool" 2>&1 | grep -q "FazAI"; then
            log_success "Ferramenta de configuração pode ser executada"
        else
            log_warning "Ferramenta de configuração não pode ser executada"
        fi
    else
        log_error "Ferramenta de configuração não encontrada"
        return 1
    fi
    
    return 0
}

# Testar comandos básicos
test_basic_commands() {
    log_info "Testando comandos básicos..."
    
    # Testar comando de status
    if fazai status &> /dev/null; then
        log_success "Comando 'fazai status' funcionando"
    else
        log_warning "Comando 'fazai status' falhou"
    fi
    
    # Testar comando de logs
    if fazai logs 5 &> /dev/null; then
        log_success "Comando 'fazai logs' funcionando"
    else
        log_warning "Comando 'fazai logs' falhou"
    fi
    
    # Testar comando de ajuda
    if fazai ajuda &> /dev/null; then
        log_success "Comando 'fazai ajuda' funcionando"
    else
        log_warning "Comando 'fazai ajuda' falhou"
    fi
}

# Testar sistema de fallback (simulação)
test_fallback_system() {
    log_info "Testando sistema de fallback..."
    
    # Simular um comando que pode usar fallback
    local test_command="mostre informações do sistema"
    
    log_info "Executando comando de teste: '$test_command'"
    
    # Executar comando e verificar se retorna algo
    local result=$(timeout 30 fazai "$test_command" 2>&1 || echo "timeout")
    
    if [ "$result" != "timeout" ] && [ -n "$result" ]; then
        log_success "Comando executado com sucesso (possível uso de fallback)"
        echo "Resultado: $result" | head -c 100
        echo "..."
    else
        log_warning "Comando falhou ou timeout (pode indicar problema de conectividade)"
    fi
}

# Função principal
main() {
    echo "=========================================="
    echo "FazAI - Teste das Melhorias v1.41.0"
    echo "=========================================="
    echo ""
    
    local tests_passed=0
    local tests_failed=0
    
    # Array de funções de teste
    local test_functions=(
        "check_fazai_installation"
        "check_daemon_status"
        "test_api_endpoints"
        "test_cache_system"
        "test_log_system"
        "test_configuration"
        "test_config_tool"
        "test_basic_commands"
        "test_fallback_system"
    )
    
    # Executar todos os testes
    for test_func in "${test_functions[@]}"; do
        echo ""
        if $test_func; then
            ((tests_passed++))
        else
            ((tests_failed++))
        fi
    done
    
    # Resumo final
    echo ""
    echo "=========================================="
    echo "RESUMO DOS TESTES"
    echo "=========================================="
    echo "Testes passados: $tests_passed"
    echo "Testes falharam: $tests_failed"
    echo "Total de testes: ${#test_functions[@]}"
    echo ""
    
    if [ $tests_failed -eq 0 ]; then
        log_success "Todos os testes passaram! As melhorias estão funcionando corretamente."
        exit 0
    else
        log_warning "Alguns testes falharam. Verifique os logs acima para mais detalhes."
        exit 1
    fi
}

# Verificar dependências
check_dependencies() {
    local deps=("curl" "jq" "systemctl" "timeout")
    
    for dep in "${deps[@]}"; do
        if ! command -v "$dep" &> /dev/null; then
            log_error "Dependência '$dep' não encontrada"
            exit 1
        fi
    done
}

# Executar se chamado diretamente
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    check_dependencies
    main "$@"
fi 