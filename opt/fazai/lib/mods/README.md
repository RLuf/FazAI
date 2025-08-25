# FazAI - Módulo de Sistema Modular com Proteção Avançada

## 📋 Visão Geral

O `system_mod.c` é um módulo nativo do FazAI que fornece wrappers de kernel para proteção avançada contra malware, ataques e ameaças de segurança. Este módulo atua como uma camada de segurança entre os serviços e o sistema operacional.

## 🛡️ Funcionalidades Principais

### 1. **Filtragem de Malware com ClamAV**
- Escaneamento em tempo real de arquivos e buffers
- Integração direta com o ClamAV
- Detecção de vírus, trojans e malware conhecidos

### 2. **Verificação de RBLs (Real-time Blackhole Lists)**
- Verificação automática de IPs em listas negras
- Suporte a múltiplos servidores RBL
- Bloqueio proativo de IPs maliciosos

### 3. **Assinaturas de Malware Customizáveis**
- Banco de assinaturas extensível
- Detecção de padrões de ataques conhecidos
- Suporte a regex para assinaturas complexas

### 4. **Proteção para Portas Críticas**
- **HTTP (80/443)**: Filtragem de ataques web
- **SMTP (25)**: Proteção contra spam e malware
- **SSH (22)**: Proteção contra brute force
- **Banco de Dados**: Proteção contra SQL injection
- **Email (110/143)**: Filtragem de ameaças

### 5. **Integração com LLM**
- Acionamento automático do mecanismo inteligente
- Análise contextual de ameaças
- Respostas proativas baseadas em IA

### 6. **Bloqueio Automático no Firewall**
- Bloqueio automático de IPs maliciosos
- Integração com iptables
- Logs detalhados de ações

## 🏗️ Arquitetura

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Cliente Web   │    │   Cliente SMTP  │    │   Cliente DB    │
└─────────┬───────┘    └─────────┬───────┘    └─────────┬───────┘
          │                      │                      │
          ▼                      ▼                      ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  HTTP Wrapper   │    │  SMTP Wrapper   │    │  DB Wrapper     │
│   (Porta 80)    │    │   (Porta 25)    │    │  (Porta 3306)   │
└─────────┬───────┘    └─────────┬───────┘    └─────────┬───────┘
          │                      │                      │
          └──────────┬───────────┴──────────┬───────────┘
                     │                      │
                     ▼                      ▼
        ┌─────────────────────────┐    ┌─────────────────┐
        │   Módulo system_mod.c   │    │   FazAI LLM     │
        │                         │    │                 │
        │ • ClamAV Scanner        │    │ • Análise IA    │
        │ • RBL Checker           │    │ • Respostas     │
        │ • Signature Matcher     │    │ • Ações         │
        │ • Event Queue           │    │ • Bloqueios     │
        └─────────┬───────────────┘    └─────────┬───────┘
                  │                              │
                  ▼                              ▼
        ┌─────────────────┐    ┌─────────────────────────┐
        │   iptables      │    │   Logs & Alerts         │
        │   (Firewall)    │    │                         │
        └─────────────────┘    └─────────────────────────┘
```

## 📦 Instalação

### Pré-requisitos

```bash
# Dependências do sistema
apt-get update
apt-get install -y build-essential libclamav-dev libcurl4-openssl-dev libjson-c-dev libpthread-stubs0-dev

# ClamAV
apt-get install -y clamav clamav-daemon
systemctl enable clamav-daemon
systemctl start clamav-daemon
freshclam
```

### Compilação

```bash
# Método 1: Script automático
cd /opt/fazai/lib/mods/
chmod +x compile_system_mod.sh
./compile_system_mod.sh

