# FazAI - CORREÇÕES RÁPIDAS DOS BUGS CRÍTICOS

# BUG 1: Verificação WSL muito restritiva (linha ~9)
# PROBLEMA: Só roda no WSL, mas deveria rodar em qualquer Debian/Ubuntu
# CORREÇÃO:
check_wsl_optional() {
  if [ -n "$WSL_DISTRO_NAME" ]; then
    log "INFO" "Executando no WSL: $WSL_DISTRO_NAME"
  else
    log "INFO" "Executando em sistema Linux nativo"
  fi
  # Removeu a verificação obrigatória do WSL
}

# BUG 2: URL do NVM mascarada (linha ~238)
# PROBLEMA: curl -o- https://**** | bash
# CORREÇÃO:
install_nvm() {
  log "INFO" "Instalando NVM..."
  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
  
  export NVM_DIR="$HOME/.nvm"
  [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
  
  nvm install --lts && nvm use --lts
}

# BUG 3: Variáveis mascaradas (linha ~410)
# PROBLEMA: local ****=()
# CORREÇÃO:
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
    mkdir -p "$dir" && log "SUCCESS" "Criado: $dir"
  done
}

# BUG 4: Pacote blessed mascarado (linha ~615)
# PROBLEMA: npm install **** --save
# CORREÇÃO:
install_tui_dependencies() {
  log "INFO" "Instalando dependências da interface TUI..."
  
  local tui_packages=(
    "blessed@0.1.81"
    "blessed-contrib@4.11.0" 
    "chalk@4.1.2"
    "figlet@1.5.2"
  )
  
  for package in "${tui_packages[@]}"; do
    npm install "$package" --save
  done
}

# BUG 5: Verificação de root opcional para desenvolvimento
# CORREÇÃO:
check_root_optional() {
  if [ "$EUID" -ne 0 ]; then
    log "WARNING" "Não está rodando como root. Algumas operações podem falhar."
    log "INFO" "Para instalação completa, execute: sudo bash install.sh"
    
    read -p "Continuar assim mesmo? (s/n): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Ss]$ ]]; then
      exit 1
    fi
  fi
}