# Copilot Instructions for FazAI v2.0

## Visão Geral e Arquitetura
- **FazAI v2.0** é um sistema de agente inteligente cognitivo e persistente, com raciocínio contínuo, aprendizado incremental e execução autônoma de tarefas complexas.
- Arquitetura em três camadas:
  1. **CLI**: `/bin/fazai` — interface de linha de comando para automação e orquestração.
  2. **Daemon**: `/opt/fazai/lib/main.js` — servidor Node.js Express (porta 3120), coordena agentes, integra ferramentas e expõe API.
  3. **Worker**: `/worker/` — worker C++ (libgemma.a) para inferência IA local via ND-JSON em `/run/fazai/gemma.sock`.
- Base de conhecimento persistente via Qdrant (porta 6333, RAG).
- Integrações nativas: OPNsense, SpamExperts, Zimbra, Cloudflare, ModSecurity, Suricata, CrowdSec.

## Fluxos de Desenvolvimento
- **Instalação**: `sudo ./install.sh` (provisiona dependências, CLI, serviços). Desinstalação: `sudo ./uninstall.sh`.
- **Testes**: `npm test` (executa scripts em `tests/*.test.sh` e PowerShell se disponível).
- **Build helpers**: `npm run tui`, `npm run config-tui`, `npm run web`.
- **Docker**: `docker compose up -d --build` (porta 3120, Qdrant opcional em 6333).
- **Deploy seguro**: Nunca versionar segredos; vivem em `/etc/fazai/secrets/`.

## Convenções e Padrões
- **JavaScript**: 2 espaços, ponto e vírgula, `camelCase` para funções/variáveis, `PascalCase` para classes, `UPPER_SNAKE_CASE` para constantes. Ferramentas: `lower_snake_case.js`.
- **C/C++**: 4 espaços, include guards, headers enxutos, estilo consistente com `worker/`.
- **Logs**: Use `winston` (JSON) para logging estruturado.
- **Testes**: Scripts shell idempotentes em `tests/` (`*.test.sh`).
- **Commits**: Mensagem curta e imperativa, corpo explicativo, referência a issues (ex: `Fix: opnsense list health (#123)`).

## Integrações e Comunicação
- **Protocolo ND-JSON**: 9 tipos de ação (plan, ask, research, shell, toolSpec, observe, commitKB, done).
- **Agentes remotos**: Ingestão via `/ingest`, métricas Prometheus.
- **OPNsense**: Integração nativa, endpoints `/opn/*`, operações read-only por padrão.
- **Relay SMTP**: Comandos CLI para análise, configuração, monitoramento e integração com SpamExperts/Zimbra.

## Exemplos de Uso
```bash
fazai agent "configurar servidor de email relay com antispam e antivirus"
fazai relay analyze
fazai relay spamexperts
```

## Dicas para Agentes AI
- Sempre consulte `AGENTS.md` e `README.md` para contexto e padrões.
- Siga a estrutura de módulos: `opt/fazai/tools/`, `worker/`, `bin/`, `etc/`, `tests/`.
- Para mudanças de protocolo, ajuste `SPEC.md` e inclua fixtures de teste.
- Documente mudanças relevantes em `CHANGELOG.md`.
- Nunca exponha ou versiona segredos.

> Consulte também: `AGENTS.md`, `README.md`, `CLAUDE.md`, `.cursor/rules/` para detalhes e exemplos.
