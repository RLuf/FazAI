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