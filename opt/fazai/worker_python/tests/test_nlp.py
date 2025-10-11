"""Test suite for NLP intent parser and command planner.

Following TDD principles:
1. RED - Write failing tests first
2. GREEN - Implement minimum code to pass
3. REFACTOR - Improve code while keeping tests green
"""

import pytest
import json
from unittest.mock import Mock, patch

# Import will fail initially - this is expected in RED phase
from worker_python.nlp import NLPParser


class TestNLPParserInitialization:
    """Test NLPParser initialization."""

    def test_nlp_parser_initializes_with_model_path(self):
        """NLPParser should initialize with a model path."""
        parser = NLPParser(model_path="/path/to/model.gguf")
        assert parser.model_path == "/path/to/model.gguf"

    def test_nlp_parser_initializes_worker(self):
        """NLPParser should initialize a GemmaWorker instance."""
        with patch('worker_python.nlp.GemmaWorker') as mock_worker:
            parser = NLPParser(model_path="/path/to/model.gguf")
            mock_worker.assert_called_once()


class TestSimpleCommandParsing:
    """Test parsing of simple single-step commands."""

    @pytest.fixture
    def parser(self):
        """Create a mock parser for testing."""
        with patch('worker_python.nlp.GemmaWorker'):
            return NLPParser(model_path="/fake/path.gguf")

    def test_parse_simple_command(self, parser):
        """Should parse a simple command into structured output."""
        # Mock the GemmaWorker response
        parser.worker = Mock()
        parser.worker.infer.return_value = json.dumps({
            "intent": "check_network_ports",
            "confidence": 0.95,
            "tools_needed": ["netstat"],
            "steps": [
                {"action": "check_ports", "command": "netstat -tulpn"}
            ],
            "distro_hints": ["debian", "ubuntu"],
            "clarification_needed": False
        })

        result = parser.parse("show me open ports")

        assert result["intent"] == "check_network_ports"
        assert result["confidence"] >= 0.9
        assert "netstat" in result["tools_needed"]
        assert len(result["steps"]) == 1
        assert result["steps"][0]["command"] == "netstat -tulpn"
        assert result["clarification_needed"] is False

    def test_parse_returns_dict(self, parser):
        """Parse should return a dictionary."""
        parser.worker = Mock()
        parser.worker.infer.return_value = json.dumps({
            "intent": "test",
            "confidence": 0.9,
            "tools_needed": [],
            "steps": [],
            "distro_hints": [],
            "clarification_needed": False
        })

        result = parser.parse("test command")
        assert isinstance(result, dict)


class TestMultiStepCommandParsing:
    """Test parsing of complex multi-step commands."""

    @pytest.fixture
    def parser(self):
        """Create a mock parser for testing."""
        with patch('worker_python.nlp.GemmaWorker'):
            return NLPParser(model_path="/fake/path.gguf")

    def test_parse_multistep_command(self, parser):
        """Should break complex command into multiple steps."""
        parser.worker = Mock()
        parser.worker.infer.return_value = json.dumps({
            "intent": "port_monitoring_with_iptables",
            "confidence": 0.92,
            "tools_needed": ["netstat", "ss", "iptables"],
            "steps": [
                {"action": "check_ports", "command": "netstat -tulpn || ss -tulpn"},
                {"action": "create_counter_rules", "command": "iptables -A INPUT -j LOG"},
                {"action": "verify_rules", "command": "iptables -L -v"}
            ],
            "distro_hints": ["debian", "ubuntu"],
            "clarification_needed": False
        })

        result = parser.parse("analyze open ports and create iptables rules to count packets")

        assert len(result["steps"]) >= 2
        assert "iptables" in result["tools_needed"]
        assert any("netstat" in tool or "ss" in tool for tool in result["tools_needed"])

    def test_parse_multistep_has_ordered_steps(self, parser):
        """Multi-step commands should have logically ordered steps."""
        parser.worker = Mock()
        parser.worker.infer.return_value = json.dumps({
            "intent": "test",
            "confidence": 0.9,
            "tools_needed": [],
            "steps": [
                {"action": "step1", "command": "cmd1"},
                {"action": "step2", "command": "cmd2"},
                {"action": "step3", "command": "cmd3"}
            ],
            "distro_hints": [],
            "clarification_needed": False
        })

        result = parser.parse("do something complex")
        steps = result["steps"]

        assert isinstance(steps, list)
        for step in steps:
            assert "action" in step
            assert "command" in step


class TestAmbiguousCommandHandling:
    """Test handling of ambiguous or unclear commands."""

    @pytest.fixture
    def parser(self):
        """Create a mock parser for testing."""
        with patch('worker_python.nlp.GemmaWorker'):
            return NLPParser(model_path="/fake/path.gguf")

    def test_parse_ambiguous_command_sets_clarification_flag(self, parser):
        """Ambiguous commands should set clarification_needed=True."""
        parser.worker = Mock()
        parser.worker.infer.return_value = json.dumps({
            "intent": "unclear_network_operation",
            "confidence": 0.45,
            "tools_needed": [],
            "steps": [],
            "distro_hints": [],
            "clarification_needed": True
        })

        result = parser.parse("do something with the network")

        assert result["clarification_needed"] is True
        assert result["confidence"] < 0.7

    def test_parse_low_confidence_indicates_uncertainty(self, parser):
        """Low confidence scores should indicate parser uncertainty."""
        parser.worker = Mock()
        parser.worker.infer.return_value = json.dumps({
            "intent": "unknown",
            "confidence": 0.3,
            "tools_needed": [],
            "steps": [],
            "distro_hints": [],
            "clarification_needed": True
        })

        result = parser.parse("xyz abc foo bar")

        assert result["confidence"] < 0.5


