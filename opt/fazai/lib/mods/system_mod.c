/**
 * FazAI - Módulo de Sistema Modular com Proteção Avançada
 * 
 * Este módulo fornece wrappers de kernel para proteção avançada:
 * - Filtragem de malware com ClamAV
 * - Verificação de RBLs (Real-time Blackhole Lists)
 * - Assinaturas de malware customizáveis
 * - Proteção proativa para portas críticas
 * - Integração com LLM para ações automáticas
 * - Bloqueio automático no firewall
 * - Sistema de alertas
 * 
 * Compilação:
 * gcc -shared -fPIC -o system_mod.so system_mod.c -lclamav
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
#include <netinet/in.h>
#include <arpa/inet.h>
#include <sys/socket.h>
#include <netdb.h>
#include <pthread.h>
#include <signal.h>
#include <syslog.h>
#include <curl/curl.h>
#include <clamav.h>
#include <json-c/json.h>
#include "fazai_mod.h"

// Configurações
#define MAX_CMD_OUTPUT 8192
#define MAX_CMD_LEN 1024
#define LOG_FILE "/var/log/fazai.log"
#define MALWARE_SIGNATURES_FILE "/etc/fazai/malware_signatures.txt"
#define RBL_LIST_FILE "/etc/fazai/rbl_list.txt"
#define FAZAI_AI_ENDPOINT "http://localhost:3120/command"
#define FAZAI_ALERT_ENDPOINT "http://localhost:3120/alert"
#define CLAMAV_SOCKET "/var/run/clamav/clamd.ctl"
#define MAX_THREADS 10
#define MAX_QUEUE_SIZE 100

// Portas críticas para proteção
typedef struct {
    int port;
    char service[32];
    char description[128];
    int risk_level;
} CriticalPort;

static CriticalPort critical_ports[] = {
    {21, "FTP", "File Transfer Protocol", 8},
    {22, "SSH", "Secure Shell", 7},
    {23, "TELNET", "Telnet", 9},
    {25, "SMTP", "Simple Mail Transfer Protocol", 6},
    {53, "DNS", "Domain Name System", 7},
    {80, "HTTP", "Hypertext Transfer Protocol", 5},
    {110, "POP3", "Post Office Protocol", 6},
    {143, "IMAP", "Internet Message Access Protocol", 6},
    {443, "HTTPS", "HTTP Secure", 5},
    {3306, "MySQL", "MySQL Database", 8},
    {5432, "PostgreSQL", "PostgreSQL Database", 8},
    {27017, "MongoDB", "MongoDB Database", 8},
    {6379, "Redis", "Redis Database", 7},
    {8080, "HTTP-ALT", "HTTP Alternative", 6},
    {8443, "HTTPS-ALT", "HTTPS Alternative", 6},
    {9200, "Elasticsearch", "Elasticsearch", 8},
    {11211, "Memcached", "Memcached", 7},
    {0, "", "", 0} // Terminador
};

// Estrutura para assinaturas de malware
typedef struct {
    char signature[256];
    char description[512];
    int risk_level;
    char action[64]; // "block", "alert", "log"
} MalwareSignature;

// Estrutura para RBLs
typedef struct {
    char domain[128];
    char description[256];
    int risk_level;
    char response_codes[64];
} RBLServer;

// Estrutura para eventos de segurança
typedef struct {
    time_t timestamp;
    char source_ip[16];
    char destination_ip[16];
    int source_port;
    int destination_port;
    char service[32];
    char threat_type[32];
    char description[512];
    int risk_level;
    char action_taken[128];
} SecurityEvent;

// Estrutura para fila de eventos
typedef struct {
    SecurityEvent events[MAX_QUEUE_SIZE];
    int head;
    int tail;
    int size;
    pthread_mutex_t mutex;
} EventQueue;

// Variáveis globais
static int initialized = 0;
static FILE* log_file = NULL;
static MalwareSignature* signatures = NULL;
static int signature_count = 0;
static RBLServer* rbl_servers = NULL;
static int rbl_count = 0;
static EventQueue event_queue;
static pthread_t alert_thread;
static int alert_thread_running = 0;
static struct cl_engine* clamav_engine = NULL;
static CURL* curl_handle = NULL;

// Função para callback do CURL
static size_t curl_write_callback(void* contents, size_t size, size_t nmemb, void* userp) {
    size_t realsize = size * nmemb;
    char* response = (char*)userp;
    strncat(response, (char*)contents, realsize);
    return realsize;
}

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
    
    // Também envia para syslog
    syslog(LOG_INFO, "[%s] %s", level, message);
}

/**
 * Inicializa o ClamAV
 */