# Método 2: Compilação manual
gcc -shared -fPIC -o system_mod.so system_mod.c -lclamav -lcurl -ljson-c -lpthread
```

## ⚙️ Configuração

### 1. Arquivo de Assinaturas (`/etc/fazai/malware_signatures.txt`)

```bash
# Formato: assinatura,descrição,nível_risco,ação
eval(,Execução de código malicioso,9,block
SELECT.*FROM.*WHERE.*OR.*1=1,SQL Injection,9,block
script.*alert,XSS Script Alert,8,block
```

### 2. Lista de RBLs (`/etc/fazai/rbl_list.txt`)

```bash
# Formato: domínio,descrição,nível_risco,códigos_resposta
zen.spamhaus.org,Spamhaus ZEN,9,127.0.0.2-127.0.0.11
bl.spamcop.net,SpamCop,8,127.0.0.2
```

## 🚀 Uso

### Via FazAI

```bash
# Verificar status do módulo
curl -X POST http://localhost:3120/command -d '{"command":"system_mod status"}'

# Testar wrapper HTTP
curl -X POST http://localhost:3120/command -d '{"command":"system_mod http_wrapper <dados_http>"}'

# Verificar assinaturas
curl -X POST http://localhost:3120/command -d '{"command":"system_mod check_signatures <conteúdo>"}'

# Verificar IP em RBLs
curl -X POST http://localhost:3120/command -d '{"command":"system_mod check_rbl <ip>"}'

# Escanear arquivo com ClamAV
curl -X POST http://localhost:3120/command -d '{"command":"system_mod scan_file <caminho>"}'
```

### Via Node.js Direto

```javascript
const ffi = require('ffi-napi');

const systemMod = ffi.Library('./system_mod.so', {
    'fazai_mod_init': ['int', []],
    'fazai_mod_exec': ['int', ['string', 'string', 'string', 'int']],
    'fazai_mod_cleanup': ['void', []]
});

// Inicializar módulo
systemMod.fazai_mod_init();

// Executar comando
const output = Buffer.alloc(4096);
systemMod.fazai_mod_exec('test', '', output, output.length);
console.log(output.toString());

// Finalizar módulo
systemMod.fazai_mod_cleanup();
```

## 🔧 Comandos Disponíveis

| Comando | Descrição | Parâmetros |
|---------|-----------|------------|
| `help` | Mostra ajuda | - |
| `test` | Testa o módulo | - |
| `status` | Status do módulo | - |
| `http_wrapper` | Testa wrapper HTTP | `<dados_http>` |
| `smtp_wrapper` | Testa wrapper SMTP | `<ip> <dados>` |
| `db_wrapper` | Testa wrapper de banco | `<ip> <porta> <dados>` |
| `check_signatures` | Verifica assinaturas | `<conteúdo>` |
| `check_rbl` | Verifica IP em RBLs | `<ip>` |
| `scan_file` | Escaneia arquivo | `<caminho>` |
| `reload_signatures` | Recarrega assinaturas | - |
| `reload_rbls` | Recarrega RBLs | - |
| `block_ip` | Bloqueia IP | `<ip> <motivo>` |

## 🛡️ Wrappers Específicos

### HTTP Wrapper (Porta 80/443)

```c
// Intercepta requisições HTTP
int http_wrapper(const char* request_data, char* response, int response_len);

// Verifica:
// - Assinaturas de malware
// - XSS, SQL Injection
// - File uploads maliciosos
// - Directory traversal
```

### SMTP Wrapper (Porta 25)

```c
// Intercepta tráfego SMTP
int smtp_wrapper(const char* source_ip, const char* mail_data, char* response, int response_len);

// Verifica:
// - IPs em RBLs
// - Spam patterns
// - Malware em anexos
```

### Database Wrapper (Portas 3306, 5432, etc.)

```c
// Intercepta queries de banco
int database_wrapper(const char* source_ip, int port, const char* query_data, char* response, int response_len);

// Verifica:
// - SQL Injection
// - NoSQL Injection
// - Ataques de força bruta
```

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

### Ações Automáticas

1. **Detecção de Malware**
   - Bloqueio imediato do IP
   - Notificação para FazAI
   - Log detalhado

2. **IP em RBL**
   - Bloqueio no firewall
   - Rejeição de conexão
   - Monitoramento contínuo

3. **Ataque a Banco**
   - Bloqueio do IP atacante
   - Acionamento do LLM
   - Análise de padrões

## 🔧 Personalização

### Adicionar Assinaturas

```bash
# Editar arquivo de assinaturas
nano /etc/fazai/malware_signatures.txt

# Recarregar
curl -X POST http://localhost:3120/command -d '{"command":"system_mod reload_signatures"}'
```

### Adicionar RBLs

```bash
# Editar lista de RBLs
nano /etc/fazai/rbl_list.txt

# Recarregar
curl -X POST http://localhost:3120/command -d '{"command":"system_mod reload_rbls"}'
```

### Configurar Portas Críticas

Edite o array `critical_ports` no código fonte:

```c
static CriticalPort critical_ports[] = {
    {80, "HTTP", "Hypertext Transfer Protocol", 5},
    {443, "HTTPS", "HTTP Secure", 5},
    {3306, "MySQL", "MySQL Database", 8},
    // Adicione suas portas aqui
    {0, "", "", 0} // Terminador
};
```

## 🐛 Troubleshooting

### Problemas Comuns

1. **ClamAV não encontrado**
   ```bash
   apt-get install -y clamav clamav-daemon
   systemctl start clamav-daemon
   freshclam
   ```

2. **Falha na compilação**
   ```bash
   apt-get install -y build-essential libclamav-dev libcurl4-openssl-dev libjson-c-dev
   ```

3. **Permissões negadas**
   ```bash
   chmod 755 system_mod.so
   chown root:root system_mod.so
   ```

4. **Módulo não carrega**
   ```bash
   ldd system_mod.so  # Verificar dependências
   node -e "const ffi = require('ffi-napi'); console.log(ffi)"  # Testar FFI
   ```

### Logs de Debug

```bash
# Ativar debug
export FAZAI_DEBUG=1

# Ver logs em tempo real
tail -f /var/log/fazai.log

# Ver logs do firewall
tail -f /var/log/fazai_firewall.log
```

## 📈 Performance

### Otimizações

1. **Cache de RBLs**: Resultados são cacheados por 5 minutos
2. **Thread Pool**: Processamento assíncrono de eventos
3. **Compilação Otimizada**: Flags `-O2` para performance
4. **Memory Pool**: Reutilização de buffers

### Métricas de Performance

```bash
# Tempo de resposta médio
time curl -X POST http://localhost:3120/command -d '{"command":"system_mod test"}'

# Uso de memória
ps aux | grep system_mod

# Eventos por segundo
grep "ALERT" /var/log/fazai.log | wc -l
```

## 🔒 Segurança

### Considerações

1. **Execução como Root**: Necessário para iptables
2. **Permissões de Arquivo**: Apenas root pode modificar
3. **Validação de Input**: Todos os inputs são validados
4. **Buffer Overflow**: Proteção contra overflow
5. **Memory Leaks**: Cleanup automático de recursos

### Auditoria

```bash
# Verificar integridade
md5sum system_mod.so

# Verificar permissões
ls -la system_mod.so

# Verificar dependências
ldd system_mod.so
```

## 🤝 Contribuição

### Desenvolvimento

1. Fork o repositório
2. Crie uma branch para sua feature
3. Implemente as mudanças
4. Teste extensivamente
5. Submeta um pull request

### Testes

```bash
# Teste unitário
make test

# Teste de integração
make integration-test

# Teste de performance
make performance-test
```

## 📄 Licença

Este módulo faz parte do projeto FazAI e está sob a mesma licença.

## 🆘 Suporte

- **Documentação**: Este arquivo
- **Issues**: GitHub Issues
- **Discord**: Canal #fazai-support
- **Email**: support@fazai.dev

---

**⚠️ Aviso**: Este módulo executa com privilégios de root e pode afetar o funcionamento do sistema. Teste em ambiente de desenvolvimento antes de usar em produção.