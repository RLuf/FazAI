cmake_minimum_required(VERSION 3.16)
project(fazai_gemma_worker)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_POSITION_INDEPENDENT_CODE ON)

# Configurações de compilação
set(CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} -Wall -Wextra -O2")
set(CMAKE_CXX_FLAGS_DEBUG "${CMAKE_CXX_FLAGS_DEBUG} -g -DDEBUG")

# Encontrar dependências
find_package(Threads REQUIRED)

# Arquivos fonte
set(SOURCES
    src/main.cpp
    src/worker.cpp
    src/ipc.cpp
    src/gemma_wrapper.cpp
    src/qdrant_client.cpp
)

# Gemma.cpp integration - flexible path support
# Priority: CMAKE_PREFIX_PATH > third_party/gemma.cpp > system paths
set(GEMMA_ROOT "" CACHE PATH "Path to gemma.cpp root directory")

# Try to find gemma.cpp in multiple locations
if(NOT GEMMA_ROOT)
    # Check environment variable
    if(DEFINED ENV{GEMMA_CPP_ROOT})
        set(GEMMA_ROOT $ENV{GEMMA_CPP_ROOT})
        message(STATUS "Using GEMMA_ROOT from environment: ${GEMMA_ROOT}")
    # Check third_party directory
    elseif(EXISTS "${CMAKE_CURRENT_SOURCE_DIR}/third_party/gemma.cpp")
        set(GEMMA_ROOT "${CMAKE_CURRENT_SOURCE_DIR}/third_party/gemma.cpp")
        message(STATUS "Found gemma.cpp in third_party: ${GEMMA_ROOT}")
    # Check for user-specific path (backward compatibility)
    elseif(EXISTS "/home/rluft/gemma.cpp")
        set(GEMMA_ROOT "/home/rluft/gemma.cpp")
        message(STATUS "Using legacy path: ${GEMMA_ROOT}")
    endif()
endif()

# Try to use pre-built libgemma.a first
if(EXISTS "${CMAKE_CURRENT_SOURCE_DIR}/lib/libgemma.a")
    message(STATUS "Using pre-built libgemma.a from lib/")
    add_library(libgemma_prebuilt STATIC IMPORTED)
    set_target_properties(libgemma_prebuilt PROPERTIES
        IMPORTED_LOCATION "${CMAKE_CURRENT_SOURCE_DIR}/lib/libgemma.a"
    )
    set(HAVE_LIBGEMMA TRUE)
# Otherwise, compile from source if gemma.cpp is available
elseif(GEMMA_ROOT AND EXISTS "${GEMMA_ROOT}")
    message(STATUS "Building libgemma from source: ${GEMMA_ROOT}")
    set(GEMMA_ENABLE_TESTS OFF)
    
    # Glob source files
    file(GLOB_RECURSE GEMMA_SOURCES
        "${GEMMA_ROOT}/gemma/*.cc"
        "${GEMMA_ROOT}/ops/*.cc"
        "${GEMMA_ROOT}/compression/*.cc"
    )
    
    # Exclude Python extensions
    file(GLOB_RECURSE PYTHON_EXTENSION_SOURCES "${GEMMA_ROOT}/compression/python/*.cc")
    list(REMOVE_ITEM GEMMA_SOURCES ${PYTHON_EXTENSION_SOURCES})

    if(GEMMA_SOURCES)
        add_library(libgemma_local STATIC ${GEMMA_SOURCES})
        target_include_directories(libgemma_local PRIVATE 
            ${GEMMA_ROOT}
            ${GEMMA_ROOT}/gemma
            ${GEMMA_ROOT}/third_party
            ${GEMMA_ROOT}/third_party/highway
            ${CMAKE_CURRENT_SOURCE_DIR}/src
            ${CMAKE_CURRENT_SOURCE_DIR}/lib/sentencepiece/include
        )
        target_compile_features(libgemma_local PUBLIC cxx_std_17)
        set_target_properties(libgemma_local PROPERTIES POSITION_INDEPENDENT_CODE ON)
        set(HAVE_LIBGEMMA TRUE)
    endif()
else()
    message(WARNING "gemma.cpp not found. Worker will be built without native Gemma support.")
    message(STATUS "To enable Gemma support:")
    message(STATUS "  1. Run: ./setup_gemma.sh")
    message(STATUS "  2. Or set GEMMA_ROOT environment variable")
    message(STATUS "  3. Or place libgemma.a in lib/ directory")
    set(HAVE_LIBGEMMA FALSE)
endif()

# Arquivos de cabeçalho
set(HEADERS
    src/worker.hpp
    src/ipc.hpp
    src/gemma_wrapper.h
    src/qdrant_client.h
)

