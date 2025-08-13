cmake_minimum_required(VERSION 3.16)
project(fazai-gemma-worker LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_POSITION_INDEPENDENT_CODE ON)

# Ajuste o caminho da libgemma se necessário
set(GEMMA_LIB_PATH "${CMAKE_SOURCE_DIR}/root/gemma.cpp/build/libgemma.a")

add_executable(fazai-gemma-worker
    src/main.cpp
    src/worker.cpp
    src/ipc.cpp
)

target_include_directories(fazai-gemma-worker PRIVATE
    ${CMAKE_SOURCE_DIR}/src
    ${CMAKE_SOURCE_DIR}
)

# Verificar se libgemma.a existe e configurar modo de desenvolvimento se necessário
if(EXISTS "${GEMMA_LIB_PATH}")
    message(STATUS "libgemma.a encontrada em: ${GEMMA_LIB_PATH}")
    target_link_libraries(fazai-gemma-worker PRIVATE "${GEMMA_LIB_PATH}")
else()
    message(WARNING "libgemma.a não encontrada; compilando em modo desenvolvimento")
    target_compile_definitions(fazai-gemma-worker PRIVATE GEMMA_DEV_MODE)
    
    # Criar diretório stubs se não existir
    if(NOT EXISTS "${CMAKE_SOURCE_DIR}/stubs")
        add_subdirectory(stubs)
    endif()
endif()

target_link_libraries(fazai-gemma-worker PRIVATE pthread)