#!/usr/bin/env python3
"""
FazAI Gemma Worker - Cliente CLI
Autor: Roger Luft

Cliente de linha de comando para interagir com o daemon fazai-gemma-worker
"""

import socket
import json
import sys
import os
import argparse
import readline
import atexit
from pathlib import Path
from typing import Optional, Dict, Any
import time

# Configuração padrão
DEFAULT_CONFIG = {
    "socket_type": "tcp",
    "tcp_host": "127.0.0.1",
    "tcp_port": 5555,
    "unix_path": "/tmp/fazai-gemma.sock",
    "timeout": 30
}

# Cores para terminal
class Colors:
    HEADER = '\033[95m'
    OKBLUE = '\033[94m'
    OKCYAN = '\033[96m'
    OKGREEN = '\033[92m'
    WARNING = '\033[93m'
    FAIL = '\033[91m'
    ENDC = '\033[0m'
    BOLD = '\033[1m'
    UNDERLINE = '\033[4m'
    
    @classmethod
    def disable(cls):
        cls.HEADER = ''
        cls.OKBLUE = ''
        cls.OKCYAN = ''
        cls.OKGREEN = ''
        cls.WARNING = ''
        cls.FAIL = ''
        cls.ENDC = ''
        cls.BOLD = ''
        cls.UNDERLINE = ''