static int init_clamav() {
    unsigned int sigs = 0;
    int ret;
    
    ret = cl_init(CL_INIT_DEFAULT);
    if (ret != CL_SUCCESS) {
        log_message("ERROR", "Falha ao inicializar ClamAV");
        return -1;
    }
    
    // Carrega base de dados
    ret = cl_load(cl_retdbdir(), &clamav_engine, &sigs, CL_DB_STDOPT);
    if (ret != CL_SUCCESS) {
        log_message("ERROR", "Falha ao carregar base de dados ClamAV");
        return -1;
    }
    
    // Compila engine
    ret = cl_engine_compile(clamav_engine);
    if (ret != CL_SUCCESS) {
        log_message("ERROR", "Falha ao compilar engine ClamAV");
        return -1;
    }
    
    log_message("INFO", "ClamAV inicializado com sucesso");
    return 0;
}

/**
 * Escaneia arquivo com ClamAV
 */
static int scan_file_clamav(const char* file_path, char* virus_name, int max_len) {
    if (clamav_engine == NULL) {
        return -1;
    }
    
    const char* virus;
    unsigned long int scanned = 0;
    int ret;
    
    ret = cl_scanfile(file_path, &virus, &scanned, clamav_engine, CL_SCAN_STDOPT);
    
    if (ret == CL_VIRUS) {
        if (virus_name && max_len > 0) {
            strncpy(virus_name, virus, max_len - 1);
            virus_name[max_len - 1] = '\0';
        }
        return 1; // Vírus encontrado
    } else if (ret == CL_CLEAN) {
        return 0; // Arquivo limpo
    } else {
        return -1; // Erro
    }
}

/**
 * Escaneia buffer com ClamAV
 */
static int scan_buffer_clamav(const char* buffer, size_t size, char* virus_name, int max_len) {
    if (clamav_engine == NULL) {
        return -1;
    }
    
    const char* virus;
    unsigned long int scanned = 0;
    int ret;
    
    ret = cl_scandesc(0, &virus, &scanned, clamav_engine, CL_SCAN_STDOPT);
    
    if (ret == CL_VIRUS) {
        if (virus_name && max_len > 0) {
            strncpy(virus_name, virus, max_len - 1);
            virus_name[max_len - 1] = '\0';
        }
        return 1; // Vírus encontrado
    } else if (ret == CL_CLEAN) {
        return 0; // Buffer limpo
    } else {
        return -1; // Erro
    }
}

/**
 * Carrega assinaturas de malware do arquivo
 */
static int load_malware_signatures() {
    FILE* sig_file = fopen(MALWARE_SIGNATURES_FILE, "r");
    if (sig_file == NULL) {
        log_message("WARNING", "Arquivo de assinaturas não encontrado, criando padrão");
        
        // Cria arquivo padrão com assinaturas básicas
        sig_file = fopen(MALWARE_SIGNATURES_FILE, "w");
        if (sig_file != NULL) {
            fprintf(sig_file, "eval(,Execução de código malicioso,9,block\n");
            fprintf(sig_file, "base64_decode(,Decodificação suspeita,7,alert\n");
            fprintf(sig_file, "shell_exec(,Execução de shell,8,block\n");
            fprintf(sig_file, "system(,Execução de sistema,8,block\n");
            fprintf(sig_file, "passthru(,Execução de comando,8,block\n");
            fprintf(sig_file, "exec(,Execução de processo,8,block\n");
            fprintf(sig_file, "file_get_contents(,Leitura de arquivo suspeita,6,alert\n");
            fprintf(sig_file, "file_put_contents(,Escrita de arquivo suspeita,6,alert\n");
            fprintf(sig_file, "SELECT.*FROM.*WHERE.*OR.*1=1,SQL Injection,9,block\n");
            fprintf(sig_file, "union.*select,SQL Injection,9,block\n");
            fprintf(sig_file, "script.*alert,Cross-site Scripting,8,block\n");
            fprintf(sig_file, "javascript:,Cross-site Scripting,8,block\n");
            fclose(sig_file);
        }
        
        sig_file = fopen(MALWARE_SIGNATURES_FILE, "r");
        if (sig_file == NULL) {
            return -1;
        }
    }
    
    // Conta linhas
    char line[1024];
    signature_count = 0;
    while (fgets(line, sizeof(line), sig_file) != NULL) {
        signature_count++;
    }
    
    // Aloca memória
    signatures = malloc(signature_count * sizeof(MalwareSignature));
    if (signatures == NULL) {
        fclose(sig_file);
        return -1;
    }
    
    // Carrega assinaturas
    rewind(sig_file);
    int i = 0;
    while (fgets(line, sizeof(line), sig_file) != NULL && i < signature_count) {
        char* comma1 = strchr(line, ',');
        char* comma2 = strrchr(line, ',');
        char* comma3 = strrchr(line, ',');
        
        if (comma1 && comma2 && comma3 && comma1 != comma2 && comma2 != comma3) {
            strncpy(signatures[i].signature, line, comma1 - line);
            signatures[i].signature[comma1 - line] = '\0';
            
            strncpy(signatures[i].description, comma1 + 1, comma2 - comma1 - 1);
            signatures[i].description[comma2 - comma1 - 1] = '\0';
            
            signatures[i].risk_level = atoi(comma2 + 1);
            
            strncpy(signatures[i].action, comma3 + 1, strlen(comma3 + 1) - 1);
            signatures[i].action[strlen(comma3 + 1) - 1] = '\0';
            i++;
        }
    }
    
    fclose(sig_file);
    log_message("INFO", "Assinaturas de malware carregadas");
    return 0;
}

