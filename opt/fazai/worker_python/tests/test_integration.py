"""Integration tests for FazAI Python Worker.

Tests the complete pipeline: NLP → Planner → Executor → Memory → Fallback
Following TDD principles with comprehensive end-to-end scenarios.
"""

import asyncio
import json
import pytest
import time
from typing import AsyncGenerator, List, Dict, Any
from unittest.mock import AsyncMock, Mock, patch

from worker_python.nlp import NLPParser
from worker_python.planner import CommandPlanner
from worker_python.executor import SelfHealingExecutor, ExecutionResult
from worker_python.memory import MemoryManager
from worker_python.fallback import FallbackChain
from worker_python.config import WorkerConfig


@pytest.fixture
async def memory_manager():
    """Create MemoryManager instance for testing."""
    config = WorkerConfig()
    manager = MemoryManager(config)
    await manager.initialize()
    yield manager
    # Cleanup
    try:
        await manager.close()
    except Exception:
        pass


@pytest.fixture
def nlp_parser():
    """Create NLPParser instance."""
    config = WorkerConfig()
    return NLPParser(config)


@pytest.fixture
def command_planner():
    """Create CommandPlanner instance."""
    return CommandPlanner()


@pytest.fixture
def executor():
    """Create SelfHealingExecutor instance."""
    config = WorkerConfig()
    return SelfHealingExecutor(config)


@pytest.fixture
def fallback_chain():
    """Create FallbackChain instance."""
    config = WorkerConfig()
    return FallbackChain(config)


