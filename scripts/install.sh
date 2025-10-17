#!/usr/bin/env bash
# FazAI installer helper.
# Builds the CLI bundle and installs an executable named `fazai` into the chosen prefix.
# Optionally runs `npm pack` so you can distribute the resulting tarball.

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEFAULT_PREFIX="${HOME}/.local/bin"
INSTALL_PREFIX="${DEFAULT_PREFIX}"
CREATE_PACKAGE=0

print_help() {
  cat <<'EOF'
Usage: scripts/install.sh [--prefix <path>] [--pack]

Options:
  --prefix <path>  Install the CLI into this directory (default: ~/.local/bin).
  --pack           Run `npm pack` after the build to generate a distributable tarball.
  --help           Show this message.

Examples:
  scripts/install.sh
  scripts/install.sh --prefix /usr/local/bin
  scripts/install.sh --pack
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --prefix)
      [[ $# -lt 2 ]] && { echo "Missing value for --prefix" >&2; exit 1; }
      INSTALL_PREFIX="$2"
      shift 2
      ;;
    --pack)
      CREATE_PACKAGE=1
      shift
      ;;
    --help|-h)
      print_help
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      print_help
      exit 1
      ;;
  esac
done

echo "→ Using project root: ${ROOT_DIR}"
echo "→ Install prefix: ${INSTALL_PREFIX}"

if [[ ! -d "${ROOT_DIR}/node_modules" ]]; then
  echo "→ Installing dependencies (node_modules not found)…"
  (cd "${ROOT_DIR}" && npm install)
fi

echo "→ Building FazAI bundle…"
(cd "${ROOT_DIR}" && npm run build)

DIST_ENTRY="${ROOT_DIR}/dist/app.cjs"
if [[ ! -f "${DIST_ENTRY}" ]]; then
  echo "Build output not found at ${DIST_ENTRY}" >&2
  exit 1
fi

mkdir -p "${INSTALL_PREFIX}"
cp "${DIST_ENTRY}" "${INSTALL_PREFIX}/fazai"
chmod +x "${INSTALL_PREFIX}/fazai"

echo "✔ Installed FazAI CLI to ${INSTALL_PREFIX}/fazai"
echo "  Make sure ${INSTALL_PREFIX} is present in your PATH."

if [[ ${CREATE_PACKAGE} -eq 1 ]]; then
  echo "→ Creating npm package tarball…"
  (cd "${ROOT_DIR}" && npm pack)
fi