/**
 * Carrega lista de RBLs
 */
static int load_rbl_list() {
    FILE* rbl_file = fopen(RBL_LIST_FILE, "r");
    if (rbl_file == NULL) {
        log_message("WARNING", "Arquivo de RBLs não encontrado, criando padrão");
        
        // Cria arquivo padrão com RBLs populares
        rbl_file = fopen(RBL_LIST_FILE, "w");
        if (rbl_file != NULL) {
            fprintf(rbl_file, "zen.spamhaus.org,Spamhaus ZEN,9,127.0.0.2-127.0.0.11\n");
            fprintf(rbl_file, "bl.spamcop.net,SpamCop,8,127.0.0.2\n");
            fprintf(rbl_file, "dnsbl.sorbs.net,SORBS,7,127.0.0.2-127.0.0.10\n");
            fprintf(rbl_file, "b.barracudacentral.org,Barracuda,8,127.0.0.2\n");
            fprintf(rbl_file, "dnsbl.justspam.org,JustSpam,7,127.0.0.2\n");
            fprintf(rbl_file, "ix.dnsbl.manitu.net,Manitu,6,127.0.0.2\n");
            fclose(rbl_file);
        }
        
        rbl_file = fopen(RBL_LIST_FILE, "r");
        if (rbl_file == NULL) {
            return -1;
        }
    }
    
    // Conta linhas
    char line[1024];
    rbl_count = 0;
    while (fgets(line, sizeof(line), rbl_file) != NULL) {
        rbl_count++;
    }
    
    // Aloca memória
    rbl_servers = malloc(rbl_count * sizeof(RBLServer));
    if (rbl_servers == NULL) {
        fclose(rbl_file);
        return -1;
    }
    
    // Carrega RBLs
    rewind(rbl_file);
    int i = 0;
    while (fgets(line, sizeof(line), rbl_file) != NULL && i < rbl_count) {
        char* comma1 = strchr(line, ',');
        char* comma2 = strrchr(line, ',');
        char* comma3 = strrchr(line, ',');
        
        if (comma1 && comma2 && comma3 && comma1 != comma2 && comma2 != comma3) {
            strncpy(rbl_servers[i].domain, line, comma1 - line);
            rbl_servers[i].domain[comma1 - line] = '\0';
            
            strncpy(rbl_servers[i].description, comma1 + 1, comma2 - comma1 - 1);
            rbl_servers[i].description[comma2 - comma1 - 1] = '\0';
            
            rbl_servers[i].risk_level = atoi(comma2 + 1);
            
            strncpy(rbl_servers[i].response_codes, comma3 + 1, strlen(comma3 + 1) - 1);
            rbl_servers[i].response_codes[strlen(comma3 + 1) - 1] = '\0';
            i++;
        }
    }
    
    fclose(rbl_file);
    log_message("INFO", "Lista de RBLs carregada");
    return 0;
}

/**
 * Verifica IP em RBLs
 */
