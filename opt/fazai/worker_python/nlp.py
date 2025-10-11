"""Natural Language Processing module for FazAI worker.

Converts natural language commands into structured action plans using
local Gemma model inference.
"""

import json
import logging
import re
from typing import Optional, Dict, Any, List, TYPE_CHECKING

from .config import WorkerConfig, ModelConfig, InferenceConfig

if TYPE_CHECKING:
    from .main import GemmaWorker
else:
    # Import for runtime - allows mocking
    try:
        from .main import GemmaWorker
    except ImportError:
        GemmaWorker = None


logger = logging.getLogger(__name__)


# System prompt for intent parsing
SYSTEM_PROMPT = """You are a Linux system administrator AI agent. Parse user commands into structured JSON action plans.

Your role:
- Analyze natural language commands for Linux system administration
- Identify required tools and commands
- Break complex tasks into sequential steps
- Provide distribution-specific hints when relevant
- Flag ambiguous commands for clarification

Output ONLY valid JSON in this exact format:
{
  "intent": "descriptive_intent_name",
  "confidence": 0.0-1.0,
  "tools_needed": ["tool1", "tool2"],
  "steps": [
    {"action": "step_description", "command": "actual_command"}
  ],
  "distro_hints": ["debian", "ubuntu", "rhel"],
  "clarification_needed": false
}

Intent categories:
- monitor_* : Monitoring tasks (ports, processes, logs)
- install_* : Software installation
- configure_* : Configuration changes
- analyze_* : Analysis tasks
- execute_* : Direct command execution
- security_* : Security operations

Rules:
1. Set confidence based on command clarity (clear=0.9+, ambiguous=0.3-0.7)
2. Set clarification_needed=true if confidence < 0.7
3. Use fallback commands (e.g., "netstat || ss" for port checking)
4. Include distro hints for package management differences
5. Order steps logically (gather info → analyze → act)
6. Always output valid JSON, no markdown formatting

Examples:

User: "show me open ports"
{
  "intent": "monitor_network_ports",
  "confidence": 0.95,
  "tools_needed": ["netstat", "ss"],
  "steps": [
    {"action": "check_listening_ports", "command": "netstat -tulpn || ss -tulpn"}
  ],
  "distro_hints": ["debian", "ubuntu", "rhel"],
  "clarification_needed": false
}

User: "check ports and block suspicious traffic"
{
  "intent": "security_port_audit_and_block",
  "confidence": 0.88,
  "tools_needed": ["netstat", "ss", "iptables", "firewalld"],
  "steps": [
    {"action": "list_open_ports", "command": "netstat -tulpn || ss -tulpn"},
    {"action": "check_firewall_status", "command": "iptables -L -v -n || firewall-cmd --list-all"},
    {"action": "identify_suspicious", "command": "# Manual analysis step - review output"}
  ],
  "distro_hints": ["debian", "ubuntu", "rhel", "centos"],
  "clarification_needed": true
}

User: "do something with network"
{
  "intent": "unclear_network_operation",
  "confidence": 0.35,
  "tools_needed": [],
  "steps": [],
  "distro_hints": [],
  "clarification_needed": true
}

Now parse the following command:
"""