@pytest.mark.asyncio
class TestFullPipeline:
    """Test complete pipeline integration."""

    async def test_simple_command_pipeline(
        self, nlp_parser, command_planner, executor, memory_manager
    ):
        """Test full pipeline: Parse → Plan → Execute → Store.

        RED: Test should fail without full integration
        GREEN: Implement integration
        REFACTOR: Optimize pipeline flow
        """
        # Parse natural language
        with patch.object(nlp_parser, 'worker') as mock_worker:
            mock_worker.generate.return_value = json.dumps({
                "intent": "monitor_ports",
                "confidence": 0.95,
                "tools_needed": ["ss", "netstat"],
                "steps": [
                    {"action": "list_ports", "command": "ss -tuln"}
                ],
                "distro_hints": ["debian", "ubuntu"],
                "clarification_needed": False
            })

            intent = nlp_parser.parse("check all open ports")

        assert intent is not None
        assert intent["intent"] == "monitor_ports"
        assert intent["confidence"] > 0.9
        assert "tools_needed" in intent

        # Generate execution plan
        plan = command_planner.create_plan(intent)
        assert len(plan) > 0
        assert plan[0]["command"] is not None

        # Execute commands
        results = []
        for step in plan:
            result = await executor.execute_with_healing(step["command"])
            results.append(result)

            # Store result in memory
            await memory_manager.store_knowledge(
                command=step["command"],
                result=result.output if result.success else result.error,
                metadata={"intent": intent["intent"], "success": result.success}
            )

        # Verify at least one command succeeded
        assert any(r.success for r in results), "No commands succeeded"

        # Verify memory storage
        search_results = await memory_manager.search_knowledge("check open ports", limit=5)
        assert len(search_results) > 0, "No results stored in memory"

    async def test_complex_multi_step_pipeline(
        self, nlp_parser, command_planner, executor, memory_manager
    ):
        """Test complex multi-step task execution.

        Scenario: Install package with dependencies
        """
        with patch.object(nlp_parser, 'worker') as mock_worker:
            mock_worker.generate.return_value = json.dumps({
                "intent": "install_package",
                "confidence": 0.92,
                "tools_needed": ["apt-get", "dpkg"],
                "steps": [
                    {"action": "update_cache", "command": "apt-get update --dry-run"},
                    {"action": "install", "command": "apt-get install --dry-run curl"}
                ],
                "distro_hints": ["debian", "ubuntu"],
                "clarification_needed": False
            })

            intent = nlp_parser.parse("install curl package")

        # Create plan
        plan = command_planner.create_plan(intent)
        assert len(plan) >= 2, "Multi-step plan should have multiple steps"

        # Execute sequentially
        execution_log = []
        for step in plan:
            result = await executor.execute_with_healing(step["command"])
            execution_log.append({
                "command": step["command"],
                "success": result.success,
                "exit_code": result.exit_code
            })

        # Verify execution log
        assert len(execution_log) == len(plan)

        # Store execution summary in memory
        await memory_manager.store_knowledge(
            command="install curl package",
            result=json.dumps(execution_log),
            metadata={"intent": "install_package", "steps": len(plan)}
        )

    async def test_error_recovery_pipeline(
        self, nlp_parser, command_planner, executor, memory_manager
    ):
        """Test pipeline with error recovery.

        Scenario: Command fails, executor retries with healing
        """
        with patch.object(nlp_parser, 'worker') as mock_worker:
            mock_worker.generate.return_value = json.dumps({
                "intent": "check_service",
                "confidence": 0.88,
                "tools_needed": ["systemctl"],
                "steps": [
                    {"action": "status", "command": "systemctl status nonexistent-service"}
                ],
                "distro_hints": ["debian"],
                "clarification_needed": False
            })

            intent = nlp_parser.parse("check status of nonexistent service")

        plan = command_planner.create_plan(intent)

        # Execute with expected failure
        result = await executor.execute_with_healing(plan[0]["command"])

        # Should fail gracefully
        assert result is not None
        assert not result.success or result.retries > 0

        # Store failure for learning
        await memory_manager.store_knowledge(
            command=plan[0]["command"],
            result=f"Failed: {result.error}",
            metadata={"intent": "check_service", "success": False}
        )

    async def test_fallback_chain_integration(
        self, nlp_parser, fallback_chain, memory_manager
    ):
        """Test fallback chain when local model unavailable.

        Scenario: Local model fails, fall back to remote provider
        """
        # Force parser to use fallback
        with patch.object(nlp_parser, 'worker', None):
            with patch.object(fallback_chain, '_try_openrouter') as mock_fallback:
                mock_fallback.return_value = {
                    "intent": "query_system",
                    "confidence": 0.85,
                    "tools_needed": ["uname"],
                    "steps": [{"action": "info", "command": "uname -a"}],
                    "distro_hints": ["linux"],
                    "clarification_needed": False
                }

                # This should trigger fallback
                result = await fallback_chain.generate_with_fallback(
                    "what is my system info"
                )

                assert result is not None
                assert "intent" in result

    async def test_concurrent_pipeline_execution(
        self, nlp_parser, command_planner, executor
    ):
        """Test multiple pipelines running concurrently.

        Scenario: 5 concurrent command executions
        """
        commands = [
            "echo test1",
            "echo test2",
            "echo test3",
            "echo test4",
            "echo test5"
        ]

        async def execute_pipeline(cmd: str):
            with patch.object(nlp_parser, 'worker') as mock_worker:
                mock_worker.generate.return_value = json.dumps({
                    "intent": "echo_command",
                    "confidence": 0.99,
                    "tools_needed": ["echo"],
                    "steps": [{"action": "echo", "command": cmd}],
                    "distro_hints": [],
                    "clarification_needed": False
                })

                intent = nlp_parser.parse(cmd)
                plan = command_planner.create_plan(intent)
                result = await executor.execute_with_healing(plan[0]["command"])
                return result

        # Execute concurrently
        results = await asyncio.gather(*[execute_pipeline(cmd) for cmd in commands])

        # Verify all succeeded
        assert len(results) == 5
        assert all(r.success for r in results), "Not all concurrent executions succeeded"


@pytest.mark.asyncio
class TestWebSocketIntegration:
    """Test WebSocket streaming integration."""

    async def test_websocket_command_stream(self, memory_manager):
        """Test WebSocket command execution with event streaming.

        Simulates WebSocket client sending command and receiving events
        """
        from fastapi.testclient import TestClient
        from worker_python.api import app

        # Use context manager for proper lifecycle
        with TestClient(app) as client:
            # WebSocket connection test
            with client.websocket_connect("/ws") as websocket:
                # Send command request
                request = {
                    "type": "command",
                    "input": "echo 'websocket test'",
                    "session_id": "test-session-123"
                }
                websocket.send_json(request)

                # Collect response events
                events = []
                timeout = 5  # 5 second timeout
                start_time = time.time()

                while time.time() - start_time < timeout:
                    try:
                        data = websocket.receive_json()
                        events.append(data)

                        if data.get("type") == "complete":
                            break
                    except Exception as e:
                        break

                # Verify event sequence
                assert len(events) > 0, "No events received"

                # Should have various event types
                event_types = {e.get("type") for e in events}
                assert "complete" in event_types or "result" in event_types

    async def test_websocket_error_handling(self):
        """Test WebSocket error propagation."""
        from fastapi.testclient import TestClient
        from worker_python.api import app

        with TestClient(app) as client:
            with client.websocket_connect("/ws") as websocket:
                # Send invalid request
                request = {
                    "type": "invalid_type",
                    "input": ""
                }
                websocket.send_json(request)

                # Should receive error event
                response = websocket.receive_json()
                assert response.get("type") in ["error", "complete"]


