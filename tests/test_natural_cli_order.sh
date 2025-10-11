#!/bin/bash
# FazAI - Teste de ordem em linguagem natural via CLI
# Objetivo: validar conexão CLI → Worker e resposta ND-JSON

set -euo pipefail

NL_PROMPT="leia o arquivo de configuracao de sshd veja a porta configurada, em seguida veja a porta no linux se esta ouvindo, entao crie uma regra no iptables para aceitar tudo nessa porta"

echo "[TEST] Verificando serviço do worker..."
systemctl is-active --quiet fazai-gemma-worker || {
  echo "[WARN] Worker inativo; tentando iniciar..."
  systemctl start fazai-gemma-worker || true
  sleep 1
}

echo "[TEST] Verificando socket..."
SOCK="/run/fazai/gemma.sock"
for i in {1..25}; do
  if [ -S "$SOCK" ]; then
    break
  fi
  sleep 0.2
done

if [ ! -S "$SOCK" ]; then
  echo "[FAIL] Socket não encontrado: $SOCK"; exit 1
fi
ls -l "$SOCK" || true

echo "[TEST] Executando CLI (modo seguro; sem execução de shell)"
export FAZAI_ALLOW_SHELL_EXEC=0

CMD=(python3 /opt/fazai/bin/fazai_mcp_client.py ask "$NL_PROMPT")
set +e
OUT=$(timeout 45 "${CMD[@]}" 2>&1)
RC=$?
set -e

echo "[DEBUG] Saída do CLI:"; echo "$OUT" | sed 's/^/  > /'

if [ $RC -ne 0 ]; then
  echo "[FAIL] CLI retornou código $RC"; exit 1
fi

if [ -z "$OUT" ]; then
  echo "[FAIL] Resposta vazia do worker"; exit 1
fi

echo "[PASS] CLI respondeu. Verifique se o plano inclui checagem de sshd/porta/iptables."
echo "[INFO] Para executar comandos reais, exporte FAZAI_ALLOW_SHELL_EXEC=1 (cuidado: requer root)."

