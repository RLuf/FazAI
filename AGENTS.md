Propósito
Este documento define as regras técnicas e operacionais para implementação, integração e manutenção de agentes no FazAI. Serve como contrato para desenvolvedores e como referência para garantir consistência e interoperabilidade entre agentes, handlers e providers.

📚 Conceitos básicos
Agente – Serviço/processo que executa tarefas sob comando do FazAI, podendo ser local ou remoto.

Handler – Módulo no daemon que interpreta ações do modelo e chama o(s) agente(s).

Provider – Adaptador que intermedia a comunicação entre handler e agente, encapsulando protocolo e transporte.

🔄 Ciclo de vida do agente
Registro – Handler reconhece e registra o agente conforme SPEC.

Handshake – Troca inicial de credenciais, versão, capacidades e status.

Execução – Recebe comando no formato acordado, processa e retorna saída.

Observação – FazAI analisa saída, registra no KB e decide próxima ação.

Encerramento – Sessão finalizada ou persistida para reuso.

📜 Contratos e formatos
1. Mensagens de socket (worker local)
Protocolo: ND‑JSON, 1 objeto por linha.

Métodos:

create_session → { "method": "create_session", "params": {...} }

generate / generate_stream

abort

close_session

Campos obrigatórios: id, method, params, timestamp.

2. SSE (daemon ⇄ CLI/UI)
Eventos padronizados:

token – Token de texto gerado.

action – Objeto de ação emitido pelo modelo (plan, shell, use_tool, etc.).

log – Log textual.

observe – Observação retornada após ação.

done – Encerramento da iteração.

3. Southbound (agentes remotos)
Método hello: anuncia agente e versão.

Comandos: command.exec, telemetry.push, file.diff/apply.

Transporte: WS/mTLS ou HTTP/REST assinado.

Formato: JSON com action_id idempotente.

⚠️ Regras obrigatórias para todos os agentes
1 ação por iteração – Evita concorrência indesejada e facilita debug.

Validação estrita – Rejeitar payloads fora do SPEC.

Idempotência – Repetir action_id não pode causar efeitos duplicados.

Timeouts – Definir limite por operação.

Segurança – Respeitar mTLS para agentes remotos; isolar permissões no SO.

✅ Critérios de aceitação (DoD)
SPEC.md versionado no repositório.

Passar testes unitários e de contrato.

Integrar em ambiente de staging com sucesso.

Documentar no AGENTS.md: nome, função, protocolo, endpoints, formatos suportados.

📌 Boas práticas
Logs estruturados (JSON) com agent_id, session_id e timestamp.

Monitoramento ativo via /metrics Prometheus.

Fallback seguro em caso de falha de rede ou timeout.

Testes de carga para validar estabilidade sob uso intensivo.

📝 Preencha abaixo para cada agente implementado:

Nome do Agente	Tipo	Função	Protocolo	Endpoints/Rota	Observações
…	…	…	…	…	…
