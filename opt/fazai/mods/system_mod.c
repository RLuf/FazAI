/**
 * FazAI - Módulo de Sistema
 * 
 * Este módulo fornece funções de baixo nível para interagir com o sistema,
 * como execução de comandos privilegiados, monitoramento de recursos, etc.
 * 
 * Compilação:
 * gcc -shared -fPIC -o system_mod.so system_mod.c
 */

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>
#include <sys/types.h>
#include <sys/stat.h>
#include <fcntl.h>
#include <time.h>
#include <errno.h>
#include <sys/sysinfo.h>
#include <sys/utsname.h>
#include "fazai_mod.h"

#define MAX_CMD_OUTPUT 8192
#define MAX_CMD_LEN 1024
#define LOG_FILE "/var/log/fazai/fazai.log"

// Estrutura para armazenar estatísticas do sistema
typedef struct {
    unsigned long uptime;
    unsigned long totalram;
    unsigned long freeram;
    unsigned long sharedram;
    unsigned long bufferram;
    unsigned long totalswap;
    unsigned long freeswap;
    unsigned long procs;
} SystemStats;

// Variáveis globais
static int initialized = 0;
static FILE* log_file = NULL;

/**
 * Registra uma mensagem no log
 */
static void log_message(const char* level, const char* message) {
    time_t now;
    struct tm* timeinfo;
    char timestamp[20];
    
    time(&now);
    timeinfo = localtime(&now);
    strftime(timestamp, sizeof(timestamp), "%Y-%m-%d %H:%M:%S", timeinfo);
    
    if (log_file == NULL) {
        log_file = fopen(LOG_FILE, "a");
        if (log_file == NULL) {
            fprintf(stderr, "Erro ao abrir arquivo de log: %s\n", strerror(errno));
            return;
        }
    }
    
    fprintf(log_file, "[%s] [%s] [system_mod] %s\n", timestamp, level, message);
    fflush(log_file);
}

/**
 * Executa um comando do sistema e captura a saída
 */
static int execute_system_command(const char* command, char* output, int output_len) {
    FILE* pipe;
    char buffer[128];
    size_t bytes_read;
    size_t total_bytes = 0;
    
    if (output == NULL || output_len <= 0) {
        log_message("ERROR", "Buffer de saída inválido");
        return -1;
    }
    
    // Limpa o buffer de saída
    memset(output, 0, output_len);
    
    // Registra o comando no log
    char log_msg[MAX_CMD_LEN + 32];
    snprintf(log_msg, sizeof(log_msg), "Executando comando: %s", command);
    log_message("INFO", log_msg);
    
    // Executa o comando
    pipe = popen(command, "r");
    if (pipe == NULL) {
        snprintf(output, output_len, "Erro ao executar comando: %s", strerror(errno));
        log_message("ERROR", output);
        return -1;
    }
    
    // Lê a saída do comando
    while ((bytes_read = fread(buffer, 1, sizeof(buffer) - 1, pipe)) > 0) {
        buffer[bytes_read] = '\0';
        
        // Verifica se há espaço no buffer de saída
        if (total_bytes + bytes_read >= output_len - 1) {
            bytes_read = output_len - total_bytes - 1;
            if (bytes_read <= 0) {
                break;
            }
        }
        
        // Copia os bytes lidos para o buffer de saída
        memcpy(output + total_bytes, buffer, bytes_read);
        total_bytes += bytes_read;
        output[total_bytes] = '\0';
    }
    
    // Fecha o pipe e obtém o código de retorno
    int status = pclose(pipe);
    int exit_code = WEXITSTATUS(status);
    
    // Registra o resultado no log
    snprintf(log_msg, sizeof(log_msg), "Comando concluído com código %d", exit_code);
    log_message("INFO", log_msg);
    
    return exit_code;
}

/**
 * Obtém estatísticas do sistema
 */
static int get_system_stats(SystemStats* stats) {
    struct sysinfo info;
    
    if (sysinfo(&info) != 0) {
        log_message("ERROR", "Erro ao obter informações do sistema");
        return -1;
    }
    
    stats->uptime = info.uptime;
    stats->totalram = info.totalram;
    stats->freeram = info.freeram;
    stats->sharedram = info.sharedram;
    stats->bufferram = info.bufferram;
    stats->totalswap = info.totalswap;
    stats->freeswap = info.freeswap;
    stats->procs = info.procs;
    
    return 0;
}

/**
 * Obtém informações do sistema operacional
 */
static int get_system_info(char* output, int output_len) {
    struct utsname system_info;
    SystemStats stats;
    
    if (uname(&system_info) != 0) {
        snprintf(output, output_len, "Erro ao obter informações do sistema: %s", strerror(errno));
        log_message("ERROR", output);
        return -1;
    }
    
    if (get_system_stats(&stats) != 0) {
        snprintf(output, output_len, "Erro ao obter estatísticas do sistema: %s", strerror(errno));
        log_message("ERROR", output);
        return -1;
    }
    
    // Formata a saída
    snprintf(output, output_len,
        "Sistema: %s %s %s %s %s\n"
        "Hostname: %s\n"
        "Tempo de atividade: %lu segundos\n"
        "Memória total: %lu KB\n"
        "Memória livre: %lu KB\n"
        "Memória compartilhada: %lu KB\n"
        "Memória em buffer: %lu KB\n"
        "Swap total: %lu KB\n"
        "Swap livre: %lu KB\n"
        "Processos: %lu\n",
        system_info.sysname, system_info.nodename, system_info.release,
        system_info.version, system_info.machine,
        system_info.nodename,
        stats.uptime,
        stats.totalram / 1024,
        stats.freeram / 1024,
        stats.sharedram / 1024,
        stats.bufferram / 1024,
        stats.totalswap / 1024,
        stats.freeswap / 1024,
        stats.procs
    );
    
    return 0;
}

