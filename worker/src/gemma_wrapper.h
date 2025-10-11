#pragma once
#include <functional>
#include <string>

namespace fazai {

class GemmaWrapper {
public:
    GemmaWrapper();
    ~GemmaWrapper();

    bool init(const std::string& model_path);
    void shutdown();

    // create session; return session id opaque
    void* create_session();
    void close_session(void* sess);

    // generate stream: callback receives token fragments; return false to abort
    bool generate_stream(void* sess, const std::string& prompt, std::function<bool(const std::string&)> cb);
};

} // namespace fazai
