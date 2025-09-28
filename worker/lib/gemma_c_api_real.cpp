// Real C API wrapper around Gemma C++ library (gemma.cpp)
#include <mutex>
#include <string>
#include <memory>
#include <vector>
#include <iostream>
#include <cstdlib>
#include <sys/stat.h>

// Include gemma headers from local checkout
#include "/home/rluft/gemma.cpp/gemma/gemma.h"
#include "/home/rluft/gemma.cpp/util/app.h"

using namespace gcpp;

extern "C" {
  void* gemma_init(const char* model_path);
  void gemma_free(void* ctx);
  void* gemma_create_session(void* ctx);
  void gemma_destroy_session(void* session);
  int gemma_generate_stream(void* session, const char* prompt, void (*callback)(const char*, void*), void* user_data);
  void gemma_abort(const char* session_id);
}

struct GemmaCtx {
  // unique_ptr to Gemma instance
  std::unique_ptr<Gemma> model;
  // simple mutex to protect concurrent access
  std::mutex mtx;
};

struct GemmaSession {
  // keep a pointer to Gemma (not owning)
  Gemma* model;
  // KVCache is still required by API - create one per session
  std::unique_ptr<KVCache> kv_cache;
  // mutex for thread safety
  std::mutex session_mtx;
};

extern "C" void* gemma_init(const char* model_path) {
  try {
    // Allow overriding tokenizer and weights via environment variables.
    // Priority: FAZAI_GEMMA_TOKENIZER, FAZAI_GEMMA_WEIGHTS. If not set,
    // fall back to the provided `model_path` as weights and empty tokenizer.
    const char* tok_env = std::getenv("FAZAI_GEMMA_TOKENIZER");
    const char* weights_env = std::getenv("FAZAI_GEMMA_WEIGHTS");
    std::string tokenizer_path = tok_env ? std::string(tok_env) : std::string("");
    std::string weights_path = weights_env ? std::string(weights_env) : std::string(model_path ? model_path : "");

    // Diagnostic: print resolved paths and existence
    auto check_exists = [](const std::string &p)->bool{
      struct stat sb;
      return p.size()>0 && stat(p.c_str(), &sb)==0;
    };
    std::cerr << "[gemma_c_api] tokenizer_path='" << tokenizer_path << "' exists=" << (check_exists(tokenizer_path)?"yes":"no") << std::endl;
    std::cerr << "[gemma_capi] weights_path='" << weights_path << "' exists=" << (check_exists(weights_path)?"yes":"no") << std::endl;

    // If a tokenizer is provided the Gemma Loader expects a model type string
    // to be present as well. Allow override via FAZAI_GEMMA_MODEL_TYPE, or
    // fall back to a sensible default for our deployed model.
    const char* model_type_env = std::getenv("FAZAI_GEMMA_MODEL_TYPE");
    std::string model_type_str = model_type_env ? std::string(model_type_env) : std::string("");
    if (model_type_str.empty() && !tokenizer_path.empty()) {
      // default for the packaged model
      model_type_str = std::string("gemma2-2b-it");
    }

    // Basic loader args: tokenizer_path, weights_path, model_type_str
    LoaderArgs loader{tokenizer_path, weights_path, model_type_str};

    // Create topology and pools from default AppArgs
    AppArgs app;
    BoundedTopology topo = CreateTopology(app);
    NestedPools pools = CreatePools(topo, app);
    MatMulEnv env(topo, pools);

    std::unique_ptr<Gemma> m = AllocateGemma(loader, env);
    if (!m) return nullptr;
    GemmaCtx* ctx = new GemmaCtx();
    ctx->model = std::move(m);
    return reinterpret_cast<void*>(ctx);
  } catch (const std::exception& e) {
    std::cerr << "gemma_init exception: " << e.what() << std::endl;
    return nullptr;
  }
}

extern "C" void gemma_free(void* ctx) {
  if (!ctx) return;
  GemmaCtx* c = reinterpret_cast<GemmaCtx*>(ctx);
  delete c;
}

extern "C" void* gemma_create_session(void* ctx) {
  if (!ctx) return nullptr;
  GemmaCtx* c = reinterpret_cast<GemmaCtx*>(ctx);
  GemmaSession* s = new GemmaSession();
  s->model = c->model.get();
  s->kv_cache = std::make_unique<KVCache>();
  return reinterpret_cast<void*>(s);
}

extern "C" void gemma_destroy_session(void* session) {
  if (!session) return;
  GemmaSession* s = reinterpret_cast<GemmaSession*>(session);
  delete s;
}

// adapter to call the user callback for tokens
static bool stream_adapter(const std::string& token, std::function<bool(const std::string&)>* cb) {
  if (!cb) return true;
  bool keep = (*cb)(token);
  return keep;
}

extern "C" int gemma_generate_stream(void* session, const char* prompt, void (*callback)(const char*, void*), void* user_data) {
  if (!session) return -1;
  GemmaSession* s = reinterpret_cast<GemmaSession*>(session);
  if (!s->model) return -2;

  std::lock_guard<std::mutex> lock(s->session_mtx);

  try {
    // build RuntimeConfig with stream callback
    std::mt19937 gen;
    RuntimeConfig rc;
    rc.gen = &gen;
    rc.stream_token = [&](int token, float) {
      if (callback) {
        std::string tok_text;
        s->model->Tokenizer().Decode(std::vector<int>{token}, &tok_text);
        callback(tok_text.c_str(), user_data);
      }
      return true;
    };

    // tokenize prompt (WrapAndTokenize expects std::string&)
    std::string prompt_str = prompt ? std::string(prompt) : std::string("");
    std::vector<int> tokens = WrapAndTokenize(s->model->Tokenizer(), s->model->Info(), 0, prompt_str);

    // Prepare PromptTokens span
    gcpp::PromptTokens pspan(tokens.empty() ? nullptr : tokens.data(), tokens.size());
    
    TimingInfo ti;
    // Use correct API: Generate(runtime_config, prompt, pos, kv_cache, timing_info)
    s->model->Generate(rc, pspan, 0, *s->kv_cache, ti);
    return 0;
  } catch (const std::exception& e) {
    std::cerr << "gemma_generate_stream exception: " << e.what() << std::endl;
    return -3;
  } catch (...) {
    std::cerr << "gemma_generate_stream unknown exception" << std::endl;
    return -4;
  }
}

extern "C" void gemma_abort(const char* session_id) {
  // Not implemented: future work to signal running generate to stop
  (void)session_id;
}