/**
 * Cria um usuário no sistema
 */
static int create_user(const char* username, const char* password, const char* group, char* output, int output_len) {
    char command[MAX_CMD_LEN];
    int result;
    
    // Verifica se o grupo existe, se não, cria
    snprintf(command, sizeof(command), "getent group %s > /dev/null || groupadd %s", group, group);
    result = execute_system_command(command, output, output_len);
    if (result != 0) {
        return result;
    }
    
    // Cria o usuário
    snprintf(command, sizeof(command), "useradd -m -g %s %s", group, username);
    result = execute_system_command(command, output, output_len);
    if (result != 0) {
        return result;
    }
    
    // Define a senha
    snprintf(command, sizeof(command), "echo '%s:%s' | chpasswd", username, password);
    result = execute_system_command(command, output, output_len);
    if (result != 0) {
        return result;
    }
    
    snprintf(output, output_len, "Usuário %s criado com sucesso no grupo %s", username, group);
    return 0;
}

/**
 * Altera a porta do SSH
 */
static int change_ssh_port(const char* port, char* output, int output_len) {
    char command[MAX_CMD_LEN];
    int result;
    
    // Verifica se o arquivo de configuração existe
    snprintf(command, sizeof(command), "[ -f /etc/ssh/sshd_config ]");
    result = execute_system_command(command, output, output_len);
    if (result != 0) {
        snprintf(output, output_len, "Arquivo de configuração SSH não encontrado");
        return -1;
    }
    
    // Faz backup do arquivo de configuração
    snprintf(command, sizeof(command), "cp /etc/ssh/sshd_config /etc/ssh/sshd_config.bak");
    result = execute_system_command(command, output, output_len);
    if (result != 0) {
        return result;
    }
    
    // Altera a porta
    snprintf(command, sizeof(command), 
        "sed -i 's/^#Port 22/Port %s/g' /etc/ssh/sshd_config || "
        "sed -i 's/^Port [0-9]*/Port %s/g' /etc/ssh/sshd_config || "
        "echo 'Port %s' >> /etc/ssh/sshd_config", 
        port, port, port);
    result = execute_system_command(command, output, output_len);
    if (result != 0) {
        return result;
    }
    
    // Reinicia o serviço SSH
    snprintf(command, sizeof(command), "systemctl restart sshd");
    result = execute_system_command(command, output, output_len);
    if (result != 0) {
        return result;
    }
    
    snprintf(output, output_len, "Porta SSH alterada para %s com sucesso", port);
    return 0;
}

/**
 * Inicializa o módulo
 */
int fazai_mod_init() {
    if (initialized) {
        return 0;
    }
    
    log_file = fopen(LOG_FILE, "a");
    if (log_file == NULL) {
        fprintf(stderr, "Erro ao abrir arquivo de log: %s\n", strerror(errno));
        return -1;
    }
    
    log_message("INFO", "Módulo de sistema inicializado");
    initialized = 1;
    
    return 0;
}

/**
 * Executa um comando no módulo
 */
int fazai_mod_exec(const char* cmd, char* result, int result_len) {
    if (!initialized) {
        snprintf(result, result_len, "Módulo não inicializado");
        return -1;
    }
    
    if (cmd == NULL || result == NULL || result_len <= 0) {
        return -1;
    }
    
    // Limpa o buffer de resultado
    memset(result, 0, result_len);
    
    // Processa comandos específicos
    if (strncmp(cmd, "system_info", 11) == 0) {
        return get_system_info(result, result_len);
    } else if (strncmp(cmd, "create_user", 11) == 0) {
        // Formato: create_user username password group
        char username[64] = {0};
        char password[64] = {0};
        char group[64] = {0};
        
        sscanf(cmd, "create_user %63s %63s %63s", username, password, group);
        
        if (username[0] == '\0' || password[0] == '\0' || group[0] == '\0') {
            snprintf(result, result_len, "Uso: create_user <username> <password> <group>");
            return -1;
        }
        
        return create_user(username, password, group, result, result_len);
    } else if (strncmp(cmd, "change_ssh_port", 15) == 0) {
        // Formato: change_ssh_port port
        char port[16] = {0};
        
        sscanf(cmd, "change_ssh_port %15s", port);
        
        if (port[0] == '\0') {
            snprintf(result, result_len, "Uso: change_ssh_port <port>");
            return -1;
        }
        
        return change_ssh_port(port, result, result_len);
    } else {
        // Executa comando genérico do sistema
        return execute_system_command(cmd, result, result_len);
    }
}

/**
 * Finaliza o módulo
 */
void fazai_mod_cleanup() {
    if (log_file != NULL) {
        log_message("INFO", "Módulo de sistema finalizado");
        fclose(log_file);
        log_file = NULL;
    }
    
    initialized = 0;
}
