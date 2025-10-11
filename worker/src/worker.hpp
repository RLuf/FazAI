#pragma once
#include <functional>
#include <string>
#include <unordered_map>
#include <atomic>
#include <memory>
#include <mutex>
#include <nlohmann/json.hpp>

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
    // Handle para sessão gemma (quando integrada)
    void* gemma_session = nullptr;
};

class GemmaEngine {
public:
    GemmaEngine();
    GemmaEngine(const std::string& model_path);
    ~GemmaEngine();
    
    bool initialize_model(const std::string& model_path);
    void set_personality_prompt(const std::string& personality_prompt);
    
    std::string create_session(const nlohmann::json& params);
    void close_session(const std::string& sid);
    void abort(const std::string& sid);
    
    void generate_stream(const std::string& sid, const std::string& prompt,
                        std::function<bool(const std::string&)> on_token);
    
    std::string get_model_info() const;

private:
    void* model_ctx_;
    std::mutex sessions_mutex;
    std::unordered_map<std::string, std::unique_ptr<SessionState>> sessions_;
    
    // Personalidade do Claudio
    std::string personality_prompt_;
    bool personality_loaded_;
    bool initialized_;
    
    std::string generate_session_id();
    GenParams validate_params(const nlohmann::json& params);
    std::string enhance_prompt_with_personality(const std::string& user_prompt) const;
};
