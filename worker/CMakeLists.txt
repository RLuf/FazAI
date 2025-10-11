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

# Compilar gemma.cpp como uma biblioteca estática
if(EXISTS "/home/rluft/gemma.cpp")
    message(STATUS "Compilando libgemma_local a partir de /home/rluft/gemma.cpp")
    set(GEMMA_ENABLE_TESTS OFF)
    # Glob mais seletivo para incluir apenas o núcleo do gemma
    file(GLOB_RECURSE GEMMA_SOURCES
        "/home/rluft/gemma.cpp/gemma/*.cc"
        "/home/rluft/gemma.cpp/ops/*.cc"
        "/home/rluft/gemma.cpp/compression/*.cc"
    )
    
    # Excluir o diretório python explicitamente
    file(GLOB_RECURSE PYTHON_EXTENSION_SOURCES "/home/rluft/gemma.cpp/compression/python/*.cc")
    list(REMOVE_ITEM GEMMA_SOURCES ${PYTHON_EXTENSION_SOURCES})

    if(GEMMA_SOURCES)
        add_library(libgemma_local STATIC ${GEMMA_SOURCES})
        target_include_directories(libgemma_local PRIVATE /home/rluft/gemma.cpp /home/rluft/gemma.cpp/gemma /home/rluft/gemma.cpp/third_party /home/rluft/gemma.cpp/third_party/highway ${CMAKE_CURRENT_SOURCE_DIR}/src ${CMAKE_CURRENT_SOURCE_DIR}/lib/sentencepiece/include)
        target_compile_features(libgemma_local PUBLIC cxx_std_17)
        set_target_properties(libgemma_local PROPERTIES POSITION_INDEPENDENT_CODE ON)
    endif()
else()
    message(FATAL_ERROR "Diretório /home/rluft/gemma.cpp não encontrado. Stubs são proibidos.")
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
if(EXISTS "${CMAKE_CURRENT_SOURCE_DIR}/lib/gemma_c_api_real.cpp")
    message(STATUS "Usando wrapper C real: lib/gemma_c_api_real.cpp")
    add_library(gemma_capi_real STATIC ${CMAKE_CURRENT_SOURCE_DIR}/lib/gemma_c_api_real.cpp)
    target_include_directories(gemma_capi_real PRIVATE ${CMAKE_CURRENT_SOURCE_DIR}/src /home/rluft/gemma.cpp /home/rluft/gemma.cpp/gemma /home/rluft/gemma.cpp/third_party /home/rluft/gemma.cpp/third_party/highway)
    target_compile_features(gemma_capi_real PUBLIC cxx_std_17)
    set_target_properties(gemma_capi_real PROPERTIES POSITION_INDEPENDENT_CODE ON)
    target_link_libraries(fazai-gemma-worker PRIVATE gemma_capi_real)
    if(TARGET libgemma_local)
        target_link_libraries(gemma_capi_real PRIVATE libgemma_local)
    endif()
endif()

# Linkar a biblioteca gemma local compilada
if(TARGET libgemma_local)
    target_link_libraries(fazai-gemma-worker PRIVATE libgemma_local)
endif()

# Linkar bibliotecas de terceiros
if(EXISTS "/home/rluft/gemma.cpp/third_party/highway/build/libhwy.a")
    target_link_libraries(fazai-gemma-worker PRIVATE /home/rluft/gemma.cpp/third_party/highway/build/libhwy.a)
endif()
if(EXISTS "/home/rluft/gemma.cpp/third_party/highway/build/libhwy_contrib.a")
    target_link_libraries(fazai-gemma-worker PRIVATE /home/rluft/gemma.cpp/third_party/highway/build/libhwy_contrib.a)
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
