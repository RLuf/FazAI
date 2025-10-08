# Gemma3.cpp Integration Guide

This guide explains how to integrate Google's Gemma3.cpp library with FazAI for native AI inference capabilities.

## Overview

FazAI supports multiple Gemma integration modes:

1. **Native Gemma3.cpp** - Full integration with Google's gemma.cpp library (recommended)
2. **Pre-built Library** - Using a pre-compiled `libgemma.a`
3. **Fallback Mode** - Worker runs without native Gemma (uses remote AI providers)

## Quick Start

### Option 1: Automated Setup (Recommended)

The easiest way to set up Gemma3 integration:

```bash
cd worker
./setup_gemma.sh
```

This script will:
- Clone Google's gemma.cpp repository
- Initialize all submodules
- Build the library with optimizations
- Create `libgemma.a` for linking
- Generate CMake configuration

### Option 2: Manual Setup

If you prefer manual control:

1. **Clone gemma.cpp**
   ```bash
   cd worker
   git clone https://github.com/google/gemma.cpp.git third_party/gemma.cpp
   cd third_party/gemma.cpp
   git submodule update --init --recursive
   ```

2. **Build gemma.cpp**
   ```bash
   mkdir build && cd build
   cmake .. -DCMAKE_BUILD_TYPE=Release -DCMAKE_POSITION_INDEPENDENT_CODE=ON
   make -j$(nproc)
   ```

3. **Create static library**
   ```bash
   # Collect all object files and create archive
   find . -name "*.o" | xargs ar rcs libgemma.a
   cp libgemma.a ../../lib/
   ```

4. **Set environment variable (optional)**
   ```bash
   export GEMMA_CPP_ROOT=/path/to/gemma.cpp
   ```

### Option 3: Use Pre-built Library

If you have a pre-built `libgemma.a`:

```bash
cp /path/to/libgemma.a worker/lib/
```

## Building FazAI Worker

Once Gemma is set up, build the worker:

```bash
cd worker
./build.sh
```

The build system will automatically detect:
- Pre-built library in `lib/libgemma.a`
- Source code in `third_party/gemma.cpp`
- Environment variable `GEMMA_CPP_ROOT`
- Legacy path `/home/rluft/gemma.cpp` (backward compatibility)

## Configuration

### Environment Variables

- `GEMMA_CPP_ROOT` - Path to gemma.cpp source directory
- `GEMMA_BRANCH` - Git branch to use (default: `main`)
- `GEMMA_DIR` - Custom installation directory

### CMake Options

```bash
cmake .. \
  -DGEMMA_ROOT=/path/to/gemma.cpp \
  -DCMAKE_BUILD_TYPE=Release
```

## Downloading Models

Gemma models are available from Kaggle:

1. Visit: https://www.kaggle.com/models/google/gemma
2. Download your preferred model (e.g., `gemma-2b-it`, `gemma-7b-it`)
3. Place models in `/opt/fazai/models/gemma/`

Example models:
- `gemma-2b-it` - 2 billion parameters, instruction-tuned
- `gemma-7b-it` - 7 billion parameters, instruction-tuned
- `gemma3-1b-it` - Latest 1B model (Gemma 3)

Configure the model path in `/etc/fazai/fazai.conf`:

```ini
[gemma_cpp]
weights = /opt/fazai/models/gemma/2.0-2b-it-sfp.sbs
tokenizer = /opt/fazai/models/gemma/tokenizer.spm
```

## Architecture

### Directory Structure

```
worker/
├── third_party/
│   └── gemma.cpp/          # Google's gemma.cpp (cloned)
├── lib/
│   └── libgemma.a          # Static library (generated)
├── src/
│   ├── gemma_wrapper.cpp   # FazAI wrapper
│   └── gemma_api.h         # C API interface
├── setup_gemma.sh          # Automated setup script
└── CMakeLists.txt          # Build configuration
```

### Integration Flow

1. **CMake Detection** - Checks for library or source
2. **Build/Link** - Compiles from source or links pre-built
3. **Runtime** - Worker loads models and handles inference
4. **Fallback** - Falls back to remote providers if unavailable

## Troubleshooting

### Error: "gemma.cpp not found"

**Solution:** Run `./setup_gemma.sh` or manually clone gemma.cpp to `third_party/`

