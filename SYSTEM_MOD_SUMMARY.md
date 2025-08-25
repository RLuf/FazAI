# FazAI - Módulo de Sistema Modular com Proteção Avançada

## 🎯 Resumo da Implementação

Foi criado um módulo nativo completo (`system_mod.c`) que fornece wrappers de kernel para proteção avançada contra malware, ataques e ameaças de segurança. Este módulo atua como uma camada de segurança entre os serviços e o sistema operacional.

## 📁 Arquivos Criados/Modificados

### 1. **Módulo Principal**
- `opt/fazai/lib/mods/system_mod.c` - Módulo principal com todas as funcionalidades
- `opt/fazai/lib/mods/compile_system_mod.sh` - Script de compilação automática
- `opt/fazai/lib/mods/test_system_mod.js` - Script de testes completo
- `opt/fazai/lib/mods/README.md` - Documentação completa

### 2. **Arquivos de Configuração**
- `etc/fazai/malware_signatures.txt` - Banco de assinaturas de malware (150+ padrões)
- `etc/fazai/rbl_list.txt` - Lista de RBLs (50+ servidores)

### 3. **Instalador Atualizado**
- `install.sh` - Adicionada compilação automática do módulo

## 🛡️ Funcionalidades Implementadas

### 1. **Filtragem de Malware com ClamAV**
```c
// Escaneamento de arquivos
int scan_file_clamav(const char* file_path, char* virus_name, int max_len);

// Escaneamento de buffers
int scan_buffer_clamav(const char* buffer, size_t size, char* virus_name, int max_len);
```

### 2. **Verificação de RBLs (Real-time Blackhole Lists)**
```c
// Verifica IP em múltiplos RBLs
int check_ip_rbl(const char* ip, char* rbl_result, int max_len);
```

### 3. **Assinaturas de Malware Customizáveis**
```c
// Verifica conteúdo contra assinaturas
int check_malware_signatures(const char* content, char* detected_signature, int max_len);
```

### 4. **Wrappers para Portas Críticas**

#### HTTP Wrapper (Porta 80/443)
- Detecção de XSS, SQL Injection
- Filtragem de file uploads maliciosos
- Proteção contra directory traversal

#### SMTP Wrapper (Porta 25)
- Verificação de IPs em RBLs
- Detecção de spam patterns
- Escaneamento de anexos

#### Database Wrapper (Portas 3306, 5432, etc.)
- Proteção contra SQL Injection
- Detecção de NoSQL Injection
- Prevenção de ataques de força bruta

### 5. **Integração com LLM**
```c
// Aciona mecanismo inteligente do FazAI
int trigger_ai_mechanism(const char* threat_info);
```

### 6. **Bloqueio Automático no Firewall**
```c
// Bloqueia IP usando iptables
int block_ip_firewall(const char* ip, const char* reason);
```

### 7. **Sistema de Alertas**
- Fila de eventos thread-safe
- Envio automático de alertas para FazAI
- Logs detalhados de todas as ações

## 🔧 Comandos Disponíveis

| Comando | Descrição | Exemplo |
|---------|-----------|---------|
| `help` | Mostra ajuda | `system_mod help` |
| `test` | Testa o módulo | `system_mod test` |
| `status` | Status do módulo | `system_mod status` |
| `http_wrapper` | Testa wrapper HTTP | `system_mod http_wrapper <dados>` |
| `smtp_wrapper` | Testa wrapper SMTP | `system_mod smtp_wrapper <ip> <dados>` |
| `db_wrapper` | Testa wrapper de banco | `system_mod db_wrapper <ip> <porta> <dados>` |
| `check_signatures` | Verifica assinaturas | `system_mod check_signatures <conteúdo>` |
| `check_rbl` | Verifica IP em RBLs | `system_mod check_rbl <ip>` |
| `scan_file` | Escaneia arquivo | `system_mod scan_file <caminho>` |
| `reload_signatures` | Recarrega assinaturas | `system_mod reload_signatures` |
| `reload_rbls` | Recarrega RBLs | `system_mod reload_rbls` |
| `block_ip` | Bloqueia IP | `system_mod block_ip <ip> <motivo>` |

## 📊 Assinaturas de Malware Incluídas

