"""Tool Detection and Installation for FazAI Worker.

Detects required tools from intent, checks if installed, and auto-installs
missing packages with distro-aware commands and safety validation.
"""

import asyncio
import logging
from typing import List, Dict, Any, Optional

from pydantic import BaseModel, Field

from .planner import CommandPlanner, PACKAGE_MANAGERS

logger = logging.getLogger(__name__)


# Safe packages that can be auto-installed without confirmation
SAFE_PACKAGES = {
    # Web servers
    "nginx",
    "apache2",
    "httpd",
    # Development tools
    "git",
    "curl",
    "wget",
    "vim",
    "nano",
    "emacs",
    # System utilities
    "htop",
    "tree",
    "jq",
    "tmux",
    "screen",
    "net-tools",
    "netstat",
    "ss",
    "iptables",
    "firewalld",
    # Programming languages
    "python3",
    "python3-pip",
    "nodejs",
    "npm",
    "gcc",
    "make",
    "build-essential",
}

# Dangerous packages that should never be auto-installed
DANGEROUS_PACKAGES = {
    "malware",
    "ransomware",
    "bitcoin-miner",
    "cryptominer",
    "rootkit",
}


class UnsupportedDistro(Exception):
    """Exception raised for unsupported Linux distribution."""

    pass


class DangerousPackage(Exception):
    """Exception raised when attempting to install dangerous package."""

    pass


class InstallationResult(BaseModel):
    """Result of package installation.

    Attributes:
        tool: Package/tool name
        success: Whether installation succeeded
        stdout: Installation output
        stderr: Installation errors
        exit_code: Installation command exit code
    """

    tool: str = Field(description="Package/tool name")
    success: bool = Field(description="Installation success")
    stdout: str = Field(default="", description="Installation output")
    stderr: str = Field(default="", description="Installation errors")
    exit_code: int = Field(default=0, description="Exit code")


