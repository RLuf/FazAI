#!/bin/bash
# Wrapper script to run FazAI Gemma Worker stability tests

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEST_SCRIPT="$SCRIPT_DIR/test_worker_stability.sh"

echo "=== FazAI Gemma Worker Test Runner ==="

# Make test script executable
chmod +x "$TEST_SCRIPT"

# Check if we have required dependencies
echo "Checking dependencies..."

# Check for required tools
MISSING_DEPS=()

if ! command -v cmake >/dev/null 2>&1; then
    MISSING_DEPS+=("cmake")
fi

if ! command -v make >/dev/null 2>&1; then
    MISSING_DEPS+=("make")
fi

if ! command -v nc >/dev/null 2>&1; then
    MISSING_DEPS+=("netcat")
fi

if ! command -v jq >/dev/null 2>&1; then
    MISSING_DEPS+=("jq")
fi

if [[ ${#MISSING_DEPS[@]} -gt 0 ]]; then
    echo "ERROR: Missing required dependencies: ${MISSING_DEPS[*]}"
    echo "Please install them first:"
    echo "  sudo apt-get update"
    echo "  sudo apt-get install cmake make netcat-openbsd jq"
    exit 1
fi

echo "✓ All dependencies available"

# Stop any existing worker processes
echo "Stopping existing worker processes..."
sudo systemctl stop fazai-gemma-worker 2>/dev/null || true
pkill -f "fazai-gemma-worker" 2>/dev/null || true
sleep 2

echo "✓ Existing processes stopped"

# Run the stability test
echo "Running stability test..."
echo "----------------------------------------"

if "$TEST_SCRIPT"; then
    echo "----------------------------------------"
    echo "✅ ALL TESTS PASSED!"
    echo ""
    echo "The worker stability fixes have been validated."
    echo "You can now safely restart the production service:"
    echo ""
    echo "  sudo systemctl start fazai-gemma-worker"
    echo "  sudo systemctl enable fazai-gemma-worker"
    echo ""
    echo "Monitor the service with:"
    echo "  journalctl -u fazai-gemma-worker -f"
    exit 0
else
    echo "----------------------------------------"
    echo "❌ TESTS FAILED!"
    echo ""
    echo "Some issues were detected. Check the output above for details."
    echo "The worker may still have stability issues that need to be addressed."
    exit 1
fi
