#!/usr/bin/env bash
set -euo pipefail

echo "== Verificação do FazAI: Engine e Módulo Nativo =="

ok() { echo -e "[OK]  $*"; }
warn() { echo -e "[??]  $*"; }
err() { echo -e "[ERR] $*"; }

# 1) Gemma Worker
if [ -x /opt/fazai/bin/fazai-gemma-worker ]; then
  /opt/fazai/bin/fazai-gemma-worker --version || true
  ok "fazai-gemma-worker presente"
else
  warn "fazai-gemma-worker ausente em /opt/fazai/bin. Rode: (cd worker && ./build.sh && sudo make install)"
fi

# Serviço
if command -v systemctl >/dev/null 2>&1; then
  if systemctl is-enabled fazai-gemma-worker >/dev/null 2>&1; then ok "serviço fazai-gemma-worker habilitado"; else warn "serviço fazai-gemma-worker não habilitado"; fi
  if systemctl is-active fazai-gemma-worker >/dev/null 2>&1; then ok "serviço fazai-gemma-worker ativo"; else warn "serviço fazai-gemma-worker inativo"; fi
fi

# Socket
SOCK=${FAZAI_GEMMA_SOCKET:-/run/fazai/gemma.sock}
if [ -S "$SOCK" ]; then ok "socket do worker disponível: $SOCK"; else warn "socket não encontrado em $SOCK (inicie o serviço)"; fi

# 2) Provider Node
PROV="/opt/fazai/lib/providers/gemma-worker.js"
if [ -f "$PROV" ]; then ok "provider Node OK: $PROV"; else err "provider não encontrado: $PROV"; fi

# 3) Agente (endpoint)
API=${FAZAI_API_URL:-http://127.0.0.1:3120}
if command -v curl >/dev/null 2>&1; then
  if curl -fsS "$API/agent/status" >/dev/null 2>&1; then ok "/agent/status responde"; else warn "/agent/status indisponível em $API"; fi
else
  warn "curl não disponível para verificar API"
fi

# 4) Módulo Nativo (check)
MODDIR="/opt/fazai/lib/mods"
if [ -d "$MODDIR" ]; then
  (cd "$MODDIR" && bash compile_system_mod.sh --check) && ok "dependências do system_mod verificadas" || warn "verificação encontrou pendências"
else
  warn "diretório de mods não encontrado: $MODDIR"
fi

echo "== Fim da verificação =="

