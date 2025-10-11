"""Self-Healing Execution Engine for FazAI Worker.

Executes commands with automatic error detection, remediation, and learning.
Pattern: Error → Analyze → Remediate → Retry → Learn
"""

import asyncio
import logging
import time
from datetime import datetime, timezone
from typing import Optional, Dict, Any, TYPE_CHECKING

from pydantic import BaseModel, Field

from .error_analyzer import ErrorAnalyzer, ErrorType, RemediationStrategy
from .tool_detector import ToolDetector
from .planner import CommandPlanner

if TYPE_CHECKING:
    from .memory import MemoryManager
    from .fallback import FallbackChain

logger = logging.getLogger(__name__)


class ExecutionError(Exception):
    """Exception raised for execution errors."""

    pass


class ExecutionResult(BaseModel):
    """Result of command execution.

    Attributes:
        command: Executed command
        exit_code: Command exit code
        stdout: Standard output
        stderr: Standard error
        duration: Execution time in seconds
        timestamp: ISO 8601 timestamp
        success: Whether execution succeeded
        retries: Number of retry attempts
        remediations_applied: List of remediation actions applied
    """

    command: str = Field(description="Executed command")
    exit_code: int = Field(description="Exit code")
    stdout: str = Field(default="", description="Standard output")
    stderr: str = Field(default="", description="Standard error")
    duration: float = Field(description="Duration in seconds")
    timestamp: str = Field(description="ISO 8601 timestamp")
    success: bool = Field(description="Success status")
    retries: int = Field(default=0, description="Retry attempts")
    remediations_applied: list[str] = Field(
        default_factory=list, description="Remediation actions"
    )

    @property
    def failed(self) -> bool:
        """Check if execution failed."""
        return not self.success


