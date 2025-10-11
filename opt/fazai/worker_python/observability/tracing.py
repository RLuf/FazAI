"""Request tracing and correlation ID management.

Provides correlation ID generation and context management for distributed tracing.
"""

import uuid
from contextvars import ContextVar
from typing import Optional

# Context variable for correlation ID
correlation_id_ctx: ContextVar[Optional[str]] = ContextVar(
    "correlation_id", default=None
)


class RequestTracer:
    """Request correlation and tracing utilities."""

    @staticmethod
    def generate_correlation_id() -> str:
        """Generate unique correlation ID.

        Returns:
            UUID4-based correlation ID
        """
        return str(uuid.uuid4())

    @staticmethod
    def get_correlation_id() -> Optional[str]:
        """Get current correlation ID from context.

        Returns:
            Correlation ID if set, None otherwise
        """
        return correlation_id_ctx.get()

    @staticmethod
    def set_correlation_id(correlation_id: str) -> None:
        """Set correlation ID for current context.

        Args:
            correlation_id: Correlation ID to set
        """
        correlation_id_ctx.set(correlation_id)

    @staticmethod
    def clear_correlation_id() -> None:
        """Clear correlation ID from current context."""
        correlation_id_ctx.set(None)
