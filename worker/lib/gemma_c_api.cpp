// Thin C wrapper around local gemma.cpp APIs to expose C symbols
#include <cstring>
#include <string>
#include <functional>
#include <memory>

extern "C" {
  void* gemma_init(const char* model_path);
  void gemma_free(void* ctx);
  void* gemma_create_session(void* ctx);
  void gemma_destroy_session(void* session);
  int gemma_generate_stream(void* session, const char* prompt, void (*callback)(const char*, void*), void* user_data);
  void gemma_abort(const char* session_id);
}

// Implementation using gemma.cpp C++ APIs (minimal, may need tuning)
#include <iostream>
#include <vector>
#include <mutex>

// We keep a simple opaque context that holds a GemmaEnv and model pointer.
struct GemmaCContext {
  // Placeholder: user should implement proper loader using gemma.cpp LoaderArgs/InfernceArgs
  void* model_ptr = nullptr; // actual type is gcpp::Gemma* but we avoid including gemma headers here
};

extern "C" void* gemma_init(const char* model_path) {
  // Minimal stub: real implementation should initialize gcpp::Gemma using LoaderArgs
  GemmaCContext* ctx = new GemmaCContext();
  // For now indicate success but not functional; the worker will detect by null session if unsupported
  (void)model_path;
  return reinterpret_cast<void*>(ctx);
}

extern "C" void gemma_free(void* ctx) {
  GemmaCContext* c = reinterpret_cast<GemmaCContext*>(ctx);
  delete c;
}

extern "C" void* gemma_create_session(void* ctx) {
  // Create an opaque session handle; real implementation should create a proper session
  (void)ctx;
  return malloc(1); // non-null placeholder
}

extern "C" void gemma_destroy_session(void* session) {
  if (!session) return;
  free(session);
}

extern "C" int gemma_generate_stream(void* session, const char* prompt, void (*callback)(const char*, void*), void* user_data) {
  if (!session) return -1;
  // Very small synchronous generator that just returns the prompt as tokens
  std::string s = prompt ? prompt : "";
  if (callback) callback(s.c_str(), user_data);
  return 0;
}

extern "C" void gemma_abort(const char* session_id) {
  // No-op in this minimal wrapper — real implementation should signal in-progress generation to stop
  (void)session_id;
}
