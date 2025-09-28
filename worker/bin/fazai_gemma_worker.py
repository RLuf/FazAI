#!/usr/bin/env python3
"""
fazai-gemma-worker v2.0 - Worker ND-JSON oficial FazAI
Implementa protocolo completo conforme SPEC.md e arquitetura AGENTS.md
Socket: /run/fazai/gemma.sock + TCP 0.0.0.0:5555
"""

import asyncio
import json
import logging
import os
import uuid
import subprocess
import sys
import configparser
from dataclasses import dataclass, asdict
from datetime import datetime
from enum import Enum
from pathlib import Path
from typing import Optional, Dict, Any, List

# ===== IMPORTS OPCIONAIS (graceful degradation) =====
try:
    from qdrant_client import QdrantClient
    from qdrant_client.models import Distance, VectorParams, PointStruct
    QDRANT_AVAILABLE = True
except ImportError:
    print("Info: Qdrant opcional não disponível")
    QdrantClient = None
    QDRANT_AVAILABLE = False

try:
    import openai
    OPENAI_AVAILABLE = True
except ImportError:
    print("Info: OpenAI opcional não disponível")
    openai = None
    OPENAI_AVAILABLE = False

try:
    import httpx
    HTTPX_AVAILABLE = True
except ImportError:
    print("Info: httpx opcional não disponível") 
    httpx = None
    HTTPX_AVAILABLE = False

# ===== CONFIGURAÇÃO FAZAI v2.0 =====
def load_fazai_config() -> Dict[str, Any]:
    """Carrega config oficial /etc/fazai/fazai.conf"""
    config = configparser.ConfigParser()
    config_paths = ["/etc/fazai/fazai.conf", "/opt/fazai/etc/fazai.conf", "./etc/fazai/fazai.conf"]
    
    config_loaded = False
    for path in config_paths:
        if Path(path).exists():
            try:
                config.read(path)
                print(f"✓ Config carregado: {path}")
                config_loaded = True
                break
            except Exception as e:
                print(f"✗ Erro config {path}: {e}")
    
    if not config_loaded:
        print("⚠ Criando config padrão...")
        _create_default_config()
        config.read("/etc/fazai/fazai.conf")
    
    return {
        # Sockets e rede (acesso externo por padrão)
        "unix_socket": "/run/fazai/gemma.sock",
        "bind_host": config.get("gemma_worker", "host", fallback="0.0.0.0"),
        "bind_port": config.getint("gemma_worker", "port", fallback=5555),
        
        # Qdrant RAG
        "qdrant_host": config.get("qdrant", "host", fallback="127.0.0.1"),
        "qdrant_port": config.getint("qdrant", "port", fallback=6333),
        "qdrant_personality_collection": config.get("qdrant", "personality_collection", fallback=config.get("qdrant", "collection", fallback="fazai_memory")),
        "qdrant_knowledge_collection": config.get("qdrant", "knowledge_collection", fallback="fazai_kb"),
        "qdrant_vector_dim": config.getint("qdrant", "vector_dim", fallback=config.getint("qdrant", "dim", fallback=384)),
        "collection_name": config.get("qdrant", "collection", fallback=config.get("qdrant", "personality_collection", fallback="fazai_memory")),
        
        # Gemma local
        "gemma_model_path": config.get("gemma_cpp", "weights", fallback="/opt/fazai/models/gemma-2b-it.bin"),
        "gemma_timeout": config.getint("gemma_cpp", "generation_timeout", fallback=120),
        
        # Timeouts por ação
        "timeout_seconds": config.getint("dispatcher", "timeout_seconds", fallback=30),
        "shell_timeout": config.getint("dispatcher", "shell_timeout", fallback=60),
        "fallback_timeout": config.getint("dispatcher", "fallback_timeout", fallback=45),
        
        # APIs externas
        "openai_api_key": os.getenv("OPENAI_API_KEY", ""),
        "openrouter_api_key": os.getenv("OPENROUTER_API_KEY", ""),
        "context7_endpoint": config.get("context7", "endpoint", fallback="http://0.0.0.0:7777"),
        "context7_timeout": config.getint("context7", "timeout", fallback=10),
        
        # Fallback chain configurável
        "openai_model": config.get("openai", "model", fallback="gpt-4"),
        "openai_max_tokens": config.getint("openai", "max_tokens", fallback=2048),
        "openrouter_model": config.get("openrouter", "model", fallback="anthropic/claude-3-haiku"),
        "fallback_order": [s.strip() for s in config.get("dispatcher", "fallback_order", fallback="openai,openrouter,context7").split(",")],
        
        # Logging
        "log_level": "INFO"
    }

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
    config.set('gemma_worker', 'port', '5555')
    
    # Gemma C++
    config.add_section('gemma_cpp')
    config.set('gemma_cpp', 'weights', '/opt/fazai/models/gemma-2b-it.bin')
    config.set('gemma_cpp', 'generation_timeout', '120')
    
    # Qdrant RAG
    config.add_section('qdrant')
    config.set('qdrant', 'host', '127.0.0.1')
    config.set('qdrant', 'port', '6333')
    config.set('qdrant', 'personality_collection', 'fazai_memory')
    config.set('qdrant', 'knowledge_collection', 'fazai_kb')
    config.set('qdrant', 'vector_dim', '384')
    
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
    
    config.add_section('context7')
    config.set('context7', 'endpoint', 'http://0.0.0.0:7777')
    config.set('context7', 'timeout', '20')
    
    # Escreve config
    os.makedirs("/etc/fazai", exist_ok=True)
    with open("/etc/fazai/fazai.conf", 'w') as f:
        config.write(f)
    print("✓ Config padrão criado: /etc/fazai/fazai.conf")

