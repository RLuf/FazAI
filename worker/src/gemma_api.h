// Declarações C da API libgemma (stubs em stubs/gemma_stubs.cpp)
#pragma once

#ifdef __cplusplus
extern "C" {
#endif

void* gemma_init(const char* model_path);
void gemma_free(void* ctx);
int gemma_generate(void* ctx, const char* prompt, char* output, int max_len);
void* gemma_create_session(void* ctx);
void gemma_destroy_session(void* session);
int gemma_generate_stream(void* session, const char* prompt, void (*callback)(const char*, void*), void* user_data);
void gemma_set_temperature(void* ctx, float temp);
void gemma_set_top_p(void* ctx, float top_p);
void gemma_set_repeat_penalty(void* ctx, float penalty);
void gemma_abort(void* session);

#ifdef __cplusplus
}
#endif
