#!/bin/bash
# Check build errors and attempt to fix them

set -euo pipefail

BUILD_DIR="/home/rluft/fazai/worker/build"
cd "$BUILD_DIR"

echo "=== Checking Build Errors ==="

# Try to build and capture errors
if make -j$(nproc) 2>&1 | tee build_output.log; then
    echo "✅ Build successful!"
    ls -lh fazai-gemma-worker
else
    echo "❌ Build failed. Analyzing errors..."
    echo ""
    echo "=== Build Errors ==="
    grep -i "error:" build_output.log || echo "No explicit errors found"
    echo ""
    echo "=== Warnings ==="
    grep -i "warning:" build_output.log || echo "No warnings found"
    echo ""
    echo "=== Last 20 lines of output ==="
    tail -20 build_output.log
fi