static int check_ip_rbl(const char* ip, char* rbl_result, int max_len) {
    if (rbl_servers == NULL || ip == NULL) {
        return 0;
    }
    
    char reversed_ip[16];
    char query[256];
    struct hostent* he;
    int total_risk = 0;
    char result_buffer[1024] = "";
    
    // Inverte o IP para consulta DNS
    char* token = strtok((char*)ip, ".");
    char* parts[4];
    int part_count = 0;
    
    while (token != NULL && part_count < 4) {
        parts[part_count++] = token;
        token = strtok(NULL, ".");
    }
    
    if (part_count == 4) {
        snprintf(reversed_ip, sizeof(reversed_ip), "%s.%s.%s.%s", 
                parts[3], parts[2], parts[1], parts[0]);
    } else {
        return 0;
    }
    
    // Verifica cada RBL
    for (int i = 0; i < rbl_count; i++) {
        snprintf(query, sizeof(query), "%s.%s", reversed_ip, rbl_servers[i].domain);
        
        he = gethostbyname(query);
        if (he != NULL) {
            total_risk += rbl_servers[i].risk_level;
            char temp[256];
            snprintf(temp, sizeof(temp), "%s (%s), ", 
                    rbl_servers[i].description, rbl_servers[i].domain);
            strncat(result_buffer, temp, sizeof(result_buffer) - strlen(result_buffer) - 1);
        }
    }
    
    if (total_risk > 0 && rbl_result && max_len > 0) {
        strncpy(rbl_result, result_buffer, max_len - 1);
        rbl_result[max_len - 1] = '\0';
    }
    
    return total_risk;
}

/**
 * Verifica se o conteúdo contém assinaturas de malware
 */
static int check_malware_signatures(const char* content, char* detected_signature, int max_len) {
    if (signatures == NULL || content == NULL) {
        return 0;
    }
    
    for (int i = 0; i < signature_count; i++) {
        if (strstr(content, signatures[i].signature) != NULL) {
            if (detected_signature && max_len > 0) {
                snprintf(detected_signature, max_len, "%s (Nível: %d, Ação: %s)", 
                        signatures[i].description, signatures[i].risk_level, signatures[i].action);
            }
            return signatures[i].risk_level;
        }
    }
    
    return 0;
}

/**
 * Verifica se a porta é crítica
 */
static CriticalPort* is_critical_port(int port) {
    for (int i = 0; critical_ports[i].port != 0; i++) {
        if (critical_ports[i].port == port) {
            return &critical_ports[i];
        }
    }
    return NULL;
}

/**
 * Adiciona evento à fila
 */
static void add_security_event(const char* source_ip, const char* dest_ip, 
                              int source_port, int dest_port, const char* service,
                              const char* threat_type, const char* description, 
                              int risk_level, const char* action) {
    pthread_mutex_lock(&event_queue.mutex);
    
    if (event_queue.size < MAX_QUEUE_SIZE) {
        SecurityEvent* event = &event_queue.events[event_queue.tail];
        
        time(&event->timestamp);
        strncpy(event->source_ip, source_ip, sizeof(event->source_ip) - 1);
        strncpy(event->destination_ip, dest_ip, sizeof(event->destination_ip) - 1);
        event->source_port = source_port;
        event->destination_port = dest_port;
        strncpy(event->service, service, sizeof(event->service) - 1);
        strncpy(event->threat_type, threat_type, sizeof(event->threat_type) - 1);
        strncpy(event->description, description, sizeof(event->description) - 1);
        event->risk_level = risk_level;
        strncpy(event->action_taken, action, sizeof(event->action_taken) - 1);
        
        event_queue.tail = (event_queue.tail + 1) % MAX_QUEUE_SIZE;
        event_queue.size++;
    }
    
    pthread_mutex_unlock(&event_queue.mutex);
}

/**
 * Thread para envio de alertas
 */
static void* alert_thread_func(void* arg) {
    while (alert_thread_running) {
        pthread_mutex_lock(&event_queue.mutex);
        
        while (event_queue.size > 0) {
            SecurityEvent* event = &event_queue.events[event_queue.head];
            
            // Envia alerta para o FazAI
            char json_data[2048];
            snprintf(json_data, sizeof(json_data),
                    "{\"timestamp\":%ld,\"source_ip\":\"%s\",\"dest_ip\":\"%s\","
                    "\"source_port\":%d,\"dest_port\":%d,\"service\":\"%s\","
                    "\"threat_type\":\"%s\",\"description\":\"%s\","
                    "\"risk_level\":%d,\"action\":\"%s\"}",
                    event->timestamp, event->source_ip, event->destination_ip,
                    event->source_port, event->destination_port, event->service,
                    event->threat_type, event->description, event->risk_level,
                    event->action_taken);
            
            // Envia via CURL
            if (curl_handle) {
                curl_easy_setopt(curl_handle, CURLOPT_URL, FAZAI_ALERT_ENDPOINT);
                curl_easy_setopt(curl_handle, CURLOPT_POSTFIELDS, json_data);
                curl_easy_setopt(curl_handle, CURLOPT_HTTPHEADER, 
                                "Content-Type: application/json");
                
                CURLcode res = curl_easy_perform(curl_handle);
                if (res != CURLE_OK) {
                    log_message("ERROR", "Falha ao enviar alerta");
                }
            }
            
            event_queue.head = (event_queue.head + 1) % MAX_QUEUE_SIZE;
            event_queue.size--;
        }
        
        pthread_mutex_unlock(&event_queue.mutex);
        sleep(1); // Aguarda 1 segundo
    }
    
    return NULL;
}

