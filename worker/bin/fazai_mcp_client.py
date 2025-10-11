#!/usr/bin/env python3
"""
fazai-mcp-client - Cliente ND-JSON para worker FazAI Gemma
Versão limpa e integrada, compatível com arquitetura FazAI v2.0
"""

import argparse
import asyncio
import configparser
import json
import os
import sys
import uuid
import readline
from pathlib import Path
from typing import Optional, Dict, Tuple, Any
from dataclasses import dataclass
from enum import Enum

DEFAULT_CONFIG_PATHS = [
    "/etc/fazai/fazai.conf",
    "/opt/fazai/etc/fazai.conf",
    "./etc/fazai/fazai.conf",
    "./etc/fazai/fazai.conf.example",
]

class NDJSONAction(Enum):
    ASK = "ask"
    RESEARCH = "research"
    SHELL = "shell"
    PLAN = "plan"
    OBSERVE = "observe"
    COMMITKB = "commitKB"
    DONE = "done"

@dataclass
class NDJSONMessage:
    action: NDJSONAction
    action_id: str
    input: str
    result: Optional[str] = None
    
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
        # Map and ignore unknown fields for forward compatibility
        action = NDJSONAction(data.get('action'))
        return cls(
            action=action,
            action_id=data.get('action_id', ''),
            input=data.get('input', ''),
            result=data.get('result')
        )


def load_worker_config(config_path: Optional[str] = None) -> Tuple[configparser.ConfigParser, Optional[Path]]:
    """Locate and load FazAI configuration."""
    parser = configparser.ConfigParser()
    candidates = []
    if config_path:
        candidates.append(Path(config_path))
    else:
        candidates.extend(Path(p) for p in DEFAULT_CONFIG_PATHS)

    used = None
    for candidate in candidates:
        if candidate and candidate.exists():
            try:
                parser.read(candidate.as_posix())
                used = candidate
                break
            except Exception:
                continue
    return parser, used


def resolve_worker_defaults(parser: configparser.ConfigParser) -> Dict[str, Any]:
    """Resolve socket/timeout defaults using config with environment overrides."""
    env = os.environ

    unix_socket = env.get("FAZAI_GEMMA_SOCKET") or parser.get(
        "gemma_worker", "unix_socket", fallback="/run/fazai/gemma.sock"
    )
    tcp_host = env.get("FAZAI_GEMMA_HOST") or parser.get(
        "gemma_worker", "host", fallback="127.0.0.1"
    )
    tcp_port = int(
        env.get("FAZAI_GEMMA_PORT")
        or parser.getint("gemma_worker", "port", fallback=5556)
    )
    timeout = int(
        env.get("FAZAI_GEMMA_TIMEOUT")
        or parser.getint("dispatcher", "timeout_seconds", fallback=30)
    )

    return {
        "unix_socket": unix_socket,
        "tcp_host": tcp_host,
        "tcp_port": tcp_port,
        "timeout": timeout,
    }

class FazaiClient:
    """Cliente ND-JSON para worker FazAI Gemma"""

    def __init__(self, socket_path: str, tcp_host: str, tcp_port: int, timeout: int):
        self.socket_path = socket_path
        self.tcp_host = tcp_host
        self.tcp_port = tcp_port
        self.timeout = timeout
        self.reader: Optional[asyncio.StreamReader] = None
        self.writer: Optional[asyncio.StreamWriter] = None
        self.connected = False

    async def connect(self) -> bool:
        """Conecta ao worker via socket Unix ou TCP fallback"""
        try:
            if self.socket_path and Path(self.socket_path).exists():
                self.reader, self.writer = await asyncio.wait_for(
                    asyncio.open_unix_connection(self.socket_path),
                    timeout=self.timeout,
                )
            else:
                self.reader, self.writer = await asyncio.wait_for(
                    asyncio.open_connection(self.tcp_host, self.tcp_port),
                    timeout=self.timeout,
                )
            self.connected = True
            return True
        except (asyncio.TimeoutError, OSError) as exc:
            print(f"❌ Erro ao conectar: {exc}")
            self.connected = False
            return False
    
    async def send_action(self, action: NDJSONAction, input_text: str) -> Optional[str]:
        """Envia ação ND-JSON e imprime respostas em streaming até DONE."""
        if not self.connected:
            if not await self.connect():
                print("❌ Cliente não conectado")
                return None

        action_id = str(uuid.uuid4())
        message = NDJSONMessage(action=action, action_id=action_id, input=input_text)

        try:
            data = message.to_ndjson() + '\n'
            self.writer.write(data.encode('utf-8'))
            await self.writer.drain()

            final_result = None
            while True:
                try:
                    line = await asyncio.wait_for(self.reader.readline(), timeout=self.timeout)
                except asyncio.TimeoutError:
                    print("⚠️ Timeout aguardando resposta")
                    break
                if not line:
                    break
                s = line.decode('utf-8').strip()
                if not s:
                    continue
                try:
                    evt = NDJSONMessage.from_ndjson(s)
                except Exception:
                    # Ignora ruído
                    continue

                # Apenas aceita eventos do mesmo action_id
                if evt.action_id != action_id:
                    continue

                if evt.action == NDJSONAction.DONE:
                    final_result = evt.result
                    break

                # Stream intermediário: imprime resultado parcial
                if evt.result:
                    print(evt.result)

            return final_result
        except Exception as e:
            print(f"❌ Erro na ação: {e}")
            return None
    
    async def ask(self, question: str) -> Optional[str]:
        """Ação ASK - pergunta ao modelo"""
        return await self.send_action(NDJSONAction.ASK, question)
    
    async def research(self, topic: str) -> Optional[str]:
        """Ação RESEARCH - pesquisa com fallbacks"""
        return await self.send_action(NDJSONAction.RESEARCH, topic)
    
    async def shell(self, command: str) -> Optional[str]:
        """Ação SHELL - executa comando"""
        return await self.send_action(NDJSONAction.SHELL, command)
    
    async def plan(self, objective: str) -> Optional[str]:
        """Ação PLAN - cria plano"""
        return await self.send_action(NDJSONAction.PLAN, objective)
    
    async def observe(self, target: str) -> Optional[str]:
        """Ação OBSERVE - observa sistema"""
        return await self.send_action(NDJSONAction.OBSERVE, target)
    
    async def commitkb(self, knowledge: str) -> Optional[str]:
        """Ação COMMITKB - armazena conhecimento"""
        return await self.send_action(NDJSONAction.COMMITKB, knowledge)
    
    async def disconnect(self):
        """Desconecta do worker"""
        if self.writer:
            self.writer.close()
            await self.writer.wait_closed()
        self.connected = False