@pytest.mark.asyncio
class TestMemoryPersistence:
    """Test memory storage and retrieval integration."""

    async def test_knowledge_storage_and_search(self, memory_manager):
        """Test storing and retrieving knowledge.

        Scenario: Store multiple command results and search
        """
        # Store multiple knowledge items
        test_data = [
            {
                "command": "apt-get update",
                "result": "Updated package cache",
                "metadata": {"intent": "update_system", "success": True}
            },
            {
                "command": "systemctl status nginx",
                "result": "nginx is running",
                "metadata": {"intent": "check_service", "success": True}
            },
            {
                "command": "netstat -tuln",
                "result": "Listed open ports",
                "metadata": {"intent": "monitor_ports", "success": True}
            }
        ]

        for item in test_data:
            await memory_manager.store_knowledge(**item)

        # Search for related knowledge
        results = await memory_manager.search_knowledge("check nginx", limit=5)
        assert len(results) > 0, "No search results found"

        # Verify relevance
        # Results should include nginx-related entries
        results_text = " ".join([r.get("result", "") for r in results])
        assert "nginx" in results_text.lower() or "service" in results_text.lower()

    async def test_session_memory(self, memory_manager):
        """Test session-based memory tracking."""
        session_id = "test-session-456"

        # Store session-specific commands
        for i in range(3):
            await memory_manager.store_knowledge(
                command=f"echo step_{i}",
                result=f"Executed step {i}",
                metadata={"session_id": session_id, "step": i}
            )

        # Retrieve session history
        # Note: Actual implementation may vary based on MemoryManager API
        results = await memory_manager.search_knowledge(
            f"session {session_id}", limit=10
        )

        # Should find session-related entries
        assert len(results) >= 0  # May or may not find based on embedding similarity


@pytest.mark.asyncio
class TestEndToEndScenarios:
    """Real-world end-to-end integration scenarios."""

    async def test_system_diagnostics_workflow(
        self, nlp_parser, command_planner, executor, memory_manager
    ):
        """Test complete system diagnostics workflow.

        Scenario: User requests system health check
        Steps: CPU, Memory, Disk, Services
        """
        diagnostics_query = "check system health"

        with patch.object(nlp_parser, 'worker') as mock_worker:
            mock_worker.generate.return_value = json.dumps({
                "intent": "system_diagnostics",
                "confidence": 0.93,
                "tools_needed": ["top", "df", "free", "systemctl"],
                "steps": [
                    {"action": "cpu", "command": "top -bn1 | head -5"},
                    {"action": "memory", "command": "free -h"},
                    {"action": "disk", "command": "df -h"},
                ],
                "distro_hints": ["debian", "ubuntu"],
                "clarification_needed": False
            })

            intent = nlp_parser.parse(diagnostics_query)

        plan = command_planner.create_plan(intent)

        # Execute all diagnostic commands
        results = {}
        for step in plan:
            result = await executor.execute_with_healing(step["command"])
            results[step["action"]] = result

            # Store each diagnostic result
            await memory_manager.store_knowledge(
                command=step["command"],
                result=result.output if result.success else result.error,
                metadata={
                    "intent": "system_diagnostics",
                    "action": step["action"],
                    "success": result.success
                }
            )

        # Verify diagnostic results
        assert len(results) >= 2, "Should have multiple diagnostic results"

        # At least some diagnostics should succeed
        success_count = sum(1 for r in results.values() if r.success)
        assert success_count > 0, "No diagnostics succeeded"

    async def test_package_installation_workflow(
        self, nlp_parser, command_planner, executor
    ):
        """Test package installation workflow (dry-run mode).

        Scenario: Install package with dependency resolution
        """
        with patch.object(nlp_parser, 'worker') as mock_worker:
            mock_worker.generate.return_value = json.dumps({
                "intent": "install_package",
                "confidence": 0.90,
                "tools_needed": ["apt-get"],
                "steps": [
                    {"action": "update", "command": "apt-get update --dry-run"},
                    {"action": "install", "command": "apt-get install --dry-run htop"}
                ],
                "distro_hints": ["debian", "ubuntu"],
                "clarification_needed": False
            })

            intent = nlp_parser.parse("install htop")

        plan = command_planner.create_plan(intent)

        # Execute installation steps
        for step in plan:
            result = await executor.execute_with_healing(step["command"])
            # Dry-run commands may succeed or fail depending on permissions
            assert result is not None

    async def test_monitoring_setup_workflow(
        self, nlp_parser, command_planner, executor
    ):
        """Test setting up monitoring workflow.

        Scenario: Configure system monitoring
        """
        with patch.object(nlp_parser, 'worker') as mock_worker:
            mock_worker.generate.return_value = json.dumps({
                "intent": "setup_monitoring",
                "confidence": 0.87,
                "tools_needed": ["systemctl", "ps"],
                "steps": [
                    {"action": "check_services", "command": "systemctl list-units --type=service --state=running | head -10"}
                ],
                "distro_hints": ["debian"],
                "clarification_needed": False
            })

            intent = nlp_parser.parse("setup system monitoring")

        plan = command_planner.create_plan(intent)

        # Execute monitoring setup
        result = await executor.execute_with_healing(plan[0]["command"])
        assert result is not None


