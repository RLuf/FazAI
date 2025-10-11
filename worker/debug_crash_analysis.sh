#!/bin/bash
# Debug script to analyze worker crashes during prompt processing

set -euo pipefail

WORKER_BIN="/opt/fazai/bin/fazai-gemma-worker"
TEST_SOCKET="/tmp/fazai-debug-gemma.sock"
LOG_FILE="/tmp/worker-debug.log"

echo "=== FazAI Worker Crash Analysis ==="

# Cleanup function
cleanup() {
    echo "Cleaning up..."
    pkill -f "fazai-gemma-worker" || true
    rm -f "$TEST_SOCKET" || true
}
trap cleanup EXIT

# Step 1: Enable core dumps
echo "Step 1: Configuring crash analysis..."
ulimit -c unlimited
echo "core.%p.%t" | sudo tee /proc/sys/kernel/core_pattern > /dev/null
mkdir -p /tmp/cores
cd /tmp/cores

# Step 2: Start worker with memory monitoring
echo "Step 2: Starting worker with monitoring..."
export FAZAI_GEMMA_SOCKET="$TEST_SOCKET"
export FAZAI_GEMMA_MODEL="/opt/fazai/models/gemma/2.0-2b-it-sfp.sbs"

# Monitor memory usage in background
(
    while true; do
        if pgrep -f "fazai-gemma-worker" > /dev/null; then
            ps -o pid,ppid,rss,vsz,pcpu,pmem,comm -p $(pgrep -f "fazai-gemma-worker") >> "$LOG_FILE"
        fi
        sleep 1
    done
) &
MONITOR_PID=$!

# Start worker
timeout 60s "$WORKER_BIN" > worker-output.log 2>&1 &
WORKER_PID=$!

echo "Worker PID: $WORKER_PID"
echo "Monitor PID: $MONITOR_PID"

# Wait for socket
for i in {1..15}; do
    if [[ -S "$TEST_SOCKET" ]]; then
        echo "✓ Worker started, socket ready"
        break
    fi
    sleep 1
    if [[ $i -eq 15 ]]; then
        echo "ERROR: Socket not created"
        kill $WORKER_PID $MONITOR_PID || true
        exit 1
    fi
done

# Step 3: Test minimal prompt that causes crash
echo "Step 3: Testing crash-inducing prompt..."

# Create session
echo "Creating session..."
SESSION_RESP=$(echo '{"action": "create_session", "params": {"temperature": 0.1, "max_tokens": 10}}' | nc -U "$TEST_SOCKET" | head -1)
echo "Session response: $SESSION_RESP"

SESSION_ID=$(echo "$SESSION_RESP" | jq -r '.session_id // empty')
if [[ -z "$SESSION_ID" ]]; then
    echo "ERROR: No session ID"
    exit 1
fi

echo "Session ID: $SESSION_ID"

# Send simple prompt that triggers crash
echo "Sending crash-inducing prompt..."
PROMPT_REQUEST='{"action": "generate", "session_id": "'$SESSION_ID'", "prompt": "Hi"}'

# Monitor worker process while sending prompt
echo "$PROMPT_REQUEST" | nc -U "$TEST_SOCKET" &
NC_PID=$!

# Wait and monitor
for i in {1..30}; do
    if ! kill -0 $WORKER_PID 2>/dev/null; then
        echo "❌ Worker crashed after $i seconds"
        CRASH_TIME=$i
        break
    fi
    
    # Check memory usage
    if ps -p $WORKER_PID -o rss= 2>/dev/null | awk '{if($1 > 500000) exit 1}'; then
        echo "⚠ High memory usage detected at $i seconds"
    fi
    
    sleep 1
done

kill $NC_PID $MONITOR_PID 2>/dev/null || true

# Step 4: Analyze crash
echo "Step 4: Analyzing crash..."

# Check exit code
wait $WORKER_PID
EXIT_CODE=$?
echo "Worker exit code: $EXIT_CODE"

case $EXIT_CODE in
    137) echo "ANALYSIS: Killed by SIGKILL (likely OOM killer)" ;;
    139) echo "ANALYSIS: Segmentation fault (SIGSEGV)" ;;
    134) echo "ANALYSIS: Aborted (SIGABRT)" ;;
    *) echo "ANALYSIS: Unknown exit code $EXIT_CODE" ;;
esac

# Check for core dumps
echo "Checking for core dumps..."
if ls core.* 2>/dev/null; then
    echo "✓ Core dump found:"
    ls -la core.*
    
    if command -v gdb >/dev/null; then
        echo "Analyzing with GDB..."
        gdb -batch -ex "bt" -ex "quit" "$WORKER_BIN" core.* > crash-backtrace.txt 2>&1
        echo "Backtrace saved to crash-backtrace.txt"
        head -20 crash-backtrace.txt
    fi
else
    echo "No core dumps found"
fi

# Check system logs
echo "Checking system logs..."
journalctl --since "5 minutes ago" | grep -i "killed\|oom\|memory" | tail -5

# Analyze memory usage
echo "Memory usage analysis:"
if [[ -f "$LOG_FILE" ]]; then
    echo "Peak memory usage:"
    sort -k3 -nr "$LOG_FILE" | head -3
    
    echo "Memory growth pattern:"
    tail -10 "$LOG_FILE"
fi

# Step 5: Recommendations
echo ""
echo "=== Crash Analysis Results ==="
echo "Exit code: $EXIT_CODE"
echo "Crash time: ${CRASH_TIME:-unknown} seconds"
echo "Log files:"
echo "  - Worker output: worker-output.log"
echo "  - Memory log: $LOG_FILE"
echo "  - Backtrace: crash-backtrace.txt (if available)"

echo ""
echo "=== Recommendations ==="
if [[ $EXIT_CODE -eq 137 ]]; then
    echo "1. Memory issue detected - check for memory leaks in generate_stream"
    echo "2. Consider reducing model memory usage or increasing system memory"
    echo "3. Add memory limits and monitoring to worker"
elif [[ $EXIT_CODE -eq 139 ]]; then
    echo "1. Segmentation fault - check pointer dereferencing in KVCache usage"
    echo "2. Review thread safety in session management"
    echo "3. Validate all pointer checks before usage"
fi

echo "4. Run with AddressSanitizer: export ASAN_OPTIONS=abort_on_error=1"
echo "5. Test with smaller model or reduced parameters"
