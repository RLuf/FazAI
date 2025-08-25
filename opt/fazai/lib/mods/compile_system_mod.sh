#!/bin/bash

# FazAI - Script de Compilação do Módulo de Sistema
# Este script compila o módulo system_mod.c com todas as dependências

set -e

# Opções
AUTO_INSTALL=1
CHECK_ONLY=0
for a in "$@"; do
  case "$a" in
    --check|--dry-run)
      AUTO_INSTALL=0; CHECK_ONLY=1 ;;
    --no-install)
      AUTO_INSTALL=0 ;;
  esac
done

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Função para log colorido
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

warn() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%S')] WARNING:${NC} $1"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR:${NC} $1"
}

info() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')] INFO:${NC} $1"
}

# Verifica root somente quando for instalar pacotes
if [[ $AUTO_INSTALL -eq 1 ]]; then
  if [[ $EUID -ne 0 ]]; then
    error "Este script deve ser executado como root (instalação automática de dependências). Use --check para apenas verificar."
    exit 1
  fi
fi

# Diretório do projeto
PROJECT_DIR="/opt/fazai"
MODS_DIR="$PROJECT_DIR/lib/mods"
BUILD_DIR="$MODS_DIR/build"

log "Iniciando compilação do módulo system_mod.c"

# Cria diretório de build se não existir
if [ ! -d "$BUILD_DIR" ]; then
    log "Criando diretório de build: $BUILD_DIR"
    mkdir -p "$BUILD_DIR"
fi

install_pkg() {
  local pkg="$1"
  if command -v apt-get >/dev/null 2>&1; then apt-get install -y "$pkg"; return $?; fi
  if command -v dnf >/dev/null 2>&1; then dnf install -y "$pkg"; return $?; fi
  if command -v yum >/dev/null 2>&1; then yum install -y "$pkg"; return $?; fi
  if command -v zypper >/dev/null 2>&1; then zypper install -y "$pkg"; return $?; fi
  if command -v pacman >/dev/null 2>&1; then pacman -S --noconfirm "$pkg"; return $?; fi
  return 1
}

# Verifica dependências
log "Verificando dependências..."

# Verifica se o GCC está instalado
if ! command -v gcc &> /dev/null; then
    if [[ $AUTO_INSTALL -eq 1 ]]; then
      error "GCC não encontrado. Instalando..."
      (command -v apt-get >/dev/null 2>&1 && apt-get update || true)
      install_pkg build-essential || install_pkg gcc || true
    else
      warn "GCC não encontrado (modo --check)."
    fi
fi

# Verifica se o ClamAV está instalado
if ! command -v clamscan &> /dev/null; then
    if [[ $AUTO_INSTALL -eq 1 ]]; then
      warn "ClamAV não encontrado. Instalando..."
      (command -v apt-get >/dev/null 2>&1 && apt-get update || true)
      install_pkg clamav || true
      install_pkg clamav-daemon || true
      systemctl enable clamav-daemon || true
      systemctl start clamav-daemon || true
      command -v freshclam >/dev/null 2>&1 && freshclam || true
    else
      warn "ClamAV não encontrado (modo --check)."
    fi
fi

# Verifica se o libcurl está instalado
if ! pkg-config --exists libcurl; then
    if [[ $AUTO_INSTALL -eq 1 ]]; then
      warn "libcurl não encontrado. Instalando..."
      (command -v apt-get >/dev/null 2>&1 && apt-get update || true)
      install_pkg libcurl4-openssl-dev || install_pkg libcurl-devel || true
    else
      warn "libcurl (dev) não encontrado (modo --check)."
    fi
fi

# Verifica se o json-c está instalado
if ! pkg-config --exists json-c; then
    if [[ $AUTO_INSTALL -eq 1 ]]; then
      warn "json-c não encontrado. Instalando..."
      (command -v apt-get >/dev/null 2>&1 && apt-get update || true)
      install_pkg libjson-c-dev || install_pkg json-c-devel || true
    else
      warn "json-c (dev) não encontrado (modo --check)."
    fi
fi

# Verifica se o libclamav está instalado
if ! pkg-config --exists libclamav; then
    if [[ $AUTO_INSTALL -eq 1 ]]; then
      warn "libclamav não encontrado. Instalando..."
      (command -v apt-get >/dev/null 2>&1 && apt-get update || true)
      install_pkg libclamav-dev || install_pkg clamav-devel || true
    else
      warn "libclamav (dev) não encontrado (modo --check)."
    fi
fi

# Verifica se o pthread está disponível
# pthread usualmente não possui pkg-config; apenas avisa
if ! pkg-config --exists pthread; then
    warn "pthread: pkg-config ausente (ok); biblioteca será vinculada via -lpthread"
fi

log "Todas as dependências verificadas"

# Compila o módulo
if [[ $CHECK_ONLY -eq 1 ]]; then
  log "Modo --check: verificação concluída (sem compilar)."
  exit 0
fi

log "Compilando system_mod.c..."

cd "$MODS_DIR"

# Flags de compilação
CFLAGS="-Wall -Wextra -O2 -fPIC -D_GNU_SOURCE"
LDFLAGS="-shared -fPIC"

# Bibliotecas necessárias
LIBS="-lclamav -lcurl -ljson-c -lpthread"

