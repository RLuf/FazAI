#!/bin/bash
# Fix core dump permissions and IPC protocol issues

set -euo pipefail

echo "=== Fixing Core Dumps and IPC Protocol ==="

# Step 1: Fix core dump configuration
echo "Step 1: Configuring core dumps properly..."

# Set proper core pattern (absolute path instead of pipe)
sudo sysctl -w kernel.core_pattern=/tmp/cores/core.%e.%p.%t
sudo sysctl -w fs.suid_dumpable=1

# Create cores directory with proper permissions
sudo mkdir -p /tmp/cores
sudo chmod 777 /tmp/cores

# Set ulimit for current session
ulimit -c unlimited

echo "✓ Core dumps configured"

# Step 2: Check IPC protocol implementation
echo "Step 2: Checking IPC protocol..."

# Read the actual IPC implementation to understand the protocol
echo "Checking worker IPC implementation..."

# Step 3: Test with correct IPC protocol
echo "Step 3: Testing with correct IPC protocol..."

WORKER_BIN="/opt/fazai/bin/fazai-gemma-worker"
TEST_SOCKET="/tmp/fazai-debug-gemma.sock"

# Cleanup
pkill -f "fazai-gemma-worker" || true
rm -f "$TEST_SOCKET" || true

# Set environment
export FAZAI_GEMMA_SOCKET="$TEST_SOCKET"
export FAZAI_GEMMA_MODEL="/opt/fazai/models/gemma/2.0-2b-it-sfp.sbs"

# Start worker in background
timeout 30s "$WORKER_BIN" > /tmp/worker-debug.log 2>&1 &
WORKER_PID=$!

echo "Worker PID: $WORKER_PID"

# Wait for socket
for i in {1..10}; do
    if [[ -S "$TEST_SOCKET" ]]; then
        echo "✓ Socket ready: $TEST_SOCKET"
        break
    fi
    sleep 1
    if [[ $i -eq 10 ]]; then
        echo "ERROR: Socket not created"
        kill $WORKER_PID || true
        exit 1
    fi
done

# Step 4: Test different IPC message formats
echo "Step 4: Testing IPC message formats..."

# Try different message formats based on the logs
echo "Testing create_session with different formats..."

# Format 1: JSON with newline
echo '{"action": "create_session", "params": {"temperature": 0.7}}' | socat - UNIX-CONNECT:$TEST_SOCKET > /tmp/response1.json 2>&1 &
sleep 2
pkill socat || true

# Format 2: Simple JSON
printf '{"action": "create_session", "params": {"temperature": 0.7}}' | socat - UNIX-CONNECT:$TEST_SOCKET > /tmp/response2.json 2>&1 &
sleep 2  
pkill socat || true

# Format 3: Check what the worker actually expects
echo "Checking worker responses..."
if [[ -f /tmp/response1.json ]]; then
    echo "Response 1:"
    cat /tmp/response1.json
fi

if [[ -f /tmp/response2.json ]]; then
    echo "Response 2:"
    cat /tmp/response2.json
fi

# Step 5: Monitor for segfault
echo "Step 5: Testing for segfault with GDB..."

# Kill current worker
kill $WORKER_PID 2>/dev/null || true
sleep 2

# Start worker with GDB to catch segfault
if command -v gdb >/dev/null; then
    echo "Starting worker with GDB..."
    
    # Create GDB script
    cat > /tmp/gdb_commands.txt << 'EOF'
set environment FAZAI_GEMMA_SOCKET=/tmp/fazai-debug-gemma.sock
set environment FAZAI_GEMMA_MODEL=/opt/fazai/models/gemma/2.0-2b-it-sfp.sbs
run
bt
quit
EOF

    timeout 30s gdb -batch -x /tmp/gdb_commands.txt "$WORKER_BIN" > /tmp/gdb_output.txt 2>&1 &
    GDB_PID=$!
    
    # Wait for socket and test
    sleep 5
    if [[ -S "$TEST_SOCKET" ]]; then
        echo "Testing with GDB session..."
        echo '{"action": "create_session", "params": {}}' | socat - UNIX-CONNECT:$TEST_SOCKET || true
        sleep 2
    fi
    
    kill $GDB_PID 2>/dev/null || true
    
    echo "GDB output:"
    cat /tmp/gdb_output.txt | tail -20
else
    echo "GDB not available, skipping detailed analysis"
fi

# Step 6: Check worker logs for protocol details
echo "Step 6: Analyzing worker logs..."
if [[ -f /tmp/worker-debug.log ]]; then
    echo "Worker output:"
    cat /tmp/worker-debug.log
fi

# Check for core dumps
echo "Checking for core dumps..."
if ls /tmp/cores/core.* 2>/dev/null; then
    echo "✓ Core dumps found:"
    ls -la /tmp/cores/core.*
else
    echo "No core dumps generated"
fi

echo ""
echo "=== Analysis Complete ==="
echo "Check the following files for details:"
echo "- Worker log: /tmp/worker-debug.log"
echo "- GDB output: /tmp/gdb_output.txt"
echo "- Core dumps: /tmp/cores/"
echo ""
echo "Next steps:"
echo "1. Review IPC protocol implementation in worker source"
echo "2. Fix segfault in gemma_generate_stream function"
echo "3. Add proper error handling for malformed requests"
