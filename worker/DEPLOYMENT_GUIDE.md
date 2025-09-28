# FazAI Gemma Worker - Deployment Guide for Stability Fixes

## Overview

This guide covers the deployment of critical stability fixes for the fazai-gemma-worker that resolve segmentation faults and memory management issues.

## Fixed Issues

- ✅ **Segmentation faults** due to null pointer dereferences
- ✅ **Memory leaks** in session management
- ✅ **Thread safety** issues in concurrent operations
- ✅ **API integration** problems with libgemma
- ✅ **Resource cleanup** on shutdown
- ✅ **Error handling** and graceful fallbacks

## Pre-Deployment Checklist

### 1. Backup Current System
```bash
# Stop the service
sudo systemctl stop fazai-gemma-worker

# Backup current binary
sudo cp /opt/fazai/bin/fazai-gemma-worker /opt/fazai/bin/fazai-gemma-worker.backup.$(date +%Y%m%d)

# Backup configuration
sudo cp -r /etc/fazai /etc/fazai.backup.$(date +%Y%m%d)
```

### 2. Verify Dependencies
```bash
# Install required build tools
sudo apt-get update
sudo apt-get install cmake make g++ netcat-openbsd jq

# Verify model files exist
ls -la /opt/fazai/models/gemma/
```

### 3. Check System Resources
```bash
# Verify available memory (should be > 2GB for Gemma 2B model)
free -h

# Check disk space
df -h /opt/fazai
```

## Deployment Steps

### Step 1: Apply Code Fixes
The following files have been updated with stability fixes:

- `worker/src/worker.cpp` - Memory management and null pointer checks
- `worker/lib/gemma_c_api_real.cpp` - Thread safety and error handling
- `worker/CMakeLists.txt` - Build system corrections
- `worker/setup_gemma_env.sh` - Environment configuration
- `worker/test_worker_stability.sh` - Comprehensive testing

### Step 2: Build and Install
```bash
cd /home/rluft/fazai/worker

# Create build directory
mkdir -p build
cd build

# Configure build
cmake .. -DCMAKE_BUILD_TYPE=Release -DCMAKE_INSTALL_PREFIX=/opt/fazai

# Build with all CPU cores
make -j$(nproc)

# Install (requires sudo)
sudo make install
```

### Step 3: Configure Environment
```bash
# Run environment setup script
chmod +x /home/rluft/fazai/worker/setup_gemma_env.sh
sudo /home/rluft/fazai/worker/setup_gemma_env.sh
```

### Step 4: Run Stability Tests
```bash
# Execute comprehensive test suite
chmod +x /home/rluft/fazai/worker/run_tests.sh
/home/rluft/fazai/worker/run_tests.sh
```

### Step 5: Deploy to Production
```bash
# Reload systemd configuration
sudo systemctl daemon-reload

# Start the service
sudo systemctl start fazai-gemma-worker

# Enable auto-start on boot
sudo systemctl enable fazai-gemma-worker

# Verify service status
sudo systemctl status fazai-gemma-worker
```

## Post-Deployment Verification

### 1. Service Health Check
```bash
# Check service status
sudo systemctl is-active fazai-gemma-worker

# Monitor logs for errors
journalctl -u fazai-gemma-worker -f --since "5 minutes ago"
```

### 2. Functional Testing
```bash
# Test IPC communication
echo '{"action": "create_session", "params": {"temperature": 0.7}}' | nc -U /run/fazai/gemma.sock

# Check socket permissions
ls -la /run/fazai/gemma.sock
```

### 3. Memory Monitoring
```bash
# Monitor memory usage
watch -n 5 'ps aux | grep fazai-gemma-worker'

# Check for memory leaks (if valgrind available)
sudo systemctl stop fazai-gemma-worker
sudo valgrind --leak-check=full /opt/fazai/bin/fazai-gemma-worker &
# Let it run for a few minutes, then stop and check output
```

## Rollback Procedure

If issues are detected after deployment:

```bash
# Stop the new service
sudo systemctl stop fazai-gemma-worker

# Restore backup binary
sudo cp /opt/fazai/bin/fazai-gemma-worker.backup.* /opt/fazai/bin/fazai-gemma-worker

# Restore backup configuration
sudo rm -rf /etc/fazai
sudo mv /etc/fazai.backup.* /etc/fazai

# Restart with old version
sudo systemctl start fazai-gemma-worker
```

## Monitoring and Maintenance

### Key Metrics to Monitor
- **Memory usage**: Should be stable, not continuously growing
- **CPU usage**: Should be reasonable during inference
- **Restart count**: Should be zero or very low
- **Socket availability**: `/run/fazai/gemma.sock` should exist and be accessible

### Log Analysis
```bash
# Check for segfaults
journalctl -u fazai-gemma-worker | grep -i "segmentation\|sigsegv\|sigabrt"

# Monitor error patterns
journalctl -u fazai-gemma-worker | grep -i "error\|exception\|failed"

# Check performance metrics
journalctl -u fazai-gemma-worker | grep -i "generation\|session"
```

### Automated Health Checks
Consider setting up automated monitoring:

```bash
# Add to crontab for periodic health checks
*/5 * * * * systemctl is-active fazai-gemma-worker || systemctl restart fazai-gemma-worker
```

## Troubleshooting

### Common Issues and Solutions

1. **Service fails to start**
   - Check model file permissions: `sudo chmod 644 /opt/fazai/models/gemma/*`
   - Verify socket directory: `sudo mkdir -p /run/fazai && sudo chown fazai:fazai /run/fazai`

2. **Memory issues**
   - Increase system memory or reduce model size
   - Check for memory leaks with valgrind

3. **Permission errors**
   - Ensure fazai user has access to model files
   - Check socket directory permissions

4. **Build failures**
   - Verify all dependencies are installed
   - Check gemma.cpp checkout at `/home/rluft/gemma.cpp`

## Performance Expectations

After applying these fixes:
- **Stability**: No more segmentation faults
- **Memory**: Stable memory usage without leaks
- **Reliability**: Service should run continuously without restarts
- **Functionality**: All API endpoints should work correctly
- **Fallback**: Graceful degradation when Gemma library unavailable

## Support

For issues or questions:
1. Check logs: `journalctl -u fazai-gemma-worker -f`
2. Run diagnostics: `/home/rluft/fazai/worker/run_tests.sh`
3. Review this deployment guide
4. Check system resources and dependencies
