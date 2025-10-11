"""Test suite for observability modules.

Tests structured logging, metrics collection, and request tracing.
"""

import asyncio
import json
import logging
import time
from io import StringIO

from prometheus_client import REGISTRY

from observability.logging import StructuredLogger, JSONFormatter
from observability.metrics import (
    MetricsCollector,
    request_count,
    request_duration,
    inference_latency,
    error_count,
    memory_usage,
    active_connections,
)
from observability.tracing import RequestTracer, correlation_id_ctx


class TestStructuredLogger:
    """Test structured logging functionality."""

    def test_logger_initialization(self):
        """Test logger can be initialized with name and level."""
        logger = StructuredLogger("test_logger", level="DEBUG")
        assert logger.logger.name == "test_logger"
        assert logger.logger.level == logging.DEBUG

    def test_logger_default_level(self):
        """Test logger defaults to INFO level."""
        logger = StructuredLogger("test_logger")
        assert logger.logger.level == logging.INFO

    def test_json_formatter_output(self):
        """Test JSON formatter produces valid JSON."""
        logger = logging.getLogger("test_json")
        logger.setLevel(logging.INFO)

        # Capture output
        stream = StringIO()
        handler = logging.StreamHandler(stream)
        handler.setFormatter(JSONFormatter())
        logger.addHandler(handler)

        # Log message
        logger.info("Test message", extra={"correlation_id": "123", "user": "test"})

        # Parse output
        output = stream.getvalue().strip()
        log_data = json.loads(output)

        assert log_data["level"] == "INFO"
        assert log_data["message"] == "Test message"
        assert "timestamp" in log_data
        assert "correlation_id" in log_data
        assert log_data["user"] == "test"

    def test_structured_logger_info(self):
        """Test structured logger info method."""
        logger = StructuredLogger("test_info")
        stream = StringIO()
        handler = logging.StreamHandler(stream)
        handler.setFormatter(JSONFormatter())
        logger.logger.handlers = [handler]

        logger.info("Test info", user_id="123", action="login")

        output = stream.getvalue().strip()
        log_data = json.loads(output)

        assert log_data["level"] == "INFO"
        assert log_data["message"] == "Test info"
        assert log_data["user_id"] == "123"
        assert log_data["action"] == "login"

    def test_structured_logger_error(self):
        """Test structured logger error method."""
        logger = StructuredLogger("test_error")
        stream = StringIO()
        handler = logging.StreamHandler(stream)
        handler.setFormatter(JSONFormatter())
        logger.logger.handlers = [handler]

        logger.error("Test error", error_type="ValueError", trace="stack trace")

        output = stream.getvalue().strip()
        log_data = json.loads(output)

        assert log_data["level"] == "ERROR"
        assert log_data["message"] == "Test error"
        assert log_data["error_type"] == "ValueError"

    def test_structured_logger_all_levels(self):
        """Test all log levels work correctly."""
        logger = StructuredLogger("test_levels", level="DEBUG")
        stream = StringIO()
        handler = logging.StreamHandler(stream)
        handler.setFormatter(JSONFormatter())
        logger.logger.handlers = [handler]

        logger.debug("Debug message")
        logger.info("Info message")
        logger.warning("Warning message")
        logger.error("Error message")
        logger.critical("Critical message")

        outputs = stream.getvalue().strip().split("\n")
        assert len(outputs) == 5

        levels = [json.loads(line)["level"] for line in outputs]
        assert levels == ["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"]

    def test_correlation_id_injection(self):
        """Test correlation ID is automatically injected into logs."""
        logger = StructuredLogger("test_correlation")
        stream = StringIO()
        handler = logging.StreamHandler(stream)
        handler.setFormatter(JSONFormatter())
        logger.logger.handlers = [handler]

        # Set correlation ID
        correlation_id_ctx.set("test-correlation-123")

        logger.info("Test with correlation")

        output = stream.getvalue().strip()
        log_data = json.loads(output)

        # Should include correlation ID from context
        assert "test-correlation-123" in str(log_data)