class TestJSONExtractionAndValidation:
    """Test JSON extraction and validation from model output."""

    @pytest.fixture
    def parser(self):
        """Create a mock parser for testing."""
        with patch('worker_python.nlp.GemmaWorker'):
            return NLPParser(model_path="/fake/path.gguf")

    def test_extract_json_from_clean_output(self, parser):
        """Should extract JSON from clean model output."""
        json_str = json.dumps({"intent": "test", "confidence": 0.9, "tools_needed": [], "steps": [], "distro_hints": [], "clarification_needed": False})
        result = parser._extract_json(json_str)

        assert isinstance(result, dict)
        assert "intent" in result

    def test_extract_json_from_markdown_wrapped_output(self, parser):
        """Should extract JSON from markdown code blocks."""
        markdown_wrapped = '''Here's the result:
```json
{"intent": "test", "confidence": 0.9, "tools_needed": [], "steps": [], "distro_hints": [], "clarification_needed": false}
```
'''
        result = parser._extract_json(markdown_wrapped)

        assert isinstance(result, dict)
        assert result["intent"] == "test"

    def test_extract_json_handles_malformed_json(self, parser):
        """Should handle malformed JSON gracefully."""
        malformed = '{"intent": "test", "confidence": 0.9, "tools_needed": []'  # Missing closing braces

        # Should not raise exception, should return fallback
        result = parser._extract_json(malformed)
        assert result is not None

    def test_validate_plan_structure(self, parser):
        """Should validate that plan has required fields."""
        valid_plan = {
            "intent": "test",
            "confidence": 0.9,
            "tools_needed": ["tool1"],
            "steps": [{"action": "do_thing", "command": "cmd"}],
            "distro_hints": ["debian"],
            "clarification_needed": False
        }

        is_valid = parser._validate_plan(valid_plan)
        assert is_valid is True

    def test_validate_plan_rejects_missing_fields(self, parser):
        """Should reject plans missing required fields."""
        invalid_plan = {
            "intent": "test",
            "confidence": 0.9
            # Missing: tools_needed, steps, distro_hints, clarification_needed
        }

        is_valid = parser._validate_plan(invalid_plan)
        assert is_valid is False


class TestErrorCases:
    """Test error handling and edge cases."""

    @pytest.fixture
    def parser(self):
        """Create a mock parser for testing."""
        with patch('worker_python.nlp.GemmaWorker'):
            return NLPParser(model_path="/fake/path.gguf")

    def test_parse_empty_input(self, parser):
        """Should handle empty input gracefully."""
        parser.worker = Mock()
        parser.worker.infer.return_value = json.dumps({
            "intent": "empty_command",
            "confidence": 0.0,
            "tools_needed": [],
            "steps": [],
            "distro_hints": [],
            "clarification_needed": True
        })

        result = parser.parse("")

        assert result is not None
        assert result["clarification_needed"] is True

    def test_parse_none_input(self, parser):
        """Should handle None input gracefully."""
        with pytest.raises((ValueError, TypeError)):
            parser.parse(None)

    def test_parse_very_long_input(self, parser):
        """Should handle very long prompts."""
        long_prompt = "do something " * 1000  # ~13k characters
        parser.worker = Mock()
        parser.worker.infer.return_value = json.dumps({
            "intent": "complex_task",
            "confidence": 0.8,
            "tools_needed": [],
            "steps": [],
            "distro_hints": [],
            "clarification_needed": False
        })

        result = parser.parse(long_prompt)
        assert result is not None

    def test_parse_handles_worker_exception(self, parser):
        """Should handle GemmaWorker exceptions gracefully."""
        parser.worker = Mock()
        parser.worker.infer.side_effect = RuntimeError("Model error")

        with pytest.raises(RuntimeError):
            parser.parse("test command")


class TestSystemPromptIntegration:
    """Test that system prompt is properly integrated."""

    @pytest.fixture
    def parser(self):
        """Create a mock parser for testing."""
        with patch('worker_python.nlp.GemmaWorker'):
            return NLPParser(model_path="/fake/path.gguf")

    def test_parser_has_system_prompt(self, parser):
        """Parser should have a system prompt defined."""
        assert hasattr(parser, 'system_prompt')
        assert len(parser.system_prompt) > 0

    def test_system_prompt_mentions_linux(self, parser):
        """System prompt should mention Linux context."""
        assert "linux" in parser.system_prompt.lower() or "sysadmin" in parser.system_prompt.lower()

    def test_system_prompt_requests_json(self, parser):
        """System prompt should request JSON output."""
        assert "json" in parser.system_prompt.lower()

    def test_parse_uses_system_prompt(self, parser):
        """Parse should include system prompt in inference call."""
        parser.worker = Mock()
        parser.worker.infer.return_value = json.dumps({
            "intent": "test",
            "confidence": 0.9,
            "tools_needed": [],
            "steps": [],
            "distro_hints": [],
            "clarification_needed": False
        })

        parser.parse("test command")

        # Verify that infer was called and the prompt contains system instructions
        call_args = parser.worker.infer.call_args
        prompt = call_args[0][0]
        assert len(prompt) > 0