class ToolDetector:
    """Detects and installs required tools for command execution."""

    def __init__(self, distro: Optional[str] = None):
        """Initialize ToolDetector.

        Args:
            distro: Linux distribution ID (auto-detected if None)
        """
        if distro:
            self.distro = distro
        else:
            # Auto-detect from CommandPlanner
            planner = CommandPlanner()
            self.distro = planner.detect_distro()

        logger.info(f"ToolDetector initialized for distro: {self.distro}")

    def detect_required_tools(self, intent: Dict[str, Any]) -> List[str]:
        """Extract required tools from intent.

        Args:
            intent: Structured intent from NLPParser

        Returns:
            List of required tool names
        """
        return intent.get("tools_needed", [])

    async def is_installed(self, tool: str) -> bool:
        """Check if tool is installed.

        Args:
            tool: Tool/command name to check

        Returns:
            True if tool is installed, False otherwise
        """
        try:
            # Use 'which' command to check for tool
            process = await asyncio.create_subprocess_exec(
                "which",
                tool,
                stdout=asyncio.subprocess.DEVNULL,
                stderr=asyncio.subprocess.DEVNULL,
            )

            exit_code = await process.wait()
            return exit_code == 0

        except Exception as e:
            logger.debug(f"Error checking if {tool} is installed: {e}")
            return False

    def is_safe_to_install(self, package: str) -> bool:
        """Check if package is safe to auto-install.

        Args:
            package: Package name

        Returns:
            True if safe, False if requires confirmation or dangerous
        """
        # Check dangerous list first
        if package in DANGEROUS_PACKAGES:
            return False

        # Check safe list
        if package in SAFE_PACKAGES:
            return True

        # Unknown package - require manual confirmation
        logger.warning(f"Unknown package '{package}' - requires manual confirmation")
        return False

    def validate_package_safety(self, package: str) -> None:
        """Validate package safety, raise exception if dangerous.

        Args:
            package: Package name to validate

        Raises:
            DangerousPackage: If package is in dangerous list
        """
        if package in DANGEROUS_PACKAGES:
            raise DangerousPackage(f"Refusing to install dangerous package: {package}")

    def get_install_command(
        self,
        tool: str,
        package_map: Optional[Dict[str, str]] = None,
    ) -> str:
        """Generate install command for tool based on distribution.

        Args:
            tool: Tool/package name
            package_map: Optional mapping of tool name to package name

        Returns:
            Install command string

        Raises:
            UnsupportedDistro: If distribution not supported
        """
        # Apply package name mapping if provided
        package = package_map.get(tool, tool) if package_map else tool

        # Get package manager for distro
        pkg_mgr = PACKAGE_MANAGERS.get(self.distro)

        if not pkg_mgr:
            raise UnsupportedDistro(f"Unsupported distribution: {self.distro}")

        # Generate install command based on package manager
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
        else:
            # Fallback to apt-get
            return f"apt-get install -y {package}"

    async def install(
        self,
        tool: str,
        sudo: bool = True,
        package_map: Optional[Dict[str, str]] = None,
    ) -> InstallationResult:
        """Install a tool/package.

        Args:
            tool: Tool/package name to install
            sudo: Whether to use sudo (default: True)
            package_map: Optional package name mapping

        Returns:
            InstallationResult with success status and output

        Raises:
            UnsupportedDistro: If distribution not supported
            DangerousPackage: If package is dangerous
        """
        # Validate safety
        self.validate_package_safety(tool)

        # Get install command
        try:
            install_cmd = self.get_install_command(tool, package_map)
        except UnsupportedDistro as e:
            raise e

        # Build command args
        if sudo:
            cmd_args = ["sudo"] + install_cmd.split()
        else:
            cmd_args = install_cmd.split()

        logger.info(f"Installing {tool} with command: {' '.join(cmd_args)}")

        try:
            # Execute installation
            process = await asyncio.create_subprocess_exec(
                *cmd_args,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )

            stdout, stderr = await process.communicate()
            exit_code = await process.wait()

            success = exit_code == 0

            result = InstallationResult(
                tool=tool,
                success=success,
                stdout=stdout.decode("utf-8", errors="replace"),
                stderr=stderr.decode("utf-8", errors="replace"),
                exit_code=exit_code,
            )

            if success:
                logger.info(f"Successfully installed {tool}")
            else:
                logger.error(
                    f"Failed to install {tool} (exit code {exit_code}): {result.stderr[:200]}"
                )

            return result

        except Exception as e:
            logger.error(f"Exception during installation of {tool}: {e}")
            return InstallationResult(
                tool=tool,
                success=False,
                stderr=str(e),
                exit_code=1,
            )

    async def install_multiple(
        self,
        tools: List[str],
        sudo: bool = True,
        package_map: Optional[Dict[str, str]] = None,
    ) -> List[InstallationResult]:
        """Install multiple tools sequentially.

        Args:
            tools: List of tool names to install
            sudo: Whether to use sudo
            package_map: Optional package name mapping

        Returns:
            List of InstallationResult for each tool
        """
        results = []

        for tool in tools:
            try:
                result = await self.install(tool, sudo=sudo, package_map=package_map)
                results.append(result)
            except (UnsupportedDistro, DangerousPackage) as e:
                # Log error and continue with next tool
                logger.error(f"Cannot install {tool}: {e}")
                results.append(
                    InstallationResult(
                        tool=tool,
                        success=False,
                        stderr=str(e),
                        exit_code=1,
                    )
                )

        return results

    async def check_and_install_missing(
        self,
        tools: List[str],
        auto_install: bool = True,
    ) -> Dict[str, bool]:
        """Check which tools are missing and optionally install them.

        Args:
            tools: List of tools to check
            auto_install: Whether to auto-install missing safe packages

        Returns:
            Dictionary mapping tool name to installation status
        """
        status = {}

        for tool in tools:
            # Check if already installed
            if await self.is_installed(tool):
                status[tool] = True
                logger.debug(f"Tool {tool} is already installed")
                continue

            # Tool is missing
            logger.info(f"Tool {tool} is not installed")

            if auto_install and self.is_safe_to_install(tool):
                # Auto-install safe package
                try:
                    result = await self.install(tool)
                    status[tool] = result.success
                except Exception as e:
                    logger.error(f"Failed to install {tool}: {e}")
                    status[tool] = False
            else:
                # Don't auto-install (unsafe or auto_install=False)
                status[tool] = False

        return status
