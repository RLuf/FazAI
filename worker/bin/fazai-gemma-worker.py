#!/usr/bin/env python3
"""Compat wrapper para manter o nome histórico fazai-gemma-worker."""
from pathlib import Path
import runpy

if __name__ == "__main__":
    target = Path(__file__).with_name("fazai_gemma_worker.py")
    runpy.run_path(str(target), run_name="__main__")
