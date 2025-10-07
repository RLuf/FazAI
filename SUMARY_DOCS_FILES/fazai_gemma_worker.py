#!/usr/bin/env python3
"""
FazAI Gemma Worker Daemon
Autor: Roger Luft
Licença: Creative Commons Attribution 4.0 International (CC BY 4.0)
https://creativecommons.org/licenses/by/4.0/

Daemon profissional para processamento de comandos via socket local.
Integração com Gemma local, Qdrant para memória vetorial e múltiplos fallbacks.
Arquitetura modular, robusta e orientada a performance.
"""

import socket
import json
import os
import sys
import subprocess
import threading
import logging
import time
import signal
import asyncio
import hashlib
import contextlib
import weakref
from pathlib import Path
from typing import Optional, Dict, Any, List, Tuple, Union, Protocol
from dataclasses import dataclass, asdict, field
from enum import Enum, auto
from abc import ABC, abstractmethod
from queue import Queue, Empty
from concurrent.futures import ThreadPoolExecutor, ProcessPoolExecutor
import traceback
import uuid
import psutil
from datetime import datetime, timezone

# Dependências opcionais com importação lazy
class OptionalImport:
    def __init__(self, module_name: str, pip_name: str = None):
        self.module_name = module_name
        self.pip_name = pip_name or module_name
        self._module = None
        self._available = None

    @property
    def available(self) -> bool:
        if self._available is None:
            try:
                self._module = __import__(self.module_name)
                self._available = True
            except ImportError:
                self._available = False
        return self._available

    @property
    def module(self):
        if not self.available:
            raise ImportError(f"Módulo {self.module_name} não disponível. Instale com: pip install {self.pip_name}")
        return self._module

# Dependências opcionais
qdrant_client = OptionalImport("qdrant_client")
openai = OptionalImport("openai")
requests = OptionalImport("requests")
numpy = OptionalImport("numpy")
scipy = OptionalImport("scipy")
torch = OptionalImport("torch")

# Flags de disponibilidade
QDRANT_AVAILABLE = qdrant_client.available
OPENAI_AVAILABLE = openai.available


# ========================
# Configurações
# ========================

