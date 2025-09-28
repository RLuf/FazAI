# Changelog

## Unreleased

### Added
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
