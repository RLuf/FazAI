"""Prometheus metrics for production monitoring.

Provides metrics collection for requests, errors, latency, and resource usage.
"""

import psutil
from prometheus_client import Counter, Gauge, Histogram

# Request metrics
request_count = Counter(
    "worker_requests_total",
    "Total HTTP requests",
    ["method", "endpoint", "status"],
)

request_duration = Histogram(
    "worker_request_duration_seconds",
    "Request duration in seconds",
    ["method", "endpoint"],
    buckets=[0.01, 0.05, 0.1, 0.5, 1.0, 2.5, 5.0, 10.0],
)

# Inference metrics
inference_latency = Histogram(
    "worker_inference_duration_seconds",
    "Inference duration in seconds",
    ["provider", "model"],
    buckets=[0.1, 0.5, 1.0, 2.0, 5.0, 10.0, 30.0, 60.0],
)

# Error metrics
error_count = Counter(
    "worker_errors_total",
    "Total errors",
    ["error_type", "component"],
)

# Resource metrics
memory_usage = Gauge(
    "worker_memory_bytes",
    "Memory usage in bytes",
)

active_connections = Gauge(
    "worker_active_connections",
    "Active WebSocket connections",
)


class MetricsCollector:
    """Metrics collector for worker observability."""

    def __init__(self):
        """Initialize metrics collector."""
        self.process = psutil.Process()

    def update_resource_metrics(self) -> None:
        """Update resource usage metrics."""
        # Update memory usage
        mem_info = self.process.memory_info()
        memory_usage.set(mem_info.rss)

    def record_request(
        self,
        method: str,
        endpoint: str,
        status: int,
        duration: float,
    ) -> None:
        """Record HTTP request metrics.

        Args:
            method: HTTP method
            endpoint: Request endpoint
            status: HTTP status code
            duration: Request duration in seconds
        """
        request_count.labels(
            method=method,
            endpoint=endpoint,
            status=str(status),
        ).inc()

        request_duration.labels(
            method=method,
            endpoint=endpoint,
        ).observe(duration)

    def record_inference(
        self,
        provider: str,
        model: str,
        duration: float,
    ) -> None:
        """Record inference metrics.

        Args:
            provider: AI provider (local, openai, etc.)
            model: Model name
            duration: Inference duration in seconds
        """
        inference_latency.labels(
            provider=provider,
            model=model,
        ).observe(duration)

    def record_error(
        self,
        error_type: str,
        component: str,
    ) -> None:
        """Record error metrics.

        Args:
            error_type: Type of error (e.g., ValueError)
            component: Component where error occurred
        """
        error_count.labels(
            error_type=error_type,
            component=component,
        ).inc()

    def increment_connections(self) -> None:
        """Increment active WebSocket connections."""
        active_connections.inc()

    def decrement_connections(self) -> None:
        """Decrement active WebSocket connections."""
        active_connections.dec()
