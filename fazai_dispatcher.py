#!/usr/bin/env python3
"""
FazAI Dispatcher - Controlador unificado para workers Node.js e Python
Migra de main.js para dispatcher inteligente com configuração dinâmica.
"""

import configparser
import json
import logging
import os
import socket
import subprocess
import sys
import time
from dataclasses import dataclass, asdict
from enum import Enum
from pathlib import Path
from typing import Dict, Any, Optional, List, Tuple
import threading

class WorkerType(Enum):
    NODEJS_LEGACY = "nodejs_legacy"
    PYTHON_GEMMA = "python_gemma"
    AUTO = "auto"

class DispatcherMode(Enum):
    SMART = "smart"  # Escolhe worker baseado em capacidades
    FORCE_LEGACY = "force_legacy"
    FORCE_GEMMA = "force_gemma"

@dataclass
class WorkerConfig:
    """Configuração de um worker"""
    type: WorkerType
    enabled: bool
    socket_path: str
    health_check_endpoint: Optional[str] = None
    capabilities: Optional[List[str]] = None

    def __post_init__(self):
        if self.capabilities is None:
            self.capabilities = []

@dataclass
class DispatcherConfig:
    """Configuração unificada do dispatcher"""
    config_file: str
    mode: DispatcherMode
    workers: Dict[str, WorkerConfig]
    fallback_timeout: int
    health_check_interval: int
    log_level: str

    def __post_init__(self):
        if not self.workers:
            self.workers = {}

class ConfigLoader:
    """Carrega configuração do FazAI com fallbacks inteligentes"""

    DEFAULT_CONFIG_PATHS = [
        "/etc/fazai/fazai.conf",
        "/opt/fazai/etc/fazai.conf",
        "./etc/fazai/fazai.conf.example"
    ]

    def __init__(self):
        self.config = configparser.ConfigParser()
        self.logger = logging.getLogger("fazai_dispatcher.config")

    def load_config(self, config_path: Optional[str] = None) -> DispatcherConfig:
        """Carrega configuração com fallbacks"""
        if config_path and Path(config_path).exists():
            paths = [config_path]
        else:
            paths = self.DEFAULT_CONFIG_PATHS

        for path in paths:
            if Path(path).exists():
                try:
                    self.config.read(path)
                    self.logger.info(f"Configuração carregada de {path}")
                    return self._parse_config()
                except Exception as e:
                    self.logger.warning(f"Erro carregando {path}: {e}")
                    continue

        # Fallback hardcoded
        self.logger.warning("Usando configuração padrão hardcoded")
        return self._default_config()

    def _parse_config(self) -> DispatcherConfig:
        """Parse do arquivo de configuração"""

        # Modo do dispatcher
        mode_str = self.config.get("dispatcher", "mode", fallback="smart")
        try:
            mode = DispatcherMode(mode_str)
        except ValueError:
            mode = DispatcherMode.SMART

        # Workers
        workers = {}

        # Worker Node.js legado
        if self.config.has_section("agent"):
            nodejs_socket = self.config.get("agent", "ipc_socket",
                                          fallback="/tmp/fazai_worker.sock")
            workers["nodejs"] = WorkerConfig(
                type=WorkerType.NODEJS_LEGACY,
                enabled=True,
                socket_path=nodejs_socket,
                capabilities=["basic", "legacy"]
            )

        # Worker Python Gemma - lê configurações de paths
        gemma_socket = self.config.get("dispatcher", "gemma_socket", fallback="/run/fazai/gemma.sock")
        workers["gemma"] = WorkerConfig(
            type=WorkerType.PYTHON_GEMMA,
            enabled=self.config.getboolean("dispatcher", "gemma_enabled", fallback=True),
            socket_path=gemma_socket,
            capabilities=["gemma", "memory", "fallback", "mcp"]
        )

        return DispatcherConfig(
            config_file="loaded",
            mode=mode,
            workers=workers,
            fallback_timeout=self.config.getint("dispatcher", "fallback_timeout", fallback=30),
            health_check_interval=self.config.getint("dispatcher", "health_check_interval", fallback=60),
            log_level=self.config.get("logging", "level", fallback="info")
        )

    def _default_config(self) -> DispatcherConfig:
        """Configuração padrão quando arquivo não encontrado"""
        return DispatcherConfig(
            config_file="default",
            mode=DispatcherMode.SMART,
            workers={
                "nodejs": WorkerConfig(
                    type=WorkerType.NODEJS_LEGACY,
                    enabled=True,
                    socket_path="/tmp/fazai_worker.sock",
                    capabilities=["basic", "legacy"]
                ),
                "gemma": WorkerConfig(
                    type=WorkerType.PYTHON_GEMMA,
                    enabled=True,
                    socket_path="/run/fazai/gemma.sock",
                    capabilities=["gemma", "memory", "fallback", "mcp"]
                )
            },
            fallback_timeout=30,
            health_check_interval=60,
            log_level="info"
        )

    def get_dynamic_paths(self) -> Dict[str, str]:
        """Resolve caminhos dinâmicos baseados no sistema"""
        paths = {
            "config_dir": "/etc/fazai",
            "opt_dir": "/opt/fazai",
            "var_dir": "/var/lib/fazai",
            "log_dir": "/var/log/fazai",
            "socket_dir": "/tmp"
        }

        # Override if different
        if Path("/opt/fazai").exists():
            paths["opt_dir"] = "/opt/fazai"
        elif Path("./opt/fazai").exists():
            paths["opt_dir"] = "./opt/fazai"

        return paths

