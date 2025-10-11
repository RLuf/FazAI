#!/usr/bin/env python3
"""
Test suite for QdrantMemoryManager - TDD approach
Tests dual-collection memory system for FazAI
"""

import pytest
import asyncio
from unittest.mock import Mock, patch, MagicMock
from datetime import datetime
from typing import List, Dict


# Import the module we'll create
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

try:
    from memory import QdrantMemoryManager, EmbeddingGenerator
except ImportError:
    # Module doesn't exist yet - this is expected in TDD RED phase
    QdrantMemoryManager = None
    EmbeddingGenerator = None


class TestQdrantConnection:
    """Test Qdrant client connection and initialization"""

    def test_connect_to_qdrant_localhost(self):
        """Test connection to local Qdrant instance"""
        if QdrantMemoryManager is None:
            pytest.skip("QdrantMemoryManager not implemented yet")

        manager = QdrantMemoryManager(host="localhost", port=6333)
        assert manager is not None
        assert manager.client is not None

    def test_connect_to_qdrant_custom_host(self):
        """Test connection to custom Qdrant host"""
        if QdrantMemoryManager is None:
            pytest.skip("QdrantMemoryManager not implemented yet")

        manager = QdrantMemoryManager(host="127.0.0.1", port=6333)
        assert manager.client is not None

    def test_graceful_degradation_qdrant_offline(self):
        """Test graceful handling when Qdrant is offline"""
        if QdrantMemoryManager is None:
            pytest.skip("QdrantMemoryManager not implemented yet")

        # Try to connect to non-existent Qdrant instance
        manager = QdrantMemoryManager(host="localhost", port=9999)

        # Should not raise exception, but set client to None
        assert manager.offline_mode is True
        assert manager.client is None or not manager.is_available()


class TestCollectionCreation:
    """Test dual collection creation and management"""

    def test_create_personality_collection(self):
        """Test fazai_personality collection creation"""
        if QdrantMemoryManager is None:
            pytest.skip("QdrantMemoryManager not implemented yet")

        manager = QdrantMemoryManager()

        # Check collection exists
        collections = manager.list_collections()
        assert "fazai_personality" in collections

    def test_create_knowledge_collection(self):
        """Test fazai_knowledge collection creation"""
        if QdrantMemoryManager is None:
            pytest.skip("QdrantMemoryManager not implemented yet")

        manager = QdrantMemoryManager()

        # Check collection exists
        collections = manager.list_collections()
        assert "fazai_knowledge" in collections

    def test_collection_vector_dimensions(self):
        """Test collections use 384-dimensional vectors"""
        if QdrantMemoryManager is None:
            pytest.skip("QdrantMemoryManager not implemented yet")

        manager = QdrantMemoryManager()

        # Check vector size for both collections
        personality_info = manager.get_collection_info("fazai_personality")
        knowledge_info = manager.get_collection_info("fazai_knowledge")

        assert personality_info["vector_size"] == 384
        assert knowledge_info["vector_size"] == 384


class TestEmbeddingGeneration:
    """Test embedding generation with sentence-transformers"""

    def test_embedding_generator_initialization(self):
        """Test EmbeddingGenerator loads model correctly"""
        if EmbeddingGenerator is None:
            pytest.skip("EmbeddingGenerator not implemented yet")

        generator = EmbeddingGenerator(model_name="all-MiniLM-L6-v2")
        assert generator is not None
        assert generator.model is not None

    def test_generate_384_dim_embedding(self):
        """Test embedding generation produces 384-dimensional vectors"""
        if EmbeddingGenerator is None:
            pytest.skip("EmbeddingGenerator not implemented yet")

        generator = EmbeddingGenerator(model_name="all-MiniLM-L6-v2")

        text = "netstat command not found"
        embedding = generator.encode(text)

        assert isinstance(embedding, list)
        assert len(embedding) == 384
        assert all(isinstance(x, float) for x in embedding)

    def test_embedding_deterministic(self):
        """Test same text produces same embedding"""
        if EmbeddingGenerator is None:
            pytest.skip("EmbeddingGenerator not implemented yet")

        generator = EmbeddingGenerator()

        text = "install package with apt"
        embedding1 = generator.encode(text)
        embedding2 = generator.encode(text)

        assert embedding1 == embedding2


