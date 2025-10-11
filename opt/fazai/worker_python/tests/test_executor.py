"""Tests for executor module - Self-healing command execution.

Following TDD approach: RED (write failing tests) → GREEN (implement) → REFACTOR
"""

import pytest
import asyncio
from unittest.mock import AsyncMock, Mock, patch
from worker_python.executor import (
    SelfHealingExecutor,
    ExecutionResult,
    ExecutionError,
)
from worker_python.error_analyzer import ErrorType


class TestBasicExecution:
    """Test basic command execution."""

    @pytest.mark.asyncio
    async def test_execute_simple_command_success(self):
        """Should execute simple command successfully."""
        executor = SelfHealingExecutor()

        result = await executor.execute("echo 'test'")

        assert result.success is True
        assert result.exit_code == 0
        assert "test" in result.stdout

    @pytest.mark.asyncio
    async def test_execute_command_failure(self):
        """Should capture failure and error details."""
        executor = SelfHealingExecutor()

        result = await executor.execute("nonexistent-command")

        assert result.success is False
        assert result.exit_code != 0
        assert len(result.stderr) > 0

    @pytest.mark.asyncio
    async def test_execution_result_contains_metadata(self):
        """Should include command, timestamps, and duration."""
        executor = SelfHealingExecutor()

        result = await executor.execute("echo 'test'")

        assert result.command == "echo 'test'"
        assert result.duration >= 0
        assert len(result.timestamp) > 0
        assert result.retries == 0

    @pytest.mark.asyncio
    async def test_execute_with_timeout(self):
        """Should timeout long-running commands."""
        executor = SelfHealingExecutor(default_timeout=0.1)

        result = await executor.execute("sleep 10")

        assert result.success is False
        assert "timeout" in result.stderr.lower() or result.exit_code == 124


class TestSelfHealingPattern:
    """Test self-healing execution pattern."""

    @pytest.mark.asyncio
    async def test_healing_missing_tool_auto_install(self):
        """Should detect missing tool and auto-install."""
        from worker_python.tool_detector import ToolDetector
        from worker_python.error_analyzer import ErrorAnalyzer

        # Mock components
        mock_detector = Mock(spec=ToolDetector)
        mock_detector.distro = "debian"  # Add distro attribute
        mock_detector.is_safe_to_install = Mock(return_value=True)
        mock_detector.install = AsyncMock(
            return_value=Mock(success=True, tool="testtool")
        )

        mock_analyzer = Mock(spec=ErrorAnalyzer)
        mock_analyzer.classify = Mock(return_value=ErrorType.MISSING_TOOL)
        mock_analyzer.extract_missing_tool = Mock(return_value="testtool")
        mock_analyzer.generate_remediation_async = AsyncMock(
            return_value=Mock(
                action="install_package",
                command="testtool",
                use_fallback_ai=False,
            )
        )

        executor = SelfHealingExecutor(
            tool_detector=mock_detector,
            error_analyzer=mock_analyzer,
            max_retries=2,
        )

        # First call fails, retry after install succeeds
        with patch.object(executor, "_execute_command") as mock_exec:
            # First call: command not found
            # Second call: success after install
            mock_exec.side_effect = [
                ExecutionResult(
                    command="testtool",
                    exit_code=127,
                    stdout="",
                    stderr="testtool: command not found",
                    duration=0.01,
                    timestamp="2025-01-01T00:00:00Z",
                    success=False,
                ),
                ExecutionResult(
                    command="testtool",
                    exit_code=0,
                    stdout="Success",
                    stderr="",
                    duration=0.01,
                    timestamp="2025-01-01T00:00:00Z",
                    success=True,
                ),
            ]

            result = await executor.execute_with_healing("testtool")

            assert result.success is True
            assert result.retries > 0
            # Check that install_package remediation was applied
            assert any("install" in r.lower() for r in result.remediations_applied)

    @pytest.mark.asyncio
    async def test_healing_permission_denied_add_sudo(self):
        """Should detect permission error and retry with sudo."""
        from worker_python.error_analyzer import ErrorAnalyzer
        from worker_python.tool_detector import ToolDetector

        mock_detector = Mock(spec=ToolDetector)
        mock_detector.distro = "debian"

        mock_analyzer = Mock(spec=ErrorAnalyzer)
        mock_analyzer.classify = Mock(return_value=ErrorType.PERMISSION_DENIED)
        mock_analyzer.generate_remediation_async = AsyncMock(
            return_value=Mock(
                action="add_sudo",
                command="sudo systemctl restart nginx",
                confidence=0.85,
                use_fallback_ai=False,
            )
        )

        executor = SelfHealingExecutor(
            error_analyzer=mock_analyzer,
            tool_detector=mock_detector,
            max_retries=2,
        )

        with patch.object(executor, "_execute_command") as mock_exec:
            # First: permission denied
            # Second: success with sudo
            mock_exec.side_effect = [
                ExecutionResult(
                    command="systemctl restart nginx",
                    exit_code=1,
                    stdout="",
                    stderr="Permission denied",
                    duration=0.01,
                    timestamp="2025-01-01T00:00:00Z",
                    success=False,
                ),
                ExecutionResult(
                    command="sudo systemctl restart nginx",
                    exit_code=0,
                    stdout="Success",
                    stderr="",
                    duration=0.01,
                    timestamp="2025-01-01T00:00:00Z",
                    success=True,
                ),
            ]

            result = await executor.execute_with_healing("systemctl restart nginx")

            assert result.success is True
            assert "add_sudo" in result.remediations_applied

    @pytest.mark.asyncio
    async def test_healing_max_retries_exceeded(self):
        """Should stop after max retries and return failure."""
        from worker_python.tool_detector import ToolDetector
        from worker_python.error_analyzer import ErrorAnalyzer

        mock_detector = Mock(spec=ToolDetector)
        mock_detector.distro = "debian"

        mock_analyzer = Mock(spec=ErrorAnalyzer)
        mock_analyzer.classify = Mock(return_value=ErrorType.UNKNOWN)
        mock_analyzer.generate_remediation_async = AsyncMock(
            return_value=Mock(
                action="fallback_analysis",
                command="",
                use_fallback_ai=False,  # No fallback - will give up
                requires_manual_review=True,
            )
        )

        executor = SelfHealingExecutor(
            error_analyzer=mock_analyzer,
            tool_detector=mock_detector,
            max_retries=2,
        )

        with patch.object(executor, "_execute_command") as mock_exec:
            # Always fails
            mock_exec.return_value = ExecutionResult(
                command="fail-command",
                exit_code=1,
                stdout="",
                stderr="Unknown error",
                duration=0.01,
                timestamp="2025-01-01T00:00:00Z",
                success=False,
            )

            result = await executor.execute_with_healing("fail-command")

            assert result.success is False
            # Should stop early because cannot remediate
            assert result.retries == 0


