"""Tests for tool_detector module - Tool detection and installation.

Following TDD approach: RED (write failing tests) → GREEN (implement) → REFACTOR
"""

import pytest
from unittest.mock import AsyncMock, Mock, patch
from worker_python.tool_detector import (
    ToolDetector,
    UnsupportedDistro,
    DangerousPackage,
)


class TestToolDetection:
    """Test tool detection from intent."""

    def test_detect_required_tools_from_intent(self):
        """Should extract tools_needed from intent dictionary."""
        detector = ToolDetector(distro="debian")
        intent = {
            "intent": "monitor_network_ports",
            "tools_needed": ["netstat", "ss"],
        }

        tools = detector.detect_required_tools(intent)

        assert tools == ["netstat", "ss"]

    def test_detect_required_tools_empty(self):
        """Should return empty list if no tools needed."""
        detector = ToolDetector(distro="debian")
        intent = {"intent": "simple_task", "tools_needed": []}

        tools = detector.detect_required_tools(intent)

        assert tools == []

    def test_detect_required_tools_missing_key(self):
        """Should return empty list if tools_needed key missing."""
        detector = ToolDetector(distro="debian")
        intent = {"intent": "simple_task"}

        tools = detector.detect_required_tools(intent)

        assert tools == []


@pytest.mark.asyncio
class TestToolInstallationCheck:
    """Test checking if tools are installed."""

    async def test_is_installed_true(self):
        """Should return True if tool is installed."""
        with patch(
            "worker_python.tool_detector.asyncio.create_subprocess_exec"
        ) as mock_exec:
            mock_process = AsyncMock()
            mock_process.wait = AsyncMock(return_value=0)
            mock_exec.return_value = mock_process

            detector = ToolDetector(distro="debian")
            result = await detector.is_installed("nginx")

            assert result is True
            mock_exec.assert_called_once()

    async def test_is_installed_false(self):
        """Should return False if tool not installed."""
        with patch(
            "worker_python.tool_detector.asyncio.create_subprocess_exec"
        ) as mock_exec:
            mock_process = AsyncMock()
            mock_process.wait = AsyncMock(return_value=1)
            mock_exec.return_value = mock_process

            detector = ToolDetector(distro="debian")
            result = await detector.is_installed("nonexistent")

            assert result is False

    async def test_is_installed_handles_exception(self):
        """Should return False if command execution fails."""
        with patch(
            "worker_python.tool_detector.asyncio.create_subprocess_exec"
        ) as mock_exec:
            mock_exec.side_effect = Exception("Command failed")

            detector = ToolDetector(distro="debian")
            result = await detector.is_installed("tool")

            assert result is False


@pytest.mark.asyncio
class TestToolInstallation:
    """Test tool installation logic."""

    async def test_install_debian_package(self):
        """Should generate apt-get install command for Debian."""
        with patch(
            "worker_python.tool_detector.asyncio.create_subprocess_exec"
        ) as mock_exec:
            mock_process = AsyncMock()
            mock_process.wait = AsyncMock(return_value=0)
            mock_process.communicate = AsyncMock(return_value=(b"Success", b""))
            mock_exec.return_value = mock_process

            detector = ToolDetector(distro="debian")
            result = await detector.install("nginx")

            assert result.success is True
            # Verify apt-get was called
            args = mock_exec.call_args[0]
            assert "apt-get" in args

    async def test_install_rhel_package(self):
        """Should generate yum install command for RHEL."""
        with patch(
            "worker_python.tool_detector.asyncio.create_subprocess_exec"
        ) as mock_exec:
            mock_process = AsyncMock()
            mock_process.wait = AsyncMock(return_value=0)
            mock_process.communicate = AsyncMock(return_value=(b"Success", b""))
            mock_exec.return_value = mock_process

            detector = ToolDetector(distro="rhel")
            result = await detector.install("nginx")

            assert result.success is True
            # Verify yum was called
            args = mock_exec.call_args[0]
            assert "yum" in args

    async def test_install_arch_package(self):
        """Should generate pacman install command for Arch."""
        with patch(
            "worker_python.tool_detector.asyncio.create_subprocess_exec"
        ) as mock_exec:
            mock_process = AsyncMock()
            mock_process.wait = AsyncMock(return_value=0)
            mock_process.communicate = AsyncMock(return_value=(b"Success", b""))
            mock_exec.return_value = mock_process

            detector = ToolDetector(distro="arch")
            result = await detector.install("nginx")

            assert result.success is True
            # Verify pacman was called
            args = mock_exec.call_args[0]
            assert "pacman" in args

    async def test_install_fedora_package(self):
        """Should generate dnf install command for Fedora."""
        with patch(
            "worker_python.tool_detector.asyncio.create_subprocess_exec"
        ) as mock_exec:
            mock_process = AsyncMock()
            mock_process.wait = AsyncMock(return_value=0)
            mock_process.communicate = AsyncMock(return_value=(b"Success", b""))
            mock_exec.return_value = mock_process

            detector = ToolDetector(distro="fedora")
            result = await detector.install("nginx")

            assert result.success is True
            # Verify dnf was called
            args = mock_exec.call_args[0]
            assert "dnf" in args

    async def test_install_alpine_package(self):
        """Should generate apk install command for Alpine."""
        with patch(
            "worker_python.tool_detector.asyncio.create_subprocess_exec"
        ) as mock_exec:
            mock_process = AsyncMock()
            mock_process.wait = AsyncMock(return_value=0)
            mock_process.communicate = AsyncMock(return_value=(b"Success", b""))
            mock_exec.return_value = mock_process

            detector = ToolDetector(distro="alpine")
            result = await detector.install("nginx")

            assert result.success is True
            # Verify apk was called
            args = mock_exec.call_args[0]
            assert "apk" in args

    async def test_install_unsupported_distro(self):
        """Should raise UnsupportedDistro for unknown distribution."""
        detector = ToolDetector(distro="unknown")

        with pytest.raises(UnsupportedDistro):
            await detector.install("nginx")


