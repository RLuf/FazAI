"""
Framework GenAI Mini - Configurações Centralizadas
Baseado no código genai_engine.py fornecido, com melhorias e automação
"""

import os
from typing import Dict, List, Optional
from dataclasses import dataclass
from enum import Enum

@dataclass
class QdrantConfig:
    """Configurações do Qdrant"""
    host: str = "localhost"
    port: int = 6333
    collection_logs: str = "fazai_logs_execucao"
    collection_memories: str = "fz_memories"
    collection_personality: str = "fazai_personalidade"
    embedding_model: str = "models/text-embedding-004"
    embedding_dim: int = 768

@dataclass
class LlamaConfig:
    """Configurações dos servidores Llama.cpp"""
    urls: Dict[str, str] = None
    models: Dict[str, str] = None

    def __post_init__(self):
        if self.urls is None:
            self.urls = {
                "gerente": "http://localhost:8000/v1",
                "analista": "http://localhost:8001/v1", 
                "programador": "http://localhost:8002/v1"
            }
        if self.models is None:
            self.models = {
                "gerente": "gemma-2-9b-it.gguf",
                "analista": "gemma-2-9b-it.gguf",
                "programador": "CodeGemma-7B.gguf"
            }

@dataclass
class GenAIConfig:
    """Configurações do Google GenAI"""
    api_key: str = ""
    supervisor_model: str = "gemini-1.5-pro-latest"
    embedding_model: str = "models/text-embedding-004"

@dataclass
class CacheConfig:
    """Configurações do GPTCache"""
    db_file: str = "fazai_cache.db"
    embedding_model: str = "sentence-transformers/all-MiniLM-L6-v2"
    similarity_threshold: float = 0.98

@dataclass  
class ClaudeConfig:
    """Configurações para integração com Claude"""
    json_export_path: str = "./claude_exports"
    personality_file: str = "claude_personality.json"
    conversations_file: str = "claude_conversations.json"

class EscalationLevel(Enum):
    """Níveis de escalonamento hierárquico"""
    N1_CACHE_LOCAL = 1
    N2_LOCAL_MEMORIA = 2
    N3_EQUIPE_LOCAL = 3
    N4_SUPERVISOR_ONLINE = 4
    DESISTIR = 5

@dataclass
class FrameworkConfig:
    """Configuração principal do framework"""
    qdrant: QdrantConfig = None
    llama: LlamaConfig = None
    genai: GenAIConfig = None
    cache: CacheConfig = None
    claude: ClaudeConfig = None

    # Configurações gerais
    max_steps: int = 30
    timeout_seconds: int = 30
    log_level: str = "INFO"
    enable_cache: bool = True
    enable_fallback: bool = True

    def __post_init__(self):
        if self.qdrant is None:
            self.qdrant = QdrantConfig()
        if self.llama is None:
            self.llama = LlamaConfig()
        if self.genai is None:
            self.genai = GenAIConfig()
        if self.cache is None:
            self.cache = CacheConfig()
        if self.claude is None:
            self.claude = ClaudeConfig()

    @classmethod
    def from_env(cls) -> 'FrameworkConfig':
        """Carrega configuração de variáveis de ambiente"""
        config = cls()

        # Google API Key
        config.genai.api_key = os.getenv('GOOGLE_API_KEY', '')

        # Qdrant
        config.qdrant.host = os.getenv('QDRANT_HOST', 'localhost')
        config.qdrant.port = int(os.getenv('QDRANT_PORT', '6333'))

        # Cache
        config.cache.db_file = os.getenv('CACHE_DB_FILE', 'fazai_cache.db')

        return config

# Configuração global padrão
DEFAULT_CONFIG = FrameworkConfig()
