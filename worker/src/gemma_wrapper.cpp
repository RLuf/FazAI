#include "gemma_wrapper.h"
#include <cstdlib>
#include <dlfcn.h>
#include <iostream>
#include <string>
#include <functional>
#include <memory>

extern "C" {
// prototypes expected from libgemma or stubs
void* gemma_init(const char* model_path);
void gemma_free(void* ctx);
void* gemma_create_session(void* ctx);
void gemma_destroy_session(void* session);
int gemma_generate_stream(void* session, const char* prompt, void (*callback)(const char*, void*), void* user_data);
}

namespace fazai {

struct GemmaHandle { void* ctx = nullptr; };

static GemmaHandle g_handle;

static void bridge_cb(const char* tok, void* udata) {
    auto cb = reinterpret_cast<std::function<bool(const std::string&)>*>(udata);
    if (!cb) return;
    // if callback returns false, we have no way to notify stub (it doesn't support stop), so we still call
    (*cb)(std::string(tok));
}

GemmaWrapper::GemmaWrapper() {}

GemmaWrapper::~GemmaWrapper() { shutdown(); }

bool GemmaWrapper::init(const std::string& model_path) {
    if (g_handle.ctx) return true;
    g_handle.ctx = gemma_init(model_path.c_str());
    return g_handle.ctx != nullptr;
}

void GemmaWrapper::shutdown() {
    if (g_handle.ctx) {
        gemma_free(g_handle.ctx);
        g_handle.ctx = nullptr;
    }
}

void* GemmaWrapper::create_session() {
    if (!g_handle.ctx) return nullptr;
    return gemma_create_session(g_handle.ctx);
}

void GemmaWrapper::close_session(void* sess) {
    if (!sess) return;
    gemma_destroy_session(sess);
}

bool GemmaWrapper::generate_stream(void* sess, const std::string& prompt, std::function<bool(const std::string&)> cb) {
    if (!sess) return false;
    auto heap_cb = new std::function<bool(const std::string&)>(cb);
    int rc = gemma_generate_stream(sess, prompt.c_str(), &bridge_cb, heap_cb);
    // note: stub/gemma may have streamed all tokens synchronously
    delete heap_cb;
    return rc == 0;
}

} // namespace fazai
