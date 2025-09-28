#!/usr/bin/env python3
"""
fazai-mcp-client - Cliente funcional para worker
"""

import asyncio
import json
import sys
import uuid
from pathlib import Path
from dataclasses import dataclass
from enum import Enum

class NDJSONAction(Enum):
    ASK = "ask"
    SHELL = "shell"
    OBSERVE = "observe"

@dataclass
class NDJSONMessage:
    action: NDJSONAction
    action_id: str
    input: str
    result: str = None
    
    def to_ndjson(self) -> str:
        data = {
            'action': self.action.value,
            'action_id': self.action_id,
            'input': self.input,
            'result': self.result
        }
        return json.dumps(data, ensure_ascii=False)
    
    @classmethod
    def from_ndjson(cls, line: str):
        data = json.loads(line)
        data['action'] = NDJSONAction(data['action'])
        return cls(**data)

class FazaiClient:
    def __init__(self, socket_path="/run/fazai/gemma.sock"):
        self.socket_path = socket_path
        self.reader = None
        self.writer = None
    
    async def connect(self):
        try:
            if Path(self.socket_path).exists():
                self.reader, self.writer = await asyncio.open_unix_connection(self.socket_path)
            else:
                self.reader, self.writer = await asyncio.open_connection("0.0.0.0", 5555)
            return True
        except Exception as e:
            print(f"❌ Erro conectando: {e}")
            return False
    
    async def send_action(self, action: NDJSONAction, input_text: str):
        message = NDJSONMessage(
            action=action,
            action_id=str(uuid.uuid4()),
            input=input_text
        )
        
        data = message.to_ndjson() + '\n'
        self.writer.write(data.encode('utf-8'))
        await self.writer.drain()
        
        response_line = await self.reader.readline()
        response = NDJSONMessage.from_ndjson(response_line.decode('utf-8').strip())
        return response.result
    
    async def disconnect(self):
        if self.writer:
            self.writer.close()
            await self.writer.wait_closed()

async def main():
    if len(sys.argv) < 3:
        print("Uso: fazai <ação> <texto>")
        print("Ações: ask, shell, observe")
        return 1
    
    action = sys.argv[1].lower()
    text = " ".join(sys.argv[2:])
    
    client = FazaiClient()
    if not await client.connect():
        return 1
    
    try:
        if action == "ask":
            result = await client.send_action(NDJSONAction.ASK, text)
        elif action == "shell":
            result = await client.send_action(NDJSONAction.SHELL, text)
        elif action == "observe":
            result = await client.send_action(NDJSONAction.OBSERVE, text)
        else:
            print(f"❌ Ação desconhecida: {action}")
            return 1
        
        print(result)
        return 0
    finally:
        await client.disconnect()

if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
            
        except Exception as e:
            print(f"✗ Erro: {e}")
            return None
    
    async def ask(self, question: str) -> Optional[str]:
        """Ação ASK - pergunta ao modelo"""
        response = await self.send_action(NDJSONAction.ASK, question)
        return response.result if response else None
    
    async def research(self, topic: str) -> Optional[str]:
        """Ação RESEARCH - pesquisa com fallbacks"""
        response = await self.send_action(NDJSONAction.RESEARCH, topic)
        return response.result if response else None
    
    async def shell(self, command: str) -> Optional[str]:
        """Ação SHELL - executa comando"""
        response = await self.send_action(NDJSONAction.SHELL, command)
        return response.result if response else None
    
    async def plan(self, objective: str) -> Optional[str]:
        """Ação PLAN - cria plano"""
        response = await self.send_action(NDJSONAction.PLAN, objective)
        return response.result if response else None
    
    async def observe(self, target: str) -> Optional[str]:
        """Ação OBSERVE - observa sistema"""
        response = await self.send_action(NDJSONAction.OBSERVE, target)
        return response.result if response else None
    
    async def commitkb(self, knowledge: str) -> Optional[str]:
        """Ação COMMITKB - armazena conhecimento"""
        response = await self.send_action(NDJSONAction.COMMITKB, knowledge)
        return response.result if response else None
    
    async def disconnect(self):
        """Desconecta do worker"""
        if self.writer:
            self.writer.close()
            await self.writer.wait_closed()
        self.connected = False

# ===== CLI INTEGRADO E SHELL INTERATIVO =====
class FazaiCLI:
    """CLI integrado com /bin/fazai"""
    
    def __init__(self):
        self.client = FazaiNDJSONClient()
    
    async def run_command(self, args: list):
        """Executa comando conforme /bin/fazai"""
        if not await self.client.connect():
            return 1
        
        try:
            action = args[0].lower()
            text = " ".join(args[1:])
            
            if action == "ask":
                result = await self.client.ask(text)
            elif action == "research": 
                result = await self.client.research(text)
            elif action == "shell":
                result = await self.client.shell(text)
            elif action == "plan":
                result = await self.client.plan(text)
            elif action == "observe":
                result = await self.client.observe(text)
            elif action == "commit":
                result = await self.client.commitkb(text)
            else:
                print(f"Ação desconhecida: {action}")
                print("Ações disponíveis: ask, research, shell, plan, observe, commit")
                return 1
            
            if result:
                print(result)
                return 0
            else:
                print("Erro: sem resposta")
                return 1
                
        finally:
            await self.client.disconnect()

