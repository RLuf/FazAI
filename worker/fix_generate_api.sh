#!/bin/bash
# Fix Generate API call with correct KVCache usage

set -euo pipefail

echo "=== Rebuilding with corrected Generate API ==="

cd /home/rluft/fazai/worker/build

# Stop any running processes
pkill -f "fazai-gemma-worker" || true

# Clean build
rm -rf CMakeFiles/ CMakeCache.txt *.a

# Reconfigure
cmake .. -DCMAKE_BUILD_TYPE=Release -DCMAKE_INSTALL_PREFIX=/opt/fazai

# Build with corrected API
echo "Building with corrected Generate(rc, pspan, pos, kv_cache, ti) call..."
if make fazai-gemma-worker -j$(nproc) 2>&1 | tee generate_api_build.log; then
    echo "✅ Build successful with corrected API!"
    ls -lh fazai-gemma-worker
    
    # Install
    sudo make install
    echo "✅ Worker installed successfully!"
    
    # Quick test
    echo "Testing worker startup and basic functionality..."
    export FAZAI_GEMMA_SOCKET="/tmp/test-gemma.sock"
    export FAZAI_GEMMA_MODEL="/opt/fazai/models/gemma/2.0-2b-it-sfp.sbs"
    
    timeout 15s /opt/fazai/bin/fazai-gemma-worker > /tmp/worker-test.log 2>&1 &
    WORKER_PID=$!
    
    sleep 5
    if kill -0 $WORKER_PID 2>/dev/null; then
        echo "✅ Worker starts successfully!"
        
        # Test basic IPC
        if [[ -S "/tmp/test-gemma.sock" ]]; then
            echo "✅ Socket created successfully!"
            echo '{"action": "create_session", "params": {}}' | nc -U /tmp/test-gemma.sock > /tmp/session_test.json 2>&1 &
            sleep 2
            pkill nc || true
            
            if [[ -f /tmp/session_test.json ]] && grep -q "session_id" /tmp/session_test.json; then
                echo "✅ Session creation works!"
            else
                echo "⚠ Session creation may have issues"
            fi
        fi
        
        kill $WORKER_PID
    else
        echo "❌ Worker crashed on startup"
        cat /tmp/worker-test.log
    fi
    
    # Cleanup
    rm -f /tmp/test-gemma.sock /tmp/worker-test.log /tmp/session_test.json
    
else
    echo "❌ Build failed. Checking errors..."
    grep -i "error" generate_api_build.log | tail -5
fi
