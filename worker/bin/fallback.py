#!/usr/bin/env python3
"""
FazAI Fallback Chain Manager - Issue #67
4-tier cascading fallback: Local Gemma → OpenAI/OpenRouter → Context7 MCP → Web Search

Architecture:
- Tier 1: Local Gemma model (fastest, most private)
- Tier 2: OpenAI/OpenRouter (cloud APIs with rate limiting)
- Tier 3: Context7 MCP (documentation queries)
- Tier 4: Web Search (DuckDuckGo fallback)

Each provider has:
- 10s timeout per tier
- Graceful error handling
- Standardized response format
- Source attribution
"""

import asyncio
import json
import logging
import os
from dataclasses import dataclass
from datetime import datetime, timedelta
from enum import Enum
from typing import Optional, Dict, Any, Callable
from pathlib import Path

# Optional dependencies
try:
    import httpx
    HTTPX_AVAILABLE = True
except ImportError:
    httpx = None
    HTTPX_AVAILABLE = False

try:
    import openai
    OPENAI_AVAILABLE = True
except ImportError:
    openai = None
    OPENAI_AVAILABLE = False

logger = logging.getLogger("fazai-fallback")


class InferenceSource(Enum):
    """Source attribution for inference responses"""
    LOCAL = "local"
    OPENAI = "openai"
    OPENROUTER = "openrouter"
    CONTEXT7 = "context7"
    WEB_SEARCH = "web"
    FAILED = "failed"


@dataclass
class InferenceResponse:
    """Standardized response format from any provider"""
    success: bool
    content: str
    source: InferenceSource
    provider: str
    elapsed_ms: int
    error: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "success": self.success,
            "content": self.content,
            "source": self.source.value,
            "provider": self.provider,
            "elapsed_ms": self.elapsed_ms,
            "error": self.error,
            "metadata": self.metadata or {}
        }


class RateLimiter:
    """Simple daily rate limiter for API calls"""

    def __init__(self, daily_limit: int = 1000):
        self.daily_limit = daily_limit
        self.call_count = 0
        self.last_reset = datetime.now()

    def check_and_increment(self) -> bool:
        """Check if under limit and increment counter. Returns True if allowed."""
        now = datetime.now()

        # Reset counter if new day
        if (now - self.last_reset) >= timedelta(days=1):
            self.call_count = 0
            self.last_reset = now
            logger.info("Rate limit counter reset for new day")

        # Check limit
        if self.call_count >= self.daily_limit:
            logger.warning(f"Rate limit exceeded: {self.call_count}/{self.daily_limit}")
            return False

        self.call_count += 1
        return True

    def get_status(self) -> Dict[str, Any]:
        """Get current rate limit status"""
        return {
            "calls_today": self.call_count,
            "daily_limit": self.daily_limit,
            "remaining": max(0, self.daily_limit - self.call_count),
            "reset_at": (self.last_reset + timedelta(days=1)).isoformat()
        }