# Comando de compilação
gcc $CFLAGS $LDFLAGS -o system_mod.so system_mod.c $LIBS

if [ $? -eq 0 ]; then
    log "Compilação bem-sucedida!"
else
    error "Falha na compilação"
    exit 1
fi

# Verifica se o arquivo foi criado
if [ -f "system_mod.so" ]; then
    log "Módulo compilado: system_mod.so"
    
    # Mostra informações do arquivo
    info "Tamanho do arquivo: $(ls -lh system_mod.so | awk '{print $5}')"
    info "Permissões: $(ls -la system_mod.so | awk '{print $1}')"
    
    # Verifica dependências do arquivo
    info "Verificando dependências do módulo..."
    ldd system_mod.so
    
    # Testa se o módulo pode ser carregado
    info "Testando carregamento do módulo..."
    if command -v node &> /dev/null; then
        node -e "
            const ffi = require('ffi-napi');
            try {
                const systemMod = ffi.Library('./system_mod.so', {
                    'fazai_mod_init': ['int', []],
                    'fazai_mod_exec': ['int', ['string', 'string', 'string', 'int']],
                    'fazai_mod_cleanup': ['void', []]
                });
                console.log('✓ Módulo carregado com sucesso');
                const result = systemMod.fazai_mod_init();
                console.log('✓ Inicialização:', result === 0 ? 'OK' : 'ERRO');
                if (result === 0) {
                    systemMod.fazai_mod_cleanup();
                    console.log('✓ Finalização: OK');
                }
            } catch (e) {
                console.error('✗ Erro ao carregar módulo:', e.message);
                process.exit(1);
            }
        "
    else
        warn "Node.js não encontrado, pulando teste de carregamento"
    fi
    
else
    error "Arquivo system_mod.so não foi criado"
    exit 1
fi

# Copia arquivos de configuração se não existirem
log "Verificando arquivos de configuração..."

CONFIG_DIR="/etc/fazai"

if [ ! -d "$CONFIG_DIR" ]; then
    log "Criando diretório de configuração: $CONFIG_DIR"
    mkdir -p "$CONFIG_DIR"
fi

# Copia assinaturas de malware
if [ ! -f "$CONFIG_DIR/malware_signatures.txt" ]; then
    log "Copiando arquivo de assinaturas de malware..."
    cp "$PROJECT_DIR/etc/fazai/malware_signatures.txt" "$CONFIG_DIR/"
    chmod 644 "$CONFIG_DIR/malware_signatures.txt"
fi

# Copia lista de RBLs
if [ ! -f "$CONFIG_DIR/rbl_list.txt" ]; then
    log "Copiando arquivo de RBLs..."
    cp "$PROJECT_DIR/etc/fazai/rbl_list.txt" "$CONFIG_DIR/"
    chmod 644 "$CONFIG_DIR/rbl_list.txt"
fi

# Define permissões corretas
log "Definindo permissões..."
chmod 755 system_mod.so
chown root:root system_mod.so

# Cria diretório de logs se não existir
if [ ! -d "/var/log" ]; then
    mkdir -p /var/log
fi

# Cria arquivo de log se não existir
if [ ! -f "/var/log/fazai.log" ]; then
    touch /var/log/fazai.log
    chmod 644 /var/log/fazai.log
    chown root:root /var/log/fazai.log
fi

# Cria arquivo de log do firewall se não existir
if [ ! -f "/var/log/fazai_firewall.log" ]; then
    touch /var/log/fazai_firewall.log
    chmod 644 /var/log/fazai_firewall.log
    chown root:root /var/log/fazai_firewall.log
fi

# Mostra resumo final
log "=== RESUMO DA COMPILAÇÃO ==="
info "Módulo: system_mod.so"
info "Localização: $MODS_DIR/system_mod.so"
info "Configurações: $CONFIG_DIR/"
info "Logs: /var/log/fazai.log"
info "Firewall logs: /var/log/fazai_firewall.log"

# Testa funcionalidades básicas
log "=== TESTE DE FUNCIONALIDADES ==="

# Testa ClamAV
if command -v clamscan &> /dev/null; then
    info "ClamAV: Disponível"
    clamscan --version | head -1
else
    warn "ClamAV: Indisponível"
fi

# Testa iptables
if command -v iptables &> /dev/null; then
    info "iptables: Disponível"
    iptables --version | head -1
else
    warn "iptables: Indisponível"
fi

# Testa curl
if command -v curl &> /dev/null; then
    info "curl: Disponível"
    curl --version | head -1
else
    warn "curl: Indisponível"
fi

log "Compilação concluída com sucesso!"
log "O módulo está pronto para uso com o FazAI"

# Mostra como usar
echo ""
echo -e "${BLUE}=== COMO USAR ===${NC}"
echo "1. O módulo será carregado automaticamente pelo FazAI"
echo "2. Para testar manualmente:"
echo "   node -e \"const ffi = require('ffi-napi'); const mod = ffi.Library('./system_mod.so', {...});\""
echo "3. Para verificar status:"
echo "   curl -X POST http://localhost:3120/command -d '{\"command\":\"system_mod status\"}'"
echo "4. Para testar wrappers:"
echo "   curl -X POST http://localhost:3120/command -d '{\"command\":\"system_mod test\"}'"
echo ""
