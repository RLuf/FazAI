#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>
#include <unistd.h>
#include <sys/utsname.h>

// Estrutura de informações do módulo
typedef struct {
    const char* name;
    const char* version;
    const char* description;
    const char* author;
} fazai_module_info_t;

// Informações do módulo
static fazai_module_info_t module_info = {
    .name = "system_mod",
    .version = "1.0.0",
    .description = "Módulo de sistema para informações e utilitários",
    .author = "Andarilho do Veus & Roginho"
};

// Função básica para teste
int fazai_test() {
    return 42;
}

// Função de inicialização do módulo
int fazai_mod_init() {
    printf("[FAZAI] Inicializando módulo ERECAO TOTAL %s v%s\n", module_info.name, module_info.version);
    printf("[FAZAI] Autor: %s\n", module_info.author);
    printf("[FAZAI] Descrição: %s\n", module_info.description);
    return 0; // 0 = sucesso
}

// Função para obter informações do módulo
const fazai_module_info_t* fazai_mod_info() {
    return &module_info;
}

// Função para obter PID do processo
int fazai_get_pid() {
    return getpid();
}

// Função para obter timestamp atual
long fazai_get_timestamp() {
    return time(NULL);
}

// Função para obter informações do sistema
int fazai_get_system_info(char* buffer, int buffer_size) {
    struct utsname sys_info;
    
    if (uname(&sys_info) != 0) {
        return -1;
    }
    
    snprintf(buffer, buffer_size, 
        "Sistema: %s %s\nArquitetura: %s\nHostname: %s", 
        sys_info.sysname, 
        sys_info.release,
        sys_info.machine,
        sys_info.nodename
    );
    
    return 0;
}

// Função para simular trabalho pesado (útil para testes)
int fazai_heavy_work(int iterations) {
    int result = 0;
    for (int i = 0; i < iterations; i++) {
        result += i * i;
    }
    return result;
}

// Função para verificar se o módulo está funcionando
int fazai_health_check() {
    // Simula verificações de saúde
    if (fazai_test() == 42 && fazai_get_pid() > 0) {
        return 1; // Saudável
    }
    return 0; // Problemas
}

// Função principal de execução do módulo
// Esta é a função que o fazai chama para executar comandos
int fazai_mod_exec(const char* command, const char* args, char* output, int output_size) {
    if (!command) {
        snprintf(output, output_size, "Erro: comando não especificado");
        return -1;
    }
    
    // Comando: test
    if (strcmp(command, "test") == 0) {
        int result = fazai_test();
        snprintf(output, output_size, "Resultado do teste: %d", result);
        return 0;
    }
    
    // Comando: pid
    if (strcmp(command, "pid") == 0) {
        int pid = fazai_get_pid();
        snprintf(output, output_size, "PID do processo: %d", pid);
        return 0;
    }
    
    // Comando: timestamp
    if (strcmp(command, "timestamp") == 0) {
        long ts = fazai_get_timestamp();
        snprintf(output, output_size, "Timestamp atual: %ld", ts);
        return 0;
    }
    
    // Comando: sysinfo
    if (strcmp(command, "sysinfo") == 0) {
        if (fazai_get_system_info(output, output_size) == 0) {
            return 0;
        } else {
            snprintf(output, output_size, "Erro ao obter informações do sistema");
            return -1;
        }
    }
    
    // Comando: health
    if (strcmp(command, "health") == 0) {
        int healthy = fazai_health_check();
        snprintf(output, output_size, "Status: %s", healthy ? "Saudável" : "Problemas");
        return 0;
    }
    
    // Comando: work
    if (strcmp(command, "work") == 0) {
        int iterations = args ? atoi(args) : 1000;
        int result = fazai_heavy_work(iterations);
        snprintf(output, output_size, "Trabalho pesado (%d iterações): %d", iterations, result);
        return 0;
    }
    
    // Comando: help
    if (strcmp(command, "help") == 0) {
        snprintf(output, output_size, 
            "Comandos disponíveis:\n"
            "  test       - Executa teste básico\n"
            "  pid        - Mostra PID do processo\n"
            "  timestamp  - Mostra timestamp atual\n"
            "  sysinfo    - Mostra informações do sistema\n"
            "  health     - Verifica saúde do módulo\n"
            "  work <n>   - Executa trabalho pesado com n iterações\n"
            "  help       - Mostra esta ajuda"
        );
        return 0;
    }
    
    // Comando não reconhecido
    snprintf(output, output_size, "Comando não reconhecido: %s. Use 'help' para ver comandos disponíveis.", command);
    return -1;
}

// Função de limpeza do módulo
void fazai_mod_cleanup() {
    printf("[FAZAI] Finalizando módulo %s\n", module_info.name);
    printf("[FAZAI] Tchau tchau! 👋\n");
}