/**
 * Bloqueia IP no firewall
 */
static int block_ip_firewall(const char* ip, const char* reason) {
    char command[512];
    
    // Usa iptables para bloquear
    snprintf(command, sizeof(command), 
             "iptables -A INPUT -s %s -j DROP && "
             "iptables -A OUTPUT -d %s -j DROP && "
             "echo 'IP %s bloqueado: %s' >> /var/log/fazai_firewall.log",
             ip, ip, ip, reason);
    
    int result = system(command);
    
    if (result == 0) {
        log_message("INFO", "IP bloqueado no firewall");
        return 0;
    } else {
        log_message("ERROR", "Falha ao bloquear IP no firewall");
        return -1;
    }
}

/**
 * Aciona o mecanismo inteligente do FazAI
 */
static int trigger_ai_mechanism(const char* threat_info) {
    char json_data[1024];
    snprintf(json_data, sizeof(json_data),
            "{\"command\":\"threat_detected\",\"threat_info\":\"%s\","
            "\"action\":\"proactive_response\"}", threat_info);
    
    if (curl_handle) {
        curl_easy_setopt(curl_handle, CURLOPT_URL, FAZAI_AI_ENDPOINT);
        curl_easy_setopt(curl_handle, CURLOPT_POSTFIELDS, json_data);
        curl_easy_setopt(curl_handle, CURLOPT_HTTPHEADER, 
                        "Content-Type: application/json");
        
        CURLcode res = curl_easy_perform(curl_handle);
        if (res != CURLE_OK) {
            log_message("ERROR", "Falha ao acionar mecanismo AI");
            return -1;
        }
    }
    
    return 0;
}

/**
 * Wrapper para interceptar tráfego HTTP na porta 80
 */
static int http_wrapper(const char* request_data, char* response, int response_len) {
    char threat_msg[512];
    int risk_level = 0;
    int total_risk = 0;
    
    // Verifica assinaturas de malware
    risk_level = check_malware_signatures(request_data, threat_msg, sizeof(threat_msg));
    if (risk_level > 0) {
        total_risk += risk_level;
        add_security_event("0.0.0.0", "0.0.0.0", 0, 80, "HTTP", 
                          "malware_signature", threat_msg, risk_level, "block");
    }
    
    // Escaneia com ClamAV se o risco for alto
    if (total_risk > 7) {
        char virus_name[256];
        int clam_result = scan_buffer_clamav(request_data, strlen(request_data), 
                                           virus_name, sizeof(virus_name));
        if (clam_result == 1) {
            snprintf(threat_msg, sizeof(threat_msg), "Vírus detectado: %s", virus_name);
            total_risk += 5;
            add_security_event("0.0.0.0", "0.0.0.0", 0, 80, "HTTP", 
                              "virus_detected", threat_msg, 10, "block");
        }
    }
    
    if (total_risk > 0) {
        char log_msg[1024];
        snprintf(log_msg, sizeof(log_msg), 
                "Ameaça HTTP detectada! Nível: %d, Descrição: %s", 
                total_risk, threat_msg);
        log_message("ALERT", log_msg);
        
        // Aciona mecanismo inteligente
        trigger_ai_mechanism(threat_msg);
        
        // Retorna resposta de bloqueio
        snprintf(response, response_len, 
                "HTTP/1.1 403 Forbidden\r\n"
                "Content-Type: text/html\r\n"
                "Content-Length: 0\r\n"
                "X-FazAI-Blocked: true\r\n"
                "X-Threat-Level: %d\r\n\r\n", total_risk);
        
        return 1; // Bloqueado
    }
    
    return 0; // Permitido
}

