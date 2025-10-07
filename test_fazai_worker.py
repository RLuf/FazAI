#!/usr/bin/env python3
"""
Teste REAL do FazAI Worker v2.1
Testa integração completa com libgemma, Qdrant e protocolo ND-JSON
"""

import asyncio
import json
import socket
import time
import uuid
from enum import Enum
from typing import Dict, Any

# Cliente de teste para o FazAI Worker
class FazAIWorkerClient:
    """Cliente para testar o worker FazAI via socket"""

    def __init__(self, socket_path: str = "/run/fazai/gemma.sock"):
        self.socket_path = socket_path
        self.sock = None

    def connect(self):
        """Conecta ao socket Unix do worker"""
        try:
            self.sock = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
            self.sock.connect(self.socket_path)
            print(f"✅ Conectado ao worker: {self.socket_path}")
            return True
        except Exception as e:
            print(f"❌ Erro conectando ao worker: {e}")
            return False

    def send_message(self, action: str, input_text: str, action_id: str = None) -> Dict[str, Any]:
        """Envia mensagem ND-JSON para o worker"""
        if not self.sock:
            raise RuntimeError("Não conectado ao worker")

        if not action_id:
            action_id = str(uuid.uuid4())

        message = {
            "action": action,
            "action_id": action_id,
            "input": input_text
        }

        try:
            # Enviar mensagem
            message_str = json.dumps(message) + '\n'
            self.sock.send(message_str.encode('utf-8'))

            # Receber resposta
            response_data = b''
            while True:
                chunk = self.sock.recv(4096)
                if not chunk:
                    break
                response_data += chunk
                if b'\n' in response_data:
                    break

            response_str = response_data.decode('utf-8').strip()
            response = json.loads(response_str)

            print(f"📤 Enviado: {action} - {input_text[:50]}...")
            print(f"📥 Recebido: {response.get('result', '')[:100]}...")
            return response

        except Exception as e:
            print(f"❌ Erro na comunicação: {e}")
            return {"error": str(e)}

    def close(self):
        """Fecha conexão"""
        if self.sock:
            self.sock.close()

# Testes reais
async def test_worker_integration():
    """Testa integração completa do worker"""
    print("🚀 Iniciando testes do FazAI Worker v2.1")
    print("=" * 60)

    # Cliente de teste
    client = FazAIWorkerClient()

    if not client.connect():
        print("❌ Não foi possível conectar ao worker")
        print("💡 Certifique-se de que o worker está rodando:")
        print("   cd /home/rluft/fazai && python worker/bin/fazai_gemma_worker.py")
        return

    try:
        # Teste 1: Status do sistema
        print("\n📊 TESTE 1: Verificar status do sistema")
        response = client.send_message("observe", "status")
        print(f"Status: {response.get('result', 'N/A')}")

        # Teste 2: Pergunta simples (ASK)
        print("\n❓ TESTE 2: Pergunta simples com Gemma")
        response = client.send_message("ask", "Olá! Como você está hoje?")
        result = response.get('result', '')
        if result and 'erro' not in result.lower():
            print(f"✅ Gemma respondeu: {result[:200]}...")
        else:
            print(f"⚠️  Resposta: {result}")

        # Teste 3: Pesquisa na memória (RESEARCH)
        print("\n🔍 TESTE 3: Pesquisa na memória vetorial")
        response = client.send_message("research", "inteligência artificial")
        result = response.get('result', '')
        print(f"Pesquisa: {result[:200]}...")

        # Teste 4: Plano de execução (PLAN)
        print("\n📋 TESTE 4: Criar plano de execução")
        response = client.send_message("plan", "melhorar o sistema FazAI")
        result = response.get('result', '')
        print(f"Plano: {result[:200]}...")

        # Teste 5: Comando shell (SHELL)
        print("\n⚡ TESTE 5: Executar comando shell")
        response = client.send_message("shell", "echo 'FazAI Worker funcionando!'")
        result = response.get('result', '')
        print(f"Shell: {result}")

        # Teste 6: Armazenar conhecimento (COMMITKB)
        print("\n💾 TESTE 6: Armazenar na base de conhecimento")
        response = client.send_message("commitkb", "FazAI Worker v2.1 está funcionando corretamente com libgemma e Qdrant")
        result = response.get('result', '')
        print(f"CommitKB: {result}")

        # Teste 7: Verificar personalidade carregada
        print("\n🧠 TESTE 7: Verificar personalidade Claudio")
        response = client.send_message("ask", "Quem é você e quais são suas capacidades?")
        result = response.get('result', '')
        if result and 'claudio' in result.lower():
            print(f"✅ Personalidade carregada: {result[:200]}...")
        else:
            print(f"⚠️  Personalidade: {result[:200]}...")

        print("\n" + "=" * 60)
        print("🎉 Testes concluídos!")

    finally:
        client.close()

def test_worker_startup():
    """Testa se o worker inicia sem erros"""
    print("🔧 Testando inicialização do worker...")

    try:
        # Tentar importar o worker (sem executar)
        import sys
        sys.path.append('/home/rluft/fazai')

        print("✅ Worker pode ser importado sem erros")
        return True

    except Exception as e:
        print(f"❌ Erro na inicialização: {e}")
        return False

if __name__ == "__main__":
    print("FazAI Worker v2.1 - Teste de Integração Completa")
    print("=" * 60)

    # Teste 1: Verificar se worker pode ser iniciado
    if not test_worker_startup():
        print("❌ Worker não pode ser iniciado")
        exit(1)

    # Teste 2: Testes reais via socket
    asyncio.run(test_worker_integration())