@dataclass
class Config:
    """Configuração centralizada do daemon com validação e perfis"""
    # Socket
    socket_type: str = "unix"  # "tcp" ou "unix" - Unix socket é mais seguro
    tcp_host: str = "127.0.0.1"
    tcp_port: int = 5555
    unix_path: str = "/run/fazai/gemma-worker.sock"
    socket_timeout: float = 30.0
    max_connections: int = 10

    # Gemma
    gemma_binary: str = "/opt/fazai/bin/gemma_oneshot"
    gemma_weights: str = "/opt/fazai/models/gemma/2.0-2b-it-sfp.sbs"
    gemma_tokenizer: str = "/opt/fazai/models/gemma/tokenizer.spm"
    gemma_model: str = "gemma2-2b-it"
    gemma_temperature: float = 0.2
    gemma_max_tokens: int = 1024
    gemma_threads: int = os.cpu_count() or 4
    gemma_timeout: float = 60.0

    # Qdrant
    qdrant_host: str = "127.0.0.1"
    qdrant_port: int = 6333
    qdrant_collection: str = "fazai_memory"
    qdrant_embedding_dim: int = 384  # Reduzido para melhor performance
    qdrant_timeout: float = 5.0
    qdrant_batch_size: int = 100

    # OpenAI/OpenRouter
    openai_api_key: str = field(default_factory=lambda: os.getenv("OPENAI_API_KEY", ""))
    openrouter_api_key: str = field(default_factory=lambda: os.getenv("OPENROUTER_API_KEY", ""))
    openrouter_model: str = "openai/gpt-4o-mini"  # Modelo mais econômico
    api_timeout: float = 30.0
    api_retries: int = 2

    # Context7
    context7_endpoint: str = field(default_factory=lambda: os.getenv("CONTEXT7_ENDPOINT", ""))
    context7_api_key: str = field(default_factory=lambda: os.getenv("CONTEXT7_API_KEY", ""))

    # Performance
    max_retries: int = 3
    retry_delay: float = 2.0
    worker_threads: int = 4
    memory_limit_mb: int = 4096  # Limite de memória
    cache_size: int = 1000

    # Logging
    verbose: bool = False
    log_file: str = "/var/log/fazai/gemma-worker.log"
    log_level: str = "INFO"
    log_max_size: int = 100 * 1024 * 1024  # 100MB
    log_backup_count: int = 5

    # Sistema
    pid_file: str = "/var/run/fazai-gemma-worker.pid"
    user: str = "fazai"
    group: str = "fazai"
    umask: int = 0o002

    # Segurança
    enable_shell_commands: bool = False  # Shell commands desabilitados por padrão
    allowed_shell_patterns: List[str] = field(default_factory=lambda: ["ls", "pwd", "whoami"])
    max_message_size: int = 64 * 1024  # 64KB
    
    def __post_init__(self):
        """Validação e normalização pós-inicialização"""
        self._validate_config()
        self._normalize_paths()
        self._setup_derived_settings()

    def _validate_config(self):
        """Valida configurações críticas"""
        # Valida arquivos Gemma
        if self.gemma_binary and not os.path.exists(self.gemma_binary):
            raise ValueError(f"Binário Gemma não encontrado: {self.gemma_binary}")

        if self.gemma_weights and not os.path.exists(self.gemma_weights):
            raise ValueError(f"Pesos Gemma não encontrados: {self.gemma_weights}")

        # Valida configurações de rede
        if self.socket_type not in ["tcp", "unix"]:
            raise ValueError(f"Tipo de socket inválido: {self.socket_type}")

        if self.tcp_port < 1 or self.tcp_port > 65535:
            raise ValueError(f"Porta TCP inválida: {self.tcp_port}")

        # Valida limites
        if self.memory_limit_mb < 1024:
            raise ValueError("Limite de memória muito baixo (mínimo 1GB)")

        if self.worker_threads < 1:
            self.worker_threads = 1

    def _normalize_paths(self):
        """Normaliza e cria diretórios necessários"""
        # Expande paths
        self.gemma_binary = os.path.expanduser(self.gemma_binary)
        self.gemma_weights = os.path.expanduser(self.gemma_weights)
        self.gemma_tokenizer = os.path.expanduser(self.gemma_tokenizer)

        # Cria diretórios necessários
        for path in [self.log_file, self.pid_file]:
            if path:
                os.makedirs(os.path.dirname(path), exist_ok=True)

        if self.socket_type == "unix":
            os.makedirs(os.path.dirname(self.unix_path), exist_ok=True)

    def _setup_derived_settings(self):
        """Configura definições derivadas"""
        # Ajusta threads baseado no hardware
        cpu_count = os.cpu_count() or 4
        if self.gemma_threads > cpu_count:
            self.gemma_threads = cpu_count

        # Ajusta worker threads
        if self.worker_threads > cpu_count * 2:
            self.worker_threads = cpu_count * 2

    @classmethod
    def load_from_file(cls, path: str = "/etc/fazai/gemma-worker.conf") -> 'Config':
        """Carrega configuração de arquivo TOML/INI com fallback"""
        try:
            if path.endswith('.toml'):
                return cls._load_toml(path)
            else:
                return cls._load_ini(path)
        except Exception as e:
            print(f"Erro ao carregar config de {path}: {e}")
            print("Usando configuração padrão")
            return cls()

    @classmethod
    def _load_toml(cls, path: str) -> 'Config':
        """Carrega configuração TOML"""
        try:
            import tomllib  # Python 3.11+
        except ImportError:
            try:
                import tomli as tomllib
            except ImportError:
                raise ImportError("Instale tomli para suporte TOML: pip install tomli")

        with open(path, 'rb') as f:
            data = tomllib.load(f)

        # Converte estrutura aninhada em atributos planos
        config_dict = {}
        for section, values in data.items():
            if isinstance(values, dict):
                for key, value in values.items():
                    config_dict[f"{section}_{key}"] = value
            else:
                config_dict[section] = values

        return cls(**config_dict)

    @classmethod
    def _load_ini(cls, path: str) -> 'Config':
        """Carrega configuração INI (implementação original melhorada)"""
        import configparser

        config = cls()

        if not os.path.exists(path):
            return config

        parser = configparser.ConfigParser()
        parser.read(path)

        for section in parser.sections():
            for key, value in parser[section].items():
                attr_name = f"{section}_{key}".lower()

                if hasattr(config, attr_name):
                    current_type = type(getattr(config, attr_name))

                    try:
                        if current_type == bool:
                            setattr(config, attr_name, parser.getboolean(section, key))
                        elif current_type == int:
                            setattr(config, attr_name, parser.getint(section, key))
                        elif current_type == float:
                            setattr(config, attr_name, parser.getfloat(section, key))
                        elif current_type == list:
                            # Suporta listas separadas por vírgula
                            setattr(config, attr_name, [item.strip() for item in value.split(',')])
                        else:
                            setattr(config, attr_name, value)
                    except (ValueError, TypeError) as e:
                        print(f"Erro ao converter {attr_name}={value}: {e}")

        return config

    def save_to_file(self, path: str):
        """Salva configuração atual em arquivo"""
        import configparser

        parser = configparser.ConfigParser()

        # Agrupa atributos por seção
        sections = {}
        for attr_name in dir(self):
            if not attr_name.startswith('_') and not callable(getattr(self, attr_name)):
                value = getattr(self, attr_name)
                if isinstance(value, (str, int, float, bool, list)):
                    if '_' in attr_name:
                        section, key = attr_name.split('_', 1)
                    else:
                        section, key = 'general', attr_name

                    if section not in sections:
                        sections[section] = {}

                    if isinstance(value, list):
                        sections[section][key] = ', '.join(map(str, value))
                    else:
                        sections[section][key] = str(value)

        # Cria seções no parser
        for section, items in sections.items():
            parser.add_section(section)
            for key, value in items.items():
                parser.set(section, key, value)

        with open(path, 'w') as f:
            parser.write(f)

    def get_profile(self, profile_name: str) -> 'Config':
        """Retorna configuração para perfil específico (dev, prod, test)"""
        config = Config(**asdict(self))

        if profile_name == "development":
            config.verbose = True
            config.log_level = "DEBUG"
            config.socket_type = "tcp"
            config.enable_shell_commands = True
        elif profile_name == "production":
            config.verbose = False
            config.log_level = "INFO"
            config.socket_type = "unix"
            config.enable_shell_commands = False
        elif profile_name == "testing":
            config.verbose = True
            config.log_level = "DEBUG"
            config.socket_type = "tcp"
            config.tcp_port = 15555  # Porta alternativa

        return config


# ========================
# Classes de Dados
# ========================

