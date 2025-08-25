Propósito
Define o SPEC técnico para agentes, handlers e providers do FazAI — formatos de mensagem, transportes, regras obrigatórias e critérios de aceitação. Este documento é vinculante para implementação e testes de contrato.

Versão do SPEC: v1.0 (compatível com FazAI v2.0)

Escopo e Termos
- Agente: Processo que executa comandos/rotinas sob orquestração do FazAI (local ou remoto).
- Handler: Módulo no daemon que interpreta ações do modelo e orquestra agentes/providers.
- Provider: Adaptador que encapsula protocolo/transporte para conversar com um worker/serviço.

Visão Geral do Ciclo de Vida
- Registro: Handler reconhece e registra agente conforme SPEC.
- Handshake: Troca inicial de credenciais, versão, capacidades e status.
- Execução: Recebe comando no formato acordado, processa e retorna saída/telemetria.
- Observação: FazAI analisa a saída, registra no KB e decide próxima ação.
- Encerramento: Sessão finalizada ou persistida para reuso.

1) Worker Local (Socket ND‑JSON)
- Transporte: Unix Domain Socket (padrão: `/run/fazai/gemma.sock`).
- Framing: ND‑JSON (um objeto por linha). Sem buffers binários.
- Codificação: UTF‑8.

Mensagens de Requisição
- create_session: `{ "type": "create_session", "params": { ... } }`
- generate (stream): `{ "type": "generate", "session_id": "<sid>", "prompt": "...", "stream": true }`
- abort: `{ "type": "abort", "session_id": "<sid>" }`
- close_session: `{ "type": "close_session", "session_id": "<sid>" }`
- status: `{ "type": "status" }`

Respostas/Eventos do Worker
- Resposta simples: `{ "ok": true, ... }` ou `{ "ok": false, "error": "..." }`
- Stream de geração: ND‑JSON com eventos JSON ou linhas de token textual.
  - Token: `{ "type": "token", "text": "..." }` ou linha de texto puro (provider converte para token).
  - Término: `{ "type": "stop" }`
  - Erro: `{ "type": "error", "message": "..." }`

Campos Obrigatórios
- create_session: `type`, `params` (objeto).
- generate: `type`, `session_id`, `prompt`.
- abort/close_session: `type`, `session_id`.

Validação e Erros
- Requisições inválidas devem resultar em `{ ok: false, error }` ou evento `error` no stream.
- Timeout por operação recomendado: 30s–120s (config dependente).

2) SSE (Daemon ⇄ CLI/UI)
- Transporte: HTTP/1.1 SSE (`Content-Type: text/event-stream`).
- Endpoints principais:
  - `POST /agent/sessions` → `{ ok: true, session_id }`
  - `POST /agent/generate` → stream SSE
  - `POST /agent/abort` → `{ ok: true }`
  - `GET /agent/status` → `{ ok: true, ... }`

Eventos Padronizados
- token: `{ "type": "token", "text": "..." }`
- action: `{ "type": "action", "action": "plan|shell|research|tool_spec|use_tool", ... }`
- plan: `{ "type": "plan", "steps": ["..."] }`
- ask: `{ "type": "ask", "question": "...", "options": ["..."] }`
- exec_log: `{ "type": "exec_log", "stream": "stdout|stderr", "chunk": "..." }`
- research_result: `{ "type": "research_result", "docs": [ {"title":"...","url":"..."} ] }`
- observe: `{ "type": "observe", "note": "..." }`
- done: `{ "type": "done", "result": any }`
- error: `{ "type": "error", "message": "..." }`

Regra: 1 ação por iteração
- O handler garante que cada iteração do agente execute no máximo uma ação que cause efeitos (ex.: shell, use_tool). Isso simplifica auditoria e depuração.

3) Southbound (Agentes Remotos)
- Transporte: WebSocket com mTLS ou HTTP/REST assinado (HMAC). Sempre com `action_id` idempotente.

Handshake `hello`
Request: `{ "method": "hello", "agent_id": "<id>", "name": "...", "version": "x.y.z", "capabilities": ["command.exec","telemetry.push","file.diff","file.apply"], "timestamp": "ISO-8601" }`
Response: `{ "ok": true, "policy": { "timeouts": {"exec": 120000}, "max_payload": 1048576 } }`

Comandos Padronizados
- command.exec: `{ "method": "command.exec", "action_id": "uuid", "command": "...", "args": ["..."], "timeout": 120000, "cwd": "/" }`
  - Resposta: `{ "ok": true, "exit_code": 0, "stdout": "...", "stderr": "..." }`
- telemetry.push: `{ "method": "telemetry.push", "action_id": "uuid", "payload": { ... }, "ts": "ISO-8601" }`
  - Resposta: `{ "ok": true }`
- file.diff: `{ "method": "file.diff", "action_id": "uuid", "path": "/etc/x", "want": "...conteúdo...") }`
  - Resposta: `{ "ok": true, "patch": "...unified diff..." }`
- file.apply: `{ "method": "file.apply", "action_id": "uuid", "path": "/etc/x", "patch": "...unified diff..." }`
  - Resposta: `{ "ok": true, "applied": true }`

Idempotência
- O `action_id` deve ser único por ação. Repetir o mesmo `action_id` não pode causar efeitos duplicados; retornar o mesmo resultado ou estado.

Segurança
- mTLS obrigatório para WS; para HTTP/REST, assinar com HMAC (chaves rotacionáveis) e timestamps/nonce.
- Isolamento por SO (usuário dedicado, permissões mínimas, diretórios com 0700, secrets 0600).
- Whitelist de comandos para `command.exec` e política de timeout/uso de recursos.

Observabilidade
- Logs estruturados (JSON) com `agent_id`, `session_id`, `action_id`, `timestamp`.
- Expor métricas Prometheus em `/metrics` (daemon), incluindo ingestões e status de integrações.

Critérios de Aceitação (DoD)
- SPEC.md versionado neste repositório.
- Handlers e providers implementados conforme SPEC e passando testes de contrato.
- Integração em staging validada (SSE funcional; worker disponível ou fallback documentado).
- Documentação no AGENTS.md com nome, função, protocolo, endpoints e formatos suportados.

Anexos
Exemplos
- Requisição generate (worker): `{"type":"generate","session_id":"abc","prompt":"...","stream":true}`
- Evento SSE de shell: `{"type":"action","action":"shell","command":"uname -a"}` seguido por `exec_log` e `done`.

Notas de Compatibilidade
- Algumas versões iniciais do worker aceitam `type` em vez de `method` e não exigem `id/timestamp`. O provider oficial (`opt/fazai/lib/providers/gemma-worker.js`) já implementa essa variação. Este SPEC v1.0 documenta o formato vigente no código atual; futuras versões poderão convergir para `{id, method, params, timestamp}` em todos os canais.

