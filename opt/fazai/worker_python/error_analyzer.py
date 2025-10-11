"""Error Analysis and Remediation for FazAI Worker.

Analyzes command execution errors, classifies error types, and generates
remediation strategies with optional fallback AI assistance.
"""

import logging
import re
from enum import Enum
from typing import Optional, Dict, Any, TYPE_CHECKING

from pydantic import BaseModel, Field

if TYPE_CHECKING:
    from .fallback import FallbackChain

logger = logging.getLogger(__name__)


class ErrorType(Enum):
    """Classification of command execution errors."""

    MISSING_TOOL = "missing_tool"
    PERMISSION_DENIED = "permission_denied"
    SYNTAX_ERROR = "syntax_error"
    NETWORK_ERROR = "network_error"
    TIMEOUT = "timeout"
    FILE_NOT_FOUND = "file_not_found"
    UNKNOWN = "unknown"


class RemediationStrategy(BaseModel):
    """Strategy for remediating a command error.

    Attributes:
        action: Remediation action type
        command: Command to execute for remediation
        description: Human-readable description
        requires_manual_review: Whether manual intervention is needed
        use_fallback_ai: Whether to use fallback AI for analysis
        confidence: Confidence in remediation (0.0-1.0)
    """

    action: str = Field(description="Remediation action type")
    command: str = Field(default="", description="Command to execute")
    description: str = Field(default="", description="Human-readable description")
    requires_manual_review: bool = Field(
        default=False, description="Manual review required"
    )
    use_fallback_ai: bool = Field(default=False, description="Use fallback AI")
    confidence: float = Field(default=1.0, ge=0.0, le=1.0, description="Confidence")


