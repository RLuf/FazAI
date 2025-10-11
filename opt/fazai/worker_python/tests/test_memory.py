"""
Test suite for Qdrant dual-collection memory system.
Tests both personality preferences and command knowledge collections.

Following TDD methodology: Write tests first, then implement.
"""

import pytest
from datetime import datetime
from typing import List, Dict, Any

from worker_python.memory import MemoryManager


@pytest.fixture
def memory_manager():
    """Create a fresh MemoryManager instance for each test."""
    manager = MemoryManager(host="localhost", port=6333)
    # Clean up collections before each test
    try:
        manager.client.delete_collection("fazai_personality_test")
        manager.client.delete_collection("fazai_knowledge_test")
    except Exception:
        pass

    # Override collection names for testing
    manager.personality_collection = "fazai_personality_test"
    manager.knowledge_collection = "fazai_knowledge_test"

    # Initialize test collections
    manager.initialize_collections()

    yield manager

    # Cleanup after test
    try:
        manager.client.delete_collection("fazai_personality_test")
        manager.client.delete_collection("fazai_knowledge_test")
    except Exception:
        pass


class TestMemoryManagerInit:
    """Test MemoryManager initialization and configuration."""

    def test_manager_creates_client(self, memory_manager):
        """Test that MemoryManager creates Qdrant client."""
        assert memory_manager.client is not None
        assert memory_manager.personality_collection is not None
        assert memory_manager.knowledge_collection is not None

    def test_embedding_model_loads(self, memory_manager):
        """Test that sentence transformer model loads."""
        assert memory_manager.model is not None
        # Test embedding generation
        embedding = memory_manager._generate_embedding("test text")
        assert len(embedding) == 1024  # BAAI/bge-large-en-v1.5 produces 1024-dim vectors
        assert all(isinstance(x, float) for x in embedding)

    def test_collections_created(self, memory_manager):
        """Test that both collections are created on initialization."""
        collections = memory_manager.client.get_collections().collections
        collection_names = [c.name for c in collections]
        assert "fazai_personality_test" in collection_names
        assert "fazai_knowledge_test" in collection_names


class TestPersonalityMemory:
    """Test personality preference storage and retrieval."""

    def test_commit_personality_stores_data(self, memory_manager):
        """Test storing a user preference."""
        result = memory_manager.commit_personality(
            preference="user prefers JSON output",
            context="Requested JSON in last 3 interactions"
        )
        assert result is not None
        assert isinstance(result, str)  # Should return UUID string

    def test_search_personality_finds_similar(self, memory_manager):
        """Test semantic search finds similar preferences."""
        # Store some preferences
        memory_manager.commit_personality(
            preference="user prefers minimal output",
            context="User says 'keep it short'"
        )
        memory_manager.commit_personality(
            preference="user likes detailed explanations",
            context="User says 'explain in detail'"
        )

        # Search for similar preference
        results = memory_manager.search_personality(
            query="output format preference",
            limit=5
        )

        assert len(results) > 0
        assert "preference" in results[0]
        assert "score" in results[0]
        assert results[0]["score"] > 0.0

    def test_personality_usage_count_increments(self, memory_manager):
        """Test that usage_count increments when preference is retrieved."""
        # Store preference
        memory_manager.commit_personality(
            preference="user prefers verbose mode",
            context="Multiple requests for details"
        )

        # Search multiple times
        for _ in range(3):
            memory_manager.search_personality(
                query="verbose output preference",
                limit=1
            )

        # Usage count should increment
        results = memory_manager.search_personality(
            query="verbose output",
            limit=1
        )
        # Initial implementation may not have usage_count yet
        # Test will pass once implemented
        assert results[0]["usage_count"] >= 1

    def test_personality_similarity_threshold(self, memory_manager):
        """Test that low-similarity results are filtered out."""
        memory_manager.commit_personality(
            preference="user prefers dark mode",
            context="UI preference"
        )

        # Search for completely unrelated topic
        results = memory_manager.search_personality(
            query="database connection timeout settings",
            limit=5,
            min_score=0.7
        )

        # Should return empty or very few results
        assert all(r["score"] >= 0.7 for r in results)


