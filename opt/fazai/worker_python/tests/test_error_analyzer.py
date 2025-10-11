"""Tests for error_analyzer module - Error classification and remediation.

Following TDD approach: RED (write failing tests) → GREEN (implement) → REFACTOR
"""

import pytest
from worker_python.error_analyzer import (
    ErrorAnalyzer,
    ErrorType,
    RemediationStrategy,
)


class TestErrorClassification:
    """Test error type classification."""

    def test_classify_missing_tool(self):
        """Should classify 'command not found' as MISSING_TOOL."""
        analyzer = ErrorAnalyzer()
        stderr = "bash: nginx: command not found"
        exit_code = 127

        error_type = analyzer.classify(stderr, exit_code)

        assert error_type == ErrorType.MISSING_TOOL

    def test_classify_permission_denied(self):
        """Should classify permission errors as PERMISSION_DENIED."""
        analyzer = ErrorAnalyzer()
        stderr = "Permission denied"
        exit_code = 1

        error_type = analyzer.classify(stderr, exit_code)

        assert error_type == ErrorType.PERMISSION_DENIED

    def test_classify_syntax_error(self):
        """Should classify syntax errors as SYNTAX_ERROR."""
        analyzer = ErrorAnalyzer()
        stderr = "bash: syntax error near unexpected token"
        exit_code = 2

        error_type = analyzer.classify(stderr, exit_code)

        assert error_type == ErrorType.SYNTAX_ERROR

    def test_classify_network_error(self):
        """Should classify network errors as NETWORK_ERROR."""
        analyzer = ErrorAnalyzer()
        stderr = "Could not resolve host: example.com"
        exit_code = 6

        error_type = analyzer.classify(stderr, exit_code)

        assert error_type == ErrorType.NETWORK_ERROR

    def test_classify_timeout(self):
        """Should classify timeout with exit code 124."""
        analyzer = ErrorAnalyzer()
        stderr = ""
        exit_code = 124  # timeout command exit code

        error_type = analyzer.classify(stderr, exit_code)

        assert error_type == ErrorType.TIMEOUT

    def test_classify_file_not_found(self):
        """Should classify file not found errors."""
        analyzer = ErrorAnalyzer()
        stderr = "No such file or directory"
        exit_code = 1

        error_type = analyzer.classify(stderr, exit_code)

        assert error_type == ErrorType.FILE_NOT_FOUND

    def test_classify_unknown(self):
        """Should classify unrecognized errors as UNKNOWN."""
        analyzer = ErrorAnalyzer()
        stderr = "Something went terribly wrong"
        exit_code = 42

        error_type = analyzer.classify(stderr, exit_code)

        assert error_type == ErrorType.UNKNOWN

    def test_classify_case_insensitive(self):
        """Should classify errors case-insensitively."""
        analyzer = ErrorAnalyzer()
        stderr = "PERMISSION DENIED"
        exit_code = 1

        error_type = analyzer.classify(stderr, exit_code)

        assert error_type == ErrorType.PERMISSION_DENIED

    def test_classify_multiple_patterns(self):
        """Should match first pattern in priority order."""
        analyzer = ErrorAnalyzer()
        # Multiple error indicators - should prioritize
        stderr = "command not found: Permission denied"
        exit_code = 127

        error_type = analyzer.classify(stderr, exit_code)

        # Exit code 127 is strong indicator of missing tool
        assert error_type == ErrorType.MISSING_TOOL


class TestErrorExtraction:
    """Test extraction of error details from stderr."""

    def test_extract_missing_tool_name(self):
        """Should extract tool name from 'command not found' error."""
        analyzer = ErrorAnalyzer()
        stderr = "bash: nginx: command not found"

        tool_name = analyzer.extract_missing_tool(stderr)

        assert tool_name == "nginx"

    def test_extract_missing_tool_with_path(self):
        """Should extract tool name from path error."""
        analyzer = ErrorAnalyzer()
        stderr = "/usr/bin/env: 'python3': No such file or directory"

        tool_name = analyzer.extract_missing_tool(stderr)

        assert tool_name == "python3"

    def test_extract_missing_tool_none(self):
        """Should return None if no tool name found."""
        analyzer = ErrorAnalyzer()
        stderr = "Some random error"

        tool_name = analyzer.extract_missing_tool(stderr)

        assert tool_name is None

    def test_extract_missing_file_path(self):
        """Should extract file path from file not found error."""
        analyzer = ErrorAnalyzer()
        stderr = "cat: /etc/missing.conf: No such file or directory"

        file_path = analyzer.extract_missing_file(stderr)

        assert file_path == "/etc/missing.conf"


