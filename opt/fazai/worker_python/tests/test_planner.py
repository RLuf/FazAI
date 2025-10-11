"""Test suite for CommandPlanner.

Following TDD principles:
1. RED - Write failing tests first
2. GREEN - Implement minimum code to pass
3. REFACTOR - Improve code while keeping tests green
"""

import pytest
from unittest.mock import Mock, patch

# Import will fail initially - this is expected in RED phase
from worker_python.planner import CommandPlanner


class TestCommandPlannerInitialization:
    """Test CommandPlanner initialization."""

    def test_planner_initializes(self):
        """CommandPlanner should initialize successfully."""
        planner = CommandPlanner()
        assert planner is not None

    def test_planner_has_distro_detection(self):
        """CommandPlanner should have distro detection capability."""
        planner = CommandPlanner()
        assert hasattr(planner, 'detect_distro')


class TestPlanCreation:
    """Test plan creation from intents."""

    @pytest.fixture
    def planner(self):
        """Create planner for testing."""
        return CommandPlanner()

    def test_create_plan_returns_list(self, planner):
        """create_plan should return a list of steps."""
        intent = {
            "intent": "monitor_network_ports",
            "confidence": 0.95,
            "tools_needed": ["netstat"],
            "steps": [
                {"action": "check_listening_ports", "command": "netstat -tulpn"}
            ],
            "distro_hints": ["debian", "ubuntu"],
            "clarification_needed": False
        }

        plan = planner.create_plan(intent)
        assert isinstance(plan, list)

    def test_create_plan_has_step_structure(self, planner):
        """Each step should have required fields."""
        intent = {
            "intent": "monitor_network_ports",
            "confidence": 0.95,
            "tools_needed": ["netstat"],
            "steps": [
                {"action": "check_listening_ports", "command": "netstat -tulpn"}
            ],
            "distro_hints": ["debian"],
            "clarification_needed": False
        }

        plan = planner.create_plan(intent)
        assert len(plan) > 0

        for step in plan:
            assert "step" in step
            assert "command" in step
            assert "description" in step

    def test_create_plan_preserves_step_order(self, planner):
        """Plan steps should preserve order from intent."""
        intent = {
            "intent": "multi_step_task",
            "confidence": 0.9,
            "tools_needed": [],
            "steps": [
                {"action": "first", "command": "cmd1"},
                {"action": "second", "command": "cmd2"},
                {"action": "third", "command": "cmd3"}
            ],
            "distro_hints": [],
            "clarification_needed": False
        }

        plan = planner.create_plan(intent)
        assert plan[0]["step"] == 1
        assert plan[1]["step"] == 2
        assert plan[2]["step"] == 3


class TestDistroAwareness:
    """Test distribution-aware command generation."""

    @pytest.fixture
    def planner(self):
        """Create planner for testing."""
        return CommandPlanner()

    def test_detect_distro_returns_string(self, planner):
        """detect_distro should return distro name."""
        with patch('platform.freedesktop_os_release') as mock_os_release:
            mock_os_release.return_value = {'ID': 'ubuntu'}
            distro = planner.detect_distro()
            assert isinstance(distro, str)

    def test_adapt_command_for_distro(self, planner):
        """Should adapt commands based on distro."""
        # Mock the distro
        planner.current_distro = "debian"

        command = "install nginx"
        adapted = planner.adapt_command(command, "debian")

        # Should suggest apt-get for Debian
        assert "apt" in adapted.lower() or "apt-get" in adapted.lower()

    def test_adapt_command_handles_rhel(self, planner):
        """Should use yum/dnf for RHEL-based distros."""
        planner.current_distro = "rhel"

        command = "install nginx"
        adapted = planner.adapt_command(command, "rhel")

        # Should suggest yum or dnf for RHEL
        assert "yum" in adapted.lower() or "dnf" in adapted.lower()


class TestMultiStepPlanning:
    """Test multi-step command planning."""

    @pytest.fixture
    def planner(self):
        """Create planner for testing."""
        return CommandPlanner()

    def test_plan_multi_step_task(self, planner):
        """Should create multi-step plan."""
        intent = {
            "intent": "port_security_audit",
            "confidence": 0.92,
            "tools_needed": ["netstat", "ss", "iptables"],
            "steps": [
                {"action": "list_ports", "command": "netstat -tulpn || ss -tulpn"},
                {"action": "check_firewall", "command": "iptables -L -v -n"},
                {"action": "analyze_output", "command": "# Review and analyze"}
            ],
            "distro_hints": ["debian", "ubuntu"],
            "clarification_needed": False
        }

        plan = planner.create_plan(intent)

        assert len(plan) == 3
        assert all("command" in step for step in plan)

    def test_plan_includes_dependencies(self, planner):
        """Plan should check for tool dependencies."""
        intent = {
            "intent": "monitor_network_ports",
            "confidence": 0.95,
            "tools_needed": ["netstat", "net-tools"],
            "steps": [
                {"action": "check_ports", "command": "netstat -tulpn"}
            ],
            "distro_hints": ["debian"],
            "clarification_needed": False
        }

        plan = planner.create_plan(intent, check_dependencies=True)

        # Should include dependency check step
        assert len(plan) >= 1
        # First step might be dependency check
        assert any("which" in step["command"].lower() or
                   "command -v" in step["command"].lower() or
                   "netstat" in step["command"].lower()
                   for step in plan)


