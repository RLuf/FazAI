# Stubs para modo de desenvolvimento
add_library(gemma_stubs STATIC
    gemma_stubs.cpp
)

target_include_directories(gemma_stubs PUBLIC
    ${CMAKE_CURRENT_SOURCE_DIR}
)

# Linkar stubs ao executável principal
target_link_libraries(fazai-gemma-worker PRIVATE gemma_stubs)