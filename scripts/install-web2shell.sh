#!/usr/bin/env bash
set -euo pipefail

# Instalador opcional do GPT‑Web2Shell (exclusivo)
# Uso:
#   FAZAI_LOCAL_EXTRAS_DIR=/caminho/para/local-extras ./scripts/install-web2shell.sh

SRC_DIR="${FAZAI_LOCAL_EXTRAS_DIR:-}" 
if [ -z "$SRC_DIR" ]; then
  # fallback: diretório local do repo (ignorado pelo git)
  SRC_DIR="$(pwd)/local-extras/gpt-web2shell"
fi

WRAPPER="$SRC_DIR/bin/gpt-web2shell"
SCRIPT_JS="$SRC_DIR/opt/fazai/tools/gpt-web2shell.js"

if [ ! -f "$WRAPPER" ] || [ ! -f "$SCRIPT_JS" ]; then
  echo "Arquivos não encontrados em: $SRC_DIR" 1>&2
  echo "Esperado: bin/gpt-web2shell e opt/fazai/tools/gpt-web2shell.js" 1>&2
  exit 1
fi

sudo mkdir -p /opt/fazai/bin /opt/fazai/tools
sudo cp -f "$WRAPPER" /opt/fazai/bin/gpt-web2shell
sudo cp -f "$SCRIPT_JS" /opt/fazai/tools/gpt-web2shell.js
sudo chmod 755 /opt/fazai/bin/gpt-web2shell
sudo chmod 755 /opt/fazai/tools/gpt-web2shell.js || true
sudo ln -sf /opt/fazai/bin/gpt-web2shell /usr/local/bin/gpt-web2shell

echo "GPT‑Web2Shell instalado em /usr/local/bin/gpt-web2shell (exclusivo)."