class TestKnowledgeMemory:
    """Test command solution storage and retrieval."""

    def test_commit_knowledge_stores_solution(self, memory_manager):
        """Test storing a successful command solution."""
        result = memory_manager.commit_knowledge(
            problem="netstat command not found on Ubuntu 24.04",
            solution="apt-get install net-tools",
            distro="debian"
        )
        assert result is not None

    def test_search_knowledge_finds_solutions(self, memory_manager):
        """Test semantic search finds similar problems."""
        # Store some solutions
        memory_manager.commit_knowledge(
            problem="missing netstat command",
            solution="apt-get install net-tools",
            distro="debian"
        )
        memory_manager.commit_knowledge(
            problem="ifconfig not found",
            solution="apt-get install net-tools",
            distro="debian"
        )
        memory_manager.commit_knowledge(
            problem="ss command alternative to netstat",
            solution="ss -tulpn",
            distro="all"
        )

        # Search for similar problem
        results = memory_manager.search_knowledge(
            query="netstat missing on Ubuntu",
            limit=5
        )

        assert len(results) > 0
        assert "problem" in results[0]
        assert "solution" in results[0]
        assert "score" in results[0]
        assert results[0]["score"] > 0.5

    def test_knowledge_distro_filtering(self, memory_manager):
        """Test filtering solutions by Linux distribution."""
        # Store distro-specific solutions
        memory_manager.commit_knowledge(
            problem="install nginx",
            solution="apt-get install nginx",
            distro="debian"
        )
        memory_manager.commit_knowledge(
            problem="install nginx",
            solution="yum install nginx",
            distro="rhel"
        )
        memory_manager.commit_knowledge(
            problem="install nginx",
            solution="pacman -S nginx",
            distro="arch"
        )

        # Search with distro filter
        results = memory_manager.search_knowledge(
            query="how to install nginx",
            distro="debian",
            limit=5
        )

        assert len(results) > 0
        # Should prioritize or filter to debian
        debian_results = [r for r in results if r["distro"] == "debian"]
        assert len(debian_results) > 0

    def test_knowledge_success_rate_tracking(self, memory_manager):
        """Test that success rate is tracked and updated."""
        # Store solution
        solution_id = memory_manager.commit_knowledge(
            problem="fix broken package",
            solution="apt-get install -f",
            distro="debian",
            success_rate=1.0
        )

        # Retrieve it
        results = memory_manager.search_knowledge(
            query="broken package fix",
            limit=1
        )

        assert len(results) > 0
        assert "success_rate" in results[0]
        assert 0.0 <= results[0]["success_rate"] <= 1.0

    def test_knowledge_usage_count(self, memory_manager):
        """Test that usage count tracks retrievals."""
        memory_manager.commit_knowledge(
            problem="systemctl restart service",
            solution="systemctl restart service_name",
            distro="all"
        )

        # Search multiple times
        for _ in range(5):
            memory_manager.search_knowledge(
                query="restart systemd service",
                limit=1
            )

        results = memory_manager.search_knowledge(
            query="restart service",
            limit=1
        )

        assert results[0]["usage_count"] >= 1


class TestEmbeddingGeneration:
    """Test embedding generation functionality."""

    def test_embedding_consistency(self, memory_manager):
        """Test that same text produces same embedding."""
        text = "test embedding consistency"
        emb1 = memory_manager._generate_embedding(text)
        emb2 = memory_manager._generate_embedding(text)

        assert emb1 == emb2

    def test_embedding_dimensions(self, memory_manager):
        """Test embedding has correct dimensions."""
        embedding = memory_manager._generate_embedding("test")
        assert len(embedding) == 1024

    def test_embedding_performance(self, memory_manager):
        """Test embedding generation is fast (<50ms)."""
        import time

        start = time.time()
        memory_manager._generate_embedding("performance test text")
        duration = time.time() - start

        assert duration < 0.05  # 50ms


class TestEdgeCases:
    """Test edge cases and error handling."""

    def test_empty_search_query(self, memory_manager):
        """Test searching with empty query."""
        results = memory_manager.search_knowledge(query="", limit=5)
        assert isinstance(results, list)

    def test_large_limit(self, memory_manager):
        """Test searching with very large limit."""
        results = memory_manager.search_knowledge(
            query="test",
            limit=10000
        )
        assert isinstance(results, list)

    def test_search_empty_collection(self, memory_manager):
        """Test searching empty collection returns empty list."""
        results = memory_manager.search_personality(
            query="nonexistent preference",
            limit=5
        )
        assert results == []

    def test_commit_with_special_characters(self, memory_manager):
        """Test storing data with special characters."""
        result = memory_manager.commit_knowledge(
            problem="fix error: 'module' not found",
            solution='pip install "module>=1.0"',
            distro="all"
        )
        assert result is not None

        # Verify retrieval works
        results = memory_manager.search_knowledge(
            query="module not found error",
            limit=1
        )
        assert len(results) > 0


class TestPerformance:
    """Test performance requirements."""

    def test_storage_performance(self, memory_manager):
        """Test storage operation completes in <100ms."""
        import time

        start = time.time()
        memory_manager.commit_knowledge(
            problem="test problem",
            solution="test solution",
            distro="all"
        )
        duration = time.time() - start

        assert duration < 0.1  # 100ms

    def test_search_performance(self, memory_manager):
        """Test search completes in <200ms."""
        import time

        # Add some data first
        for i in range(10):
            memory_manager.commit_knowledge(
                problem=f"problem {i}",
                solution=f"solution {i}",
                distro="all"
            )

        start = time.time()
        results = memory_manager.search_knowledge(
            query="problem solution",
            limit=5
        )
        duration = time.time() - start

        assert duration < 0.2  # 200ms