class TestRemediationGeneration:
    """Test remediation strategy generation."""

    def test_generate_remediation_missing_tool(self):
        """Should generate install command for missing tool."""
        analyzer = ErrorAnalyzer()
        error_type = ErrorType.MISSING_TOOL
        context = {"tool": "nginx", "distro": "debian"}

        remediation = analyzer.generate_remediation(error_type, context)

        assert isinstance(remediation, RemediationStrategy)
        assert "install" in remediation.action.lower()
        assert "nginx" in remediation.command

    def test_generate_remediation_permission_denied(self):
        """Should suggest sudo for permission errors."""
        analyzer = ErrorAnalyzer()
        error_type = ErrorType.PERMISSION_DENIED
        context = {"command": "systemctl restart nginx"}

        remediation = analyzer.generate_remediation(error_type, context)

        assert isinstance(remediation, RemediationStrategy)
        assert "sudo" in remediation.command

    def test_generate_remediation_syntax_error(self):
        """Should mark syntax errors as requiring manual review."""
        analyzer = ErrorAnalyzer()
        error_type = ErrorType.SYNTAX_ERROR
        context = {"command": "echo 'test", "stderr": "unexpected EOF"}

        remediation = analyzer.generate_remediation(error_type, context)

        assert isinstance(remediation, RemediationStrategy)
        assert remediation.requires_manual_review is True

    def test_generate_remediation_network_error(self):
        """Should suggest network troubleshooting."""
        analyzer = ErrorAnalyzer()
        error_type = ErrorType.NETWORK_ERROR
        context = {"stderr": "Could not resolve host"}

        remediation = analyzer.generate_remediation(error_type, context)

        assert isinstance(remediation, RemediationStrategy)
        assert "network" in remediation.action.lower()

    def test_generate_remediation_file_not_found(self):
        """Should suggest file creation or path verification."""
        analyzer = ErrorAnalyzer()
        error_type = ErrorType.FILE_NOT_FOUND
        context = {"file": "/etc/config.conf"}

        remediation = analyzer.generate_remediation(error_type, context)

        assert isinstance(remediation, RemediationStrategy)
        assert remediation.action in ["create_file", "verify_path"]

    def test_generate_remediation_unknown_needs_fallback(self):
        """Should mark unknown errors as needing fallback AI analysis."""
        analyzer = ErrorAnalyzer()
        error_type = ErrorType.UNKNOWN
        context = {"stderr": "Mysterious error", "command": "obscure-tool"}

        remediation = analyzer.generate_remediation(error_type, context)

        assert isinstance(remediation, RemediationStrategy)
        assert remediation.use_fallback_ai is True


@pytest.mark.asyncio
class TestAsyncRemediationWithFallback:
    """Test async remediation generation with fallback chain."""

    async def test_generate_remediation_with_fallback_ai(self):
        """Should use fallback AI for complex errors."""
        from unittest.mock import AsyncMock, Mock

        # Mock fallback chain
        mock_fallback = Mock()
        mock_fallback.infer = AsyncMock(
            return_value=Mock(
                content="Try running: apt-get update && apt-get install nginx",
                success=True,
            )
        )

        analyzer = ErrorAnalyzer(fallback_chain=mock_fallback)
        error_type = ErrorType.UNKNOWN
        context = {
            "command": "nginx -t",
            "stderr": "configuration file not found",
            "exit_code": 1,
        }

        remediation = await analyzer.generate_remediation_async(error_type, context)

        assert isinstance(remediation, RemediationStrategy)
        mock_fallback.infer.assert_called_once()
        assert "apt-get install nginx" in remediation.command

    async def test_generate_remediation_fallback_fails(self):
        """Should handle fallback AI failure gracefully."""
        from unittest.mock import AsyncMock, Mock

        # Mock failing fallback
        mock_fallback = Mock()
        mock_fallback.infer = AsyncMock(side_effect=Exception("Fallback failed"))

        analyzer = ErrorAnalyzer(fallback_chain=mock_fallback)
        error_type = ErrorType.UNKNOWN
        context = {"stderr": "Mystery error"}

        remediation = await analyzer.generate_remediation_async(error_type, context)

        # Should return default strategy even if fallback fails
        assert isinstance(remediation, RemediationStrategy)
        assert remediation.requires_manual_review is True


class TestErrorPatternMatching:
    """Test error pattern regex matching."""

    def test_multiple_error_indicators(self):
        """Should match errors with multiple indicators."""
        analyzer = ErrorAnalyzer()

        # Test various ways permission denied appears
        test_cases = [
            "Permission denied",
            "Access denied",
            "Operation not permitted",
            "You do not have permission",
        ]

        for stderr in test_cases:
            error_type = analyzer.classify(stderr, 1)
            assert error_type == ErrorType.PERMISSION_DENIED, f"Failed for: {stderr}"

    def test_missing_tool_variations(self):
        """Should match various missing tool error formats."""
        analyzer = ErrorAnalyzer()

        test_cases = [
            ("bash: nginx: command not found", 127),
            ("nginx: not found", 127),
            ("/bin/sh: 1: nginx: not found", 127),
            ("nginx: No such file or directory", 127),
        ]

        for stderr, exit_code in test_cases:
            error_type = analyzer.classify(stderr, exit_code)
            assert error_type == ErrorType.MISSING_TOOL, f"Failed for: {stderr}"