class TestRetryLogic:
    """Test retry logic and backoff."""

    @pytest.mark.asyncio
    async def test_exponential_backoff(self):
        """Should apply exponential backoff between retries."""
        from worker_python.tool_detector import ToolDetector
        from worker_python.error_analyzer import ErrorAnalyzer

        mock_detector = Mock(spec=ToolDetector)
        mock_detector.distro = "debian"

        mock_analyzer = Mock(spec=ErrorAnalyzer)
        mock_analyzer.classify = Mock(return_value=ErrorType.UNKNOWN)
        mock_analyzer.generate_remediation_async = AsyncMock(
            return_value=Mock(
                action="fallback_analysis",
                command="test",  # Keep trying same command
                use_fallback_ai=True,  # Will retry with fallback
            )
        )

        executor = SelfHealingExecutor(
            error_analyzer=mock_analyzer,
            tool_detector=mock_detector,
            max_retries=3,
            initial_retry_delay=0.01,
        )

        with patch.object(executor, "_execute_command") as mock_exec:
            mock_exec.return_value = ExecutionResult(
                command="test",
                exit_code=1,
                stdout="",
                stderr="Error",
                duration=0.01,
                timestamp="2025-01-01T00:00:00Z",
                success=False,
            )

            import time

            start = time.time()
            result = await executor.execute_with_healing("test")
            elapsed = time.time() - start

            # Should have delays: 0.01 + 0.02 + 0.04 = 0.07s minimum
            assert elapsed >= 0.06
            assert result.retries == 3

    @pytest.mark.asyncio
    async def test_retry_on_recoverable_errors_only(self):
        """Should only retry recoverable errors."""
        from worker_python.tool_detector import ToolDetector
        from worker_python.error_analyzer import ErrorAnalyzer

        mock_detector = Mock(spec=ToolDetector)
        mock_detector.distro = "debian"

        mock_analyzer = Mock(spec=ErrorAnalyzer)
        mock_analyzer.classify = Mock(return_value=ErrorType.SYNTAX_ERROR)
        mock_analyzer.generate_remediation_async = AsyncMock(
            return_value=Mock(
                action="manual_review",
                command="",
                use_fallback_ai=False,  # Cannot remediate
                requires_manual_review=True,
            )
        )

        executor = SelfHealingExecutor(
            error_analyzer=mock_analyzer,
            tool_detector=mock_detector,
            max_retries=3,
        )

        # Syntax errors are not recoverable without AI
        with patch.object(executor, "_execute_command") as mock_exec:
            mock_exec.return_value = ExecutionResult(
                command="echo 'test",
                exit_code=2,
                stdout="",
                stderr="syntax error: unexpected EOF",
                duration=0.01,
                timestamp="2025-01-01T00:00:00Z",
                success=False,
            )

            result = await executor.execute_with_healing("echo 'test")

            # Should not retry extensively for syntax errors
            assert result.success is False
            # Should stop early because cannot remediate
            assert result.retries == 0


