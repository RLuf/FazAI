"""Base provider interface and response models."""

import time
from abc import ABC, abstractmethod
from typing import Optional

from pydantic import BaseModel, Field


class ProviderError(Exception):
    """Base exception for provider errors."""

    pass


class ProviderTimeout(ProviderError):
    """Exception raised when provider times out."""

    pass


class InferenceResponse(BaseModel):
    """Response from an inference provider."""

    success: bool = Field(..., description="Whether inference succeeded")
    content: str = Field(..., description="Generated content")
    source: str = Field(
        ..., description="Provider name (local, openai, context7, websearch)"
    )
    latency: float = Field(..., description="Inference latency in seconds", ge=0.0)
    fallback_tier: int = Field(..., description="Fallback tier (1-4)", ge=1, le=4)
    cost: float = Field(default=0.0, description="Cost in USD", ge=0.0)
    tokens_used: int = Field(default=0, description="Total tokens used", ge=0)
    error: Optional[str] = Field(default=None, description="Error message if failed")

    def with_metadata(self, metadata: dict) -> "InferenceResponse":
        """Return a copy with updated metadata.

        Args:
            metadata: Dictionary of fields to update

        Returns:
            New InferenceResponse with updated fields
        """
        return self.model_copy(update=metadata)


class InferenceProvider(ABC):
    """Abstract base class for inference providers."""

    def __init__(
        self, timeout: float, tier: int, name: str, cost_per_token: float = 0.0
    ):
        """Initialize provider.

        Args:
            timeout: Maximum time in seconds for inference
            tier: Fallback tier (1=primary, 4=last resort)
            name: Provider name for logging
            cost_per_token: Cost per token in USD (for paid APIs)
        """
        self.timeout = timeout
        self.tier = tier
        self.name = name
        self.cost_per_token = cost_per_token

    @abstractmethod
    async def infer(self, prompt: str, **kwargs) -> InferenceResponse:
        """Execute inference with timeout.

        Args:
            prompt: Input text prompt
            **kwargs: Additional provider-specific parameters

        Returns:
            InferenceResponse with result or error

        Raises:
            ProviderTimeout: If inference exceeds timeout
            ProviderError: If provider encounters an error
        """
        pass

    @abstractmethod
    async def health_check(self) -> bool:
        """Check if provider is available.

        Returns:
            True if provider is healthy and ready
        """
        pass

    async def _measure_latency(self, func):
        """Measure latency of an async function.

        Args:
            func: Async callable to measure

        Returns:
            Tuple of (result, latency_seconds)
        """
        start = time.time()
        result = await func()
        latency = time.time() - start
        return result, latency

    def __repr__(self) -> str:
        """String representation."""
        return f"{self.__class__.__name__}(tier={self.tier}, timeout={self.timeout}s)"
