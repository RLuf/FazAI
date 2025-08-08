#!/bin/bash
set -e

export NODE_PATH="$(pwd)/tests/stubs/node_modules"

sudo mkdir -p /opt/fazai/lib /var/log/fazai
sudo touch /opt/fazai/lib/main.js
printf '{"timestamp":"2024-01-01T00:00:00Z","level":"info","message":"ok"}\n' | sudo tee /var/log/fazai/fazai.log >/dev/null

HELP_OUTPUT=$(node ./bin/fazai help)
if ! echo "$HELP_OUTPUT" | grep -q "FazAI - Orquestrador"; then
  echo "unexpected help output" >&2
  echo "$HELP_OUTPUT" >&2
  exit 1
fi

LOG_OUTPUT=$(node ./bin/fazai logs 1)
if ! echo "$LOG_OUTPUT" | grep -q "Últimas 1 entradas de log"; then
  echo "logs command failed" >&2
  echo "$LOG_OUTPUT" >&2
  exit 1
fi

sudo rm -rf /opt/fazai /var/log/fazai