class MessageType(Enum):
    COMMAND = "command"
    QUERY = "query"
    STATUS = "status"
    SHUTDOWN = "shutdown"


class ResponseOrigin(Enum):
    LOCAL = "local"
    QDRANT = "qdrant"
    OPENAI = "openai"
    OPENROUTER = "openrouter"
    CONTEXT7 = "context7"
    WEB_SEARCH = "web_search"
    SHELL = "shell"
    ERROR = "error"


@dataclass
class Message:
    """Mensagem de entrada/saída"""
    input: str
    type: MessageType
    result: Optional[str] = None
    origin: Optional[ResponseOrigin] = None
    error: Optional[str] = None
    metadata: Dict[str, Any] = None
    
    def to_json(self) -> str:
        data = {
            "input": self.input,
            "type": self.type.value,
            "result": self.result,
            "origin": self.origin.value if self.origin else None,
            "error": self.error,
            "metadata": self.metadata or {}
        }
        return json.dumps(data)
    
    @classmethod
    def from_json(cls, data: str) -> 'Message':
        obj = json.loads(data)
        return cls(
            input=obj["input"],
            type=MessageType(obj.get("type", "command")),
            result=obj.get("result"),
            origin=ResponseOrigin(obj["origin"]) if obj.get("origin") else None,
            error=obj.get("error"),
            metadata=obj.get("metadata", {})
        )


# ========================
# Handlers Base
# ========================

class Handler(ABC):
    """Interface base para handlers"""
    
    def __init__(self, config: Config, logger: logging.Logger):
        self.config = config
        self.logger = logger
    
    @abstractmethod
    async def handle(self, message: Message) -> Optional[Message]:
        """Processa mensagem e retorna resposta ou None"""
        pass
    
    @abstractmethod
    def is_available(self) -> bool:
        """Verifica se handler está disponível"""
        pass


# ========================
# Handler Gemma COMPLETO com libgemma.so
# ========================

# Importa integração completa
try:
    from libgemma_simple import GemmaSession
    LIBGEMMA_AVAILABLE = True
except ImportError:
    LIBGEMMA_AVAILABLE = False


class CompleteGemmaHandler(Handler):
    """Handler usando API C oficial Google Gemma"""

    def __init__(self, config: Config, logger: logging.Logger):
        super().__init__(config, logger)
        self.gemma_session = None
        self._initialization_lock = asyncio.Lock()
        self._initialized = False
        self._stats = {
            "requests": 0,
            "successful": 0,
            "failed": 0,
            "total_time": 0.0
        }

    def is_available(self) -> bool:
        weights_org = self.config.gemma_weights.replace('.sbs', '.sbs-org')
        return (LIBGEMMA_AVAILABLE and
                os.path.exists(weights_org) and
                os.path.exists(self.config.gemma_tokenizer))

    async def _initialize_gemma(self):
        """Inicializa Gemma API C"""
        async with self._initialization_lock:
            if self._initialized:
                return

            if not self.is_available():
                raise RuntimeError("Recursos não disponíveis para libgemma")

            try:
                weights_org = self.config.gemma_weights.replace('.sbs', '.sbs-org')

                self.logger.info(f"Inicializando Gemma API C:")
                self.logger.info(f"  Tokenizer: {self.config.gemma_tokenizer}")
                self.logger.info(f"  Weights: {weights_org}")

                # Cria sessão com API C
                self.gemma_session = GemmaSession(
                    tokenizer_path=self.config.gemma_tokenizer,
                    weights_path=weights_org,
                    max_tokens=self.config.gemma_max_tokens
                )

                # Configura parâmetros
                self.gemma_session.set_temperature(self.config.gemma_temperature)
                self.gemma_session.set_top_k(40)

                self._initialized = True
                self.logger.info("✅ CompleteGemmaHandler inicializado com API C")

            except Exception as e:
                self.logger.error(f"❌ Erro inicializando CompleteGemmaHandler: {e}")
                raise

    async def handle(self, message: Message) -> Optional[Message]:
        if not self.is_available():
            return None

        # Inicializa se necessário
        if not self._initialized:
            try:
                await self._initialize_gemma()
            except Exception as e:
                self.logger.error(f"Falha na inicialização: {e}")
                return None

        start_time = time.time()
        self._stats["requests"] += 1

        try:
            # Prepara prompt
            prompt = message.input.strip()

            self.logger.info(f"🤖 Processando com API C: '{prompt[:50]}...'")

            # Gera resposta usando API C
            result = self.gemma_session.generate(
                prompt=prompt,
                max_output_chars=self.config.gemma_max_tokens * 4
            )

            if not result or not result.strip():
                raise RuntimeError("Resposta vazia do Gemma")

            result = result.strip()

            # Atualiza estatísticas
            generation_time = time.time() - start_time
            self._stats["successful"] += 1
            self._stats["total_time"] += generation_time

            self.logger.info(f"✅ Resposta API C em {generation_time:.2f}s: '{result[:50]}...'")

            return Message(
                input=message.input,
                type=message.type,
                result=result,
                origin=ResponseOrigin.LOCAL,
                metadata={
                    "generation_time": generation_time,
                    "method": "libgemma_api_c",
                    "model": "gemma-2b-it"
                }
            )

        except Exception as e:
            self._stats["failed"] += 1
            self.logger.error(f"Erro no CompleteGemmaHandler: {e}")
            return None

    def _format_query_prompt(self, user_input: str) -> str:
        """Formata prompt para queries gerais"""
        return f"""Você é um assistente IA especializado em Linux e programação.
Usuário: {user_input}
Assistente:"""

    def _format_command_prompt(self, user_input: str) -> str:
        """Formata prompt para comandos shell"""
        return f"""Forneça APENAS o comando shell Linux necessário.
Sem explicações, sem markdown, sem crases.

Pedido: {user_input}
Comando:"""

    def _postprocess_result(self, result: str, message_type: MessageType) -> str:
        """Pós-processa resultado baseado no tipo"""
        result = result.strip()

        if message_type == MessageType.COMMAND:
            # Remove explicações extras para comandos
            lines = result.split('\n')
            for line in lines:
                line = line.strip()
                if line and not line.startswith('#') and not line.startswith('//') and not line.startswith('*'):
                    # Remove markdown
                    if line.startswith('```') or line.startswith('`'):
                        line = line.replace('```', '').replace('`', '')
                    return line.strip()

        return result

    def get_stats(self) -> Dict[str, Any]:
        """Estatísticas do handler"""
        stats = self._stats.copy()

        if self.session_manager:
            sessions_stats = self.session_manager.list_sessions()
            stats["sessions"] = sessions_stats
            stats["total_sessions"] = len(sessions_stats)

        if stats["requests"] > 0:
            stats["success_rate"] = (stats["successful"] / stats["requests"]) * 100
            stats["avg_time"] = stats["total_time"] / stats["successful"] if stats["successful"] > 0 else 0
        else:
            stats["success_rate"] = 0
            stats["avg_time"] = 0

        return stats

    async def cleanup(self):
        """Limpa recursos"""
        if self.session_manager:
            self.session_manager.cleanup_all()
            self.session_manager = None
            self._initialized = False
            self.logger.info("CompleteGemmaHandler limpo")

    def __del__(self):
        """Destrutor"""
        try:
            if hasattr(self, 'session_manager') and self.session_manager:
                self.session_manager.cleanup_all()
        except:
            pass