class NLPParser:
    """Natural Language Parser for converting user commands to structured intents."""

    def __init__(
        self, model_path: Optional[str] = None, config: Optional[WorkerConfig] = None
    ):
        """Initialize the NLP parser.

        Args:
            model_path: Path to GGUF model file (creates config automatically)
            config: Worker configuration (optional, overrides model_path)
        """
        self.model_path = (
            model_path or "/opt/fazai/models/gemma/gemma-2-2b-it-Q4_K_M.gguf"
        )
        self.system_prompt = SYSTEM_PROMPT
        self.worker: Optional[GemmaWorker] = None

        # Initialize configuration
        if config:
            self.config = config
        else:
            # Create config from model path
            try:
                self.config = WorkerConfig(
                    model=ModelConfig(
                        model_path=self.model_path,
                        n_ctx=2048,
                        n_threads=None,
                        n_gpu_layers=0,
                        verbose=False,
                    ),
                    inference=InferenceConfig(
                        max_tokens=512,  # Shorter for JSON output
                        temperature=0.1,  # Low temperature for structured output
                        top_p=0.95,
                        top_k=40,
                    ),
                )
            except Exception as e:
                # Allow initialization to proceed even if model file doesn't exist
                # (useful for testing)
                logger.warning(
                    f"Failed to create config: {e}. Worker will not be initialized."
                )
                self.config = None

        # Initialize worker if config is available
        if self.config:
            try:
                self._init_worker()
            except Exception as e:
                # Log but don't fail - allows testing with fake paths
                logger.warning(f"Worker initialization failed: {e}")

    def _init_worker(self) -> None:
        """Initialize the GemmaWorker instance."""
        try:
            self.worker = GemmaWorker(self.config)
            logger.info("NLPParser initialized successfully")
        except Exception as e:
            logger.error(f"Failed to initialize GemmaWorker: {e}")
            raise

    def parse(self, user_input: str) -> Dict[str, Any]:
        """Parse natural language input into structured intent.

        Args:
            user_input: Natural language command from user

        Returns:
            Structured intent dictionary with keys:
                - intent: Intent category
                - confidence: Confidence score (0.0-1.0)
                - tools_needed: List of required tools
                - steps: List of action steps
                - distro_hints: Relevant distributions
                - clarification_needed: Whether clarification is needed

        Raises:
            ValueError: If input is None
            RuntimeError: If worker fails
        """
        if user_input is None:
            raise ValueError("Input cannot be None")

        if not user_input.strip():
            # Handle empty input
            return {
                "intent": "empty_command",
                "confidence": 0.0,
                "tools_needed": [],
                "steps": [],
                "distro_hints": [],
                "clarification_needed": True,
            }

        # Construct full prompt
        prompt = f"{self.system_prompt}\nUser: {user_input}\nJSON:"

        try:
            # Run inference
            raw_output = self.worker.infer(
                prompt,
                max_tokens=512,
                temperature=0.1,
                stop=["\n\n", "User:", "<|im_end|>"],
            )

            logger.debug(f"Raw model output: {raw_output[:200]}")

            # Extract and validate JSON
            parsed_intent = self._extract_json(raw_output)

            if not self._validate_plan(parsed_intent):
                logger.warning("Invalid plan structure, using fallback")
                return self._create_fallback_plan(user_input)

            return parsed_intent

        except Exception as e:
            logger.error(f"Parse failed: {e}")
            raise

    def _extract_json(self, raw_output: str) -> Dict[str, Any]:
        """Extract JSON from model output.

        Handles:
        - Clean JSON output
        - Markdown code blocks
        - Malformed JSON with fallback

        Args:
            raw_output: Raw text from model

        Returns:
            Parsed JSON dictionary
        """
        # Try to find JSON in markdown code blocks
        json_match = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", raw_output, re.DOTALL)
        if json_match:
            json_str = json_match.group(1)
        else:
            # Try to find raw JSON
            json_match = re.search(r"\{.*\}", raw_output, re.DOTALL)
            if json_match:
                json_str = json_match.group(0)
            else:
                json_str = raw_output

        try:
            parsed = json.loads(json_str)
            return parsed
        except json.JSONDecodeError as e:
            logger.warning(f"JSON decode failed: {e}. Attempting repair.")

            # Try to repair common issues
            repaired = self._repair_json(json_str)
            try:
                return json.loads(repaired)
            except json.JSONDecodeError:
                # Return minimal fallback
                return {
                    "intent": "parse_error",
                    "confidence": 0.0,
                    "tools_needed": [],
                    "steps": [],
                    "distro_hints": [],
                    "clarification_needed": True,
                }

    def _repair_json(self, json_str: str) -> str:
        """Attempt to repair malformed JSON.

        Args:
            json_str: Potentially malformed JSON string

        Returns:
            Repaired JSON string
        """
        # Fix common issues
        repaired = json_str.strip()

        # Replace single quotes with double quotes
        repaired = repaired.replace("'", '"')

        # Fix boolean values
        repaired = repaired.replace("False", "false").replace("True", "true")

        # Fix None values
        repaired = repaired.replace("None", "null")

        return repaired

    def _validate_plan(self, plan: Dict[str, Any]) -> bool:
        """Validate that plan has required structure.

        Args:
            plan: Parsed plan dictionary

        Returns:
            True if valid, False otherwise
        """
        required_fields = [
            "intent",
            "confidence",
            "tools_needed",
            "steps",
            "distro_hints",
            "clarification_needed",
        ]

        for field in required_fields:
            if field not in plan:
                logger.warning(f"Missing required field: {field}")
                return False

        # Type checks
        if not isinstance(plan["intent"], str):
            return False
        if not isinstance(plan["confidence"], (int, float)):
            return False
        if not isinstance(plan["tools_needed"], list):
            return False
        if not isinstance(plan["steps"], list):
            return False
        if not isinstance(plan["clarification_needed"], bool):
            return False

        return True

    def _create_fallback_plan(self, user_input: str) -> Dict[str, Any]:
        """Create a fallback plan when parsing fails.

        Args:
            user_input: Original user input

        Returns:
            Minimal fallback plan
        """
        return {
            "intent": "fallback_execution",
            "confidence": 0.5,
            "tools_needed": ["bash"],
            "steps": [{"action": "direct_execution", "command": user_input}],
            "distro_hints": [],
            "clarification_needed": True,
        }
