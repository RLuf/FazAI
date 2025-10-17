#!/usr/bin/env bash
# FazAI Codex bootstrapper
# Marca pessoal de Codex + Andarilho dos Véus para ambientar a missão antes de iniciar o CLI.

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DIST_FILE="${ROOT_DIR}/dist/app.cjs"
CONTEXT_FILE="${ROOT_DIR}/context/andarilho-context.md"

banner() {
  cat <<'EOF'
╔══════════════════════════════════════════════════════════════╗
║                     CODEX // ANDARILHO                        ║
╠══════════════════════════════════════════════════════════════╣
║  “Tecnologia em vigília, humanidade no comando.”              ║
║  FazAI 3.0-RC · Missão: guiar com segurança e visão de futuro ║
╚══════════════════════════════════════════════════════════════╝
EOF
}

note_context() {
  if [[ -f "${CONTEXT_FILE}" ]]; then
    echo
    echo "📜 Contexto do Andarilho dos Véus:"
    echo "----------------------------------"
    cat "${CONTEXT_FILE}"
    echo "----------------------------------"
  else
    echo
    echo "⚠️  Nenhum contexto persistente encontrado em ${CONTEXT_FILE}."
    echo "    Crie o arquivo para registrar a memória estratégica do projeto."
  fi
}

ensure_build() {
  if [[ ! -f "${DIST_FILE}" ]]; then
    echo "🔧 Build não encontrado. Executando npm run build..."
    (cd "${ROOT_DIR}" && npm run build)
  fi
}

main() {
  banner
  note_context
  ensure_build
  echo
  echo "🚀 Iniciando FazAI Codex CLI..."
  echo "------------------------------------------------------------"
  echo
  exec node "${DIST_FILE}" --cli
}

main "$@"