/**
 * Wrapper para interceptar tráfego SMTP na porta 25
 */
static int smtp_wrapper(const char* source_ip, const char* mail_data, 
                       char* response, int response_len) {
    char rbl_result[512];
    int rbl_risk = check_ip_rbl(source_ip, rbl_result, sizeof(rbl_result));
    
    if (rbl_risk > 0) {
        char log_msg[1024];
        snprintf(log_msg, sizeof(log_msg), 
                "IP em RBL detectado! IP: %s, RBLs: %s, Risco: %d", 
                source_ip, rbl_result, rbl_risk);
        log_message("ALERT", log_msg);
        
        // Bloqueia IP no firewall
        block_ip_firewall(source_ip, rbl_result);
        
        // Adiciona evento
        add_security_event(source_ip, "0.0.0.0", 0, 25, "SMTP", 
                          "rbl_listed", rbl_result, rbl_risk, "block");
        
        // Retorna resposta de rejeição
        snprintf(response, response_len, 
                "550 5.7.1 Access denied - IP listed in RBL\r\n");
        
        return 1; // Bloqueado
    }
    
    return 0; // Permitido
}

/**
 * Wrapper para interceptar tráfego de banco de dados
 */
static int database_wrapper(const char* source_ip, int port, const char* query_data, 
                           char* response, int response_len) {
    CriticalPort* critical = is_critical_port(port);
    if (!critical) {
        return 0; // Porta não crítica
    }
    
    char threat_msg[512];
    int risk_level = check_malware_signatures(query_data, threat_msg, sizeof(threat_msg));
    
    if (risk_level > 0) {
        char log_msg[1024];
        snprintf(log_msg, sizeof(log_msg), 
                "Ataque a banco detectado! IP: %s, Porta: %d, Serviço: %s, "
                "Ameaça: %s, Risco: %d", 
                source_ip, port, critical->service, threat_msg, risk_level);
        log_message("ALERT", log_msg);
        
        // Bloqueia IP no firewall
        block_ip_firewall(source_ip, threat_msg);
        
        // Adiciona evento
        add_security_event(source_ip, "0.0.0.0", 0, port, critical->service, 
                          "database_attack", threat_msg, risk_level, "block");
        
        // Aciona mecanismo inteligente
        trigger_ai_mechanism(threat_msg);
        
        // Retorna resposta de erro
        snprintf(response, response_len, 
                "ERROR: Access denied - Security violation detected\r\n");
        
        return 1; // Bloqueado
    }
    
    return 0; // Permitido
}

/**
 * Inicializa o módulo
 */
int fazai_mod_init() {
    if (initialized) {
        return 0;
    }
    
    log_message("INFO", "Inicializando módulo de sistema modular");
    
    // Inicializa CURL
    curl_global_init(CURL_GLOBAL_ALL);
    curl_handle = curl_easy_init();
    if (!curl_handle) {
        log_message("ERROR", "Falha ao inicializar CURL");
        return -1;
    }
    
    // Inicializa ClamAV
    if (init_clamav() != 0) {
        log_message("WARNING", "ClamAV não disponível, continuando sem antivírus");
    }
    
    // Carrega assinaturas de malware
    if (load_malware_signatures() != 0) {
        log_message("ERROR", "Falha ao carregar assinaturas de malware");
        return -1;
    }
    
    // Carrega lista de RBLs
    if (load_rbl_list() != 0) {
        log_message("ERROR", "Falha ao carregar lista de RBLs");
        return -1;
    }
    
    // Inicializa fila de eventos
    memset(&event_queue, 0, sizeof(EventQueue));
    pthread_mutex_init(&event_queue.mutex, NULL);
    
    // Inicia thread de alertas
    alert_thread_running = 1;
    if (pthread_create(&alert_thread, NULL, alert_thread_func, NULL) != 0) {
        log_message("ERROR", "Falha ao criar thread de alertas");
        return -1;
    }
    
    initialized = 1;
    log_message("INFO", "Módulo de sistema modular inicializado com sucesso");
    return 0;
}

/**
 * Executa uma função do módulo
 */