CONFIG = load_fazai_config()

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
        data['action'] = NDJSONAction(data['action'])
        return cls(**data)

# ===== GEMMA BINDINGS WRAPPER =====
class GemmaBindingsWrapper:
    """Wrapper para bindings existentes conforme worker/"""
    
    def __init__(self, model_path: str):
        self.model_path = Path(model_path)
        self.model = None
        self._load_existing_bindings()
    
    def _load_existing_bindings(self):
        """Carrega bindings já compiladas"""
        try:
            script_dir = Path(__file__).parent
            sys.path.insert(0, str(script_dir))
            sys.path.insert(0, str(script_dir.parent))
            sys.path.insert(0, str(script_dir.parent / "lib"))

            binding_paths = [
                Path("/opt/fazai/lib/python/gemma_native.so"),
                script_dir.parent / "lib" / "gemma_native.so",
            ]

            binding_paths.extend(sorted(script_dir.glob("gemma_native*.so")))

            for path in binding_paths:
                path = Path(path)
                if path.exists():
                    import importlib.util
                    spec = importlib.util.spec_from_file_location("gemma_native", str(path))
                    if spec and spec.loader:
                        gemma_native = importlib.util.module_from_spec(spec)
                        spec.loader.exec_module(gemma_native)
                        self.model = gemma_native.GemmaNative()
                        logger.info(f"✓ Bindings carregadas: {path}")
                        return
            
            # Fallback import direto
            import gemma_native
            self.model = gemma_native.GemmaNative()
            logger.info("✓ Bindings carregadas (import direto)")
            
        except Exception as e:
            logger.warning(f"Bindings Gemma indisponíveis: {e}")
            self.model = None
    
    def generate(self, prompt: str, max_tokens: int = 512) -> str:
        """Gera usando bindings existentes"""
        if not self.model:
            raise RuntimeError("Bindings Gemma não disponíveis")
        
        try:
            result = self.model.generate(prompt)
            if not result or not result.strip():
                raise RuntimeError("Resposta vazia")
            return result.strip()
        except Exception as e:
            logger.error(f"Erro geração Gemma: {e}")
            raise

# ===== FALLBACK CHAIN INTELIGENTE =====
class FallbackChain:
    """Chain de fallbacks configurável via fazai.conf"""
    
    def __init__(self):
        self._setup_clients()
        
    def _setup_clients(self):
        """Setup clients das APIs externas"""
        # OpenAI
        self.openai_client = None
        if OPENAI_AVAILABLE and CONFIG["openai_api_key"]:
            self.openai_client = openai.OpenAI(api_key=CONFIG["openai_api_key"])
        
        # HTTP para OpenRouter/Context7
        self.http_client = None
        if HTTPX_AVAILABLE:
            self.http_client = httpx.Client(timeout=CONFIG["fallback_timeout"])
    
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
        if not HTTPX_AVAILABLE:
            return None
        
        try:
            logger.info("Fallback Context7")
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    CONFIG["context7_endpoint"],
                    json={"query": prompt},
                    timeout=CONFIG["context7_timeout"]
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
            embedding = [0.1] * self.vector_dim  # TODO: usar embedding real
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
        vector = [0.1] * self.vector_dim  # placeholder até termos embedder real
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
            return {"success": False, "error": "Timeout"}
        except Exception as e:
            logger.error(f"Erro executando comando: {e}")
            return {"success": False, "error": str(e)}