### Categorias (150+ padrões)
- **PHP Malicious Code**: eval(), shell_exec(), system(), etc.
- **SQL Injection**: UNION SELECT, OR 1=1, etc.
- **Cross-Site Scripting (XSS)**: script tags, event handlers
- **File Upload Attacks**: .php, .exe, .dll, etc.
- **Directory Traversal**: ../, ..\\, URL encoded
- **Command Injection**: pipes, semicolons, backticks
- **Remote File Inclusion**: http://, ftp://, file://
- **LDAP Injection**: wildcards, null bytes
- **XML External Entity (XXE)**: entity declarations
- **Server-Side Template Injection**: {{ }}, ${ }, etc.
- **NoSQL Injection**: $where, $ne, $gt, etc.
- **Deserialization Attacks**: PHP object serialization
- **Log Injection**: CRLF, newlines
- **HTTP Header Injection**: Host:, X-Forwarded-For:
- **Open Redirect**: redirect=, url=, next=
- **SSRF**: localhost, metadata endpoints
- **Path Traversal**: /etc/passwd, /proc/
- **Web Shell Indicators**: cmd=, backdoor, webshell
- **Cryptocurrency Mining**: cryptonight, xmrig, coinhive
- **Botnet Indicators**: c2, beacon, heartbeat
- **Data Exfiltration**: credit cards, SSN, passwords
- **Advanced Persistent Threat (APT)**: lateral movement, privilege escalation

## 🌐 RBLs Incluídos (50+ servidores)

### Categorias
- **Spamhaus**: ZEN, SBL, XBL, PBL
- **SpamCop**: bl.spamcop.net
- **SORBS**: Combined, Zombie, HTTP, SMTP
- **Barracuda**: b.barracudacentral.org
- **UCEPROTECT**: Levels 1, 2, 3
- **URIBL**: Black, Grey, Multi, Red, White
- **SURBL**: Multi
- **CBL**: Composite Blocking List
- **NJABL**: Multiple servers
- **DSBL**: List, Unconfirmed
- **Lashback**: UBL
- **Backscatterer**: ips.backscatterer.org
- **SpamCannibal**: bl.spamcannibal.org
- **SpamStopsHere**: bl.spamstopshere.net
- **Invaluement**: dnsbl.invaluement.com
- **Emerging Threats**: dnsbl.emergingthreats.net
- **CleanTalk**: access.redhawk.org
- **SpamEatingMonkey**: bl.spameatingmonkey.net
- **MailSpike**: bl.mailspike.net

## 🏗️ Arquitetura Técnica

### Estruturas de Dados
```c
// Porta crítica
typedef struct {
    int port;
    char service[32];
    char description[128];
    int risk_level;
} CriticalPort;

// Assinatura de malware
typedef struct {
    char signature[256];
    char description[512];
    int risk_level;
    char action[64];
} MalwareSignature;

// Servidor RBL
typedef struct {
    char domain[128];
    char description[256];
    int risk_level;
    char response_codes[64];
} RBLServer;

// Evento de segurança
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
```

### Threading e Concorrência
- **Event Queue**: Fila thread-safe para eventos
- **Alert Thread**: Thread dedicada para envio de alertas
- **Mutex Protection**: Proteção contra race conditions

### Integração com Sistema
- **FFI Interface**: Carregamento via ffi-napi-v22
- **System Calls**: iptables, syslog, file operations
- **Network Operations**: DNS queries, HTTP requests

## 🚀 Instalação e Uso

### Compilação Automática
```bash
# Via instalador
./install.sh

# Manual
cd /opt/fazai/lib/mods/
./compile_system_mod.sh
```

### Teste do Módulo
```bash
# Executar testes completos
node test_system_mod.js

# Teste via FazAI
curl -X POST http://localhost:3120/command -d '{"command":"system_mod test"}'
```

### Uso em Produção
```bash
# Verificar status
curl -X POST http://localhost:3120/command -d '{"command":"system_mod status"}'

# Testar wrapper HTTP
curl -X POST http://localhost:3120/command -d '{"command":"system_mod http_wrapper GET /?id=1<script>alert(1)</script> HTTP/1.1"}'

# Verificar assinaturas
curl -X POST http://localhost:3120/command -d '{"command":"system_mod check_signatures SELECT * FROM users WHERE id = 1 OR 1=1"}'
```

## 📈 Performance e Otimizações

### Otimizações Implementadas
1. **Cache de RBLs**: Resultados cacheados por 5 minutos
2. **Thread Pool**: Processamento assíncrono
3. **Compilação Otimizada**: Flags `-O2`
4. **Memory Pool**: Reutilização de buffers
5. **Lazy Loading**: Carregamento sob demanda

### Métricas Esperadas
- **Tempo de resposta**: < 10ms para verificações locais
- **Throughput**: 1000+ verificações/segundo
- **Memory usage**: < 50MB para operação normal
- **CPU usage**: < 5% em operação normal