class GemmaClient:
    """Cliente para comunicação com o daemon"""
    
    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.socket = None
        self.connected = False
        self.history_file = Path.home() / ".fazai_gemma_history"
        self._setup_readline()
    
    def _setup_readline(self):
        """Configura readline para histórico e autocompletar"""
        # Histórico
        if self.history_file.exists():
            readline.read_history_file(self.history_file)
        readline.set_history_length(1000)
        atexit.register(readline.write_history_file, self.history_file)
        
        # Autocompletar
        readline.set_completer(self._completer)
        readline.parse_and_bind("tab: complete")
    
    def _completer(self, text: str, state: int):
        """Função de autocompletar para comandos"""
        commands = [
            "help", "exit", "quit", "status", "clear", "history",
            "!shell", "!ls", "!pwd", "!cd", "!cat", "!grep",
            "query:", "command:", "verbose:", "silent:"
        ]
        
        options = [cmd for cmd in commands if cmd.startswith(text)]
        if state < len(options):
            return options[state]
        return None
    
    def connect(self) -> bool:
        """Conecta ao daemon"""
        try:
            if self.config["socket_type"] == "unix":
                self.socket = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
                self.socket.connect(self.config["unix_path"])
            else:
                self.socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
                self.socket.connect((self.config["tcp_host"], self.config["tcp_port"]))
            
            self.socket.settimeout(self.config["timeout"])
            self.connected = True
            return True
            
        except Exception as e:
            print(f"{Colors.FAIL}Erro ao conectar: {e}{Colors.ENDC}")
            return False
    
    def disconnect(self):
        """Desconecta do daemon"""
        if self.socket:
            self.socket.close()
            self.socket = None
            self.connected = False
    
    def send_message(self, input_text: str, msg_type: str = "command") -> Optional[Dict]:
        """Envia mensagem e recebe resposta"""
        if not self.connected:
            if not self.connect():
                return None
        
        try:
            # Prepara mensagem
            message = {
                "input": input_text,
                "type": msg_type
            }
            
            # Envia
            self.socket.send((json.dumps(message) + "\n").encode())
            
            # Recebe resposta
            data = b""
            while b"\n" not in data:
                chunk = self.socket.recv(4096)
                if not chunk:
                    break
                data += chunk
            
            if data:
                return json.loads(data.decode().strip())
            
        except socket.timeout:
            print(f"{Colors.FAIL}Timeout ao aguardar resposta{Colors.ENDC}")
        except Exception as e:
            print(f"{Colors.FAIL}Erro na comunicação: {e}{Colors.ENDC}")
            self.disconnect()
        
        return None
    
    def interactive_mode(self):
        """Modo interativo (REPL)"""
        print(f"{Colors.HEADER}FazAI Gemma Worker - Modo Interativo{Colors.ENDC}")
        print(f"Digite {Colors.OKGREEN}help{Colors.ENDC} para ver comandos disponíveis")
        print(f"Use {Colors.OKGREEN}!comando{Colors.ENDC} para executar comandos shell")
        print()
        
        while True:
            try:
                # Prompt com status de conexão
                if self.connected:
                    prompt = f"{Colors.OKGREEN}fazai>{Colors.ENDC} "
                else:
                    prompt = f"{Colors.WARNING}fazai(offline)>{Colors.ENDC} "
                
                # Lê input
                user_input = input(prompt).strip()
                
                if not user_input:
                    continue
                
                # Comandos especiais do cliente
                if user_input.lower() in ["exit", "quit"]:
                    print("Encerrando...")
                    break
                
                elif user_input.lower() == "help":
                    self.show_help()
                    continue
                
                elif user_input.lower() == "status":
                    self.show_status()
                    continue
                
                elif user_input.lower() == "clear":
                    os.system('clear' if os.name == 'posix' else 'cls')
                    continue
                
                elif user_input.lower() == "history":
                    self.show_history()
                    continue
                
                # Determina tipo de mensagem
                msg_type = "command"
                
                if user_input.startswith("query:"):
                    msg_type = "query"
                    user_input = user_input[6:].strip()
                elif user_input.startswith("command:"):
                    msg_type = "command"
                    user_input = user_input[8:].strip()
                
                # Envia mensagem
                start_time = time.time()
                response = self.send_message(user_input, msg_type)
                elapsed = time.time() - start_time
                
                if response:
                    self.display_response(response, elapsed)
                else:
                    print(f"{Colors.FAIL}Sem resposta do daemon{Colors.ENDC}")
                
            except KeyboardInterrupt:
                print("\nUse 'exit' para sair")
                continue
            except EOFError:
                print("\nEncerrando...")
                break
    
    def display_response(self, response: Dict, elapsed: float):
        """Exibe resposta formatada"""
        # Resultado principal
        if response.get("result"):
            # Cor baseada na origem
            origin = response.get("origin", "unknown")
            if origin == "local":
                color = Colors.OKGREEN
            elif origin == "qdrant":
                color = Colors.OKCYAN
            elif origin in ["openai", "openrouter"]:
                color = Colors.OKBLUE
            elif origin == "error":
                color = Colors.FAIL
            else:
                color = Colors.WARNING
            
            print(f"\n{color}[{origin.upper()}]{Colors.ENDC}")
            print(response["result"])
        
        # Erro se houver
        if response.get("error"):
            print(f"{Colors.FAIL}Erro: {response['error']}{Colors.ENDC}")
        
        # Metadados
        if response.get("metadata"):
            print(f"\n{Colors.HEADER}Metadados:{Colors.ENDC}")
            for key, value in response["metadata"].items():
                print(f"  {key}: {value}")
        
        # Tempo de resposta
        print(f"\n{Colors.HEADER}Tempo: {elapsed:.2f}s{Colors.ENDC}")
    
    def show_help(self):
        """Exibe ajuda"""
        help_text = f"""
{Colors.HEADER}Comandos Disponíveis:{Colors.ENDC}

{Colors.OKGREEN}Comandos do Cliente:{Colors.ENDC}
  help          - Mostra esta ajuda
  exit/quit     - Sai do cliente
  status        - Mostra status da conexão
  clear         - Limpa a tela
  history       - Mostra histórico de comandos

{Colors.OKGREEN}Prefixos de Tipo:{Colors.ENDC}
  query:        - Envia como query (pergunta)
  command:      - Envia como comando (padrão)
  !             - Executa comando shell direto

{Colors.OKGREEN}Exemplos:{Colors.ENDC}
  listar arquivos no diretório /tmp
  query: qual é a capital do Brasil?
  !ls -la
  instalar nginx e configurar como proxy reverso
  
{Colors.HEADER}Dicas:{Colors.ENDC}
  • Use TAB para autocompletar
  • Setas para navegar no histórico
  • O daemon tenta Gemma local primeiro, depois fallbacks
"""
        print(help_text)
    
    def show_status(self):
        """Mostra status da conexão"""
        if self.connected:
            print(f"{Colors.OKGREEN}✓ Conectado ao daemon{Colors.ENDC}")
            print(f"  Socket: {self.config['socket_type']}")
            if self.config["socket_type"] == "tcp":
                print(f"  Endereço: {self.config['tcp_host']}:{self.config['tcp_port']}")
            else:
                print(f"  Path: {self.config['unix_path']}")
        else:
            print(f"{Colors.FAIL}✗ Desconectado{Colors.ENDC}")
    
    def show_history(self):
        """Mostra histórico de comandos"""
        print(f"{Colors.HEADER}Histórico de Comandos:{Colors.ENDC}")
        for i in range(1, readline.get_current_history_length() + 1):
            print(f"  {i:3d}  {readline.get_history_item(i)}")
    
    def batch_mode(self, input_text: str, msg_type: str = "command"):
        """Modo batch para comando único"""
        response = self.send_message(input_text, msg_type)
        
        if response:
            # No modo batch, output mais simples
            if response.get("result"):
                print(response["result"])
            if response.get("error"):
                print(f"ERRO: {response['error']}", file=sys.stderr)
                sys.exit(1)
        else:
            print("ERRO: Sem resposta do daemon", file=sys.stderr)
            sys.exit(1)


