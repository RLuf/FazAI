#!/usr/bin/bash

# Script de verificação do sistema FazAI
# Verifica integridade, dependências e status dos serviços

# Configurações
FAZAI_ROOT="/opt/fazai"
CONFIG_FILE="/etc/fazai/fazai.conf"
LOG_FILE="/var/log/fazai/system-check.log"

# Função para logging
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Verifica dependências do sistema
check_dependencies() {
    local deps=("curl" "jq" "git" "python3" "pip3" "node" "npm")
    
    for dep in "${deps[@]}"; do
        if ! command -v "$dep" &> /dev/null; then
            log "ERRO: Dependência '$dep' não encontrada"
            return 1
        fi
    done

    # Verifica versões mínimas de Node.js e Python
    local node_version=$(node -v 2>/dev/null | sed 's/v//')
    local node_major=$(echo "$node_version" | cut -d. -f1)
    if [ -n "$node_major" ] && [ "$node_major" -lt 22 ]; then
        log "ERRO: Node.js 22 ou superior é requerido (versão atual: $node_version)"
        return 1
    fi

    local py_version=$(python3 --version 2>/dev/null | awk '{print $2}')
    local py_major=$(echo "$py_version" | cut -d. -f1)
    local py_minor=$(echo "$py_version" | cut -d. -f2)
    if [ -n "$py_major" ] && { [ "$py_major" -lt 3 ] || { [ "$py_major" -eq 3 ] && [ "$py_minor" -lt 10 ]; }; }; then
        log "ERRO: Python 3.10 ou superior é requerido (versão atual: $py_version)"
        return 1
    fi
    
    log "✓ Todas as dependências do sistema estão instaladas"
    return 0
}

# Verifica status dos serviços
check_services() {
    local services=("fazai" "ollama" "mcp-server")
    
    for service in "${services[@]}"; do
        if systemctl is-active --quiet "$service"; then
            log "✓ Serviço $service está rodando"
        else
            log "AVISO: Serviço $service não está ativo"
        fi
    done
}

# Verifica integridade dos arquivos
check_files() {
    local critical_files=(
        "$CONFIG_FILE"
        "$FAZAI_ROOT/bin/fazai"
        "$FAZAI_ROOT/etc/fazai.conf"
    )
    
    for file in "${critical_files[@]}"; do
        if [ ! -f "$file" ]; then
            log "ERRO: Arquivo crítico não encontrado: $file"
            return 1
        fi
    done
    
    log "✓ Todos os arquivos críticos estão presentes"
    return 0
}

# Verifica permissões
check_permissions() {
    local dirs=(
        "/etc/fazai"
        "/var/log/fazai"
        "/opt/fazai"
    )
    
    for dir in "${dirs[@]}"; do
        if [ ! -d "$dir" ]; then
            log "ERRO: Diretório não encontrado: $dir"
            continue
        fi
        
        if [ ! -w "$dir" ]; then
            log "ERRO: Sem permissão de escrita em: $dir"
            return 1
        fi
    done
    
    log "✓ Todas as permissões estão corretas"
    return 0
}

# Função principal
main() {
    log "Iniciando verificação do sistema"
    
    check_dependencies || log "⚠️ Problemas com dependências detectados"
    check_services
    check_files || log "⚠️ Problemas com arquivos detectados"
    check_permissions || log "⚠️ Problemas com permissões detectados"
    
    log "Verificação do sistema concluída"
}

# Executar script
main
