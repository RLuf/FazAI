"""Command Planner for FazAI worker.

Converts structured intents into executable command sequences with
distribution-aware command generation and safety validation.
"""

import logging
import platform
import re
from typing import Dict, Any, List, Optional


logger = logging.getLogger(__name__)


# Dangerous command patterns to flag
DANGEROUS_PATTERNS = [
    r"rm\s+-rf\s+/",  # Recursive delete from root
    r"dd\s+if=/dev/(zero|random)\s+of=/dev/(sd|hd|nvme)",  # Disk wipe
    r"chmod\s+-R\s+777\s+/",  # Overly permissive permissions on root
    r":\(\)\s*\{.*:\|:&\s*\};:",  # Fork bomb
    r"mkfs\.",  # Format filesystem
    r"fdisk|parted.*delete",  # Partition manipulation
    r"kill\s+-9\s+1",  # Kill init
    r">\s*/dev/sd",  # Direct write to disk
]


# Distribution-specific package managers
PACKAGE_MANAGERS = {
    "debian": "apt-get",
    "ubuntu": "apt-get",
    "mint": "apt-get",
    "kali": "apt-get",
    "rhel": "yum",
    "centos": "yum",
    "fedora": "dnf",
    "rocky": "dnf",
    "alma": "dnf",
    "arch": "pacman",
    "manjaro": "pacman",
    "opensuse": "zypper",
    "sles": "zypper",
    "alpine": "apk",
}


