"""
Qdrant Memory Manager for FazAI Python Worker.

Implements dual-collection strategy:
- fazai_personality: User behavior and preferences
- fazai_knowledge: Command solutions and patterns

Uses sentence-transformers for 1024-dim embeddings and semantic search.
"""

import os
from datetime import datetime
from typing import List, Dict, Any, Optional
from uuid import uuid4

from qdrant_client import QdrantClient
from qdrant_client.models import (
    Distance,
    VectorParams,
    PointStruct,
    Filter,
    FieldCondition,
    MatchValue,
)
from sentence_transformers import SentenceTransformer


class MemoryManager:
    """
    Manages semantic memory for FazAI using Qdrant vector database.

    Collections:
    - personality: User preferences and behavior patterns
    - knowledge: Command solutions and system knowledge

    Attributes:
        client: Qdrant client instance
        model: Sentence transformer for embeddings
        personality_collection: Name of personality collection
        knowledge_collection: Name of knowledge collection
    """

    def __init__(
        self,
        host: str = "localhost",
        port: int = 6333,
        personality_collection: str = "fazai_personality",
        knowledge_collection: str = "fazai_knowledge",
    ):
        """
        Initialize MemoryManager with Qdrant connection.

        Args:
            host: Qdrant server host
            port: Qdrant server port
            personality_collection: Name for personality collection
            knowledge_collection: Name for knowledge collection
        """
        self.client = QdrantClient(host=host, port=port)
        self.personality_collection = personality_collection
        self.knowledge_collection = knowledge_collection

        # Load sentence transformer model (1024 dimensions)
        # Using BAAI/bge-large-en-v1.5 for 1024-dim embeddings
        self.model = SentenceTransformer("BAAI/bge-large-en-v1.5")

    def initialize_collections(self) -> None:
        """
        Create Qdrant collections with proper schema.

        Creates:
        - fazai_personality: 1024-dim vectors for user preferences
        - fazai_knowledge: 1024-dim vectors for command solutions
        """
        # Get existing collections
        existing_collections = self.client.get_collections().collections
        existing_names = [c.name for c in existing_collections]

        # Create personality collection if not exists
        if self.personality_collection not in existing_names:
            self.client.create_collection(
                collection_name=self.personality_collection,
                vectors_config=VectorParams(size=1024, distance=Distance.COSINE),
            )

        # Create knowledge collection if not exists
        if self.knowledge_collection not in existing_names:
            self.client.create_collection(
                collection_name=self.knowledge_collection,
                vectors_config=VectorParams(size=1024, distance=Distance.COSINE),
            )

    def _generate_embedding(self, text: str) -> List[float]:
        """
        Generate 1024-dim embedding for text.

        Args:
            text: Input text to embed

        Returns:
            List of 1024 floats representing the embedding
        """
        embedding = self.model.encode(text, convert_to_numpy=True)
        return embedding.tolist()

    def commit_personality(
        self,
        preference: str,
        context: str = "",
        relevance_score: float = 1.0,
    ) -> Optional[str]:
        """
        Store a user personality preference.

        Args:
            preference: User preference description
            context: Additional context about the preference
            relevance_score: Relevance score (0.0-1.0)

        Returns:
            Point ID if successful, None otherwise
        """
        try:
            # Generate embedding from preference text
            embedding = self._generate_embedding(preference)

            # Create unique ID
            point_id = str(uuid4())

            # Create payload
            payload = {
                "preference": preference,
                "context": context,
                "timestamp": datetime.utcnow().isoformat(),
                "usage_count": 0,
                "relevance_score": relevance_score,
            }

            # Store in Qdrant
            self.client.upsert(
                collection_name=self.personality_collection,
                points=[PointStruct(id=point_id, vector=embedding, payload=payload)],
            )

            return point_id

        except Exception as e:
            print(f"Error committing personality: {e}")
            return None

    def search_personality(
        self,
        query: str,
        limit: int = 5,
        min_score: float = 0.0,
    ) -> List[Dict[str, Any]]:
        """
        Search for similar personality preferences.

        Args:
            query: Search query text
            limit: Maximum number of results
            min_score: Minimum similarity score threshold

        Returns:
            List of matching preferences with scores
        """
        try:
            if not query:
                return []

            # Generate query embedding
            query_embedding = self._generate_embedding(query)

            # Search in personality collection
            search_result = self.client.search(
                collection_name=self.personality_collection,
                query_vector=query_embedding,
                limit=limit,
                score_threshold=min_score,
            )

            # Format results
            results = []
            for hit in search_result:
                result = {
                    "id": hit.id,
                    "score": hit.score,
                    "preference": hit.payload.get("preference", ""),
                    "context": hit.payload.get("context", ""),
                    "timestamp": hit.payload.get("timestamp", ""),
                    "usage_count": hit.payload.get("usage_count", 0),
                    "relevance_score": hit.payload.get("relevance_score", 0.0),
                }
                results.append(result)

                # Increment usage count
                self._increment_usage_count(
                    collection=self.personality_collection,
                    point_id=hit.id,
                    current_count=hit.payload.get("usage_count", 0),
                )

            return results

        except Exception as e:
            print(f"Error searching personality: {e}")
            return []

    def commit_knowledge(
        self,
        problem: str,
        solution: str,
        distro: str = "all",
        success_rate: float = 1.0,
    ) -> Optional[str]:
        """
        Store a command solution in knowledge base.

        Args:
            problem: Problem description
            solution: Solution/command
            distro: Linux distribution (debian, rhel, arch, all)
            success_rate: Success rate of solution (0.0-1.0)

        Returns:
            Point ID if successful, None otherwise
        """
        try:
            # Generate embedding from problem text
            combined_text = f"{problem} {solution}"
            embedding = self._generate_embedding(combined_text)

            # Create unique ID
            point_id = str(uuid4())

            # Create payload
            payload = {
                "problem": problem,
                "solution": solution,
                "distro": distro,
                "success_rate": success_rate,
                "usage_count": 0,
                "timestamp": datetime.utcnow().isoformat(),
            }

            # Store in Qdrant
            self.client.upsert(
                collection_name=self.knowledge_collection,
                points=[PointStruct(id=point_id, vector=embedding, payload=payload)],
            )

            return point_id

        except Exception as e:
            print(f"Error committing knowledge: {e}")
            return None

    def search_knowledge(
        self,
        query: str,
        limit: int = 5,
        distro: Optional[str] = None,
        min_score: float = 0.0,
    ) -> List[Dict[str, Any]]:
        """
        Search for similar command solutions.

        Args:
            query: Search query text
            limit: Maximum number of results
            distro: Filter by Linux distribution
            min_score: Minimum similarity score threshold

        Returns:
            List of matching solutions with scores
        """
        try:
            if not query:
                return []

            # Generate query embedding
            query_embedding = self._generate_embedding(query)

            # Build filter for distro if specified
            query_filter = None
            if distro:
                query_filter = Filter(
                    should=[
                        FieldCondition(
                            key="distro",
                            match=MatchValue(value=distro),
                        ),
                        FieldCondition(
                            key="distro",
                            match=MatchValue(value="all"),
                        ),
                    ]
                )

            # Search in knowledge collection
            search_result = self.client.search(
                collection_name=self.knowledge_collection,
                query_vector=query_embedding,
                limit=limit,
                score_threshold=min_score,
                query_filter=query_filter,
            )

            # Format results
            results = []
            for hit in search_result:
                result = {
                    "id": hit.id,
                    "score": hit.score,
                    "problem": hit.payload.get("problem", ""),
                    "solution": hit.payload.get("solution", ""),
                    "distro": hit.payload.get("distro", "all"),
                    "success_rate": hit.payload.get("success_rate", 1.0),
                    "usage_count": hit.payload.get("usage_count", 0),
                    "timestamp": hit.payload.get("timestamp", ""),
                }
                results.append(result)

                # Increment usage count
                self._increment_usage_count(
                    collection=self.knowledge_collection,
                    point_id=hit.id,
                    current_count=hit.payload.get("usage_count", 0),
                )

            return results

        except Exception as e:
            print(f"Error searching knowledge: {e}")
            return []

    def _increment_usage_count(
        self,
        collection: str,
        point_id: str,
        current_count: int,
    ) -> None:
        """
        Increment usage count for a point.

        Args:
            collection: Collection name
            point_id: Point ID to update
            current_count: Current usage count
        """
        try:
            # Set payload with incremented usage count
            self.client.set_payload(
                collection_name=collection,
                payload={"usage_count": current_count + 1},
                points=[point_id],
            )
        except Exception as e:
            print(f"Error incrementing usage count: {e}")

    def delete_personality(self, point_id: str) -> bool:
        """
        Delete a personality preference.

        Args:
            point_id: ID of the point to delete

        Returns:
            True if successful, False otherwise
        """
        try:
            self.client.delete(
                collection_name=self.personality_collection,
                points_selector=[point_id],
            )
            return True
        except Exception as e:
            print(f"Error deleting personality: {e}")
            return False

    def delete_knowledge(self, point_id: str) -> bool:
        """
        Delete a knowledge entry.

        Args:
            point_id: ID of the point to delete

        Returns:
            True if successful, False otherwise
        """
        try:
            self.client.delete(
                collection_name=self.knowledge_collection,
                points_selector=[point_id],
            )
            return True
        except Exception as e:
            print(f"Error deleting knowledge: {e}")
            return False

    def get_collection_info(self) -> Dict[str, Any]:
        """
        Get information about both collections.

        Returns:
            Dictionary with collection statistics
        """
        try:
            personality_info = self.client.get_collection(
                self.personality_collection
            )
            knowledge_info = self.client.get_collection(self.knowledge_collection)

            return {
                "personality": {
                    "name": self.personality_collection,
                    "vectors_count": personality_info.vectors_count,
                    "points_count": personality_info.points_count,
                },
                "knowledge": {
                    "name": self.knowledge_collection,
                    "vectors_count": knowledge_info.vectors_count,
                    "points_count": knowledge_info.points_count,
                },
            }
        except Exception as e:
            print(f"Error getting collection info: {e}")
            return {}
