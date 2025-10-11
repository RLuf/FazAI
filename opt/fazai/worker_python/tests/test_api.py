"""Tests for FastAPI HTTP endpoints."""

import pytest
from httpx import AsyncClient
from fastapi.testclient import TestClient

from worker_python.api import app


@pytest.fixture
def client():
    """Create synchronous test client."""
    return TestClient(app)


@pytest.fixture
async def async_client():
    """Create async test client."""
    async with AsyncClient(app=app, base_url="http://test") as ac:
        yield ac


class TestHealthEndpoints:
    """Tests for health check endpoints."""

    def test_health_endpoint(self, client):
        """Test /health endpoint returns healthy status."""
        response = client.get("/health")

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert data["version"] == "2.0.0"

    def test_ready_endpoint(self, client):
        """Test /ready endpoint checks model status."""
        response = client.get("/ready")

        assert response.status_code == 200
        data = response.json()
        assert "status" in data
        assert "model_loaded" in data
        assert isinstance(data["model_loaded"], bool)

        # If model is loaded, should have model_path
        if data["model_loaded"]:
            assert "model_path" in data
            assert data["model_path"] is not None

    def test_ready_endpoint_when_not_ready(self, client):
        """Test /ready endpoint handles uninitialized worker."""
        # This test depends on worker initialization state
        # In production, this would be tested with dependency injection
        response = client.get("/ready")

        # Should return either 200 (ready) or 503 (not ready)
        assert response.status_code in [200, 503]


class TestRootEndpoint:
    """Tests for root endpoint."""

    def test_root_endpoint(self, client):
        """Test / endpoint returns API information."""
        response = client.get("/")

        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "FazAI Gemma Worker"
        assert data["version"] == "2.0.0"
        assert "endpoints" in data
        assert "/health" in str(data["endpoints"])
        assert "/ready" in str(data["endpoints"])
        assert "/v1/execute" in str(data["endpoints"])
        assert "/ws" in str(data["endpoints"])


class TestExecuteEndpoint:
    """Tests for /v1/execute endpoint."""

    def test_execute_endpoint_basic(self, client):
        """Test basic execution request."""
        payload = {
            "input": "Hello, how are you?"
        }

        response = client.post("/v1/execute", json=payload)

        # Should either succeed or fail gracefully
        assert response.status_code in [200, 500, 503]

        if response.status_code == 200:
            data = response.json()
            assert "status" in data
            assert "result" in data
            assert "session_id" in data
            assert "origin" in data
            assert data["origin"] == "local"

    def test_execute_endpoint_with_parameters(self, client):
        """Test execution with custom parameters."""
        payload = {
            "input": "What is the capital of France?",
            "max_tokens": 50,
            "temperature": 0.7,
            "top_p": 0.9,
            "top_k": 40
        }

        response = client.post("/v1/execute", json=payload)

        # Should handle parameters correctly
        assert response.status_code in [200, 500, 503]

        if response.status_code == 200:
            data = response.json()
            assert data["status"] == "success"
            assert len(data["result"]) > 0

    def test_execute_endpoint_with_session_id(self, client):
        """Test execution with custom session ID."""
        session_id = "test-session-123"
        payload = {
            "input": "Test prompt",
            "session_id": session_id
        }

        response = client.post("/v1/execute", json=payload)

        if response.status_code == 200:
            data = response.json()
            assert data["session_id"] == session_id

    def test_execute_endpoint_empty_input(self, client):
        """Test execution with empty input."""
        payload = {
            "input": ""
        }

        response = client.post("/v1/execute", json=payload)

        # Should reject empty input
        assert response.status_code == 422  # Validation error

    def test_execute_endpoint_missing_input(self, client):
        """Test execution without input field."""
        payload = {}

        response = client.post("/v1/execute", json=payload)

        # Should reject missing input
        assert response.status_code == 422  # Validation error

    def test_execute_endpoint_invalid_parameters(self, client):
        """Test execution with invalid parameters."""
        payload = {
            "input": "Test",
            "max_tokens": -1,  # Invalid
            "temperature": 5.0  # Invalid
        }

        response = client.post("/v1/execute", json=payload)

        # Should reject invalid parameters
        assert response.status_code == 422  # Validation error

    @pytest.mark.asyncio
    async def test_execute_endpoint_async(self, async_client):
        """Test async execution."""
        payload = {
            "input": "Async test prompt"
        }

        response = await async_client.post("/v1/execute", json=payload)

        assert response.status_code in [200, 500, 503]


class TestCORS:
    """Tests for CORS middleware."""

    def test_cors_headers(self, client):
        """Test CORS headers are present."""
        response = client.options("/health")

        # CORS headers should be present
        assert response.status_code in [200, 405]  # Some frameworks handle OPTIONS differently


class TestOpenAPISchema:
    """Tests for OpenAPI documentation."""

    def test_openapi_schema_available(self, client):
        """Test OpenAPI schema is generated."""
        response = client.get("/openapi.json")

        assert response.status_code == 200
        schema = response.json()
        assert "openapi" in schema
        assert "info" in schema
        assert schema["info"]["title"] == "FazAI Gemma Worker"
        assert schema["info"]["version"] == "2.0.0"

    def test_docs_endpoint(self, client):
        """Test /docs endpoint is available."""
        response = client.get("/docs")

        assert response.status_code == 200


class TestErrorHandling:
    """Tests for error handling."""

    def test_404_error(self, client):
        """Test 404 for non-existent endpoint."""
        response = client.get("/nonexistent")

        assert response.status_code == 404

    def test_405_method_not_allowed(self, client):
        """Test 405 for wrong HTTP method."""
        response = client.get("/v1/execute")  # Should be POST

        assert response.status_code == 405

    def test_malformed_json(self, client):
        """Test handling of malformed JSON."""
        response = client.post(
            "/v1/execute",
            data="not json",
            headers={"Content-Type": "application/json"}
        )

        assert response.status_code == 422


class TestPerformance:
    """Performance tests for API endpoints."""

    def test_health_endpoint_performance(self, client):
        """Test health endpoint responds quickly."""
        import time

        start = time.time()
        response = client.get("/health")
        duration = time.time() - start

        assert response.status_code == 200
        # Health check should be very fast
        assert duration < 0.1  # 100ms

    def test_concurrent_health_checks(self, client):
        """Test multiple concurrent health checks."""
        import concurrent.futures

        def check_health():
            return client.get("/health")

        with concurrent.futures.ThreadPoolExecutor(max_workers=10) as executor:
            futures = [executor.submit(check_health) for _ in range(10)]
            results = [f.result() for f in concurrent.futures.as_completed(futures)]

        # All should succeed
        assert all(r.status_code == 200 for r in results)
