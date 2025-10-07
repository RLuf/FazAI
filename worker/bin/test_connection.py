#!/usr/bin/env python3
"""
Teste de conectividade para FazAI Gemma Worker
"""

import asyncio
import sys
import os
# Garante que o diretório atual está no sys.path para import local
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pathlib import Path
from fazai_mcp_client import FazaiClient, load_worker_config, resolve_worker_defaults

async def test_connection():
    """Testa conexão com o worker"""
    print("🔍 Testando conectividade com FazAI Gemma Worker...")
    
    cfg_parser, _ = load_worker_config()
    defaults = resolve_worker_defaults(cfg_parser)

    socket_path = defaults["unix_socket"]
    if Path(socket_path).exists():
        print(f"✅ Socket Unix encontrado: {socket_path}")
    else:
        print(f"❌ Socket Unix não encontrado: {socket_path}")
        print(f"   Verificando fallback TCP {defaults['tcp_host']}:{defaults['tcp_port']}...")
    
    # Testar conexão
    client = FazaiClient(
        socket_path=defaults["unix_socket"],
        tcp_host=defaults["tcp_host"],
        tcp_port=defaults["tcp_port"],
        timeout=defaults["timeout"],
    )
    connected = await client.connect()
    
    if connected:
        print("✅ Conexão estabelecida!")
        
        # Testar ação simples
        print("🧪 Testando ação ASK...")
        result = await client.ask("Olá, teste de conexão")
        if result:
            print(f"✅ Resposta recebida: {result[:100]}...")
        else:
            print("❌ Sem resposta da ação ASK")
            
        await client.disconnect()
        return True
    else:
        print("❌ Falha na conexão")
        print("\n🔧 Possíveis soluções:")
        print("1. Verificar se worker está rodando: sudo systemctl status fazai-gemma-worker")
        print("2. Verificar logs: journalctl -u fazai-gemma-worker -n 20")
        print("3. Verificar permissões do socket: ls -la /run/fazai/")
        print("4. Se usando TCP, verificar porta 5555: netstat -tlnp | grep 5555")
        return False

if __name__ == "__main__":
    success = asyncio.run(test_connection())
    sys.exit(0 if success else 1)