class FallbackChainManager:
    """
    Manages 4-tier fallback inference chain with automatic failover.

    Usage:
        manager = FallbackChainManager(local_model=gemma_wrapper)
        response = await manager.infer("What is Python?")
        print(f"Source: {response.source.value}, Content: {response.content}")
    """

    def __init__(self, local_model: Any = None, config: Optional[Dict[str, Any]] = None):
        """
        Initialize fallback chain manager.

        Args:
            local_model: GemmaBindingsWrapper or IsolatedGemmaClient instance
            config: Configuration dict with API keys and endpoints
        """
        self.local_model = local_model
        self.config = config or {}
        self.rate_limiter = RateLimiter(daily_limit=self.config.get("api_call_limit", 1000))

        # Provider timeouts (seconds)
        self.tier_timeout = 10
        self.total_timeout = 30

        # Initialize API clients
        self._setup_clients()

        logger.info("FallbackChainManager initialized with 4-tier chain")

    def _setup_clients(self):
        """Setup API clients for external providers"""
        # OpenAI client
        self.openai_client = None
        if OPENAI_AVAILABLE and os.getenv("OPENAI_API_KEY"):
            try:
                if openai:
                    self.openai_client = openai.OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
                    logger.info("OpenAI client initialized")
            except Exception as e:
                logger.warning(f"Failed to initialize OpenAI client: {e}")

        # HTTP client for other APIs
        self.http_client = None
        if HTTPX_AVAILABLE and httpx:
            self.http_client = httpx.AsyncClient(timeout=self.tier_timeout)
            logger.info("HTTP client initialized for API requests")

    async def infer(
        self,
        prompt: str,
        system_prompt: str = "",
        max_tokens: int = 1024,
        research_mode: bool = False
    ) -> InferenceResponse:
        """
        Execute inference with 4-tier fallback chain.

        Args:
            prompt: User prompt/question
            system_prompt: System context (optional)
            max_tokens: Maximum tokens to generate
            research_mode: Enable Context7 and web search tiers

        Returns:
            InferenceResponse with result and source attribution
        """
        start_time = datetime.now()

        try:
            # Tier 1: Local Gemma
            response = await self._try_tier(
                tier_name="Local Gemma",
                provider_func=lambda: self._infer_local(prompt, system_prompt, max_tokens),
                source=InferenceSource.LOCAL
            )
            if response:
                return response

            # Check rate limit before using API tiers
            if not self.rate_limiter.check_and_increment():
                return InferenceResponse(
                    success=False,
                    content="",
                    source=InferenceSource.FAILED,
                    provider="rate_limited",
                    elapsed_ms=self._elapsed_ms(start_time),
                    error="API rate limit exceeded"
                )

            # Tier 2: OpenAI
            response = await self._try_tier(
                tier_name="OpenAI",
                provider_func=lambda: self._infer_openai(prompt, system_prompt, max_tokens),
                source=InferenceSource.OPENAI
            )
            if response:
                return response

            # Tier 2b: OpenRouter (alternative to OpenAI)
            response = await self._try_tier(
                tier_name="OpenRouter",
                provider_func=lambda: self._infer_openrouter(prompt, system_prompt, max_tokens),
                source=InferenceSource.OPENROUTER
            )
            if response:
                return response

            # Only try Context7 and Web Search in research mode
            if research_mode:
                # Tier 3: Context7 MCP
                response = await self._try_tier(
                    tier_name="Context7 MCP",
                    provider_func=lambda: self._infer_context7(prompt, system_prompt, max_tokens),
                    source=InferenceSource.CONTEXT7
                )
                if response:
                    return response

                # Tier 4: Web Search
                response = await self._try_tier(
                    tier_name="Web Search",
                    provider_func=lambda: self._infer_web_search(prompt, system_prompt, max_tokens),
                    source=InferenceSource.WEB_SEARCH
                )
                if response:
                    return response

            # All tiers failed
            return InferenceResponse(
                success=False,
                content="",
                source=InferenceSource.FAILED,
                provider="all_failed",
                elapsed_ms=self._elapsed_ms(start_time),
                error="All inference providers failed"
            )

        except asyncio.TimeoutError:
            return InferenceResponse(
                success=False,
                content="",
                source=InferenceSource.FAILED,
                provider="timeout",
                elapsed_ms=self._elapsed_ms(start_time),
                error=f"Total timeout exceeded ({self.total_timeout}s)"
            )
        except Exception as e:
            logger.error(f"Unexpected error in fallback chain: {e}")
            return InferenceResponse(
                success=False,
                content="",
                source=InferenceSource.FAILED,
                provider="error",
                elapsed_ms=self._elapsed_ms(start_time),
                error=str(e)
            )

    async def _try_tier(
        self,
        tier_name: str,
        provider_func: Callable,
        source: InferenceSource
    ) -> Optional[InferenceResponse]:
        """
        Try a single tier with timeout and error handling.

        Returns:
            InferenceResponse if successful, None if failed
        """
        start_time = datetime.now()

        try:
            logger.info(f"Trying tier: {tier_name}")

            # Execute with timeout
            result = await asyncio.wait_for(
                provider_func(),
                timeout=self.tier_timeout
            )

            if result:
                elapsed = self._elapsed_ms(start_time)
                logger.info(f"✓ {tier_name} succeeded in {elapsed}ms")
                return result

            logger.warning(f"✗ {tier_name} returned empty result")
            return None

        except asyncio.TimeoutError:
            elapsed = self._elapsed_ms(start_time)
            logger.warning(f"✗ {tier_name} timeout after {elapsed}ms")
            return None

        except Exception as e:
            elapsed = self._elapsed_ms(start_time)
            logger.warning(f"✗ {tier_name} error after {elapsed}ms: {e}")
            return None

    def _elapsed_ms(self, start_time: datetime) -> int:
        """Calculate elapsed milliseconds from start time"""
        return int((datetime.now() - start_time).total_seconds() * 1000)

    # ===== TIER 1: LOCAL GEMMA =====

    async def _infer_local(
        self,
        prompt: str,
        system_prompt: str,
        max_tokens: int
    ) -> Optional[InferenceResponse]:
        """
        Tier 1: Local Gemma inference.

        Uses existing GemmaBindingsWrapper or IsolatedGemmaClient.
        """
        if not self.local_model:
            return None

        start_time = datetime.now()

        try:
            # Check if model is available
            if hasattr(self.local_model, 'is_available'):
                if not self.local_model.is_available():
                    return None

            # Combine system and user prompts
            full_prompt = f"{system_prompt}\n\n{prompt}" if system_prompt else prompt

            # Generate response
            # Support both synchronous and asynchronous generate methods
            if asyncio.iscoroutinefunction(self.local_model.generate):
                content = await self.local_model.generate(full_prompt, max_tokens)
            else:
                # Run sync method in executor to avoid blocking
                loop = asyncio.get_event_loop()
                content = await loop.run_in_executor(
                    None,
                    lambda: self.local_model.generate(full_prompt, max_tokens)
                )

            if not content or not content.strip():
                return None

            return InferenceResponse(
                success=True,
                content=content.strip(),
                source=InferenceSource.LOCAL,
                provider="gemma-2-2b",
                elapsed_ms=self._elapsed_ms(start_time)
            )

        except Exception as e:
            logger.error(f"Local Gemma inference failed: {e}")
            return None

    # ===== TIER 2: OPENAI/OPENROUTER =====

    async def _infer_openai(
        self,
        prompt: str,
        system_prompt: str,
        max_tokens: int
    ) -> Optional[InferenceResponse]:
        """
        Tier 2a: OpenAI inference.

        Uses OpenAI GPT models with rate limiting.
        """
        if not self.openai_client:
            return None

        start_time = datetime.now()

        try:
            model = self.config.get("openai_model", "gpt-3.5-turbo")

            messages = []
            if system_prompt:
                messages.append({"role": "system", "content": system_prompt})
            messages.append({"role": "user", "content": prompt})

            # Run OpenAI API call in executor (it's sync)
            loop = asyncio.get_event_loop()
            response = await loop.run_in_executor(
                None,
                lambda: self.openai_client.chat.completions.create(
                    model=model,
                    messages=messages,
                    max_tokens=max_tokens
                )
            )

            content = response.choices[0].message.content
            if not content:
                return None

            return InferenceResponse(
                success=True,
                content=content.strip(),
                source=InferenceSource.OPENAI,
                provider=model,
                elapsed_ms=self._elapsed_ms(start_time)
            )

        except Exception as e:
            logger.error(f"OpenAI inference failed: {e}")
            return None

    async def _infer_openrouter(
        self,
        prompt: str,
        system_prompt: str,
        max_tokens: int
    ) -> Optional[InferenceResponse]:
        """
        Tier 2b: OpenRouter inference.

        Fallback to OpenRouter if OpenAI fails.
        """
        if not self.http_client:
            return None

        api_key = self.config.get("openrouter_api_key") or os.getenv("OPENROUTER_API_KEY")
        if not api_key:
            return None

        start_time = datetime.now()

        try:
            model = self.config.get("openrouter_model", "anthropic/claude-3-haiku")

            messages = []
            if system_prompt:
                messages.append({"role": "system", "content": system_prompt})
            messages.append({"role": "user", "content": prompt})

            response = await self.http_client.post(
                "https://openrouter.ai/api/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                    "HTTP-Referer": "https://github.com/RLuf/FazAI",
                    "X-Title": "FazAI v2.0"
                },
                json={
                    "model": model,
                    "messages": messages,
                    "max_tokens": max_tokens
                }
            )

            if response.status_code != 200:
                logger.error(f"OpenRouter HTTP {response.status_code}: {response.text}")
                return None

            data = response.json()
            content = data["choices"][0]["message"]["content"]

            if not content:
                return None

            return InferenceResponse(
                success=True,
                content=content.strip(),
                source=InferenceSource.OPENROUTER,
                provider=model,
                elapsed_ms=self._elapsed_ms(start_time)
            )

        except Exception as e:
            logger.error(f"OpenRouter inference failed: {e}")
            return None

    # ===== TIER 3: CONTEXT7 MCP =====

    async def _infer_context7(
        self,
        prompt: str,
        system_prompt: str,
        max_tokens: int
    ) -> Optional[InferenceResponse]:
        """
        Tier 3: Context7 MCP for documentation queries.

        Uses MCP protocol for structured documentation retrieval.
        """
        if not self.http_client:
            return None

        endpoint = self.config.get("context7_endpoint") or os.getenv("CONTEXT7_ENDPOINT")
        if not endpoint:
            return None

        start_time = datetime.now()

        try:
            # Context7 expects specific query format
            payload = {
                "query": prompt,
                "system": system_prompt,
                "max_tokens": max_tokens
            }

            response = await self.http_client.post(
                endpoint,
                json=payload,
                timeout=self.config.get("context7_timeout", 20)
            )

            if response.status_code != 200:
                logger.error(f"Context7 HTTP {response.status_code}: {response.text}")
                return None

            data = response.json()
            content = data.get("response") or data.get("content") or data.get("answer")

            if not content:
                return None

            return InferenceResponse(
                success=True,
                content=content.strip(),
                source=InferenceSource.CONTEXT7,
                provider="context7-mcp",
                elapsed_ms=self._elapsed_ms(start_time),
                metadata={"docs": data.get("sources", [])}
            )

        except Exception as e:
            logger.error(f"Context7 inference failed: {e}")
            return None

    # ===== TIER 4: WEB SEARCH =====

    async def _infer_web_search(
        self,
        prompt: str,
        system_prompt: str,
        max_tokens: int
    ) -> Optional[InferenceResponse]:
        """
        Tier 4: Web search fallback using DuckDuckGo.

        Last resort for information retrieval.
        """
        if not self.http_client:
            return None

        start_time = datetime.now()

        try:
            # Use DuckDuckGo instant answer API
            search_query = prompt[:200]  # Limit query length

            response = await self.http_client.get(
                "https://api.duckduckgo.com/",
                params={
                    "q": search_query,
                    "format": "json",
                    "no_html": 1,
                    "skip_disambig": 1
                }
            )

            if response.status_code != 200:
                logger.error(f"DuckDuckGo HTTP {response.status_code}")
                return None

            data = response.json()

            # Extract relevant content
            content_parts = []

            if data.get("Abstract"):
                content_parts.append(data["Abstract"])

            if data.get("RelatedTopics"):
                for topic in data["RelatedTopics"][:3]:
                    if isinstance(topic, dict) and topic.get("Text"):
                        content_parts.append(topic["Text"])

            if not content_parts:
                return None

            content = "\n\n".join(content_parts)

            # Add context
            formatted_content = f"Web search results for: {search_query}\n\n{content}"

            return InferenceResponse(
                success=True,
                content=formatted_content,
                source=InferenceSource.WEB_SEARCH,
                provider="duckduckgo",
                elapsed_ms=self._elapsed_ms(start_time),
                metadata={
                    "query": search_query,
                    "source_url": data.get("AbstractURL")
                }
            )

        except Exception as e:
            logger.error(f"Web search failed: {e}")
            return None

    # ===== UTILITY METHODS =====

    def get_stats(self) -> Dict[str, Any]:
        """Get current fallback chain statistics"""
        return {
            "rate_limit": self.rate_limiter.get_status(),
            "providers": {
                "local": self.local_model is not None,
                "openai": self.openai_client is not None,
                "openrouter": bool(self.config.get("openrouter_api_key")),
                "context7": bool(self.config.get("context7_endpoint")),
                "web_search": self.http_client is not None
            },
            "timeouts": {
                "tier_timeout": self.tier_timeout,
                "total_timeout": self.total_timeout
            }
        }


# ===== STANDALONE USAGE =====

async def main():
    """Test fallback chain standalone"""
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )

    # Create manager without local model (will skip to tier 2)
    manager = FallbackChainManager(config={
        "openai_model": "gpt-3.5-turbo",
        "api_call_limit": 1000
    })

    # Test inference
    print("\nTesting fallback chain...")
    print("=" * 60)

    response = await manager.infer(
        prompt="What is Python programming language?",
        max_tokens=100,
        research_mode=True
    )

    print(f"\nSuccess: {response.success}")
    print(f"Source: {response.source.value}")
    print(f"Provider: {response.provider}")
    print(f"Elapsed: {response.elapsed_ms}ms")
    print(f"\nContent:\n{response.content[:200]}...")

    # Show stats
    print(f"\nStats: {json.dumps(manager.get_stats(), indent=2)}")


if __name__ == "__main__":
    asyncio.run(main())
