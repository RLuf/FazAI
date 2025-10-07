#!/usr/bin/env python3

import sys
import os
import json
import traceback
import signal
import configparser
from pathlib import Path

# Garante que o binding instalado no sistema seja encontrado primeiro
sys.path.insert(0, "/opt/fazai/lib/python")
sys.path.insert(0, "/opt/fazai/lib")
sys.path.insert(0, os.getcwd())

# Timeout por segurança
def alarm_handler(signum, frame):
    sys.stderr.write("TIMEOUT\n")
    sys.exit(1)

signal.signal(signal.SIGALRM, alarm_handler)
# Timeout mais generoso para carga do modelo e geração
signal.alarm(180)

DEFAULT_CONFIG_PATHS = [
    "/etc/fazai/fazai.conf",
    "/opt/fazai/etc/fazai.conf",
]

def load_config():
    parser = configparser.ConfigParser()
    for cfg in DEFAULT_CONFIG_PATHS:
        cfg_path = Path(cfg)
        if cfg_path.exists():
            parser.read(cfg)
            return parser
    return parser

def get_cfg_value(parser, section, option, fallback=None, cast=None):
    if not parser.has_section(section):
        return fallback
    if cast is int:
        return parser.getint(section, option, fallback=fallback)
    if cast is float:
        return parser.getfloat(section, option, fallback=fallback)
    if cast is bool:
        return parser.getboolean(section, option, fallback=fallback)
    return parser.get(section, option, fallback=fallback)

try:
    # Lê entrada
    line = sys.stdin.readline()
    if not line:
        sys.stderr.write("Sem entrada\n")
        sys.exit(1)

    data = json.loads(line.strip())
    prompt = data["prompt"]

    parser = load_config()

    weights = os.environ.get("FAZAI_GEMMA_WEIGHTS") or get_cfg_value(parser, "gemma_cpp", "weights", fallback="/opt/fazai/models/gemma/2.0-2b-it-sfp.sbs")
    tokenizer = os.environ.get("FAZAI_GEMMA_TOKENIZER") or get_cfg_value(parser, "gemma_cpp", "tokenizer", fallback="")
    max_tokens = int(os.environ.get("FAZAI_GEMMA_MAX_TOKENS") or get_cfg_value(parser, "gemma_cpp", "max_tokens", fallback=512, cast=int))
    temperature = float(os.environ.get("FAZAI_GEMMA_TEMPERATURE") or get_cfg_value(parser, "gemma_cpp", "temperature", fallback=0.2, cast=float))
    top_k = int(os.environ.get("FAZAI_GEMMA_TOP_K") or get_cfg_value(parser, "gemma_cpp", "top_k", fallback=1, cast=int))
    deterministic_cfg = get_cfg_value(parser, "gemma_cpp", "deterministic", fallback=True, cast=bool)
    deterministic_env = os.environ.get("FAZAI_GEMMA_DETERMINISTIC")
    deterministic = deterministic_env.lower() in {"1", "true", "yes", "on"} if deterministic_env is not None else deterministic_cfg
    multiturn_cfg = get_cfg_value(parser, "gemma_cpp", "multiturn", fallback=False, cast=bool)
    multiturn_env = os.environ.get("FAZAI_GEMMA_MULTITURN")
    multiturn = multiturn_env.lower() in {"1", "true", "yes", "on"} if multiturn_env is not None else multiturn_cfg
    prefill_tbatch = int(os.environ.get("FAZAI_GEMMA_PREFILL_TBATCH") or get_cfg_value(parser, "gemma_cpp", "prefill_tbatch", fallback=256, cast=int))

    native_enabled_cfg = get_cfg_value(parser, "gemma_cpp", "enable_native", fallback=True, cast=bool)
    native_env = os.environ.get("FAZAI_GEMMA_ENABLE_NATIVE")
    native_enabled = native_env.lower() in {"1", "true", "yes", "on"} if native_env is not None else native_enabled_cfg

    try:
        if not native_enabled:
            raise RuntimeError("Gemma Native desativado via configuração")

        import gemma_native
        model = gemma_native.GemmaNative()
        model.initialize(
            weights,
            tokenizer,
            max_tokens,
            temperature,
            top_k,
            deterministic,
            multiturn,
            prefill_tbatch
        )
        output = model.generate(prompt, max_tokens)
        if not output:
            raise RuntimeError("Resposta vazia do Gemma Native")
        print(output.strip(), flush=True)
        sys.exit(0)

    except Exception as e:
        sys.stderr.write(f"Erro Gemma: {str(e)}\n")
        sys.stderr.write(traceback.format_exc())
        sys.exit(1)

except Exception as e:
    sys.stderr.write(f"Erro geral: {str(e)}\n")
    sys.exit(1)