# Handler de Fallback (original simplificado)
class SimpleGemmaHandler(Handler):
    """Handler simples para fallback quando libgemma não está disponível"""

    def is_available(self) -> bool:
        return os.path.exists(self.config.gemma_binary) and \
               os.path.exists(self.config.gemma_weights)

    async def handle(self, message: Message) -> Optional[Message]:
        if not self.is_available():
            return None

        try:
            # Prepara prompt baseado no tipo de mensagem
            if message.type == MessageType.QUERY:
                prompt = f"Responda com objetividade e precisão: {message.input}"
            else:
                prompt = (
                    "Responda APENAS com um comando shell Linux que atenda ao pedido a seguir. "
                    "Sem explicações, sem comentários, sem markdown, sem crases. "
                    f"Pedido: {message.input}"
                )

            # Monta comando para executar Gemma
            cmd = [
                self.config.gemma_binary,
                "--weights", self.config.gemma_weights,
                "--model", self.config.gemma_model,
                "--verbosity", "0"
            ]

            if self.config.gemma_tokenizer:
                cmd.extend(["--tokenizer", self.config.gemma_tokenizer])

            # Executa Gemma
            process = await asyncio.create_subprocess_exec(
                *cmd,
                stdin=asyncio.subprocess.PIPE,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )

            stdout, stderr = await process.communicate(input=prompt.encode())

            if process.returncode != 0:
                self.logger.error(f"Gemma falhou: {stderr.decode()}")
                return None

            result = stdout.decode().strip()

            return Message(
                input=message.input,
                type=message.type,
                result=result,
                origin=ResponseOrigin.LOCAL,
                metadata={"method": "binary_fallback"}
            )

        except Exception as e:
            self.logger.error(f"Erro no SimpleGemmaHandler: {e}")
            return None


# Factory para escolher handler apropriado
def create_gemma_handler(config: Config, logger: logging.Logger) -> Handler:
    """Cria handler Gemma apropriado baseado na disponibilidade"""
    if LIBGEMMA_AVAILABLE:
        logger.info("Usando CompleteGemmaHandler (API C libgemma)")
        return CompleteGemmaHandler(config, logger)
    else:
        logger.warning("API C libgemma não disponível, usando SimpleGemmaHandler (fallback)")
        return SimpleGemmaHandler(config, logger)


# ========================
# Handler Qdrant
# ========================

