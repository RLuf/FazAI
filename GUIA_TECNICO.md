# FazAI - Guia Técnico Completo

## 📋 Visão Geral

O FazAI é uma plataforma de automação inteligente e segurança que combina:
- **Automação com IA**: Comandos naturais interpretados por LLMs
- **Segurança Avançada**: Módulos nativos com proteção contra malware
- **Integração Cloud**: APIs do Cloudflare, SpamExperts
- **Gestão Centralizada**: Interface para múltiplos servidores
- **Monitoramento SNMP**: Switches, storages e ativos de rede

## 🛡️ Módulo de Segurança (system_mod.c)

### Instalação e Configuração

```bash
# 1. Compilar o módulo
cd /opt/fazai/lib/mods/
./compile_system_mod.sh

# 2. Verificar instalação
node test_system_mod.js

# 3. Configurar assinaturas
nano /etc/fazai/malware_signatures.txt

# 4. Configurar RBLs
nano /etc/fazai/rbl_list.txt
```

### Uso via API REST

```bash
# Status do módulo
curl -X POST http://localhost:3120/command \
  -H "Content-Type: application/json" \
  -d '{"command":"system_mod status"}'

# Verificar assinatura
curl -X POST http://localhost:3120/command \
  -H "Content-Type: application/json" \
  -d '{"command":"system_mod check_signatures SELECT * FROM users WHERE id=1 OR 1=1"}'

# Verificar IP em RBLs
curl -X POST http://localhost:3120/command \
  -H "Content-Type: application/json" \
  -d '{"command":"system_mod check_rbl 192.168.1.100"}'
```

## ☁️ Integração Cloudflare

### Configuração da API

```bash
# Adicionar credenciais Cloudflare
nano /etc/fazai/fazai.conf
```

```ini
[cloudflare]
enabled = true
api_token = your_cloudflare_api_token
zone_id = your_zone_id
account_id = your_account_id
```

### Comandos Cloudflare

```bash
# Listar regras de firewall
fazai "mostre todas as regras de firewall do Cloudflare"

# Criar regra de bloqueio
fazai "bloqueie o IP 192.168.1.100 no Cloudflare"

# Configurar WAF
fazai "configure o WAF do Cloudflare para bloquear ataques SQL injection"

# Análise de tráfego
fazai "mostre o relatório de tráfego do Cloudflare dos últimos 7 dias"
```

### API REST para Cloudflare

```bash
# Listar regras
curl -X GET http://localhost:3120/cloudflare/rules

# Criar regra
curl -X POST http://localhost:3120/cloudflare/rules \
  -H "Content-Type: application/json" \
  -d '{
    "mode": "block",
    "configuration": {
      "target": "ip",
      "value": "192.168.1.100"
    },
    "notes": "IP malicioso detectado"
  }'

# Análise de segurança
curl -X GET http://localhost:3120/cloudflare/security/analytics
```

## 🛡️ Integração SpamExperts

### Configuração

```bash
# Configurar SpamExperts
nano /etc/fazai/fazai.conf
```

```ini
[spamexperts]
enabled = true
api_url = https://api.spamexperts.com
username = your_username
password = your_password
domain = your_domain.com
```

### Comandos SpamExperts

```bash
# Status do serviço
fazai "verifique o status do SpamExperts"

# Listar emails bloqueados
fazai "mostre os últimos 50 emails bloqueados pelo SpamExperts"

# Configurar whitelist
fazai "adicione o domínio exemplo.com na whitelist do SpamExperts"

# Relatório de spam
fazai "gere relatório de spam dos últimos 30 dias"
```

### API REST para SpamExperts

```bash
# Status do serviço
curl -X GET http://localhost:3120/spamexperts/status

# Listar emails bloqueados
curl -X GET http://localhost:3120/spamexperts/blocked

# Adicionar whitelist
curl -X POST http://localhost:3120/spamexperts/whitelist \
  -H "Content-Type: application/json" \
  -d '{"domain": "exemplo.com"}'

# Relatório de spam
curl -X GET http://localhost:3120/spamexperts/reports/spam
```

## 🔧 Gestão OPNsense via MCP

### Configuração MCP

```bash
# Configurar OPNsense
nano /etc/fazai/fazai.conf
```

```ini
[opnsense]
enabled = true
host = 192.168.1.1
port = 443
use_ssl = true
username = admin
password = your_password
# OU
api_key = your_api_key
```

### Comandos OPNsense

```bash
# Status do firewall
fazai "verifique o status do firewall OPNsense"

# Listar regras
fazai "mostre todas as regras do firewall OPNsense"

# Criar regra de bloqueio
fazai "crie uma regra para bloquear a porta 22 no OPNsense"

# Configurar NAT
fazai "configure NAT para redirecionar porta 80 para 192.168.1.100"

# Backup de configuração
fazai "faça backup da configuração do OPNsense"
```

