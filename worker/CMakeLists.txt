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
)

# Arquivos de cabeçalho
set(HEADERS
    src/worker.hpp
    src/ipc.hpp
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
    # TODO: Adicionar libgemma.a quando disponível
    # ${CMAKE_CURRENT_SOURCE_DIR}/lib/libgemma.a
)

# Configurações específicas da plataforma
if(UNIX)
    target_link_libraries(fazai-gemma-worker PRIVATE 
        rt  # Para clock_gettime
    )
endif()

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
