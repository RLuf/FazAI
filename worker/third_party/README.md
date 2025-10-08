# Third-Party Dependencies

This directory contains third-party libraries used by the FazAI Gemma Worker.

## gemma.cpp

Google's Gemma inference library. This directory will be created when you run `../setup_gemma.sh`.

**Setup:**
```bash
cd ..
./setup_gemma.sh
```

This will clone the gemma.cpp repository to `gemma.cpp/` and build it.

**Manual setup:**
```bash
git clone https://github.com/google/gemma.cpp.git
cd gemma.cpp
git submodule update --init --recursive
mkdir build && cd build
cmake .. -DCMAKE_BUILD_TYPE=Release
make -j$(nproc)
```

## nlohmann

JSON library for modern C++.

This is already included in the repository for convenience.

## Structure

```
third_party/
├── gemma.cpp/        # Google gemma.cpp (cloned via setup script)
├── nlohmann/         # JSON library (included)
└── README.md         # This file
```

## Notes

- `gemma.cpp/` is excluded from version control (see `.gitignore`)
- Run `setup_gemma.sh` to download and build gemma.cpp
- The build system will auto-detect gemma.cpp in this location