def load_config(config_file: Optional[str] = None) -> Dict[str, Any]:
    """Carrega configuração de arquivo ou usa padrão"""
    config = DEFAULT_CONFIG.copy()
    
    # Tenta carregar de arquivo se especificado
    if config_file and os.path.exists(config_file):
        try:
            with open(config_file, 'r') as f:
                # Parse simples de INI
                for line in f:
                    line = line.strip()
                    if not line or line.startswith('#'):
                        continue
                    if '=' in line:
                        key, value = line.split('=', 1)
                        key = key.strip()
                        value = value.strip()
                        
                        # Mapeia para config
                        if key == "type":
                            config["socket_type"] = value
                        elif key in ["tcp_host", "tcp_port", "unix_path", "timeout"]:
                            if key == "tcp_port":
                                config[key] = int(value)
                            elif key == "timeout":
                                config[key] = float(value)
                            else:
                                config[key] = value
        except Exception as e:
            print(f"Aviso: Erro ao ler config: {e}")
    
    # Override com variáveis de ambiente
    if os.getenv("FAZAI_SOCKET_TYPE"):
        config["socket_type"] = os.getenv("FAZAI_SOCKET_TYPE")
    if os.getenv("FAZAI_TCP_HOST"):
        config["tcp_host"] = os.getenv("FAZAI_TCP_HOST")
    if os.getenv("FAZAI_TCP_PORT"):
        config["tcp_port"] = int(os.getenv("FAZAI_TCP_PORT"))
    if os.getenv("FAZAI_UNIX_PATH"):
        config["unix_path"] = os.getenv("FAZAI_UNIX_PATH")
    
    return config


def main():
    """Função principal"""
    parser = argparse.ArgumentParser(
        description="Cliente CLI para FazAI Gemma Worker",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Exemplos:
  fazai-gemma                           # Modo interativo
  fazai-gemma "listar arquivos"         # Comando único
  fazai-gemma -q "o que é Python?"      # Query única
  echo "instalar nginx" | fazai-gemma   # Via pipe
  fazai-gemma --shutdown                # Encerra o daemon
"""
    )
    
    parser.add_argument("input", nargs="?", help="Comando ou query para executar")
    parser.add_argument("-c", "--config", help="Arquivo de configuração")
    parser.add_argument("-q", "--query", action="store_true", 
                        help="Trata input como query ao invés de comando")
    parser.add_argument("-t", "--tcp", metavar="HOST:PORT",
                        help="Conecta via TCP (ex: 127.0.0.1:5555)")
    parser.add_argument("-u", "--unix", metavar="PATH",
                        help="Conecta via Unix socket")
    parser.add_argument("--shutdown", action="store_true",
                        help="Envia comando de shutdown ao daemon")
    parser.add_argument("--no-color", action="store_true",
                        help="Desabilita cores no output")
    parser.add_argument("--timeout", type=float, default=30,
                        help="Timeout em segundos (padrão: 30)")
    
    args = parser.parse_args()
    
    # Desabilita cores se solicitado
    if args.no_color:
        Colors.disable()
    
    # Carrega configuração
    config = load_config(args.config)
    
    # Override com argumentos de linha de comando
    if args.tcp:
        config["socket_type"] = "tcp"
        if ":" in args.tcp:
            host, port = args.tcp.split(":", 1)
            config["tcp_host"] = host
            config["tcp_port"] = int(port)
        else:
            config["tcp_host"] = args.tcp
    
    if args.unix:
        config["socket_type"] = "unix"
        config["unix_path"] = args.unix
    
    config["timeout"] = args.timeout
    
    # Cria cliente
    client = GemmaClient(config)
    
    try:
        # Comando de shutdown
        if args.shutdown:
            response = client.send_message("", "shutdown")
            if response:
                print("Comando de shutdown enviado")
            else:
                print("Erro ao enviar comando de shutdown")
            return
        
        # Modo batch com input via argumento
        if args.input:
            msg_type = "query" if args.query else "command"
            client.batch_mode(args.input, msg_type)
        
        # Modo batch com input via pipe
        elif not sys.stdin.isatty():
            input_text = sys.stdin.read().strip()
            if input_text:
                msg_type = "query" if args.query else "command"
                client.batch_mode(input_text, msg_type)
            else:
                print("Erro: Input vazio", file=sys.stderr)
                sys.exit(1)
        
        # Modo interativo
        else:
            client.interactive_mode()
    
    finally:
        client.disconnect()


if __name__ == "__main__":
    main()