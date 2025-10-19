#!/usr/bin/env bash
# FazAI smart installer
# Pode ser executado dentro do repositório clonado ou via `curl ... | bash`

set -euo pipefail

SCRIPT_NAME="$(basename "$0")"
REPO_URL="https://github.com/RLuf/FazAI"
REPO_ARCHIVE_URL="${REPO_URL}/archive/refs/heads"
DEFAULT_REF="master"

DEFAULT_BIN_DIR="$HOME/.local/bin"
DEFAULT_INSTALL_DIR="$HOME/.local/share/fazai"

FORCE=0
SKIP_BUILD=0
KEEP_BUILD=0
REF="$DEFAULT_REF"
INSTALL_DIR="$DEFAULT_INSTALL_DIR"
BIN_DIR="$DEFAULT_BIN_DIR"
DOWNLOAD_DIR=""

usage() {
  cat <<EOF
Uso: $SCRIPT_NAME [opções]

Opções:
  --install-dir <path>   Diretório onde os arquivos do FazAI serão instalados (default: $DEFAULT_INSTALL_DIR)
  --bin-dir <path>       Diretório onde o atalho 'fazai' será criado (default: $DEFAULT_BIN_DIR)
  --prefix <path>        Define install-dir como <path>/share/fazai e bin-dir como <path>/bin
  --ref <branch|tag>     Seleciona branch/tag específico do repositório (default: $DEFAULT_REF)
  --force                Sobrescreve instalação existente sem perguntar
  --skip-build           Não executa npm install / npm run build (assume dist/ pronto)
  --keep-build           Não remove diretório temporário usado no download/build
  --help                 Mostra esta mensagem

Exemplos:
  ./scripts/install.sh
  ./scripts/install.sh --prefix /usr/local --force
  curl -fsSL ${REPO_URL}/raw/${DEFAULT_REF}/scripts/install.sh | bash
EOF
}

ensure_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "❌ Comando obrigatório não encontrado: $1" >&2
    exit 1
  fi
}

cleanup() {
  if [[ -n "$DOWNLOAD_DIR" && $KEEP_BUILD -eq 0 && -d "$DOWNLOAD_DIR" ]]; then
    rm -rf "$DOWNLOAD_DIR"
  fi
}

trap cleanup EXIT

