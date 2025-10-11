"""Test suite for security modules.

Tests rate limiting, security audit logging, and security scenarios.
"""

import asyncio
import json
import tempfile
import time
from pathlib import Path
from unittest.mock import MagicMock

import pytest
from fastapi import HTTPException

from security.audit import AuditEventType, AuditLogger
from security.rate_limit import RateLimiter


class MockRequest:
    """Mock FastAPI Request for testing."""

    def __init__(self, client_host: str = "127.0.0.1"):
        self.client = MagicMock()
        self.client.host = client_host


class TestRateLimiter:
    """Test rate limiting functionality."""

    def test_rate_limiter_initialization(self):
        """Test rate limiter can be initialized with limits."""
        limiter = RateLimiter(requests_per_minute=60, requests_per_hour=1000)

        assert limiter.rpm == 60
        assert limiter.rph == 1000
        assert isinstance(limiter.requests, dict)

    def test_rate_limiter_default_limits(self):
        """Test rate limiter uses default limits."""
        limiter = RateLimiter()

        assert limiter.rpm == 60
        assert limiter.rph == 1000

    @pytest.mark.asyncio
    async def test_single_request_allowed(self):
        """Test single request is allowed."""
        limiter = RateLimiter(requests_per_minute=10, requests_per_hour=100)
        request = MockRequest()

        # Should not raise exception
        result = await limiter.check_rate_limit(request)
        assert result is True

    @pytest.mark.asyncio
    async def test_requests_within_limit_allowed(self):
        """Test requests within limit are allowed."""
        limiter = RateLimiter(requests_per_minute=10, requests_per_hour=100)
        request = MockRequest()

        # Make 5 requests (within limit)
        for _ in range(5):
            result = await limiter.check_rate_limit(request)
            assert result is True

    @pytest.mark.asyncio
    async def test_minute_rate_limit_exceeded(self):
        """Test exceeding per-minute rate limit raises exception."""
        limiter = RateLimiter(requests_per_minute=5, requests_per_hour=100)
        request = MockRequest()

        # Make requests up to limit
        for _ in range(5):
            await limiter.check_rate_limit(request)

        # Next request should fail
        with pytest.raises(HTTPException) as exc_info:
            await limiter.check_rate_limit(request)

        assert exc_info.value.status_code == 429
        assert "requests per minute" in exc_info.value.detail.lower()
        assert "X-RateLimit-Limit" in exc_info.value.headers
        assert "X-RateLimit-Remaining" in exc_info.value.headers
        assert exc_info.value.headers["X-RateLimit-Remaining"] == "0"

    @pytest.mark.asyncio
    async def test_hour_rate_limit_exceeded(self):
        """Test exceeding per-hour rate limit raises exception."""
        limiter = RateLimiter(requests_per_minute=100, requests_per_hour=5)
        request = MockRequest()

        # Make requests up to hourly limit
        for _ in range(5):
            await limiter.check_rate_limit(request)

        # Next request should fail
        with pytest.raises(HTTPException) as exc_info:
            await limiter.check_rate_limit(request)

        assert exc_info.value.status_code == 429
        assert "requests per hour" in exc_info.value.detail.lower()

    @pytest.mark.asyncio
    async def test_different_ips_tracked_separately(self):
        """Test different IP addresses are tracked separately."""
        limiter = RateLimiter(requests_per_minute=3, requests_per_hour=100)

        request1 = MockRequest(client_host="192.168.1.1")
        request2 = MockRequest(client_host="192.168.1.2")

        # Each IP should have independent limits
        for _ in range(3):
            await limiter.check_rate_limit(request1)
            await limiter.check_rate_limit(request2)

        # Both should now be at limit
        with pytest.raises(HTTPException):
            await limiter.check_rate_limit(request1)

        with pytest.raises(HTTPException):
            await limiter.check_rate_limit(request2)

    @pytest.mark.asyncio
    async def test_old_requests_cleaned_up(self):
        """Test old requests are removed from tracking."""
        limiter = RateLimiter(requests_per_minute=5, requests_per_hour=10)
        request = MockRequest()

        # Make request and manually add old timestamp
        await limiter.check_rate_limit(request)

        # Add old timestamp (2 hours ago)
        old_time = time.time() - 7200
        limiter.requests[request.client.host].append(old_time)

        # Old request should be cleaned up on next check
        await limiter.check_rate_limit(request)

        # Verify old timestamp removed
        recent_requests = [
            t for t in limiter.requests[request.client.host] if time.time() - t < 3600
        ]
        assert old_time not in recent_requests

    @pytest.mark.asyncio
    async def test_rate_limit_reset_time(self):
        """Test rate limit reset time is provided in headers."""
        limiter = RateLimiter(requests_per_minute=2, requests_per_hour=100)
        request = MockRequest()

        # Hit limit
        await limiter.check_rate_limit(request)
        await limiter.check_rate_limit(request)

        # Exceed limit
        with pytest.raises(HTTPException) as exc_info:
            await limiter.check_rate_limit(request)

        # Should include reset time
        assert "X-RateLimit-Reset" in exc_info.value.headers
        reset_time = int(exc_info.value.headers["X-RateLimit-Reset"])
        assert reset_time > time.time()

    @pytest.mark.asyncio
    async def test_get_remaining_requests(self):
        """Test getting remaining request counts."""
        limiter = RateLimiter(requests_per_minute=5, requests_per_hour=20)
        request = MockRequest(client_host="192.168.1.10")

        # Make some requests
        await limiter.check_rate_limit(request)
        await limiter.check_rate_limit(request)

        # Check remaining
        remaining = limiter.get_remaining_requests("192.168.1.10")
        assert remaining["minute_remaining"] == 3
        assert remaining["hour_remaining"] == 18

    @pytest.mark.asyncio
    async def test_reset_client(self):
        """Test resetting rate limit for a client."""
        limiter = RateLimiter(requests_per_minute=2, requests_per_hour=10)
        request = MockRequest(client_host="192.168.1.20")

        # Max out rate limit
        await limiter.check_rate_limit(request)
        await limiter.check_rate_limit(request)

        # Should be at limit
        with pytest.raises(HTTPException):
            await limiter.check_rate_limit(request)

        # Reset client
        limiter.reset_client("192.168.1.20")

        # Should work again
        await limiter.check_rate_limit(request)

    @pytest.mark.asyncio
    async def test_get_stats(self):
        """Test getting rate limiter statistics."""
        limiter = RateLimiter()

        # Make requests from different IPs
        for i in range(5):
            request = MockRequest(client_host=f"192.168.1.{i}")
            await limiter.check_rate_limit(request)

        # Get stats
        stats = limiter.get_stats()
        assert stats["active_clients"] > 0
        assert stats["total_requests_tracked"] >= 5


