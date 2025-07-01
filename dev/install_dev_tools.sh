#!/usr/bin/env bash
# Instala codex-cli e aider-chat para ambiente de desenvolvimento

set -e

# instala codex-cli via npm
if ! command -v codex >/dev/null 2>&1; then
  echo "Instalando codex-cli..."
  npm install -g codex-cli >/dev/null 2>&1 || {
    echo "Falha ao instalar codex-cli"; exit 1; }
fi

# instala aider-chat via pip
if ! python3 -m aider --version >/dev/null 2>&1; then
  echo "Instalando aider-chat..."
  pip3 install --quiet aider-chat || {
    echo "Falha ao instalar aider-chat"; exit 1; }
fi

echo "Ferramentas de desenvolvimento instaladas"
