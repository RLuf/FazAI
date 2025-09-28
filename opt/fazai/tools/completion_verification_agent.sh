#!/bin/bash

# FazAI Completion Verification Agent
# Verifica e garante que o bash completion está funcionando corretamente
# Autor: Copilot Agent
# Versão: 1.0

set -e

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configurações
COMPLETION_SCRIPT="${COMPLETION_SCRIPT:-/etc/bash_completion.d/fazai}"
SOURCE_COMPLETION="$(dirname "$(dirname "$(dirname "$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")")")")/etc/fazai/fazai-completion.sh"
FALLBACK_COMPLETION_DIR="${FALLBACK_COMPLETION_DIR:-/etc/bash_completion.d}"
BACKUP_DIR="/tmp/fazai_completion_backup_$(date +%Y%m%d_%H%M%S)"

# Função de logging
log() {
    local level=$1
    local message=$2
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    
    case $level in
        "INFO")
            echo -e "${BLUE}[INFO]${NC} $message"
            ;;
        "SUCCESS")
            echo -e "${GREEN}[SUCCESS]${NC} $message"
            ;;
        "WARNING")
            echo -e "${YELLOW}[WARNING]${NC} $message"
            ;;
        "ERROR")
            echo -e "${RED}[ERROR]${NC} $message"
            ;;
        "DEBUG")
            if [[ "${DEBUG:-false}" == "true" ]]; then
                echo -e "${BLUE}[DEBUG]${NC} $message"
            fi
            ;;
    esac
    
    # Log to file if available
    if [[ -d "/var/log/fazai" ]]; then
        echo "[$timestamp] [$level] $message" >> /var/log/fazai/completion_verification.log
    fi
}

# Verifica se o bash completion está instalado no sistema
check_bash_completion_system() {
    log "INFO" "Verificando sistema de bash completion..."
    
    if ! command -v complete >/dev/null 2>&1; then
        log "ERROR" "Comando 'complete' não disponível - bash completion não suportado"
        return 1
    fi
    
    if [[ ! -f "/etc/bash_completion" ]] && [[ ! -d "/etc/bash_completion.d" ]]; then
        log "WARNING" "Sistema bash completion não instalado"
        # Tentar instalar
        if command -v apt-get >/dev/null 2>&1; then
            log "INFO" "Tentando instalar bash-completion..."
            apt-get update && apt-get install -y bash-completion
            return $?
        else
            log "ERROR" "Não foi possível instalar bash-completion automaticamente"
            return 1
        fi
    fi
    
    log "SUCCESS" "Sistema bash completion disponível"
    return 0
}

# Verifica se o script de completion do FazAI existe e está correto
check_fazai_completion_script() {
    log "INFO" "Verificando script de completion do FazAI..."
    
    local script_ok=true
    
    # Verifica se o script existe
    if [[ ! -f "$COMPLETION_SCRIPT" ]]; then
        log "WARNING" "Script de completion não encontrado em $COMPLETION_SCRIPT"
        script_ok=false
    else
        # Verifica conteúdo básico
        if ! grep -q "_fazai_completions" "$COMPLETION_SCRIPT"; then
            log "WARNING" "Script de completion parece corrompido (função _fazai_completions não encontrada)"
            script_ok=false
        fi
        
        if ! grep -q "complete -F _fazai_completions fazai" "$COMPLETION_SCRIPT"; then
            log "WARNING" "Script de completion não está registrado corretamente"
            script_ok=false
        fi
    fi
    
    if [[ "$script_ok" == "true" ]]; then
        log "SUCCESS" "Script de completion do FazAI está correto"
        return 0
    else
        log "ERROR" "Script de completion do FazAI tem problemas"
        return 1
    fi
}