# Parse arguments
while [[ $# -gt 0 ]]; do
  case "$1" in
    --install-dir)
      [[ $# -lt 2 ]] && { echo "Faltou caminho para --install-dir" >&2; exit 1; }
      INSTALL_DIR="$2"
      shift 2
      ;;
    --bin-dir)
      [[ $# -lt 2 ]] && { echo "Faltou caminho para --bin-dir" >&2; exit 1; }
      BIN_DIR="$2"
      shift 2
      ;;
    --prefix)
      [[ $# -lt 2 ]] && { echo "Faltou caminho para --prefix" >&2; exit 1; }
      INSTALL_DIR="$2/share/fazai"
      BIN_DIR="$2/bin"
      shift 2
      ;;
    --ref)
      [[ $# -lt 2 ]] && { echo "Faltou valor para --ref" >&2; exit 1; }
      REF="$2"
      shift 2
      ;;
    --force)
      FORCE=1
      shift
      ;;
    --skip-build)
      SKIP_BUILD=1
      shift
      ;;
    --keep-build)
      KEEP_BUILD=1
      shift
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    *)
      echo "Opção desconhecida: $1" >&2
      usage
      exit 1
      ;;
  esac
done

ensure_cmd curl
ensure_cmd tar
ensure_cmd node
ensure_cmd npm

# Detecta se estamos dentro do repositório
ROOT_DIR=""
SCRIPT_DIR=""
if [[ -n "${BASH_SOURCE[0]:-}" ]]; then
  SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd || true)"
fi
if [[ -n "$SCRIPT_DIR" && -f "$SCRIPT_DIR/../package.json" && -d "$SCRIPT_DIR/../src" ]]; then
  ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
fi

if [[ -z "$ROOT_DIR" ]]; then
  echo "→ Baixando FazAI (${REF}) do GitHub..."
  DOWNLOAD_DIR="$(mktemp -d)"
  ARCHIVE="${DOWNLOAD_DIR}/fazai.tar.gz"
  curl -fsSL "${REPO_ARCHIVE_URL}/${REF}.tar.gz" -o "$ARCHIVE"
  tar -xzf "$ARCHIVE" -C "$DOWNLOAD_DIR"
  ROOT_DIR="$(find "$DOWNLOAD_DIR" -maxdepth 1 -mindepth 1 -type d | head -n1)"
  if [[ -z "$ROOT_DIR" ]]; then
    echo "❌ Falha ao extrair o repositório." >&2
    exit 1
  fi
else
  echo "→ Usando repositório existente em $ROOT_DIR"
fi

if [[ ! -f "$ROOT_DIR/package.json" ]]; then
  echo "❌ package.json não encontrado em $ROOT_DIR" >&2
  exit 1
fi

# Instala dependências e build
if [[ $SKIP_BUILD -eq 0 ]]; then
  if [[ ! -d "$ROOT_DIR/node_modules" ]]; then
    echo "→ Instalando dependências (npm install)..."
    (cd "$ROOT_DIR" && npm install)
  fi
  echo "→ Gerando bundle (npm run build)..."
  (cd "$ROOT_DIR" && npm run build)
else
  echo "↷ Pulando etapa de build (--skip-build)."
fi

DIST_ENTRY="$ROOT_DIR/dist/app.cjs"
if [[ ! -f "$DIST_ENTRY" ]]; then
  echo "❌ Build não encontrado em $DIST_ENTRY" >&2
  exit 1
fi

# Preparando diretórios de destino
if [[ -d "$INSTALL_DIR" && $FORCE -eq 0 ]]; then
  echo "❌ O diretório de instalação $INSTALL_DIR já existe. Use --force para sobrescrever." >&2
  exit 1
fi

mkdir -p "$INSTALL_DIR"
rm -rf "$INSTALL_DIR"/*
mkdir -p "$INSTALL_DIR/scripts"

# Copia artefatos necessários
cp -a "$ROOT_DIR/dist" "$INSTALL_DIR/"
cp -a "$ROOT_DIR/context" "$INSTALL_DIR/" 2>/dev/null || true
cp -a "$ROOT_DIR/fazai" "$INSTALL_DIR/"
chmod +x "$INSTALL_DIR/fazai"

if [[ -f "$ROOT_DIR/scripts/start-codex.sh" ]]; then
  cp "$ROOT_DIR/scripts/start-codex.sh" "$INSTALL_DIR/scripts/start-codex.sh"
  chmod +x "$INSTALL_DIR/scripts/start-codex.sh"
fi

if [[ -f "$ROOT_DIR/fazai.conf.example" ]]; then
  cp "$ROOT_DIR/fazai.conf.example" "$INSTALL_DIR/fazai.conf.example"
fi

for doc in CHANGELOG.md LICENSE NOTICE README.md; do
  if [[ -f "$ROOT_DIR/$doc" ]]; then
    cp "$ROOT_DIR/$doc" "$INSTALL_DIR/$doc"
  fi
done

# Cria links / binários
mkdir -p "$BIN_DIR"
ln -sf "$INSTALL_DIR/fazai" "$BIN_DIR/fazai"
if [[ -f "$INSTALL_DIR/scripts/start-codex.sh" ]]; then
  ln -sf "$INSTALL_DIR/scripts/start-codex.sh" "$BIN_DIR/start-codex"
fi

cat <<EOF

✔ FazAI instalado em: $INSTALL_DIR
✔ Binário disponível em: $BIN_DIR/fazai

Dicas:
  - Garanta que '$BIN_DIR' esteja no PATH:
        export PATH="$BIN_DIR:\$PATH"
  - Execute o ritual completo:
        start-codex
  - Ou chame diretamente:
        fazai --help

Configuração:
  - O FazAI utiliza por padrão ~/.config/fazai/fazai.conf
  - Para logs detalhados: fazai --debug --log-file ~/fazai-debug.log
EOF

if [[ $KEEP_BUILD -eq 1 && -n "$DOWNLOAD_DIR" ]]; then
  echo "Arquivos temporários mantidos em $DOWNLOAD_DIR"
else
  cleanup
  trap - EXIT
fi