class SelfHealingExecutor:
    """Self-healing command executor with automatic error remediation."""

    def __init__(
        self,
        error_analyzer: Optional[ErrorAnalyzer] = None,
        tool_detector: Optional[ToolDetector] = None,
        memory_manager: Optional["MemoryManager"] = None,
        fallback_chain: Optional["FallbackChain"] = None,
        max_retries: int = 3,
        initial_retry_delay: float = 1.0,
        default_timeout: float = 30.0,
        use_memory_search: bool = True,
    ):
        """Initialize SelfHealingExecutor.

        Args:
            error_analyzer: Error analyzer instance
            tool_detector: Tool detector instance
            memory_manager: Memory manager for learning
            fallback_chain: Fallback chain for AI assistance
            max_retries: Maximum retry attempts
            initial_retry_delay: Initial delay between retries (exponential backoff)
            default_timeout: Default command timeout in seconds
            use_memory_search: Whether to search memory for solutions
        """
        self.error_analyzer = error_analyzer or ErrorAnalyzer(
            fallback_chain=fallback_chain
        )
        self.tool_detector = tool_detector or ToolDetector()
        self.memory_manager = memory_manager
        self.fallback_chain = fallback_chain
        self.max_retries = max_retries
        self.initial_retry_delay = initial_retry_delay
        self.default_timeout = default_timeout
        self.use_memory_search = use_memory_search

        # Initialize command planner for safety checks
        self.planner = CommandPlanner()

        logger.info(
            f"SelfHealingExecutor initialized (max_retries={max_retries}, "
            f"timeout={default_timeout}s)"
        )

    def _validate_command_safety(self, command: str) -> None:
        """Validate command is safe to execute.

        Args:
            command: Command to validate

        Raises:
            ExecutionError: If command is dangerous
        """
        if not self.planner.is_command_safe(command):
            raise ExecutionError(f"Refusing to execute dangerous command: {command}")

    async def execute(
        self,
        command: str,
        timeout: Optional[float] = None,
    ) -> ExecutionResult:
        """Execute command without self-healing (basic execution).

        Args:
            command: Command to execute
            timeout: Execution timeout (uses default if None)

        Returns:
            ExecutionResult with output and status

        Raises:
            ExecutionError: If command is dangerous
        """
        # Validate safety
        self._validate_command_safety(command)

        # Execute
        return await self._execute_command(command, timeout)

    async def _execute_command(
        self,
        command: str,
        timeout: Optional[float] = None,
    ) -> ExecutionResult:
        """Execute command and capture output.

        Args:
            command: Command to execute
            timeout: Execution timeout in seconds

        Returns:
            ExecutionResult with execution details
        """
        timeout = timeout or self.default_timeout
        start_time = time.time()
        timestamp = datetime.now(timezone.utc).isoformat()

        try:
            # Create subprocess
            process = await asyncio.create_subprocess_shell(
                command,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )

            # Wait with timeout
            try:
                stdout, stderr = await asyncio.wait_for(
                    process.communicate(),
                    timeout=timeout,
                )
                exit_code = process.returncode

            except asyncio.TimeoutError:
                # Kill process on timeout
                try:
                    process.kill()
                    await process.wait()
                except Exception:
                    pass

                duration = time.time() - start_time
                return ExecutionResult(
                    command=command,
                    exit_code=124,  # timeout exit code
                    stdout="",
                    stderr=f"Command timed out after {timeout}s",
                    duration=duration,
                    timestamp=timestamp,
                    success=False,
                )

            # Decode output
            stdout_str = stdout.decode("utf-8", errors="replace") if stdout else ""
            stderr_str = stderr.decode("utf-8", errors="replace") if stderr else ""

            duration = time.time() - start_time
            success = exit_code == 0

            return ExecutionResult(
                command=command,
                exit_code=exit_code,
                stdout=stdout_str,
                stderr=stderr_str,
                duration=duration,
                timestamp=timestamp,
                success=success,
            )

        except Exception as e:
            duration = time.time() - start_time
            logger.error(f"Exception during command execution: {e}")

            return ExecutionResult(
                command=command,
                exit_code=1,
                stdout="",
                stderr=f"Exception: {str(e)}",
                duration=duration,
                timestamp=timestamp,
                success=False,
            )

    async def execute_with_healing(
        self,
        command: str,
        timeout: Optional[float] = None,
    ) -> ExecutionResult:
        """Execute command with self-healing pattern.

        Pattern: Error → Analyze → Remediate → Retry → Learn

        Args:
            command: Command to execute
            timeout: Execution timeout

        Returns:
            ExecutionResult with final status

        Raises:
            ExecutionError: If command is dangerous
        """
        # Validate safety
        self._validate_command_safety(command)

        # Search memory for similar problems (if enabled)
        if self.use_memory_search and self.memory_manager:
            await self._search_memory_for_solution(command)

        # Execute with healing loop
        current_command = command
        remediations_applied = []

        for attempt in range(self.max_retries + 1):
            # Execute command
            result = await self._execute_command(current_command, timeout)

            if result.success:
                # Success! Store in memory and return
                result.retries = attempt
                result.remediations_applied = remediations_applied

                if self.memory_manager:
                    await self._store_success(result)

                return result

            # Failure - analyze error
            logger.info(
                f"Command failed (attempt {attempt + 1}/{self.max_retries + 1}): "
                f"{current_command}"
            )

            if attempt >= self.max_retries:
                # Max retries exceeded
                logger.warning(f"Max retries exceeded for command: {command}")
                result.retries = attempt
                result.remediations_applied = remediations_applied

                if self.memory_manager:
                    await self._store_failure(result)

                return result

            # Classify error
            error_type = self.error_analyzer.classify(result.stderr, result.exit_code)
            logger.debug(f"Error classified as: {error_type.value}")

            # Generate remediation
            remediation = await self._generate_remediation(
                error_type,
                {
                    "command": current_command,
                    "stderr": result.stderr,
                    "exit_code": result.exit_code,
                    "distro": self.tool_detector.distro,
                },
            )

            # Apply remediation
            remediation_applied = await self._apply_remediation(
                error_type,
                remediation,
                result,
            )

            if remediation_applied:
                # Track remediation action (store the string, not the object)
                if isinstance(remediation.action, str):
                    remediations_applied.append(remediation.action)
                else:
                    remediations_applied.append(str(remediation.action))

                # Update command for next attempt
                if remediation.command:
                    current_command = remediation.command
            elif not remediation.use_fallback_ai:
                # Cannot remediate and no fallback - give up early
                logger.warning(f"Cannot remediate error type: {error_type.value}")
                result.retries = attempt
                result.remediations_applied = remediations_applied

                if self.memory_manager:
                    await self._store_failure(result)

                return result
            # If use_fallback_ai is True, continue retrying

            # Apply exponential backoff
            if attempt < self.max_retries:
                delay = self.initial_retry_delay * (2**attempt)
                logger.debug(f"Retrying after {delay}s delay...")
                await asyncio.sleep(delay)

        # Should not reach here
        result.retries = self.max_retries
        result.remediations_applied = remediations_applied
        return result

    async def _generate_remediation(
        self,
        error_type: ErrorType,
        context: Dict[str, Any],
    ) -> RemediationStrategy:
        """Generate remediation strategy for error.

        Args:
            error_type: Classified error type
            context: Error context

        Returns:
            RemediationStrategy
        """
        # Use async remediation for better fallback AI support
        if hasattr(self.error_analyzer, "generate_remediation_async"):
            return await self.error_analyzer.generate_remediation_async(
                error_type, context
            )
        else:
            return self.error_analyzer.generate_remediation(error_type, context)

    async def _apply_remediation(
        self,
        error_type: ErrorType,
        remediation: RemediationStrategy,
        result: ExecutionResult,
    ) -> bool:
        """Apply remediation strategy.

        Args:
            error_type: Error type
            remediation: Remediation strategy
            result: Failed execution result

        Returns:
            True if remediation applied, False if cannot remediate
        """
        if error_type == ErrorType.MISSING_TOOL:
            return await self._remediate_missing_tool(result)

        elif error_type == ErrorType.PERMISSION_DENIED:
            # Remediation is handled by command modification
            return True

        elif error_type == ErrorType.SYNTAX_ERROR:
            # Syntax errors need fallback AI or manual review
            if remediation.use_fallback_ai and self.fallback_chain:
                return True  # Command updated by remediation
            return False

        elif error_type == ErrorType.NETWORK_ERROR:
            # Network errors may need manual intervention
            logger.warning("Network error detected - may require manual intervention")
            return False

        elif error_type == ErrorType.FILE_NOT_FOUND:
            # File not found needs manual intervention usually
            return False

        elif error_type == ErrorType.TIMEOUT:
            # Could increase timeout, but this is risky
            return False

        else:  # UNKNOWN
            if remediation.use_fallback_ai and self.fallback_chain:
                return True
            return False

    async def _remediate_missing_tool(self, result: ExecutionResult) -> bool:
        """Remediate missing tool error by installing.

        Args:
            result: Failed execution result

        Returns:
            True if tool installed, False otherwise
        """
        # Extract tool name
        tool = self.error_analyzer.extract_missing_tool(result.stderr)

        if not tool:
            logger.warning("Could not extract tool name from error")
            return False

        # Check if safe to install
        if not self.tool_detector.is_safe_to_install(tool):
            logger.warning(f"Tool '{tool}' not in safe list - skipping auto-install")
            return False

        # Install tool
        logger.info(f"Auto-installing missing tool: {tool}")
        try:
            install_result = await self.tool_detector.install(tool)

            if install_result.success:
                logger.info(f"Successfully installed {tool}")
                return True
            else:
                logger.error(f"Failed to install {tool}: {install_result.stderr}")
                return False

        except Exception as e:
            logger.error(f"Exception installing {tool}: {e}")
            return False

    async def _search_memory_for_solution(self, command: str) -> None:
        """Search memory for similar problems and solutions.

        Args:
            command: Command being executed
        """
        if not self.memory_manager:
            return

        try:
            results = await asyncio.to_thread(
                self.memory_manager.search_knowledge,
                query=f"Execute: {command}",
                limit=3,
                distro=self.tool_detector.distro,
                min_score=0.7,
            )

            if results:
                logger.info(
                    f"Found {len(results)} similar solutions in memory (top score: {results[0]['score']:.2f})"
                )
                # Could use these solutions to inform remediation
                # For now, just logging

        except Exception as e:
            logger.debug(f"Error searching memory: {e}")

    async def _store_success(self, result: ExecutionResult) -> None:
        """Store successful execution in memory.

        Args:
            result: Successful execution result
        """
        if not self.memory_manager:
            return

        try:
            # Store command as solution (what to execute)
            # Include output as context if helpful
            solution = result.command
            if result.remediations_applied:
                solution += f" (after: {', '.join(result.remediations_applied)})"

            point_id = await asyncio.to_thread(
                self.memory_manager.commit_knowledge,
                problem=f"Execute: {result.command}",
                solution=solution,
                distro=self.tool_detector.distro,
                success_rate=1.0,
            )

            if point_id:
                logger.debug(f"Stored success in memory: {point_id}")

        except Exception as e:
            logger.debug(f"Error storing success in memory: {e}")

    async def _store_failure(self, result: ExecutionResult) -> None:
        """Store failure pattern in memory.

        Args:
            result: Failed execution result
        """
        if not self.memory_manager:
            return

        try:
            point_id = await asyncio.to_thread(
                self.memory_manager.commit_knowledge,
                problem=f"Failed: {result.command}",
                solution=f"Error: {result.stderr}",
                distro=self.tool_detector.distro,
                success_rate=0.0,
            )

            if point_id:
                logger.debug(f"Stored failure in memory: {point_id}")

        except Exception as e:
            logger.debug(f"Error storing failure in memory: {e}")