# Executável principal
add_executable(fazai-gemma-worker ${SOURCES} ${HEADERS})

# Incluir diretórios
target_include_directories(fazai-gemma-worker PRIVATE 
    src/
    ${CMAKE_CURRENT_SOURCE_DIR}/src
    ${CMAKE_CURRENT_SOURCE_DIR}/third_party
)

# Linkar bibliotecas
target_link_libraries(fazai-gemma-worker PRIVATE
    Threads::Threads
)

# Wrapper C para a API do Gemma
if(HAVE_LIBGEMMA AND EXISTS "${CMAKE_CURRENT_SOURCE_DIR}/lib/gemma_c_api_real.cpp")
    message(STATUS "Building Gemma C API wrapper: lib/gemma_c_api_real.cpp")
    add_library(gemma_capi_real STATIC ${CMAKE_CURRENT_SOURCE_DIR}/lib/gemma_c_api_real.cpp)
    
    # Include directories based on what we found
    target_include_directories(gemma_capi_real PRIVATE 
        ${CMAKE_CURRENT_SOURCE_DIR}/src
    )
    
    if(GEMMA_ROOT)
        target_include_directories(gemma_capi_real PRIVATE
            ${GEMMA_ROOT}
            ${GEMMA_ROOT}/gemma
            ${GEMMA_ROOT}/third_party
            ${GEMMA_ROOT}/third_party/highway
        )
    endif()
    
    target_compile_features(gemma_capi_real PUBLIC cxx_std_17)
    set_target_properties(gemma_capi_real PROPERTIES POSITION_INDEPENDENT_CODE ON)
    target_link_libraries(fazai-gemma-worker PRIVATE gemma_capi_real)
    
    # Link to appropriate gemma library
    if(TARGET libgemma_local)
        target_link_libraries(gemma_capi_real PRIVATE libgemma_local)
    elseif(TARGET libgemma_prebuilt)
        target_link_libraries(gemma_capi_real PRIVATE libgemma_prebuilt)
    endif()
endif()

# Linkar a biblioteca gemma (se disponível)
if(TARGET libgemma_local)
    target_link_libraries(fazai-gemma-worker PRIVATE libgemma_local)
    message(STATUS "Linking with libgemma_local (built from source)")
elseif(TARGET libgemma_prebuilt)
    target_link_libraries(fazai-gemma-worker PRIVATE libgemma_prebuilt)
    message(STATUS "Linking with libgemma_prebuilt (pre-built library)")
else()
    # Use stubs as fallback
    message(STATUS "Building worker with stub implementations (no native Gemma)")
    add_library(gemma_stubs STATIC ${CMAKE_CURRENT_SOURCE_DIR}/stubs/gemma_stubs.cpp)
    target_link_libraries(fazai-gemma-worker PRIVATE gemma_stubs)
endif()

# Linkar bibliotecas de terceiros (se disponíveis)
if(GEMMA_ROOT)
    # Highway library
    if(EXISTS "${GEMMA_ROOT}/third_party/highway/build/libhwy.a")
        target_link_libraries(fazai-gemma-worker PRIVATE "${GEMMA_ROOT}/third_party/highway/build/libhwy.a")
        message(STATUS "Linking with Highway library")
    endif()
    if(EXISTS "${GEMMA_ROOT}/third_party/highway/build/libhwy_contrib.a")
        target_link_libraries(fazai-gemma-worker PRIVATE "${GEMMA_ROOT}/third_party/highway/build/libhwy_contrib.a")
    endif()
endif()

find_library(SENTENCEPIECE_LIB sentencepiece)
if(SENTENCEPIECE_LIB)
    target_link_libraries(fazai-gemma-worker PRIVATE ${SENTENCEPIECE_LIB})
endif()

target_link_libraries(fazai-gemma-worker PRIVATE m dl stdc++ gcc)

# Instalação
install(TARGETS fazai-gemma-worker 
    RUNTIME DESTINATION /opt/fazai/bin
    PERMISSIONS OWNER_EXECUTE OWNER_WRITE OWNER_READ
                GROUP_EXECUTE GROUP_READ
                WORLD_EXECUTE WORLD_READ
)

install(DIRECTORY DESTINATION /opt/fazai/bin)

message(STATUS "FazAI Gemma Worker Configuration:")
message(STATUS "  C++ Standard: ${CMAKE_CXX_STANDARD}")
message(STATUS "  Build Type: ${CMAKE_BUILD_TYPE}")
message(STATUS "  Install Prefix: ${CMAKE_INSTALL_PREFIX}")
