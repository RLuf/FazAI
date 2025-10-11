# FazAI - Guia de Uso v1.42.1

Este documento apresenta de forma organizada os principais comandos e exemplos para utilização do FazAI.

## 1. Acesso ao FazAI

### 1.1 CLI (Interface de Linha de Comando)
O comando principal é `fazai`. Após a instalação, você pode executar:

  fazai ajuda               # Exibe a lista completa de comandos
  fazai --version           # Exibe a versão instalada

## 2. Comandos de Gerenciamento de Logs

  fazai logs [n]            # Exibe as últimas _n_ entradas do log (padrão: 10)
  fazai limpar-logs         # Limpa o arquivo de log (cria backup automático)
  fazai clear-logs         # Mesma função em inglês
  fazai web                 # Abre a interface web de logs

## 3. Comandos de Serviço (systemd)

  fazai start               # Inicia o serviço FazAI
  fazai stop                # Para o serviço FazAI
  fazai restart             # Reinicia o serviço FazAI
  fazai status              # Exibe o status do serviço FazAI

Ou diretamente via systemctl:

  sudo systemctl start fazai
  sudo systemctl status fazai

## 4. Comandos Básicos de Sistema

Use o FazAI para obter informações do servidor sem sair do CLI:

  fazai kernel              # Exibe versão do kernel (uname -r)
  fazai sistema             # Exibe informações do sistema (uname -a)
  fazai memoria             # Exibe uso de memória (free -h)
  fazai disco               # Exibe uso de disco (df -h)
  fazai processos           # Lista processos (ps aux)
  fazai rede                # Exibe interfaces de rede (ip a)
  fazai data                # Mostra data e hora (date)
  fazai uptime              # Tempo de atividade (uptime)
  fazai html <tipo> [graf]  # Gera gráfico HTML (tipo: memoria, disco, processos)
  fazai tui                 # Abre o dashboard TUI (ncurses)
  fazai --completion-help   # Ajuda do bash completion

## 4.1 Integrações de Monitoramento

- SNMP (consulta de OIDs)
  - MCPS: `tool:snmp_monitor param={"host":"192.168.0.1","community":"public","oids":["1.3.6.1.2.1.1.1.0"]}`

- Prometheus/Grafana
  - Subir Prometheus/Grafana via MCPS usando ferramentas geradas por `auto_tool` ou scripts próprios
  - Expor métricas via endpoint customizado (a ser adicionado) e/ou exporters

- Agentes remotos
  - `tool:agent_supervisor param={"hosts":["192.168.0.10"],"interval":30}` envia telemetria para `POST /ingest`

- Qdrant (RAG)
  - `tool:qdrant_setup param={"port":6333,"collection":"linux_networking_tech"}`

## 4.2 OPNsense (Multiserver)

Linguagem natural via CLI:

```
fazai opn "listar firewalls"
fazai opn "health do fw-01"
fazai opn "listar interfaces do fw-01"
```

Endpoints REST:

```
POST /opn/add       {name, base_url, api_key, api_secret, verify_tls?, tags?}
GET  /opn/list
GET  /opn/:id/health
GET  /opn/:id/interfaces
POST /opn/nl        {query}
```

Segurança: segredos são armazenados em `/etc/fazai/secrets/opnsense/<id>.json` (chmod 600).
API OPNsense: https://docs.opnsense.org/development/api.html

## 4.3 Alertas & Diagnóstico

- Alertas via `/alerts/config`:
```
POST /alerts/config
{
  "interval_sec": 60,
  "rules": [
    { "id": "fw-01", "cpu_percent": 85, "channel": "email", "target": {"to":"root@example"} },
    { "id": "fw-01", "ifaces": [{"name":"em0","rx_bps":100000000}], "channel": "telegram", "target": {"botToken":"...","chatId":"..."} }
  ]
}
```

- Diagnóstico pass-through:
```
POST /opn/:id/diagnostics { "path": "/api/core/diagnostics/...", "params": { ... } }
```

## 5. Modo MCPS (Planejamento Passo a Passo)

Para receber uma lista de comandos organizada em passos:

  fazai mcps <tarefa>       # Exemplo: fazai mcps atualizar o sistema

O FazAI retornará cada etapa sequencial para execução manual.

## 6. Exemplos de Uso

- `fazai cria um usuario nome=teste senha=teste321 grupo=printers`
- `fazai instale mod_security do apache`
- `fazai altere a porta do ssh de 22 para 31052`
- `fazai use a api da cloudflare para criar DNS A record`
- `fazai monitora ssh e notifica em caso de falha`