class WorkerHealthMonitor:
    """Monitora saúde dos workers"""

    def __init__(self, workers: Dict[str, WorkerConfig], health_check_interval: int = 60):
        self.workers = workers
        self.health_status = {name: False for name in workers.keys()}
        self.logger = logging.getLogger("fazai_dispatcher.health")
        self.running = True
        self.health_check_interval = health_check_interval

    def start_monitoring(self):
        """Inicia monitoramento em thread separada"""
        thread = threading.Thread(target=self._monitor_loop, daemon=True)
        thread.start()

    def stop_monitoring(self):
        """Para monitoramento"""
        self.running = False

    def check_worker(self, name: str, config: WorkerConfig) -> bool:
        """Verifica se worker está saudável"""
        if not config.enabled:
            return False

        try:
            # Check socket
            if os.path.exists(config.socket_path):
                # Try to connect
                sock = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
                sock.settimeout(5)
                sock.connect(config.socket_path)

                # Send status check
                if config.health_check_endpoint:
                    sock.send(json.dumps({"type": "system", "input": "status"}).encode())

                sock.close()
                return True
            else:
                # Try to start worker if not running
                self._try_start_worker(name, config)
                return False

        except Exception as e:
            self.logger.debug(f"Health check failed for {name}: {e}")
            return False

    def _try_start_worker(self, name: str, config: WorkerConfig):
        """Tenta iniciar worker se não estiver rodando"""
        try:
            if config.type == WorkerType.PYTHON_GEMMA:
                worker_path = "/opt/fazai/bin/fazai-gemma-worker.py"
                if Path(worker_path).exists():
                    subprocess.Popen([sys.executable, worker_path],
                                   stdout=subprocess.DEVNULL,
                                   stderr=subprocess.DEVNULL,
                                   start_new_session=True)
                    self.logger.info(f"Tentando iniciar worker Gemma: {name}")

            elif config.type == WorkerType.NODEJS_LEGACY:
                worker_path = "/opt/fazai/lib/main.js"
                if Path(worker_path).exists():
                    subprocess.Popen(["node", worker_path],
                                   stdout=subprocess.DEVNULL,
                                   stderr=subprocess.DEVNULL,
                                   start_new_session=True)
                    self.logger.info(f"Tentando iniciar worker Node.js: {name}")

        except Exception as e:
            self.logger.error(f"Falha iniciando worker {name}: {e}")

    def _monitor_loop(self):
        """Loop de monitoramento contínuo"""
        while self.running:
            for name, config in self.workers.items():
                self.health_status[name] = self.check_worker(name, config)

            time.sleep(self.health_check_interval)