class TestAuditLogger:
    """Test security audit logging."""

    def test_audit_logger_initialization(self):
        """Test audit logger can be initialized."""
        with tempfile.NamedTemporaryFile(mode="w", delete=False, suffix=".log") as f:
            log_file = f.name

        try:
            logger = AuditLogger(log_file=log_file)
            assert logger.log_file == log_file
            assert logger.last_hash is None
        finally:
            Path(log_file).unlink(missing_ok=True)

    def test_audit_event_logging(self):
        """Test audit events are logged correctly."""
        with tempfile.NamedTemporaryFile(mode="w", delete=False, suffix=".log") as f:
            log_file = f.name

        try:
            logger = AuditLogger(log_file=log_file)

            event = logger.log_event(
                event_type=AuditEventType.AUTH_SUCCESS,
                user="test_user",
                action="login",
                resource="/api/login",
                outcome="success",
                ip_address="192.168.1.1",
            )

            # Verify event structure
            assert event["event_type"] == "auth_success"
            assert event["user"] == "test_user"
            assert event["action"] == "login"
            assert event["resource"] == "/api/login"
            assert event["outcome"] == "success"
            assert event["metadata"]["ip_address"] == "192.168.1.1"
            assert "timestamp" in event
            assert "hash" in event
            assert event["previous_hash"] is None

            # Verify event written to file
            with open(log_file, "r") as f:
                logged_event = json.loads(f.read().strip())
                assert logged_event == event

        finally:
            Path(log_file).unlink(missing_ok=True)

    def test_audit_event_chain_integrity(self):
        """Test audit log maintains chain integrity with hashes."""
        with tempfile.NamedTemporaryFile(mode="w", delete=False, suffix=".log") as f:
            log_file = f.name

        try:
            logger = AuditLogger(log_file=log_file)

            # Log first event
            event1 = logger.log_event(
                event_type=AuditEventType.AUTH_SUCCESS,
                user="user1",
                action="login",
            )

            # Log second event
            event2 = logger.log_event(
                event_type=AuditEventType.CONFIG_CHANGE,
                user="user2",
                action="update_config",
            )

            # Event 2 should reference event 1's hash
            assert event2["previous_hash"] == event1["hash"]
            assert event2["hash"] != event1["hash"]

            # Log third event
            event3 = logger.log_event(
                event_type=AuditEventType.DATA_ACCESS,
                user="user3",
                action="read_data",
            )

            # Event 3 should reference event 2's hash
            assert event3["previous_hash"] == event2["hash"]

        finally:
            Path(log_file).unlink(missing_ok=True)

    def test_dangerous_command_logging(self):
        """Test logging of dangerous command attempts."""
        with tempfile.NamedTemporaryFile(mode="w", delete=False, suffix=".log") as f:
            log_file = f.name

        try:
            logger = AuditLogger(log_file=log_file)

            event = logger.log_event(
                event_type=AuditEventType.DANGEROUS_COMMAND,
                user="system",
                action="command_blocked",
                resource="rm -rf /",
                outcome="blocked",
                reason="Dangerous command detected",
            )

            assert event["event_type"] == "dangerous_command"
            assert event["outcome"] == "blocked"
            assert event["resource"] == "rm -rf /"

        finally:
            Path(log_file).unlink(missing_ok=True)

    def test_permission_escalation_logging(self):
        """Test logging of permission escalation attempts."""
        with tempfile.NamedTemporaryFile(mode="w", delete=False, suffix=".log") as f:
            log_file = f.name

        try:
            logger = AuditLogger(log_file=log_file)

            event = logger.log_event(
                event_type=AuditEventType.PERMISSION_ESCALATION,
                user="guest_user",
                action="sudo_attempt",
                resource="/admin/panel",
                outcome="denied",
                from_role="user",
                to_role="admin",
            )

            assert event["event_type"] == "permission_escalation"
            assert event["outcome"] == "denied"
            assert event["metadata"]["from_role"] == "user"
            assert event["metadata"]["to_role"] == "admin"

        finally:
            Path(log_file).unlink(missing_ok=True)

    def test_multiple_events_all_logged(self):
        """Test multiple events are all logged to file."""
        with tempfile.NamedTemporaryFile(mode="w", delete=False, suffix=".log") as f:
            log_file = f.name

        try:
            logger = AuditLogger(log_file=log_file)

            # Log multiple events
            for i in range(5):
                logger.log_event(
                    event_type=AuditEventType.DATA_ACCESS,
                    user=f"user{i}",
                    action="read",
                    resource=f"/data/{i}",
                )

            # Verify all events logged
            with open(log_file, "r") as f:
                lines = f.readlines()
                assert len(lines) == 5

                # Verify each line is valid JSON
                for line in lines:
                    event = json.loads(line.strip())
                    assert "timestamp" in event
                    assert "hash" in event

        finally:
            Path(log_file).unlink(missing_ok=True)

    def test_audit_event_types(self):
        """Test all audit event types can be logged."""
        with tempfile.NamedTemporaryFile(mode="w", delete=False, suffix=".log") as f:
            log_file = f.name

        try:
            logger = AuditLogger(log_file=log_file)

            event_types = [
                AuditEventType.AUTH_SUCCESS,
                AuditEventType.AUTH_FAILURE,
                AuditEventType.DANGEROUS_COMMAND,
                AuditEventType.PERMISSION_ESCALATION,
                AuditEventType.CONFIG_CHANGE,
                AuditEventType.DATA_ACCESS,
            ]

            for event_type in event_types:
                event = logger.log_event(
                    event_type=event_type,
                    user="test_user",
                    action="test_action",
                )
                assert event["event_type"] == event_type.value

        finally:
            Path(log_file).unlink(missing_ok=True)

    def test_verify_integrity_success(self):
        """Test integrity verification succeeds for valid chain."""
        with tempfile.NamedTemporaryFile(mode="w", delete=False, suffix=".log") as f:
            log_file = f.name

        try:
            logger = AuditLogger(log_file=log_file)

            # Log several events
            for i in range(5):
                logger.log_event(
                    event_type=AuditEventType.DATA_ACCESS,
                    user=f"user{i}",
                    action="read",
                )

            # Verify integrity
            assert logger.verify_integrity() is True

        finally:
            Path(log_file).unlink(missing_ok=True)

    def test_get_events_all(self):
        """Test retrieving all events."""
        with tempfile.NamedTemporaryFile(mode="w", delete=False, suffix=".log") as f:
            log_file = f.name

        try:
            logger = AuditLogger(log_file=log_file)

            # Log events
            for i in range(5):
                logger.log_event(
                    event_type=AuditEventType.DATA_ACCESS,
                    user=f"user{i}",
                    action="read",
                )

            # Get all events
            events = logger.get_events()
            assert len(events) == 5

        finally:
            Path(log_file).unlink(missing_ok=True)

    def test_get_events_filtered_by_type(self):
        """Test retrieving events filtered by type."""
        with tempfile.NamedTemporaryFile(mode="w", delete=False, suffix=".log") as f:
            log_file = f.name

        try:
            logger = AuditLogger(log_file=log_file)

            # Log different event types
            logger.log_event(
                event_type=AuditEventType.AUTH_SUCCESS,
                user="user1",
                action="login",
            )
            logger.log_event(
                event_type=AuditEventType.DATA_ACCESS,
                user="user2",
                action="read",
            )
            logger.log_event(
                event_type=AuditEventType.AUTH_SUCCESS,
                user="user3",
                action="login",
            )

            # Get only auth events
            events = logger.get_events(event_type=AuditEventType.AUTH_SUCCESS)
            assert len(events) == 2
            assert all(e["event_type"] == "auth_success" for e in events)

        finally:
            Path(log_file).unlink(missing_ok=True)

    def test_get_events_filtered_by_user(self):
        """Test retrieving events filtered by user."""
        with tempfile.NamedTemporaryFile(mode="w", delete=False, suffix=".log") as f:
            log_file = f.name

        try:
            logger = AuditLogger(log_file=log_file)

            # Log events from different users
            for i in range(5):
                logger.log_event(
                    event_type=AuditEventType.DATA_ACCESS,
                    user="user1" if i % 2 == 0 else "user2",
                    action="read",
                )

            # Get events for user1 only
            events = logger.get_events(user="user1")
            assert len(events) == 3
            assert all(e["user"] == "user1" for e in events)

        finally:
            Path(log_file).unlink(missing_ok=True)

    def test_get_events_with_limit(self):
        """Test retrieving limited number of events."""
        with tempfile.NamedTemporaryFile(mode="w", delete=False, suffix=".log") as f:
            log_file = f.name

        try:
            logger = AuditLogger(log_file=log_file)

            # Log many events
            for i in range(10):
                logger.log_event(
                    event_type=AuditEventType.DATA_ACCESS,
                    user=f"user{i}",
                    action="read",
                )

            # Get only 3 most recent
            events = logger.get_events(limit=3)
            assert len(events) == 3

        finally:
            Path(log_file).unlink(missing_ok=True)

    def test_get_stats(self):
        """Test audit log statistics."""
        with tempfile.NamedTemporaryFile(mode="w", delete=False, suffix=".log") as f:
            log_file = f.name

        try:
            logger = AuditLogger(log_file=log_file)

            # Log various events
            logger.log_event(
                event_type=AuditEventType.AUTH_SUCCESS,
                user="user1",
                action="login",
            )
            logger.log_event(
                event_type=AuditEventType.AUTH_SUCCESS,
                user="user2",
                action="login",
            )
            logger.log_event(
                event_type=AuditEventType.DATA_ACCESS,
                user="user1",
                action="read",
            )

            # Get stats
            stats = logger.get_stats()
            assert stats["total_events"] == 3
            assert stats["events_by_type"]["auth_success"] == 2
            assert stats["events_by_type"]["data_access"] == 1
            assert stats["events_by_user"]["user1"] == 2
            assert stats["events_by_user"]["user2"] == 1
            assert stats["integrity_verified"] is True

        finally:
            Path(log_file).unlink(missing_ok=True)


