#include <cctype>
#include <cstdlib>
#include <cstring>
#include <memory>
#include <mutex>
#include <string>

#include "gemma/bindings/context.h"

namespace {

struct GemmaContextDeleter {
    void operator()(gcpp::GemmaContext* ctx) const noexcept {
        delete ctx;
    }
};

struct GemmaCtx {
    std::string weights_path;
    std::string tokenizer_path;
    int max_tokens;
    float temperature;
    int top_k;
    bool deterministic;
    bool multiturn;
    int prefill_tbatch;
};

struct GemmaSession {
    std::unique_ptr<gcpp::GemmaContext, GemmaContextDeleter> context;
    int max_tokens;
};

int parse_int(const char* env_value, int fallback, int min_value = 1) {
    if (!env_value || std::strlen(env_value) == 0) {
        return fallback;
    }
    try {
        int value = std::stoi(env_value);
        return value < min_value ? min_value : value;
    } catch (...) {
        return fallback;
    }
}

float parse_float(const char* env_value, float fallback) {
    if (!env_value || std::strlen(env_value) == 0) {
        return fallback;
    }
    try {
        return std::stof(env_value);
    } catch (...) {
        return fallback;
    }
}

bool parse_bool(const char* env_value, bool fallback) {
    if (!env_value || std::strlen(env_value) == 0) {
        return fallback;
    }
    std::string value(env_value);
    for (auto& ch : value) {
        ch = static_cast<char>(std::tolower(ch));
    }
    if (value == "1" || value == "true" || value == "yes" || value == "on") {
        return true;
    }
    if (value == "0" || value == "false" || value == "no" || value == "off") {
        return false;
    }
    return fallback;
}

void configure_context(gcpp::GemmaContext& ctx, const GemmaCtx& base) {
    ctx.SetMaxGeneratedTokens(base.max_tokens);
    ctx.SetTemperature(base.temperature);
    ctx.SetTopK(base.top_k);
    ctx.SetDeterministic(base.deterministic);
    ctx.SetMultiturn(base.multiturn ? 1 : 0);
    ctx.SetPrefillTbatchSize(base.prefill_tbatch);
}

bool stream_callback(const char* token, void* user_data) {
    if (!token || !user_data) {
        return true;
    }
    auto* buffer = static_cast<std::string*>(user_data);
    buffer->append(token);
    return true;
}

struct StreamState {
    std::string* buffer;
    void (*external)(const char*, void*);
    void* external_user;
};

bool dispatch_stream(const char* token, void* user_data) {
    auto* state = static_cast<StreamState*>(user_data);
    if (!state) {
        return true;
    }
    if (token && state->buffer) {
        state->buffer->append(token);
    }
    if (token && state->external) {
        state->external(token, state->external_user);
    }
    return true;
}

}  // namespace

extern "C" {

void* gemma_init(const char* model_path) {
    if (!model_path || std::strlen(model_path) == 0) {
        return nullptr;
    }

    auto* ctx = new GemmaCtx();
    ctx->weights_path = model_path;

    const char* tokenizer_env = std::getenv("FAZAI_GEMMA_TOKENIZER");
    if (tokenizer_env && std::strlen(tokenizer_env) > 0) {
        ctx->tokenizer_path = tokenizer_env;
    }

    ctx->max_tokens = parse_int(std::getenv("FAZAI_GEMMA_MAX_TOKENS"), 512);
    ctx->temperature = parse_float(std::getenv("FAZAI_GEMMA_TEMPERATURE"), 0.2f);
    ctx->top_k = parse_int(std::getenv("FAZAI_GEMMA_TOP_K"), 1);
    ctx->deterministic = parse_bool(std::getenv("FAZAI_GEMMA_DETERMINISTIC"), true);
    ctx->multiturn = parse_bool(std::getenv("FAZAI_GEMMA_MULTITURN"), false);
    ctx->prefill_tbatch = parse_int(std::getenv("FAZAI_GEMMA_PREFILL_TBATCH"), 256);

    return ctx;
}

void gemma_free(void* ctx_ptr) {
    auto* ctx = static_cast<GemmaCtx*>(ctx_ptr);
    delete ctx;
}

void* gemma_create_session(void* ctx_ptr) {
    auto* base = static_cast<GemmaCtx*>(ctx_ptr);
    if (!base) {
        return nullptr;
    }

    auto session = std::make_unique<GemmaSession>();

    const char* tokenizer_cstr = base->tokenizer_path.empty() ? "" : base->tokenizer_path.c_str();
    std::unique_ptr<gcpp::GemmaContext, GemmaContextDeleter> context(
        gcpp::GemmaContext::Create(tokenizer_cstr, base->weights_path.c_str(), base->max_tokens));

    if (!context) {
        return nullptr;
    }

    configure_context(*context, *base);

    session->max_tokens = base->max_tokens;
    session->context = std::move(context);

    return session.release();
}

void gemma_destroy_session(void* session_ptr) {
    auto* session = static_cast<GemmaSession*>(session_ptr);
    delete session;
}

int gemma_generate_stream(void* session_ptr, const char* prompt,
                          void (*callback)(const char*, void*), void* user_data) {
    auto* session = static_cast<GemmaSession*>(session_ptr);
    if (!session || !session->context) {
        return -1;
    }

    std::string buffer;
    buffer.reserve(static_cast<size_t>(session->max_tokens) * 4);

    StreamState state{&buffer, callback, user_data};

    int rc = session->context->Generate(
        prompt ? prompt : "",
        nullptr,
        0,
        dispatch_stream,
        &state
    );

    return rc < 0 ? rc : 0;
}

void gemma_abort(const char* /*session_id*/) {
    // Não suportado na implementação atual.
}

}  // extern "C"