# ===== PROCESSADOR ND-JSON =====
class NDJSONProcessor:
    """Processador principal das ações ND-JSON"""
    
    def __init__(self):
        try:
            self.gemma = GemmaBindingsWrapper(CONFIG["gemma_model_path"])
        except Exception as e:
            logger.error(f"Erro inicializando Gemma: {e}")
            self.gemma = None
        
        self.personality_memory = QdrantMemory(
            CONFIG.get("qdrant_personality_collection"),
            label="personality",
            score_threshold=0.0
        )
        self.knowledge_memory = QdrantMemory(
            CONFIG.get("qdrant_knowledge_collection"),
            label="knowledge",
            score_threshold=0.6
        )
        # Compatibilidade com caminhos antigos
        self.memory = self.personality_memory if getattr(self.personality_memory, "client", None) else None
        self.fallback = FallbackHandler()
        self.executor = CommandExecutor()  # Instância da classe
        self.active_actions = {}  # Para idempotência
    
    async def process_message(self, message: NDJSONMessage) -> NDJSONMessage:
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
            # Processa por tipo de ação
            if message.action == NDJSONAction.ASK:
                result = await self._process_ask(message)
            elif message.action == NDJSONAction.RESEARCH:
                result = await self._process_research(message)
            elif message.action == NDJSONAction.SHELL:
                result = await self._process_shell(message)
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
    
    async def _process_ask(self, message: NDJSONMessage) -> str:
        """Processa ação ASK com Gemma"""
        if self.gemma and self.gemma.model:
            try:
                prompt = self._compose_prompt_with_memory(message.input, include_knowledge=True)
                return self.gemma.generate(prompt)
            except Exception as e:
                logger.warning(f"Gemma falhou, usando fallback: {e}")
        
        # Fallback para APIs externas
        return await self._fallback_generate(message.input)

    async def _process_research(self, message: NDJSONMessage) -> str:
        """Processa ação RESEARCH com busca na memória + fallbacks"""
        if self.knowledge_memory and getattr(self.knowledge_memory, "client", None):
            results = self.knowledge_memory.search(message.input, limit=5)
            if results:
                return self._format_knowledge_results(results)

        # Busca com fallbacks
        return await self._fallback_generate(message.input, research_mode=True)
    
    async def _process_shell(self, message: NDJSONMessage) -> str:
        """Processa ação SHELL - execução direta"""
        try:
            # Execução direta sem validações
            result = subprocess.run(
                message.input,
                shell=True,
                capture_output=True,
                text=True,
                timeout=CONFIG["shell_timeout"]
            )
            
            if result.returncode == 0:
                return result.stdout or "Executado"
            else:
                return f"Erro {result.returncode}: {result.stderr}"
                
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
            "Use as memórias e instruções a seguir para responder como Claudio, respeitando segurança e sigilo.\n"
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

    async def _fallback_generate(self, prompt: str, research_mode: bool = False) -> str:
        """Fallback inteligente usando chain configurável"""
        return await self.fallback.execute_fallback_chain(prompt, research_mode)

# ===== VECTOR MEMORY - JSON ESTRUTURADO =====
# Compatibilidade com código legado
VectorMemory = QdrantMemory

# ===== MAIN =====
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
    asyncio.run(main())

