#include "qdrant_client.h"
#include <cstdlib>
#include <fstream>
#include <sstream>
#include <iostream>

namespace fazai {

QdrantClient::QdrantClient(const std::string& host) : host_(host) {}
QdrantClient::~QdrantClient() {}

std::vector<std::string> QdrantClient::query_context(const std::string& collection, const std::string& text, int limit) {
    std::vector<std::string> res;
    // Simple implementation: call /collections/<collection>/points/search with curl
    std::string tmp = "/tmp/qdrant_query.json";
    std::string cmd = "curl -s -X POST '" + host_ + "/collections/" + collection + "/points/search' -H 'Content-Type: application/json' -d '{\"vector\":[],\"limit\":1}' > " + tmp;
    int rc = system(cmd.c_str());
    if (rc != 0) return res;
    std::ifstream ifs(tmp);
    if (!ifs) return res;
    std::stringstream ss;
    ss << ifs.rdbuf();
    std::string body = ss.str();
    // naive: push whole body as single context
    if (!body.empty()) res.push_back(body);
    return res;
}

bool QdrantClient::upsert_doc(const std::string& collection, const std::string& id, const std::string& text) {
    std::string payload = "{\"points\":[{\"id\":\"" + id + "\",\"vector\":[],\"payload\":{\"text\":\"" + text + "\"}}]}";
    std::string cmd = "curl -s -X PUT '" + host_ + "/collections/" + collection + "/points' -H 'Content-Type: application/json' -d '" + payload + "' > /dev/null";
    int rc = system(cmd.c_str());
    return rc == 0;
}

} // namespace fazai