class CommandPlanner:
    """Command Planner for converting intents to executable command sequences."""

    def __init__(self):
        """Initialize the CommandPlanner."""
        self.current_distro = self.detect_distro()
        logger.info(f"CommandPlanner initialized for distro: {self.current_distro}")

    def detect_distro(self) -> str:
        """Detect the current Linux distribution.

        Returns:
            Distribution ID (e.g., 'ubuntu', 'debian', 'rhel')
        """
        try:
            # Try modern way first
            os_release = platform.freedesktop_os_release()
            distro_id = os_release.get("ID", "unknown").lower()
            logger.debug(f"Detected distribution: {distro_id}")
            return distro_id
        except (AttributeError, OSError):
            # Fallback for older Python versions or non-systemd systems
            try:
                with open("/etc/os-release", "r") as f:
                    for line in f:
                        if line.startswith("ID="):
                            distro_id = line.split("=")[1].strip().strip('"').lower()
                            logger.debug(
                                f"Detected distribution (fallback): {distro_id}"
                            )
                            return distro_id
            except FileNotFoundError:
                logger.warning("Could not detect distribution, defaulting to 'unknown'")
                return "unknown"

        return "unknown"

    def create_plan(
        self,
        intent: Dict[str, Any],
        check_dependencies: bool = False,
        include_metadata: bool = False,
        dry_run: bool = False,
    ) -> List[Dict[str, Any]]:
        """Create executable plan from intent.

        Args:
            intent: Structured intent from NLPParser
            check_dependencies: Add dependency check steps
            include_metadata: Include execution metadata
            dry_run: Create plan without executing

        Returns:
            List of command steps with structure:
                - step: Step number (1-indexed)
                - command: Executable command
                - description: Human-readable description
                - metadata: Optional execution metadata

        Raises:
            ValueError: If intent is None or missing required fields
            KeyError: If intent missing required keys
        """
        if intent is None:
            raise ValueError("Intent cannot be None")

        # Validate required fields
        required_fields = [
            "intent",
            "confidence",
            "tools_needed",
            "steps",
            "clarification_needed",
        ]
        for field in required_fields:
            if field not in intent:
                raise KeyError(f"Intent missing required field: {field}")

        # Handle empty or unclear intents
        if not intent["steps"] or intent["clarification_needed"]:
            logger.warning("Intent has no steps or needs clarification")
            return []

        plan = []
        step_number = 1

        # Add dependency checks if requested
        if check_dependencies and intent.get("tools_needed"):
            dep_step = self._create_dependency_check_step(intent["tools_needed"])
            if dep_step:
                dep_step["step"] = step_number
                plan.append(dep_step)
                step_number += 1

        # Convert intent steps to plan steps
        for intent_step in intent["steps"]:
            action = intent_step.get("action", "unknown_action")
            command = intent_step.get("command", "")

            if not command:
                continue

            # Adapt command for current distro if needed
            adapted_command = self.adapt_command(
                command,
                (
                    intent.get("distro_hints", [self.current_distro])[0]
                    if intent.get("distro_hints")
                    else self.current_distro
                ),
            )

            plan_step = {
                "step": step_number,
                "command": adapted_command,
                "description": self._humanize_action(action),
            }

            # Add metadata if requested
            if include_metadata:
                plan_step["metadata"] = {
                    "original_action": action,
                    "distro": self.current_distro,
                    "dry_run": dry_run,
                }

            plan.append(plan_step)
            step_number += 1

        logger.info(
            f"Created plan with {len(plan)} steps for intent: {intent['intent']}"
        )
        return plan

    def adapt_command(self, command: str, target_distro: str) -> str:
        """Adapt command for target distribution.

        Args:
            command: Original command
            target_distro: Target distribution ID

        Returns:
            Adapted command for target distro
        """
        # Handle package installation commands
        if "install" in command.lower():
            # Extract package name
            match = re.search(r"install\s+([a-zA-Z0-9_-]+)", command, re.IGNORECASE)
            if match:
                package = match.group(1)
                pkg_mgr = PACKAGE_MANAGERS.get(target_distro, "apt-get")

                if pkg_mgr == "apt-get":
                    return f"apt-get install -y {package}"
                elif pkg_mgr in ("yum", "dnf"):
                    return f"{pkg_mgr} install -y {package}"
                elif pkg_mgr == "pacman":
                    return f"pacman -S --noconfirm {package}"
                elif pkg_mgr == "zypper":
                    return f"zypper install -y {package}"
                elif pkg_mgr == "apk":
                    return f"apk add {package}"

        # Return original command if no adaptation needed
        return command

    def is_command_safe(self, command: str) -> bool:
        """Check if command is safe to execute.

        Args:
            command: Command to validate

        Returns:
            True if safe, False if potentially dangerous
        """
        # Check against dangerous patterns
        for pattern in DANGEROUS_PATTERNS:
            if re.search(pattern, command, re.IGNORECASE):
                logger.warning(f"Dangerous command detected: {command}")
                return False

        # Additional safety checks
        dangerous_keywords = ["format", "mkfs", ":(){", "dev/sd", "dev/hd", "dev/nvme"]

        command_lower = command.lower()
        for keyword in dangerous_keywords:
            if keyword in command_lower:
                # Check context - some uses are safe
                if keyword == "format" and "date" not in command_lower:
                    logger.warning(
                        f"Potentially dangerous keyword: {keyword} in {command}"
                    )
                    return False

        return True

    def _create_dependency_check_step(
        self, tools_needed: List[str]
    ) -> Optional[Dict[str, Any]]:
        """Create a step to check for required tools.

        Args:
            tools_needed: List of required tools

        Returns:
            Dependency check step or None if no tools needed
        """
        if not tools_needed:
            return None

        # Create command to check for tools
        check_commands = []
        for tool in tools_needed:
            # Skip generic package names, focus on actual commands
            if tool in ("net-tools", "iptables-persistent"):
                continue
            check_commands.append(f"command -v {tool}")

        if not check_commands:
            return None

        return {
            "command": " && ".join(check_commands),
            "description": f"Check for required tools: {', '.join(tools_needed)}",
        }

    def _humanize_action(self, action: str) -> str:
        """Convert action name to human-readable description.

        Args:
            action: Action identifier (e.g., 'check_listening_ports')

        Returns:
            Human-readable description
        """
        # Replace underscores with spaces and capitalize
        words = action.replace("_", " ").split()
        return " ".join(word.capitalize() for word in words)
