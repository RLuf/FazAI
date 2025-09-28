#!/bin/bash
# Monitor build progress and detect issues

set -euo pipefail

BUILD_DIR="/home/rluft/fazai/worker/build"
LOG_FILE="$BUILD_DIR/build.log"

echo "=== Build Monitor ==="

# Check if build is running
if pgrep -f "make.*fazai-gemma-worker" >/dev/null; then
    echo "✓ Build process detected"
else
    echo "⚠ No active build process found"
fi

# Monitor build directory
if [[ -d "$BUILD_DIR" ]]; then
    echo "Build directory: $BUILD_DIR"
    
    # Check for common build artifacts
    if [[ -f "$BUILD_DIR/CMakeCache.txt" ]]; then
        echo "✓ CMake configuration completed"
    fi
    
    if [[ -f "$BUILD_DIR/Makefile" ]]; then
        echo "✓ Makefile generated"
    fi
    
    # Look for object files (compilation progress)
    OBJ_COUNT=$(find "$BUILD_DIR" -name "*.o" 2>/dev/null | wc -l)
    echo "Object files compiled: $OBJ_COUNT"
    
    # Check for the target binary
    if [[ -f "$BUILD_DIR/fazai-gemma-worker" ]]; then
        echo "✅ Binary compiled successfully!"
        ls -lh "$BUILD_DIR/fazai-gemma-worker"
    else
        echo "⏳ Binary not ready yet..."
    fi
    
    # Monitor for errors in recent output
    if [[ -f "$LOG_FILE" ]]; then
        echo ""
        echo "Recent build output:"
        tail -10 "$LOG_FILE" 2>/dev/null || echo "No log file available"
    fi
else
    echo "❌ Build directory not found: $BUILD_DIR"
fi

echo ""
echo "To check build status manually:"
echo "  cd $BUILD_DIR && make -j\$(nproc)"
echo ""
echo "To monitor in real-time:"
echo "  watch -n 2 'ls -la $BUILD_DIR/fazai-gemma-worker 2>/dev/null || echo \"Still building...\"'"
