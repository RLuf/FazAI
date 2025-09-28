#!/bin/bash
# Quick test runner for FazAI Gemma Worker

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "=== FazAI Gemma Worker Quick Test ==="

# Make scripts executable
chmod +x "$SCRIPT_DIR/test_worker_stability.sh"
chmod +x "$SCRIPT_DIR/setup_gemma_env.sh"
chmod +x "$SCRIPT_DIR/run_tests.sh"

echo "✓ Scripts made executable"

# Check if model file exists with correct path
MODEL_FILE="/opt/fazai/models/gemma/2.0-2b-it-sfp.sbs"
if [[ -f "$MODEL_FILE" ]]; then
    echo "✓ Model file found: $MODEL_FILE"
    ls -lh "$MODEL_FILE"
else
    echo "⚠ Model file not found at: $MODEL_FILE"
    echo "Checking for alternative locations..."
    find /opt/fazai/models -name "*.sbs" 2>/dev/null || echo "No .sbs files found"
fi

# Run the stability test
echo ""
echo "Running stability test..."
echo "----------------------------------------"

exec "$SCRIPT_DIR/test_worker_stability.sh"
