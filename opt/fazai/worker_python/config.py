"""Configuration management for FazAI Gemma Worker."""

import os
from pathlib import Path
from typing import Optional
from pydantic import BaseModel, Field, field_validator


class ModelConfig(BaseModel):
    """Configuration for the Gemma model."""

    model_path: str = Field(
        default="/opt/fazai/models/gemma/gemma-2-2b-it-Q4_K_M.gguf",
        description="Path to the GGUF model file"
    )
    n_ctx: int = Field(
        default=2048,
        description="Context window size",
        ge=512,
        le=4096
    )
    n_threads: Optional[int] = Field(
        default=None,
        description="Number of threads for inference (None = auto)"
    )
    n_gpu_layers: int = Field(
        default=1,
        description="Number of layers to offload to GPU"
    )
    verbose: bool = Field(
        default=False,
        description="Enable verbose logging from llama.cpp"
    )

    @field_validator("model_path")
    @classmethod
    def validate_model_path(cls, v: str) -> str:
        """Validate that model file exists."""
        # Skip validation in test mode
        if os.getenv("SKIP_MODEL_VALIDATION") == "1":
            return v
        if not os.path.exists(v):
            raise ValueError(f"Model file not found: {v}")
        return v


class InferenceConfig(BaseModel):
    """Configuration for inference parameters."""

    max_tokens: int = Field(
        default=1024,
        description="Maximum tokens to generate",
        ge=1,
        le=4096
    )
    temperature: float = Field(
        default=0.1,
        description="Sampling temperature",
        ge=0.0,
        le=2.0
    )
    top_p: float = Field(
        default=0.95,
        description="Nucleus sampling threshold",
        ge=0.0,
        le=1.0
    )
    top_k: int = Field(
        default=40,
        description="Top-k sampling parameter",
        ge=0
    )
    repeat_penalty: float = Field(
        default=1.1,
        description="Repetition penalty",
        ge=0.0,
        le=2.0
    )
    stop: list[str] = Field(
        default_factory=lambda: ["\n\n", "<|im_end|>"],
        description="Stop sequences"
    )


class WorkerConfig(BaseModel):
    """Main configuration for the worker."""

    model: ModelConfig = Field(default_factory=ModelConfig)
    inference: InferenceConfig = Field(default_factory=InferenceConfig)
    log_level: str = Field(
        default="DEBUG",
        description="Logging level"
    )

    @classmethod
    def from_env(cls) -> "WorkerConfig":
        """Load configuration from environment variables."""
        return cls(
            model=ModelConfig(
                model_path=os.getenv(
                    "GEMMA_MODEL_PATH",
                    "/opt/fazai/models/gemma/gemma-2-2b-it-Q4_K_M.gguf"
                ),
                n_ctx=int(os.getenv("GEMMA_N_CTX", "2048")),
                n_threads=int(os.getenv("GEMMA_N_THREADS")) if os.getenv("GEMMA_N_THREADS") else None,
                n_gpu_layers=int(os.getenv("GEMMA_N_GPU_LAYERS", "1")),
                verbose=os.getenv("GEMMA_VERBOSE", "true").lower() == "true"
            ),
            inference=InferenceConfig(
                max_tokens=int(os.getenv("GEMMA_MAX_TOKENS", "1024")),
                temperature=float(os.getenv("GEMMA_TEMPERATURE", "0.2")),
                top_p=float(os.getenv("GEMMA_TOP_P", "0.95")),
                top_k=int(os.getenv("GEMMA_TOP_K", "40")),
                repeat_penalty=float(os.getenv("GEMMA_REPEAT_PENALTY", "1.1"))
            ),
            log_level=os.getenv("LOG_LEVEL", "DEBUG")
        )