class TestMetricsCollector:
    """Test Prometheus metrics collection."""

    def setup_method(self):
        """Clear metrics before each test."""
        # Note: Prometheus metrics can't be fully reset in tests
        # We verify increments instead of absolute values
        pass

    def test_metrics_collector_initialization(self):
        """Test metrics collector can be initialized."""
        collector = MetricsCollector()
        assert collector is not None

    def test_request_counter_increment(self):
        """Test request counter increments correctly."""
        initial = request_count.labels(
            method="GET", endpoint="/test", status="200"
        )._value.get()

        # Increment counter
        request_count.labels(method="GET", endpoint="/test", status="200").inc()

        final = request_count.labels(
            method="GET", endpoint="/test", status="200"
        )._value.get()
        assert final > initial

    def test_request_duration_observe(self):
        """Test request duration histogram records observations."""
        metric = request_duration.labels(method="POST", endpoint="/execute")
        initial_count = metric._sum.get()

        # Record duration
        metric.observe(0.5)

        final_count = metric._sum.get()
        assert final_count >= initial_count

    def test_inference_latency_tracking(self):
        """Test inference latency is tracked correctly."""
        metric = inference_latency.labels(provider="local", model="gemma")

        # Record latency
        start = time.time()
        time.sleep(0.01)  # Simulate work
        duration = time.time() - start

        metric.observe(duration)

        # Verify observation recorded (sum should increase)
        assert metric._sum.get() > 0

    def test_error_counter_by_type(self):
        """Test error counter tracks different error types."""
        initial_value_error = error_count.labels(
            error_type="ValueError", component="executor"
        )._value.get()

        initial_runtime_error = error_count.labels(
            error_type="RuntimeError", component="api"
        )._value.get()

        # Increment different error types
        error_count.labels(error_type="ValueError", component="executor").inc()
        error_count.labels(error_type="RuntimeError", component="api").inc()

        final_value_error = error_count.labels(
            error_type="ValueError", component="executor"
        )._value.get()

        final_runtime_error = error_count.labels(
            error_type="RuntimeError", component="api"
        )._value.get()

        assert final_value_error > initial_value_error
        assert final_runtime_error > initial_runtime_error

    def test_memory_usage_gauge(self):
        """Test memory usage gauge can be set."""
        import psutil

        process = psutil.Process()
        mem_bytes = process.memory_info().rss

        memory_usage.set(mem_bytes)

        # Verify gauge value
        assert memory_usage._value.get() > 0

    def test_active_connections_gauge(self):
        """Test active connections gauge increments and decrements."""
        initial = active_connections._value.get()

        active_connections.inc()
        assert active_connections._value.get() == initial + 1

        active_connections.dec()
        assert active_connections._value.get() == initial

    def test_metrics_export(self):
        """Test metrics can be exported for Prometheus."""
        from prometheus_client import generate_latest

        # Generate metrics output
        output = generate_latest(REGISTRY)

        assert output is not None
        assert b"worker_requests_total" in output
        assert b"worker_request_duration_seconds" in output
        assert b"worker_inference_duration_seconds" in output

    def test_update_resource_metrics(self):
        """Test updating resource metrics."""
        collector = MetricsCollector()

        # Update resource metrics
        collector.update_resource_metrics()

        # Memory usage should be set
        assert memory_usage._value.get() > 0

    def test_record_request(self):
        """Test recording request metrics."""
        collector = MetricsCollector()

        # Record a request
        collector.record_request(
            method="POST",
            endpoint="/test",
            status=200,
            duration=0.123,
        )

        # Metrics should be updated
        assert (
            request_count.labels(
                method="POST", endpoint="/test", status="200"
            )._value.get()
            > 0
        )
        assert request_duration.labels(method="POST", endpoint="/test")._sum.get() > 0

    def test_record_inference(self):
        """Test recording inference metrics."""
        collector = MetricsCollector()

        # Record inference
        collector.record_inference(
            provider="local",
            model="gemma",
            duration=1.5,
        )

        # Metrics should be updated
        assert inference_latency.labels(provider="local", model="gemma")._sum.get() > 0

    def test_record_error(self):
        """Test recording error metrics."""
        collector = MetricsCollector()

        initial_count = error_count.labels(
            error_type="TestError", component="test_component"
        )._value.get()

        # Record error
        collector.record_error(
            error_type="TestError",
            component="test_component",
        )

        # Error count should increase
        final_count = error_count.labels(
            error_type="TestError", component="test_component"
        )._value.get()

        assert final_count > initial_count

    def test_increment_decrement_connections(self):
        """Test connection tracking."""
        collector = MetricsCollector()

        initial = active_connections._value.get()

        # Increment
        collector.increment_connections()
        assert active_connections._value.get() == initial + 1

        # Decrement
        collector.decrement_connections()
        assert active_connections._value.get() == initial