class TestMemoryIntegration:
    """Test integration with Qdrant memory."""

    @pytest.mark.asyncio
    async def test_store_successful_solution(self):
        """Should store successful command execution in memory."""
        from worker_python.memory import MemoryManager

        mock_memory = Mock(spec=MemoryManager)
        mock_memory.commit_knowledge = Mock(
            return_value="point-id-123"
        )  # Sync mock for asyncio.to_thread

        executor = SelfHealingExecutor(memory_manager=mock_memory)

        result = await executor.execute_with_healing("echo 'test'")

        assert result.success is True
        # Should have stored in memory
        mock_memory.commit_knowledge.assert_called_once()
        call_args = mock_memory.commit_knowledge.call_args[1]
        # Command is stored as solution, not output
        assert "echo" in call_args["solution"]
        assert call_args["success_rate"] == 1.0

    @pytest.mark.asyncio
    async def test_store_failure_pattern(self):
        """Should store failure patterns for learning."""
        from worker_python.memory import MemoryManager

        mock_memory = Mock(spec=MemoryManager)
        mock_memory.commit_knowledge = AsyncMock(return_value="point-id-456")

        executor = SelfHealingExecutor(
            memory_manager=mock_memory,
            max_retries=1,
        )

        with patch.object(executor, "_execute_command") as mock_exec:
            mock_exec.return_value = ExecutionResult(
                command="fail-command",
                exit_code=1,
                stdout="",
                stderr="Error",
                duration=0.01,
                timestamp="2025-01-01T00:00:00Z",
                success=False,
            )

            result = await executor.execute_with_healing("fail-command")

            assert result.success is False
            # Should have stored failure
            mock_memory.commit_knowledge.assert_called()
            call_args = mock_memory.commit_knowledge.call_args[1]
            assert call_args["success_rate"] == 0.0

    @pytest.mark.asyncio
    async def test_search_memory_for_similar_problems(self):
        """Should search memory for similar past solutions."""
        from worker_python.memory import MemoryManager

        mock_memory = Mock(spec=MemoryManager)
        mock_memory.search_knowledge = AsyncMock(
            return_value=[
                {
                    "score": 0.95,
                    "problem": "nginx not installed",
                    "solution": "apt-get install nginx -y",
                    "success_rate": 1.0,
                }
            ]
        )

        executor = SelfHealingExecutor(
            memory_manager=mock_memory,
            use_memory_search=True,
        )

        # Execute command that might benefit from memory
        with patch.object(executor, "_execute_command") as mock_exec:
            mock_exec.return_value = ExecutionResult(
                command="nginx",
                exit_code=127,
                stdout="",
                stderr="nginx: command not found",
                duration=0.01,
                timestamp="2025-01-01T00:00:00Z",
                success=False,
            )

            await executor.execute_with_healing("nginx")

            # Should have searched memory
            mock_memory.search_knowledge.assert_called()


