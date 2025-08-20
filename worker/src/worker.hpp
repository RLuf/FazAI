#pragma once
#include <functional>
#include <string>
#include <unordered_map>
#include <atomic>
#include <memory>
#include <mutex>

// Forward declarations
namespace nlohmann {
    class json;
}

struct GenParams { 
    float temperature = 0.2f; 
    float top_p = 0.9f; 
    int max_tokens = 512; 
    float repeat_penalty = 1.1f;
};

struct SessionState { 
    std::atomic<bool> abort{false}; 
    GenParams params;
    std::string kv_cache_handle; // TODO: implementar KV cache real
    std::mutex session_mutex;
};

class GemmaEngine {
public:
    explicit GemmaEngine(const std::string& model_path);
    ~GemmaEngine();
    
    // Gerenciamento de sessões
    std::string create_session(const nlohmann::json& params);
    void close_session(const std::string& sid);
    
    // Geração de texto
    void generate_stream(const std::string& sid, const std::string& prompt,
                        std::function<bool(const std::string&)> on_token);
    
    // Controle de execução
    void abort(const std::string& sid);
    
    // Status e informações
    bool is_initialized() const { return initialized_; }
    std::string get_model_info() const;
    
private:
    // Inicialização do modelo
    bool initialize_model(const std::string& model_path);
    
    // Geração de ID único para sessão
    std::string generate_session_id();
    
    // Validação de parâmetros
    GenParams validate_params(const nlohmann::json& params);
    
    // Estado interno
    std::unordered_map<std::string, std::unique_ptr<SessionState>> sessions_;
    std::mutex sessions_mutex;
    bool initialized_ = false;
    
    // TODO: Adicionar handles do modelo libgemma.a
    // void* model_handle_ = nullptr;
    // void* tokenizer_handle_ = nullptr;
};