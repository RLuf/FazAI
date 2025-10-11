"""FastAPI server for FazAI Gemma Worker with WebSocket streaming."""

import asyncio
import json
import logging
import uuid
from contextlib import asynccontextmanager
from typing import AsyncGenerator, Literal, Optional

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response
from pydantic import BaseModel, Field
from prometheus_client import generate_latest

from .config import WorkerConfig
from .main import GemmaWorker
from .middleware import ObservabilityMiddleware, SecurityMiddleware


logger = logging.getLogger(__name__)

# Global worker instance
_worker: Optional[GemmaWorker] = None


class ExecuteRequest(BaseModel):
    """Request model for /v1/execute endpoint."""

    input: str = Field(..., min_length=1, description="Input text prompt")
    max_tokens: Optional[int] = Field(None, ge=1, le=4096, description="Maximum tokens to generate")
    temperature: Optional[float] = Field(None, ge=0.0, le=2.0, description="Sampling temperature")
    top_p: Optional[float] = Field(None, ge=0.0, le=1.0, description="Nucleus sampling threshold")
    top_k: Optional[int] = Field(None, ge=0, description="Top-k sampling")
    session_id: Optional[str] = Field(None, description="Optional session ID for tracking")


class ExecuteResponse(BaseModel):
    """Response model for /v1/execute endpoint."""

    status: str = Field(..., description="Execution status")
    result: str = Field(..., description="Generated response")
    origin: str = Field(default="local", description="Response origin")
    session_id: str = Field(..., description="Session identifier")
    inference_time_ms: Optional[float] = Field(None, description="Inference time in milliseconds")


class HealthResponse(BaseModel):
    """Health check response."""

    status: str = Field(..., description="Health status")
    version: str = Field(default="2.0.0", description="API version")


class ReadyResponse(BaseModel):
    """Readiness check response."""

    status: str = Field(..., description="Ready status")
    model_loaded: bool = Field(..., description="Whether model is loaded")
    model_path: Optional[str] = Field(None, description="Path to loaded model")


class StreamEvent(BaseModel):
    """Base model for streaming events."""

    type: str = Field(..., description="Event type")
    timestamp: Optional[str] = Field(None, description="Event timestamp")


class SessionEvent(StreamEvent):
    """Session initialization event."""

    type: Literal["session"] = Field(default="session", description="Event type")
    session_id: str = Field(..., description="Session UUID")


class ReasoningEvent(StreamEvent):
    """Reasoning/progress event."""

    type: Literal["reasoning"] = Field(default="reasoning", description="Event type")
    content: str = Field(..., description="Reasoning content")


class ResultEvent(StreamEvent):
    """Final result event."""

    type: Literal["result"] = Field(default="result", description="Event type")
    status: str = Field(..., description="Execution status")
    content: str = Field(..., description="Generated content")
    origin: str = Field(default="local", description="Response origin")


class ErrorEvent(StreamEvent):
    """Error event."""

    type: Literal["error"] = Field(default="error", description="Event type")
    error: str = Field(..., description="Error message")
    code: Optional[str] = Field(None, description="Error code")


