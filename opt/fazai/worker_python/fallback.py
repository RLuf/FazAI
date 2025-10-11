"""Fallback chain orchestrator for multi-tier inference."""

import logging
import os
from typing import Optional

from pydantic import BaseModel, Field

from .providers.base import (
    InferenceProvider,
    InferenceResponse,
    ProviderError,
    ProviderTimeout,
)
from .providers.local import LocalGemmaProvider
from .providers.openai_provider import OpenAIProvider
from .providers.context7_provider import Context7Provider
from .providers.websearch_provider import WebSearchProvider
from .config import WorkerConfig
from .main import GemmaWorker

logger = logging.getLogger(__name__)


class FallbackConfig(BaseModel):
    """Configuration for fallback chain."""

    local_timeout: float = Field(
        default=2.0, description="Local inference timeout (seconds)", ge=0.1
    )
    openai_timeout: float = Field(
        default=5.0, description="OpenAI timeout (seconds)", ge=0.1
    )
    context7_timeout: float = Field(
        default=10.0, description="Context7 timeout (seconds)", ge=0.1
    )
    websearch_timeout: float = Field(
        default=15.0, description="Web search timeout (seconds)", ge=0.1
    )

    openai_api_key: Optional[str] = Field(default=None, description="OpenAI API key")
    openrouter_api_key: Optional[str] = Field(
        default=None, description="OpenRouter API key"
    )
    openai_model: str = Field(default="gpt-3.5-turbo", description="OpenAI model name")
    openrouter_model: str = Field(
        default="anthropic/claude-3-haiku", description="OpenRouter model"
    )

    rate_limit_openai: int = Field(
        default=60, description="OpenAI rate limit (requests/min)", ge=1
    )
    cost_limit_daily: float = Field(
        default=5.0, description="Daily cost limit (USD)", ge=0.0
    )

    enable_local: bool = Field(default=True, description="Enable local Gemma inference")
    enable_openai: bool = Field(default=True, description="Enable OpenAI fallback")
    enable_context7: bool = Field(default=True, description="Enable Context7 MCP")
    enable_websearch: bool = Field(
        default=True, description="Enable web search fallback"
    )

    prefer_openrouter: bool = Field(
        default=False, description="Prefer OpenRouter over OpenAI"
    )

    @classmethod
    def from_env(cls) -> "FallbackConfig":
        """Load configuration from environment variables.

        Returns:
            FallbackConfig instance with values from environment
        """
        return cls(
            local_timeout=float(os.getenv("FALLBACK_LOCAL_TIMEOUT", "2.0")),
            openai_timeout=float(os.getenv("FALLBACK_OPENAI_TIMEOUT", "5.0")),
            context7_timeout=float(os.getenv("FALLBACK_CONTEXT7_TIMEOUT", "10.0")),
            websearch_timeout=float(os.getenv("FALLBACK_WEBSEARCH_TIMEOUT", "15.0")),
            openai_api_key=os.getenv("OPENAI_API_KEY"),
            openrouter_api_key=os.getenv("OPENROUTER_API_KEY"),
            openai_model=os.getenv("OPENAI_MODEL", "gpt-3.5-turbo"),
            openrouter_model=os.getenv("OPENROUTER_MODEL", "anthropic/claude-3-haiku"),
            rate_limit_openai=int(os.getenv("FALLBACK_RATE_LIMIT_OPENAI", "60")),
            cost_limit_daily=float(os.getenv("FALLBACK_COST_LIMIT_DAILY", "5.0")),
            enable_local=os.getenv("FALLBACK_ENABLE_LOCAL", "true").lower() == "true",
            enable_openai=os.getenv("FALLBACK_ENABLE_OPENAI", "true").lower() == "true",
            enable_context7=os.getenv("FALLBACK_ENABLE_CONTEXT7", "true").lower()
            == "true",
            enable_websearch=os.getenv("FALLBACK_ENABLE_WEBSEARCH", "true").lower()
            == "true",
            prefer_openrouter=os.getenv("FALLBACK_PREFER_OPENROUTER", "false").lower()
            == "true",
        )


class AllProvidersFailed(ProviderError):
    """Exception raised when all providers in chain fail."""

    pass


class FallbackChain:
    """Cascading fallback chain for inference across multiple providers."""

    def __init__(
        self,
        config: Optional[FallbackConfig] = None,
        worker: Optional[GemmaWorker] = None,
        providers: Optional[list[InferenceProvider]] = None,
    ):
        """Initialize fallback chain.

        Args:
            config: Fallback configuration (uses env defaults if None)
            worker: Existing GemmaWorker instance (creates new if None)
            providers: Custom provider list (uses config-based providers if None)
        """
        self.config = config or FallbackConfig.from_env()
        self.providers: list[InferenceProvider] = []
        self.total_cost = 0.0

        if providers is not None:
            # Use custom providers (for testing)
            self.providers = providers
            logger.info(f"Initialized with {len(providers)} custom providers")
        else:
            # Build providers from config
            self._build_providers(worker)

        logger.info(
            f"FallbackChain initialized with {len(self.providers)} providers: "
            f"{[p.name for p in self.providers]}"
        )

    def _build_providers(self, worker: Optional[GemmaWorker] = None):
        """Build provider chain from configuration.

        Args:
            worker: Optional existing GemmaWorker instance
        """
        # Tier 1: Local Gemma
        if self.config.enable_local:
            try:
                local_provider = LocalGemmaProvider(
                    worker=worker,
                    timeout=self.config.local_timeout,
                    config=WorkerConfig.from_env() if worker is None else None,
                )
                self.providers.append(local_provider)
                logger.info("Local Gemma provider enabled (tier 1)")
            except Exception as e:
                logger.warning(f"Failed to initialize local provider: {e}")

        # Tier 2: OpenAI or OpenRouter
        if self.config.enable_openai:
            if self.config.prefer_openrouter and self.config.openrouter_api_key:
                openai_provider = OpenAIProvider(
                    api_key=self.config.openrouter_api_key,
                    base_url="https://openrouter.ai/api/v1",
                    model=self.config.openrouter_model,
                    timeout=self.config.openai_timeout,
                    rate_limit=self.config.rate_limit_openai,
                    cost_per_token=0.000001,  # Approximate
                )
                logger.info("OpenRouter provider enabled (tier 2)")
            elif self.config.openai_api_key:
                openai_provider = OpenAIProvider(
                    api_key=self.config.openai_api_key,
                    base_url="https://api.openai.com/v1",
                    model=self.config.openai_model,
                    timeout=self.config.openai_timeout,
                    rate_limit=self.config.rate_limit_openai,
                    cost_per_token=0.000001,
                )
                logger.info("OpenAI provider enabled (tier 2)")
            else:
                openai_provider = None
                logger.warning("OpenAI/OpenRouter enabled but no API key configured")

            if openai_provider:
                self.providers.append(openai_provider)

        # Tier 3: Context7 MCP
        if self.config.enable_context7:
            context7_provider = Context7Provider(timeout=self.config.context7_timeout)
            self.providers.append(context7_provider)
            logger.info("Context7 MCP provider enabled (tier 3)")

        # Tier 4: Web Search
        if self.config.enable_websearch:
            websearch_provider = WebSearchProvider(
                timeout=self.config.websearch_timeout
            )
            self.providers.append(websearch_provider)
            logger.info("Web search provider enabled (tier 4)")

    async def infer(self, prompt: str, **kwargs) -> InferenceResponse:
        """Execute inference with cascading fallback.

        Tries each provider in order until one succeeds.

        Args:
            prompt: Input text prompt
            **kwargs: Additional inference parameters

        Returns:
            InferenceResponse from successful provider

        Raises:
            AllProvidersFailed: If all providers fail or timeout
        """
        if not self.providers:
            raise AllProvidersFailed("No providers configured")

        logger.info(f"Starting fallback chain for prompt: {prompt[:100]}...")

        last_error: Optional[Exception] = None

        for provider in self.providers:
            logger.debug(f"Trying provider: {provider.name} (tier {provider.tier})")

            try:
                # Attempt inference with this provider
                response = await provider.infer(prompt, **kwargs)

                if response.success:
                    # Track cost
                    self.total_cost += response.cost

                    # Check daily cost limit
                    if self.total_cost > self.config.cost_limit_daily:
                        logger.warning(
                            f"Daily cost limit exceeded: ${self.total_cost:.4f} > ${self.config.cost_limit_daily}"
                        )

                    logger.info(
                        f"Inference successful via {provider.name}",
                        extra={
                            "tier": provider.tier,
                            "latency": round(response.latency, 2),
                            "cost": round(response.cost, 6),
                        },
                    )

                    return response

            except ProviderTimeout as e:
                logger.warning(f"Provider {provider.name} timed out: {e}")
                last_error = e
                continue

            except ProviderError as e:
                logger.error(f"Provider {provider.name} failed: {e}")
                last_error = e
                continue

            except Exception as e:
                logger.error(f"Unexpected error from {provider.name}: {e}")
                last_error = e
                continue

        # All providers failed
        error_msg = f"All providers failed (tried {len(self.providers)} providers)"
        if last_error:
            error_msg += f": {last_error}"

        logger.error(error_msg)
        raise AllProvidersFailed(error_msg)

    async def health_check(self) -> dict[str, bool]:
        """Check health of all providers.

        Returns:
            Dictionary mapping provider name to health status
        """
        health_status = {}

        tasks = [
            (provider.name, provider.health_check()) for provider in self.providers
        ]

        for name, health_task in tasks:
            try:
                is_healthy = await health_task
                health_status[name] = is_healthy
            except Exception as e:
                logger.error(f"Health check failed for {name}: {e}")
                health_status[name] = False

        return health_status

    def get_total_cost(self) -> float:
        """Get total cost spent across all providers.

        Returns:
            Total cost in USD
        """
        return self.total_cost

    def get_provider_stats(self) -> list[dict]:
        """Get statistics for all providers.

        Returns:
            List of provider statistics
        """
        stats = []
        for provider in self.providers:
            stat = {
                "name": provider.name,
                "tier": provider.tier,
                "timeout": provider.timeout,
                "cost_per_token": provider.cost_per_token,
            }

            # Add provider-specific stats
            if hasattr(provider, "get_total_cost"):
                stat["total_cost"] = provider.get_total_cost()

            stats.append(stat)

        return stats