# ===== PROCESSADOR PRINCIPAL =====
class MessageProcessor:
    """Processa mensagens com pipeline completo"""
    
    def __init__(self):
        self.gemma = GemmaWrapper(CONFIG["gemma_model_path"])
        self.memory = VectorMemory()
        self.fallback = FallbackHandler()
        self.executor = CommandExecutor()
    
    async def process(self, message: Message) -> Message:
        """Pipeline de processamento"""
        logger.info(f"Processando: {message.type.value} - {message.input[:50]}...")
        
        # Timestamp
        message.timestamp = datetime.now().isoformat()
        
        # Busca na memória primeiro
        memory_results = self.memory.search(message.input)
        if memory_results and memory_results[0]["score"] > 0.8:
            logger.info("Resposta encontrada na memória")
            message.result = memory_results[0]["text"]
            message.origin = Origin.MEMORY
            return message
        
        # Processa por tipo
        if message.type == MessageType.COMMAND:
            result = await self._process_command(message)
        elif message.type == MessageType.QUERY:
            result = await self._process_query(message)
        else:
            result = await self._process_system(message)
        
        # Armazena na memória para futuro
        if result and message.origin == Origin.LOCAL:
            self.memory.store(
                text=result,
                metadata={"input": message.input, "type": message.type.value}
            )
        
        message.result = result
        return message
    
    async def _process_command(self, message: Message) -> str:
        """Processa comandos shell"""
        result = self.executor.execute(message.input)
        message.origin = Origin.SHELL
        
        if result["success"]:
            return result["stdout"] or "Comando executado com sucesso"
        else:
            return f"Erro: {result.get('error', result.get('stderr', 'Desconhecido'))}"
    
    async def _process_query(self, message: Message) -> str:
        """Processa queries com pipeline de fallback e ROTULAGEM DE FONTE conforme Ordem Zero"""

        # Inicializa metadata para rotulagem consistente
        if not message.metadata:
            message.metadata = {}

        # 1. Tenta Gemma local
        try:
            result = self.gemma.generate(message.input)
            if result:
                message.origin = Origin.LOCAL
                # ROTULAGEM DE FONTE GEMMA: source/model/bits conforme Ordem Zero
                message.metadata.update({
                    "source": "gemma_local",
                    "model": CONFIG.get("gemma_cpp", {}).get("default_model", "gemma2-2b-it"),
                    "bits": 8,  # SFP quantização
                    "quantization": "sfp"
                })
                return result
        except Exception as e:
            logger.error(f"Erro Gemma: {e}")

        # 2. Fallbacks em cascata com rotulagem específica
        message.origin = Origin.FALLBACK

        # OpenAI
        result = self.fallback.query_openai(message.input)
        if result:
            message.metadata.update({
                "source": "openai",
                "model": "gpt-3.5-turbo",
                "provider": "openai"
            })
            return result

        # OpenRouter
        result = self.fallback.query_openrouter(message.input)
        if result:
            message.metadata.update({
                "source": "openrouter",
                "model": "openai/gpt-3.5-turbo",
                "provider": "openrouter"
            })
            return result

        # Context7
        result = self.fallback.query_context7(message.input)
        if result:
            message.metadata.update({
                "source": "context7",
                "endpoint": CONFIG.get("context7_endpoint", "http://localhost:7777"),
                "provider": "context7"
            })
            return result

        # Internet - último recurso
        result = self.fallback.search_internet(message.input)
        if result:
            message.metadata.update({
                "source": "internet",
                "engine": "duckduckgo",
                "provider": "internet"
            })
            return result

        # Falhou tudo
        return "Não foi possível processar sua solicitação no momento"
    
    async def _process_system(self, message: Message) -> str:
        """Processa comandos do sistema"""
        message.origin = Origin.LOCAL
        
        if message.input == "status":
            return json.dumps({
                "status": "running",
                "gemma": "loaded" if self.gemma.model else "not_loaded",
                "memory": "connected" if self.memory.client else "disconnected",
                "timestamp": datetime.now().isoformat()
            })
        elif message.input == "shutdown":
            return "Shutting down..."
        else:
            return f"Unknown system command: {message.input}"