## 🔒 Segurança

### Considerações de Segurança
1. **Execução como Root**: Necessário para iptables
2. **Validação de Input**: Todos os inputs são validados
3. **Buffer Overflow Protection**: Bounds checking
4. **Memory Leak Prevention**: Cleanup automático
5. **File Permissions**: Apenas root pode modificar

### Auditoria
```bash
# Verificar integridade
md5sum system_mod.so

# Verificar permissões
ls -la system_mod.so

# Verificar dependências
ldd system_mod.so
```

## 🔄 Integração com FazAI

### Endpoints
- **Comando**: `http://localhost:3120/command`
- **Alerta**: `http://localhost:3120/alert`

### Formato de Alerta
```json
{
    "timestamp": 1234567890,
    "source_ip": "192.168.1.100",
    "dest_ip": "192.168.1.1",
    "source_port": 12345,
    "dest_port": 80,
    "service": "HTTP",
    "threat_type": "malware_signature",
    "description": "SQL Injection detectado",
    "risk_level": 9,
    "action": "block"
}
```

## 🚨 Respostas Automáticas

### Níveis de Risco
| Nível | Ação | Descrição |
|-------|------|-----------|
| 1-3 | Log | Apenas registro |
| 4-6 | Alert | Alerta + registro |
| 7-8 | Block | Bloqueio temporário |
| 9-10 | Block + AI | Bloqueio + IA |

### Fluxo de Resposta
1. **Detecção** → Verificação de assinaturas/RBLs
2. **Análise** → Determinação do nível de risco
3. **Ação** → Bloqueio, alerta ou log
4. **Notificação** → Envio para FazAI LLM
5. **Resposta IA** → Análise contextual e ações adicionais

## 📊 Monitoramento

### Logs
- **Principal**: `/var/log/fazai.log`
- **Firewall**: `/var/log/fazai_firewall.log`

### Métricas
```bash
# Eventos de segurança
grep "ALERT" /var/log/fazai.log

# IPs bloqueados
grep "bloqueado" /var/log/fazai_firewall.log

# Estatísticas do módulo
curl -X POST http://localhost:3120/command -d '{"command":"system_mod status"}'
```

## 🐛 Troubleshooting

### Problemas Comuns
1. **ClamAV não encontrado**: Instalar clamav clamav-daemon
2. **Falha na compilação**: Instalar build-essential libclamav-dev
3. **Permissões negadas**: Executar como root
4. **Módulo não carrega**: Verificar dependências com ldd

### Debug
```bash
# Ativar debug
export FAZAI_DEBUG=1

# Ver logs em tempo real
tail -f /var/log/fazai.log

# Ver logs do firewall
tail -f /var/log/fazai_firewall.log
```

## 🎯 Benefícios da Implementação

### 1. **Proteção Avançada**
- Detecção de malware em tempo real
- Verificação de IPs em listas negras
- Proteção contra ataques conhecidos

### 2. **Integração Inteligente**
- Acionamento automático do LLM
- Análise contextual de ameaças
- Respostas proativas baseadas em IA

### 3. **Modularidade**
- Fácil adição de novas assinaturas
- Configuração flexível de RBLs
- Wrappers customizáveis

### 4. **Performance**
- Processamento assíncrono
- Cache inteligente
- Otimizações de memória

### 5. **Monitoramento**
- Logs detalhados
- Métricas em tempo real
- Alertas automáticos

## 🔮 Próximos Passos

### Melhorias Futuras
1. **Machine Learning**: Detecção baseada em ML
2. **Behavioral Analysis**: Análise de comportamento
3. **Threat Intelligence**: Feed de ameaças em tempo real
4. **Cloud Integration**: Sincronização com serviços cloud
5. **Advanced Analytics**: Dashboard de segurança

### Expansões
1. **Mais Wrappers**: FTP, DNS, VPN
2. **Protocol Support**: IPv6, TLS inspection
3. **Container Support**: Docker, Kubernetes
4. **Cloud Native**: AWS, Azure, GCP
5. **Edge Computing**: IoT, Edge devices

---

## ✅ Conclusão

O módulo `system_mod.c` foi implementado com sucesso, fornecendo uma solução completa de segurança para o FazAI. Ele combina:

- **Proteção tradicional**: Assinaturas e RBLs
- **Inteligência artificial**: Integração com LLM
- **Performance otimizada**: Threading e cache
- **Facilidade de uso**: Scripts automáticos
- **Monitoramento completo**: Logs e métricas

O módulo está pronto para uso em produção e pode ser facilmente expandido conforme necessário.