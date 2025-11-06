# Manual de Referência Rápida do TODO

## 3. Revisar linguagem base com Enoc
- 📌 Objetivo: decidir se o orquestrador permanece em TypeScript ou se recebe um módulo complementar.
- ✅ Passos sugeridos:
  1. Preparar resumo técnico do status atual do código (componentes principais em `src/`).
  2. Agendar call com Enoc, compartilhar resumo e requisitos de performance/manutenção.
  3. Registrar decisão no `README.md` (se mantiver TS) ou abrir um novo item descrevendo o plano de migração.

## 6. Implantar deep-searcher + GPTCache
- 📌 Objetivo: ativar camadas de busca incremental + cache sem reduzir segurança.
- ✅ Passos sugeridos:
  1. Revisar backend vetorial (agora garantido via `fazai vector validate`).
  2. Mapear APIs de deep-searcher e GPTCache (versões, autenticação, limites).
  3. Definir fluxo: consulta → cache → fallback (Context7/web).
  4. Implementar adaptadores MCP em `src/mcp/` com feature flag (`FAZAI_ENABLE_CACHE`?).
  5. Criar testes de fumaça em `tests/` validando cache hit e fallback.

## 7. Integração FazAI ↔ gemma3-cpp
- 📌 Objetivo: reaproveitar runner `gemma3-cpp` evoluindo suporte local (llama.cpp).
- ✅ Passos sugeridos:
  1. Compilar binário `gemma3-cpp` (acompanhar build atual do usuário).
  2. Criar wrapper em `src/models.ts` adicionando provider `gemma` com config.
  3. Implementar executor local que chama CLI do `gemma3-cpp` usando streams.
  4. Ajustar prompts em `linux-admin.ts` para lidar com possíveis diferenças de saída.
  5. Registrar instruções na documentação (`README.md` e `fazai.conf.example`).

## 8. Front-end moderno + APIs/tools
- 📌 Objetivo: planejar UI web e superfície de APIs.
- ✅ Passos sugeridos:
  1. Catalogar artefatos em `~/fazai/www` e `~/fazai/tools`.
  2. Esboçar arquitetura: API gateway (Node/Express?) + frontend (Next.js/Svelte?).
  3. Priorizar features: painel de sessões, histórico, execução remota.
  4. Criar RFC curta no `context/` com roadmap e milestones.

## 9. Itens herdados
- 📌 Objetivo: padronizar comportamento em instalações existentes.
- ✅ Passos sugeridos:
  1. Adicionar prompt explícito antes de instalar pacotes externos (verificar CLI).
  2. Revisitar recurso “continue” do Claude; decidir se permanece ou substitui por pipeline atual.
  3. Abrir issues separadas se alguma alteração exigir refactor amplo.
