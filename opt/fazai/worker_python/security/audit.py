"""Security audit logging with tamper detection.

Provides audit event logging with chain integrity verification.
"""

import hashlib
import json
from datetime import datetime, timezone
from enum import Enum
from pathlib import Path
from typing import Any, Dict, Optional


class SecurityAuditError(Exception):
    """Exception raised for security audit errors."""

    pass


class AuditEventType(Enum):
    """Security audit event types."""

    AUTH_SUCCESS = "auth_success"
    AUTH_FAILURE = "auth_failure"
    DANGEROUS_COMMAND = "dangerous_command"
    PERMISSION_ESCALATION = "permission_escalation"
    CONFIG_CHANGE = "config_change"
    DATA_ACCESS = "data_access"


class AuditLogger:
    """Security audit logger with tamper-evident chain integrity."""

    def __init__(self, log_file: str = "/var/log/fazai/audit.log"):
        """Initialize audit logger.

        Args:
            log_file: Path to audit log file
        """
        self.log_file = log_file
        self.last_hash: Optional[str] = None

        # Ensure log directory exists
        log_path = Path(log_file)
        log_path.parent.mkdir(parents=True, exist_ok=True)

        # Load last hash if file exists
        if log_path.exists():
            self._load_last_hash()

    def _load_last_hash(self) -> None:
        """Load the last hash from existing audit log."""
        try:
            with open(self.log_file, "r") as f:
                lines = f.readlines()
                if lines:
                    last_event = json.loads(lines[-1].strip())
                    self.last_hash = last_event.get("hash")
        except (FileNotFoundError, json.JSONDecodeError, IndexError):
            # If can't load, start fresh
            self.last_hash = None

    def log_event(
        self,
        event_type: AuditEventType,
        user: str,
        action: str,
        resource: Optional[str] = None,
        outcome: str = "success",
        **metadata: Any,
    ) -> Dict[str, Any]:
        """Log security audit event with chain integrity.

        Args:
            event_type: Type of security event
            user: User performing action
            action: Action being performed
            resource: Resource being accessed (optional)
            outcome: Outcome of action (success/failure/blocked)
            **metadata: Additional metadata fields

        Returns:
            Logged event dictionary with hash
        """
        # Build event
        event: Dict[str, Any] = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "event_type": event_type.value,
            "user": user,
            "action": action,
            "resource": resource,
            "outcome": outcome,
            "metadata": metadata,
            "previous_hash": self.last_hash,
        }

        # Calculate event hash
        event_str = json.dumps(event, sort_keys=True)
        current_hash = hashlib.sha256(event_str.encode()).hexdigest()
        event["hash"] = current_hash

        # Write to audit log
        try:
            with open(self.log_file, "a") as f:
                f.write(json.dumps(event) + "\n")
                f.flush()  # Ensure written immediately
        except IOError as e:
            raise SecurityAuditError(f"Failed to write audit log: {e}")

        # Update last hash
        self.last_hash = current_hash

        return event

    def verify_integrity(self) -> bool:
        """Verify audit log chain integrity.

        Returns:
            True if chain is intact, False if tampering detected

        Raises:
            SecurityAuditError: If log file cannot be read
        """
        try:
            with open(self.log_file, "r") as f:
                lines = f.readlines()

            if not lines:
                return True  # Empty log is valid

            previous_hash = None

            for line_num, line in enumerate(lines, 1):
                try:
                    event = json.loads(line.strip())
                except json.JSONDecodeError:
                    raise SecurityAuditError(f"Invalid JSON at line {line_num}")

                # Check previous hash matches
                if event.get("previous_hash") != previous_hash:
                    return False

                # Verify event hash
                event_copy = event.copy()
                stored_hash = event_copy.pop("hash", None)

                if not stored_hash:
                    return False

                calculated_hash = hashlib.sha256(
                    json.dumps(event_copy, sort_keys=True).encode()
                ).hexdigest()

                if calculated_hash != stored_hash:
                    return False

                previous_hash = stored_hash

            return True

        except FileNotFoundError:
            raise SecurityAuditError(f"Audit log not found: {self.log_file}")
        except Exception as e:
            raise SecurityAuditError(f"Error verifying integrity: {e}")

    def get_events(
        self,
        event_type: Optional[AuditEventType] = None,
        user: Optional[str] = None,
        limit: Optional[int] = None,
    ) -> list[Dict[str, Any]]:
        """Retrieve audit events with optional filtering.

        Args:
            event_type: Filter by event type
            user: Filter by user
            limit: Maximum number of events to return

        Returns:
            List of audit events (most recent first)
        """
        try:
            with open(self.log_file, "r") as f:
                lines = f.readlines()

            events = []

            for line in reversed(lines):  # Most recent first
                try:
                    event = json.loads(line.strip())

                    # Apply filters
                    if event_type and event.get("event_type") != event_type.value:
                        continue

                    if user and event.get("user") != user:
                        continue

                    events.append(event)

                    # Check limit
                    if limit and len(events) >= limit:
                        break

                except json.JSONDecodeError:
                    continue

            return events

        except FileNotFoundError:
            return []

    def get_stats(self) -> Dict[str, Any]:
        """Get audit log statistics.

        Returns:
            Dictionary with event counts and statistics
        """
        try:
            with open(self.log_file, "r") as f:
                lines = f.readlines()

            total_events = len(lines)

            # Count by type
            event_counts: Dict[str, int] = {}
            user_counts: Dict[str, int] = {}

            for line in lines:
                try:
                    event = json.loads(line.strip())
                    event_type = event.get("event_type", "unknown")
                    user = event.get("user", "unknown")

                    event_counts[event_type] = event_counts.get(event_type, 0) + 1
                    user_counts[user] = user_counts.get(user, 0) + 1

                except json.JSONDecodeError:
                    continue

            return {
                "total_events": total_events,
                "events_by_type": event_counts,
                "events_by_user": user_counts,
                "integrity_verified": self.verify_integrity(),
            }

        except FileNotFoundError:
            return {
                "total_events": 0,
                "events_by_type": {},
                "events_by_user": {},
                "integrity_verified": True,
            }