class QdrantHandler(Handler):
    """Handler para memória vetorial com Qdrant"""
    
    def __init__(self, config: Config, logger: logging.Logger):
        super().__init__(config, logger)
        self.client = None
        if QDRANT_AVAILABLE:
            try:
                self.client = QdrantClient(
                    host=config.qdrant_host,
                    port=config.qdrant_port
                )
                self._ensure_collection()
            except Exception as e:
                logger.error(f"Erro ao conectar Qdrant: {e}")
    
    def is_available(self) -> bool:
        return QDRANT_AVAILABLE and self.client is not None
    
    def _ensure_collection(self):
        """Garante que a coleção existe"""
        try:
            collections = self.client.get_collections()
            if self.config.qdrant_collection not in [c.name for c in collections.collections]:
                self.client.create_collection(
                    collection_name=self.config.qdrant_collection,
                    vectors_config=VectorParams(
                        size=self.config.qdrant_embedding_dim,
                        distance=Distance.COSINE
                    )
                )
        except Exception as e:
            self.logger.error(f"Erro ao criar coleção Qdrant: {e}")
    
    def _generate_embedding(self, text: str) -> List[float]:
        """Gera embedding simples (substituir por modelo real em produção)"""
        # Em produção, usar OpenAI embeddings ou sentence-transformers
        # Aqui usamos hash simples para demonstração
        hash_obj = hashlib.sha256(text.encode())
        hash_bytes = hash_obj.digest()
        
        # Converte para vetor normalizado
        embedding = []
        for i in range(self.config.qdrant_embedding_dim):
            byte_idx = i % len(hash_bytes)
            value = hash_bytes[byte_idx] / 255.0
            embedding.append(value)
        
        return embedding
    
    async def store(self, text: str, metadata: Dict[str, Any]):
        """Armazena texto na memória vetorial"""
        if not self.is_available():
            return
            
        try:
            embedding = self._generate_embedding(text)
            point = PointStruct(
                id=int(time.time() * 1000000),  # Timestamp como ID
                vector=embedding,
                payload={"text": text, **metadata}
            )
            
            self.client.upsert(
                collection_name=self.config.qdrant_collection,
                points=[point]
            )
            
        except Exception as e:
            self.logger.error(f"Erro ao armazenar no Qdrant: {e}")
    
    async def handle(self, message: Message) -> Optional[Message]:
        if not self.is_available():
            return None
            
        try:
            # Busca por similaridade
            embedding = self._generate_embedding(message.input)
            
            results = self.client.search(
                collection_name=self.config.qdrant_collection,
                query_vector=embedding,
                limit=3
            )
            
            if not results:
                return None
            
            # Usa o resultado mais similar
            best_match = results[0]
            if best_match.score > 0.7:  # Threshold de similaridade
                return Message(
                    input=message.input,
                    type=message.type,
                    result=best_match.payload.get("text", ""),
                    origin=ResponseOrigin.QDRANT,
                    metadata={"score": best_match.score}
                )
            
        except Exception as e:
            self.logger.error(f"Erro no QdrantHandler: {e}")
            
        return None


# ========================
# Handler OpenAI/OpenRouter
# ========================

class OpenAIHandler(Handler):
    """Handler para fallback com OpenAI ou OpenRouter"""
    
    def is_available(self) -> bool:
        return OPENAI_AVAILABLE and (
            self.config.openai_api_key or self.config.openrouter_api_key
        )
    
    async def handle(self, message: Message) -> Optional[Message]:
        if not self.is_available():
            return None
            
        try:
            # Tenta OpenRouter primeiro se disponível
            if self.config.openrouter_api_key:
                result = await self._query_openrouter(message.input)
                if result:
                    return Message(
                        input=message.input,
                        type=message.type,
                        result=result,
                        origin=ResponseOrigin.OPENROUTER
                    )
            
            # Fallback para OpenAI
            if self.config.openai_api_key:
                result = await self._query_openai(message.input)
                if result:
                    return Message(
                        input=message.input,
                        type=message.type,
                        result=result,
                        origin=ResponseOrigin.OPENAI
                    )
            
        except Exception as e:
            self.logger.error(f"Erro no OpenAIHandler: {e}")
            
        return None
    
    async def _query_openrouter(self, prompt: str) -> Optional[str]:
        if not REQUESTS_AVAILABLE:
            return None
            
        try:
            headers = {
                "Authorization": f"Bearer {self.config.openrouter_api_key}",
                "Content-Type": "application/json",
                "HTTP-Referer": "https://github.com/RLuf/FazAI",
                "X-Title": "FazAI Gemma Worker"
            }
            
            payload = {
                "model": self.config.openrouter_model,
                "messages": [
                    {"role": "system", "content": "Você é um assistente Linux experiente."},
                    {"role": "user", "content": prompt}
                ],
                "max_tokens": self.config.gemma_max_tokens,
                "temperature": self.config.gemma_temperature
            }
            
            response = requests.post(
                "https://openrouter.ai/api/v1/chat/completions",
                headers=headers,
                json=payload,
                timeout=30
            )
            
            if response.status_code == 200:
                data = response.json()
                return data["choices"][0]["message"]["content"]
                
        except Exception as e:
            self.logger.error(f"Erro ao consultar OpenRouter: {e}")
            
        return None
    
    async def _query_openai(self, prompt: str) -> Optional[str]:
        try:
            openai.api_key = self.config.openai_api_key
            
            response = await asyncio.to_thread(
                openai.ChatCompletion.create,
                model="gpt-4-turbo",
                messages=[
                    {"role": "system", "content": "Você é um assistente Linux experiente."},
                    {"role": "user", "content": prompt}
                ],
                max_tokens=self.config.gemma_max_tokens,
                temperature=self.config.gemma_temperature
            )
            
            return response.choices[0].message.content
            
        except Exception as e:
            self.logger.error(f"Erro ao consultar OpenAI: {e}")
            
        return None


# ========================
# Handler Context7
# ========================

