"""Tests for fallback chain inference system."""

import asyncio
import pytest
from unittest.mock import patch

from worker_python.providers.base import (
    InferenceProvider,
    InferenceResponse,
    ProviderError,
    ProviderTimeout,
)
from worker_python.fallback import FallbackChain, FallbackConfig


class MockProvider(InferenceProvider):
    """Mock provider for testing."""

    def __init__(
        self,
        tier: int,
        timeout: float = 5.0,
        should_succeed: bool = True,
        should_timeout: bool = False,
        response_content: str = "mock response",
        delay: float = 0.0,
    ):
        super().__init__(
            timeout=timeout, tier=tier, name=f"mock-tier-{tier}", cost_per_token=0.0
        )
        self.should_succeed = should_succeed
        self.should_timeout = should_timeout
        self.response_content = response_content
        self.delay = delay
        self.call_count = 0

    async def infer(self, prompt: str, **kwargs) -> InferenceResponse:
        """Mock inference."""
        self.call_count += 1

        if self.delay > 0:
            await asyncio.sleep(self.delay)

        if self.should_timeout:
            raise ProviderTimeout(f"{self.name} timed out")

        if not self.should_succeed:
            raise ProviderError(f"{self.name} failed")

        return InferenceResponse(
            success=True,
            content=self.response_content,
            source=self.name,
            latency=self.delay,
            fallback_tier=self.tier,
        )

    async def health_check(self) -> bool:
        """Mock health check."""
        return self.should_succeed


class TestInferenceResponse:
    """Tests for InferenceResponse model."""

    def test_create_response(self):
        """Test creating a response."""
        response = InferenceResponse(
            success=True,
            content="test content",
            source="local",
            latency=1.5,
            fallback_tier=1,
            cost=0.001,
            tokens_used=100,
        )

        assert response.success is True
        assert response.content == "test content"
        assert response.source == "local"
        assert response.latency == 1.5
        assert response.fallback_tier == 1
        assert response.cost == 0.001
        assert response.tokens_used == 100

    def test_with_metadata(self):
        """Test updating response metadata."""
        response = InferenceResponse(
            success=True,
            content="original",
            source="local",
            latency=1.0,
            fallback_tier=1,
        )

        updated = response.with_metadata({"source": "openai", "fallback_tier": 2})

        assert updated.source == "openai"
        assert updated.fallback_tier == 2
        assert updated.content == "original"  # unchanged
        assert response.source == "local"  # original unchanged