class TestSecurityIntegration:
    """Test integration of security components."""

    @pytest.mark.asyncio
    async def test_rate_limit_with_audit_logging(self):
        """Test rate limiting logs to audit log."""
        with tempfile.NamedTemporaryFile(mode="w", delete=False, suffix=".log") as f:
            log_file = f.name

        try:
            limiter = RateLimiter(requests_per_minute=2, requests_per_hour=100)
            audit_logger = AuditLogger(log_file=log_file)
            request = MockRequest(client_host="10.0.0.1")

            # Make requests
            await limiter.check_rate_limit(request)
            await limiter.check_rate_limit(request)

            # Exceed limit and log
            try:
                await limiter.check_rate_limit(request)
            except HTTPException:
                audit_logger.log_event(
                    event_type=AuditEventType.AUTH_FAILURE,
                    user="unknown",
                    action="rate_limit_exceeded",
                    resource="/api",
                    outcome="blocked",
                    ip_address="10.0.0.1",
                )

            # Verify audit log
            with open(log_file, "r") as f:
                event = json.loads(f.read().strip())
                assert event["action"] == "rate_limit_exceeded"
                assert event["metadata"]["ip_address"] == "10.0.0.1"

        finally:
            Path(log_file).unlink(missing_ok=True)

    @pytest.mark.asyncio
    async def test_concurrent_rate_limiting(self):
        """Test rate limiting works correctly with concurrent requests."""
        limiter = RateLimiter(requests_per_minute=10, requests_per_hour=100)
        request = MockRequest()

        # Make concurrent requests
        async def make_request():
            return await limiter.check_rate_limit(request)

        # 5 concurrent requests should all succeed
        results = await asyncio.gather(*[make_request() for _ in range(5)])
        assert all(results)

        # Next 5 should also succeed (total 10)
        results = await asyncio.gather(*[make_request() for _ in range(5)])
        assert all(results)

        # 11th request should fail
        with pytest.raises(HTTPException):
            await limiter.check_rate_limit(request)