class Context7Handler(Handler):
    """Handler para busca com Context7"""
    
    def is_available(self) -> bool:
        return REQUESTS_AVAILABLE and self.config.context7_endpoint and \
               self.config.context7_api_key
    
    async def handle(self, message: Message) -> Optional[Message]:
        if not self.is_available():
            return None
            
        try:
            headers = {
                "Authorization": f"Bearer {self.config.context7_api_key}",
                "Content-Type": "application/json"
            }
            
            payload = {"query": message.input}
            
            response = await asyncio.to_thread(
                requests.post,
                f"{self.config.context7_endpoint}/search",
                headers=headers,
                json=payload,
                timeout=30
            )
            
            if response.status_code == 200:
                data = response.json()
                
                # Formata resultados
                results = data.get("results", [])
                if results:
                    formatted = "\n".join([
                        f"• {r.get('title', 'Sem título')}: {r.get('snippet', '')}"
                        for r in results[:3]
                    ])
                    
                    return Message(
                        input=message.input,
                        type=message.type,
                        result=formatted,
                        origin=ResponseOrigin.CONTEXT7
                    )
                    
        except Exception as e:
            self.logger.error(f"Erro no Context7Handler: {e}")
            
        return None


# ========================
# Handler Web Search
# ========================

class WebSearchHandler(Handler):
    """Handler para pesquisa web como último recurso"""
    
    def is_available(self) -> bool:
        return REQUESTS_AVAILABLE
    
    async def handle(self, message: Message) -> Optional[Message]:
        if not self.is_available():
            return None
            
        try:
            # Usa DuckDuckGo como motor de busca sem API key
            query = message.input.replace(" ", "+")
            url = f"https://api.duckduckgo.com/?q={query}&format=json"
            
            response = await asyncio.to_thread(
                requests.get,
                url,
                timeout=10
            )
            
            if response.status_code == 200:
                data = response.json()
                
                # Extrai informações relevantes
                abstract = data.get("AbstractText", "")
                if abstract:
                    return Message(
                        input=message.input,
                        type=message.type,
                        result=abstract,
                        origin=ResponseOrigin.WEB_SEARCH
                    )
                    
        except Exception as e:
            self.logger.error(f"Erro no WebSearchHandler: {e}")
            
        return None


# ========================
# Handler Shell
# ========================

class ShellHandler(Handler):
    """Handler para executar comandos shell"""
    
    def is_available(self) -> bool:
        return True
    
    async def handle(self, message: Message) -> Optional[Message]:
        # Só executa se for explicitamente um comando shell
        if not message.input.startswith("!"):
            return None
            
        try:
            command = message.input[1:].strip()  # Remove o !
            
            process = await asyncio.create_subprocess_shell(
                command,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                cwd=os.environ.get("HOME", "/")
            )
            
            stdout, stderr = await process.communicate()
            
            result = stdout.decode()
            if stderr:
                result += f"\nERRO: {stderr.decode()}"
            
            return Message(
                input=message.input,
                type=message.type,
                result=result.strip(),
                origin=ResponseOrigin.SHELL
            )
            
        except Exception as e:
            self.logger.error(f"Erro no ShellHandler: {e}")
            return Message(
                input=message.input,
                type=message.type,
                result=f"Erro ao executar comando: {e}",
                origin=ResponseOrigin.ERROR
            )


# ========================
# Orchestrator
# ========================

class Orchestrator:
    """Orquestrador principal que coordena os handlers"""
    
    def __init__(self, config: Config, logger: logging.Logger):
        self.config = config
        self.logger = logger
        
        # Inicializa handlers em ordem de prioridade
        self.handlers = [
            create_gemma_handler(config, logger),  # Prioridade: Gemma (completo ou simples)
            QdrantHandler(config, logger),          # Memória vetorial
            OpenAIHandler(config, logger),          # Fallback: OpenAI/OpenRouter
            Context7Handler(config, logger),        # Fallback: Context7
            WebSearchHandler(config, logger),       # Fallback: Web
            ShellHandler(config, logger)            # Comandos shell diretos
        ]
        
        # Handler Qdrant para armazenar resultados
        self.memory = QdrantHandler(config, logger)
    
    async def process(self, message: Message) -> Message:
        """Processa mensagem através dos handlers"""

        self.logger.info(f"Processando: {message.input[:100]}...")

        # Tenta cada handler em ordem
        for handler in self.handlers:
            if not handler.is_available():
                continue

            try:
                result = await handler.handle(message)
                if result and result.result:
                    self.logger.info(f"Resposta de {handler.__class__.__name__}")

                    # Armazena resultado na memória vetorial
                    if self.memory.is_available() and result.origin != ResponseOrigin.QDRANT:
                        await self.memory.store(
                            result.result,
                            {
                                "input": message.input,
                                "origin": result.origin.value,
                                "timestamp": time.time()
                            }
                        )

                    return result

            except Exception as e:
                self.logger.error(f"Erro em {handler.__class__.__name__}: {e}")
                continue

        # Se nenhum handler conseguiu processar
        return Message(
            input=message.input,
            type=message.type,
            result="Não foi possível processar sua solicitação.",
            origin=ResponseOrigin.ERROR,
            error="Todos os handlers falharam"
        )

    async def cleanup(self):
        """Limpa recursos dos handlers"""
        for handler in self.handlers:
            try:
                if hasattr(handler, 'cleanup'):
                    if asyncio.iscoroutinefunction(handler.cleanup):
                        await handler.cleanup()
                    else:
                        handler.cleanup()
            except Exception as e:
                self.logger.error(f"Erro limpando {handler.__class__.__name__}: {e}")

    def get_stats(self) -> Dict[str, Any]:
        """Estatísticas do orchestrator"""
        stats = {
            "handlers": {},
            "total_handlers": len(self.handlers)
        }

        for handler in self.handlers:
            handler_name = handler.__class__.__name__
            handler_stats = {
                "available": handler.is_available()
            }

            if hasattr(handler, 'get_stats'):
                try:
                    handler_stats.update(handler.get_stats())
                except Exception as e:
                    handler_stats["stats_error"] = str(e)

            stats["handlers"][handler_name] = handler_stats

        return stats