class TestFallbackChain:
    """Tests for FallbackChain orchestrator."""

    @pytest.mark.asyncio
    async def test_first_provider_succeeds(self):
        """Test successful inference on first provider."""
        provider1 = MockProvider(tier=1, response_content="tier 1 response")
        provider2 = MockProvider(tier=2, response_content="tier 2 response")

        config = FallbackConfig()
        chain = FallbackChain(config, providers=[provider1, provider2])

        response = await chain.infer("test prompt")

        assert response.success is True
        assert response.content == "tier 1 response"
        assert response.source == "mock-tier-1"
        assert response.fallback_tier == 1
        assert provider1.call_count == 1
        assert provider2.call_count == 0  # never called

    @pytest.mark.asyncio
    async def test_fallback_on_timeout(self):
        """Test fallback when first provider times out."""
        provider1 = MockProvider(tier=1, should_timeout=True)
        provider2 = MockProvider(tier=2, response_content="tier 2 response")

        config = FallbackConfig()
        chain = FallbackChain(config, providers=[provider1, provider2])

        response = await chain.infer("test prompt")

        assert response.success is True
        assert response.content == "tier 2 response"
        assert response.source == "mock-tier-2"
        assert response.fallback_tier == 2
        assert provider1.call_count == 1
        assert provider2.call_count == 1

    @pytest.mark.asyncio
    async def test_fallback_on_error(self):
        """Test fallback when first provider fails."""
        provider1 = MockProvider(tier=1, should_succeed=False)
        provider2 = MockProvider(tier=2, response_content="tier 2 response")

        config = FallbackConfig()
        chain = FallbackChain(config, providers=[provider1, provider2])

        response = await chain.infer("test prompt")

        assert response.success is True
        assert response.content == "tier 2 response"
        assert response.fallback_tier == 2

    @pytest.mark.asyncio
    async def test_all_providers_fail(self):
        """Test when all providers fail."""
        provider1 = MockProvider(tier=1, should_succeed=False)
        provider2 = MockProvider(tier=2, should_timeout=True)
        provider3 = MockProvider(tier=3, should_succeed=False)

        config = FallbackConfig()
        chain = FallbackChain(config, providers=[provider1, provider2, provider3])

        with pytest.raises(ProviderError, match="All providers failed"):
            await chain.infer("test prompt")

    @pytest.mark.asyncio
    async def test_provider_timeout_enforcement(self):
        """Test that provider timeout is enforced."""
        # Provider with 0.1s timeout but 0.5s delay - should timeout
        provider1 = MockProvider(tier=1, timeout=0.1, delay=0.5, should_timeout=True)
        provider2 = MockProvider(tier=2, response_content="tier 2 response")

        config = FallbackConfig()
        chain = FallbackChain(config, providers=[provider1, provider2])

        response = await chain.infer("test prompt")

        # Should fallback to provider2 due to timeout
        assert response.fallback_tier == 2
        assert response.source == "mock-tier-2"

    @pytest.mark.asyncio
    async def test_cost_tracking(self):
        """Test cost tracking for paid providers."""
        provider1 = MockProvider(tier=1, should_succeed=False)
        provider2 = MockProvider(tier=2, response_content="paid response")
        provider2.cost_per_token = 0.00001

        config = FallbackConfig()
        chain = FallbackChain(config, providers=[provider1, provider2])

        # Mock the response to include token count
        with patch.object(
            provider2,
            "infer",
            return_value=InferenceResponse(
                success=True,
                content="paid response",
                source="mock-tier-2",
                latency=1.0,
                fallback_tier=2,
                tokens_used=1000,
                cost=0.01,
            ),
        ):
            response = await chain.infer("test prompt")

        assert response.cost == 0.01
        assert response.tokens_used == 1000

    @pytest.mark.asyncio
    async def test_disabled_providers_skipped(self):
        """Test that disabled providers are skipped."""
        provider1 = MockProvider(tier=1)
        provider2 = MockProvider(tier=2, response_content="tier 2 response")

        config = FallbackConfig(enable_local=False)
        chain = FallbackChain(config, providers=[provider1, provider2])

        # Assume provider1 is the local provider
        chain.providers = [provider2]  # Only enable provider2

        response = await chain.infer("test prompt")

        assert response.fallback_tier == 2
        assert provider1.call_count == 0

    @pytest.mark.asyncio
    async def test_health_check(self):
        """Test health check for all providers."""
        provider1 = MockProvider(tier=1, should_succeed=True)
        provider2 = MockProvider(tier=2, should_succeed=False)

        config = FallbackConfig()
        chain = FallbackChain(config, providers=[provider1, provider2])

        health_status = await chain.health_check()

        assert health_status["mock-tier-1"] is True
        assert health_status["mock-tier-2"] is False


class TestFallbackConfig:
    """Tests for FallbackConfig."""

    def test_default_config(self):
        """Test default configuration."""
        config = FallbackConfig()

        assert config.local_timeout == 2.0
        assert config.openai_timeout == 5.0
        assert config.context7_timeout == 10.0
        assert config.websearch_timeout == 15.0
        assert config.enable_local is True
        assert config.enable_openai is True
        assert config.rate_limit_openai == 60

    def test_custom_config(self):
        """Test custom configuration."""
        config = FallbackConfig(
            local_timeout=3.0,
            openai_api_key="sk-test",
            cost_limit_daily=10.0,
            enable_websearch=False,
        )

        assert config.local_timeout == 3.0
        assert config.openai_api_key == "sk-test"
        assert config.cost_limit_daily == 10.0
        assert config.enable_websearch is False

    def test_from_env(self):
        """Test loading config from environment variables."""
        with patch.dict(
            "os.environ",
            {
                "OPENAI_API_KEY": "sk-env-test",
                "FALLBACK_LOCAL_TIMEOUT": "4.0",
                "FALLBACK_COST_LIMIT_DAILY": "20.0",
            },
        ):
            config = FallbackConfig.from_env()

            assert config.openai_api_key == "sk-env-test"
            assert config.local_timeout == 4.0
            assert config.cost_limit_daily == 20.0
