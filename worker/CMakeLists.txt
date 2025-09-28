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

# Detectar presença de libgemma.a; stubs serão adicionados se não existir
if(EXISTS "${CMAKE_CURRENT_SOURCE_DIR}/lib/libgemma.a")
    message(STATUS "lib/libgemma.a encontrada — irá linkar o arquivo estático libgemma.a")
    add_library(libgemma_static STATIC IMPORTED)
    set_target_properties(libgemma_static PROPERTIES
        IMPORTED_LOCATION "${CMAKE_CURRENT_SOURCE_DIR}/lib/libgemma.a"
        INTERFACE_INCLUDE_DIRECTORIES "${CMAKE_CURRENT_SOURCE_DIR}/src"
    )
else()
    # If there's no prebuilt lib, we'll require a local gemma.cpp checkout.
    if(NOT EXISTS "/home/rluft/gemma.cpp")
        message(FATAL_ERROR "No lib/libgemma.a found and no local /home/rluft/gemma.cpp checkout detected. Stubs are prohibited in this project — provide a real libgemma or a local gemma.cpp checkout.")
    else()
        message(STATUS "lib/libgemma.a not present; will attempt to build libgemma_local from /home/rluft/gemma.cpp")
    endif()
endif()

# If the prebuilt libgemma doesn't provide the C API we need, allow building
# a static lib from a local gemma.cpp checkout at /home/rluft/gemma.cpp.
if(NOT TARGET libgemma_static AND EXISTS "/home/rluft/gemma.cpp")
    message(STATUS "Found local gemma.cpp at /home/rluft/gemma.cpp — will attempt to build a static libgemma_local.a")
    # Collect gemma sources recursively, but exclude test files, examples and evals to avoid requiring gtest/benchmarks
    # Also set GEMMA_ENABLE_TESTS off to avoid pulled-in test targets from gemma's CMake
    set(GEMMA_ENABLE_TESTS OFF)
    file(GLOB_RECURSE GEMMA_SOURCES
        /home/rluft/gemma.cpp/*.cc
        /home/rluft/gemma.cpp/gemma/*.cc
        /home/rluft/gemma.cpp/compression/*.cc
        /home/rluft/gemma.cpp/ops/*.cc
        /home/rluft/gemma.cpp/backprop/*.cc
    )
    # Exclude test sources and test directories to avoid pulling googletest and extras
    set(GEMMA_SOURCES_FILTERED "")
        foreach(_src IN LISTS GEMMA_SOURCES)
        # skip anything in directories or filenames matching these patterns
    if(_src MATCHES "/tests?/" OR _src MATCHES "/googletest" OR _src MATCHES "_test\\.cc$" OR _src MATCHES "\\btest\\b" OR _src MATCHES "/examples/" OR _src MATCHES "/evals/" OR _src MATCHES "/tools/" OR _src MATCHES "/gemma/cli/" OR _src MATCHES "/python/" OR _src MATCHES "python" OR _src MATCHES "_extension\\.cc$" OR _src MATCHES "clif_aux\\.cc$")
            message(STATUS "Excluding gemma source from build: ${_src}")
        else()
            list(APPEND GEMMA_SOURCES_FILTERED ${_src})
        endif()
    endforeach()
    set(GEMMA_SOURCES ${GEMMA_SOURCES_FILTERED})
    if(GEMMA_SOURCES)
        add_library(libgemma_local STATIC ${GEMMA_SOURCES})
    target_include_directories(libgemma_local PRIVATE /home/rluft/gemma.cpp /home/rluft/gemma.cpp/gemma /home/rluft/gemma.cpp/third_party /home/rluft/gemma.cpp/third_party/highway ${CMAKE_CURRENT_SOURCE_DIR}/src ${CMAKE_CURRENT_SOURCE_DIR}/lib/sentencepiece/include)
        target_compile_features(libgemma_local PUBLIC cxx_std_17)
        # ensure position independent code for static linking
        set_target_properties(libgemma_local PROPERTIES POSITION_INDEPENDENT_CODE ON)
        # Link libhwy and sentencepiece into libgemma_local if available
        if(EXISTS "/home/rluft/gemma.cpp/third_party/highway/build/libhwy.a")
            target_link_libraries(libgemma_local PRIVATE /home/rluft/gemma.cpp/third_party/highway/build/libhwy.a)
            if(EXISTS "/home/rluft/gemma.cpp/third_party/highway/build/libhwy_contrib.a")
                target_link_libraries(libgemma_local PRIVATE /home/rluft/gemma.cpp/third_party/highway/build/libhwy_contrib.a)
            endif()
        endif()
        if(SENTENCEPIECE_LIB)
            target_link_libraries(libgemma_local PRIVATE ${SENTENCEPIECE_LIB})
        endif()
        # Do not link yet to the final executable; we'll link libgemma_local after the executable is defined
    else()
        message(STATUS "No gemma sources found under /home/rluft/gemma.cpp; continuing without local build")
    endif()
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

# Small C wrapper target providing C symbols (gemma_init, etc.)
if(EXISTS "${CMAKE_CURRENT_SOURCE_DIR}/lib/gemma_c_api_real.cpp")
    message(STATUS "Using real C wrapper: lib/gemma_c_api_real.cpp")
    add_library(gemma_capi_real STATIC ${CMAKE_CURRENT_SOURCE_DIR}/lib/gemma_c_api_real.cpp)
    target_include_directories(gemma_capi_real PRIVATE ${CMAKE_CURRENT_SOURCE_DIR}/src /home/rluft/gemma.cpp /home/rluft/gemma.cpp/gemma /home/rluft/gemma.cpp/third_party /home/rluft/gemma.cpp/third_party/highway)
    target_compile_features(gemma_capi_real PUBLIC cxx_std_17)
    set_target_properties(gemma_capi_real PROPERTIES POSITION_INDEPENDENT_CODE ON)
    target_link_libraries(fazai-gemma-worker PRIVATE gemma_capi_real)
else()
    add_library(gemma_capi STATIC ${CMAKE_CURRENT_SOURCE_DIR}/lib/gemma_c_api.cpp)
    target_include_directories(gemma_capi PRIVATE ${CMAKE_CURRENT_SOURCE_DIR}/src /home/rluft/gemma.cpp)
    target_compile_features(gemma_capi PUBLIC cxx_std_17)
    set_target_properties(gemma_capi PROPERTIES POSITION_INDEPENDENT_CODE ON)
    target_link_libraries(fazai-gemma-worker PRIVATE gemma_capi)
endif()

# If we built a local libgemma_local from the gemma.cpp checkout, link it
# into the final executable and also make the C wrapper depend on it so
# unresolved symbols in the wrapper are satisfied at link time.
if(TARGET libgemma_local)
    message(STATUS "Linking built libgemma_local into executable and C wrapper")
    target_link_libraries(fazai-gemma-worker PRIVATE libgemma_local)
    if(TARGET gemma_capi_real)
        target_link_libraries(gemma_capi_real PRIVATE libgemma_local)
    endif()
endif()

# If we have the prebuilt libgemma, link it in
if(TARGET libgemma_static)
    target_link_libraries(fazai-gemma-worker PRIVATE libgemma_static)
endif()

# Link libhwy if we built it locally under the gemma checkout
if(EXISTS "/home/rluft/gemma.cpp/third_party/highway/build/libhwy.a")
    message(STATUS "Linking local libhwy.a from gemma.cpp third_party/highway/build")
    target_link_libraries(fazai-gemma-worker PRIVATE /home/rluft/gemma.cpp/third_party/highway/build/libhwy.a)
    if(EXISTS "/home/rluft/gemma.cpp/third_party/highway/build/libhwy_contrib.a")
        message(STATUS "Linking local libhwy_contrib.a from gemma.cpp third_party/highway/build")
        target_link_libraries(fazai-gemma-worker PRIVATE /home/rluft/gemma.cpp/third_party/highway/build/libhwy_contrib.a)
    endif()
endif()

# Se lib/libgemma.a estiver presente, linkar ela; caso contrário, compilar stubs
if(EXISTS "${CMAKE_CURRENT_SOURCE_DIR}/lib/libgemma.a")
    message(STATUS "lib/libgemma.a presente (não linkada automaticamente)")
else()
    message(STATUS "Usando stubs/gemma_stubs.cpp")
endif()

# Configurações específicas da plataforma
if(UNIX)
    target_link_libraries(fazai-gemma-worker PRIVATE 
        rt  # Para clock_gettime
    )
endif()

# Link math and dl in case Gemma or highway need them
target_link_libraries(fazai-gemma-worker PRIVATE m dl)

# Link sentencepiece and gcc/libstdc++ if needed for gemma/tokenizer and low-level symbols
find_library(SENTENCEPIECE_LIB sentencepiece)
if(SENTENCEPIECE_LIB)
    message(STATUS "Found sentencepiece library: ${SENTENCEPIECE_LIB}")
    target_link_libraries(fazai-gemma-worker PRIVATE ${SENTENCEPIECE_LIB})
else()
    message(WARNING "sentencepiece library not found by find_library; linking libsentencepiece may be required manually")
endif()

# Try to link libgcc_s (shared) to resolve low-level compiler runtime helpers
find_library(GCC_S_LIB NAMES gcc_s libgcc_s.so.1)
if(GCC_S_LIB)
    message(STATUS "Found libgcc_s: ${GCC_S_LIB}")
    target_link_libraries(fazai-gemma-worker PRIVATE ${GCC_S_LIB})
else()
    message(WARNING "libgcc_s not found; attempting to find libgcc static archive as fallback")
    find_library(GCC_LIB NAMES gcc libgcc.a libgcc)
    if(GCC_LIB)
        message(STATUS "Found libgcc fallback: ${GCC_LIB}")
        target_link_libraries(fazai-gemma-worker PRIVATE ${GCC_LIB})
    else()
        # Try explicit search for the static libgcc.a in common GCC sysdirs
        file(GLOB GCC_STATIC_CANDS /usr/lib/gcc/x86_64-linux-gnu/*/libgcc.a)
        list(SORT GCC_STATIC_CANDS)
        if(GCC_STATIC_CANDS)
            list(GET GCC_STATIC_CANDS 0 GCC_STATIC)
            message(STATUS "Linking static libgcc fallback: ${GCC_STATIC}")
            target_link_libraries(fazai-gemma-worker PRIVATE ${GCC_STATIC})
        else()
            message(WARNING "No libgcc variant found; link errors for compiler runtime helpers may persist")
        endif()
    endif()
