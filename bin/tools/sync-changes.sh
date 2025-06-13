#!/usr/bin/bash

# Script de sincronização do FazAI
# Este script mantém as modificações sincronizadas entre ambientes

# Configurações
MAIN_DIR="$(pwd)"
LOG_FILE="$MAIN_DIR/var/log/sync-changes.log"

# Criar diretório de logs se não existir
mkdir -p "$(dirname $LOG_FILE)"

# Função para logging
log_message() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Verificar e criar diretórios necessários
check_directories() {
    local dirs=("bin" "etc" "opt" "var" "var/log")
    for dir in "${dirs[@]}"; do
        if [ ! -d "$MAIN_DIR/$dir" ]; then
            mkdir -p "$MAIN_DIR/$dir"
            log_message "Criado diretório: $dir"
        fi
    done
}

# Verificar permissões
check_permissions() {
    find "$MAIN_DIR" -type d -exec chmod 755 {} \;
    find "$MAIN_DIR" -type f -name "*.sh" -exec chmod 755 {} \;
    log_message "Permissões atualizadas"
}

# Sincronizar arquivos de configuração
sync_configs() {
    if [ -f "/etc/fazai/fazai.conf" ]; then
        cp -f "/etc/fazai/fazai.conf" "$MAIN_DIR/etc/fazai.conf.new"
        log_message "Configurações sincronizadas"
    fi
}

# Função principal
main() {
    log_message "Iniciando sincronização"
    check_directories
    check_permissions
    sync_configs
    log_message "Sincronização completa"
}

# Executar
main
