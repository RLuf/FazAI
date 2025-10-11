# FazAI Gemma Worker API Documentation

FastAPI server for local LLM inference with WebSocket streaming support.

## Installation

```bash
cd /home/rluft/fazai/opt/fazai/worker-python
pip install -r requirements.txt
```

## Running the Server

### Daemon Mode (Production)

```bash
python -m worker_python --mode=daemon --host=0.0.0.0 --port=3125
```

### Interactive Mode (Testing)

```bash
python -m worker_python --mode=interactive
```

### Test Mode (Quick Check)

```bash
python -m worker_python --mode=test
```

## API Endpoints

### Health Checks

#### GET /health
Liveness probe - check if service is running.

```bash
curl http://localhost:3125/health
```

Response:
```json
{
  "status": "healthy",
  "version": "2.0.0"
}
```

#### GET /ready
Readiness probe - check if model is loaded.

```bash
curl http://localhost:3125/ready
```

Response:
```json
{
  "status": "ready",
  "model_loaded": true,
  "model_path": "/opt/fazai/models/gemma/gemma-2-2b-it-Q4_K_M.gguf"
}
```

### Inference

#### POST /v1/execute
Synchronous inference endpoint.

Request:
```bash
curl -X POST http://localhost:3125/v1/execute \
  -H "Content-Type: application/json" \
  -d '{
    "input": "Hello, how are you?",
    "max_tokens": 1024,
    "temperature": 0.7,
    "top_p": 0.95,
    "top_k": 40
  }'
```

Response:
```json
{
  "status": "success",
  "result": "I am doing well, thank you for asking!",
  "origin": "local",
  "session_id": "550e8400-e29b-41d4-a716-446655440000",
  "inference_time_ms": 982.45
}
```

### WebSocket Streaming

#### WS /ws
Real-time streaming with ND-JSON events.

```python
import asyncio
import websockets
import json

async def test_websocket():
    async with websockets.connect("ws://localhost:3125/ws") as ws:
        # Send request
        request = {
            "input": "Tell me a story",
            "max_tokens": 500
        }
        await ws.send(json.dumps(request))

        # Receive streaming events
        async for message in ws:
            event = json.loads(message.strip())
            print(f"Event: {event['type']}")

            if event['type'] == 'result':
                print(f"Result: {event['content']}")
                break

asyncio.run(test_websocket())
```

### ND-JSON Event Types

#### Session Event
```json
{
  "type": "session",
  "session_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

#### Reasoning Event
```json
{
  "type": "reasoning",
  "content": "Processing your request..."
}
```

#### Result Event
```json
{
  "type": "result",
  "status": "success",
  "content": "Generated response text",
  "origin": "local"
}
```

#### Error Event
```json
{
  "type": "error",
  "error": "Error description",
  "code": "ERROR_CODE"
}
```

## Configuration

Environment variables:

```bash
# Model configuration
export GEMMA_MODEL_PATH="/opt/fazai/models/gemma/gemma-2-2b-it-Q4_K_M.gguf"
export GEMMA_N_CTX=2048
export GEMMA_N_THREADS=8
export GEMMA_N_GPU_LAYERS=0

# Inference configuration
export GEMMA_MAX_TOKENS=1024
export GEMMA_TEMPERATURE=0.1
export GEMMA_TOP_P=0.95
export GEMMA_TOP_K=40

# Logging
export LOG_LEVEL=INFO
```

## Testing

Run all tests:
```bash
pytest tests/ -v
```

Run specific test suites:
```bash
# HTTP endpoint tests
pytest tests/test_api.py -v

# WebSocket tests
pytest tests/test_websocket.py -v
```

## OpenAPI Documentation

Once the server is running, visit:
- Swagger UI: http://localhost:3125/docs
- ReDoc: http://localhost:3125/redoc
- OpenAPI Schema: http://localhost:3125/openapi.json

## Performance

- Model load time: ~2.5s
- Inference time: ~1s per request
- WebSocket latency: <100ms
- Concurrent connections: 10+ supported

## Security

For production deployment:

1. Configure CORS properly in `api.py`
2. Add authentication middleware
3. Use HTTPS/WSS with reverse proxy
4. Implement rate limiting
5. Add input validation and sanitization

## Systemd Service

Create `/etc/systemd/system/fazai-gemma-worker.service`:

```ini
[Unit]
Description=FazAI Gemma Worker API
After=network.target

[Service]
Type=simple
User=fazai
WorkingDirectory=/opt/fazai/worker-python
ExecStart=/usr/bin/python3 -m worker_python --mode=daemon --host=0.0.0.0 --port=3125
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Enable and start:
```bash
sudo systemctl enable fazai-gemma-worker
sudo systemctl start fazai-gemma-worker
sudo systemctl status fazai-gemma-worker
```

## Monitoring

Check logs:
```bash
journalctl -u fazai-gemma-worker -f
```

Health check:
```bash
watch -n 5 curl -s http://localhost:3125/health
```
