"""Structured logging for production observability.

Provides JSON-formatted logging with correlation IDs and structured context.
"""

import json
import logging
from datetime import datetime, timezone
from typing import Any, Dict

from .tracing import RequestTracer


class JSONFormatter(logging.Formatter):
    """JSON formatter for structured logging."""

    def format(self, record: logging.LogRecord) -> str:
        """Format log record as JSON.

        Args:
            record: Log record to format

        Returns:
            JSON-formatted log string
        """
        log_data: Dict[str, Any] = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }

        # Add correlation ID if available
        correlation_id = RequestTracer.get_correlation_id()
        if correlation_id:
            log_data["correlation_id"] = correlation_id

        # Add extra fields from record
        if hasattr(record, "__dict__"):
            for key, value in record.__dict__.items():
                if key not in [
                    "name",
                    "msg",
                    "args",
                    "created",
                    "filename",
                    "funcName",
                    "levelname",
                    "levelno",
                    "lineno",
                    "module",
                    "msecs",
                    "message",
                    "pathname",
                    "process",
                    "processName",
                    "relativeCreated",
                    "thread",
                    "threadName",
                    "exc_info",
                    "exc_text",
                    "stack_info",
                ]:
                    log_data[key] = value

        # Add exception info if present
        if record.exc_info:
            log_data["exception"] = self.formatException(record.exc_info)

        return json.dumps(log_data)


class StructuredLogger:
    """Structured logger with JSON output and correlation ID support."""

    def __init__(self, name: str, level: str = "INFO"):
        """Initialize structured logger.

        Args:
            name: Logger name
            level: Log level (DEBUG, INFO, WARNING, ERROR, CRITICAL)
        """
        self.logger = logging.getLogger(name)
        self.logger.setLevel(getattr(logging, level.upper()))
        self.logger.propagate = False  # Don't propagate to root logger

        # Remove existing handlers
        self.logger.handlers.clear()

        # Add JSON formatter handler
        handler = logging.StreamHandler()
        handler.setFormatter(JSONFormatter())
        self.logger.addHandler(handler)

    def _log(self, level: str, message: str, **context: Any) -> None:
        """Internal log method with context.

        Args:
            level: Log level
            message: Log message
            **context: Additional context fields
        """
        # Create log record with extra context
        extra_dict = {k: v for k, v in context.items()}

        getattr(self.logger, level.lower())(message, extra=extra_dict)

    def debug(self, message: str, **context: Any) -> None:
        """Log debug message.

        Args:
            message: Log message
            **context: Additional context fields
        """
        self._log("DEBUG", message, **context)

    def info(self, message: str, **context: Any) -> None:
        """Log info message.

        Args:
            message: Log message
            **context: Additional context fields
        """
        self._log("INFO", message, **context)

    def warning(self, message: str, **context: Any) -> None:
        """Log warning message.

        Args:
            message: Log message
            **context: Additional context fields
        """
        self._log("WARNING", message, **context)

    def error(self, message: str, **context: Any) -> None:
        """Log error message.

        Args:
            message: Log message
            **context: Additional context fields
        """
        self._log("ERROR", message, **context)

    def critical(self, message: str, **context: Any) -> None:
        """Log critical message.

        Args:
            message: Log message
            **context: Additional context fields
        """
        self._log("CRITICAL", message, **context)
