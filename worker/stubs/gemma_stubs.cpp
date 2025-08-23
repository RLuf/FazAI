#include <iostream>
#include <cstring>

// Stubs para funções da libgemma.a
// Estas são implementações mínimas que permitem o link sem a biblioteca real

extern "C" {
    // Funções básicas de inicialização
    void* gemma_init(const char* model_path) {
        std::cout << "[STUB] gemma_init chamada com modelo: " << (model_path ? model_path : "null") << std::endl;
        return (void*)0x12345678; // Retorna um ponteiro dummy
    }
    
    void gemma_free(void* ctx) {
        std::cout << "[STUB] gemma_free chamada" << std::endl;
    }
    
    // Funções de geração de texto
    int gemma_generate(void* ctx, const char* prompt, char* output, int max_len) {
        std::cout << "[STUB] gemma_generate chamada com prompt: " << (prompt ? prompt : "null") << std::endl;
        const char* stub_response = "Resposta stub do modelo Gemma";
        strncpy(output, stub_response, max_len - 1);
        output[max_len - 1] = '\0';
        return strlen(output);
    }
    
    // Funções de sessão
    void* gemma_create_session(void* ctx) {
        std::cout << "[STUB] gemma_create_session chamada" << std::endl;
        return (void*)0x87654321; // Retorna um ponteiro dummy
    }
    
    void gemma_destroy_session(void* session) {
        std::cout << "[STUB] gemma_destroy_session chamada" << std::endl;
    }
    
    // Funções de streaming
    int gemma_generate_stream(void* session, const char* prompt, 
                             void (*callback)(const char*, void*), void* user_data) {
        std::cout << "[STUB] gemma_generate_stream chamada" << std::endl;
        if (callback) {
            callback("Token stub 1", user_data);
            callback("Token stub 2", user_data);
            callback("Token stub 3", user_data);
        }
        return 0;
    }
    
    // Funções de configuração
    void gemma_set_temperature(void* ctx, float temp) {
        std::cout << "[STUB] gemma_set_temperature chamada com: " << temp << std::endl;
    }
    
    void gemma_set_top_p(void* ctx, float top_p) {
        std::cout << "[STUB] gemma_set_top_p chamada com: " << top_p << std::endl;
    }
    
    void gemma_set_repeat_penalty(void* ctx, float penalty) {
        std::cout << "[STUB] gemma_set_repeat_penalty chamada com: " << penalty << std::endl;
    }
    
    // Função de abort
    void gemma_abort(void* session) {
        std::cout << "[STUB] gemma_abort chamada" << std::endl;
    }
}