## 7. Opções e Flags

  --debug                   # Ativa modo debug no instalador
  --clean                   # Limpa estado de instalação anterior
  --with-llama              # Inclui instalação do llama.cpp local

## 8. Dicas Úteis

- Sempre consulte `fazai ajuda` para ver comandos disponíveis.
- Use `fazai status` após a instalação para verificar se o daemon está ativo.
- Para personalizar configurações, abra `/etc/fazai/fazai.conf`.
- Execute `fazai-config` ou `fazai-config-tui` para ajustar chaves de API.

### Telemetria (flags)
- `[telemetry].enable_ingest`: habilita `POST /ingest` para ingestão de telemetria.
- `[telemetry].enable_metrics`: habilita `GET /metrics` no formato Prometheus.
Quando desabilitados ou ausentes, os respectivos endpoints retornam 404.

CLI auxiliar:
```
fazai telemetry --enable    # habilita ambos + reinicia serviço
fazai telemetry --disable   # desabilita ambos + reinicia
fazai telemetry-smoke       # valida /ingest e /metrics conforme flags
```

### Interface Web / Docler
- Serviço: `fazai-docler` (portas 3220/3221), executa como usuário `fazai-web`.
- A UI em `/ui` (daemon) inclui um tile de status com botões para ativar/desativar telemetria.

### Qdrant (RAG) e Ingestão
- Se Docker estiver presente, o installer ativa o serviço `fazai-qdrant`.
- Para inserir conhecimento:
  - Via API: `POST /kb/ingest` com `{ url }` ou `{ text }`
  - Via UI: utilizar controles de ingestão (quando disponíveis) ou API acima.

## 9. Suporte e Documentação Adicional

- GitHub: https://github.com/RLuf/FazAI
- Changelog: CHANGELOG.md
- Logs de instalação: /var/log/fazai_install.log

---

Estas instruções devem cobrir os casos mais comuns de uso do FazAI. Para cenários avançados e integração com scripts, adapte conforme necessário.

Compatível com: Debian/Ubuntu, Fedora/RedHat/CentOS, WSL

## Instalação Fedora

```bash
sudo dnf install -y nodejs npm python3 python3-pip gcc dialog
git clone https://github.com/RLuf/FazAI.git
cd FazAI
sudo ./install.sh
```

## 10. Pesquisa Técnica (Context7)

- Endpoint de API do daemon:
  - `GET /research?q=<termo>&max=5` — realiza pesquisa técnica; quando a chave do Context7 não estiver configurada, usa fallback mock.

- CLI:
  - `fazai query "<termo>"` — consulta o endpoint acima e imprime resultados (títulos/URLs/snippets).
  - `fazai -q "<pergunta>"` — modo pergunta direta; integra pesquisa (Context7 quando disponível) como contexto para enriquecer a resposta, de forma transparente.

- Configuração:
  - Arquivo: `/etc/fazai/fazai.conf`
  - Seção `[context7]`:
    - `endpoint = https://context7.com/api/v1`
    - `api_key = ctx7sk-...`
  - Quando presentes no `.conf`, não é necessário exportar variáveis de ambiente — o FazAI carrega os valores e habilita a pesquisa Context7 automaticamente.

Exemplos:
```
fazai query "react hook form"
fazai -q "Como configurar SSR no Next.js?"
curl 'http://localhost:3120/research?q=vercel%2Fnext.js&max=3'
```

## 11. Configurar Fallbacks de IA

Gemma (gemma.cpp) é o motor padrão do FazAI. Para usar APIs externas como fallback (quando o Gemma falhar/ficar indisponível):

- Via CLI interativa:
  ```bash
  sudo node /opt/fazai/tools/fazai-config.js
  # Escolha: "Configurar fallback de IA (OpenRouter, OpenAI, etc.)"
  ```

- Editando o arquivo:
  ```ini
  [ai_provider]
  enable_fallback = true

  [openrouter]
  api_key = SUA_CHAVE
  endpoint = https://openrouter.ai/api/v1
  default_model = openai/gpt-4o

  [openai]
  api_key = SUA_CHAVE
  endpoint = https://api.openai.com/v1
  default_model = gpt-4o
  ```

Após salvar, reinicie o serviço FazAI para aplicar:
```bash
sudo systemctl restart fazai
```

 
