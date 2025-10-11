#!/usr/bin/env python3
"""Manual test script to verify API functionality."""

import sys
import time

def test_health():
    """Test health endpoint."""
    import requests

    print("Testing /health endpoint...")
    try:
        response = requests.get("http://localhost:3125/health")
        print(f"  Status: {response.status_code}")
        print(f"  Response: {response.json()}")
        assert response.status_code == 200
        print("  ✓ Health check passed")
    except Exception as e:
        print(f"  ✗ Failed: {e}")
        return False
    return True


def test_ready():
    """Test ready endpoint."""
    import requests

    print("\nTesting /ready endpoint...")
    try:
        response = requests.get("http://localhost:3125/ready")
        print(f"  Status: {response.status_code}")
        print(f"  Response: {response.json()}")
        if response.status_code == 200:
            print("  ✓ Model is ready")
        else:
            print("  ⚠ Model not loaded (expected without model file)")
        return True
    except Exception as e:
        print(f"  ✗ Failed: {e}")
        return False


def test_execute():
    """Test execute endpoint."""
    import requests

    print("\nTesting /v1/execute endpoint...")
    try:
        payload = {
            "input": "Hello, how are you?",
            "max_tokens": 50
        }
        response = requests.post("http://localhost:3125/v1/execute", json=payload)
        print(f"  Status: {response.status_code}")

        if response.status_code == 200:
            data = response.json()
            print(f"  Result: {data.get('result', '')[:100]}...")
            print(f"  Inference time: {data.get('inference_time_ms')}ms")
            print("  ✓ Execute passed")
        elif response.status_code == 503:
            print("  ⚠ Model not loaded (expected without model file)")
        else:
            print(f"  Response: {response.json()}")

        return True
    except Exception as e:
        print(f"  ✗ Failed: {e}")
        return False


def test_websocket():
    """Test WebSocket endpoint."""
    import websocket
    import json

    print("\nTesting /ws endpoint...")
    try:
        ws = websocket.create_connection("ws://localhost:3125/ws")
        print("  ✓ WebSocket connected")

        # Send request
        request = {"input": "Test message"}
        ws.send(json.dumps(request))
        print(f"  ✓ Sent request: {request}")

        # Receive events
        events = []
        for i in range(5):
            try:
                data = ws.recv()
                event = json.loads(data.strip())
                events.append(event)
                print(f"  ← Event: {event['type']}")

                if event['type'] in ['result', 'error']:
                    break
            except Exception as e:
                print(f"  ⚠ No more events: {e}")
                break

        ws.close()

        if len(events) > 0:
            print(f"  ✓ Received {len(events)} events")
        else:
            print("  ⚠ No events received (model may not be loaded)")

        return True
    except Exception as e:
        print(f"  ✗ Failed: {e}")
        return False


def main():
    """Run all manual tests."""
    print("=" * 60)
    print("FazAI Gemma Worker - Manual Integration Tests")
    print("=" * 60)
    print("\nNote: Server must be running on http://localhost:3125")
    print("Start with: python -m worker_python --mode=daemon\n")

    time.sleep(1)

    results = []
    results.append(("Health", test_health()))
    results.append(("Ready", test_ready()))
    results.append(("Execute", test_execute()))
    results.append(("WebSocket", test_websocket()))

    print("\n" + "=" * 60)
    print("Test Summary")
    print("=" * 60)
    for name, passed in results:
        status = "✓ PASS" if passed else "✗ FAIL"
        print(f"{status:10} {name}")

    total = len(results)
    passed = sum(1 for _, p in results if p)
    print(f"\nTotal: {passed}/{total} passed")

    return 0 if passed == total else 1


if __name__ == "__main__":
    sys.exit(main())
