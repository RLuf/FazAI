#!/bin/bash
set -euo pipefail

SOCK=/run/fazai/gemma.sock
SERVICE=fazai-gemma-worker.service

# Start service and wait for socket
sudo systemctl daemon-reload
sudo systemctl enable --now ${SERVICE}

for i in {1..20}; do
  if [ -S "$SOCK" ]; then
    echo "Socket available"
    break
  fi
  sleep 0.5
done

if [ ! -S "$SOCK" ]; then
  echo "Socket not available" >&2
  sudo journalctl -u ${SERVICE} -n 200 --no-pager
  exit 1
fi

# Run the python test client
python3 ../../tests/test_client.py || true

# Stop service
sudo systemctl stop ${SERVICE}

# Ensure it's stopped
sleep 0.5
if systemctl is-active --quiet ${SERVICE}; then
  echo "Service did not stop cleanly" >&2
  sudo systemctl status ${SERVICE}
  exit 1
fi

echo "Integration test completed"