class ErrorAnalyzer:
    """Analyzes command errors and generates remediation strategies."""

    # Error pattern definitions with priority order
    ERROR_PATTERNS = {
        ErrorType.MISSING_TOOL: [
            r"command not found",
            r"not found",
            r"No such file or directory.*bin/",
            r"not installed",
            r"/usr/bin/env:.*No such file",
        ],
        ErrorType.PERMISSION_DENIED: [
            r"Permission denied",
            r"Access denied",
            r"Operation not permitted",
            r"You do not have permission",
            r"must be root",
            r"requires? root",
        ],
        ErrorType.SYNTAX_ERROR: [
            r"syntax error",
            r"invalid option",
            r"unexpected token",
            r"unexpected EOF",
            r"parse error",
            r"invalid syntax",
        ],
        ErrorType.NETWORK_ERROR: [
            r"Could not resolve host",
            r"Connection refused",
            r"Network is unreachable",
            r"Name or service not known",
            r"Temporary failure in name resolution",
            r"timeout.*connect",
        ],
        ErrorType.FILE_NOT_FOUND: [
            r"No such file or directory",
            r"cannot find.*file",
            r"does not exist",
            r"failed to open",
        ],
    }

    # Exit code mappings
    EXIT_CODE_MAP = {
        127: ErrorType.MISSING_TOOL,  # Command not found
        126: ErrorType.PERMISSION_DENIED,  # Command not executable
        124: ErrorType.TIMEOUT,  # Timeout command
        2: ErrorType.SYNTAX_ERROR,  # Bash syntax error
    }

    def __init__(self, fallback_chain: Optional["FallbackChain"] = None):
        """Initialize ErrorAnalyzer.

        Args:
            fallback_chain: Optional fallback chain for complex error analysis
        """
        self.fallback_chain = fallback_chain

    def classify(self, stderr: str, exit_code: int) -> ErrorType:
        """Classify error based on stderr output and exit code.

        Args:
            stderr: Standard error output from command
            exit_code: Command exit code

        Returns:
            ErrorType classification
        """
        # First check exit code for strong indicators
        if exit_code in self.EXIT_CODE_MAP:
            exit_error_type = self.EXIT_CODE_MAP[exit_code]
            logger.debug(
                f"Classified as {exit_error_type.value} from exit code {exit_code}"
            )
            return exit_error_type

        # Check stderr patterns in priority order
        # Note: MISSING_TOOL should be checked before FILE_NOT_FOUND
        # to handle cases like "nginx: No such file or directory"
        priority_order = [
            ErrorType.MISSING_TOOL,
            ErrorType.PERMISSION_DENIED,
            ErrorType.SYNTAX_ERROR,
            ErrorType.NETWORK_ERROR,
            ErrorType.FILE_NOT_FOUND,
        ]

        for error_type in priority_order:
            if self._matches_error_type(stderr, error_type):
                logger.debug(f"Classified as {error_type.value} from stderr pattern")
                return error_type

        # No match found
        logger.debug(
            f"No classification match for exit_code={exit_code}, stderr={stderr[:100]}"
        )
        return ErrorType.UNKNOWN

    def _matches_error_type(self, stderr: str, error_type: ErrorType) -> bool:
        """Check if stderr matches patterns for error type.

        Args:
            stderr: Standard error output
            error_type: Error type to check

        Returns:
            True if stderr matches error type patterns
        """
        if not stderr:
            return False

        patterns = self.ERROR_PATTERNS.get(error_type, [])
        for pattern in patterns:
            if re.search(pattern, stderr, re.IGNORECASE):
                return True

        return False

    def extract_missing_tool(self, stderr: str) -> Optional[str]:
        """Extract tool name from 'command not found' error.

        Args:
            stderr: Standard error output

        Returns:
            Tool name if found, None otherwise
        """
        # Pattern: "bash: nginx: command not found"
        match = re.search(r"bash:\s+([a-zA-Z0-9_-]+):\s+command not found", stderr)
        if match:
            return match.group(1)

        # Pattern: "/usr/bin/env: 'python3': No such file"
        match = re.search(r"/usr/bin/env:\s+'?([a-zA-Z0-9_-]+)'?:", stderr)
        if match:
            return match.group(1)

        # Pattern: "nginx: not found"
        match = re.search(r"^([a-zA-Z0-9_-]+):\s+not found", stderr)
        if match:
            return match.group(1)

        # Pattern: "nginx: No such file or directory"
        match = re.search(r"^([a-zA-Z0-9_-]+):\s+No such file", stderr)
        if match:
            return match.group(1)

        return None

    def extract_missing_file(self, stderr: str) -> Optional[str]:
        """Extract file path from file not found error.

        Args:
            stderr: Standard error output

        Returns:
            File path if found, None otherwise
        """
        # Pattern: "cat: /etc/missing.conf: No such file or directory"
        match = re.search(
            r":\s+([/a-zA-Z0-9_.-]+):\s+No such file or directory", stderr
        )
        if match:
            return match.group(1)

        # Pattern: "cannot find /etc/config.conf"
        match = re.search(r"cannot find\s+([/a-zA-Z0-9_.-]+)", stderr)
        if match:
            return match.group(1)

        return None

    def generate_remediation(
        self,
        error_type: ErrorType,
        context: Dict[str, Any],
    ) -> RemediationStrategy:
        """Generate remediation strategy for error type (synchronous).

        Args:
            error_type: Classified error type
            context: Error context (command, stderr, distro, etc.)

        Returns:
            RemediationStrategy for fixing the error
        """
        if error_type == ErrorType.MISSING_TOOL:
            return self._remediate_missing_tool(context)

        elif error_type == ErrorType.PERMISSION_DENIED:
            return self._remediate_permission_denied(context)

        elif error_type == ErrorType.SYNTAX_ERROR:
            return self._remediate_syntax_error(context)

        elif error_type == ErrorType.NETWORK_ERROR:
            return self._remediate_network_error(context)

        elif error_type == ErrorType.FILE_NOT_FOUND:
            return self._remediate_file_not_found(context)

        elif error_type == ErrorType.TIMEOUT:
            return self._remediate_timeout(context)

        else:  # UNKNOWN
            return self._remediate_unknown(context)

    async def generate_remediation_async(
        self,
        error_type: ErrorType,
        context: Dict[str, Any],
    ) -> RemediationStrategy:
        """Generate remediation strategy with async fallback AI support.

        Args:
            error_type: Classified error type
            context: Error context (command, stderr, distro, etc.)

        Returns:
            RemediationStrategy for fixing the error
        """
        # For UNKNOWN errors, try fallback AI if available
        if error_type == ErrorType.UNKNOWN and self.fallback_chain:
            try:
                return await self._remediate_unknown_with_ai(context)
            except Exception as e:
                logger.error(f"Fallback AI remediation failed: {e}")
                # Fall back to default
                return self._remediate_unknown(context)

        # For other error types, use synchronous remediation
        return self.generate_remediation(error_type, context)

    def _remediate_missing_tool(self, context: Dict[str, Any]) -> RemediationStrategy:
        """Generate remediation for missing tool."""
        tool = context.get("tool")
        distro = context.get("distro", "debian")

        if not tool:
            return RemediationStrategy(
                action="manual_install",
                description="Install missing tool manually",
                requires_manual_review=True,
            )

        # Generate install command based on distro
        from .planner import PACKAGE_MANAGERS

        pkg_mgr = PACKAGE_MANAGERS.get(distro, "apt-get")

        if pkg_mgr == "apt-get":
            install_cmd = f"apt-get install -y {tool}"
        elif pkg_mgr in ("yum", "dnf"):
            install_cmd = f"{pkg_mgr} install -y {tool}"
        elif pkg_mgr == "pacman":
            install_cmd = f"pacman -S --noconfirm {tool}"
        elif pkg_mgr == "zypper":
            install_cmd = f"zypper install -y {tool}"
        elif pkg_mgr == "apk":
            install_cmd = f"apk add {tool}"
        else:
            install_cmd = f"apt-get install -y {tool}"

        return RemediationStrategy(
            action="install_package",
            command=install_cmd,
            description=f"Install missing tool: {tool}",
            confidence=0.9,
        )

    def _remediate_permission_denied(
        self, context: Dict[str, Any]
    ) -> RemediationStrategy:
        """Generate remediation for permission denied."""
        command = context.get("command", "")

        return RemediationStrategy(
            action="add_sudo",
            command=f"sudo {command}",
            description="Retry command with sudo privileges",
            confidence=0.85,
        )

    def _remediate_syntax_error(self, context: Dict[str, Any]) -> RemediationStrategy:
        """Generate remediation for syntax error."""
        return RemediationStrategy(
            action="manual_review",
            description="Syntax error requires manual correction",
            requires_manual_review=True,
            use_fallback_ai=True,  # Can benefit from AI analysis
            confidence=0.3,
        )

    def _remediate_network_error(self, context: Dict[str, Any]) -> RemediationStrategy:
        """Generate remediation for network error."""
        return RemediationStrategy(
            action="check_network",
            command="ping -c 3 8.8.8.8 && cat /etc/resolv.conf",
            description="Verify network connectivity and DNS configuration",
            confidence=0.6,
        )

    def _remediate_file_not_found(self, context: Dict[str, Any]) -> RemediationStrategy:
        """Generate remediation for file not found."""
        file_path = context.get("file")

        if file_path:
            return RemediationStrategy(
                action="verify_path",
                command=f"ls -la {file_path} 2>/dev/null || echo 'File does not exist'",
                description=f"Verify file path: {file_path}",
                requires_manual_review=True,
                confidence=0.5,
            )

        return RemediationStrategy(
            action="create_file",
            description="Create missing file or verify path",
            requires_manual_review=True,
            confidence=0.4,
        )

    def _remediate_timeout(self, context: Dict[str, Any]) -> RemediationStrategy:
        """Generate remediation for timeout."""
        return RemediationStrategy(
            action="increase_timeout",
            description="Command timed out - consider increasing timeout or optimizing",
            requires_manual_review=True,
            confidence=0.7,
        )

    def _remediate_unknown(self, context: Dict[str, Any]) -> RemediationStrategy:
        """Generate remediation for unknown error."""
        return RemediationStrategy(
            action="fallback_analysis",
            description="Unknown error - requires AI analysis",
            requires_manual_review=True,
            use_fallback_ai=True,
            confidence=0.2,
        )

    async def _remediate_unknown_with_ai(
        self, context: Dict[str, Any]
    ) -> RemediationStrategy:
        """Generate remediation using fallback AI for unknown errors."""
        if not self.fallback_chain:
            return self._remediate_unknown(context)

        # Build prompt for AI
        command = context.get("command", "unknown")
        stderr = context.get("stderr", "")
        exit_code = context.get("exit_code", 0)

        prompt = f"""Analyze this command error and suggest a fix:

Command: {command}
Exit Code: {exit_code}
Error Output: {stderr}

Provide a specific remediation command or explain what needs to be fixed.
Be concise and actionable."""

        try:
            response = await self.fallback_chain.infer(prompt)

            if response.success:
                # Extract command from response if present
                suggested_command = self._extract_command_from_ai(response.content)

                return RemediationStrategy(
                    action="ai_suggested_fix",
                    command=suggested_command,
                    description=f"AI suggestion: {response.content[:200]}",
                    confidence=0.6,
                    use_fallback_ai=True,
                )

        except Exception as e:
            logger.error(f"AI remediation failed: {e}")

        # Fallback to default
        return self._remediate_unknown(context)

    def _extract_command_from_ai(self, ai_response: str) -> str:
        """Extract executable command from AI response.

        Args:
            ai_response: AI-generated text response

        Returns:
            Extracted command or original response
        """
        # Look for command in code blocks
        match = re.search(r"```(?:bash|sh)?\s*\n(.+?)\n```", ai_response, re.DOTALL)
        if match:
            return match.group(1).strip()

        # Look for lines starting with $
        match = re.search(r"\$\s*(.+)", ai_response)
        if match:
            return match.group(1).strip()

        # Return first line that looks like a command
        lines = ai_response.split("\n")
        for line in lines:
            line = line.strip()
            if line and not line.startswith("#") and " " in line:
                return line

        # Return full response if no command found
        return ai_response.strip()
