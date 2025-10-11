"""Integration tests for fallback chain with real providers.

These tests require API keys and external services to be available.
Set SKIP_INTEGRATION_TESTS=1 to skip these tests.
"""

import asyncio
import os
import pytest

from worker_python.fallback import FallbackChain, FallbackConfig
from worker_python.providers.local import LocalGemmaProvider
from worker_python.providers.openai_provider import OpenAIProvider
from worker_python.providers.context7_provider import Context7Provider
from worker_python.providers.websearch_provider import WebSearchProvider

# Skip integration tests if environment variable is set
SKIP_INTEGRATION = os.getenv("SKIP_INTEGRATION_TESTS", "0") == "1"
SKIP_REASON = "Integration tests disabled (SKIP_INTEGRATION_TESTS=1)"


@pytest.mark.skipif(SKIP_INTEGRATION, reason=SKIP_REASON)
@pytest.mark.integration
class TestLocalGemmaProviderIntegration:
    """Integration tests for LocalGemmaProvider."""

    @pytest.mark.asyncio
    async def test_local_inference(self):
        """Test local Gemma inference (requires model file)."""
        # Skip if model file doesn't exist
        model_path = os.getenv(
            "GEMMA_MODEL_PATH", "/opt/fazai/models/gemma/gemma-2-2b-it-Q4_K_M.gguf"
        )
        if not os.path.exists(model_path):
            pytest.skip(f"Model file not found: {model_path}")

        provider = LocalGemmaProvider(timeout=5.0)

        # Test health check
        is_healthy = await provider.health_check()
        assert is_healthy is True

        # Test inference
        response = await provider.infer("What is Python?")

        assert response.success is True
        assert len(response.content) > 0
        assert response.source == "local"
        assert response.fallback_tier == 1
        assert response.cost == 0.0


@pytest.mark.skipif(SKIP_INTEGRATION, reason=SKIP_REASON)
@pytest.mark.integration
class TestOpenAIProviderIntegration:
    """Integration tests for OpenAIProvider."""

    @pytest.mark.asyncio
    async def test_openai_inference(self):
        """Test OpenAI inference (requires API key)."""
        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            pytest.skip("OPENAI_API_KEY not set")

        provider = OpenAIProvider(api_key=api_key, model="gpt-3.5-turbo", timeout=10.0)

        # Test health check
        is_healthy = await provider.health_check()
        assert is_healthy is True

        # Test inference
        response = await provider.infer("Say 'Hello World' in one word")

        assert response.success is True
        assert len(response.content) > 0
        assert response.source == "openai"
        assert response.fallback_tier == 2
        assert response.cost > 0.0
        assert response.tokens_used > 0

    @pytest.mark.asyncio
    async def test_openrouter_inference(self):
        """Test OpenRouter inference (requires API key)."""
        api_key = os.getenv("OPENROUTER_API_KEY")
        if not api_key:
            pytest.skip("OPENROUTER_API_KEY not set")

        provider = OpenAIProvider(
            api_key=api_key,
            base_url="https://openrouter.ai/api/v1",
            model="anthropic/claude-3-haiku",
            timeout=10.0,
        )

        # Test inference
        response = await provider.infer("What is 2+2?")

        assert response.success is True
        assert "4" in response.content


@pytest.mark.skipif(SKIP_INTEGRATION, reason=SKIP_REASON)
@pytest.mark.integration
class TestContext7ProviderIntegration:
    """Integration tests for Context7Provider."""

    @pytest.mark.asyncio
    async def test_context7_query(self):
        """Test Context7 documentation query."""
        provider = Context7Provider(timeout=10.0)

        # Test with FastAPI query
        response = await provider.infer("How do I create a FastAPI endpoint?")

        assert response.success is True
        assert len(response.content) > 0
        assert response.source == "context7"
        assert response.fallback_tier == 3
        assert response.cost == 0.0


@pytest.mark.skipif(SKIP_INTEGRATION, reason=SKIP_REASON)
@pytest.mark.integration
class TestWebSearchProviderIntegration:
    """Integration tests for WebSearchProvider."""

    @pytest.mark.asyncio
    async def test_websearch_query(self):
        """Test web search (DuckDuckGo)."""
        provider = WebSearchProvider(timeout=15.0)

        # Test health check
        is_healthy = await provider.health_check()
        assert is_healthy is True

        # Test search
        response = await provider.infer("Python programming language")

        assert response.success is True
        assert len(response.content) > 0
        assert response.source == "websearch"
        assert response.fallback_tier == 4
        assert response.cost == 0.0


@pytest.mark.skipif(SKIP_INTEGRATION, reason=SKIP_REASON)
@pytest.mark.integration
class TestFallbackChainIntegration:
    """Integration tests for complete fallback chain."""

    @pytest.mark.asyncio
    async def test_full_chain_local_only(self):
        """Test fallback chain with only local provider enabled."""
        model_path = os.getenv(
            "GEMMA_MODEL_PATH", "/opt/fazai/models/gemma/gemma-2-2b-it-Q4_K_M.gguf"
        )
        if not os.path.exists(model_path):
            pytest.skip(f"Model file not found: {model_path}")

        config = FallbackConfig(
            enable_local=True,
            enable_openai=False,
            enable_context7=False,
            enable_websearch=False,
        )

        chain = FallbackChain(config)

        response = await chain.infer("What is FastAPI?")

        assert response.success is True
        assert response.fallback_tier == 1
        assert response.source == "local"

    @pytest.mark.asyncio
    async def test_full_chain_with_fallback(self):
        """Test fallback chain cascading through providers."""
        config = FallbackConfig(
            enable_local=False,  # Skip local
            enable_openai=True,
            enable_context7=True,
            enable_websearch=True,
            openai_api_key=os.getenv("OPENAI_API_KEY"),
        )

        chain = FallbackChain(config)

        # Should fallback to OpenAI (tier 2) or Context7 (tier 3)
        response = await chain.infer("What is Python?")

        assert response.success is True
        assert response.fallback_tier >= 2

    @pytest.mark.asyncio
    async def test_health_check_all_providers(self):
        """Test health check across all providers."""
        config = FallbackConfig(
            enable_local=True,
            enable_openai=True,
            enable_context7=True,
            enable_websearch=True,
            openai_api_key=os.getenv("OPENAI_API_KEY", "dummy"),
        )

        chain = FallbackChain(config)

        health = await chain.health_check()

        # At least one provider should be healthy
        assert any(health.values())

    @pytest.mark.asyncio
    async def test_cost_tracking(self):
        """Test cost tracking across multiple inferences."""
        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            pytest.skip("OPENAI_API_KEY not set")

        config = FallbackConfig(
            enable_local=False,
            enable_openai=True,
            openai_api_key=api_key,
        )

        chain = FallbackChain(config)

        # Make two inferences
        await chain.infer("Test 1")
        await chain.infer("Test 2")

        # Total cost should be > 0
        total_cost = chain.get_total_cost()
        assert total_cost > 0.0

    @pytest.mark.asyncio
    async def test_concurrent_requests(self):
        """Test concurrent requests to fallback chain."""
        config = FallbackConfig(enable_websearch=True)
        chain = FallbackChain(config)

        # Make concurrent requests
        tasks = [chain.infer(f"Query {i}") for i in range(5)]

        responses = await asyncio.gather(*tasks)

        # All should succeed
        assert all(r.success for r in responses)
        assert len(responses) == 5