# Testa se a completion está funcionando
test_completion_functionality() {
    log "INFO" "Testando funcionalidade de completion..."
    
    # Carrega o script de completion
    if [[ -f "$COMPLETION_SCRIPT" ]]; then
        source "$COMPLETION_SCRIPT" 2>/dev/null || {
            log "ERROR" "Erro ao carregar script de completion"
            return 1
        }
    else
        log "ERROR" "Script de completion não encontrado para teste"
        return 1
    fi
    
    # Testa se a função de completion está registrada
    if ! complete -p fazai >/dev/null 2>&1; then
        log "ERROR" "Completion para 'fazai' não está registrada"
        return 1
    fi
    
    # Testa alguns comandos básicos de completion
    local test_completions=("help" "status" "version" "agent" "logs")
    local COMP_WORDS=("fazai" "")
    local COMP_CWORD=1
    local COMPREPLY=()
    
    # Executa função de completion
    _fazai_completions 2>/dev/null || {
        log "ERROR" "Função de completion falhou ao executar"
        return 1
    }
    
    # Verifica se retornou sugestões
    if [[ ${#COMPREPLY[@]} -eq 0 ]]; then
        log "ERROR" "Completion não retornou sugestões"
        return 1
    fi
    
    # Verifica se comandos esperados estão nas sugestões
    local found_commands=0
    for cmd in "${test_completions[@]}"; do
        for suggestion in "${COMPREPLY[@]}"; do
            if [[ "$suggestion" == "$cmd" ]]; then
                ((found_commands++))
                break
            fi
        done
    done
    
    if [[ $found_commands -ge 3 ]]; then
        log "SUCCESS" "Completion está funcionando corretamente ($found_commands/${#test_completions[@]} comandos encontrados)"
        return 0
    else
        log "WARNING" "Completion funcionando parcialmente ($found_commands/${#test_completions[@]} comandos encontrados)"
        return 1
    fi
}

# Repara/reinstala o completion
repair_completion() {
    log "INFO" "Reparando completion do FazAI..."
    
    # Criar backup se existe
    if [[ -f "$COMPLETION_SCRIPT" ]]; then
        mkdir -p "$BACKUP_DIR"
        cp "$COMPLETION_SCRIPT" "$BACKUP_DIR/"
        log "INFO" "Backup criado em $BACKUP_DIR"
    fi
    
    # Garante que o diretório existe
    mkdir -p "$(dirname "$COMPLETION_SCRIPT")"
    
    # Copia o script correto
    if [[ -f "$SOURCE_COMPLETION" ]]; then
        cp "$SOURCE_COMPLETION" "$COMPLETION_SCRIPT"
        chmod 644 "$COMPLETION_SCRIPT"
        log "SUCCESS" "Script de completion copiado de $SOURCE_COMPLETION"
    else
        # Gera um script básico de fallback
        log "WARNING" "Script fonte não encontrado, gerando fallback básico"
        cat > "$COMPLETION_SCRIPT" << 'EOF'
#!/usr/bin/env bash
# FazAI Bash Completion (fallback básico)

_fazai_completions()
{
    local cur prev opts
    COMPREPLY=()
    cur="${COMP_WORDS[COMP_CWORD]}"
    prev="${COMP_WORDS[COMP_CWORD-1]}"

    opts="help version status start stop restart logs agent config web tui"

    case "${COMP_WORDS[1]}" in
        logs)
            COMPREPLY=( $(compgen -W "10 20 50 100" -- ${cur}) )
            return 0 ;;
        config)
            COMPREPLY=( $(compgen -W "show edit test" -- ${cur}) )
            return 0 ;;
    esac

    if [[ ${COMP_CWORD} -eq 1 ]]; then
        COMPREPLY=( $(compgen -W "${opts}" -- ${cur}) )
        return 0
    fi
}

complete -F _fazai_completions fazai
EOF
        chmod 644 "$COMPLETION_SCRIPT"
        log "WARNING" "Script de fallback criado - funcionalidade limitada"
    fi
    
    # Recarrega bash completion
    if [[ -f "/etc/bash_completion" ]]; then
        source /etc/bash_completion 2>/dev/null || true
    fi
    
    # Carrega o script recém-criado
    if [[ -f "$COMPLETION_SCRIPT" ]]; then
        source "$COMPLETION_SCRIPT" 2>/dev/null || true
    fi
    
    return 0
}

# Configura completion no .bashrc do usuário
configure_user_completion() {
    local target_user="${1:-root}"
    local bashrc_file
    
    if [[ "$target_user" == "root" ]]; then
        bashrc_file="/root/.bashrc"
    else
        bashrc_file="/home/$target_user/.bashrc"
    fi
    
    log "INFO" "Configurando completion no $bashrc_file..."
    
    if [[ ! -f "$bashrc_file" ]]; then
        log "WARNING" "$bashrc_file não existe"
        return 1
    fi
    
    # Verifica se já está configurado
    if grep -q "FazAI bash completion" "$bashrc_file"; then
        log "INFO" "Completion já configurado no $bashrc_file"
        return 0
    fi
    
    # Adiciona configuração
    {
        echo ""
        echo "# FazAI bash completion"
        echo "if [ -f /etc/bash_completion ]; then"
        echo "    source /etc/bash_completion"
        echo "fi"
        echo "if [ -f $COMPLETION_SCRIPT ]; then"
        echo "    source $COMPLETION_SCRIPT"
        echo "fi"
    } >> "$bashrc_file"
    
    log "SUCCESS" "Completion configurado no $bashrc_file"
    return 0
}

# Executa verificação completa
run_full_verification() {
    log "INFO" "Iniciando verificação completa do bash completion..."
    
    local errors=0
    
    # Verifica sistema
    if ! check_bash_completion_system; then
        ((errors++))
    fi
    
    # Verifica e repara script se necessário
    if ! check_fazai_completion_script; then
        log "INFO" "Tentando reparar completion..."
        if repair_completion; then
            # Testa novamente após reparo
            if ! check_fazai_completion_script; then
                ((errors++))
            fi
        else
            ((errors++))
        fi
    fi
    
    # Testa funcionalidade
    if ! test_completion_functionality; then
        log "INFO" "Tentando reparar completion devido a falha no teste..."
        if repair_completion; then
            # Testa novamente após reparo
            if ! test_completion_functionality; then
                ((errors++))
            fi
        else
            ((errors++))
        fi
    fi
    
    # Configura no bashrc
    configure_user_completion "root"
    
    if [[ $errors -eq 0 ]]; then
        log "SUCCESS" "Verificação completa: bash completion funcionando perfeitamente!"
        return 0
    else
        log "ERROR" "Verificação completa: $errors problema(s) encontrado(s)"
        return 1
    fi
}

# Mostra ajuda
show_help() {
    echo "FazAI Completion Verification Agent v1.0"
    echo ""
    echo "Uso: $0 [opção]"
    echo ""
    echo "Opções:"
    echo "  check       - Verifica se completion está funcionando"
    echo "  repair      - Repara/reinstala completion"
    echo "  test        - Testa funcionalidade de completion"
    echo "  configure   - Configura completion no .bashrc"
    echo "  verify      - Executa verificação completa (padrão)"
    echo "  help        - Mostra esta ajuda"
    echo ""
    echo "Variáveis de ambiente:"
    echo "  DEBUG=true  - Ativa logs de debug"
    echo ""
    echo "Exemplos:"
    echo "  $0 verify   # Verificação completa"
    echo "  $0 repair   # Força reparo do completion"
    echo "  DEBUG=true $0 check # Verificação com debug"
}

# Função principal
main() {
    local action="${1:-verify}"
    
    case "$action" in
        "check")
            check_bash_completion_system && check_fazai_completion_script
            ;;
        "repair")
            repair_completion
            ;;
        "test")
            test_completion_functionality
            ;;
        "configure")
            configure_user_completion "${2:-root}"
            ;;
        "verify")
            run_full_verification
            ;;
        "help"|"-h"|"--help")
            show_help
            ;;
        *)
            log "ERROR" "Ação desconhecida: $action"
            show_help
            exit 1
            ;;
    esac
}

# Executar se chamado diretamente
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi