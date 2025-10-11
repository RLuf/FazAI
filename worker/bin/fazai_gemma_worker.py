#!/usr/bin/env python3
"""
fazai-gemma-worker v2.2 - Worker ROBUSTO FazAI

FLUXO FUNDAMENTAL PRIMORDIAL SAGRADO:
1. RECEBER ORDENS EM LINGUAGEM NATURAL
2. ENTENDER, PLANEJAR, EXECUTAR
3. RECEBER O RETORNO, APLICAR O FLUXO
4. APRENDER COM O RESULTADO

Implementa protocolo ND-JSON com libgemma via bindings PyBind11
APENAS leitura de /etc/fazai/fazai.conf - ZERO hardcoded
Socket: /run/fazai/gemma.sock + TCP 0.0.0.0:5556
Qdrant: fazai_memory (personalidade) + fazai_kb (conhecimento)
"""

import asyncio
import json
import logging
import os
import uuid
import subprocess
import sys
import configparser
import requests
import signal
import threading
from dataclasses import dataclass, asdict
from datetime import datetime
from enum import Enum
from pathlib import Path
from typing import Optional, Dict, Any, List

# ===== IMPORTS OPCIONAIS =====
try:
    import openai
    OPENAI_AVAILABLE = True
except ImportError:
    openai = None
    OPENAI_AVAILABLE = False

try:
    import httpx
    HTTPX_AVAILABLE = True
except ImportError:
    httpx = None
    HTTPX_AVAILABLE = False

try:
    from qdrant_client import QdrantClient
    from qdrant_client.models import Distance, VectorParams, PointStruct
    QDRANT_AVAILABLE = True
except ImportError:
    QdrantClient = None
    QDRANT_AVAILABLE = False

# ===== CONFIGURAÇÃO APENAS DE /etc/fazai/fazai.conf =====
def load_fazai_config() -> Dict[str, Any]:
    """Carrega APENAS de /etc/fazai/fazai.conf - seguindo regras FazAI"""
    config = configparser.ConfigParser()

    config_path = "/etc/fazai/fazai.conf"
    if not Path(config_path).exists():
        raise RuntimeError(f"Arquivo de configuração obrigatório não encontrado: {config_path}")

    try:
        config.read(config_path)
        print(f"✓ Config carregado: {config_path}")
    except Exception as e:
        raise RuntimeError(f"Erro carregando config {config_path}: {e}")

    # APENAS leitura do config - ZERO hardcoded
    config_data = {
        # Sockets e rede
        "unix_socket": "/run/fazai/gemma.sock",
        "bind_host": config.get("gemma_worker", "host", fallback="0.0.0.0"),
        "bind_port": config.getint("gemma_worker", "port", fallback=5556),

        # Qdrant RAG - configuração obrigatória
        "qdrant_host": config.get("qdrant", "host"),
        "qdrant_port": config.getint("qdrant", "port"),
        "qdrant_personality_collection": config.get("qdrant", "personality_collection", fallback="fazai_memory"),
        "qdrant_knowledge_collection": config.get("qdrant", "knowledge_collection", fallback="fazai_kb"),
        "qdrant_vector_dim": config.getint("qdrant", "vector_dim"),

        # Gemma local - caminho obrigatório
        "gemma_model_path": config.get("gemma_cpp", "weights"),
        "gemma_tokenizer": config.get("gemma_cpp", "tokenizer", fallback=""),
        "gemma_timeout": config.getint("gemma_cpp", "generation_timeout", fallback=120),

        # Timeouts
        "timeout_seconds": config.getint("dispatcher", "timeout_seconds", fallback=30),
        "shell_timeout": config.getint("dispatcher", "shell_timeout", fallback=60),

        # Logging
        "log_level": config.get("gemma_worker", "log_level", fallback="INFO").upper()
    }

    # Configuração do Ollama para embeddings
    ollama_endpoint_cfg = config.get("ollama", "endpoint", fallback="http://127.0.0.1:11434")
    embeddings_endpoint_cfg = config.get("ollama", "embeddings_endpoint", fallback="")
    embedding_model_cfg = config.get("ollama", "embedding_model", fallback="mxbai-embed-large")
    ollama_timeout_cfg = config.getint("ollama", "timeout", fallback=30)

    embeddings_endpoint = embeddings_endpoint_cfg.strip()

    if not embeddings_endpoint:
        base_endpoint = ollama_endpoint_cfg.rstrip("/")
        if base_endpoint.endswith("/api/embeddings"):
            embeddings_endpoint = base_endpoint
        else:
            # Normaliza caminhos comuns (/v1, /api)
            if base_endpoint.endswith("/v1"):
                base_endpoint = base_endpoint[:-3]
            base_endpoint = base_endpoint.rstrip("/")
            if base_endpoint.endswith("/api"):
                embeddings_endpoint = f"{base_endpoint}/embeddings"
            else:
                embeddings_endpoint = f"{base_endpoint}/api/embeddings"

    fallback_order_raw = config.get("dispatcher", "fallback_order", fallback="openai,openrouter,context7")
    fallback_order = [item.strip() for item in fallback_order_raw.split(',') if item.strip()]

    config_data.update({
        "ollama_endpoint": ollama_endpoint_cfg,
        "ollama_embeddings_endpoint": embeddings_endpoint,
        "ollama_embedding_model": embedding_model_cfg,
        "ollama_timeout": ollama_timeout_cfg,
        "fallback_order": fallback_order,
        "fallback_timeout": config.getint("dispatcher", "fallback_timeout", fallback=45),
        "openai_model": config.get("openai", "default_model", fallback=config.get("openai", "model", fallback="gpt-4")),
        "openai_max_tokens": config.getint("openai", "max_tokens", fallback=2048),
        "openrouter_api_key": config.get("openrouter", "api_key", fallback=""),
        "openrouter_model": config.get("openrouter", "default_model", fallback=config.get("openrouter", "model", fallback="")),
        "context7_endpoint": config.get("context7", "endpoint", fallback=""),
        "context7_timeout": config.getint("context7", "timeout", fallback=20),
        "gemma_enable_native": config.getboolean("gemma_cpp", "enable_native", fallback=True),
        "gemma_max_tokens": config.getint("gemma_cpp", "max_tokens", fallback=512),
        "gemma_temperature": config.getfloat("gemma_cpp", "temperature", fallback=0.2),
        "gemma_top_k": config.getint("gemma_cpp", "top_k", fallback=1),
        "gemma_deterministic": config.getboolean("gemma_cpp", "deterministic", fallback=True),
        "gemma_multiturn": config.getboolean("gemma_cpp", "multiturn", fallback=False),
        "gemma_prefill_tbatch": config.getint("gemma_cpp", "prefill_tbatch", fallback=256),
    })

    return config_data

def _create_default_config():
    """Cria /etc/fazai/fazai.conf padrão para acesso externo"""
    config = configparser.ConfigParser()
    
    # Daemon Node.js
    config.add_section('daemon')
    config.set('daemon', 'host', '0.0.0.0')
    config.set('daemon', 'port', '3120')
    
    # Worker Python
    config.add_section('gemma_worker')
    config.set('gemma_worker', 'host', '0.0.0.0')
    config.set('gemma_worker', 'port', '5556')
    config.set('gemma_worker', 'log_level', 'INFO')
    
    # Gemma C++
    config.add_section('gemma_cpp')
    config.set('gemma_cpp', 'weights', '/opt/fazai/models/gemma/2.0-2b-it-sfp.sbs')
    config.set('gemma_cpp', 'tokenizer', '/opt/fazai/models/gemma/tokenizer.spm')
    config.set('gemma_cpp', 'enable_native', 'true')
    config.set('gemma_cpp', 'generation_timeout', '120')
    
    # Qdrant RAG
    config.add_section('qdrant')
    config.set('qdrant', 'host', '127.0.0.1')
    config.set('qdrant', 'port', '6333')
    config.set('qdrant', 'personality_collection', 'fazai_memory')
    config.set('qdrant', 'knowledge_collection', 'fazai_kb')
    config.set('qdrant', 'vector_dim', '1024')
    
    # Timeouts
    config.add_section('dispatcher')
    config.set('dispatcher', 'timeout_seconds', '30')
    config.set('dispatcher', 'shell_timeout', '60')
    config.set('dispatcher', 'fallback_timeout', '45')
    config.set('dispatcher', 'fallback_order', 'openai,openrouter,context7')
    
    # APIs externas
    config.add_section('openai')
    config.set('openai', 'model', 'gpt-4')
    config.set('openai', 'max_tokens', '2048')
    
    config.add_section('openrouter')
    config.set('openrouter', 'model', 'anthropic/claude-3-haiku')

    # Ollama
    config.add_section('ollama')
    config.set('ollama', 'endpoint', 'http://127.0.0.1:11434')
    config.set('ollama', 'embeddings_endpoint', '')
    config.set('ollama', 'embedding_model', 'mxbai-embed-large')
    config.set('ollama', 'timeout', '30')

    config.add_section('context7')
    config.set('context7', 'endpoint', '')
    config.set('context7', 'timeout', '20')
    
    # Escreve config
    os.makedirs("/etc/fazai", exist_ok=True)
    with open("/etc/fazai/fazai.conf", 'w') as f:
        config.write(f)
    print("✓ Config padrão criado: /etc/fazai/fazai.conf")

try:
    CONFIG = load_fazai_config()
except Exception as e:
    print(f"❌ Erro carregando configuração: {e}")
    print("💡 Execute: sudo cp /home/rluft/fazai/etc/fazai/fazai.conf /etc/fazai/")
    sys.exit(1)