class FazaiDispatcher:
    """Dispatcher principal - roteia requisições entre workers"""

    def __init__(self, config: DispatcherConfig):
        self.config = config
        self.health_monitor = WorkerHealthMonitor(config.workers, config.health_check_interval)
        self.logger = logging.getLogger("fazai_dispatcher")

        # Setup logging
        self._setup_logging()

    def _setup_logging(self):
        """Configura logging"""
        level_map = {
            "debug": logging.DEBUG,
            "info": logging.INFO,
            "warning": logging.WARNING,
            "error": logging.ERROR
        }
        level = level_map.get(self.config.log_level, logging.INFO)

        logging.basicConfig(
            level=level,
            format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
        )

    def start(self):
        """Inicia dispatcher"""
        self.logger.info("=== FazAI Dispatcher iniciando ===")
        self.logger.info(f"Modo: {self.config.mode.value}")

        # Inicia monitoramento de saúde
        self.health_monitor.start_monitoring()

        self.logger.info("Dispatcher pronto para conexões")

    def route_request(self, request: Dict[str, Any]) -> Dict[str, Any]:
        """Roteia requisição para worker apropriado"""
        request_type = request.get("type", "query")

        # Escolhe worker baseado no modo e capacidades necessárias
        worker_name = self._select_worker(request)

        if not worker_name:
            return {"error": "Nenhum worker disponível"}

        return self._send_to_worker(worker_name, request)

    def _select_worker(self, request: Dict[str, Any]) -> Optional[str]:
        """Seleciona worker apropriado baseado no request"""

        if self.config.mode == DispatcherMode.FORCE_LEGACY:
            return "nodejs" if "nodejs" in self.config.workers else None

        if self.config.mode == DispatcherMode.FORCE_GEMMA:
            return "gemma" if "gemma" in self.config.workers else None

        # Modo SMART - escolhe baseado em capacidades
        request_type = request.get("type", "query")
        needs = self._analyze_requirements(request)

        # Prioriza Gemma para solicitações complexas
        if ("gemma" in needs or "memory" in needs) and "gemma" in self.config.workers:
            if self.health_monitor.health_status.get("gemma", False):
                return "gemma"

        # Fallback para Node.js legado
        if "nodejs" in self.config.workers:
            if self.health_monitor.health_status.get("nodejs", False):
                return "nodejs"

        # Último recurso - Gemma mesmo se não saudável (tentará iniciar)
        if "gemma" in self.config.workers:
            return "gemma"

        return None

    def _analyze_requirements(self, request: Dict[str, Any]) -> List[str]:
        """Analisa necessidades do request"""
        needs = []
        input_text = request.get("input", "").lower()

        # Busca por padrões que indicam necessidade de Gemma
        gemma_indicators = [
            "inteligente", "ai", "ia", "responda", "explique", "analise",
            "gemma", "memory", "memória", "aprendizado", "complexo"
        ]

        if any(indicator in input_text for indicator in gemma_indicators):
            needs.append("gemma")

        # Sistema e comandos vão pro legado por segurança
        if request.get("type") in ["command", "system"]:
            needs.append("legacy")

        return needs

    def _send_to_worker(self, worker_name: str, request: Dict[str, Any]) -> Dict[str, Any]:
        """Envia request para worker específico"""
        try:
            config = self.config.workers[worker_name]
            self.logger.info(f"Roteando para worker {worker_name}: {request.get('type', 'unknown')}")

            # Connect to socket
            sock = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
            sock.settimeout(self.config.fallback_timeout)
            sock.connect(config.socket_path)

            # Send request
            request_json = json.dumps(request) + "\n"
            sock.send(request_json.encode())

            # Get response
            response_data = sock.recv(65536).decode().strip()
            sock.close()

            try:
                return json.loads(response_data)
            except json.JSONDecodeError:
                return {"result": response_data}

        except Exception as e:
            self.logger.error(f"Erro roteando para {worker_name}: {e}")
            return {"error": f"Worker {worker_name} indisponível: {str(e)}"}

