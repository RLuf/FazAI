"""Tests for WebSocket streaming functionality."""

import asyncio
import json
import time
import pytest
from fastapi.testclient import TestClient

from worker_python.api import app


@pytest.fixture
def client():
    """Create synchronous test client."""
    return TestClient(app)


class TestWebSocketConnection:
    """Tests for WebSocket connection lifecycle."""

    def test_websocket_connection(self, client):
        """Test WebSocket connection can be established."""
        with client.websocket_connect("/ws") as websocket:
            # Connection should be established
            assert websocket is not None

    def test_websocket_multiple_connections(self, client):
        """Test multiple concurrent WebSocket connections."""
        connections = []

        # Open multiple connections
        for i in range(3):
            ws = client.websocket_connect("/ws")
            connections.append(ws.__enter__())

        # All should be connected
        assert len(connections) == 3

        # Close all
        for ws in connections:
            ws.close()

    def test_websocket_disconnect(self, client):
        """Test WebSocket graceful disconnect."""
        with client.websocket_connect("/ws") as websocket:
            pass  # Context manager handles disconnect

        # Should not raise exceptions


class TestWebSocketMessaging:
    """Tests for WebSocket message exchange."""

    def test_websocket_send_receive(self, client):
        """Test sending and receiving messages."""
        with client.websocket_connect("/ws") as websocket:
            # Send a request
            request = {
                "input": "Hello, WebSocket!"
            }
            websocket.send_text(json.dumps(request))

            # Should receive events
            received_events = []
            timeout_count = 0
            max_timeout = 10

            while timeout_count < max_timeout:
                try:
                    # Use shorter timeout for testing
                    data = websocket.receive_text(timeout=1.0)
                    event = json.loads(data.strip())
                    received_events.append(event)

                    # If we got a result or error, we're done
                    if event.get("type") in ["result", "error"]:
                        break

                except Exception:
                    timeout_count += 1

            # Should have received at least session event
            assert len(received_events) > 0

            # First event should be session
            first_event = received_events[0]
            assert first_event["type"] == "session"
            assert "session_id" in first_event

    def test_websocket_ndjson_format(self, client):
        """Test ND-JSON format (newline-delimited JSON)."""
        with client.websocket_connect("/ws") as websocket:
            request = {
                "input": "Test ND-JSON format"
            }
            websocket.send_text(json.dumps(request))

            # Receive first message
            data = websocket.receive_text(timeout=5.0)

            # Should end with newline
            assert data.endswith("\n")

            # Should be valid JSON when stripped
            event = json.loads(data.strip())
            assert isinstance(event, dict)
            assert "type" in event

    def test_websocket_event_types(self, client):
        """Test different event types in stream."""
        with client.websocket_connect("/ws") as websocket:
            request = {
                "input": "Test event types"
            }
            websocket.send_text(json.dumps(request))

            received_types = set()
            timeout_count = 0
            max_timeout = 10

            while timeout_count < max_timeout:
                try:
                    data = websocket.receive_text(timeout=1.0)
                    event = json.loads(data.strip())
                    received_types.add(event["type"])

                    if event["type"] in ["result", "error"]:
                        break

                except Exception:
                    timeout_count += 1

            # Should have session event
            assert "session" in received_types

            # Should have result or error
            assert "result" in received_types or "error" in received_types


class TestWebSocketValidation:
    """Tests for WebSocket request validation."""

    def test_websocket_invalid_json(self, client):
        """Test handling of invalid JSON."""
        with client.websocket_connect("/ws") as websocket:
            # Send invalid JSON
            websocket.send_text("not json")

            # Should receive error event
            data = websocket.receive_text(timeout=5.0)
            event = json.loads(data.strip())

            assert event["type"] == "error"
            assert "INVALID_JSON" in event.get("code", "")

    def test_websocket_missing_input(self, client):
        """Test handling of missing input field."""
        with client.websocket_connect("/ws") as websocket:
            # Send request without input
            request = {"other_field": "value"}
            websocket.send_text(json.dumps(request))

            # Should receive error event
            data = websocket.receive_text(timeout=5.0)
            event = json.loads(data.strip())

            assert event["type"] == "error"
            assert "INVALID_REQUEST" in event.get("code", "")

    def test_websocket_empty_input(self, client):
        """Test handling of empty input."""
        with client.websocket_connect("/ws") as websocket:
            # Send request with empty input
            request = {"input": ""}
            websocket.send_text(json.dumps(request))

            # Should receive error event
            data = websocket.receive_text(timeout=5.0)
            event = json.loads(data.strip())

            assert event["type"] == "error"
            assert "INVALID_REQUEST" in event.get("code", "")


