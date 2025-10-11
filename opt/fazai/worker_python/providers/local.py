"""Local Gemma provider using llama-cpp-python."""

import asyncio
import logging
from typing import Optional

from worker_python.main import GemmaWorker
from worker_python.config import WorkerConfig

from .base import InferenceProvider, InferenceResponse, ProviderError, ProviderTimeout

logger = logging.getLogger(__name__)


class LocalGemmaProvider(InferenceProvider):
    """Local Gemma inference provider wrapper."""

    def __init__(
        self,
        worker: Optional[GemmaWorker] = None,
        timeout: float = 2.0,
        config: Optional[WorkerConfig] = None,
    ):
        """Initialize local Gemma provider.

        Args:
            worker: Existing GemmaWorker instance (optional, will create if None)
            timeout: Maximum inference time in seconds
            config: Worker configuration (used if worker is None)
        """
        super().__init__(timeout=timeout, tier=1, name="local", cost_per_token=0.0)

        if worker is None:
            if config is None:
                config = WorkerConfig.from_env()
            try:
                self.worker = GemmaWorker(config)
                logger.info("Local Gemma provider initialized with new worker")
            except Exception as e:
                logger.error(f"Failed to initialize local worker: {e}")
                raise ProviderError(f"Local worker initialization failed: {e}") from e
        else:
            self.worker = worker
            logger.info("Local Gemma provider initialized with existing worker")

    async def infer(self, prompt: str, **kwargs) -> InferenceResponse:
        """Execute local inference with timeout.

        Args:
            prompt: Input text prompt
            **kwargs: Additional inference parameters (max_tokens, temperature, etc.)

        Returns:
            InferenceResponse with result

        Raises:
            ProviderTimeout: If inference exceeds timeout
            ProviderError: If inference fails
        """
        logger.debug(f"Local inference request: {prompt[:100]}...")

        try:
            # Run in executor to avoid blocking event loop
            loop = asyncio.get_event_loop()

            # Create inference task with timeout
            task = loop.run_in_executor(
                None,
                lambda: self.worker.infer(
                    prompt=prompt,
                    max_tokens=kwargs.get("max_tokens"),
                    temperature=kwargs.get("temperature"),
                    top_p=kwargs.get("top_p"),
                    top_k=kwargs.get("top_k"),
                    stop=kwargs.get("stop"),
                ),
            )

            # Measure latency
            result, latency = await self._measure_latency(
                lambda: asyncio.wait_for(task, timeout=self.timeout)
            )

            logger.info(
                "Local inference successful",
                extra={"latency_seconds": round(latency, 2)},
            )

            return InferenceResponse(
                success=True,
                content=result,
                source=self.name,
                latency=latency,
                fallback_tier=self.tier,
                cost=0.0,  # Local inference is free
                tokens_used=0,  # Could extract from worker stats if needed
            )

        except asyncio.TimeoutError as e:
            logger.warning(f"Local inference timeout after {self.timeout}s")
            raise ProviderTimeout(
                f"Local inference timed out after {self.timeout}s"
            ) from e

        except Exception as e:
            logger.error(f"Local inference failed: {e}")
            raise ProviderError(f"Local inference failed: {e}") from e

    async def health_check(self) -> bool:
        """Check if local worker is ready.

        Returns:
            True if worker is loaded and ready
        """
        try:
            if self.worker is None:
                return False

            stats = self.worker.get_stats()
            is_healthy = stats.get("model_loaded", False)

            logger.debug(f"Local provider health check: {is_healthy}")
            return is_healthy

        except Exception as e:
            logger.error(f"Local health check failed: {e}")
            return False
