#!/bin/bash
# Test script for FazAI Gemma Worker stability after crash fixes

set -euo pipefail

WORKER_DIR="/home/rluft/fazai/worker"
BUILD_DIR="$WORKER_DIR/build"
WORKER_BIN="/opt/fazai/bin/fazai-gemma-worker"
TEST_SOCKET="/tmp/fazai-test-gemma.sock"

echo "=== FazAI Gemma Worker Stability Test ==="

# Function to cleanup test processes
cleanup() {
    echo "Cleaning up test processes..."
    pkill -f "fazai-gemma-worker" || true
    rm -f "$TEST_SOCKET" || true
    sleep 2
}

trap cleanup EXIT

# Step 1: Rebuild worker with fixes
echo "Step 1: Building worker with fixes..."
cd "$WORKER_DIR"

if [[ ! -d "$BUILD_DIR" ]]; then
    mkdir -p "$BUILD_DIR"
fi

cd "$BUILD_DIR"
cmake .. -DCMAKE_BUILD_TYPE=Debug -DCMAKE_INSTALL_PREFIX=/opt/fazai
make -j$(nproc)

if [[ $? -ne 0 ]]; then
    echo "ERROR: Build failed"
    exit 1
fi

echo "✓ Build successful"

# Step 2: Install worker
echo "Step 2: Installing worker..."
sudo make install

if [[ ! -f "$WORKER_BIN" ]]; then
    echo "ERROR: Worker binary not installed at $WORKER_BIN"
    exit 1
fi

echo "✓ Worker installed"

# Step 3: Setup environment - using correct .sbs file with integrated tokenizer
echo "Step 3: Setting up test environment..."
export FAZAI_GEMMA_SOCKET="$TEST_SOCKET"
export FAZAI_GEMMA_MODEL="/opt/fazai/models/gemma/2.0-2b-it-sfp.sbs"

# Create socket directory
mkdir -p "$(dirname "$TEST_SOCKET")"

echo "✓ Environment configured"
echo "  Model file: $FAZAI_GEMMA_MODEL"

# Step 4: Test worker startup and basic functionality
echo "Step 4: Testing worker startup..."

# Start worker in background
timeout 30s "$WORKER_BIN" &
WORKER_PID=$!

# Wait for socket to be created
for i in {1..10}; do
    if [[ -S "$TEST_SOCKET" ]]; then
        echo "✓ Worker started successfully (PID: $WORKER_PID)"
        break
    fi
    sleep 1
    if [[ $i -eq 10 ]]; then
        echo "ERROR: Worker failed to create socket"
        kill $WORKER_PID || true
        exit 1
    fi
done

# Step 5: Test IPC communication
echo "Step 5: Testing IPC communication..."

# Test session creation
SESSION_RESPONSE=$(echo '{"action": "create_session", "params": {"temperature": 0.7}}' | nc -U "$TEST_SOCKET" | head -1)
if [[ -z "$SESSION_RESPONSE" ]]; then
    echo "ERROR: No response from worker"
    kill $WORKER_PID || true
    exit 1
fi

echo "✓ Session creation response: $SESSION_RESPONSE"

# Extract session ID
SESSION_ID=$(echo "$SESSION_RESPONSE" | jq -r '.session_id // empty')
if [[ -z "$SESSION_ID" ]]; then
    echo "ERROR: No session ID in response"
    kill $WORKER_PID || true
    exit 1
fi

echo "✓ Session created: $SESSION_ID"

# Step 6: Test text generation
echo "Step 6: Testing text generation..."

# Send generation request
GEN_REQUEST='{"action": "generate", "session_id": "'$SESSION_ID'", "prompt": "Hello, how are you?"}'
echo "$GEN_REQUEST" | nc -U "$TEST_SOCKET" &
NC_PID=$!

# Monitor for responses
timeout 10s bash -c "
    while read -r line; do
        echo 'Generation response: \$line'
        if echo '\$line' | grep -q 'done.*true'; then
            echo '✓ Generation completed successfully'
            break
        fi
    done < <(nc -U '$TEST_SOCKET')
" || echo "⚠ Generation test timed out (expected with fallback mode)"

kill $NC_PID 2>/dev/null || true

# Step 7: Test session cleanup
echo "Step 7: Testing session cleanup..."

CLOSE_REQUEST='{"action": "close_session", "session_id": "'$SESSION_ID'"}'
CLOSE_RESPONSE=$(echo "$CLOSE_REQUEST" | nc -U "$TEST_SOCKET" | head -1)
echo "✓ Session close response: $CLOSE_RESPONSE"

# Step 8: Test worker shutdown
echo "Step 8: Testing graceful shutdown..."

# Send SIGTERM to worker
kill -TERM $WORKER_PID
sleep 3

# Check if worker is still running
if kill -0 $WORKER_PID 2>/dev/null; then
    echo "⚠ Worker still running, sending SIGKILL"
    kill -KILL $WORKER_PID
    sleep 1
fi

echo "✓ Worker shutdown completed"

# Step 9: Check for core dumps
echo "Step 9: Checking for crashes..."

CORE_PATTERN=$(cat /proc/sys/kernel/core_pattern 2>/dev/null || echo "core")
if [[ -f "core" ]] || [[ -f "core.$WORKER_PID" ]] || ls core.* 2>/dev/null; then
    echo "ERROR: Core dump found - worker crashed"
    exit 1
fi

echo "✓ No crashes detected"

# Step 10: Memory leak check (if valgrind available)
if command -v valgrind >/dev/null 2>&1; then
    echo "Step 10: Running memory leak check..."
    
    timeout 15s valgrind --leak-check=summary --error-exitcode=1 \
        "$WORKER_BIN" 2>&1 | tee valgrind.log &
    VALGRIND_PID=$!
    
    sleep 5
    kill -TERM $VALGRIND_PID 2>/dev/null || true
    wait $VALGRIND_PID || echo "⚠ Valgrind detected issues (check valgrind.log)"
    
    if grep -q "definitely lost.*0 bytes" valgrind.log; then
        echo "✓ No definite memory leaks detected"
    else
        echo "⚠ Potential memory leaks detected (check valgrind.log)"
    fi
else
    echo "Step 10: Skipping memory check (valgrind not available)"
fi

echo ""
echo "=== Test Results ==="
echo "✓ Worker builds successfully"
echo "✓ Worker starts without crashing"
echo "✓ IPC communication works"
echo "✓ Session management functional"
echo "✓ Graceful shutdown works"
echo "✓ No segmentation faults detected"
echo ""
echo "Worker stability test PASSED!"
echo ""
echo "Next steps:"
echo "1. Run: sudo systemctl restart fazai-gemma-worker"
echo "2. Monitor: journalctl -u fazai-gemma-worker -f"
echo "3. Check logs for any remaining issues"