def _execute_oneshot(prompt: str):
    """Executa o binário gemma_oneshot para perguntas diretas."""
    logger = logging.getLogger("fazai_dispatcher.oneshot")
    try:
        # Caminho para o executável oneshot
        oneshot_executable = "/opt/fazai/bin/gemma_oneshot.real"
        if not Path(oneshot_executable).exists():
            logger.error(f"Executável oneshot não encontrado em {oneshot_executable}")
            print("Erro: Componente de pergunta direta não instalado.", file=sys.stderr)
            return

        # Executa o comando passando o prompt via stdin
        result = subprocess.run(
            [oneshot_executable],
            input=prompt,
            capture_output=True,
            text=True,
            timeout=120  # Timeout de 2 minutos para a geração
        )

        if result.returncode == 0:
            print(result.stdout.strip())
        else:
            logger.error(f"Erro no gemma_oneshot: {result.stderr}")
            print(f"Erro ao processar a pergunta: {result.stderr}", file=sys.stderr)

    except subprocess.TimeoutExpired:
        logger.error("Timeout ao executar gemma_oneshot")
        print("Erro: A pergunta demorou muito para ser respondida.", file=sys.stderr)
    except Exception as e:
        logger.error(f"Erro inesperado ao executar oneshot: {e}")
        print(f"Erro inesperado: {e}", file=sys.stderr)

def main():
    """Função principal"""
    # Carrega configuração
    config_loader = ConfigLoader()
    config = config_loader.load_config()

    # Cria dispatcher
    dispatcher = FazaiDispatcher(config)
    dispatcher.start()

    # Verifica se o modo -q (pergunta direta) foi usado
    args = sys.argv[1:]
    if "-q" in args or "--question" in args:
        try:
            # Extrai o prompt
            q_index = args.index("-q") if "-q" in args else args.index("--question")
            prompt = " ".join(args[q_index + 1:])
            if not prompt:
                print("Erro: Forneça uma pergunta após a flag -q.", file=sys.stderr)
                sys.exit(1)
            
            # Executa o modo oneshot e sai
            _execute_oneshot(prompt)
            sys.exit(0)

        except (ValueError, IndexError):
            print("Erro: Uso incorreto da flag -q.", file=sys.stderr)
            sys.exit(1)


    # CLI mode - aceita argumentos ou entra em modo interativo
    if len(sys.argv) > 1:
        # CLI mode
        input_text = " ".join(sys.argv[1:])
        request = {
            "input": input_text,
            "type": "query"
        }

        result = dispatcher.route_request(request)
        if "error" in result:
            print(f"Erro: {result['error']}")
            sys.exit(1)
        else:
            print(result.get("result", "Sem resposta"))

    else:
        print("FazAI Dispatcher CLI")
        print("Digite suas consultas. 'quit' para sair.")
        print("-" * 50)

        while True:
            try:
                user_input = input("fazai> ").strip()
                if user_input.lower() in ['quit', 'exit', 'q']:
                    break

                request = {
                    "input": user_input,
                    "type": "query"
                }

                result = dispatcher.route_request(request)
                if "error" in result:
                    print(f"Erro: {result['error']}")
                else:
                    print(result.get("result", ""))

            except KeyboardInterrupt:
                print("\nAté logo!")
                break
            except Exception as e:
                print(f"Erro: {e}")

if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print(f"Erro fatal: {e}")
        sys.exit(1)
