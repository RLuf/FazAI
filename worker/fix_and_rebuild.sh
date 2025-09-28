#!/bin/bash
# Fix compilation issues and rebuild with personality integration

set -euo pipefail

WORKER_DIR="/home/rluft/fazai/worker"
BUILD_DIR="$WORKER_DIR/build"

echo "=== Fixing Compilation Issues and Rebuilding ==="

cd "$WORKER_DIR"

# Clean build directory
echo "Cleaning build directory..."
rm -rf "$BUILD_DIR"
mkdir -p "$BUILD_DIR"
cd "$BUILD_DIR"

# Configure with debug info for better error tracking
echo "Configuring build..."
cmake .. -DCMAKE_BUILD_TYPE=Debug -DCMAKE_INSTALL_PREFIX=/opt/fazai

# Build with verbose output to catch errors
echo "Building with verbose output..."
if make VERBOSE=1 -j$(nproc) 2>&1 | tee build.log; then
    echo "✅ Build successful!"
    echo "Binary info:"
    ls -lh fazai-gemma-worker
    
    # Install if build succeeded
    echo "Installing..."
    sudo make install
    
    echo "✅ Installation complete!"
    echo "Worker location: /opt/fazai/bin/fazai-gemma-worker"
    
else
    echo "❌ Build failed. Error analysis:"
    echo ""
    echo "=== Compilation Errors ==="
    grep -A 5 -B 5 "error:" build.log || echo "No explicit errors found"
    echo ""
    echo "=== Missing Symbols ==="
    grep -A 3 "undefined reference" build.log || echo "No undefined references"
    echo ""
    echo "=== Last 30 lines ==="
    tail -30 build.log
    
    exit 1
fi

echo ""
echo "=== Next Steps ==="
echo "1. Test personality integration: ./test_worker_stability.sh"
echo "2. Check Qdrant connection: node qdrant_personality.js"
echo "3. Start service: sudo systemctl restart fazai-gemma-worker"
