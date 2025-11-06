"""
Cache Manager - Integração com GPTCache
Sistema de cache inteligente para respostas LLM com similaridade semântica
"""

import logging
from typing import Optional, Dict, Any
from dataclasses import dataclass

from gptcache import cache
from gptcache.manager.factory import manager_factory
from gptcache.processor.pre import get_prompt
from gptcache.embedding.huggingface import HuggingfaceEmbedding
from gptcache.adapter import openai as gptcache_openai
from gptcache.adapter import google_genai as gptcache_google

from framework_config import FrameworkConfig

@dataclass
class CacheStats:
    """Estatísticas do cache"""
    hits: int = 0
    misses: int = 0
    total_requests: int = 0

    @property
    def hit_rate(self) -> float:
        if self.total_requests == 0:
            return 0.0
        return self.hits / self.total_requests

class CacheManager:
    """Gerenciador de cache inteligente"""

    def __init__(self, config: FrameworkConfig):
        self.config = config
        self.logger = logging.getLogger(__name__)
        self.stats = CacheStats()
        self._initialized = False

        if config.enable_cache:
            self._initialize_cache()

    def _initialize_cache(self):
        """Inicializa o sistema de cache GPTCache"""
        try:
            # Configurar embedding para similaridade semântica
            hf_embedding = HuggingfaceEmbedding(self.config.cache.embedding_model)

            # Configurar gerenciadores de dados
            data_manager = manager_factory(
                "sqlite", 
                data_dir=".", 
                scalar_name=self.config.cache.db_file
            )

            vector_manager = manager_factory(
                "sqlite", 
                data_dir=".", 
                vector_name=self.config.cache.db_file
            )

            # Inicializar cache
            cache.init(
                pre_embedding_func=get_prompt,
                embedding_func=hf_embedding.to_embeddings,
                data_manager=data_manager,
                vector_manager=vector_manager,
                similarity_threshold=self.config.cache.similarity_threshold
            )

            # Desabilitar logs do cache para reduzir ruído
            cache.set_logger(None)

            self._initialized = True
            self.logger.info("GPTCache inicializado com sucesso")

        except Exception as e:
            self.logger.error(f"Erro ao inicializar GPTCache: {e}")
            self._initialized = False

    def wrap_openai_client(self, client):
        """Envolve cliente OpenAI com cache"""
        if not self._initialized:
            return client

        try:
            cached_client = gptcache_openai.ChatCompletion(client=client)
            self.logger.info("Cliente OpenAI envolvido com cache")
            return cached_client
        except Exception as e:
            self.logger.error(f"Erro ao envolver cliente OpenAI: {e}")
            return client

    def wrap_genai_model(self, model):
        """Envolve modelo GenAI com cache"""
        if not self._initialized:
            return model

        try:
            cached_model = gptcache_google.GenerativeModel(gemini_model=model)
            self.logger.info("Modelo GenAI envolvido com cache")
            return cached_model
        except Exception as e:
            self.logger.error(f"Erro ao envolver modelo GenAI: {e}")
            return model

    def clear_cache(self):
        """Limpa o cache"""
        if not self._initialized:
            return

        try:
            cache.flush()
            self.logger.info("Cache limpo")
        except Exception as e:
            self.logger.error(f"Erro ao limpar cache: {e}")

    def get_cache_stats(self) -> Dict[str, Any]:
        """Retorna estatísticas do cache"""
        return {
            "hits": self.stats.hits,
            "misses": self.stats.misses,
            "total_requests": self.stats.total_requests,
            "hit_rate": self.stats.hit_rate,
            "initialized": self._initialized
        }

    def set_similarity_threshold(self, threshold: float):
        """Ajusta threshold de similaridade do cache"""
        if 0.0 <= threshold <= 1.0:
            self.config.cache.similarity_threshold = threshold
            self.logger.info(f"Threshold de similaridade ajustado para {threshold}")
        else:
            self.logger.warning("Threshold deve estar entre 0.0 e 1.0")

    def is_enabled(self) -> bool:
        """Verifica se o cache está habilitado e funcionando"""
        return self.config.enable_cache and self._initialized

# Cache context manager para uso avançado
class CacheContext:
    """Context manager para controle fino do cache"""

    def __init__(self, cache_manager: CacheManager, enabled: bool = True):
        self.cache_manager = cache_manager
        self.enabled = enabled
        self.original_enabled = cache_manager.config.enable_cache

    def __enter__(self):
        self.cache_manager.config.enable_cache = self.enabled
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        self.cache_manager.config.enable_cache = self.original_enabled
