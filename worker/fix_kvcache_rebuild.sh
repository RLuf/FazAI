#!/bin/bash
# Fix KVCache API compatibility and rebuild

set -euo pipefail

echo "=== Rebuilding with KVCache API fixes ==="

cd /home/rluft/fazai/worker/build

# Clean build
rm -rf CMakeFiles/ CMakeCache.txt *.a

# Reconfigure
cmake .. -DCMAKE_BUILD_TYPE=Release -DCMAKE_INSTALL_PREFIX=/opt/fazai

# Build with fixes
echo "Building with KVCache compatibility fixes..."
if make fazai-gemma-worker -j$(nproc) 2>&1 | tee kvcache_build.log; then
    echo "✅ Build successful with KVCache fixes!"
    ls -lh fazai-gemma-worker
    
    # Install
    sudo make install
    echo "✅ Worker installed successfully!"
    
    # Test
    echo "Testing worker..."
    /opt/fazai/bin/fazai-gemma-worker --version || echo "Version check failed but binary exists"
    
else
    echo "❌ Build failed. Checking errors..."
    grep -i "error" kvcache_build.log | tail -5
fi
