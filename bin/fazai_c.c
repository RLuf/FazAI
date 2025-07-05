// FazAI CLI em C - versão para testes
// Autor: Versão em C para integração de testes com o daemon FazAI

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <curl/curl.h>

struct Memory {
    char *response;
    size_t size;
};

// Callback para acumular a resposta HTTP
static size_t write_callback(void *data, size_t size, size_t nmemb, void *userp) {
    size_t total = size * nmemb;
    struct Memory *mem = (struct Memory *)userp;
    char *ptr = realloc(mem->response, mem->size + total + 1);
    if (!ptr) return 0;
    mem->response = ptr;
    memcpy(mem->response + mem->size, data, total);
    mem->size += total;
    mem->response[mem->size] = '\0';
    return total;
}

int main(int argc, char **argv) {
    if (argc < 2) {
        fprintf(stderr, "Uso: %s <comando>\n", argv[0]);
        return 1;
    }

    // Concatena argumentos em uma única string
    size_t len = 0;
    for (int i = 1; i < argc; i++) len += strlen(argv[i]) + 1;
    char *command = malloc(len + 1);
    if (!command) return 1;
    command[0] = '\0';
    for (int i = 1; i < argc; i++) {
        strcat(command, argv[i]);
        if (i < argc - 1) strcat(command, " ");
    }

    CURL *curl = curl_easy_init();
    if (!curl) {
        fprintf(stderr, "Erro ao inicializar libcurl\n");
        free(command);
        return 1;
    }

    struct Memory chunk = { .response = NULL, .size = 0 };
    curl_easy_setopt(curl, CURLOPT_URL, "http://localhost:3120/command");
    curl_easy_setopt(curl, CURLOPT_POST, 1L);

    // Prepara JSON manualmente
    char *json = NULL;
    if (asprintf(&json, "{\"command\":\"%s\"}", command) < 0) {
        fprintf(stderr, "Erro ao montar JSON\n");
        curl_easy_cleanup(curl);
        free(command);
        return 1;
    }
    curl_easy_setopt(curl, CURLOPT_POSTFIELDS, json);
    curl_easy_setopt(curl, CURLOPT_WRITEFUNCTION, write_callback);
    curl_easy_setopt(curl, CURLOPT_WRITEDATA, &chunk);
    curl_easy_setopt(curl, CURLOPT_TIMEOUT, 30L);

    struct curl_slist *headers = NULL;
    headers = curl_slist_append(headers, "Content-Type: application/json");
    curl_easy_setopt(curl, CURLOPT_HTTPHEADER, headers);

    CURLcode res = curl_easy_perform(curl);
    if (res != CURLE_OK) {
        fprintf(stderr, "Erro na requisição: %s\n", curl_easy_strerror(res));
    } else {
        printf("%s\n", chunk.response ? chunk.response : "");
    }

    curl_slist_free_all(headers);
    curl_easy_cleanup(curl);
    free(command);
    free(json);
    if (chunk.response) free(chunk.response);

    return (res == CURLE_OK) ? 0 : 1;
}
