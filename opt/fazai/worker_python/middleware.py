"""Middleware for observability and security.

Provides request logging, metrics collection, rate limiting, and audit logging.
"""

import time
from typing import Callable

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware

from observability.logging import StructuredLogger
from observability.metrics import MetricsCollector
from observability.tracing import RequestTracer
from security.audit import AuditEventType, AuditLogger
from security.rate_limit import RateLimiter

# Initialize components
logger = StructuredLogger(__name__)
metrics_collector = MetricsCollector()
rate_limiter = RateLimiter(requests_per_minute=60, requests_per_hour=1000)
audit_logger = AuditLogger()


class ObservabilityMiddleware(BaseHTTPMiddleware):
    """Middleware for request logging and metrics collection."""

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        """Process request with observability.

        Args:
            request: FastAPI request
            call_next: Next middleware/handler

        Returns:
            Response from handler
        """
        # Generate or extract correlation ID
        correlation_id = request.headers.get("X-Correlation-ID")
        if not correlation_id:
            correlation_id = RequestTracer.generate_correlation_id()

        RequestTracer.set_correlation_id(correlation_id)

        # Log request started
        logger.info(
            "Request started",
            method=request.method,
            path=request.url.path,
            client_ip=request.client.host if request.client else "unknown",
            correlation_id=correlation_id,
        )

        # Track WebSocket connections
        is_websocket = request.url.path == "/ws"
        if is_websocket:
            metrics_collector.increment_connections()

        # Execute request
        start_time = time.time()

        try:
            response = await call_next(request)
            duration = time.time() - start_time

            # Log request completed
            logger.info(
                "Request completed",
                method=request.method,
                path=request.url.path,
                status_code=response.status_code,
                duration=duration,
                correlation_id=correlation_id,
            )

            # Record metrics
            metrics_collector.record_request(
                method=request.method,
                endpoint=request.url.path,
                status=response.status_code,
                duration=duration,
            )

            # Add correlation ID to response headers
            response.headers["X-Correlation-ID"] = correlation_id

            # Update resource metrics periodically (not every request)
            if int(time.time()) % 10 == 0:  # Every ~10 seconds
                metrics_collector.update_resource_metrics()

            return response

        except Exception as e:
            duration = time.time() - start_time

            # Log error
            logger.error(
                "Request failed",
                method=request.method,
                path=request.url.path,
                error=str(e),
                error_type=type(e).__name__,
                duration=duration,
                correlation_id=correlation_id,
            )

            # Record error metrics
            metrics_collector.record_error(
                error_type=type(e).__name__,
                component="api",
            )

            raise

        finally:
            # Cleanup WebSocket tracking
            if is_websocket:
                metrics_collector.decrement_connections()

            # Clear correlation ID
            RequestTracer.clear_correlation_id()


class SecurityMiddleware(BaseHTTPMiddleware):
    """Middleware for rate limiting and security audit logging."""

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        """Process request with security checks.

        Args:
            request: FastAPI request
            call_next: Next middleware/handler

        Returns:
            Response from handler
        """
        # Skip rate limiting for health checks
        if request.url.path in ["/health", "/ready", "/metrics"]:
            return await call_next(request)

        # Rate limiting
        try:
            await rate_limiter.check_rate_limit(request)

        except Exception:
            # Log rate limit exceeded
            audit_logger.log_event(
                event_type=AuditEventType.AUTH_FAILURE,
                user="unknown",
                action="rate_limit_exceeded",
                resource=request.url.path,
                outcome="blocked",
                ip_address=request.client.host if request.client else "unknown",
                method=request.method,
            )
            raise

        # Execute request
        response = await call_next(request)

        # Audit successful requests to sensitive endpoints
        if request.url.path.startswith("/v1/"):
            audit_logger.log_event(
                event_type=AuditEventType.DATA_ACCESS,
                user="api_client",
                action=f"{request.method} {request.url.path}",
                resource=request.url.path,
                outcome="success" if response.status_code < 400 else "failure",
                ip_address=request.client.host if request.client else "unknown",
                status_code=response.status_code,
            )

        return response
