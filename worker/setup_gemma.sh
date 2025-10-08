#!/bin/bash
# FazAI - Gemma.cpp Setup Script
# Downloads and builds Google's gemma.cpp library for FazAI integration

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Configuration
GEMMA_REPO="https://github.com/google/gemma.cpp.git"
GEMMA_BRANCH="${GEMMA_BRANCH:-main}"
GEMMA_DIR="${GEMMA_DIR:-$(pwd)/third_party/gemma.cpp}"
BUILD_DIR="${GEMMA_DIR}/build"

# Check dependencies
check_dependencies() {
    log_info "Checking dependencies..."
    
    local missing=()
    
    for cmd in git cmake make g++; do
        if ! command -v $cmd &> /dev/null; then
            missing+=("$cmd")
        fi
    done
    
    if [ ${#missing[@]} -ne 0 ]; then
        log_error "Missing dependencies: ${missing[*]}"
        log_info "Install with:"
        echo "  Ubuntu/Debian: sudo apt-get install build-essential cmake git"
        echo "  Fedora/RHEL: sudo dnf install gcc-c++ cmake make git"
        echo "  Arch: sudo pacman -S base-devel cmake git"
        exit 1
    fi
    
    log_success "All dependencies found"
}

# Clone gemma.cpp
clone_gemma() {
    log_info "Setting up gemma.cpp..."
    
    if [ -d "$GEMMA_DIR/.git" ]; then
        log_warning "gemma.cpp already exists at $GEMMA_DIR"
        log_info "Updating repository..."
        cd "$GEMMA_DIR"
        git fetch origin
        git checkout "$GEMMA_BRANCH"
        git pull origin "$GEMMA_BRANCH"
    else
        log_info "Cloning gemma.cpp from $GEMMA_REPO..."
        mkdir -p "$(dirname "$GEMMA_DIR")"
        git clone --depth 1 --branch "$GEMMA_BRANCH" "$GEMMA_REPO" "$GEMMA_DIR"
    fi
    
    log_success "gemma.cpp repository ready at $GEMMA_DIR"
}

# Initialize submodules
init_submodules() {
    log_info "Initializing submodules..."
    
    cd "$GEMMA_DIR"
    git submodule update --init --recursive
    
    log_success "Submodules initialized"
}

# Build gemma.cpp
build_gemma() {
    log_info "Building gemma.cpp..."
    
    mkdir -p "$BUILD_DIR"
    cd "$BUILD_DIR"
    
    # Configure
    cmake .. \
        -DCMAKE_BUILD_TYPE=Release \
        -DCMAKE_POSITION_INDEPENDENT_CODE=ON \
        -DGEMMA_ENABLE_TESTS=OFF \
        -DGEMMA_ENABLE_PGO=OFF
    
    # Build
    make -j$(nproc)
    
    log_success "gemma.cpp built successfully"
}

# Create static library
create_library() {
    log_info "Creating libgemma.a..."
    
    cd "$BUILD_DIR"
    
    # Find all object files from the build
    local obj_files=$(find . -name "*.o" | grep -v "CMakeFiles" | grep -v "test" || true)
    
    if [ -z "$obj_files" ]; then
        log_warning "No object files found, trying alternative approach..."
        # If no object files, the library might already be built
        if [ -f "libgemma.a" ]; then
            log_info "Found pre-built libgemma.a"
        else
            log_error "Could not create or find libgemma.a"
            return 1
        fi
    else
        # Create archive
        ar rcs libgemma.a $obj_files
        log_success "Created libgemma.a"
    fi
    
    # Copy to worker lib directory
    local WORKER_LIB="$(dirname "$GEMMA_DIR")/../../lib"
    mkdir -p "$WORKER_LIB"
    
    if [ -f "libgemma.a" ]; then
        cp libgemma.a "$WORKER_LIB/"
        log_success "Copied libgemma.a to $WORKER_LIB/"
    else
        log_warning "libgemma.a not found in build directory"
        log_info "Checking for alternative library locations..."
        
        # Try to find the library elsewhere
        local found_lib=$(find "$BUILD_DIR" -name "*.a" | grep -i gemma | head -n 1)
        if [ -n "$found_lib" ]; then
            cp "$found_lib" "$WORKER_LIB/libgemma.a"
            log_success "Copied library from $found_lib"
        fi
    fi
}

# Generate CMake config for FazAI
generate_config() {
    log_info "Generating CMake configuration..."
    
    local CONFIG_FILE="$(dirname "$GEMMA_DIR")/../gemma_config.cmake"
    
    cat > "$CONFIG_FILE" << EOF
# Generated gemma.cpp configuration for FazAI
# Generated on: $(date)

set(GEMMA_ROOT "${GEMMA_DIR}")
set(GEMMA_BUILD_DIR "${BUILD_DIR}")
set(GEMMA_INCLUDE_DIRS 
    "\${GEMMA_ROOT}"
    "\${GEMMA_ROOT}/gemma"
    "\${GEMMA_ROOT}/compression"
    "\${GEMMA_ROOT}/ops"
)

# Highway library paths (required by gemma.cpp)
set(HIGHWAY_INCLUDE_DIR "\${GEMMA_ROOT}/third_party/highway")
set(HIGHWAY_LIB_DIR "\${GEMMA_BUILD_DIR}/third_party/highway")

# SentencePiece paths
set(SENTENCEPIECE_INCLUDE_DIR "\${GEMMA_ROOT}/third_party/sentencepiece/src")

message(STATUS "Gemma.cpp found at: \${GEMMA_ROOT}")
message(STATUS "Gemma build dir: \${GEMMA_BUILD_DIR}")
EOF
    
    log_success "Configuration saved to $CONFIG_FILE"
}

# Main function
main() {
    log_info "FazAI Gemma.cpp Setup Script"
    echo ""
    
    check_dependencies
    clone_gemma
    init_submodules
    build_gemma
    create_library
    generate_config
    
    echo ""
    log_success "Gemma.cpp setup complete!"
    log_info "Next steps:"
    echo "  1. Review the configuration at: $(dirname "$GEMMA_DIR")/../gemma_config.cmake"
    echo "  2. Build FazAI worker: cd worker && ./build.sh"
    echo "  3. Download Gemma models from: https://www.kaggle.com/models/google/gemma"
    echo ""
    log_info "Gemma directory: $GEMMA_DIR"
    log_info "Library location: $(dirname "$GEMMA_DIR")/../../lib/libgemma.a"
}

# Run main function
main "$@"
