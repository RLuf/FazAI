"""Context7 MCP provider for documentation lookup."""

import asyncio
import logging
import subprocess

from .base import InferenceProvider, InferenceResponse, ProviderError, ProviderTimeout

logger = logging.getLogger(__name__)


class Context7Provider(InferenceProvider):
    """Context7 MCP provider for documentation queries."""

    def __init__(
        self,
        timeout: float = 10.0,
        mcp_endpoint: str = "mcp://context7-docs",
    ):
        """Initialize Context7 provider.

        Args:
            timeout: Maximum lookup time in seconds
            mcp_endpoint: MCP endpoint for Context7
        """
        super().__init__(timeout=timeout, tier=3, name="context7", cost_per_token=0.0)
        self.mcp_endpoint = mcp_endpoint

    async def infer(self, prompt: str, **kwargs) -> InferenceResponse:
        """Query Context7 documentation with timeout.

        Args:
            prompt: Documentation query
            **kwargs: Additional parameters (currently unused)

        Returns:
            InferenceResponse with documentation content

        Raises:
            ProviderTimeout: If query exceeds timeout
            ProviderError: If MCP query fails
        """
        logger.debug(f"Context7 query: {prompt[:100]}...")

        try:
            # Determine which documentation to query based on keywords
            doc_path = self._determine_doc_path(prompt)

            # Execute MCP query via subprocess (placeholder - adjust to actual MCP interface)
            result, latency = await self._measure_latency(
                lambda: self._query_mcp(doc_path, prompt)
            )

            logger.info(
                "Context7 query successful",
                extra={"latency_seconds": round(latency, 2), "doc_path": doc_path},
            )

            return InferenceResponse(
                success=True,
                content=result,
                source=self.name,
                latency=latency,
                fallback_tier=self.tier,
                cost=0.0,  # Documentation lookup is free
                tokens_used=0,
            )

        except asyncio.TimeoutError as e:
            logger.warning(f"Context7 query timeout after {self.timeout}s")
            raise ProviderTimeout(
                f"Context7 query timed out after {self.timeout}s"
            ) from e

        except Exception as e:
            logger.error(f"Context7 query failed: {e}")
            raise ProviderError(f"Context7 query failed: {e}") from e

    def _determine_doc_path(self, prompt: str) -> str:
        """Determine which documentation to query based on prompt keywords.

        Args:
            prompt: User query

        Returns:
            MCP documentation path
        """
        prompt_lower = prompt.lower()

        # Map keywords to documentation paths
        if any(kw in prompt_lower for kw in ["fastapi", "rest", "api", "endpoint"]):
            return f"{self.mcp_endpoint}/fastapi/latest"
        elif any(kw in prompt_lower for kw in ["sqlalchemy", "database", "orm"]):
            return f"{self.mcp_endpoint}/sqlalchemy/2.0"
        elif any(kw in prompt_lower for kw in ["pydantic", "validation", "model"]):
            return f"{self.mcp_endpoint}/pydantic/v2"
        elif any(kw in prompt_lower for kw in ["pytest", "test", "testing"]):
            return f"{self.mcp_endpoint}/pytest/latest"
        elif any(kw in prompt_lower for kw in ["asyncio", "async", "await"]):
            return f"{self.mcp_endpoint}/python/asyncio"
        else:
            # Default to general Python docs
            return f"{self.mcp_endpoint}/python/latest"

    async def _query_mcp(self, doc_path: str, query: str) -> str:
        """Query MCP endpoint for documentation.

        Args:
            doc_path: MCP documentation path
            query: Search query

        Returns:
            Documentation content
        """
        # Note: This is a placeholder implementation
        # Actual MCP integration would use the context7 client library
        # For now, we simulate with a simple search

        try:
            # Simulate MCP query with timeout enforcement
            proc = await asyncio.wait_for(
                asyncio.create_subprocess_exec(
                    "mcp-query",  # Placeholder command
                    doc_path,
                    query,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE,
                ),
                timeout=self.timeout,
            )

            stdout, stderr = await asyncio.wait_for(
                proc.communicate(), timeout=self.timeout
            )

            if proc.returncode != 0:
                raise ProviderError(f"MCP query failed: {stderr.decode()}")

            result = stdout.decode().strip()

            if not result:
                raise ProviderError("No documentation found for query")

            return result

        except FileNotFoundError:
            # Fallback if MCP command not found - return helpful message
            logger.warning("MCP command not found, returning fallback message")
            return (
                f"Context7 MCP not available. For {doc_path}, "
                f"please refer to official documentation for: {query}"
            )

    async def health_check(self) -> bool:
        """Check if Context7 MCP is accessible.

        Returns:
            True if MCP endpoint is accessible
        """
        try:
            # Simple check - try to query a known documentation path
            result = await asyncio.wait_for(
                self._query_mcp(f"{self.mcp_endpoint}/python/latest", "import"),
                timeout=5.0,
            )

            is_healthy = bool(result)
            logger.debug(f"Context7 provider health check: {is_healthy}")
            return is_healthy

        except Exception as e:
            logger.error(f"Context7 health check failed: {e}")
            return False
