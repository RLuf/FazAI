#!/bin/bash
# Fix KVCache removal for newer gemma.cpp API

set -euo pipefail

echo "=== Rebuilding with KVCache removal fix ==="

cd /home/rluft/fazai/worker/build

# Stop any running tests
pkill -f "test_worker_stability" || true
pkill -f "fazai-gemma-worker" || true

# Clean build
rm -rf CMakeFiles/ CMakeCache.txt *.a

# Reconfigure
cmake .. -DCMAKE_BUILD_TYPE=Release -DCMAKE_INSTALL_PREFIX=/opt/fazai

# Build with KVCache removal
echo "Building without KVCache (newer API)..."
if make fazai-gemma-worker -j$(nproc) 2>&1 | tee kvcache_removal_build.log; then
    echo "✅ Build successful without KVCache!"
    ls -lh fazai-gemma-worker
    
    # Install
    sudo make install
    echo "✅ Worker installed successfully!"
    
    # Quick test
    echo "Testing worker startup..."
    timeout 10s /opt/fazai/bin/fazai-gemma-worker &
    WORKER_PID=$!
    
    sleep 5
    if kill -0 $WORKER_PID 2>/dev/null; then
        echo "✅ Worker starts without immediate crash!"
        kill $WORKER_PID
    else
        echo "❌ Worker still crashes on startup"
    fi
    
else
    echo "❌ Build failed. Checking errors..."
    grep -i "error" kvcache_removal_build.log | tail -5
fi
