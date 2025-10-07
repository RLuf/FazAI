#!/usr/bin/env python3
"""Compatibilidade: encaminha para fazai_mcp_client"""

import asyncio
import sys
from pathlib import Path

# Garante que o diretório atual esteja no sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent))

from fazai_mcp_client import main as mcp_main  # type: ignore

if __name__ == "__main__":
    try:
        sys.exit(asyncio.run(mcp_main()))
    except KeyboardInterrupt:
        sys.exit(130)