class TestPackageSafety:
    """Test package safety validation."""

    def test_is_safe_to_install_safe_package(self):
        """Should return True for safe packages."""
        detector = ToolDetector(distro="debian")

        safe_packages = ["nginx", "curl", "git", "vim", "htop"]

        for package in safe_packages:
            assert detector.is_safe_to_install(package) is True

    def test_is_safe_to_install_dangerous_package(self):
        """Should return False for dangerous packages."""
        detector = ToolDetector(distro="debian")

        dangerous_packages = ["malware", "ransomware", "bitcoin-miner"]

        for package in dangerous_packages:
            assert detector.is_safe_to_install(package) is False

    def test_is_safe_to_install_unknown_package(self):
        """Should return False for unknown packages (requires confirmation)."""
        detector = ToolDetector(distro="debian")

        # Unknown package not in safe or dangerous list
        result = detector.is_safe_to_install("obscure-unknown-package")

        # Should require manual confirmation
        assert result is False

    def test_dangerous_package_blocks_installation(self):
        """Should raise DangerousPackage error for dangerous packages."""
        detector = ToolDetector(distro="debian")

        with pytest.raises(DangerousPackage):
            detector.validate_package_safety("malware")


@pytest.mark.asyncio
class TestBatchInstallation:
    """Test installing multiple tools at once."""

    async def test_install_multiple_tools(self):
        """Should install multiple tools sequentially."""
        with patch(
            "worker_python.tool_detector.asyncio.create_subprocess_exec"
        ) as mock_exec:
            mock_process = AsyncMock()
            mock_process.wait = AsyncMock(return_value=0)
            mock_process.communicate = AsyncMock(return_value=(b"Success", b""))
            mock_exec.return_value = mock_process

            detector = ToolDetector(distro="debian")
            tools = ["nginx", "curl", "git"]

            results = await detector.install_multiple(tools)

            assert len(results) == 3
            assert all(r.success for r in results)

    async def test_install_multiple_tools_partial_failure(self):
        """Should continue installing even if one fails."""
        with patch(
            "worker_python.tool_detector.asyncio.create_subprocess_exec"
        ) as mock_exec:
            # First succeeds, second fails, third succeeds
            call_count = [0]

            async def side_effect(*args, **kwargs):
                call_count[0] += 1
                mock_process = AsyncMock()
                if call_count[0] == 2:
                    mock_process.wait = AsyncMock(return_value=1)
                    mock_process.communicate = AsyncMock(return_value=(b"", b"Error"))
                else:
                    mock_process.wait = AsyncMock(return_value=0)
                    mock_process.communicate = AsyncMock(return_value=(b"Success", b""))
                return mock_process

            mock_exec.side_effect = side_effect

            detector = ToolDetector(distro="debian")
            tools = ["nginx", "fail-package", "git"]

            results = await detector.install_multiple(tools)

            assert len(results) == 3
            assert results[0].success is True
            assert results[1].success is False
            assert results[2].success is True


class TestDistroDetection:
    """Test distribution detection."""

    def test_detect_distro_from_planner(self):
        """Should use distro from CommandPlanner."""
        from worker_python.planner import CommandPlanner

        with patch.object(CommandPlanner, "detect_distro", return_value="ubuntu"):
            detector = ToolDetector()

            assert detector.distro == "ubuntu"

    def test_detect_distro_manual_override(self):
        """Should allow manual distro override."""
        detector = ToolDetector(distro="fedora")

        assert detector.distro == "fedora"


class TestInstallCommandGeneration:
    """Test install command generation."""

    def test_get_install_command_debian(self):
        """Should generate correct command for Debian-based distros."""
        detector = ToolDetector(distro="debian")

        cmd = detector.get_install_command("nginx")

        assert "apt-get" in cmd
        assert "install" in cmd
        assert "nginx" in cmd
        assert "-y" in cmd  # Non-interactive

    def test_get_install_command_rhel(self):
        """Should generate correct command for RHEL-based distros."""
        detector = ToolDetector(distro="rhel")

        cmd = detector.get_install_command("nginx")

        assert "yum" in cmd
        assert "install" in cmd
        assert "nginx" in cmd

    def test_get_install_command_with_package_mapping(self):
        """Should map package names for different distros."""
        detector = ToolDetector(distro="arch")

        # Some packages have different names on different distros
        cmd = detector.get_install_command("apache2", package_map={"apache2": "apache"})

        assert "apache" in cmd
        assert "apache2" not in cmd