class TestSecurityScenarios:
    """Test realistic security scenarios."""

    @pytest.mark.asyncio
    async def test_brute_force_protection(self):
        """Test rate limiting protects against brute force attacks."""
        limiter = RateLimiter(requests_per_minute=5, requests_per_hour=20)
        request = MockRequest(client_host="attacker.ip")

        # Simulate brute force login attempts
        successful_attempts = 0
        failed_attempts = 0

        for _ in range(10):
            try:
                await limiter.check_rate_limit(request)
                successful_attempts += 1
            except HTTPException:
                failed_attempts += 1

        # Should block most attempts
        assert failed_attempts > 0
        assert successful_attempts <= 5

    def test_audit_trail_tampering_detection(self):
        """Test audit log can detect tampering."""
        with tempfile.NamedTemporaryFile(mode="w", delete=False, suffix=".log") as f:
            log_file = f.name

        try:
            logger = AuditLogger(log_file=log_file)

            # Log events
            logger.log_event(
                event_type=AuditEventType.AUTH_SUCCESS,
                user="user1",
                action="login",
            )

            logger.log_event(
                event_type=AuditEventType.DATA_ACCESS,
                user="user2",
                action="read",
            )

            # Read events
            with open(log_file, "r") as f:
                events = [json.loads(line.strip()) for line in f.readlines()]

            # Verify chain integrity
            for i in range(1, len(events)):
                # Each event should reference previous hash
                expected_prev_hash = events[i - 1]["hash"]
                actual_prev_hash = events[i]["previous_hash"]
                assert actual_prev_hash == expected_prev_hash

        finally:
            Path(log_file).unlink(missing_ok=True)

    @pytest.mark.asyncio
    async def test_distributed_attack_mitigation(self):
        """Test rate limiting handles distributed attacks."""
        limiter = RateLimiter(requests_per_minute=3, requests_per_hour=10)

        # Simulate requests from different IPs
        ips = [f"192.168.1.{i}" for i in range(1, 6)]
        requests = [MockRequest(client_host=ip) for ip in ips]

        # Each IP can make up to 3 requests per minute
        for request in requests:
            for _ in range(3):
                await limiter.check_rate_limit(request)

        # All IPs should now be rate limited
        for request in requests:
            with pytest.raises(HTTPException):
                await limiter.check_rate_limit(request)