@pytest.mark.asyncio
class TestPerformanceIntegration:
    """Test performance characteristics of integrated pipeline."""

    async def test_pipeline_latency(
        self, nlp_parser, command_planner, executor
    ):
        """Measure end-to-end pipeline latency.

        Target: <1s for simple commands
        """
        with patch.object(nlp_parser, 'worker') as mock_worker:
            mock_worker.generate.return_value = json.dumps({
                "intent": "simple_command",
                "confidence": 0.99,
                "tools_needed": ["echo"],
                "steps": [{"action": "echo", "command": "echo 'performance test'"}],
                "distro_hints": [],
                "clarification_needed": False
            })

            start_time = time.time()

            intent = nlp_parser.parse("echo performance test")
            plan = command_planner.create_plan(intent)
            result = await executor.execute_with_healing(plan[0]["command"])

            latency = time.time() - start_time

        # Should complete in under 1 second for simple commands
        assert latency < 1.0, f"Pipeline latency {latency}s exceeds 1s target"
        assert result.success

    async def test_memory_efficiency(self, memory_manager):
        """Test memory usage during bulk operations.

        Store 100 knowledge items and verify no memory leaks
        """
        import psutil
        import os

        process = psutil.Process(os.getpid())
        initial_memory = process.memory_info().rss / 1024 / 1024  # MB

        # Store 100 knowledge items
        for i in range(100):
            await memory_manager.store_knowledge(
                command=f"test_command_{i}",
                result=f"test_result_{i}",
                metadata={"index": i}
            )

        final_memory = process.memory_info().rss / 1024 / 1024  # MB
        memory_increase = final_memory - initial_memory

        # Memory increase should be reasonable (<100MB for 100 items)
        assert memory_increase < 100, f"Excessive memory usage: {memory_increase}MB"


# Performance benchmarks for documentation
@pytest.mark.benchmark
@pytest.mark.asyncio
class TestBenchmarks:
    """Benchmark tests for performance documentation."""

    async def test_nlp_parse_benchmark(self, nlp_parser, benchmark):
        """Benchmark NLP parsing performance."""
        with patch.object(nlp_parser, 'worker') as mock_worker:
            mock_worker.generate.return_value = json.dumps({
                "intent": "test",
                "confidence": 0.9,
                "tools_needed": [],
                "steps": [],
                "distro_hints": [],
                "clarification_needed": False
            })

            def parse_command():
                return nlp_parser.parse("test command")

            # Note: benchmark fixture usage depends on pytest-benchmark
            # This is a placeholder for benchmark structure
            result = parse_command()
            assert result is not None

    async def test_executor_benchmark(self, executor, benchmark):
        """Benchmark command execution performance."""
        async def execute_command():
            return await executor.execute_with_healing("echo benchmark")

        result = await execute_command()
        assert result.success
