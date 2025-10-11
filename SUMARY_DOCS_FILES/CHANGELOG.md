# Changelog

## Unreleased

### Added
- Installer: Post-start helper ensures `/run/fazai/gemma.sock` is chmod 0666 reliably.
- Qdrant migration: added one‑time script `scripts/qdrant_migrate_persona.py` (claudio_soul → fazai_memory). Removed from installer.
- Test: `tests/test_natural_cli_order.sh` to simulate a natural‑language order via CLI (non‑destructive).
- **Worker Python Gemma**: Adicionado `import requests` (linha 18) para suportar embeddings reais via Ollama mxbai-embed-large
  - Integração com `http://192.168.0.27:11434/api/embeddings` para gerar vetores 1024D
  - Método `QdrantMemory.get_embedding_from_ollama()` usa requests.post() para embeddings
  - Fallback seguro para vetor zero se Ollama falhar
- Documento `todo.txt` com backlog e próximos passos (Ops Console + Gemma).
- Painel Docker com métricas locais (CPU, memória, rede, IO) e gráficos sparkline no Ops Console.
- Interface RAG com ingestão de arquivos (PDF/DOC/JSON) e consulta vetorial no Ops Console.
- Cloudflare e OPNsense com cadastro persistente, automação de APIs e painéis administrativos no console web.
- **FazAI Dispatcher**: Sistema unificado de roteamento entre workers Node.js e Python Gemma
  - Configuração dinâmica via `/etc/fazai/fazai.conf` com seção `[dispatcher]`
  - Monitoramento de saúde automatizado dos workers
  - Roteamento inteligente baseado em capacidades do worker
  - Fallback automático entre workers legado e Gemma
  - Suporte a múltiplos modos: smart, force_legacy, force_gemma
- Integração inicial do `fazai-gemma-worker` com `libgemma` para geração por fluxo (streaming) de tokens.
- Suporte a processamento de saída ND-JSON do modelo; ações do tipo `{"type":"shell","command":"..."}` podem ser executadas no host quando habilitado.
- Integração básica com Qdrant para memória de contexto (consulta e upsert simplificados).
- Wrapper `GemmaWrapper` e cliente `QdrantClient` adicionados para modularizar integrações.

### Changed
- Systemd service: ensure `/run/fazai` is created with permissive permissions before binding the Unix socket and keep the socket fix helper post-start to avoid PermissionDenied on restart.
- Worker defaults: add `log_level` under `[gemma_worker]` in configs/installer so logging level can be tuned via `/etc/fazai/fazai.conf` (DEBUG now respected).
- CLIs (`fazai_mcp_client.py`, `gemma_worker_client.py`, `test_connection.py`) now compartilham carregamento de configuração (`fazai.conf`), usam `/run/fazai/gemma.sock` por padrão com fallback TCP configurável e o cliente legado virou um invólucro do novo cliente MCP assíncrono.
- Config templates (`fazai.conf` e `.example`) consolidados: mesmos campos do ambiente real (`unix_socket`, `dispatcher.mode`, `ollama`, `ai_provider`) e o instalador escreve esse conteúdo completo.
- Worker: ND‑JSON server now uses buffered line parsing; ignores non‑JSON noise to avoid "JSON inválido" spam.
- Installer: Do not overwrite existing `/etc/fazai/fazai.conf`; create defaults only if missing.
- Defaults aligned: `personality_collection=fazai_memory`, `vector_dim=1024`.
- CLI wrapper fix: `/bin/fazai` now calls `/opt/fazai/bin/fazai_mcp_client.py` (correct path).
- **Worker Python Gemma**: Refatoração completa para carregamento dinâmico de configuração
  - Remoção das configurações hardcoded (CONFIG global)
  - Carregamento inteligente de paths via `fazai.conf`
  - Integração com Gemma local, fallbacks OpenAI/OpenRouter, e pesquisa na web
  - Compatibilidade com dispatcher para switching personalizado entre workers
- Memória vetorial dividida: `fazai_memory` (personalidade Claudio) e `fazai_kb` (protocolos dedicados) agora são configuráveis com host/port/dim padrão no instalador e worker.
- Installer: Prometheus e Grafana deixam de ser provisionados neste host; o script remove serviços legados e orienta usar o stack externo `~/fazaiserverlogs`.
- Installer atualizado para provisionar conversores (pdftotext/pandoc), dependências Node e assets do painel RAG.

### Security
- Execução de comandos shell via ações do modelo é explicítamente desabilitada por padrão. Para habilitar temporariamente em testes, exporte `FAZAI_ALLOW_SHELL_EXEC=1` antes de iniciar o worker.
- Adicionada whitelist básica e execução via `timeout 30s` para reduzir riscos; recomenda-se revisão e endurecimento antes de usar em produção.

# Changelog

## [v2.0.0] - 22/08/2025 — Stable
