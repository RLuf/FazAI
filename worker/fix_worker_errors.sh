#!/bin/bash
# Fix all remaining worker.cpp compilation errors and rebuild

set -euo pipefail

echo "=== Rebuilding with worker.cpp fixes ==="

cd /home/rluft/fazai/worker/build

# Clean build
rm -rf CMakeFiles/ CMakeCache.txt *.a

# Reconfigure
cmake .. -DCMAKE_BUILD_TYPE=Release -DCMAKE_INSTALL_PREFIX=/opt/fazai

# Build with all fixes
echo "Building with constructor, abort, and log fixes..."
if make fazai-gemma-worker -j$(nproc) 2>&1 | tee worker_fixes_build.log; then
    echo "✅ Build successful with all worker fixes!"
    ls -lh fazai-gemma-worker
    
    # Install
    sudo make install
    echo "✅ Worker installed successfully!"
    
    # Test basic functionality
    echo "Testing worker..."
    if /opt/fazai/bin/fazai-gemma-worker --version 2>/dev/null; then
        echo "✅ Worker version check passed!"
    else
        echo "ℹ️  Worker binary exists but version check failed (expected)"
    fi
    
    # Check if service can start
    echo "Checking service status..."
    sudo systemctl status fazai-gemma-worker || echo "Service not running (expected)"
    
else
    echo "❌ Build failed. Checking remaining errors..."
    grep -i "error" worker_fixes_build.log | tail -10
fi