class FazaiCLI:
    """CLI integrado com /bin/fazai"""
    
    def __init__(self, client: FazaiClient):
        self.client = client
    
    async def run_command(self, args: list) -> int:
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
                print(f"❌ Ação desconhecida: {action}")
                print("Ações disponíveis: ask, research, shell, plan, observe, commit")
                return 1
            
            if result:
                print(result)
                return 0
            else:
                print("❌ Erro: sem resposta")
                return 1
                
        finally:
            await self.client.disconnect()

class InteractiveShell:
    """Shell interativo para testes manuais"""
    
    def __init__(self, client: FazaiClient):
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
            print("❌ Não foi possível conectar ao worker")
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
            print(f"❌ Erro fatal: {e}")

        await self.client.disconnect()

    async def process_command(self, line: str):
        """Processa comando do usuário"""
        if line.startswith("/"):
            parts = line[1:].split(" ", 1)
            cmd = parts[0]
            text = parts[1] if len(parts) > 1 else ""

            if cmd == "help":
                self.print_help()
            elif cmd == "ask":
                result = await self.client.ask(text)
                if result:
                    print(result)
            elif cmd == "research":
                result = await self.client.research(text)
                if result:
                    print(result)
            elif cmd == "shell":
                result = await self.client.shell(text)
                if result:
                    print(result)
            elif cmd == "plan":
                result = await self.client.plan(text)
                if result:
                    print(result)
            elif cmd == "observe":
                result = await self.client.observe(text)
                if result:
                    print(result)
            elif cmd == "commit":
                result = await self.client.commitkb(text)
                if result:
                    print(result)
            elif cmd in ["exit", "quit"]:
                self.running = False
            elif cmd == "clear":
                print("\033[2J\033[H")
            else:
                print(f"❌ Comando desconhecido: /{cmd}")
        else:
            # ASK direto
            result = await self.client.ask(line)
            if result:
                print(result)
            else:
                print("❌ Sem resposta")

async def main(argv=None):
    """Função principal compatível com arquitetura FazAI"""

    base_parser = argparse.ArgumentParser(add_help=False)
    base_parser.add_argument("--config", help="Caminho alternativo do fazai.conf")
    cfg_args, remaining = base_parser.parse_known_args(argv)

    cfg_parser, _ = load_worker_config(cfg_args.config)
    defaults = resolve_worker_defaults(cfg_parser)

    parser = argparse.ArgumentParser(
        description="Cliente ND-JSON para FazAI Gemma Worker",
        parents=[base_parser],
    )
    parser.add_argument(
        "-s",
        "--socket",
        default=defaults["unix_socket"],
        help="Caminho do Unix socket do worker",
    )
    parser.add_argument(
        "--tcp-host",
        default=defaults["tcp_host"],
        help="Host TCP de fallback (quando o socket não estiver disponível)",
    )
    parser.add_argument(
        "--tcp-port",
        type=int,
        default=defaults["tcp_port"],
        help="Porta TCP de fallback",
    )
    parser.add_argument(
        "--timeout",
        type=int,
        default=defaults["timeout"],
        help="Timeout de conexão/resposta em segundos",
    )
    parser.add_argument(
        "action",
        nargs="?",
        help="Ação: ask, research, shell, plan, observe, commit",
    )
    parser.add_argument("text", nargs="*", help="Texto da ação")

    args = parser.parse_args(remaining)

    client = FazaiClient(
        socket_path=args.socket,
        tcp_host=args.tcp_host,
        tcp_port=args.tcp_port,
        timeout=args.timeout,
    )

    if args.action:
        # Modo linha de comando
        cli = FazaiCLI(client)
        return await cli.run_command([args.action] + args.text)
    else:
        # Modo interativo
        shell = InteractiveShell(client)
        await shell.run()
        return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