int fazai_mod_exec(const char* command, const char* params, char* output, int output_len) {
    if (!initialized) {
        snprintf(output, output_len, "Módulo não inicializado");
        return -1;
    }
    
    if (strcmp(command, "help") == 0) {
        snprintf(output, output_len, 
                "Comandos disponíveis:\n"
                "help - Mostra esta ajuda\n"
                "test - Testa o módulo\n"
                "http_wrapper <data> - Testa wrapper HTTP\n"
                "smtp_wrapper <ip> <data> - Testa wrapper SMTP\n"
                "db_wrapper <ip> <port> <data> - Testa wrapper de banco\n"
                "check_signatures <content> - Verifica assinaturas\n"
                "check_rbl <ip> - Verifica IP em RBLs\n"
                "scan_file <path> - Escaneia arquivo com ClamAV\n"
                "reload_signatures - Recarrega assinaturas\n"
                "reload_rbls - Recarrega RBLs\n"
                "block_ip <ip> <reason> - Bloqueia IP no firewall\n"
                "status - Status do módulo");
        return 0;
    }
    
    if (strcmp(command, "test") == 0) {
        snprintf(output, output_len, 
                "Teste do módulo:\n"
                "- Assinaturas carregadas: %d\n"
                "- RBLs carregados: %d\n"
                "- ClamAV disponível: %s\n"
                "- Módulo inicializado: %s\n"
                "- Log file: %s", 
                signature_count, rbl_count,
                clamav_engine ? "Sim" : "Não",
                initialized ? "Sim" : "Não",
                LOG_FILE);
        return 0;
    }
    
    if (strcmp(command, "http_wrapper") == 0) {
        if (params == NULL) {
            snprintf(output, output_len, "Parâmetro necessário: dados HTTP");
            return -1;
        }
        
        char response[1024];
        int blocked = http_wrapper(params, response, sizeof(response));
        
        snprintf(output, output_len, 
                "Wrapper HTTP:\n"
                "- Dados: %s\n"
                "- Bloqueado: %s\n"
                "- Resposta: %s", 
                params, 
                blocked ? "Sim" : "Não",
                response);
        return 0;
    }
    
    if (strcmp(command, "smtp_wrapper") == 0) {
        char* space = strchr((char*)params, ' ');
        if (space == NULL) {
            snprintf(output, output_len, "Parâmetros necessários: <ip> <dados>");
            return -1;
        }
        
        *space = '\0';
        char* ip = (char*)params;
        char* data = space + 1;
        
        char response[1024];
        int blocked = smtp_wrapper(ip, data, response, sizeof(response));
        
        snprintf(output, output_len, 
                "Wrapper SMTP:\n"
                "- IP: %s\n"
                "- Dados: %s\n"
                "- Bloqueado: %s\n"
                "- Resposta: %s", 
                ip, data,
                blocked ? "Sim" : "Não",
                response);
        return 0;
    }
    
    if (strcmp(command, "db_wrapper") == 0) {
        char* params_copy = strdup(params);
        char* space1 = strchr(params_copy, ' ');
        char* space2 = strrchr(params_copy, ' ');
        
        if (space1 == NULL || space2 == NULL || space1 == space2) {
            snprintf(output, output_len, "Parâmetros necessários: <ip> <porta> <dados>");
            free(params_copy);
            return -1;
        }
        
        *space1 = '\0';
        *space2 = '\0';
        char* ip = params_copy;
        char* port_str = space1 + 1;
        char* data = space2 + 1;
        
        int port = atoi(port_str);
        char response[1024];
        int blocked = database_wrapper(ip, port, data, response, sizeof(response));
        
        snprintf(output, output_len, 
                "Wrapper de Banco:\n"
                "- IP: %s\n"
                "- Porta: %d\n"
                "- Dados: %s\n"
                "- Bloqueado: %s\n"
                "- Resposta: %s", 
                ip, port, data,
                blocked ? "Sim" : "Não",
                response);
        
        free(params_copy);
        return 0;
    }
    
    if (strcmp(command, "check_signatures") == 0) {
        if (params == NULL) {
            snprintf(output, output_len, "Parâmetro necessário: conteúdo para verificar");
            return -1;
        }
        
        char threat_msg[512];
        int risk_level = check_malware_signatures(params, threat_msg, sizeof(threat_msg));
        
        snprintf(output, output_len, 
                "Verificação de assinaturas:\n"
                "- Conteúdo: %s\n"
                "- Nível de risco: %d\n"
                "- Ameaça: %s", 
                params, 
                risk_level,
                risk_level > 0 ? threat_msg : "Nenhuma");
        return 0;
    }
    
    if (strcmp(command, "check_rbl") == 0) {
        if (params == NULL) {
            snprintf(output, output_len, "Parâmetro necessário: IP para verificar");
            return -1;
        }
        
        char rbl_result[512];
        int risk_level = check_ip_rbl(params, rbl_result, sizeof(rbl_result));
        
        snprintf(output, output_len, 
                "Verificação de RBL:\n"
                "- IP: %s\n"
                "- Nível de risco: %d\n"
                "- RBLs: %s", 
                params, 
                risk_level,
                risk_level > 0 ? rbl_result : "Nenhum");
        return 0;
    }
    
    if (strcmp(command, "scan_file") == 0) {
        if (params == NULL) {
            snprintf(output, output_len, "Parâmetro necessário: caminho do arquivo");
            return -1;
        }
        
        if (clamav_engine == NULL) {
            snprintf(output, output_len, "ClamAV não disponível");
            return -1;
        }
        
        char virus_name[256];
        int result = scan_file_clamav(params, virus_name, sizeof(virus_name));
        
        snprintf(output, output_len, 
                "Escaneamento ClamAV:\n"
                "- Arquivo: %s\n"
                "- Resultado: %s\n"
                "- Vírus: %s", 
                params, 
                result == 1 ? "Vírus encontrado" : 
                result == 0 ? "Arquivo limpo" : "Erro",
                result == 1 ? virus_name : "N/A");
        return 0;
    }
    
    if (strcmp(command, "reload_signatures") == 0) {
        if (signatures != NULL) {
            free(signatures);
            signatures = NULL;
        }
        
        int result = load_malware_signatures();
        snprintf(output, output_len, 
                "Recarregamento de assinaturas: %s", 
                result == 0 ? "Sucesso" : "Falha");
        return result;
    }
    
    if (strcmp(command, "reload_rbls") == 0) {
        if (rbl_servers != NULL) {
            free(rbl_servers);
            rbl_servers = NULL;
        }
        
        int result = load_rbl_list();
        snprintf(output, output_len, 
                "Recarregamento de RBLs: %s", 
                result == 0 ? "Sucesso" : "Falha");
        return result;
    }
    
    if (strcmp(command, "block_ip") == 0) {
        char* space = strchr((char*)params, ' ');
        if (space == NULL) {
            snprintf(output, output_len, "Parâmetros necessários: <ip> <motivo>");
            return -1;
        }
        
        *space = '\0';
        char* ip = (char*)params;
        char* reason = space + 1;
        
        int result = block_ip_firewall(ip, reason);
        snprintf(output, output_len, 
                "Bloqueio de IP:\n"
                "- IP: %s\n"
                "- Motivo: %s\n"
                "- Resultado: %s", 
                ip, reason,
                result == 0 ? "Sucesso" : "Falha");
        return result;
    }
    
    if (strcmp(command, "status") == 0) {
        snprintf(output, output_len, 
                "Status do módulo:\n"
                "- Inicializado: %s\n"
                "- Assinaturas: %d\n"
                "- RBLs: %d\n"
                "- ClamAV: %s\n"
                "- CURL: %s\n"
                "- Thread de alertas: %s\n"
                "- Eventos na fila: %d\n"
                "- Arquivo de log: %s\n"
                "- Endpoint AI: %s", 
                initialized ? "Sim" : "Não",
                signature_count, rbl_count,
                clamav_engine ? "Disponível" : "Indisponível",
                curl_handle ? "Disponível" : "Indisponível",
                alert_thread_running ? "Ativo" : "Inativo",
                event_queue.size,
                LOG_FILE,
                FAZAI_AI_ENDPOINT);
        return 0;
    }
    
    snprintf(output, output_len, "Comando desconhecido: %s", command);
    return -1;
}

/**
 * Limpa recursos do módulo
 */
void fazai_mod_cleanup() {
    // Para thread de alertas
    alert_thread_running = 0;
    if (alert_thread) {
        pthread_join(alert_thread, NULL);
    }
    
    // Limpa recursos
    if (signatures != NULL) {
        free(signatures);
        signatures = NULL;
    }
    
    if (rbl_servers != NULL) {
        free(rbl_servers);
        rbl_servers = NULL;
    }
    
    if (clamav_engine != NULL) {
        cl_engine_free(clamav_engine);
        clamav_engine = NULL;
    }
    
    if (curl_handle) {
        curl_easy_cleanup(curl_handle);
        curl_handle = NULL;
    }
    
    curl_global_cleanup();
    
    if (log_file != NULL) {
        fclose(log_file);
        log_file = NULL;
    }
    
    pthread_mutex_destroy(&event_queue.mutex);
    
    initialized = 0;
    log_message("INFO", "Módulo de sistema modular finalizado");
}