# ========================
# Socket Server
# ========================

class SocketServer:
    """Servidor de socket para receber comandos"""
    
    def __init__(self, config: Config, orchestrator: Orchestrator, logger: logging.Logger):
        self.config = config
        self.orchestrator = orchestrator
        self.logger = logger
        self.running = False
        self.server = None
    
    async def start(self):
        """Inicia servidor de socket"""
        self.running = True
        
        if self.config.socket_type == "unix":
            await self._start_unix_socket()
        else:
            await self._start_tcp_socket()
    
    async def _start_tcp_socket(self):
        """Inicia servidor TCP"""
        self.server = await asyncio.start_server(
            self._handle_client,
            self.config.tcp_host,
            self.config.tcp_port
        )
        
        self.logger.info(f"Servidor TCP ouvindo em {self.config.tcp_host}:{self.config.tcp_port}")
        
        async with self.server:
            await self.server.serve_forever()
    
    async def _start_unix_socket(self):
        """Inicia servidor Unix domain socket"""
        # Remove socket antigo se existir
        if os.path.exists(self.config.unix_path):
            os.unlink(self.config.unix_path)
        
        self.server = await asyncio.start_unix_server(
            self._handle_client,
            self.config.unix_path
        )
        
        # Ajusta permissões
        os.chmod(self.config.unix_path, 0o666)
        
        self.logger.info(f"Servidor Unix socket ouvindo em {self.config.unix_path}")
        
        async with self.server:
            await self.server.serve_forever()
    
    async def _handle_client(self, reader: asyncio.StreamReader, writer: asyncio.StreamWriter):
        """Processa conexão de cliente"""
        addr = writer.get_extra_info('peername')
        self.logger.debug(f"Cliente conectado: {addr}")
        
        try:
            while True:
                # Lê mensagem (até 64KB)
                data = await reader.read(65536)
                if not data:
                    break
                
                # Processa cada linha (suporte a NDJSON)
                lines = data.decode().strip().split('\n')
                
                for line in lines:
                    if not line:
                        continue
                    
                    try:
                        # Parse da mensagem
                        message = Message.from_json(line)
                        
                        # Processa comando especiais
                        if message.type == MessageType.SHUTDOWN:
                            self.logger.info("Comando de shutdown recebido")
                            self.running = False
                            response = Message(
                                input=message.input,
                                type=MessageType.STATUS,
                                result="Daemon encerrando..."
                            )
                            writer.write((response.to_json() + "\n").encode())
                            await writer.drain()

                            # Limpa resources do orchestrator
                            await self.orchestrator.cleanup()
                            self.stop()
                            return

                        # Comando de status/stats
                        elif message.type == MessageType.STATUS:
                            stats = self.orchestrator.get_stats()
                            response = Message(
                                input=message.input,
                                type=MessageType.STATUS,
                                result=json.dumps(stats, indent=2),
                                origin=ResponseOrigin.LOCAL
                            )
                            writer.write((response.to_json() + "\n").encode())
                            await writer.drain()
                            continue
                        
                        # Processa mensagem normal
                        response = await self.orchestrator.process(message)
                        
                        # Envia resposta
                        writer.write((response.to_json() + "\n").encode())
                        await writer.drain()
                        
                    except json.JSONDecodeError as e:
                        self.logger.error(f"JSON inválido: {e}")
                        error_response = Message(
                            input=line,
                            type=MessageType.COMMAND,
                            result=None,
                            origin=ResponseOrigin.ERROR,
                            error=f"JSON inválido: {e}"
                        )
                        writer.write((error_response.to_json() + "\n").encode())
                        await writer.drain()
                    
                    except Exception as e:
                        self.logger.error(f"Erro ao processar mensagem: {e}")
                        error_response = Message(
                            input=line,
                            type=MessageType.COMMAND,
                            result=None,
                            origin=ResponseOrigin.ERROR,
                            error=str(e)
                        )
                        writer.write((error_response.to_json() + "\n").encode())
                        await writer.drain()
        
        except Exception as e:
            self.logger.error(f"Erro na conexão: {e}")
        
        finally:
            writer.close()
            await writer.wait_closed()
            self.logger.debug(f"Cliente desconectado: {addr}")
    
    def stop(self):
        """Para o servidor"""
        self.running = False
        if self.server:
            self.server.close()


# ========================
# Daemon Principal
# ========================