def get_worker() -> GemmaWorker:
    """Get the global worker instance.

    Returns:
        GemmaWorker instance

    Raises:
        RuntimeError: If worker is not initialized
    """
    if _worker is None:
        raise RuntimeError("Worker not initialized")
    return _worker


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage application lifespan - startup and shutdown events."""
    global _worker

    # Startup
    logger.info("Starting FazAI Gemma Worker API server")

    try:
        config = WorkerConfig.from_env()
        _worker = GemmaWorker(config)
        logger.info(
            "Worker initialized successfully",
            extra={"stats": _worker.get_stats()}
        )
    except Exception as e:
        logger.error(f"Failed to initialize worker: {e}")
        raise

    yield

    # Shutdown
    logger.info("Shutting down FazAI Gemma Worker API server")
    _worker = None


# Create FastAPI application
app = FastAPI(
    title="FazAI Gemma Worker",
    description="Local LLM inference API with WebSocket streaming",
    version="2.0.0",
    lifespan=lifespan
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure appropriately for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Add observability middleware (first to capture all requests)
app.add_middleware(ObservabilityMiddleware)

# Add security middleware (rate limiting and audit logging)
app.add_middleware(SecurityMiddleware)


@app.get("/health", response_model=HealthResponse, tags=["Health"])
async def health():
    """Liveness probe endpoint.

    Returns:
        Health status indicating service is running
    """
    return HealthResponse(status="healthy")


@app.get("/ready", response_model=ReadyResponse, tags=["Health"])
async def ready():
    """Readiness probe endpoint - checks if model is loaded.

    Returns:
        Readiness status with model information

    Raises:
        HTTPException: If worker is not initialized
    """
    try:
        worker = get_worker()
        stats = worker.get_stats()

        return ReadyResponse(
            status="ready",
            model_loaded=stats["model_loaded"],
            model_path=stats["model_path"]
        )
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))


@app.get("/metrics", tags=["Observability"])
async def metrics():
    """Prometheus metrics endpoint.

    Returns:
        Prometheus metrics in text format
    """
    return Response(
        content=generate_latest(),
        media_type="text/plain; version=0.0.4; charset=utf-8",
    )


@app.post("/v1/execute", response_model=ExecuteResponse, tags=["Inference"])
async def execute_command(request: ExecuteRequest):
    """Synchronous execution endpoint.

    Args:
        request: Execution request with prompt and parameters

    Returns:
        Execution response with generated text

    Raises:
        HTTPException: If inference fails or worker not initialized
    """
    session_id = request.session_id or str(uuid.uuid4())

    try:
        worker = get_worker()

        # Run inference in thread pool to avoid blocking
        import time
        start_time = time.time()

        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(
            None,
            lambda: worker.infer(
                prompt=request.input,
                max_tokens=request.max_tokens,
                temperature=request.temperature,
                top_p=request.top_p,
                top_k=request.top_k
            )
        )

        inference_time_ms = (time.time() - start_time) * 1000

        return ExecuteResponse(
            status="success",
            result=result,
            origin="local",
            session_id=session_id,
            inference_time_ms=round(inference_time_ms, 2)
        )

    except RuntimeError as e:
        logger.error(f"Worker not initialized: {e}")
        raise HTTPException(status_code=503, detail=str(e))
    except ValueError as e:
        logger.error(f"Inference failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        logger.error(f"Unexpected error: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


async def process_request(
    request: dict,
    session_id: str
) -> AsyncGenerator[dict, None]:
    """Process a request and generate streaming events.

    Args:
        request: Request dictionary with input and parameters
        session_id: Session identifier

    Yields:
        Dictionary events in ND-JSON format
    """
    # Send session event
    yield SessionEvent(session_id=session_id).model_dump()

    # Send reasoning event
    yield ReasoningEvent(content="Initializing inference...").model_dump()

    try:
        worker = get_worker()

        # Send reasoning event
        yield ReasoningEvent(content="Running Gemma model inference...").model_dump()

        # Run inference in thread pool
        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(
            None,
            lambda: worker.infer(
                prompt=request.get("input", ""),
                max_tokens=request.get("max_tokens"),
                temperature=request.get("temperature"),
                top_p=request.get("top_p"),
                top_k=request.get("top_k")
            )
        )

        # Send result event
        yield ResultEvent(
            status="success",
            content=result,
            origin="local"
        ).model_dump()

    except Exception as e:
        logger.error(f"Error processing request: {e}")
        yield ErrorEvent(
            error=str(e),
            code="INFERENCE_ERROR"
        ).model_dump()


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """WebSocket endpoint for ND-JSON streaming.

    Accepts WebSocket connections and processes requests with real-time
    streaming of inference progress and results.

    Args:
        websocket: WebSocket connection

    Protocol:
        Client sends: {"input": "...", "max_tokens": 1024, ...}
        Server streams: ND-JSON events (session, reasoning, result)
    """
    await websocket.accept()
    session_id = str(uuid.uuid4())

    logger.info(f"WebSocket connection established: {session_id}")

    try:
        while True:
            # Receive request
            data = await websocket.receive_text()

            try:
                request = json.loads(data)
            except json.JSONDecodeError as e:
                error_event = ErrorEvent(
                    error=f"Invalid JSON: {e}",
                    code="INVALID_JSON"
                )
                await websocket.send_text(json.dumps(error_event.model_dump()) + "\n")
                continue

            # Validate request has input
            if "input" not in request or not request["input"]:
                error_event = ErrorEvent(
                    error="Missing or empty 'input' field",
                    code="INVALID_REQUEST"
                )
                await websocket.send_text(json.dumps(error_event.model_dump()) + "\n")
                continue

            # Process and stream events
            async for event in process_request(request, session_id):
                await websocket.send_text(json.dumps(event) + "\n")

    except WebSocketDisconnect:
        logger.info(f"WebSocket disconnected: {session_id}")
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        try:
            error_event = ErrorEvent(
                error=str(e),
                code="WEBSOCKET_ERROR"
            )
            await websocket.send_text(json.dumps(error_event.model_dump()) + "\n")
        except:
            pass
    finally:
        logger.info(f"WebSocket cleanup: {session_id}")


@app.get("/", tags=["Info"])
async def root():
    """Root endpoint with API information."""
    return {
        "name": "FazAI Gemma Worker",
        "version": "2.0.0",
        "endpoints": {
            "health": "/health",
            "ready": "/ready",
            "execute": "/v1/execute",
            "websocket": "/ws",
            "docs": "/docs"
        }
    }