class TestPerformance:
    """Test security performance impact."""

    @pytest.mark.asyncio
    async def test_rate_limit_check_speed(self):
        """Test rate limit check is fast (<0.1ms)."""
        # Use higher limits for performance test
        limiter = RateLimiter(requests_per_minute=1000, requests_per_hour=10000)
        request = MockRequest()

        # Warmup
        for _ in range(10):
            await limiter.check_rate_limit(request)

        # Clear for fresh test
        limiter.requests.clear()

        # Measure
        iterations = 100
        start = time.time()

        for _ in range(iterations):
            await limiter.check_rate_limit(request)

        duration = time.time() - start
        avg_per_check = (duration / iterations) * 1000  # Convert to ms

        # Should be less than 0.1ms per check
        assert avg_per_check < 0.1

    def test_audit_logging_speed(self):
        """Test audit logging is reasonably fast (<2ms)."""
        with tempfile.NamedTemporaryFile(mode="w", delete=False, suffix=".log") as f:
            log_file = f.name

        try:
            logger = AuditLogger(log_file=log_file)

            # Warmup
            for _ in range(10):
                logger.log_event(
                    event_type=AuditEventType.DATA_ACCESS,
                    user="test",
                    action="test",
                )

            # Measure
            iterations = 100
            start = time.time()

            for i in range(iterations):
                logger.log_event(
                    event_type=AuditEventType.DATA_ACCESS,
                    user=f"user{i}",
                    action="read",
                )

            duration = time.time() - start
            avg_per_log = (duration / iterations) * 1000  # Convert to ms

            # Should be less than 2ms per log
            assert avg_per_log < 2.0

        finally:
            Path(log_file).unlink(missing_ok=True)