class FazAIGemmaDaemon:
    """Daemon principal do FazAI Gemma Worker"""
    
    def __init__(self, config: Config):
        self.config = config
        self.logger = self._setup_logger()
        self.orchestrator = Orchestrator(config, self.logger)
        self.server = SocketServer(config, self.orchestrator, self.logger)
        self.running = False
    
    def _setup_logger(self) -> logging.Logger:
        """Configura sistema de logging"""
        logger = logging.getLogger("fazai-gemma")
        logger.setLevel(logging.DEBUG if self.config.verbose else logging.INFO)
        
        # Handler para arquivo
        if self.config.log_file:
            os.makedirs(os.path.dirname(self.config.log_file), exist_ok=True)
            fh = logging.FileHandler(self.config.log_file)
            fh.setLevel(logging.DEBUG)
            formatter = logging.Formatter(
                '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
            )
            fh.setFormatter(formatter)
            logger.addHandler(fh)
        
        # Handler para console (apenas em modo verbose)
        if self.config.verbose:
            ch = logging.StreamHandler()
            ch.setLevel(logging.DEBUG)
            formatter = logging.Formatter('%(levelname)s - %(message)s')
            ch.setFormatter(formatter)
            logger.addHandler(ch)
        
        return logger
    
    def _write_pid(self):
        """Escreve PID file"""
        if self.config.pid_file:
            os.makedirs(os.path.dirname(self.config.pid_file), exist_ok=True)
            with open(self.config.pid_file, 'w') as f:
                f.write(str(os.getpid()))
    
    def _remove_pid(self):
        """Remove PID file"""
        if self.config.pid_file and os.path.exists(self.config.pid_file):
            os.unlink(self.config.pid_file)
    
    def _signal_handler(self, sig, frame):
        """Handler para sinais do sistema"""
        self.logger.info(f"Sinal {sig} recebido, encerrando...")
        self.running = False

        # Agenda limpeza assíncrona
        if hasattr(self, 'orchestrator'):
            try:
                loop = asyncio.get_event_loop()
                if loop.is_running():
                    loop.create_task(self.orchestrator.cleanup())
            except Exception as e:
                self.logger.error(f"Erro agendando limpeza: {e}")

        self.server.stop()
        self._remove_pid()
        sys.exit(0)
    
    async def run(self):
        """Loop principal do daemon"""
        self.running = True
        self._write_pid()
        
        # Registra handlers de sinal
        signal.signal(signal.SIGINT, self._signal_handler)
        signal.signal(signal.SIGTERM, self._signal_handler)
        
        self.logger.info("FazAI Gemma Worker iniciado")
        self.logger.info(f"PID: {os.getpid()}")
        
        try:
            # Inicia servidor
            await self.server.start()
            
        except Exception as e:
            self.logger.error(f"Erro fatal no daemon: {e}")
            self.logger.error(traceback.format_exc())
        
        finally:
            # Limpa recursos do orchestrator
            try:
                await self.orchestrator.cleanup()
            except Exception as e:
                self.logger.error(f"Erro na limpeza final: {e}")

            self._remove_pid()
            self.logger.info("FazAI Gemma Worker encerrado")
    
    def daemonize(self):
        """Transforma processo em daemon (Unix-style)"""
        # Fork 1
        try:
            pid = os.fork()
            if pid > 0:
                sys.exit(0)  # Parent exits
        except OSError as e:
            sys.stderr.write(f"Fork #1 falhou: {e}\n")
            sys.exit(1)
        
        # Decouple do ambiente parent
        os.chdir("/")
        os.setsid()
        os.umask(0)
        
        # Fork 2
        try:
            pid = os.fork()
            if pid > 0:
                sys.exit(0)  # Parent exits
        except OSError as e:
            sys.stderr.write(f"Fork #2 falhou: {e}\n")
            sys.exit(1)
        
        # Redireciona file descriptors
        sys.stdout.flush()
        sys.stderr.flush()
        si = open("/dev/null", 'r')
        so = open("/dev/null", 'a+')
        se = open("/dev/null", 'a+')
        os.dup2(si.fileno(), sys.stdin.fileno())
        os.dup2(so.fileno(), sys.stdout.fileno())
        os.dup2(se.fileno(), sys.stderr.fileno())


# ========================
# Cliente de Teste
# ========================

async def test_client():
    """Cliente de teste para o daemon"""
    config = Config()
    
    if config.socket_type == "unix":
        reader, writer = await asyncio.open_unix_connection(config.unix_path)
    else:
        reader, writer = await asyncio.open_connection(
            config.tcp_host,
            config.tcp_port
        )
    
    # Testa diferentes tipos de mensagem
    test_messages = [
        {"input": "listar arquivos no diretório atual", "type": "command"},
        {"input": "qual é a capital do Brasil?", "type": "query"},
        {"input": "!ls -la /tmp", "type": "command"},  # Shell direto
    ]
    
    for msg_data in test_messages:
        print(f"\nEnviando: {msg_data}")
        writer.write((json.dumps(msg_data) + "\n").encode())
        await writer.drain()
        
        data = await reader.readline()
        response = json.loads(data.decode())
        print(f"Resposta: {response}")
    
    writer.close()
    await writer.wait_closed()


# ========================
# Main
# ========================

def main():
    """Função principal"""
    import argparse
    
    parser = argparse.ArgumentParser(description="FazAI Gemma Worker Daemon")
    parser.add_argument("-c", "--config", help="Arquivo de configuração")
    parser.add_argument("-d", "--daemon", action="store_true", help="Rodar como daemon")
    parser.add_argument("-t", "--test", action="store_true", help="Rodar cliente de teste")
    parser.add_argument("-v", "--verbose", action="store_true", help="Modo verbose")
    
    args = parser.parse_args()
    
    # Carrega configuração
    if args.config:
        config = Config.load_from_file(args.config)
    else:
        config = Config.load_from_file()
    
    if args.verbose:
        config.verbose = True
    
    # Modo teste
    if args.test:
        asyncio.run(test_client())
        return
    
    # Cria daemon
    daemon = FazAIGemmaDaemon(config)
    
    # Daemonize se solicitado
    if args.daemon:
        daemon.daemonize()
    
    # Roda daemon
    asyncio.run(daemon.run())


if __name__ == "__main__":
    main()