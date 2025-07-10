/*
 * FazAI DeepSeek Helper - Versão Standalone em C
 * Autor: Roger Luft
 * Licença: Creative Commons Attribution 4.0 International (CC BY 4.0)
 */

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <curl/curl.h>
#include <json-c/json.h>

#define DEFAULT_KEY ""
#define DEFAULT_MODEL "deepseek/deepseek-r1-0528:free"
#define ENDPOINT "https://openrouter.ai/api/v1"
#define MAX_RESPONSE_SIZE 65536

struct APIResponse {
    char *data;
    size_t size;
};

static size_t write_callback(void *contents, size_t size, size_t nmemb, struct APIResponse *response) {
    size_t realsize = size * nmemb;
    char *ptr = realloc(response->data, response->size + realsize + 1);

    if (!ptr) {
        printf("Erro: não foi possível alocar memória\n");
        return 0;
    }

    response->data = ptr;
    memcpy(&(response->data[response->size]), contents, realsize);
    response->size += realsize;
    response->data[response->size] = 0;

    return realsize;
}

int deepseek_query(const char *prompt) {
    CURL *curl;
    CURLcode res;
    struct APIResponse response = {0};
    struct curl_slist *headers = NULL;

    curl = curl_easy_init();
    if (!curl) {
        fprintf(stderr, "Erro ao inicializar CURL\n");
        return 1;
    }

    // Preparar JSON da requisição
    json_object *root = json_object_new_object();
    json_object *model = json_object_new_string(DEFAULT_MODEL);
    json_object *messages = json_object_new_array();
    json_object *message = json_object_new_object();
    json_object *role = json_object_new_string("user");
    json_object *content = json_object_new_string(prompt);

    json_object_object_add(message, "role", role);
    json_object_object_add(message, "content", content);
    json_object_array_add(messages, message);
    json_object_object_add(root, "model", model);
    json_object_object_add(root, "messages", messages);

    const char *json_string = json_object_to_json_string(root);

    // Configurar headers
    char auth_header[512];
    snprintf(auth_header, sizeof(auth_header), "Authorization: Bearer %s", DEFAULT_KEY);

    headers = curl_slist_append(headers, "Content-Type: application/json");
    headers = curl_slist_append(headers, auth_header);
    headers = curl_slist_append(headers, "HTTP-Referer: https://github.com/RLuf/FazAI");
    headers = curl_slist_append(headers, "X-Title: FazAI DeepSeek Standalone");

    // Configurar CURL
    curl_easy_setopt(curl, CURLOPT_URL, ENDPOINT "/chat/completions");
    curl_easy_setopt(curl, CURLOPT_POSTFIELDS, json_string);
    curl_easy_setopt(curl, CURLOPT_HTTPHEADER, headers);
    curl_easy_setopt(curl, CURLOPT_WRITEFUNCTION, write_callback);
    curl_easy_setopt(curl, CURLOPT_WRITEDATA, &response);
    curl_easy_setopt(curl, CURLOPT_TIMEOUT, 30L);
    curl_easy_setopt(curl, CURLOPT_USERAGENT, "FazAI-DeepSeek/1.0");

    // Executar requisição
    res = curl_easy_perform(curl);

    if (res != CURLE_OK) {
        fprintf(stderr, "Erro na requisição: %s\n", curl_easy_strerror(res));
        curl_easy_cleanup(curl);
        curl_slist_free_all(headers);
        json_object_put(root);
        if (response.data) free(response.data);
        return 1;
    }

    // Processar resposta
    if (response.data) {
        json_object *response_json = json_tokener_parse(response.data);
        if (response_json) {
            json_object *choices, *first_choice, *message_obj, *content_obj;

            if (json_object_object_get_ex(response_json, "choices", &choices) &&
                json_object_is_type(choices, json_type_array) &&
                json_object_array_length(choices) > 0) {

                first_choice = json_object_array_get_idx(choices, 0);
                if (json_object_object_get_ex(first_choice, "message", &message_obj) &&
                    json_object_object_get_ex(message_obj, "content", &content_obj)) {

                    const char *content_str = json_object_get_string(content_obj);
                    printf("%s\n", content_str);
                } else {
                    printf("Erro: formato de resposta inválido\n");
                }
            } else {
                printf("Erro: nenhuma resposta recebida\n");
            }

            json_object_put(response_json);
        } else {
            printf("Erro ao processar JSON da resposta\n");
        }
        free(response.data);
    }

    // Limpeza
    curl_easy_cleanup(curl);
    curl_slist_free_all(headers);
    json_object_put(root);

    return 0;
}

int main(int argc, char *argv[]) {
    if (argc < 2) {
        fprintf(stderr, "Uso: %s <prompt>\n", argv[0]);
        fprintf(stderr, "Exemplo: %s \"Como instalar nginx no Ubuntu?\"\n", argv[0]);
        return 1;
    }

    // Concatenar todos os argumentos como prompt
    size_t total_len = 0;
    for (int i = 1; i < argc; i++) {
        total_len += strlen(argv[i]) + 1;
    }

    char *prompt = malloc(total_len + 1);
    if (!prompt) {
        fprintf(stderr, "Erro ao alocar memória para prompt\n");
        return 1;
    }

    prompt[0] = '\0';
    for (int i = 1; i < argc; i++) {
        strcat(prompt, argv[i]);
        if (i < argc - 1) strcat(prompt, " ");
    }

    int result = deepseek_query(prompt);
    free(prompt);

    return result;
}