# Quick Start: Gemma3 Integration

This is a quick reference for integrating Gemma3.cpp with FazAI. For detailed information, see [worker/GEMMA_INTEGRATION.md](worker/GEMMA_INTEGRATION.md).

## TL;DR

```bash
# 1. Setup Gemma library
cd worker
./setup_gemma.sh

# 2. Build worker
./build.sh

# 3. Download model from https://www.kaggle.com/models/google/gemma

# 4. Configure
sudo nano /etc/fazai/fazai.conf
# Set weights and tokenizer paths

# 5. Start
sudo systemctl start fazai-gemma-worker
```

## What This Adds

- **Automated Setup**: `setup_gemma.sh` downloads and builds gemma.cpp
- **Flexible Build**: Supports multiple gemma.cpp locations and build modes
- **Fallback Support**: Worker builds with stubs if gemma.cpp unavailable
- **Documentation**: Complete integration guide in `worker/GEMMA_INTEGRATION.md`

## Build Modes

### 1. With Native Gemma (Recommended)
```bash
cd worker
./setup_gemma.sh  # Downloads and builds gemma.cpp
./build.sh        # Builds with native Gemma support
```

### 2. With Pre-built Library
```bash
cp /path/to/libgemma.a worker/lib/
cd worker
./build.sh
```

### 3. Stub Mode (Development)
```bash
cd worker
./build.sh  # Answer 'y' when prompted
# Worker uses stubs, falls back to remote AI providers
```

## Directory Structure

```
worker/
├── setup_gemma.sh           # Automated setup script
├── build.sh                 # Build script (updated)
├── CMakeLists.txt           # Build config (flexible paths)
├── GEMMA_INTEGRATION.md     # Complete guide
├── README.md                # Worker documentation
├── third_party/
│   └── gemma.cpp/           # Cloned by setup_gemma.sh
└── lib/
    └── libgemma.a           # Generated library
```

## Environment Variables

- `GEMMA_CPP_ROOT` - Path to gemma.cpp source
- `GEMMA_BRANCH` - Git branch (default: `main`)
- `GEMMA_DIR` - Custom install directory

## Configuration

In `/etc/fazai/fazai.conf`:

```ini
[gemma_cpp]
enabled = true
weights = /opt/fazai/models/gemma/2.0-2b-it-sfp.sbs
tokenizer = /opt/fazai/models/gemma/tokenizer.spm
temperature = 0.2
max_tokens = 1024
```

## Models

Download from [Kaggle](https://www.kaggle.com/models/google/gemma):

- **gemma-2b-it** - 2B parameters, instruction-tuned (4GB RAM)
- **gemma-7b-it** - 7B parameters, instruction-tuned (14GB RAM)
- **gemma3-1b-it** - Latest 1B model (2GB RAM)

Place in `/opt/fazai/models/gemma/`

## Troubleshooting

### Build fails with "gemma.cpp not found"
**Fix:** Run `./setup_gemma.sh`

### Linking errors
**Fix:** Ensure you're using stubs: answer 'y' when build.sh prompts

### Worker uses fallback instead of local Gemma
**Fix:** Check model paths and permissions:
```bash
ls -la /opt/fazai/models/gemma/
cat /etc/fazai/fazai.conf | grep gemma_cpp
journalctl -u fazai-gemma-worker -f
```

## Documentation

- [Complete Integration Guide](worker/GEMMA_INTEGRATION.md)
- [Worker README](worker/README.md)
- [Main README](README.md)
- [Changelog](CHANGELOG.md)

## Support

- Issues: https://github.com/RLuf/FazAI/issues
- Gemma.cpp: https://github.com/google/gemma.cpp
- Models: https://www.kaggle.com/models/google/gemma

---

**Related Issue**: #62 - Project scaffold and Gemma3-cpp integration
**Version**: 2.0
**Last Updated**: 2025-01-08
