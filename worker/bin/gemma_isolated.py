#!/usr/bin/env python3

import sys
import json
import traceback
import signal
import os

# Timeout por segurança
def alarm_handler(signum, frame):
    sys.stderr.write("TIMEOUT\n")
    sys.exit(1)

signal.signal(signal.SIGALRM, alarm_handler)
signal.alarm(60)  # 60s timeout (Gemma pode ser lento)

try:
    # Lê entrada
    line = sys.stdin.readline()
    if not line:
        sys.stderr.write("Sem entrada\n")
        sys.exit(1)

    data = json.loads(line.strip())
    prompt = data["prompt"]
    # Nota: max_tokens é ignorado pois Gemma Native não aceita parâmetro

    # Tenta importar e usar Gemma nativo
    try:
        import importlib
        gemma_native = importlib.import_module("gemma_native")
        model = gemma_native.GemmaNative()

        # Tenta gerar (apenas prompt, sem max_tokens)
        result = model.generate(prompt)

        # Verifica se resultado parece válido
        if not result or len(result.strip()) == 0:
            raise RuntimeError("Resposta vazia do Gemma native")

        # Escreve resultado
        print(result, flush=True)
        sys.exit(0)

    except Exception as e:
        sys.stderr.write(f"Erro Gemma: {str(e)}\n")
        sys.stderr.write(traceback.format_exc())
        sys.exit(1)

except Exception as e:
    sys.stderr.write(f"Erro geral: {str(e)}\n")
    sys.exit(1)