class TestKnowledgeStorage:
    """Test knowledge storage and retrieval"""

    @pytest.mark.asyncio
    async def test_commit_knowledge_solution(self):
        """Test storing successful solution to knowledge base"""
        if QdrantMemoryManager is None:
            pytest.skip("QdrantMemoryManager not implemented yet")

        manager = QdrantMemoryManager()

        problem = "netstat command not found"
        solution = "apt-get install -y net-tools"
        distro = "debian"

        result = await manager.commit_knowledge(
            problem=problem,
            solution=solution,
            distro=distro
        )

        assert result is True

    @pytest.mark.asyncio
    async def test_commit_knowledge_with_metadata(self):
        """Test storing solution with full metadata"""
        if QdrantMemoryManager is None:
            pytest.skip("QdrantMemoryManager not implemented yet")

        manager = QdrantMemoryManager()

        problem = "docker: command not found"
        solution = "curl -fsSL https://get.docker.com | sh"
        distro = "ubuntu"

        result = await manager.commit_knowledge(
            problem=problem,
            solution=solution,
            distro=distro,
            success_rate=0.95,
            usage_count=10
        )

        assert result is True

    @pytest.mark.asyncio
    async def test_search_knowledge_by_problem(self):
        """Test searching for similar problems in knowledge base"""
        if QdrantMemoryManager is None:
            pytest.skip("QdrantMemoryManager not implemented yet")

        manager = QdrantMemoryManager()

        # Store a solution first
        await manager.commit_knowledge(
            problem="ifconfig not found",
            solution="apt-get install -y net-tools",
            distro="debian"
        )

        # Search for similar problem
        results = await manager.search_knowledge(
            query="ifconfig missing",
            limit=5
        )

        assert len(results) > 0
        assert results[0]["problem"] is not None
        assert results[0]["solution"] is not None

    @pytest.mark.asyncio
    async def test_search_knowledge_with_distro_filter(self):
        """Test semantic search with distro filtering"""
        if QdrantMemoryManager is None:
            pytest.skip("QdrantMemoryManager not implemented yet")

        manager = QdrantMemoryManager()

        # Store solutions for different distros
        await manager.commit_knowledge(
            problem="install nginx",
            solution="apt-get install -y nginx",
            distro="debian"
        )

        await manager.commit_knowledge(
            problem="install nginx",
            solution="yum install -y nginx",
            distro="redhat"
        )

        # Search with distro filter
        debian_results = await manager.search_knowledge(
            query="how to install nginx",
            distro="debian"
        )

        assert len(debian_results) > 0
        assert debian_results[0]["distro"] == "debian"
        assert "apt-get" in debian_results[0]["solution"]


class TestSemanticSearch:
    """Test semantic search capabilities"""

    @pytest.mark.asyncio
    async def test_semantic_similarity_scoring(self):
        """Test semantic search returns similarity scores"""
        if QdrantMemoryManager is None:
            pytest.skip("QdrantMemoryManager not implemented yet")

        manager = QdrantMemoryManager()

        results = await manager.search_knowledge(
            query="network command missing",
            limit=3
        )

        for result in results:
            assert "score" in result
            assert 0.0 <= result["score"] <= 1.0

    @pytest.mark.asyncio
    async def test_search_score_threshold(self):
        """Test filtering results by score threshold"""
        if QdrantMemoryManager is None:
            pytest.skip("QdrantMemoryManager not implemented yet")

        manager = QdrantMemoryManager()

        results = await manager.search_knowledge(
            query="install docker",
            score_threshold=0.85,
            limit=5
        )

        # All results should have score >= 0.85
        for result in results:
            assert result["score"] >= 0.85

    @pytest.mark.asyncio
    async def test_search_respects_limit(self):
        """Test search respects result limit parameter"""
        if QdrantMemoryManager is None:
            pytest.skip("QdrantMemoryManager not implemented yet")

        manager = QdrantMemoryManager()

        results = await manager.search_knowledge(
            query="package installation",
            limit=3
        )

        assert len(results) <= 3


