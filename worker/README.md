# FazAI Gemma Worker

Native Gemma inference worker for FazAI, providing local AI capabilities through Google's gemma.cpp library.

## Quick Start

### 1. Setup Gemma Library

```bash
./setup_gemma.sh
```

This will download and build gemma.cpp automatically.

### 2. Build Worker

```bash
./build.sh
```

### 3. Download Model

Download a Gemma model from [Kaggle](https://www.kaggle.com/models/google/gemma) and place in `/opt/fazai/models/gemma/`.

### 4. Configure

Edit `/etc/fazai/fazai.conf`:

```ini
[gemma_cpp]
weights = /opt/fazai/models/gemma/2.0-2b-it-sfp.sbs
tokenizer = /opt/fazai/models/gemma/tokenizer.spm
```

### 5. Start Worker

```bash
sudo systemctl enable fazai-gemma-worker
sudo systemctl start fazai-gemma-worker
```

## Directory Structure

```
worker/
├── bin/                      # Python worker scripts
│   ├── fazai_gemma_worker.py     # Main worker daemon
│   ├── fazai_mcp_client.py       # MCP client
│   └── gemma_worker_client.py    # Worker client
├── src/                      # C++ source files
│   ├── main.cpp              # Entry point
│   ├── worker.cpp            # Worker logic
│   ├── gemma_wrapper.cpp     # Gemma C++ wrapper
│   └── ipc.cpp               # IPC handling
├── lib/                      # Libraries
│   ├── gemma_c_api_real.cpp  # C API for Gemma
│   └── libgemma.a            # Static library (generated)
├── third_party/              # Third-party dependencies
│   ├── gemma.cpp/            # Google gemma.cpp (cloned)
│   └── nlohmann/             # JSON library
├── tests/                    # Test files
├── CMakeLists.txt            # CMake build configuration
├── build.sh                  # Build script
├── setup_gemma.sh            # Gemma setup script
├── GEMMA_INTEGRATION.md      # Integration guide
└── README.md                 # This file
```

## Build Options

### Full Build (with Gemma)

```bash
./setup_gemma.sh  # Setup gemma.cpp
./build.sh        # Build worker
```

### Build Without Native Gemma

The worker can run without native Gemma support, using remote AI providers as fallback:

```bash
./build.sh  # Answer 'y' when asked to continue without Gemma
```

### Custom Gemma Path

```bash
export GEMMA_CPP_ROOT=/path/to/gemma.cpp
./build.sh
```

### Pre-built Library

If you have a pre-built `libgemma.a`:

```bash
cp /path/to/libgemma.a lib/
./build.sh
```

## Documentation

- [Gemma Integration Guide](GEMMA_INTEGRATION.md) - Complete integration documentation
- [Build Guide](build.sh) - Build script with detailed steps
- [FazAI Main README](../README.md) - Overall FazAI documentation

## Testing

```bash
# Run tests
./run_tests.sh

# Test specific functionality
./tests/test_worker_stability.sh
./tests/test_prompt_generation.sh
```

## Troubleshooting

### Worker won't start

Check logs:
```bash
journalctl -u fazai-gemma-worker -f
```

### Model not loading

Verify paths:
```bash
ls -la /opt/fazai/models/gemma/
cat /etc/fazai/fazai.conf | grep -A 5 gemma_cpp
```

### Build errors

Ensure dependencies are installed:
```bash
sudo apt-get install build-essential cmake git
```

See [GEMMA_INTEGRATION.md](GEMMA_INTEGRATION.md) for detailed troubleshooting.

## Architecture

The worker uses a multi-layer architecture:

1. **Python Layer** (`bin/fazai_gemma_worker.py`)
   - ND-JSON protocol handling
   - Session management
   - Fallback orchestration

2. **C++ Layer** (`src/`)
   - Native Gemma inference
   - IPC communication
   - Performance optimization

3. **Integration Layer** (`lib/`)
   - C API wrapper
   - Memory management
   - Error handling

## Performance

### Model Inference Speed

Typical inference speeds on modern CPUs:

- 2B model: ~50-100 tokens/sec
- 7B model: ~10-20 tokens/sec

### Memory Usage

- 2B model: ~4GB RAM
- 7B model: ~14GB RAM

### Optimization Tips

1. Use AVX2/AVX-512 CPU instructions (auto-detected)
2. Allocate sufficient RAM and swap
3. Use SSD for model storage
4. Consider model quantization for smaller memory footprint

## Development

### Building for Development

```bash
cd build
cmake .. -DCMAKE_BUILD_TYPE=Debug
make -j$(nproc)
```

### Running Tests

```bash
cd tests
./run_all_tests.sh
```

### Code Style

- C++: 4 spaces, include guards, consistent naming
- Python: PEP 8, 4 spaces, type hints where applicable
- Scripts: 2 spaces, POSIX-compatible

## Contributing

See [CONTRIBUTING.md](../CONTRIBUTING.md) for contribution guidelines.

## License

Creative Commons Attribution 4.0 International (CC BY 4.0)

See [LICENSE](../LICENSE) for details.

## Support

- GitHub Issues: https://github.com/RLuf/FazAI/issues
- Documentation: [GEMMA_INTEGRATION.md](GEMMA_INTEGRATION.md)
- Main README: [../README.md](../README.md)