endif()

# Keep explicit libc++/gcc libs as before
target_link_libraries(fazai-gemma-worker PRIVATE stdc++ gcc)

# Instalação
install(TARGETS fazai-gemma-worker 
    RUNTIME DESTINATION /opt/fazai/bin
    PERMISSIONS OWNER_EXECUTE OWNER_WRITE OWNER_READ
                GROUP_EXECUTE GROUP_READ
                WORLD_EXECUTE WORLD_READ
)

# Criar diretório de instalação se não existir
install(DIRECTORY DESTINATION /opt/fazai/bin)

# Configurações de teste (opcional)
option(BUILD_TESTS "Build tests" OFF)
if(BUILD_TESTS)
    enable_testing()
    # TODO: Adicionar testes unitários
endif()

# Configurações de documentação (opcional)
option(BUILD_DOCS "Build documentation" OFF)
if(BUILD_DOCS)
    # TODO: Adicionar geração de documentação
endif()

# Informações do projeto
message(STATUS "FazAI Gemma Worker Configuration:")
message(STATUS "  C++ Standard: ${CMAKE_CXX_STANDARD}")
message(STATUS "  Build Type: ${CMAKE_BUILD_TYPE}")
message(STATUS "  Install Prefix: ${CMAKE_INSTALL_PREFIX}")
message(STATUS "  Build Tests: ${BUILD_TESTS}")
message(STATUS "  Build Docs: ${BUILD_DOCS}")
