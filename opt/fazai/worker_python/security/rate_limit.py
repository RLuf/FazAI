"""Rate limiting for API security.

Provides per-IP and global rate limiting with configurable limits.
"""

import time
from collections import defaultdict
from typing import Dict, List

from fastapi import HTTPException, Request


class RateLimitExceeded(Exception):
    """Exception raised when rate limit is exceeded."""

    pass


class RateLimiter:
    """Rate limiter middleware for request throttling."""

    def __init__(
        self,
        requests_per_minute: int = 60,
        requests_per_hour: int = 1000,
    ):
        """Initialize rate limiter.

        Args:
            requests_per_minute: Maximum requests per minute per IP
            requests_per_hour: Maximum requests per hour per IP
        """
        self.rpm = requests_per_minute
        self.rph = requests_per_hour
        self.requests: Dict[str, List[float]] = defaultdict(list)

    async def check_rate_limit(self, request: Request) -> bool:
        """Check if request is within rate limits.

        Args:
            request: FastAPI request object

        Returns:
            True if request is allowed

        Raises:
            HTTPException: If rate limit exceeded (429 status)
        """
        client_ip = request.client.host
        now = time.time()

        # Clean old requests (older than 1 hour)
        self.requests[client_ip] = [
            req_time for req_time in self.requests[client_ip] if now - req_time < 3600
        ]

        # Count requests in last minute
        minute_requests = [
            req_time for req_time in self.requests[client_ip] if now - req_time < 60
        ]
        minute_count = len(minute_requests)

        # Count requests in last hour
        hour_count = len(self.requests[client_ip])

        # Check minute limit
        if minute_count >= self.rpm:
            remaining = 0
            reset_time = int(now + 60)

            raise HTTPException(
                status_code=429,
                detail=f"Rate limit exceeded (requests per minute): {self.rpm}",
                headers={
                    "X-RateLimit-Limit": str(self.rpm),
                    "X-RateLimit-Remaining": str(remaining),
                    "X-RateLimit-Reset": str(reset_time),
                },
            )

        # Check hour limit
        if hour_count >= self.rph:
            raise HTTPException(
                status_code=429,
                detail=f"Rate limit exceeded (requests per hour): {self.rph}",
            )

        # Record this request
        self.requests[client_ip].append(now)

        return True

    def get_remaining_requests(self, client_ip: str) -> Dict[str, int]:
        """Get remaining requests for a client IP.

        Args:
            client_ip: Client IP address

        Returns:
            Dictionary with remaining minute and hour requests
        """
        now = time.time()

        # Count recent requests
        minute_count = sum(
            1 for req_time in self.requests.get(client_ip, []) if now - req_time < 60
        )
        hour_count = len(self.requests.get(client_ip, []))

        return {
            "minute_remaining": max(0, self.rpm - minute_count),
            "hour_remaining": max(0, self.rph - hour_count),
        }

    def reset_client(self, client_ip: str) -> None:
        """Reset rate limit for a client IP.

        Args:
            client_ip: Client IP address
        """
        if client_ip in self.requests:
            del self.requests[client_ip]

    def get_stats(self) -> Dict[str, int]:
        """Get rate limiter statistics.

        Returns:
            Dictionary with active clients and total requests tracked
        """
        now = time.time()
        active_clients = sum(
            1
            for requests in self.requests.values()
            if any(now - req_time < 60 for req_time in requests)
        )

        total_requests = sum(len(requests) for requests in self.requests.values())

        return {
            "active_clients": active_clients,
            "total_requests_tracked": total_requests,
        }
