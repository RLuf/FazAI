#!/bin/bash
# Quick fix for Python.h dependency issue

set -euo pipefail

echo "=== Quick Fix: Rebuilding without Python extensions ==="

cd /home/rluft/fazai/worker/build

# Clean and reconfigure
rm -rf CMakeFiles/ CMakeCache.txt
cmake .. -DCMAKE_BUILD_TYPE=Release -DCMAKE_INSTALL_PREFIX=/opt/fazai

# Build only what we need
echo "Building worker without Python extensions..."
if make fazai-gemma-worker -j$(nproc) 2>&1 | tee quick_build.log; then
    echo "✅ Build successful!"
    ls -lh fazai-gemma-worker
    
    # Install
    sudo make install
    echo "✅ Worker installed successfully!"
    
    # Quick test
    /opt/fazai/bin/fazai-gemma-worker --version
    
else
    echo "❌ Build still failing. Checking errors..."
    grep -i "error\|undefined" quick_build.log | tail -10
fi
