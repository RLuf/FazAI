#!/usr/bin/env bash
set -euo pipefail

# FazAI - Gemma bootstrap
# - Detecta arquitetura
# - Instala binário gemma_oneshot em /opt/fazai/bin
# - Baixa pesos (single-file) para /opt/fazai/models/gemma
# - Atualiza /etc/fazai/fazai.conf se existir

BIN_DIR=/opt/fazai/bin
MODEL_DIR=/opt/fazai/models/gemma
CONF_FILE=/etc/fazai/fazai.conf
DEFAULT_MODEL="gemma2-2b-it"
DEFAULT_VARIANT="sfp"
DEFAULT_NAME="gemma2-2b-it-sfp-single.sbs"

log() { echo -e "[bootstrap] $*"; }
err() { echo -e "[bootstrap][ERRO] $*" >&2; }

arch=$(uname -m)
case "$arch" in
  x86_64) ARCH=linux-x64 ;;
  aarch64|arm64) ARCH=linux-arm64 ;;
  *) ARCH=linux-x64 ;;
esac

mkdir -p "$BIN_DIR" "$MODEL_DIR"
chmod 755 "$BIN_DIR" "$MODEL_DIR"

# 1) Instalar binário
if [ ! -x "$BIN_DIR/gemma_oneshot" ]; then
  log "Instalando binário gemma_oneshot para $ARCH"
  # Se o pacote portable trouxe binários por arquitetura, copie
  PKG_BIN_DIR="$(dirname "$0")/../.."  # /opt/fazai/tools/ -> /opt/fazai
  if [ -x "$PKG_BIN_DIR/bin/$ARCH/gemma_oneshot" ]; then
    install -m 0755 "$PKG_BIN_DIR/bin/$ARCH/gemma_oneshot" "$BIN_DIR/gemma_oneshot"
  elif [ -x "$PKG_BIN_DIR/bin/gemma_oneshot" ]; then
    install -m 0755 "$PKG_BIN_DIR/bin/gemma_oneshot" "$BIN_DIR/gemma_oneshot"
  elif [ -x "/root/gemma.cpp/build/gemma_oneshot" ]; then
    install -m 0755 "/root/gemma.cpp/build/gemma_oneshot" "$BIN_DIR/gemma_oneshot"
  else
    err "Binário gemma_oneshot não encontrado no pacote. Compile previamente ou forneça em $BIN_DIR."
  fi
fi

# 2) Pesos
WEIGHTS_PATH="$MODEL_DIR/$DEFAULT_NAME"
if [ ! -f "$WEIGHTS_PATH" ]; then
  log "Baixando pesos padrão ($DEFAULT_MODEL $DEFAULT_VARIANT)"
  cat <<EULA
Termos de uso do Gemma (Google). Você deve aceitar a licença do modelo.
Consulte: https://ai.google.dev/gemma (Kaggle/HuggingFace)
Digite 'yes' para aceitar e continuar: 
EULA
  read -r ACCEPT || true
  if [ "$ACCEPT" != "yes" ]; then
    err "Licença não aceita. Saindo."
    exit 1
  fi
  # Preferir Hugging Face se huggingface-cli estiver disponível
  if command -v huggingface-cli >/dev/null 2>&1; then
    log "Usando huggingface-cli para baixar"
    huggingface-cli download google/gemma2-2b-it-sfp-cpp --local-dir "$MODEL_DIR" >/dev/null 2>&1 || true
    # tentar localizar single-file
    CANDIDATE=$(ls -1 "$MODEL_DIR" | grep -E "gemma2-2b-it.*single.*\.sbs$" | head -n1 || true)
    if [ -n "$CANDIDATE" ]; then
      mv -f "$MODEL_DIR/$CANDIDATE" "$WEIGHTS_PATH" || true
    fi
  fi
  if [ ! -f "$WEIGHTS_PATH" ]; then
    log "Baixando via curl fallback (pode requerer autenticação manual)."
    err "Por favor baixe manualmente o arquivo $DEFAULT_NAME para $MODEL_DIR"
    exit 2
  fi
fi

# 3) Atualizar conf
if [ -f "$CONF_FILE" ]; then
  log "Atualizando $CONF_FILE com paths de gemma_cpp"
  # Atualiza/insere chaves na seção [gemma_cpp]
  tmp=$(mktemp)
  awk -v w="$WEIGHTS_PATH" -v b="$BIN_DIR/gemma_oneshot" -v m="$DEFAULT_MODEL" '
    BEGIN{insec=0;found=0}
    /^\[gemma_cpp\]/{print; insec=1; next}
    /^\[.*\]/{insec=0}
    {
      if(insec==1){
        if($0 ~ /^endpoint[[:space:]]*=/){$0="endpoint = " b}
        if($0 ~ /^weights[[:space:]]*=/){$0="weights = " w}
        if($0 ~ /^tokenizer[[:space:]]*=/){$0="tokenizer = "}
        if($0 ~ /^(model|default_model)[[:space:]]*=/){$0="default_model = " m}
      }
      print
    }
  ' "$CONF_FILE" > "$tmp" && cat "$tmp" > "$CONF_FILE"
  rm -f "$tmp"
fi

log "Bootstrap concluído"
