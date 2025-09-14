#pragma once
#include <string>
#include <memory>
#include <nlohmann/json.hpp>

/**
 * QDRANT PERSONALITY INTEGRATION
 * Integra personalidade do Claudio no Gemma Worker
 */

class QdrantPersonality {
private:
    std::string personality_script_path_;
    std::string cached_system_prompt_;
    bool personality_loaded_;
    
public:
    QdrantPersonality(const std::string& script_path = "./qdrant_personality.js");
    ~QdrantPersonality() = default;
    
    // Carrega personalidade do Qdrant
    bool loadPersonality();
    
    // Retorna o system prompt com personalidade
    std::string getSystemPrompt() const;
    
    // Verifica se personalidade está carregada
    bool isLoaded() const { return personality_loaded_; }
    
    // Aplica personalidade a um prompt de usuário
    std::string enhancePrompt(const std::string& user_prompt) const;
    
    // Recarrega personalidade do Qdrant
    bool reloadPersonality();
    
private:
    std::string executeNodeScript(const std::string& script_path) const;
};