class InteractiveShell:
    """Shell interativo melhorado"""
    
    def __init__(self, client: FazaiNDJSONClient):
        self.client = client
        self.running = True
        self.setup_history()
    
    def setup_history(self):
        """Configura histórico de comandos"""
        history_file = Path.home() / ".fazai_history"
        try:
            readline.read_history_file(history_file)
        except FileNotFoundError:
            pass
        
        import atexit
        atexit.register(readline.write_history_file, history_file)
    
    def print_help(self):
        """Mostra ajuda do shell interativo"""
        print("""
╔═══════════════════════════════════════════════════════════╗
║  FazAI Gemma Worker Client v2.0 - Comandos ND-JSON       ║
╠═══════════════════════════════════════════════════════════╣
║  /ask <texto>       - Pergunta ao modelo                  ║
║  /research <tópico> - Pesquisa com fallbacks              ║
║  /shell <comando>   - Executa comando shell               ║
║  /plan <objetivo>   - Cria plano de execução              ║
║  /observe <alvo>    - Observa sistema/status              ║
║  /commit <texto>    - Armazena na base de conhecimento    ║
║  /help              - Mostra esta ajuda                   ║
║  /clear             - Limpa a tela                        ║
║  /exit, /quit       - Sair                                ║
╠═══════════════════════════════════════════════════════════╣
║  Texto sem "/" será tratado como ação ASK                 ║
╚═══════════════════════════════════════════════════════════╝
""")

    async def run(self):
        """Loop principal do shell interativo"""
        if not await self.client.connect():
            print("✗ Não foi possível conectar ao worker")
            return
        
        print("\n=== FazAI Gemma Worker Client v2.0 ===")
        print("Cliente ND-JSON para fazai-gemma-worker")
        print("Digite /help para ver comandos disponíveis\n")

        try:
            while self.running:
                try:
                    line = input("fazai> ").strip()
                except (EOFError, KeyboardInterrupt):
                    print("\nSaindo...")
                    break

                if not line:
                    continue

                await self.process_command(line)

        except Exception as e:
            print(f"Erro fatal: {e}")

        await self.client.disconnect()

    async def process_command(self, line: str):
        """Processa sem validações"""
        if line.startswith("/"):
            parts = line[1:].split(" ", 1)
            cmd = parts[0]
            text = parts[1] if len(parts) > 1 else ""

            # Executa direto baseado no comando
            if cmd == "help":
                self.print_help()
            elif cmd == "ask":
                result = await self.client.ask(text)
                if result: print(result)
            elif cmd == "research":
                result = await self.client.research(text)
                if result: print(result)
            elif cmd == "shell":
                result = await self.client.shell(text)  # Execução direta
                if result: print(result)
            elif cmd == "plan":
                result = await self.client.plan(text)
                if result: print(result)
            elif cmd == "observe":
                result = await self.client.observe(text)
                if result: print(result)
            elif cmd == "commit":
                result = await self.client.commitkb(text)
                if result: print(result)
            elif cmd in ["exit", "quit"]:
                self.running = False
            elif cmd == "clear":
                print("\033[2J\033[H")
            else:
                print(f"Comando desconhecido: /{cmd}")
        else:
            # ASK direto
            result = await self.client.ask(line)
            if result: print(result)
            else: print("✗ Sem resposta")

# ===== MAIN CORRIGIDO =====
async def main():
    """Função principal compatível com arquitetura FazAI"""
    parser = argparse.ArgumentParser(description="Cliente ND-JSON para FazAI Gemma Worker")
    parser.add_argument("-s", "--socket", default="/run/fazai/gemma.sock", 
                       help="Caminho do Unix socket")
    parser.add_argument("action", nargs="?", 
                       help="Ação: ask, research, shell, plan, observe, commit")
    parser.add_argument("text", nargs="*", help="Texto da ação")

    args = parser.parse_args()

    client = FazaiNDJSONClient(socket_path=args.socket)

    if args.action:
        # Modo linha de comando
        cli = FazaiCLI()
        cli.client = client
        return await cli.run_command([args.action] + args.text)
    else:
        # Modo interativo
        shell = InteractiveShell(client)
        await shell.run()
        return 0

if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
    else:
        # Modo interativo
        shell = InteractiveShell(client)
        await shell.run()
        return 0

if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