### API REST para OPNsense

```bash
# Status do sistema
curl -X GET http://localhost:3120/opnsense/system/status

# Listar regras
curl -X GET http://localhost:3120/opnsense/firewall/rules

# Criar regra
curl -X POST http://localhost:3120/opnsense/firewall/rules \
  -H "Content-Type: application/json" \
  -d '{
    "interface": "WAN",
    "direction": "in",
    "protocol": "tcp",
    "source": "any",
    "destination": "192.168.1.100",
    "port": "80",
    "description": "Web Server Access"
  }'

# Backup
curl -X POST http://localhost:3120/opnsense/system/backup
```

## 📊 Interface Web Dashboard

### Acesso ao Dashboard

```bash
# URL do dashboard
http://localhost:3120/dashboard

# Credenciais padrão
Username: admin
Password: fazai2024
```

### Funcionalidades do Dashboard

#### 1. **Painel Principal**
- Visão geral de todos os servidores
- Status de serviços críticos
- Alertas em tempo real
- Métricas de performance

#### 2. **Gestão de Servidores**
- Cadastro de servidores Linux
- Configuração de firewalls OPNsense
- Monitoramento SNMP
- Backup e restauração

#### 3. **Segurança**
- Status do módulo system_mod
- Logs de segurança
- IPs bloqueados
- Análise de ameaças

#### 4. **Cloudflare**
- Configuração de regras
- Análise de tráfego
- Relatórios de segurança
- Configuração de WAF

#### 5. **SpamExperts**
- Status do serviço
- Emails bloqueados
- Whitelist/Blacklist
- Relatórios de spam

### API do Dashboard

```bash
# Status geral
curl -X GET http://localhost:3120/api/dashboard/status

# Listar servidores
curl -X GET http://localhost:3120/api/servers

# Adicionar servidor
curl -X POST http://localhost:3120/api/servers \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Servidor Web",
    "ip": "192.168.1.100",
    "type": "linux",
    "ssh_user": "root",
    "ssh_key": "path/to/key"
  }'

# Métricas de segurança
curl -X GET http://localhost:3120/api/security/metrics
```

## 🔍 Monitoramento SNMP

### Configuração SNMP

```bash
# Instalar dependências SNMP
apt-get install -y snmp snmp-mibs-downloader

# Configurar SNMP
nano /etc/fazai/fazai.conf
```

```ini
[snmp]
enabled = true
community = public
timeout = 5000
retries = 3

[snmp_devices]
switch1 = 192.168.1.10
storage1 = 192.168.1.20
router1 = 192.168.1.1
```

### Comandos SNMP

```bash
# Status de switches
fazai "verifique o status de todos os switches"

# Monitoramento de storage
fazai "mostre o uso de disco do storage principal"

# Status de portas
fazai "verifique quais portas estão ativas no switch"

# Temperatura de equipamentos
fazai "monitore a temperatura dos equipamentos"

# Tráfego de rede
fazai "mostre o tráfego de rede dos últimos 24 horas"
```

### API REST para SNMP

```bash
# Listar dispositivos
curl -X GET http://localhost:3120/snmp/devices

# Status de dispositivo
curl -X GET http://localhost:3120/snmp/devices/switch1/status

# Métricas de interface
curl -X GET http://localhost:3120/snmp/devices/switch1/interfaces

# Uso de CPU
curl -X GET http://localhost:3120/snmp/devices/storage1/cpu

# Uso de memória
curl -X GET http://localhost:3120/snmp/devices/storage1/memory
```

## 🎛️ Gestão Centralizada de Servidores

### Cadastro de Servidores

#### Servidores Linux

```bash
# Via dashboard
http://localhost:3120/dashboard/servers/add

# Via API
curl -X POST http://localhost:3120/api/servers \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Web Server 01",
    "ip": "192.168.1.100",
    "type": "linux",
    "ssh_user": "root",
    "ssh_key": "/opt/fazai/keys/web01.key",
    "description": "Servidor web principal",
    "tags": ["web", "production"],
    "monitoring": {
      "enabled": true,
      "snmp": false,
      "ssh": true
    }
  }'
```

#### Firewalls OPNsense

```bash
# Via API
curl -X POST http://localhost:3120/api/servers \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Firewall Principal",
    "ip": "192.168.1.1",
    "type": "opnsense",
    "api_key": "your_api_key",
    "description": "Firewall principal da rede",
    "tags": ["firewall", "gateway"],
    "monitoring": {
      "enabled": true,
      "snmp": true,
      "api": true
    }
  }'
```

### Comandos Centralizados