# ===== SOCKET SERVER =====
class SocketServer:
    """Servidor socket para receber conexões"""
    
    def __init__(self, processor: MessageProcessor):
        self.processor = processor
        self.running = False
        self.server = None
    
    async def start_tcp(self):
        """Inicia servidor TCP"""
        server = await asyncio.start_server(
            self.handle_client,
            CONFIG["socket_host"],
            CONFIG["socket_port"]
        )
        
        addr = server.sockets[0].getsockname()
        logger.info(f"Servidor TCP rodando em {addr[0]}:{addr[1]}")
        
        self.running = True
        async with server:
            await server.serve_forever()
    
    async def start_unix(self):
        """Inicia servidor Unix domain socket"""
        socket_path = Path(CONFIG["unix_socket"])
        if socket_path.exists():
            socket_path.unlink()
        
        server = await asyncio.start_unix_server(
            self.handle_client,
            path=str(socket_path)
        )
        
        logger.info(f"Servidor Unix socket em {socket_path}")
        
        self.running = True
        async with server:
            await server.serve_forever()
    
    async def handle_client(self, reader, writer):
        """Processa conexão de cliente"""
        addr = writer.get_extra_info('peername')
        logger.info(f"Nova conexão de {addr}")
        
        try:
            while True:
                # Lê mensagem (até 64KB)
                data = await reader.read(65536)
                if not data:
                    break
                
                # Processa cada linha (NDJSON support)
                lines = data.decode('utf-8').strip().split('\n')
                
                for line in lines:
                    if not line:
                        continue
                    
                    try:
                        # Parse mensagem
                        message = Message.from_json(line)
                        
                        # Processa
                        result = await self.processor.process(message)
                        
                        # Envia resposta
                        response = result.to_json() + '\n'
                        writer.write(response.encode('utf-8'))
                        await writer.drain()
                        
                        # Shutdown especial
                        if message.type == MessageType.SYSTEM and message.input == "shutdown":
                            self.running = False
                            asyncio.get_event_loop().stop()
                            
                    except json.JSONDecodeError as e:
                        logger.error(f"JSON inválido: {e}")
                        error_msg = json.dumps({
                            "error": "Invalid JSON",
                            "details": str(e)
                        }) + '\n'
                        writer.write(error_msg.encode('utf-8'))
                        await writer.drain()
                    except Exception as e:
                        logger.error(f"Erro processando: {e}")
                        error_msg = json.dumps({
                            "error": "Processing error",
                            "details": str(e)
                        }) + '\n'
                        writer.write(error_msg.encode('utf-8'))
                        await writer.drain()
        
        except Exception as e:
            logger.error(f"Erro na conexão: {e}")
        finally:
            logger.info(f"Conexão fechada de {addr}")
            writer.close()
            await writer.wait_closed()

# ===== MCP SERVER WRAPPER =====
class MCPServerWrapper:
    """Wrapper para integração com MCP (Model Context Protocol)"""
    
    def __init__(self, processor: MessageProcessor):
        self.processor = processor
        self.handlers = {
            "process": self.handle_process,
            "status": self.handle_status,
            "memory_search": self.handle_memory_search,
            "memory_store": self.handle_memory_store,
        }
    
    async def handle_request(self, request: Dict) -> Dict:
        """Processa requisição MCP"""
        method = request.get("method", "")
        params = request.get("params", {})
        
        handler = self.handlers.get(method)
        if not handler:
            return {
                "error": f"Unknown method: {method}",
                "available_methods": list(self.handlers.keys())
            }
        
        try:
            result = await handler(params)
            return {"result": result}
        except Exception as e:
            logger.error(f"Erro MCP: {e}")
            return {"error": str(e)}
    
    async def handle_process(self, params: Dict) -> Dict:
        """Processa mensagem via MCP"""
        message = Message(
            input=params.get("input", ""),
            type=MessageType(params.get("type", "query"))
        )
        
        result = await self.processor.process(message)
        return asdict(result)
    
    async def handle_status(self, params: Dict) -> Dict:
        """Retorna status do sistema"""
        return {
            "status": "running",
            "components": {
                "gemma": bool(self.processor.gemma.model),
                "memory": bool(self.processor.memory.client),
                "fallback": bool(self.processor.fallback.http_client)
            },
            "timestamp": datetime.now().isoformat()
        }
    
    async def handle_memory_search(self, params: Dict) -> List[Dict]:
        """Busca na memória vetorial"""
        query = params.get("query", "")
        limit = params.get("limit", 5)
        return self.processor.memory.search(query, limit)
    
    async def handle_memory_store(self, params: Dict) -> Dict:
        """Armazena na memória vetorial"""
        text = params.get("text", "")
        metadata = params.get("metadata", {})
        self.processor.memory.store(text, metadata)
        return {"success": True}

# ===== MAIN =====
async def main():
    """Função principal do daemon"""
    logger.info("=== fazai-gemma-worker iniciando ===")
    logger.info("Para o andarilho dos véus, com memória e sabedoria")
    
    # Inicializa processador
    processor = MessageProcessor()
    
    # Inicializa MCP wrapper
    mcp_wrapper = MCPServerWrapper(processor)
    
    # Inicializa servidor socket
    server = SocketServer(processor)
    
    # Escolhe tipo de socket
    if CONFIG["use_unix_socket"]:
        await server.start_unix()
    else:
        await server.start_tcp()

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("Daemon interrompido pelo usuário")
    except Exception as e:
        logger.error(f"Erro fatal: {e}")
        sys.exit(1)