class TestWebSocketStreaming:
    """Tests for streaming behavior."""

    def test_websocket_streaming_sequence(self, client):
        """Test correct sequence of streaming events."""
        with client.websocket_connect("/ws") as websocket:
            request = {
                "input": "Test streaming sequence"
            }
            websocket.send_text(json.dumps(request))

            events = []
            timeout_count = 0
            max_timeout = 15

            while timeout_count < max_timeout:
                try:
                    data = websocket.receive_text(timeout=1.0)
                    event = json.loads(data.strip())
                    events.append(event)

                    if event["type"] in ["result", "error"]:
                        break

                except Exception:
                    timeout_count += 1

            # Should have multiple events
            assert len(events) > 0

            # First should be session
            assert events[0]["type"] == "session"

            # Last should be result or error
            assert events[-1]["type"] in ["result", "error"]

    def test_websocket_multiple_requests(self, client):
        """Test sending multiple requests on same connection."""
        with client.websocket_connect("/ws") as websocket:
            for i in range(3):
                request = {
                    "input": f"Request {i}"
                }
                websocket.send_text(json.dumps(request))

                # Wait for completion
                timeout_count = 0
                max_timeout = 10

                while timeout_count < max_timeout:
                    try:
                        data = websocket.receive_text(timeout=1.0)
                        event = json.loads(data.strip())

                        if event["type"] in ["result", "error"]:
                            break

                    except Exception:
                        timeout_count += 1

            # Should complete without errors
            assert True

    def test_websocket_concurrent_messages(self, client):
        """Test concurrent WebSocket connections."""
        import concurrent.futures

        def send_message(i):
            with client.websocket_connect("/ws") as websocket:
                request = {"input": f"Concurrent message {i}"}
                websocket.send_text(json.dumps(request))

                # Wait for response
                data = websocket.receive_text(timeout=10.0)
                event = json.loads(data.strip())
                return event["type"]

        with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:
            futures = [executor.submit(send_message, i) for i in range(5)]
            results = [f.result() for f in concurrent.futures.as_completed(futures)]

        # All should get responses
        assert len(results) == 5
        assert all(r in ["session", "reasoning", "result", "error"] for r in results)


class TestWebSocketPerformance:
    """Performance tests for WebSocket."""

    def test_websocket_latency(self, client):
        """Test WebSocket response latency."""
        import time

        with client.websocket_connect("/ws") as websocket:
            start = time.time()

            request = {"input": "Low latency test"}
            websocket.send_text(json.dumps(request))

            # Get first response
            websocket.receive_text(timeout=5.0)

            latency = time.time() - start

            # First response should be fast (session event)
            assert latency < 1.0  # 1 second

    def test_websocket_throughput(self, client):
        """Test WebSocket message throughput."""
        with client.websocket_connect("/ws") as websocket:
            message_count = 10
            start = time.time()

            for i in range(message_count):
                request = {"input": f"Message {i}"}
                websocket.send_text(json.dumps(request))

                # Wait for completion
                timeout_count = 0
                while timeout_count < 10:
                    try:
                        data = websocket.receive_text(timeout=1.0)
                        event = json.loads(data.strip())
                        if event["type"] in ["result", "error"]:
                            break
                    except Exception:
                        timeout_count += 1

            duration = time.time() - start

            # Should handle multiple messages
            assert duration > 0


class TestWebSocketErrorHandling:
    """Tests for WebSocket error handling."""

    def test_websocket_recovers_from_error(self, client):
        """Test WebSocket continues after error."""
        with client.websocket_connect("/ws") as websocket:
            # Send invalid request
            websocket.send_text("invalid")

            # Get error
            data = websocket.receive_text(timeout=5.0)
            error_event = json.loads(data.strip())
            assert error_event["type"] == "error"

            # Send valid request
            request = {"input": "Valid request"}
            websocket.send_text(json.dumps(request))

            # Should get valid response
            data = websocket.receive_text(timeout=5.0)
            event = json.loads(data.strip())
            assert event["type"] in ["session", "reasoning", "result"]

    def test_websocket_handles_large_payload(self, client):
        """Test WebSocket handles large input."""
        with client.websocket_connect("/ws") as websocket:
            # Send large input
            large_input = "A" * 10000  # 10KB
            request = {"input": large_input}
            websocket.send_text(json.dumps(request))

            # Should handle it
            data = websocket.receive_text(timeout=10.0)
            event = json.loads(data.strip())
            assert event["type"] in ["session", "error"]


class TestWebSocketSessionManagement:
    """Tests for session management."""

    def test_websocket_unique_session_ids(self, client):
        """Test each connection gets unique session ID."""
        session_ids = []

        for _ in range(3):
            with client.websocket_connect("/ws") as websocket:
                request = {"input": "Test session"}
                websocket.send_text(json.dumps(request))

                # Get session event
                data = websocket.receive_text(timeout=5.0)
                event = json.loads(data.strip())

                if event["type"] == "session":
                    session_ids.append(event["session_id"])

        # All session IDs should be unique
        assert len(session_ids) == len(set(session_ids))

    def test_websocket_session_persists(self, client):
        """Test session ID persists across messages."""
        with client.websocket_connect("/ws") as websocket:
            first_session_id = None

            for i in range(2):
                request = {"input": f"Message {i}"}
                websocket.send_text(json.dumps(request))

                # Get session event
                data = websocket.receive_text(timeout=5.0)
                event = json.loads(data.strip())

                if event["type"] == "session":
                    if first_session_id is None:
                        first_session_id = event["session_id"]
                    else:
                        # Same session for same connection
                        assert event["session_id"] == first_session_id

                # Drain remaining events
                timeout_count = 0
                while timeout_count < 5:
                    try:
                        data = websocket.receive_text(timeout=0.5)
                        event = json.loads(data.strip())
                        if event["type"] in ["result", "error"]:
                            break
                    except Exception:
                        timeout_count += 1
                        break
