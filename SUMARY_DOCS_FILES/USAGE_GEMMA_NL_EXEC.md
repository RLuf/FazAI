# FazAI Gemma NL->Exec Usage

Este documento descreve como usar o `fazai-gemma-worker` para enviar comandos em linguagem natural para o Gemma e, quando o modelo gerar uma ação JSON de tipo `shell`, o worker possa executar comandos no host (apenas para ambientes de teste).

Pré-requisitos
- Ter o worker compilado e instalado: `/opt/fazai/bin/fazai-gemma-worker`
- Ter Qdrant rodando em `http://127.0.0.1:6333` (opcional, usado para contexto/memória)
- Habilitar execução de comandos apenas para testes: `export FAZAI_ALLOW_SHELL_EXEC=1`

Iniciar worker (exemplo):

```bash
sudo FAZAI_ALLOW_SHELL_EXEC=1 /opt/fazai/bin/fazai-gemma-worker &
```

Exemplo de uso (cliente REPL ou ND-JSON):

- Enviar `create_session` e guardar `session_id` retornado.
- Enviar `generate` com `prompt` em português, por exemplo:

```json
{"type":"generate", "session_id":"<sess>", "prompt":"Crie um script em bash chamado conta.sh que conte até 10"}
```

Com a configuração correta, o modelo pode responder com uma linha ND-JSON como:

```json
{"type":"shell", "command":"cat > conta.sh <<'EOF'\n#!/bin/bash\nfor i in {1..10}; do echo $i; done\nEOF && chmod +x conta.sh"}
```

O worker irá: parsear esse objeto, validar whitelist e executar o comando via `timeout 30s bash -lc '...')`, então streamar a saída e o código de retorno.

Riscos e recomendações
- Não habilite `FAZAI_ALLOW_SHELL_EXEC` em produção sem controles adicionais (auth, lista branca robusta, execução em container isolado ou usuário com poucos privilégios).
- Considere exigir uma aprovação humana para ações que afetam o sistema.