class TestPersonalityStorage:
    """Test personality/preference storage"""

    @pytest.mark.asyncio
    async def test_commit_personality_preference(self):
        """Test storing user preference"""
        if QdrantMemoryManager is None:
            pytest.skip("QdrantMemoryManager not implemented yet")

        manager = QdrantMemoryManager()

        result = await manager.commit_personality(
            preference_type="command_style",
            content="User prefers verbose command output"
        )

        assert result is True

    @pytest.mark.asyncio
    async def test_search_personality_preferences(self):
        """Test searching personality preferences"""
        if QdrantMemoryManager is None:
            pytest.skip("QdrantMemoryManager not implemented yet")

        manager = QdrantMemoryManager()

        # Store preference
        await manager.commit_personality(
            preference_type="package_manager",
            content="User always uses apt-get instead of apt"
        )

        # Search
        results = await manager.search_personality(
            query="package installation preferences"
        )

        assert len(results) > 0


class TestSuccessRateTracking:
    """Test solution success rate and usage tracking"""

    @pytest.mark.asyncio
    async def test_increment_usage_count(self):
        """Test incrementing solution usage count"""
        if QdrantMemoryManager is None:
            pytest.skip("QdrantMemoryManager not implemented yet")

        manager = QdrantMemoryManager()

        # Store solution
        solution_id = await manager.commit_knowledge(
            problem="restart nginx",
            solution="systemctl restart nginx",
            distro="ubuntu"
        )

        # Use solution
        await manager.increment_usage(solution_id)

        # Verify count increased
        info = await manager.get_solution_info(solution_id)
        assert info["usage_count"] >= 1

    @pytest.mark.asyncio
    async def test_update_success_rate(self):
        """Test updating solution success rate"""
        if QdrantMemoryManager is None:
            pytest.skip("QdrantMemoryManager not implemented yet")

        manager = QdrantMemoryManager()

        solution_id = await manager.commit_knowledge(
            problem="check disk space",
            solution="df -h",
            distro="ubuntu",
            success_rate=0.9
        )

        # Update success rate
        await manager.update_success_rate(solution_id, success=True)

        # Verify updated
        info = await manager.get_solution_info(solution_id)
        assert info["success_rate"] > 0.9


class TestPerformance:
    """Test performance requirements"""

    @pytest.mark.asyncio
    async def test_query_latency_under_500ms(self):
        """Test query latency < 500ms P95"""
        if QdrantMemoryManager is None:
            pytest.skip("QdrantMemoryManager not implemented yet")

        manager = QdrantMemoryManager()

        # Populate some data
        for i in range(10):
            await manager.commit_knowledge(
                problem=f"test problem {i}",
                solution=f"test solution {i}",
                distro="ubuntu"
            )

        # Measure query time
        import time
        start = time.time()

        results = await manager.search_knowledge("test problem")

        elapsed_ms = (time.time() - start) * 1000

        assert elapsed_ms < 500  # P95 target

    @pytest.mark.asyncio
    async def test_embedding_generation_under_100ms(self):
        """Test embedding generation < 100ms"""
        if EmbeddingGenerator is None:
            pytest.skip("EmbeddingGenerator not implemented yet")

        generator = EmbeddingGenerator()

        import time
        start = time.time()

        embedding = generator.encode("test command for embedding speed")

        elapsed_ms = (time.time() - start) * 1000

        assert elapsed_ms < 100


class TestGracefulDegradation:
    """Test graceful degradation when Qdrant unavailable"""

    @pytest.mark.asyncio
    async def test_operations_when_offline(self):
        """Test operations don't crash when Qdrant offline"""
        if QdrantMemoryManager is None:
            pytest.skip("QdrantMemoryManager not implemented yet")

        # Connect to non-existent instance
        manager = QdrantMemoryManager(host="localhost", port=9999)

        # All operations should gracefully fail
        result = await manager.commit_knowledge(
            problem="test",
            solution="test",
            distro="ubuntu"
        )
        assert result is False

        results = await manager.search_knowledge("test")
        assert results == []

    def test_offline_mode_property(self):
        """Test offline_mode property indicates Qdrant availability"""
        if QdrantMemoryManager is None:
            pytest.skip("QdrantMemoryManager not implemented yet")

        # Online
        online_manager = QdrantMemoryManager(host="localhost", port=6333)
        assert online_manager.offline_mode is False

        # Offline
        offline_manager = QdrantMemoryManager(host="localhost", port=9999)
        assert offline_manager.offline_mode is True


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
