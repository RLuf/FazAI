#pragma once
#include <string>
#include <vector>

namespace fazai {

class QdrantClient {
public:
    QdrantClient(const std::string& host="http://127.0.0.1:6333");
    ~QdrantClient();

    // query context by embedding or text (simplified)
    std::vector<std::string> query_context(const std::string& collection, const std::string& text, int limit=5);

    // upsert a doc (id, text) into collection
    bool upsert_doc(const std::string& collection, const std::string& id, const std::string& text);

private:
    std::string host_;
};

} // namespace fazai
