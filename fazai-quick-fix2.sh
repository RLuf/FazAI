#!/usr/bin/bash

# FazAI - Correções Críticas do Script de Instalação

# 1. CORREÇÃO: Verificação WSL menos restritiva
check_wsl() {
  if [ -n "$WSL_DISTRO_NAME" ]; then
    log "INFO" "Executando no WSL: $WSL_DISTRO_NAME"
  else
    log "INFO" "Executando em sistema Linux nativo"
  fi
}

# 2. CORREÇÃO: URL completa do NVM
install_nvm() {
  log "INFO" "Instalando NVM..."
  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
  
  export NVM_DIR="$HOME/.nvm"
  [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
  
  nvm install --lts
  nvm use --lts
}

# 3. CORREÇÃO: Variáveis de diretórios
create_directories() {
  log "INFO" "Criando estrutura de diretórios..."
  
  local directories=(
    "/opt/fazai/bin"
    "/opt/fazai/lib"
    "/opt/fazai/tools"
    "/opt/fazai/mods"
    "/opt/fazai/conf"
    "/etc/fazai"
    "/var/log/fazai"
    "/var/lib/fazai/history"
    "/var/lib/fazai/cache"
    "/var/lib/fazai/data"
  )
  
  for dir in "${directories[@]}"; do
    mkdir -p "$dir"
    log "DEBUG" "Diretório criado: $dir"
  done
}

# 4. CORREÇÃO: Instalação do blessed
install_tui_dependencies() {
  log "INFO" "Instalando dependências da interface TUI..."
  
  # Instala blessed corretamente
  npm install blessed --save
  npm install blessed-contrib --save
  npm install chalk --save
  npm install figlet --save
  
  if [ $? -eq 0 ]; then
    log "SUCCESS" "Dependências TUI instaladas com sucesso"
  else
    log "ERROR" "Falha ao instalar dependências TUI"
    return 1
  fi
}

# 5. CORREÇÃO: Verificação de permissões mais flexível
check_permissions() {
  if [ "$EUID" -ne 0 ]; then
    log "WARNING" "Não está executando como root. Algumas operações podem falhar."
    log "INFO" "Para instalação completa, execute: sudo bash install.sh"
    
    # Permite continuar mas com funcionalidades limitadas
    INSTALL_MODE="user"
  else
    log "SUCCESS" "Executando com permissões de root"
    INSTALL_MODE="system"
  fi
}

# 6. CORREÇÃO: Fallback para instalação de dependências
install_dependencies_with_fallback() {
  log "INFO" "Instalando dependências com fallback..."
  
  # Tenta apt primeiro
  if command -v apt-get &> /dev/null; then
    apt-get update
    apt-get install -y nodejs npm build-essential curl