#!/usr/bin/env python3
"""
Cliente CLI FazAI - Interface de linha de comando para o FazAI Worker
Envia ordens em linguagem natural e executa o fluxo completo
"""

import asyncio
import json
import socket
import sys
import uuid
import argparse
from typing import Dict, Any

class FazAIClient:
    """Cliente CLI para interagir com o FazAI Worker"""

    def __init__(self, socket_path: str = "/run/fazai/gemma.sock", host: str = "127.0.0.1", port: int = 5558):
        self.socket_path = socket_path
        self.host = host
        self.port = port
        self.sock = None
        self.use_tcp = False

    def connect(self):
        """Conecta ao socket do worker"""
        try:
            if self.use_tcp:
                self.sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
                self.sock.connect((self.host, self.port))
                print(f"✅ Conectado via TCP: {self.host}:{self.port}")
            else:
                self.sock = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
                self.sock.connect(self.socket_path)
                print(f"✅ Conectado via socket: {self.socket_path}")
            return True
        except Exception as e:
            if self.use_tcp:
                print(f"❌ Erro conectando via TCP {self.host}:{self.port}: {e}")
                print(f"💡 Certifique-se de que o worker está rodando na porta {self.port}")
            else:
                print(f"❌ Erro conectando ao socket {self.socket_path}: {e}")
                print(f"💡 Certifique-se de que o worker está rodando no socket {self.socket_path}")
            return False

    def send_order(self, order: str) -> Dict[str, Any]:
        """Envia ordem em linguagem natural para o worker"""
        if not self.sock:
            raise RuntimeError("Não conectado ao worker")

        action_id = str(uuid.uuid4())

        # Determinar ação baseada na ordem
        order_lower = order.lower()

        if any(word in order_lower for word in ["pergunta", "como", "o que", "qual", "quem"]):
            action = "ask"
        elif any(word in order_lower for word in ["pesquisa", "pesquise", "procure", "busque"]):
            action = "research"
        elif any(word in order_lower for word in ["execute", "rode", "comando", "shell"]):
            action = "shell"
        elif any(word in order_lower for word in ["observe", "status", "verifique"]):
            action = "observe"
        elif any(word in order_lower for word in ["planeje", "plano", "estratégia"]):
            action = "plan"
        elif any(word in order_lower for word in ["armazene", "salve", "registre"]):
            action = "commitkb"
        else:
            action = "ask"  # Default para perguntas gerais

        message = {
            "action": action,
            "action_id": action_id,
            "input": order
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

            return response

        except Exception as e:
            return {"error": str(e)}

    def close(self):
        """Fecha conexão"""
        if self.sock:
            self.sock.close()

def main():
    """Interface CLI principal"""
    parser = argparse.ArgumentParser(description='Cliente CLI para FazAI Worker')
    parser.add_argument('--socket', default='/run/fazai/gemma.sock',
                       help='Caminho do socket Unix (padrão: /run/fazai/gemma.sock)')
    parser.add_argument('--host', default='127.0.0.1',
                       help='Host TCP (padrão: 127.0.0.1)')
    parser.add_argument('--port', type=int, default=5558,
                       help='Porta TCP (padrão: 5558)')
    parser.add_argument('--tcp', action='store_true',
                       help='Usar conexão TCP ao invés de socket Unix')

    args = parser.parse_args()

    print("🤖 FazAI Worker - Cliente CLI")
    print("=" * 50)
    print(f"Socket: {args.socket}")
    print(f"TCP: {args.host}:{args.port}")
    print("=" * 50)
    print("Digite suas ordens em linguagem natural.")
    print("Exemplos:")
    print("  - 'Como você está hoje?'")
    print("  - 'Pesquise sobre inteligência artificial'")
    print("  - 'Execute echo FazAI funcionando'")
    print("  - 'Verifique o status do sistema'")
    print("  - 'Digite exit para sair'")
    print("=" * 50)

    if args.tcp:
        client = FazAIClient(host=args.host, port=args.port)
        client.use_tcp = True
    else:
        client = FazAIClient(socket_path=args.socket)

    if not client.connect():
        sys.exit(1)

    try:
        while True:
            try:
                order = input("\n📝 Sua ordem: ").strip()

                if not order:
                    continue

                if order.lower() in ['exit', 'quit', 'sair']:
                    print("👋 Até logo!")
                    break

                print(f"\n🔄 Processando: {order}")
                print("-" * 50)

                response = client.send_order(order)

                if "error" in response:
                    print(f"❌ Erro: {response['error']}")
                else:
                    result = response.get('result', 'Sem resposta')
                    source = response.get('source', 'desconhecido')
                    model = response.get('model', 'desconhecido')

                    print(f"✅ Resposta ({source}/{model}):")
                    print(f"{result}")

                    # Se foi uma ação shell, mostrar se foi bem-sucedida
                    if response.get('action') == 'shell':
                        if 'erro' in result.lower() or 'error' in result.lower():
                            print("⚠️  Comando pode ter falhado")
                        else:
                            print("✅ Comando executado com sucesso")

            except KeyboardInterrupt:
                print("\n\n👋 Até logo!")
                break
            except Exception as e:
                print(f"❌ Erro: {e}")

    finally:
        client.close()

if __name__ == "__main__":
    main()