```bash
# Executar comando em todos os servidores
fazai "execute 'df -h' em todos os servidores Linux"

# Backup de configurações
fazai "faça backup das configurações de todos os firewalls"

# Atualização de segurança
fazai "atualize todos os servidores Linux com patches de segurança"

# Monitoramento de serviços
fazai "verifique o status de todos os serviços críticos"

# Relatório de performance
fazai "gere relatório de performance de todos os servidores"
```

## 📈 Relatórios e Analytics

### Relatórios de Segurança

```bash
# Relatório diário
curl -X GET http://localhost:3120/api/reports/security/daily

# Relatório semanal
curl -X GET http://localhost:3120/api/reports/security/weekly

# Relatório mensal
curl -X GET http://localhost:3120/api/reports/security/monthly
```

### Relatórios de Performance

```bash
# Performance de servidores
curl -X GET http://localhost:3120/api/reports/performance/servers

# Performance de rede
curl -X GET http://localhost:3120/api/reports/performance/network

# Performance de storage
curl -X GET http://localhost:3120/api/reports/performance/storage
```

## 🚀 Deploy em Produção

### Requisitos do Sistema

```bash
# Dependências mínimas
- Ubuntu 20.04+ ou CentOS 8+
- 4GB RAM
- 20GB disco
- Node.js 18+
- Python 3.8+
- ClamAV
- iptables
```

### Instalação Completa

```bash
# 1. Clone do repositório
git clone https://github.com/fazai/fazai.git
cd fazai

# 2. Instalação
./install.sh

# 3. Configuração inicial
fazai-config-tui

# 4. Configurar módulo de segurança
cd /opt/fazai/lib/mods/
./compile_system_mod.sh

# 5. Configurar APIs
nano /etc/fazai/fazai.conf

# 6. Iniciar serviços
systemctl start fazai
systemctl enable fazai

# 7. Acessar dashboard
http://localhost:3120/dashboard
```

## 🔒 Segurança

### Hardening do Sistema

```bash
# 1. Atualizar sistema
apt-get update && apt-get upgrade -y

# 2. Configurar firewall
ufw enable
ufw default deny incoming
ufw default allow outgoing

# 3. Configurar SSH
nano /etc/ssh/sshd_config
# PermitRootLogin no
# PasswordAuthentication no
# Port 2222

# 4. Configurar fail2ban
apt-get install fail2ban
systemctl enable fail2ban
systemctl start fail2ban
```

## 🆘 Troubleshooting

### Problemas Comuns

#### 1. Módulo não carrega
```bash
# Verificar dependências
ldd /opt/fazai/lib/mods/system_mod.so

# Verificar permissões
ls -la /opt/fazai/lib/mods/system_mod.so

# Recompilar
cd /opt/fazai/lib/mods/
./compile_system_mod.sh
```

#### 2. API não responde
```bash
# Verificar serviço
systemctl status fazai

# Verificar logs
journalctl -u fazai -f

# Verificar porta
netstat -tlnp | grep 3120

# Reiniciar serviço
systemctl restart fazai
```

#### 3. Dashboard não carrega
```bash
# Verificar configuração
nano /etc/fazai/fazai.conf

# Verificar permissões
ls -la /opt/fazai/tools/

# Verificar logs
tail -f /var/log/fazai.log
```

### Logs de Debug

```bash
# Ativar debug
export FAZAI_DEBUG=1

# Ver logs em tempo real
tail -f /var/log/fazai.log

# Ver logs do sistema
journalctl -u fazai -f

# Ver logs de segurança
tail -f /var/log/fazai_firewall.log
```

## 📚 Recursos Adicionais

### Documentação
- [README.md](README.md) - Documentação principal
- [API.md](API.md) - Documentação da API
- [SECURITY.md](SECURITY.md) - Guia de segurança
- [DEPLOYMENT.md](DEPLOYMENT.md) - Guia de deploy

### Scripts Úteis

```bash
# Backup completo
/opt/fazai/tools/backup.sh

# Restauração
/opt/fazai/tools/restore.sh

# Atualização
/opt/fazai/tools/update.sh

# Diagnóstico
/opt/fazai/tools/diagnostic.sh
```

### Suporte

- **Issues**: GitHub Issues
- **Discord**: Canal #fazai-support
- **Email**: support@fazai.dev
- **Documentação**: https://docs.fazai.dev

---

## ✅ Conclusão

Este guia técnico cobre todas as funcionalidades avançadas do FazAI, incluindo:

- ✅ Módulo de segurança nativo
- ✅ Integração com Cloudflare e SpamExperts
- ✅ Gestão centralizada de servidores
- ✅ Monitoramento SNMP
- ✅ Interface web dashboard
- ✅ APIs REST completas
- ✅ Configuração de produção
- ✅ Troubleshooting

O sistema está pronto para uso em produção com todas as funcionalidades de segurança e automação implementadas.