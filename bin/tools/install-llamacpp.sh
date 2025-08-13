#!/usr/bin/env bash
set -euo pipefail

LLAMA_DIR="/opt/fazai/llama.cpp"
MODEL_DIR="$LLAMA_DIR/models"
MODEL_URL="https://huggingface.co/datasets/ggerganov/llama.cpp/resolve/main/stories15M.bin"
MODEL_FILE="stories15M.bin"

echo "=== FazAI - Instalando llama.cpp (via CMake) ==="

# Detecta gerenciador de pacotes e instala dependências de build (curl dev, cmake, build tools)
PKG_MGR="apt-get"
if [ -f /etc/os-release ]; then
  . /etc/os-release
  case "$ID" in
    debian|ubuntu)
      sudo apt-get update -y
      sudo apt-get install -y build-essential cmake git curl libcurl4-openssl-dev
      ;;
    fedora|rhel|centos)
      PKG_MGR="dnf"
      sudo dnf install -y gcc gcc-c++ make cmake git curl libcurl-devel
      ;;
    *)
      echo "[AVISO] Distro não reconhecida; certifique-se de ter cmake, gcc e libcurl-dev instalados."
      ;;
  esac
fi

if [ ! -d "$LLAMA_DIR" ]; then
  git clone --depth 1 https://github.com/ggerganov/llama.cpp "$LLAMA_DIR"
else
  echo "Atualizando repositório llama.cpp..."
  git -C "$LLAMA_DIR" pull --ff-only || true
fi

cd "$LLAMA_DIR"

mkdir -p build && cd build
cmake -DCMAKE_BUILD_TYPE=Release ..
cmake --build . -j$(nproc)
sudo cmake --install . --prefix /usr/local || true
cd "$LLAMA_DIR"

mkdir -p "$MODEL_DIR"
if [ ! -f "$MODEL_DIR/$MODEL_FILE" ]; then
    echo "Baixando modelo de exemplo ($MODEL_FILE)..."
curl -L -o "$MODEL_DIR/$MODEL_FILE" "$MODEL_URL" || echo "Falha ao baixar modelo de exemplo (ignorado)"
fi

echo "llama.cpp instalado em $LLAMA_DIR (binários em build/)."
