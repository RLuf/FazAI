#!/bin/bash
# Entrypoint para container de teste do instalador FazAI
# Script para automatizar testes de instalação/desinstalação

set -e

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
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

# Função para testar instalação
test_installation() {
    log "🚀 Iniciando teste de instalação do FazAI..."
    
    # Verificar se estamos no diretório correto
    if [ ! -f "install.sh" ]; then
        log_error "Arquivo install.sh não encontrado no diretório atual"
        log "Certifique-se de que o volume está montado corretamente"
        return 1
    fi
    
    # Executar instalação
    log "Executando: sudo ./install.sh"
    if sudo ./install.sh; then
        log_success "Instalação concluída com sucesso!"
    else
        log_error "Falha na instalação"
        return 1
    fi
    
    # Verificar se o CLI foi instalado
    if command -v fazai >/dev/null 2>&1; then
        log_success "CLI 'fazai' encontrado no PATH"
        fazai --version || log_warning "Falha ao obter versão do fazai"
    else
        log_warning "CLI 'fazai' não encontrado no PATH"
    fi
    
    # Verificar se o serviço está configurado
    if systemctl list-unit-files | grep -q fazai; then
        log_success "Serviço fazai encontrado no systemd"
    else
        log_warning "Serviço fazai não encontrado no systemd"
    fi
    
    # Verificar estrutura de diretórios
    for dir in "/opt/fazai" "/etc/fazai" "/var/log/fazai"; do
        if [ -d "$dir" ]; then
            log_success "Diretório $dir criado"
        else
            log_warning "Diretório $dir não encontrado"
        fi
    done
    
    log_success "Teste de instalação concluído!"
}

# Função para testar desinstalação
test_uninstallation() {
    log "🧹 Iniciando teste de desinstalação do FazAI..."
    
    if [ ! -f "uninstall.sh" ]; then
        log_error "Arquivo uninstall.sh não encontrado"
        return 1
    fi
    
    # Executar desinstalação
    log "Executando: sudo ./uninstall.sh"
    if sudo ./uninstall.sh; then
        log_success "Desinstalação concluída com sucesso!"
    else
        log_error "Falha na desinstalação"
        return 1
    fi
    
    # Verificar limpeza
    if ! command -v fazai >/dev/null 2>&1; then
        log_success "CLI 'fazai' removido do PATH"
    else
        log_warning "CLI 'fazai' ainda presente no PATH"
    fi
    
    log_success "Teste de desinstalação concluído!"
}

# Função para executar testes automatizados
run_automated_tests() {
    log "🔄 Executando testes automatizados..."
    
    # Teste completo: instalação + desinstalação
    test_installation
    
    log "Aguardando 5 segundos antes da desinstalação..."
    sleep 5
    
    test_uninstallation
    
    log_success "Testes automatizados concluídos!"
}

# Função para modo interativo
interactive_mode() {
    log "🎯 Modo interativo do container de teste FazAI"
    echo ""
    echo "Comandos disponíveis:"
    echo "  install     - Testar instalação"
    echo "  uninstall   - Testar desinstalação"  
    echo "  auto        - Executar testes automatizados"
    echo "  shell       - Abrir shell bash"
    echo "  help        - Mostrar esta ajuda"
    echo ""
    
    while true; do
        read -p "fazai-test> " cmd
        
        case "$cmd" in
            "install")
                test_installation
                ;;
            "uninstall")
                test_uninstallation
                ;;
            "auto")
                run_automated_tests
                ;;
            "shell"|"bash")
                log "Abrindo shell bash..."
                exec bash
                ;;
            "help"|"h")
                interactive_mode
                ;;
            "exit"|"quit"|"q")
                log "Saindo..."
                exit 0
                ;;
            "")
                # Enter vazio, apenas continuar
                ;;
            *)
                log_warning "Comando não reconhecido: $cmd"
                echo "Digite 'help' para ver comandos disponíveis"
                ;;
        esac
    done
}

# Main
main() {
    log "🐳 Container de teste do instalador FazAI v2.0"
    log "Usuário atual: $(whoami)"
    log "Diretório: $(pwd)"
    log "Sistema: $(lsb_release -d | cut -f2)"
    echo ""
    
    # Verificar argumentos
    case "${1:-interactive}" in
        "install")
            test_installation
            ;;
        "uninstall") 
            test_uninstallation
            ;;
        "auto")
            run_automated_tests
            ;;
        "interactive"|"")
            interactive_mode
            ;;
        *)
            log_error "Argumento inválido: $1"
            echo "Uso: $0 [install|uninstall|auto|interactive]"
            exit 1
            ;;
    esac
}

# Trap para limpeza
trap 'log "Interrompido pelo usuário"' INT TERM

# Executar main se chamado diretamente
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi