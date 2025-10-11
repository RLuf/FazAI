"""OpenAI and OpenRouter provider with rate limiting and cost tracking."""

import asyncio
import logging
import time
from collections import deque
from typing import Optional

import httpx

from .base import InferenceProvider, InferenceResponse, ProviderError, ProviderTimeout

logger = logging.getLogger(__name__)


class RateLimiter:
    """Simple rate limiter for API requests."""

    def __init__(self, max_requests: int, time_window: float = 60.0):
        """Initialize rate limiter.

        Args:
            max_requests: Maximum requests allowed in time window
            time_window: Time window in seconds (default 60s = 1 minute)
        """
        self.max_requests = max_requests
        self.time_window = time_window
        self.requests: deque = deque()

    async def acquire(self):
        """Acquire permission to make a request (blocking if rate limit exceeded)."""
        now = time.time()

        # Remove old requests outside time window
        while self.requests and self.requests[0] < now - self.time_window:
            self.requests.popleft()

        # Check if we're at the limit
        if len(self.requests) >= self.max_requests:
            # Calculate sleep time
            oldest = self.requests[0]
            sleep_time = (oldest + self.time_window) - now
            if sleep_time > 0:
                logger.debug(f"Rate limit reached, sleeping for {sleep_time:.2f}s")
                await asyncio.sleep(sleep_time)
                # Retry after sleep
                await self.acquire()
                return

        # Record this request
        self.requests.append(now)


class OpenAIProvider(InferenceProvider):
    """OpenAI and OpenRouter API provider."""

    def __init__(
        self,
        api_key: Optional[str] = None,
        base_url: str = "https://api.openai.com/v1",
        model: str = "gpt-3.5-turbo",
        timeout: float = 5.0,
        rate_limit: int = 60,
        cost_per_token: float = 0.000001,
    ):
        """Initialize OpenAI provider.

        Args:
            api_key: OpenAI API key
            base_url: API base URL (use OpenRouter URL for OpenRouter)
            model: Model name to use
            timeout: Maximum inference time in seconds
            rate_limit: Max requests per minute
            cost_per_token: Cost per token in USD
        """
        super().__init__(
            timeout=timeout, tier=2, name="openai", cost_per_token=cost_per_token
        )

        self.api_key = api_key
        self.base_url = base_url.rstrip("/")
        self.model = model
        self.rate_limiter = RateLimiter(max_requests=rate_limit, time_window=60.0)
        self.total_cost = 0.0

        if not self.api_key:
            logger.warning("OpenAI provider initialized without API key")

    async def infer(self, prompt: str, **kwargs) -> InferenceResponse:
        """Execute OpenAI inference with timeout and rate limiting.

        Args:
            prompt: Input text prompt
            **kwargs: Additional parameters (max_tokens, temperature, etc.)

        Returns:
            InferenceResponse with result

        Raises:
            ProviderTimeout: If inference exceeds timeout
            ProviderError: If API call fails or no API key
        """
        if not self.api_key:
            raise ProviderError("OpenAI API key not configured")

        # Apply rate limiting
        await self.rate_limiter.acquire()

        logger.debug(f"OpenAI inference request: {prompt[:100]}...")

        # Prepare request
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

        payload = {
            "model": self.model,
            "messages": [{"role": "user", "content": prompt}],
            "max_tokens": kwargs.get("max_tokens", 1024),
            "temperature": kwargs.get("temperature", 0.1),
        }

        try:
            async with httpx.AsyncClient() as client:
                # Measure latency and apply timeout
                start_time = time.time()

                response = await asyncio.wait_for(
                    client.post(
                        f"{self.base_url}/chat/completions",
                        headers=headers,
                        json=payload,
                    ),
                    timeout=self.timeout,
                )
                latency = time.time() - start_time

                response.raise_for_status()
                data = response.json()

                # Extract response
                content = data["choices"][0]["message"]["content"]
                tokens_used = data["usage"]["total_tokens"]
                cost = tokens_used * self.cost_per_token

                self.total_cost += cost

                logger.info(
                    "OpenAI inference successful",
                    extra={
                        "latency_seconds": round(latency, 2),
                        "tokens": tokens_used,
                        "cost_usd": round(cost, 6),
                    },
                )

                return InferenceResponse(
                    success=True,
                    content=content,
                    source=self.name,
                    latency=latency,
                    fallback_tier=self.tier,
                    cost=cost,
                    tokens_used=tokens_used,
                )

        except asyncio.TimeoutError as e:
            logger.warning(f"OpenAI inference timeout after {self.timeout}s")
            raise ProviderTimeout(
                f"OpenAI inference timed out after {self.timeout}s"
            ) from e

        except httpx.HTTPStatusError as e:
            logger.error(
                f"OpenAI API error: {e.response.status_code} {e.response.text}"
            )
            raise ProviderError(f"OpenAI API error: {e.response.status_code}") from e

        except Exception as e:
            logger.error(f"OpenAI inference failed: {e}")
            raise ProviderError(f"OpenAI inference failed: {e}") from e

    async def health_check(self) -> bool:
        """Check if OpenAI API is accessible.

        Returns:
            True if API is accessible with valid key
        """
        if not self.api_key:
            return False

        try:
            headers = {
                "Authorization": f"Bearer {self.api_key}",
            }

            async with httpx.AsyncClient() as client:
                response = await asyncio.wait_for(
                    client.get(f"{self.base_url}/models", headers=headers),
                    timeout=5.0,
                )
                is_healthy = response.status_code == 200

            logger.debug(f"OpenAI provider health check: {is_healthy}")
            return is_healthy

        except Exception as e:
            logger.error(f"OpenAI health check failed: {e}")
            return False

    def get_total_cost(self) -> float:
        """Get total cost spent on this provider.

        Returns:
            Total cost in USD
        """
        return self.total_cost