class TestFallbackChainIntegration:
    """Test integration with fallback chain."""

    @pytest.mark.asyncio
    async def test_use_fallback_for_unknown_errors(self):
        """Should use fallback AI for unknown errors."""
        from worker_python.fallback import FallbackChain

        mock_fallback = Mock(spec=FallbackChain)
        mock_fallback.infer = AsyncMock(
            return_value=Mock(
                content="Try running: apt-get update && apt-get install nginx",
                success=True,
            )
        )

        executor = SelfHealingExecutor(
            fallback_chain=mock_fallback,
            max_retries=2,
        )

        with patch.object(executor, "_execute_command") as mock_exec:
            # First: unknown error
            # Second: success after AI suggestion
            mock_exec.side_effect = [
                ExecutionResult(
                    command="obscure-command",
                    exit_code=1,
                    stdout="",
                    stderr="Mysterious error occurred",
                    duration=0.01,
                    timestamp="2025-01-01T00:00:00Z",
                    success=False,
                ),
                ExecutionResult(
                    command="apt-get update && apt-get install nginx",
                    exit_code=0,
                    stdout="Success",
                    stderr="",
                    duration=0.01,
                    timestamp="2025-01-01T00:00:00Z",
                    success=True,
                ),
            ]

            result = await executor.execute_with_healing("obscure-command")

            # Should have called fallback
            mock_fallback.infer.assert_called()


class TestSafetyValidation:
    """Test safety validation for commands."""

    @pytest.mark.asyncio
    async def test_reject_dangerous_command(self):
        """Should reject dangerous commands."""
        executor = SelfHealingExecutor()

        with pytest.raises(ExecutionError):
            await executor.execute_with_healing("rm -rf /")

    @pytest.mark.asyncio
    async def test_reject_fork_bomb(self):
        """Should reject fork bomb patterns."""
        executor = SelfHealingExecutor()

        with pytest.raises(ExecutionError):
            await executor.execute_with_healing(":(){ :|:& };:")

    @pytest.mark.asyncio
    async def test_allow_safe_rm_command(self):
        """Should allow safe rm commands."""
        executor = SelfHealingExecutor()

        # Safe rm command should not raise
        result = await executor.execute_with_healing("rm /tmp/test.txt")

        # May fail (file doesn't exist) but should execute
        assert result is not None


class TestExecutionMetrics:
    """Test execution metrics and monitoring."""

    @pytest.mark.asyncio
    async def test_execution_duration_tracking(self):
        """Should track execution duration."""
        executor = SelfHealingExecutor()

        result = await executor.execute("sleep 0.1")

        assert result.duration >= 0.1

    @pytest.mark.asyncio
    async def test_remediation_tracking(self):
        """Should track which remediations were applied."""
        executor = SelfHealingExecutor(max_retries=2)

        with patch.object(executor, "_execute_command") as mock_exec:
            with patch.object(executor.error_analyzer, "classify") as mock_classify:
                with patch.object(
                    executor.error_analyzer, "generate_remediation"
                ) as mock_remediate:
                    mock_classify.return_value = ErrorType.PERMISSION_DENIED
                    mock_remediate.return_value = Mock(
                        action="add_sudo",
                        command="sudo test",
                    )

                    mock_exec.side_effect = [
                        ExecutionResult(
                            command="test",
                            exit_code=1,
                            stdout="",
                            stderr="Permission denied",
                            duration=0.01,
                            timestamp="2025-01-01T00:00:00Z",
                            success=False,
                        ),
                        ExecutionResult(
                            command="sudo test",
                            exit_code=0,
                            stdout="Success",
                            stderr="",
                            duration=0.01,
                            timestamp="2025-01-01T00:00:00Z",
                            success=True,
                        ),
                    ]

                    result = await executor.execute_with_healing("test")

                    assert "add_sudo" in result.remediations_applied
                    assert result.retries == 1


class TestRealCommandExecution:
    """Test with real (safe) command execution."""

    @pytest.mark.asyncio
    async def test_real_echo_command(self):
        """Should execute real echo command."""
        executor = SelfHealingExecutor()

        result = await executor.execute("echo 'Hello World'")

        assert result.success is True
        assert "Hello World" in result.stdout
        assert result.exit_code == 0

    @pytest.mark.asyncio
    async def test_real_ls_command(self):
        """Should execute real ls command."""
        executor = SelfHealingExecutor()

        result = await executor.execute("ls /tmp")

        assert result.success is True
        assert result.exit_code == 0

    @pytest.mark.asyncio
    async def test_real_date_command(self):
        """Should execute real date command."""
        executor = SelfHealingExecutor()

        result = await executor.execute("date")

        assert result.success is True
        assert len(result.stdout) > 0
        assert result.exit_code == 0
