#!/usr/bin/env bash
set -euo pipefail

SOCK=/run/fazai/gemma.sock
if [ ! -S "$SOCK" ]; then
  echo "Socket $SOCK não encontrado. Inicie o worker antes de rodar este teste." >&2
  exit 2
fi

# Criar sessão
RESP=$(printf '%s\n' '{"type":"create_session"}' | nc -U $SOCK)
SID=$(echo "$RESP" | jq -r '.session_id')
echo "session_id=$SID"

# Enviar generate pedindo a criação do script
PROMPT='Crie um script em bash chamado conta.sh que conte até 10'
GENREQ=$(jq -n --arg sid "$SID" --arg prompt "$PROMPT" '{type:"generate", session_id:$sid, prompt:$prompt}')
printf '%s\n' "$GENREQ" | nc -U $SOCK > /tmp/fazai_gen_resp.ndjson

# Esperar saída e checar se conta.sh foi criado
if [ -f conta.sh ]; then
  echo "Arquivo conta.sh criado com sucesso"
  echo "--- conteudo ---"
  cat conta.sh
  rm -f conta.sh
  exit 0
else
  echo "Arquivo conta.sh não encontrado. Verifique a saída em /tmp/fazai_gen_resp.ndjson" >&2
  exit 1
fi
