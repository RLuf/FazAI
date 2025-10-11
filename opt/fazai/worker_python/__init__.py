"""FazAI Gemma Worker - Local LLM inference module."""

from .config import WorkerConfig, ModelConfig, InferenceConfig
from .main import GemmaWorker
from .api import app

__version__ = "2.0.0"
__all__ = ["GemmaWorker", "WorkerConfig", "ModelConfig", "InferenceConfig", "app"]
