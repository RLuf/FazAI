# Manual de Ferramentas do FazAI (v1.42.2)

Este documento reúne, em um só lugar, uma breve descrição das ferramentas que acompanham o FazAI. Para executar qualquer ferramenta diretamente via CLI utilize:

```
fazai tool:<nome_da_ferramenta> param={...}
```

Ou invoque-a através de fluxos MCPS/Auto-Tool conforme necessidade.

| Ferramenta | Descrição (resumida) | Caminho |
|------------|---------------------|---------|
| agent_supervisor | Gerencia agentes remotos para coleta de telemetria (processos, rede, I/O). | opt/fazai/tools/agent_supervisor.js |
| alerts | Envia alertas por e-mail e Telegram. | opt/fazai/tools/alerts.js |
| auto_tool | Gera/instala ferramentas dinamicamente a partir de especificações em linguagem natural. | opt/fazai/tools/auto_tool.js |
| blacklist_check | Consulta DNSBLs populares para verificação de reputação de IP. | opt/fazai/tools/blacklist_check.js |
| cloudflare | Opera na API Cloudflare (zones, DNS, firewall rules). | opt/fazai/tools/cloudflare.js |
| crowdsec | Instala CrowdSec e configura mitigação básica. | opt/fazai/tools/crowdsec.js |
| crowdsec_setup | Instala CrowdSec + bouncers adequados. | opt/fazai/tools/crowdsec_setup.js |
| email_relay | Instala e configura Postfix relay com filtros antispam. | opt/fazai/tools/email_relay.js |
| fazai-config (CLI/TUI) | Ajusta provedores e chaves de API interativamente. | opt/fazai/tools/fazai-config.js / fazai-config-tui.sh |
| fazai_tui / fazai_html_v1 | Dashboards TUI e geração de gráficos HTML locais. | opt/fazai/tools/fazai_tui.js / fazai_html_v1.sh |
| fazai_web | Abre a interface Web de gerenciamento. | opt/fazai/tools/fazai_web.sh |
| gemma_bootstrap | Compila/binários Gemma (gemma.cpp) localmente. | opt/fazai/tools/gemma_bootstrap.sh |
| geoip_lookup | Consulta informações GeoIP (país, cidade, ASN). | opt/fazai/tools/geoip_lookup.js |
| http_fetch | Realiza requisições HTTP/HTTPS genéricas (GET/POST). | opt/fazai/tools/http_fetch.js |
| modsecurity / modsecurity_setup | Instala e configura ModSecurity + OWASP CRS. | opt/fazai/tools/modsecurity.js / modsecurity_setup.js |
| monit_setup | Instala e configura Monit. | opt/fazai/tools/monit_setup.js |
| net_qos_monitor | Monitora tráfego por IP e aplica QoS via tc. | opt/fazai/tools/net_qos_monitor.js |
| ports_monitor | Audita conexões de rede e pode acionar bloqueios/alertas. | opt/fazai/tools/ports_monitor.js |
| qdrant_setup | Sobe Qdrant via Docker e cria coleções iniciais. | opt/fazai/tools/qdrant_setup.js |
| rag_ingest | Gera embeddings de documentos/URLs e indexa no Qdrant. | opt/fazai/tools/rag_ingest.js |
| snmp_monitor | Consulta OIDs via SNMP v2c. | opt/fazai/tools/snmp_monitor.js |
| spamexperts | Ações básicas na API SpamExperts (domínios/políticas). | opt/fazai/tools/spamexperts.js |
| suricata_setup | Instala/configura Suricata IDS/IPS. | opt/fazai/tools/suricata_setup.js |
| system_info | Fornece informações detalhadas do sistema. | opt/fazai/tools/system_info.js |
| weather | Exibe informações meteorológicas atuais. | opt/fazai/tools/weather.js |
| web_search | Pesquisa web (títulos/links/resumos). | opt/fazai/tools/web_search.js |
| net_qos_monitor | Monitoramento QoS de rede (nftables + tc). | opt/fazai/tools/net_qos_monitor.js |
| github-setup | Inicializa repositório Git e faz push no GitHub. | bin/tools/github-setup.sh |
| install-llamacpp | Compila/instala `llama.cpp` localmente. | bin/tools/install-llamacpp.sh |
| sync-changes | Sincroniza alterações do FazAI entre ambientes. | bin/tools/sync-changes.sh |
| sync-keys | Sincroniza as chaves do `.env` com `fazai.conf`. | bin/tools/sync-keys.sh |
| system-check | Verifica integridade, dependências e status do FazAI. | bin/tools/system-check.sh |
| version-bump | Automatiza o bump de versão em todos os arquivos. | bin/tools/version-bump.sh |

> Esta lista cobre as ferramentas oficiais distribuídas na pasta `opt/fazai/tools` e `bin/tools`. Ferramentas geradas dinamicamente via `auto_tool` também aparecem em `/opt/fazai/tools` após criação.

Para detalhes completos de parâmetros, abra o arquivo correspondente ou consulte a ajuda interna (`tool:<nome> param={"help":true}` sempre que implementado).