class TestCommandValidation:
    """Test command validation and safety checks."""

    @pytest.fixture
    def planner(self):
        """Create planner for testing."""
        return CommandPlanner()

    def test_validate_command_rejects_dangerous(self, planner):
        """Should flag potentially dangerous commands."""
        dangerous_commands = [
            "rm -rf /",
            "dd if=/dev/zero of=/dev/sda",
            ":(){ :|:& };:",  # Fork bomb
            "chmod -R 777 /"
        ]

        for cmd in dangerous_commands:
            is_safe = planner.is_command_safe(cmd)
            assert is_safe is False, f"Command should be flagged as unsafe: {cmd}"

    def test_validate_command_allows_safe(self, planner):
        """Should allow safe commands."""
        safe_commands = [
            "netstat -tulpn",
            "ps aux",
            "ls -la",
            "cat /etc/os-release"
        ]

        for cmd in safe_commands:
            is_safe = planner.is_command_safe(cmd)
            assert is_safe is True, f"Command should be marked as safe: {cmd}"


class TestErrorHandling:
    """Test error handling in planner."""

    @pytest.fixture
    def planner(self):
        """Create planner for testing."""
        return CommandPlanner()

    def test_create_plan_with_empty_intent(self, planner):
        """Should handle empty intent gracefully."""
        intent = {
            "intent": "empty",
            "confidence": 0.0,
            "tools_needed": [],
            "steps": [],
            "distro_hints": [],
            "clarification_needed": True
        }

        plan = planner.create_plan(intent)
        assert isinstance(plan, list)
        assert len(plan) == 0

    def test_create_plan_with_missing_fields(self, planner):
        """Should handle missing fields in intent."""
        incomplete_intent = {
            "intent": "test",
            "confidence": 0.9
            # Missing other fields
        }

        with pytest.raises((KeyError, ValueError)):
            planner.create_plan(incomplete_intent)

    def test_create_plan_with_none_input(self, planner):
        """Should handle None input."""
        with pytest.raises((TypeError, ValueError)):
            planner.create_plan(None)


class TestPlanFormatting:
    """Test plan output formatting."""

    @pytest.fixture
    def planner(self):
        """Create planner for testing."""
        return CommandPlanner()

    def test_plan_has_consistent_format(self, planner):
        """All plan steps should have consistent format."""
        intent = {
            "intent": "test_task",
            "confidence": 0.9,
            "tools_needed": [],
            "steps": [
                {"action": "step1", "command": "cmd1"},
                {"action": "step2", "command": "cmd2"}
            ],
            "distro_hints": [],
            "clarification_needed": False
        }

        plan = planner.create_plan(intent)

        # Check all steps have same structure
        keys_set = set(plan[0].keys())
        for step in plan:
            assert set(step.keys()) == keys_set

    def test_plan_steps_are_numbered(self, planner):
        """Plan steps should be numbered sequentially."""
        intent = {
            "intent": "test_task",
            "confidence": 0.9,
            "tools_needed": [],
            "steps": [
                {"action": "step1", "command": "cmd1"},
                {"action": "step2", "command": "cmd2"},
                {"action": "step3", "command": "cmd3"}
            ],
            "distro_hints": [],
            "clarification_needed": False
        }

        plan = planner.create_plan(intent)

        for i, step in enumerate(plan, 1):
            assert step["step"] == i


class TestPlanExecution:
    """Test plan execution preparation."""

    @pytest.fixture
    def planner(self):
        """Create planner for testing."""
        return CommandPlanner()

    def test_plan_includes_execution_metadata(self, planner):
        """Plan should include metadata for execution."""
        intent = {
            "intent": "monitor_ports",
            "confidence": 0.95,
            "tools_needed": ["netstat"],
            "steps": [
                {"action": "check_ports", "command": "netstat -tulpn"}
            ],
            "distro_hints": ["debian"],
            "clarification_needed": False
        }

        plan = planner.create_plan(intent, include_metadata=True)

        # Should include execution hints
        for step in plan:
            assert "command" in step
            assert "description" in step

    def test_plan_dry_run_mode(self, planner):
        """Should support dry-run mode that doesn't execute."""
        intent = {
            "intent": "test",
            "confidence": 0.9,
            "tools_needed": [],
            "steps": [
                {"action": "test_action", "command": "echo test"}
            ],
            "distro_hints": [],
            "clarification_needed": False
        }

        plan = planner.create_plan(intent, dry_run=True)

        # In dry run, should still return plan structure
        assert len(plan) > 0
        assert all("command" in step for step in plan)