class TestRequestTracer:
    """Test request tracing functionality."""

    def test_generate_correlation_id(self):
        """Test correlation ID generation."""
        corr_id = RequestTracer.generate_correlation_id()

        assert corr_id is not None
        assert len(corr_id) == 36  # UUID4 format
        assert "-" in corr_id

    def test_correlation_id_uniqueness(self):
        """Test correlation IDs are unique."""
        id1 = RequestTracer.generate_correlation_id()
        id2 = RequestTracer.generate_correlation_id()

        assert id1 != id2

    def test_set_and_get_correlation_id(self):
        """Test setting and getting correlation ID from context."""
        test_id = "test-correlation-456"

        RequestTracer.set_correlation_id(test_id)
        retrieved_id = RequestTracer.get_correlation_id()

        assert retrieved_id == test_id

    def test_correlation_id_context_isolation(self):
        """Test correlation IDs are isolated in different contexts."""

        async def task1():
            RequestTracer.set_correlation_id("task1-id")
            await asyncio.sleep(0.01)
            return RequestTracer.get_correlation_id()

        async def task2():
            RequestTracer.set_correlation_id("task2-id")
            await asyncio.sleep(0.01)
            return RequestTracer.get_correlation_id()

        async def run_concurrent():
            results = await asyncio.gather(task1(), task2())
            return results

        results = asyncio.run(run_concurrent())

        # Each context should maintain its own correlation ID
        assert "task1-id" in results
        assert "task2-id" in results

    def test_correlation_id_default_none(self):
        """Test correlation ID defaults to None when not set."""
        # Create fresh context
        correlation_id_ctx.set(None)

        corr_id = RequestTracer.get_correlation_id()
        assert corr_id is None


class TestObservabilityIntegration:
    """Test integration of observability components."""

    def test_logging_with_tracing(self):
        """Test logging includes correlation ID from tracer."""
        logger = StructuredLogger("integration_test")
        stream = StringIO()
        handler = logging.StreamHandler(stream)
        handler.setFormatter(JSONFormatter())
        logger.logger.handlers = [handler]

        # Set correlation ID
        RequestTracer.set_correlation_id("integration-123")

        # Log with correlation context
        logger.info("Integration test", request_id=RequestTracer.get_correlation_id())

        output = stream.getvalue().strip()
        log_data = json.loads(output)

        assert log_data["request_id"] == "integration-123"

    def test_metrics_with_logging(self):
        """Test metrics and logging work together."""
        logger = StructuredLogger("metrics_test")
        stream = StringIO()
        handler = logging.StreamHandler(stream)
        handler.setFormatter(JSONFormatter())
        logger.logger.handlers = [handler]

        # Track request
        start = time.time()

        # Simulate request processing
        logger.info("Request started", endpoint="/test")
        time.sleep(0.01)

        duration = time.time() - start
        request_duration.labels(method="GET", endpoint="/test").observe(duration)
        request_count.labels(method="GET", endpoint="/test", status="200").inc()

        logger.info("Request completed", endpoint="/test", duration=duration)

        # Verify logging
        outputs = stream.getvalue().strip().split("\n")
        assert len(outputs) == 2

        # Verify metrics updated
        assert request_duration.labels(method="GET", endpoint="/test")._sum.get() > 0


class TestPerformance:
    """Test observability performance impact."""

    def test_logging_overhead(self):
        """Test logging overhead is minimal (<1ms per request)."""
        logger = StructuredLogger("perf_test")

        # Warmup
        for _ in range(10):
            logger.info("Warmup")

        # Measure
        iterations = 100
        start = time.time()

        for i in range(iterations):
            logger.info("Performance test", iteration=i)

        duration = time.time() - start
        avg_per_log = (duration / iterations) * 1000  # Convert to ms

        # Should be less than 1ms per log
        assert avg_per_log < 1.0

    def test_metrics_collection_overhead(self):
        """Test metrics collection overhead is minimal (<0.5ms)."""
        iterations = 1000

        start = time.time()

        for i in range(iterations):
            request_count.labels(method="GET", endpoint="/perf", status="200").inc()
            request_duration.labels(method="GET", endpoint="/perf").observe(0.1)

        duration = time.time() - start
        avg_per_metric = (duration / iterations) * 1000  # Convert to ms

        # Should be less than 0.5ms per metric operation
        assert avg_per_metric < 0.5

    def test_correlation_id_generation_speed(self):
        """Test correlation ID generation is fast."""
        iterations = 1000

        start = time.time()

        for _ in range(iterations):
            RequestTracer.generate_correlation_id()

        duration = time.time() - start
        avg_per_gen = (duration / iterations) * 1000  # Convert to ms

        # Should be very fast (<0.1ms)
        assert avg_per_gen < 0.1
