# FazAI Changelog

## [3.0.0-rc] - 2025-10-17

- Reorganizado projeto para suceder a versão anterior (arquivada sob `~/deprecated`).
- Introduzido modo CLI interativo com memória contextual persistente e histórico de comandos compartilhado entre sessões.
- Integrado pesquisa híbrida através do Context7 remoto com fallback web para contextualizar execuções problemáticas.
- Atualizados prompts e utilidades (`cli-mode`, `memory`, `research`) para suportar conversação contínua e automação `/exec`.
- Ajustado `.gitignore` para proteger arquivos sensíveis (`fazai.conf`, diretório `~/.fazai`) e evitar vazamento de chaves.

