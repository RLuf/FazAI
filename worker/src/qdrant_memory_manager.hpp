#pragma once
#include <string>
#include <vector>
#include <unordered_map>
#include <memory>
#include <mutex>

namespace fazai {

struct ContextualMemory {
    std::string session_id;
    std::string user_id;
    std::string content;
    std::string timestamp;
    std::string memory_type; // "learning", "context", "preference"
    float relevance_score;
};

class QdrantMemoryManager {
public:
    QdrantMemoryManager(const std::string& qdrant_url = "http://127.0.0.1:6333");
    ~QdrantMemoryManager();

    // Armazenar nova memória contextual
    bool store_memory(const std::string& session_id, 
                     const std::string& user_id,
                     const std::string& content, 
                     const std::string& memory_type = "context");

    // Recuperar memórias relevantes para contexto
    std::vector<ContextualMemory> retrieve_relevant_memories(
        const std::string& user_id, 
        const std::string& query, 
        int limit = 5);

    // Recuperar histórico de aprendizado
    std::vector<ContextualMemory> get_learning_history(
        const std::string& user_id, 
        int limit = 10);

    // Atualizar relevância de memórias baseado em feedback
    bool update_memory_relevance(const std::string& memory_id, float new_score);

    // Limpar memórias antigas ou irrelevantes
    bool cleanup_old_memories(int days_threshold = 30);

private:
    std::string qdrant_url_;
    std::string memory_collection_;
    std::mutex memory_mutex_;
    
    // Cache local para memórias frequentes
    std::unordered_map<std::string, std::vector<ContextualMemory>> memory_cache_;
    
    // Gerar embedding para busca semântica
    std::vector<float> generate_embedding(const std::string& text);
    
    // Fazer requisição HTTP para Qdrant
    std::string make_qdrant_request(const std::string& method, 
                                   const std::string& endpoint, 
                                   const std::string& payload = "");
};

} // namespace fazai