### Error: "libgemma.a not found"

**Solution:** Either build from source or copy a pre-built library to `lib/`

### Build fails with missing dependencies

**Solution:** Install required packages:
```bash
# Ubuntu/Debian
sudo apt-get install build-essential cmake git

# Fedora/RHEL
sudo dnf install gcc-c++ cmake make git

# Arch
sudo pacman -S base-devel cmake git
```

### Submodule errors

**Solution:** Ensure all submodules are initialized:
```bash
cd third_party/gemma.cpp
git submodule update --init --recursive
```

### Worker runs but uses fallback instead of native Gemma

**Causes:**
- Model files not found
- Incorrect permissions on model files
- Invalid model format

**Solution:**
1. Check model paths in `/etc/fazai/fazai.conf`
2. Verify model files exist: `ls -la /opt/fazai/models/gemma/`
3. Check worker logs: `journalctl -u fazai-gemma-worker -f`

## Performance Optimization

### CPU Optimization

Gemma.cpp uses Highway for SIMD acceleration. Ensure your CPU supports:
- SSE4.2 or later
- AVX2 (recommended)
- AVX-512 (optimal)

Check CPU features:
```bash
lscpu | grep Flags
```

### Memory Requirements

Model memory usage (approximate):
- 1B model: ~2GB RAM
- 2B model: ~4GB RAM
- 7B model: ~14GB RAM

Ensure adequate RAM and swap space.

### Build Optimizations

For maximum performance, rebuild with:
```bash
cmake .. \
  -DCMAKE_BUILD_TYPE=Release \
  -DCMAKE_CXX_FLAGS="-O3 -march=native" \
  -DGEMMA_ENABLE_PGO=ON
```

## Upgrading to Gemma3

To upgrade from Gemma2 to Gemma3:

1. **Update repository**
   ```bash
   cd third_party/gemma.cpp
   git fetch origin
   git checkout main  # or specific Gemma3 branch
   git pull
   git submodule update --init --recursive
   ```

2. **Rebuild**
   ```bash
   cd build
   rm -rf *
   cmake .. -DCMAKE_BUILD_TYPE=Release
   make -j$(nproc)
   ```

3. **Update FazAI worker**
   ```bash
   cd ../../..  # back to worker/
   ./build.sh
   ```

4. **Download Gemma3 models**
   - Get latest models from Kaggle
   - Update paths in configuration

## Testing

### Verify Build

```bash
# Check if worker includes Gemma
ldd /opt/fazai/bin/fazai-gemma-worker | grep gemma

# Test worker
/opt/fazai/bin/fazai-gemma-worker --version
```

### Test Inference

```bash
# Start worker
sudo systemctl start fazai-gemma-worker

# Test via CLI
fazai "hello world"

# Check logs
journalctl -u fazai-gemma-worker -f
```

## Advanced Topics

### Custom Gemma Fork

To use a custom gemma.cpp fork:

```bash
export GEMMA_REPO=https://github.com/yourusername/gemma.cpp.git
export GEMMA_BRANCH=your-branch
./setup_gemma.sh
```

### Cross-compilation

For ARM or other architectures:

```bash
cmake .. \
  -DCMAKE_TOOLCHAIN_FILE=/path/to/toolchain.cmake \
  -DCMAKE_BUILD_TYPE=Release
```

### Static vs Dynamic Linking

FazAI uses static linking by default for portability. To use dynamic linking:

1. Build shared library: `cmake .. -DBUILD_SHARED_LIBS=ON`
2. Update CMakeLists.txt to use `SHARED` instead of `STATIC`
3. Ensure library is in `LD_LIBRARY_PATH`

## Support

For issues or questions:
- Check FazAI logs: `/var/log/fazai/fazai-gemma-worker.log`
- Review Gemma.cpp docs: https://github.com/google/gemma.cpp
- Open issue: https://github.com/RLuf/FazAI/issues

## References

- [Gemma.cpp GitHub](https://github.com/google/gemma.cpp)
- [Gemma Models - Kaggle](https://www.kaggle.com/models/google/gemma)
- [Gemma Documentation](https://ai.google.dev/gemma)
- [FazAI Documentation](../README.md)

---

**Last Updated:** 2025-01-08
**Version:** 2.0
**Compatibility:** Gemma 2.x and 3.x