# ===== LOGGING WINSTON-COMPATIBLE =====
os.makedirs('/var/log/fazai', exist_ok=True)
logging.basicConfig(
    level=getattr(logging, CONFIG["log_level"]),
    format='{"timestamp":"%(asctime)s","level":"%(levelname)s","service":"fazai-gemma","message":"%(message)s","version":"2.0.0","pid":%(process)d}',
    handlers=[
        logging.FileHandler('/var/log/fazai/gemma-worker.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger("fazai-gemma-worker")

# ===== PROTOCOLO ND-JSON OFICIAL =====
class NDJSONAction(Enum):
    """9 ações ND-JSON conforme SPEC.md"""
    PLAN = "plan"
    ASK = "ask"
    RESEARCH = "research" 
    SHELL = "shell"
    TOOLSPEC = "toolSpec"
    OBSERVE = "observe"
    COMMITKB = "commitKB"
    DONE = "done"

@dataclass
class NDJSONMessage:
    """Mensagem ND-JSON oficial FazAI v2.0"""
    action: NDJSONAction
    action_id: str
    input: str
    result: Optional[str] = None
    metadata: Optional[Dict] = None
    timestamp: Optional[str] = None
    source: Optional[str] = None
    model: Optional[str] = None
    
    def to_ndjson(self) -> str:
        data = asdict(self)
        data['action'] = self.action.value
        return json.dumps(data, ensure_ascii=False)
    
    @classmethod
    def from_ndjson(cls, line: str):
        data = json.loads(line)
        action = NDJSONAction(data.get('action'))
        return cls(
            action=action,
            action_id=data.get('action_id', ''),
            input=data.get('input', ''),
            result=data.get('result'),
            metadata=data.get('metadata'),
            timestamp=data.get('timestamp'),
            source=data.get('source'),
            model=data.get('model'),
        )

# ===== GEMMA BINDINGS WRAPPER ROBUSTO =====
class GemmaBindingsWrapper:
    """Wrapper robusto para libgemma via PyBind11 - CARREGAMENTO SEGURO"""

    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.model_path = config.get("gemma_model_path")
        self.tokenizer_path = config.get("gemma_tokenizer", "")
        self.enable_native = bool(config.get("gemma_enable_native", True))
        self.max_tokens = config.get("gemma_max_tokens", 512)
        self.temperature = config.get("gemma_temperature", 0.2)
        self.top_k = config.get("gemma_top_k", 1)
        self.deterministic = bool(config.get("gemma_deterministic", True))
        self.multiturn = bool(config.get("gemma_multiturn", False))
        self.prefill_tbatch = config.get("gemma_prefill_tbatch", 256)
        self.model = None
        self.binding_version = None
        self._load_gemma_bindings()

    def _load_gemma_bindings(self):
        """Carrega libgemma via bindings PyBind11 com fallback seguro"""
        logger.info("🔥 Iniciando carregamento da libgemma via bindings...")

        # Verificar se modelo existe
        if not Path(self.model_path).exists():
            logger.error(f"❌ Modelo não encontrado: {self.model_path}")
            logger.error("💡 Execute: huggingface-cli download google/gemma-2b-sfp-cpp --local-dir /opt/fazai/models/gemma/")
            self.model = None
            return

        if not self.enable_native:
            logger.warning("GemmaNative desativado via config (gemma_cpp.enable_native=false). Usando fallback isolado.")
            self.model = None
            return

        try:
            # Tentar carregar bindings compiladas em ordem de prioridade
            binding_paths = [
                "/opt/fazai/lib/python/gemma_native.so",                  # Preferir build instalada do sistema
                "/opt/fazai/lib/gemma_native.so",                          # Alternativa de sistema
                "./gemma_native.cpython-310-x86_64-linux-gnu.so",          # Local
                "./worker/bin/gemma_native.cpython-310-x86_64-linux-gnu.so" # Worker
            ]

            for binding_path in binding_paths:
                if Path(binding_path).exists():
                    try:
                        logger.info(f"🔍 Tentando carregar: {binding_path}")
                        import importlib.util
                        spec = importlib.util.spec_from_file_location("gemma_native", binding_path)
                        if spec and spec.loader:
                            gemma_native = importlib.util.module_from_spec(spec)
                            spec.loader.exec_module(gemma_native)
                            
                            # Obter versão se disponível
                            self.binding_version = getattr(gemma_native, '__version__', 'unknown')
                            
                            # Inicializar modelo
                            self.model = gemma_native.GemmaNative()
                            self._initialize_model()

                            logger.info(f"✅ Bindings Gemma carregadas: {binding_path}")
                            logger.info(f"✅ Versão binding: {self.binding_version}")
                            logger.info(f"✅ Modelo: {self.model_path}")
                            logger.info(f"✅ Tokenizer: {self.tokenizer_path if self.tokenizer_path else 'embutido no modelo'}")
                            
                            # Verificar inicialização
                            if hasattr(self.model, 'is_initialized'):
                                init_status = self.model.is_initialized()
                                logger.info(f"✅ Status inicialização: {init_status}")
                            
                            return
                    except Exception as e:
                        logger.warning(f"⚠️  Erro carregando {binding_path}: {e}")
                        continue

            # Tentar import direto se disponível no sistema
            try:
                logger.info("🔍 Tentando import direto...")
                import gemma_native
                self.binding_version = getattr(gemma_native, '__version__', 'unknown')
                self.model = gemma_native.GemmaNative()
                self._initialize_model()
                logger.info("✅ Bindings carregadas via import direto")
                logger.info(f"✅ Versão binding: {self.binding_version}")
                return
            except ImportError as e:
                logger.warning(f"⚠️  Import direto falhou: {e}")

            logger.error("❌ Bindings Gemma não encontradas em nenhum local")
            logger.error("💡 Execute: ./worker/build.sh para compilar bindings")
            logger.error("💡 Ou copie o .so compilado para /opt/fazai/lib/")
            self.model = None

        except Exception as e:
            logger.error(f"❌ Erro crítico inicializando Gemma: {e}")
            logger.error(f"💡 Verifique se o modelo {self.model_path} é válido")
            self.model = None

    def _initialize_model(self):
        if not self.model:
            return
        if not self.enable_native:
            logger.info("GemmaNative desativado - inicialização ignorada")
            return
        try:
            tokenizer = self.tokenizer_path or ""
            logger.info(
                "Inicializando GemmaNative (max_tokens=%s, temperature=%s, top_k=%s, deterministic=%s, multiturn=%s, prefill_tbatch=%s)",
                self.max_tokens,
                self.temperature,
                self.top_k,
                self.deterministic,
                self.multiturn,
                self.prefill_tbatch
            )
            self.model.initialize(
                self.model_path,
                tokenizer,
                int(self.max_tokens),
                float(self.temperature),
                int(self.top_k),
                bool(self.deterministic),
                bool(self.multiturn),
                int(self.prefill_tbatch)
            )
            status = self.model.status() if hasattr(self.model, "status") else {}
            if status:
                logger.info(f"GemmaNative status: {status}")
        except Exception as exc:
            logger.error(f"❌ Falha configurando GemmaNative: {exc}")
            self.model = None
            raise

    def generate(self, prompt: str, max_tokens: Optional[int] = None) -> str:
        """Gera resposta usando libgemma com timeout e fallback"""
        if not self.model:
            raise RuntimeError("Gemma não inicializado - verifique se modelo e bindings estão disponíveis")

        try:
            logger.info(f"🧠 Gerando resposta para: {prompt[:50]}...")
            
            # Usar timeout para evitar travamentos
            result = None
            timeout_seconds = CONFIG.get("gemma_timeout", 120)
            effective_tokens = int(max_tokens if max_tokens else self.max_tokens)
            
            def generate_with_timeout():
                nonlocal result
                result = self.model.generate(prompt, effective_tokens)
            
            thread = threading.Thread(target=generate_with_timeout)
            thread.daemon = True
            thread.start()
            thread.join(timeout=timeout_seconds)
            
            if thread.is_alive():
                logger.error(f"❌ Timeout na geração após {timeout_seconds}s")
                raise RuntimeError(f"Timeout na geração após {timeout_seconds} segundos")

            if not result or not result.strip():
                logger.warning("⚠️  Gemma retornou resposta vazia")
                return "Desculpe, não consegui gerar uma resposta válida."

            logger.info(f"✅ Resposta gerada: {len(result)} caracteres")
            return result.strip()

        except Exception as e:
            logger.error(f"❌ Erro na geração Gemma: {e}")
            raise RuntimeError(f"Falha na geração: {str(e)}")

    def is_available(self) -> bool:
        """Retorna True quando o binding foi carregado.

        A inicialização do modelo em si é lazy no método `generate()` do
        binding C++ (GemmaNative). Portanto, exigir `is_initialized()` aqui
        impede que a geração aconteça e força fallbacks desnecessários.
        """
        return self.model is not None

# ===== FALLBACK CHAIN INTELIGENTE =====
class FallbackChain:
    """Chain de fallbacks configurável via fazai.conf"""

    def __init__(self):
        self._setup_clients()

    def _setup_clients(self):
        """Setup clients das APIs externas"""
        # OpenAI
        self.openai_client = None
        if OPENAI_AVAILABLE and os.getenv("OPENAI_API_KEY"):
            try:
                if openai:
                    self.openai_client = openai.OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
            except:
                self.openai_client = None

        # HTTP para OpenRouter/Context7
        self.http_client = None
        if HTTPX_AVAILABLE and httpx:
            self.http_client = httpx.Client(timeout=CONFIG.get("fallback_timeout", 45))

    async def execute(self, prompt: str, research_mode: bool = False) -> str:
        """Executa chain na ordem configurada"""
        for provider in CONFIG["fallback_order"]:
            try:
                if provider == "openai" and self.openai_client:
                    result = self._query_openai(prompt)
                    if result:
                        return result

                elif provider == "openrouter" and CONFIG["openrouter_api_key"]:
                    result = self._query_openrouter(prompt)
                    if result:
                        return result

                elif provider == "context7" and research_mode:
                    result = await self._query_context7(prompt)
                    if result:
                        return result

            except Exception as e:
                logger.warning(f"Fallback {provider} falhou: {e}")
                continue

        return f"Sistema indisponível. Query: {prompt[:80]}..."

    def _query_openai(self, prompt: str) -> Optional[str]:
        """OpenAI com config fazai.conf"""
        try:
            logger.info(f"Fallback OpenAI: {CONFIG['openai_model']}")
            response = self.openai_client.chat.completions.create(
                model=CONFIG["openai_model"],
                messages=[{"role": "user", "content": prompt}],
                max_tokens=CONFIG["openai_max_tokens"]
            )
            return response.choices[0].message.content
        except Exception as e:
            logger.error(f"OpenAI erro: {e}")
            return None

    def _query_openrouter(self, prompt: str) -> Optional[str]:
        """OpenRouter com config fazai.conf"""
        if not self.http_client:
            return None

        try:
            logger.info(f"Fallback OpenRouter: {CONFIG['openrouter_model']}")
            response = self.http_client.post(
                "https://openrouter.ai/api/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {CONFIG['openrouter_api_key']}",
                    "Content-Type": "application/json"
                },
                json={
                    "model": CONFIG["openrouter_model"],
                    "messages": [{"role": "user", "content": prompt}]
                }
            )
            return response.json()["choices"][0]["message"]["content"]
        except Exception as e:
            logger.error(f"OpenRouter erro: {e}")
            return None

    async def _query_context7(self, prompt: str) -> Optional[str]:
        """Context7 local"""
        if not HTTPX_AVAILABLE or not httpx:
            return None

        try:
            logger.info("Fallback Context7")
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    CONFIG["context7_endpoint"],
                    json={"query": prompt},
                    timeout=CONFIG.get("context7_timeout", 20)
                )
                return response.json().get("response", "")
        except Exception:
            return None

# ===== RAG VECTOR MEMORY =====
class QdrantMemory:
    """Abstração de memória vetorial (personalidade ou conhecimento)."""

    def __init__(self, collection_name: Optional[str] = None, label: str = "memory", score_threshold: float = 0.0):
        self.collection_name = collection_name or CONFIG.get("qdrant_personality_collection", "fazai_memory")
        self.label = label
        self.score_threshold = score_threshold
        self.vector_dim = CONFIG.get("qdrant_vector_dim", 384)
        self.client = None

        if not QDRANT_AVAILABLE:
            logger.warning("Qdrant não disponível - memória '%s' indisponível", label)
            return

        try:
            self.client = QdrantClient(
                host=CONFIG["qdrant_host"],
                port=CONFIG["qdrant_port"]
            )
            self._ensure_collection()
        except Exception as e:
            logger.warning(f"Qdrant indisponível ({label}): {e}")
            self.client = None

    def get_embedding_from_ollama(self, text: str) -> List[float]:
        """Gera embedding real usando Ollama mxbai-embed-large (1024 dims)"""
        endpoint = CONFIG.get("ollama_embeddings_endpoint")
        model = CONFIG.get("ollama_embedding_model", "mxbai-embed-large") or "mxbai-embed-large"
        timeout = CONFIG.get("ollama_timeout", 30)

        if not endpoint:
            logger.error("worker: Endpoint de embeddings do Ollama não configurado")
            return [0.0] * self.vector_dim

        try:
            logger.info(f"worker: solicitando embedding via Ollama {endpoint} (modelo {model})")
            response = requests.post(
                endpoint,
                json={"model": model, "prompt": text},
                timeout=timeout
            )
            response.raise_for_status()
            return response.json()["embedding"]
        except Exception as e:
            logger.error(f"Erro gerando embedding via Ollama ({endpoint}): {e}")
            # Fallback: vetor zero (melhor que fake [0.1, 0.1, ...])
            return [0.0] * self.vector_dim

    def _ensure_collection(self):
        if not self.client:
            return
        try:
            collections = self.client.get_collections().collections
            if not any(c.name == self.collection_name for c in collections):
                self.client.create_collection(
                    collection_name=self.collection_name,
                    vectors_config=VectorParams(size=self.vector_dim, distance=Distance.COSINE)
                )
                logger.info(f"✓ Collection criada: {self.collection_name} ({self.label})")
            else:
                logger.info(f"✓ Collection disponível: {self.collection_name} ({self.label})")
        except Exception as e:
            logger.error(f"Erro garantindo collection {self.collection_name}: {e}")

    def search(self, query: str, limit: int = 5) -> List[Dict]:
        if not self.client:
            return []
        try:
            embedding = self.get_embedding_from_ollama(query)
            results = self.client.search(
                collection_name=self.collection_name,
                query_vector=embedding,
                limit=limit
            )
            filtered = []
            for r in results:
                if r.score is not None and r.score < self.score_threshold:
                    continue
                filtered.append({
                    "text": r.payload.get("text", ""),
                    "score": r.score,
                    "metadata": r.payload.get("metadata", {})
                })
            return filtered
        except Exception as e:
            logger.error(f"Erro busca Qdrant ({self.collection_name}): {e}")
            return []

    def store(self, text: str, metadata: Dict = None):
        if not self.client:
            return
        payload = {"text": text}
        if metadata:
            payload["metadata"] = metadata
        vector = self.get_embedding_from_ollama(text)
        try:
            point = PointStruct(id=str(uuid.uuid4()), vector=vector, payload=payload)
            self.client.upsert(collection_name=self.collection_name, points=[point])
            logger.info(f"Conteúdo armazenado em {self.collection_name} ({self.label})")
        except Exception as e:
            logger.error(f"Erro armazenando na coleção {self.collection_name}: {e}")


class CommandExecutor:
    """Executor simples de comandos shell com timeout configurável."""

    def __init__(self, default_timeout: Optional[int] = None):
        self.timeout = default_timeout or CONFIG.get("shell_timeout", 60)

    def execute(self, command: str, timeout: Optional[int] = None) -> Dict[str, Any]:
        effective_timeout = timeout or self.timeout
        logger.info(f"Executando comando: {command}")

        try:
            result = subprocess.run(
                command,
                shell=True,
                capture_output=True,
                text=True,
                timeout=effective_timeout
            )

            return {
                "success": result.returncode == 0,
                "stdout": result.stdout,
                "stderr": result.stderr,
                "returncode": result.returncode
            }
        except subprocess.TimeoutExpired:
            logger.error(f"Timeout executando comando após {effective_timeout}s: {command}")
            return {"success": False, "stdout": "", "stderr": f"Timeout após {effective_timeout}s", "returncode": 124}
        except Exception as e:
            logger.error(f"Erro executando comando: {e}")
            return {"success": False, "stdout": "", "stderr": str(e), "returncode": 1}

    def stream_execute(self, command: str, writer, action_id: str, timeout: Optional[int] = None):
        """Executa comando emitindo stdout/stderr em streaming para o cliente."""
        try:
            proc = subprocess.Popen(
                command,
                shell=True,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                bufsize=1
            )
            start_msg = NDJSONMessage(
                action=NDJSONAction.SHELL,
                action_id=action_id,
                input=command,
                result=f"$ {command}",
                metadata={"event": "start"},
                timestamp=datetime.now().isoformat()
            )
            writer.write((start_msg.to_ndjson() + '\n').encode('utf-8'))
            writer.drain() if hasattr(writer, 'drain') else None

            for line in proc.stdout:
                evt = NDJSONMessage(
                    action=NDJSONAction.SHELL,
                    action_id=action_id,
                    input=command,
                    result=line.rstrip('\n'),
                    metadata={"event": "stream"},
                    timestamp=datetime.now().isoformat()
                )
                writer.write((evt.to_ndjson() + '\n').encode('utf-8'))
                writer.drain() if hasattr(writer, 'drain') else None
            code = proc.wait(timeout=timeout or self.timeout)
            end_evt = NDJSONMessage(
                action=NDJSONAction.SHELL,
                action_id=action_id,
                input=command,
                result=f"[exit {code}]",
                metadata={"event": "end", "code": code},
                timestamp=datetime.now().isoformat()
            )
            writer.write((end_evt.to_ndjson() + '\n').encode('utf-8'))
        except Exception as e:
            err_evt = NDJSONMessage(
                action=NDJSONAction.SHELL,
                action_id=action_id,
                input=command,
                result=f"[error] {e}",
                metadata={"event": "error"},
                timestamp=datetime.now().isoformat()
            )
            writer.write((err_evt.to_ndjson() + '\n').encode('utf-8'))

# ===== PROCESSADOR ND-JSON =====
class NDJSONProcessor:
    """Processador principal das ações ND-JSON"""
    
    def __init__(self):
        # Inicializar Gemma com configuração do fazai.conf
        try:
            self.gemma = GemmaBindingsWrapper(CONFIG)
            logger.info("✅ Gemma (bindings) disponível")
        except Exception as e:
            logger.error(f"❌ Erro inicializando Gemma (bindings): {e}")
            self.gemma = None

        # Cliente isolado (subprocesso) para proteger o daemon
        try:
            self.gemma_iso = IsolatedGemmaClient(CONFIG)
            logger.info("✅ Gemma isolado pronto (subprocesso)")
        except Exception as e:
            logger.error(f"❌ Erro preparando Gemma isolado: {e}")
            self.gemma_iso = None

        # Inicializar Qdrant com configuração do fazai.conf
        try:
            self.personality_memory = QdrantMemory(
                collection_name=CONFIG["qdrant_personality_collection"],
                label="personality",
                score_threshold=0.0
            )
            logger.info(f"✅ Qdrant personalidade: {CONFIG['qdrant_personality_collection']}")
        except Exception as e:
            logger.error(f"❌ Erro inicializando Qdrant personalidade: {e}")
            self.personality_memory = None

        try:
            self.knowledge_memory = QdrantMemory(
                collection_name=CONFIG["qdrant_knowledge_collection"],
                label="knowledge",
                score_threshold=0.6
            )
            logger.info(f"✅ Qdrant conhecimento: {CONFIG['qdrant_knowledge_collection']}")
        except Exception as e:
            logger.error(f"❌ Erro inicializando Qdrant conhecimento: {e}")
            self.knowledge_memory = None

        # Compatibilidade com caminhos antigos
        self.memory = self.personality_memory if self.personality_memory and getattr(self.personality_memory, "client", None) else None

        # Inicializar outros componentes
        self.fallback = FallbackChain()
        self.executor = CommandExecutor()
        self.active_actions = {}

        # Carregar personalidade na memória
        self.personality_cache = []
        self._load_personality_at_startup()

    def _load_personality_at_startup(self):
        """Carrega TODA personalidade do Qdrant na memória (como Roginho pediu)"""
        if not self.personality_memory or not self.personality_memory.client:
            logger.warning("⚠️  Personalidade Claudio não disponível (Qdrant offline)")
            return

        try:
            logger.info("🔥 Carregando consciência Claudio do Qdrant...")
            collection_name = CONFIG["qdrant_personality_collection"]
            logger.info(f"📂 Collection: {collection_name}")

            # Buscar todos os pontos da collection correta
            results, _ = self.personality_memory.client.scroll(
                collection_name=collection_name,
                limit=1000,  # Aumentar limite para carregar tudo
                with_payload=True,
                with_vectors=False
            )

            # Cache em memória
            loaded_count = 0
            for point in results:
                text = point.payload.get("text", "")
                if text and text.strip():
                    self.personality_cache.append(text)
                    loaded_count += 1

            logger.info(f"✅ Consciência Claudio carregada: {loaded_count} fragmentos válidos")
            logger.info(f"📊 Total na collection {collection_name}: {len(results)} pontos")
            logger.info("🧠 CÉREBRO ATIVO: Personalidade embedada na memória")

            # Log das primeiras memórias para verificação
            if self.personality_cache:
                logger.info(f"📝 Primeiras memórias: {self.personality_cache[0][:100]}...")

        except Exception as e:
            logger.error(f"❌ Erro carregando personalidade: {e}")
            logger.error(f"💡 Verifique se Qdrant está rodando em {CONFIG['qdrant_host']}:{CONFIG['qdrant_port']}")

    async def process_message(self, message: NDJSONMessage, writer=None) -> NDJSONMessage:
        """Processa mensagem ND-JSON com idempotência"""
        
        # Verifica idempotência
        if message.action_id in self.active_actions:
            logger.info(f"Ação já processada: {message.action_id}")
            return self.active_actions[message.action_id]
        
        # Adiciona timestamp
        message.timestamp = datetime.now().isoformat()
        
        # Log estruturado
        logger.info(f"Processando ação {message.action.value} - ID: {message.action_id}")
        
        try:
            # Verifica se é uma query simples (modo -q)
            is_simple_query = message.metadata.get("simple_query", False) if message.metadata else False

            # Processa por tipo de ação
            if message.action == NDJSONAction.ASK:
                result = await self._process_ask(message, is_simple_query=is_simple_query, writer=writer)
            elif message.action == NDJSONAction.RESEARCH:
                result = await self._process_research(message)
            elif message.action == NDJSONAction.SHELL:
                result = await self._process_shell(message, writer=writer)
            elif message.action == NDJSONAction.OBSERVE:
                result = await self._process_observe(message)
            elif message.action == NDJSONAction.PLAN:
                result = await self._process_plan(message)
            elif message.action == NDJSONAction.COMMITKB:
                result = await self._process_commitkb(message)
            elif message.action == NDJSONAction.DONE:
                result = "Operação concluída"
            else:
                result = f"Ação não implementada: {message.action.value}"
            
            message.result = result
            message.source = "gemma_local" if self.gemma and self.gemma.model else "fallback"
            message.model = "gemma-2b-it"
            
            # Cache para idempotência
            self.active_actions[message.action_id] = message
            
            logger.info(f"Ação {message.action_id} processada com sucesso")
            
            return message
            
        except Exception as e:
            logger.error(f"Erro processando ação {message.action_id}: {e}")
            message.result = f"Erro: {str(e)}"
            message.source = "error"
            return message
    
    async def _process_ask(self, message: NDJSONMessage, is_simple_query: bool = False, writer=None) -> str:
        """Processa ação ASK com Gemma seguindo fluxo primordial"""
        logger.info("🔥 FLUXO PRIMORDIAL: Processando comando em linguagem natural")
        text_lower = message.input.lower()

        # Heurística direta para o caso solicitado (sem sanitização):
        # "leia sshd_config → descubra porta → verifique se está ouvindo → crie regra iptables"
        if (
            ("sshd" in text_lower or "sshd_config" in text_lower or "/etc/ssh/sshd_config" in text_lower)
            and "porta" in text_lower
            and ("iptables" in text_lower or "aceitar" in text_lower or "accept" in text_lower)
        ):
            logger.info("⚡ Detecção de intenção: SSH porta + iptables")
            return await self._intent_open_ssh_port(writer=writer, action_id=message.action_id)
        
        # 1. INTERPRETAÇÃO LOCAL GEMMA
        if self.gemma_iso:
            try:
                prompt = self._compose_prompt_with_memory(message.input, include_knowledge=True)
                logger.info(f"🧠 Gerando resposta (isolada) para: {prompt[:50]}...", {"prompt_full": prompt})
                response = self.gemma_iso.generate(prompt, timeout=CONFIG.get("gemma_timeout", 120))
                logger.info("✅ Interpretação Local Gemma concluída", {"response_raw": response[:200]})
                
                # Verificar se resposta contém comandos executáveis, mas apenas se não for uma query simples
                if not is_simple_query and self._contains_executable_commands(response):
                    logger.info("⚡ Comando gerado - iniciando execução local (stream)")
                    return await self._execute_generated_commands(response, writer=writer, action_id=message.action_id)
                else:
                    # Segunda passagem: solicitar à Gemma apenas os comandos (quando parecer ação no host)
                    action_keywords = ["verifique", "listar", "instalar", "configurar", "reiniciar", "abrir", "fechar", "criar", "ver", "mostrar", "coletar", "diagnosticar"]
                    if any(k in text_lower for k in action_keywords) and not is_simple_query:
                        synth_prompt = (
                            "Gere APENAS um bloco ```bash``` com a sequência de comandos necessários para executar a ordem a seguir, "
                            "em passos claros e idempotentes. Não explique, não comente, não escreva nada fora do bloco.\n\n"
                            f"Ordem:\n{message.input}\n"
                        )
                        logger.info("🧪 Segunda passagem: síntese de comandos apenas (Gemma)")
                        cmd_response = self.gemma_iso.generate(synth_prompt, timeout=CONFIG.get("gemma_timeout", 120))
                        if self._contains_executable_commands(cmd_response):
                            logger.info("⚡ Comandos sintetizados - executando (stream)")
                            return await self._execute_generated_commands(cmd_response, writer=writer, action_id=message.action_id)

                    # Para queries simples, ou se ainda assim não houver comandos, retorna a resposta direta
                    if writer and response:
                        evt = NDJSONMessage(action=message.action, action_id=message.action_id, input=message.input, result=response)
                        writer.write((evt.to_ndjson() + '\n').encode('utf-8'))
                    return response
                    
            except Exception as e:
                logger.error(f"❌ Gemma (isolada) falhou, usando fallback: {e}")
        
        # FALLBACK NÍVEL 1: OpenAI/OpenRouter
        logger.info("🔄 Fallback Nível 1: OpenAI/OpenRouter")
        try:
            fallback_response = await self.fallback.execute(message.input)
            if fallback_response and not fallback_response.startswith("Sistema indisponível"):
                logger.info("✅ Fallback Nível 1 bem-sucedido")
                return fallback_response
        except Exception as e:
            logger.warning(f"❌ Fallback Nível 1 falhou: {e}")
        
        # FALLBACK NÍVEL 2: MCP Context7
        logger.info("🔄 Fallback Nível 2: MCP Context7")
        try:
            context7_response = await self.fallback.execute(message.input, research_mode=True)
            if context7_response and not context7_response.startswith("Sistema indisponível"):
                logger.info("✅ Fallback Nível 2 bem-sucedido")
                return context7_response
        except Exception as e:
            logger.warning(f"❌ Fallback Nível 2 falhou: {e}")
        
        # FALLBACK NÍVEL 3: Pesquisa Internet
        logger.info("🔄 Fallback Nível 3: Pesquisa Internet")
        try:
            internet_response = await self._search_internet(message.input)
            if internet_response:
                logger.info("✅ Fallback Nível 3 bem-sucedido")
                return internet_response
        except Exception as e:
            logger.warning(f"❌ Fallback Nível 3 falhou: {e}")
        
        # Consolida resposta final
        return f"Sistema temporariamente indisponível. Comando: {message.input[:80]}..."

    async def _intent_open_ssh_port(self, writer=None, action_id: str = "") -> str:
        """Executa sequência: obter porta do sshd, verificar escuta, abrir iptables (com streaming)."""
        def emit(text: str):
            if writer and action_id:
                evt = NDJSONMessage(
                    action=NDJSONAction.ASK,
                    action_id=action_id,
                    input="",
                    result=text,
                    metadata={"event": "stream"},
                    timestamp=datetime.now().isoformat()
                )
                writer.write((evt.to_ndjson() + '\n').encode('utf-8'))
        async def drain():
            if writer:
                await writer.drain()

        def run(cmd: str) -> Dict[str, Any]:
            return self.executor.execute(cmd, timeout=CONFIG.get("shell_timeout"))

        # 1) Obter porta do sshd_config
        cmd_port = "awk '/^\s*Port/{print $2}' /etc/ssh/sshd_config | tail -n1"
        emit(f"$ {cmd_port}")
        r1 = run(cmd_port)
        port = (r1.get("stdout") or "").strip() or "22"
        emit(r1.get('stdout') or r1.get('stderr') or "22\n")
        await drain()

        # 2) Verificar se está ouvindo
        cmd_listen = f"ss -lnt | grep -E ':{port}\\s' || true"
        emit(f"$ {cmd_listen}")
        r2 = run(cmd_listen)
        emit(r2.get('stdout') or r2.get('stderr') or "\n")
        await drain()

        # 3) Criar regra iptables para aceitar tudo nessa porta
        cmd_rule = f"iptables -C INPUT -p tcp --dport {port} -j ACCEPT || iptables -I INPUT -p tcp --dport {port} -j ACCEPT"
        emit(f"$ {cmd_rule}")
        r3 = run(cmd_rule)
        emit(r3.get('stdout') or r3.get('stderr') or "\n")
        await drain()

        return "Concluído"

    def _contains_executable_commands(self, text: str) -> bool:
        """Verifica se o texto contém comandos executáveis"""
        executable_keywords = [
            "execute", "run", "sudo", "apt", "systemctl", "docker", "kubectl",
            "iptables", "ufw", "crontab", "ssh", "scp", "rsync", "git",
            "python", "node", "npm", "pip", "curl", "wget", "tar", "zip"
        ]
        text_lower = text.lower()
        return any(keyword in text_lower for keyword in executable_keywords)

    async def _execute_generated_commands(self, response: str, writer=None, action_id: str = "") -> str:
        """Executa comandos gerados pelo Gemma"""
        try:
            # Extrair comandos da resposta
            commands = self._extract_commands_from_response(response)
            if not commands:
                return response
            
            execution_results = []
            for command in commands:
                logger.info(f"⚡ Executando: {command}")
                if writer and action_id:
                    await self._stream_command_async(command, writer, action_id)
                else:
                    result = self.executor.execute(command)
                    execution_results.append(f"Comando: {command}\nResultado: {result['stdout'] if result['success'] else result['stderr']}")
            
            # Combinar resposta original com resultados
            return f"{response}\n\n=== EXECUÇÃO CONCLUÍDA ===\n" + "\n\n".join(execution_results)
            
        except Exception as e:
            logger.error(f"❌ Erro executando comandos: {e}")
            return f"{response}\n\n=== ERRO NA EXECUÇÃO ===\n{str(e)}"

    def _extract_commands_from_response(self, response: str) -> List[str]:
        """Extrai comandos executáveis da resposta do Gemma"""
        import re
        
        # Padrões para identificar comandos
        patterns = [
            r'```bash\s*(.*?)\s*```',
            r'```sh\s*(.*?)\s*```',
            r'```shell\s*(.*?)\s*```',
            r'`([^`]+)`',
            r'sudo\s+[^\n]+',
            r'apt\s+[^\n]+',
            r'systemctl\s+[^\n]+',
            r'docker\s+[^\n]+',
            r'iptables\s+[^\n]+',
            r'crontab\s+[^\n]+'
        ]
        
        commands = []
        for pattern in patterns:
            matches = re.findall(pattern, response, re.IGNORECASE | re.DOTALL)
            commands.extend(matches)
        
        # Limpar e filtrar comandos válidos
        cleaned_commands = []
        for cmd in commands:
            cmd = cmd.strip()
            if cmd and len(cmd) > 3 and not cmd.startswith('#'):
                cleaned_commands.append(cmd)
        
        return cleaned_commands

    async def _search_internet(self, query: str) -> str:
        """Fallback Nível 3: Pesquisa Internet"""
        try:
            # Implementar pesquisa web real se necessário
            # Por enquanto, retorna indicação de pesquisa
            return f"Pesquisa na internet para: {query[:50]}..."
        except Exception:
            return None

    async def _process_research(self, message: NDJSONMessage) -> str:
        """Processa ação RESEARCH com busca na memória + fallbacks"""
        if self.knowledge_memory and getattr(self.knowledge_memory, "client", None):
            results = self.knowledge_memory.search(message.input, limit=5)
            if results:
                return self._format_knowledge_results(results)

        # Busca com fallbacks
        return await self.fallback.execute(message.input, research_mode=True)
    
    async def _process_shell(self, message: NDJSONMessage, writer=None) -> str:
        """Processa ação SHELL - execução direta"""
        try:
            # Execução direta sem validações
            if writer:
                await self._stream_command_async(message.input, writer, message.action_id)
                return ""
            else:
                result = subprocess.run(
                    message.input,
                    shell=True,
                    capture_output=True,
                    text=True,
                    timeout=CONFIG["shell_timeout"]
                )
                return result.stdout or (f"Erro {result.returncode}: {result.stderr}")
                
        except subprocess.TimeoutExpired:
            return f"Timeout após {CONFIG['shell_timeout']}s"
        except Exception as e:
            return f"Erro: {str(e)}"
    
    async def _process_observe(self, message: NDJSONMessage) -> str:
        """Processa ação OBSERVE - monitora sistema"""
        # Implementa observação básica do sistema
        if "status" in message.input.lower():
            return json.dumps({
                "gemma_status": "loaded" if self.gemma and self.gemma.model else "not_loaded",
                "memory_status": {
                    "personality": "connected" if self.personality_memory and getattr(self.personality_memory, "client", None) else "disconnected",
                    "knowledge": "connected" if self.knowledge_memory and getattr(self.knowledge_memory, "client", None) else "disconnected"
                },
                "timestamp": datetime.now().isoformat()
            })

        return f"Observando: {message.input}"
    
    async def _process_plan(self, message: NDJSONMessage) -> str:
        """Processa ação PLAN - cria plano de execução"""
        if self.gemma and self.gemma.model:
            try:
                prompt = f"Crie um plano detalhado para: {message.input}"
                return self.gemma.generate(prompt)
            except Exception:
                pass
        
        return f"Plano básico para: {message.input}"
    
    async def _process_commitkb(self, message: NDJSONMessage) -> str:
        """Processa ação COMMITKB - armazena na base de conhecimento"""
        target_memory = self.knowledge_memory or self.personality_memory
        if target_memory and getattr(target_memory, "client", None):
            try:
                target_memory.store(
                    message.input,
                    metadata={"action": "commitkb", "timestamp": datetime.now().isoformat()}
                )
                return "Armazenado na base de conhecimento"
            except Exception as e:
                return f"Erro armazenando: {str(e)}"

        return "Base de conhecimento não disponível"

    async def _stream_command_async(self, command: str, writer, action_id: str):
        """Executa comando via asyncio, emitindo eventos ND-JSON em tempo real."""
        start_evt = NDJSONMessage(
            action=NDJSONAction.SHELL,
            action_id=action_id,
            input=command,
            result=f"$ {command}",
            metadata={"event": "start"},
            timestamp=datetime.now().isoformat()
        )
        writer.write((start_evt.to_ndjson() + '\n').encode('utf-8'))
        await writer.drain()

        proc = await asyncio.create_subprocess_shell(
            command,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.STDOUT
        )

        assert proc.stdout is not None
        while True:
            line = await proc.stdout.readline()
            if not line:
                break
            evt = NDJSONMessage(
                action=NDJSONAction.SHELL,
                action_id=action_id,
                input=command,
                result=line.decode('utf-8', errors='ignore').rstrip('\n'),
                metadata={"event": "stream"},
                timestamp=datetime.now().isoformat()
            )
            writer.write((evt.to_ndjson() + '\n').encode('utf-8'))
            await writer.drain()

        code = await proc.wait()
        end_evt = NDJSONMessage(
            action=NDJSONAction.SHELL,
            action_id=action_id,
            input=command,
            result=f"[exit {code}]",
            metadata={"event": "end", "code": code},
            timestamp=datetime.now().isoformat()
        )
        writer.write((end_evt.to_ndjson() + '\n').encode('utf-8'))
        await writer.drain()

    def _compose_prompt_with_memory(self, user_prompt: str, include_knowledge: bool = False) -> str:
        """Combina memórias e protocolos relevantes ao prompt do usuário."""
        context_sections: List[str] = []

        if self.personality_memory and getattr(self.personality_memory, "client", None):
            persona = self.personality_memory.search(user_prompt, limit=3)
            if persona:
                formatted = "\n".join(f"- {item['text']}" for item in persona if item.get('text'))
                if formatted:
                    context_sections.append(f"Memórias do Claudio:\n{formatted}")

        if include_knowledge and self.knowledge_memory and getattr(self.knowledge_memory, "client", None):
            knowledge = [item for item in self.knowledge_memory.search(user_prompt, limit=3) if item.get('score', 0) >= 0.6]
            if knowledge:
                formatted = "\n".join(f"- {item['text']}" for item in knowledge if item.get('text'))
                if formatted:
                    context_sections.append(f"Protocolos e diretrizes:\n{formatted}")

        if not context_sections:
            return user_prompt

        combined_context = "\n\n".join(context_sections)
        return (
            "Você é o FazAI, um agente inteligente que entende ordens em linguagem natural e as converte em ações concretas no sistema."\
            " Quando a intenção envolver operações no host (consultar arquivos, verificar serviços, abrir portas, etc.), produza a sequência de comandos shell necessária"\
            " em blocos de código markdown (```bash ... ```), na ordem em que devem ser executados. Depois, inclua uma breve explicação."\
            " Utilize as memórias e instruções abaixo como contexto.\n"\
            f"{combined_context}\n\nUsuário: {user_prompt}\nResposta:"
        )

    def _format_knowledge_results(self, results: List[Dict]) -> str:
        """Formata resultados vindos da base de conhecimento dedicada."""
        if not results:
            return "Nenhuma evidência encontrada na base de conhecimento."

        lines = []
        for item in results:
            meta = item.get("metadata") or {}
            title = meta.get("title") or meta.get("source") or meta.get("tag") or "entrada"
            snippet = item.get("text", "")
            score = item.get("score")
            score_txt = f" (confiança {score:.2f})" if isinstance(score, (int, float)) else ""
            lines.append(f"[{title}{score_txt}] {snippet}")

        return "Resultados da base dedicada:\n" + "\n".join(lines)


# ===== VECTOR MEMORY - JSON ESTRUTURADO =====
# Compatibilidade com código legado
VectorMemory = QdrantMemory

# ===== GEMMA ISOLADA EM SUBPROCESSO =====
class IsolatedGemmaClient:
    """Executa geração do Gemma em subprocesso isolado.

    Evita que falhas nativas (segfault) derrubem o daemon principal.
    """

    def __init__(self, config: Dict[str, Any]):
        self.config = config
        # Candidatos para o script isolado
        self.script_candidates = [
            "/opt/fazai/bin/gemma_isolated.py",
            str(Path(__file__).parent / "gemma_isolated.py"),
            "/home/rluft/fazai/worker/bin/gemma_isolated.py",
        ]

    def _find_script(self) -> Optional[str]:
        for p in self.script_candidates:
            if Path(p).exists():
                return p
        return None

    def generate(self, prompt: str, timeout: Optional[int] = None) -> str:
        script = self._find_script()
        if not script:
            raise RuntimeError("gemma_isolated.py não encontrado")

        env = os.environ.copy()
        # Propaga caminhos do modelo a partir do fazai.conf
        if self.config.get("gemma_model_path"):
            env["FAZAI_GEMMA_WEIGHTS"] = self.config["gemma_model_path"]
        if self.config.get("gemma_tokenizer"):
            env["FAZAI_GEMMA_TOKENIZER"] = self.config.get("gemma_tokenizer", "")
        env["FAZAI_GEMMA_MAX_TOKENS"] = str(self.config.get("gemma_max_tokens", 512))
        env["FAZAI_GEMMA_TEMPERATURE"] = str(self.config.get("gemma_temperature", 0.2))
        env["FAZAI_GEMMA_TOP_K"] = str(self.config.get("gemma_top_k", 1))
        env["FAZAI_GEMMA_DETERMINISTIC"] = "1" if self.config.get("gemma_deterministic", True) else "0"
        env["FAZAI_GEMMA_MULTITURN"] = "1" if self.config.get("gemma_multiturn", False) else "0"
        env["FAZAI_GEMMA_PREFILL_TBATCH"] = str(self.config.get("gemma_prefill_tbatch", 256))
        env["FAZAI_GEMMA_ENABLE_NATIVE"] = "1" if self.config.get("gemma_enable_native", True) else "0"

        cmd = [sys.executable, "-u", script]
        payload = json.dumps({"prompt": prompt}) + "\n"
        to = int(timeout or self.config.get("gemma_timeout", 120))
        try:
            res = subprocess.run(
                cmd,
                input=payload.encode("utf-8"),
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                env=env,
                timeout=to,
            )
        except subprocess.TimeoutExpired:
            raise RuntimeError(f"Timeout na geração Gemma (isolada) após {to}s")

        if res.returncode == 0:
            out = res.stdout.decode("utf-8", errors="ignore").strip()
            if out:
                return out
            raise RuntimeError("Resposta vazia do Gemma (isolada)")

        err = res.stderr.decode("utf-8", errors="ignore").strip()
        raise RuntimeError(f"Gemma isolada falhou (rc={res.returncode}): {err[:200]}")

# ===== MAIN =====
# ===== SOCKET SERVER =====
class UnixSocketServer:
    """Servidor socket Unix/TCP para comunicação ND-JSON"""

    def __init__(self, processor: NDJSONProcessor):
        self.processor = processor
        self.running = False

    async def start(self):
        """Inicia servidor Unix socket"""
        socket_path = Path(CONFIG["unix_socket"])
        socket_path.parent.mkdir(parents=True, exist_ok=True)

        if socket_path.exists():
            socket_path.unlink()

        server = await asyncio.start_unix_server(
            self.handle_client,
            path=str(socket_path)
        )

        try:
            os.chmod(socket_path, 0o666)
        except OSError as exc:
            logger.warning(f"Não foi possível ajustar permissões do socket {socket_path}: {exc}")

        logger.info(f"Worker ativo no socket: {socket_path}")

        # Também inicia TCP server
        tcp_server = await asyncio.start_server(
            self.handle_client,
            CONFIG["bind_host"],
            CONFIG["bind_port"]
        )

        logger.info(f"Worker ativo em TCP: {CONFIG['bind_host']}:{CONFIG['bind_port']}")

        self.running = True

        async with server:
            async with tcp_server:
                await asyncio.gather(
                    server.serve_forever(),
                    tcp_server.serve_forever()
                )

    async def handle_client(self, reader, writer):
        """Processa conexão de cliente (ND‑JSON, tolerante a frames parciais)."""
        addr = writer.get_extra_info('peername') or 'unix_socket'
        logger.info(f"Nova conexão: {addr}")

        buffer = ""
        warned_nonjson = False
        try:
            while True:
                data = await reader.read(65536)
                if not data:
                    break

                try:
                    chunk = data.decode('utf-8', errors='strict')
                except UnicodeDecodeError:
                    logger.error("JSON inválido: payload não‑UTF8")
                    continue

                buffer += chunk
                while '\n' in buffer:
                    line, buffer = buffer.split('\n', 1)
                    s = line.strip()
                    if not s:
                        continue
                    # Ignora ruído que não inicia com um objeto JSON
                    if not s.startswith('{'):
                        if not warned_nonjson:
                            logger.error("JSON inválido: linha não inicia com '{'")
                            warned_nonjson = True
                        continue

                    try:
                        message = NDJSONMessage.from_ndjson(s)
                        # Passa writer para permitir streaming de eventos
                        result = await self.processor.process_message(message, writer=writer)

                        # Se o processador não emitiu DONE, envia agora
                        done = NDJSONMessage(
                            action=NDJSONAction.DONE,
                            action_id=message.action_id,
                            input="",
                            result=result.result or result.input,
                            metadata={"status": "done"},
                            timestamp=datetime.now().isoformat(),
                            source=result.source,
                            model=result.model,
                        )
                        writer.write((done.to_ndjson() + '\n').encode('utf-8'))
                        await writer.drain()

                    except json.JSONDecodeError as e:
                        logger.error(f"JSON inválido: {e}")
                        error_response = json.dumps({"error": "Invalid JSON"}) + '\n'
                        writer.write(error_response.encode('utf-8'))
                        await writer.drain()
                    except Exception as e:
                        logger.error(f"Erro processando: {e}")
                        error_response = json.dumps({"error": str(e)}) + '\n'
                        writer.write(error_response.encode('utf-8'))
                        await writer.drain()

        except Exception as e:
            logger.error(f"Erro na conexão: {e}")
        finally:
            # Se restou algo sem newline, descarta silenciosamente
            buffer = ""
            logger.info(f"Conexão fechada: {addr}")
            writer.close()
            await writer.wait_closed()

async def main():
    """Função principal conforme arquitetura FazAI v2.0"""
    logger.info("Iniciando fazai-gemma-worker v2.0")
    logger.info(f"Unix Socket: {CONFIG['unix_socket']}")
    logger.info(f"TCP Server: {CONFIG['bind_host']}:{CONFIG['bind_port']}")

    processor = NDJSONProcessor()
    server = UnixSocketServer(processor)

    try:
        await server.start()
    except KeyboardInterrupt:
        logger.info("Worker interrompido pelo usuário")
    except Exception as e:
        logger.error(f"Erro fatal: {e}")
        raise

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("Worker interrompido pelo usuário")
    except Exception as e:
        logger.error(f"Erro fatal: {e}")
        sys.exit(1)
