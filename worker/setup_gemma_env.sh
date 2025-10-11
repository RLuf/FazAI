#!/bin/bash
# Setup script for FazAI Gemma Worker environment

set -euo pipefail

echo "=== FazAI Gemma Worker Environment Setup ==="

# Define paths - .sbs file already includes tokenizer
GEMMA_WEIGHTS="/opt/fazai/models/gemma/2.0-2b-it-sfp.sbs"
GEMMA_MODEL_TYPE="gemma2-2b-it"

# Check if model file exists
echo "Checking model file..."
if [[ ! -f "$GEMMA_WEIGHTS" ]]; then
    echo "ERROR: Weights file not found: $GEMMA_WEIGHTS"
    echo "Note: The .sbs file should include both weights and tokenizer"
    exit 1
fi

echo "✓ Weights file found: $GEMMA_WEIGHTS"

# Check file permissions
echo "Checking file permissions..."
if [[ ! -r "$GEMMA_WEIGHTS" ]]; then
    echo "WARNING: Weights file not readable, fixing permissions..."
    sudo chmod 644 "$GEMMA_WEIGHTS"
fi

# Create environment file
ENV_FILE="/etc/fazai/gemma.env"
echo "Creating environment file: $ENV_FILE"
sudo mkdir -p "$(dirname "$ENV_FILE")"

sudo tee "$ENV_FILE" > /dev/null << EOF
# FazAI Gemma Worker Environment Variables
FAZAI_GEMMA_WEIGHTS=$GEMMA_WEIGHTS
FAZAI_GEMMA_MODEL_TYPE=$GEMMA_MODEL_TYPE
FAZAI_GEMMA_SOCKET=/run/fazai/gemma.sock
FAZAI_ALLOW_SHELL_EXEC=1
EOF

echo "✓ Environment file created: $ENV_FILE"

# Update systemd service to use environment file
SERVICE_FILE="/etc/systemd/system/fazai-gemma-worker.service"
if [[ -f "$SERVICE_FILE" ]]; then
    echo "Updating systemd service to use environment file..."
    sudo sed -i '/EnvironmentFile=/d' "$SERVICE_FILE"
    sudo sed -i '/\[Service\]/a EnvironmentFile=-/etc/fazai/gemma.env' "$SERVICE_FILE"
    sudo systemctl daemon-reload
    echo "✓ Systemd service updated"
fi

# Test model file access
echo "Testing model file access..."
if timeout 5s head -c 1024 "$GEMMA_WEIGHTS" > /dev/null; then
    echo "✓ Weights file accessible"
else
    echo "ERROR: Cannot read weights file"
    exit 1
fi

echo ""
echo "=== Environment Setup Complete ==="
echo "Environment variables:"
echo "  FAZAI_GEMMA_WEIGHTS=$GEMMA_WEIGHTS"
echo "  FAZAI_GEMMA_MODEL_TYPE=$GEMMA_MODEL_TYPE"
echo ""
echo "Note: The .sbs file includes both weights and tokenizer"
echo ""
echo "To test the worker manually:"
echo "  source $ENV_FILE"
echo "  /opt/fazai/bin/fazai-gemma-worker"
echo ""
echo "To start the service:"
echo "  sudo systemctl start fazai-gemma-worker"
