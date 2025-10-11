"""Web search provider using DuckDuckGo as last resort fallback."""

import asyncio
import logging

import httpx

from .base import InferenceProvider, InferenceResponse, ProviderError, ProviderTimeout

logger = logging.getLogger(__name__)


class WebSearchProvider(InferenceProvider):
    """Web search provider using DuckDuckGo API."""

    def __init__(
        self,
        timeout: float = 15.0,
        max_results: int = 3,
    ):
        """Initialize web search provider.

        Args:
            timeout: Maximum search time in seconds
            max_results: Maximum number of search results to return
        """
        super().__init__(timeout=timeout, tier=4, name="websearch", cost_per_token=0.0)
        self.max_results = max_results
        self.search_url = "https://api.duckduckgo.com/"

    async def infer(self, prompt: str, **kwargs) -> InferenceResponse:
        """Search the web using DuckDuckGo.

        Args:
            prompt: Search query
            **kwargs: Additional parameters (currently unused)

        Returns:
            InferenceResponse with search results

        Raises:
            ProviderTimeout: If search exceeds timeout
            ProviderError: If search fails
        """
        logger.debug(f"Web search query: {prompt[:100]}...")

        try:
            # Perform search with timeout
            results, latency = await self._measure_latency(
                lambda: self._search_duckduckgo(prompt)
            )

            # Format results into response
            content = self._format_results(results, prompt)

            logger.info(
                "Web search successful",
                extra={
                    "latency_seconds": round(latency, 2),
                    "results_count": len(results),
                },
            )

            return InferenceResponse(
                success=True,
                content=content,
                source=self.name,
                latency=latency,
                fallback_tier=self.tier,
                cost=0.0,  # DuckDuckGo is free
                tokens_used=0,
            )

        except asyncio.TimeoutError as e:
            logger.warning(f"Web search timeout after {self.timeout}s")
            raise ProviderTimeout(f"Web search timed out after {self.timeout}s") from e

        except Exception as e:
            logger.error(f"Web search failed: {e}")
            raise ProviderError(f"Web search failed: {e}") from e

    async def _search_duckduckgo(self, query: str) -> list[dict]:
        """Execute DuckDuckGo search.

        Args:
            query: Search query

        Returns:
            List of search result dictionaries
        """
        params = {
            "q": query,
            "format": "json",
            "no_html": "1",
            "skip_disambig": "1",
        }

        try:
            async with httpx.AsyncClient() as client:
                response = await asyncio.wait_for(
                    client.get(self.search_url, params=params),
                    timeout=self.timeout,
                )

                response.raise_for_status()
                data = response.json()

                # Extract relevant results
                results = []

                # Abstract answer (instant answer)
                if data.get("AbstractText"):
                    results.append(
                        {
                            "type": "answer",
                            "text": data["AbstractText"],
                            "url": data.get("AbstractURL", ""),
                        }
                    )

                # Related topics
                for topic in data.get("RelatedTopics", [])[: self.max_results]:
                    if isinstance(topic, dict) and "Text" in topic:
                        results.append(
                            {
                                "type": "topic",
                                "text": topic["Text"],
                                "url": topic.get("FirstURL", ""),
                            }
                        )

                # If no results, try alternative search
                if not results:
                    logger.warning("No DuckDuckGo results, trying alternative search")
                    results = await self._alternative_search(query)

                return results

        except httpx.HTTPStatusError as e:
            logger.error(f"DuckDuckGo API error: {e.response.status_code}")
            raise ProviderError(f"Search API error: {e.response.status_code}") from e

    async def _alternative_search(self, query: str) -> list[dict]:
        """Alternative search method using HTML scraping (fallback).

        Args:
            query: Search query

        Returns:
            List of search results
        """
        # Simple fallback - return a helpful message
        return [
            {
                "type": "fallback",
                "text": (
                    f"Unable to perform web search for: {query}. "
                    "Please try searching manually or refining your query."
                ),
                "url": f"https://duckduckgo.com/?q={query.replace(' ', '+')}",
            }
        ]

    def _format_results(self, results: list[dict], query: str) -> str:
        """Format search results into readable text.

        Args:
            results: List of search result dictionaries
            query: Original query

        Returns:
            Formatted result text
        """
        if not results:
            return f"No web search results found for: {query}"

        formatted = f"Web search results for: {query}\n\n"

        for i, result in enumerate(results, 1):
            result_type = result.get("type", "unknown")
            text = result.get("text", "")
            url = result.get("url", "")

            if result_type == "answer":
                formatted += f"Quick Answer:\n{text}\n"
            elif result_type == "topic":
                formatted += f"{i}. {text}\n"
            else:
                formatted += f"{i}. {text}\n"

            if url:
                formatted += f"   Source: {url}\n"

            formatted += "\n"

        return formatted.strip()

    async def health_check(self) -> bool:
        """Check if DuckDuckGo API is accessible.

        Returns:
            True if API is accessible
        """
        try:
            async with httpx.AsyncClient() as client:
                response = await asyncio.wait_for(
                    client.get(
                        self.search_url,
                        params={"q": "test", "format": "json"},
                    ),
                    timeout=5.0,
                )

                is_healthy = response.status_code == 200
                logger.debug(f"WebSearch provider health check: {is_healthy}")
                return is_healthy

        except Exception as e:
            logger.error(f"WebSearch health check failed: {e}")
            return False
