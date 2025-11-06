"""
Memory Manager - Gerenciamento de Memória com Qdrant
Integração com collections fz_memories, personalidade e logs de execução
"""

import json
import uuid
import logging
from typing import Dict, List, Optional, Any, Tuple
from dataclasses import dataclass, asdict
from datetime import datetime

from qdrant_client import QdrantClient, models
import google.generativeai as genai

from framework_config import FrameworkConfig, EscalationLevel

@dataclass
class MemoryEntry:
    """Entrada de memória estruturada"""
    id: str
    content: str
    metadata: Dict[str, Any]
    timestamp: datetime
    memory_type: str  # "conversation", "procedure", "personality", "error", "success"
    embedding: Optional[List[float]] = None

class MemoryManager:
    """Gerenciador de memória contextual com Qdrant"""

    def __init__(self, config: FrameworkConfig):
        self.config = config
        self.qdrant = None
        self.logger = logging.getLogger(__name__)
        self._initialize_qdrant()

    def _initialize_qdrant(self):
        """Inicializa conexão com Qdrant e cria collections"""
        try:
            self.qdrant = QdrantClient(
                host=self.config.qdrant.host, 
                port=self.config.qdrant.port
            )

            # Criar collections necessárias
            self._create_collections()
            self.logger.info("Qdrant inicializado com sucesso")

        except Exception as e:
            self.logger.error(f"Erro ao inicializar Qdrant: {e}")
            raise

    def _create_collections(self):
        """Cria as collections necessárias no Qdrant"""
        collections = [
            self.config.qdrant.collection_memories,
            self.config.qdrant.collection_personality, 
            self.config.qdrant.collection_logs
        ]

        for collection_name in collections:
            try:
                # Verifica se collection já existe
                self.qdrant.get_collection(collection_name)
                self.logger.info(f"Collection '{collection_name}' já existe")
            except:
                # Cria collection se não existir
                self.qdrant.create_collection(
                    collection_name=collection_name,
                    vectors_config=models.VectorParams(
                        size=self.config.qdrant.embedding_dim,
                        distance=models.Distance.COSINE
                    )
                )
                self.logger.info(f"Collection '{collection_name}' criada")

    def _generate_embedding(self, text: str, task_type: str = "RETRIEVAL_DOCUMENT") -> List[float]:
        """Gera embedding usando Google GenAI"""
        try:
            if not self.config.genai.api_key:
                raise ValueError("Google API Key não configurada")

            genai.configure(api_key=self.config.genai.api_key)

            result = genai.embed_content(
                model=self.config.qdrant.embedding_model,
                content=text,
                task_type=task_type
            )

            return result['embedding']

        except Exception as e:
            self.logger.error(f"Erro ao gerar embedding: {e}")
            return []

    def store_memory(self, content: str, memory_type: str, metadata: Dict[str, Any] = None) -> str:
        """Armazena uma memória no Qdrant"""
        if metadata is None:
            metadata = {}

        memory_id = str(uuid.uuid4())

        # Gera embedding do conteúdo
        embedding = self._generate_embedding(content)
        if not embedding:
            self.logger.warning("Não foi possível gerar embedding para a memória")
            return memory_id

        # Cria entrada de memória
        memory_entry = MemoryEntry(
            id=memory_id,
            content=content,
            metadata=metadata,
            timestamp=datetime.now(),
            memory_type=memory_type,
            embedding=embedding
        )

        # Armazena no Qdrant
        try:
            self.qdrant.upsert(
                collection_name=self.config.qdrant.collection_memories,
                points=[
                    models.PointStruct(
                        id=memory_id,
                        vector=embedding,
                        payload={
                            "content": content,
                            "memory_type": memory_type,
                            "timestamp": memory_entry.timestamp.isoformat(),
                            **metadata
                        }
                    )
                ]
            )

            self.logger.info(f"Memória armazenada: {memory_id} ({memory_type})")
            return memory_id

        except Exception as e:
            self.logger.error(f"Erro ao armazenar memória: {e}")
            return memory_id

    def search_memories(self, query: str, memory_type: Optional[str] = None, 
                       limit: int = 5) -> List[Dict[str, Any]]:
        """Busca memórias similares"""
        try:
            # Gera embedding da query
            query_embedding = self._generate_embedding(query, "RETRIEVAL_QUERY")
            if not query_embedding:
                return []

            # Filtros opcionais
            query_filter = None
            if memory_type:
                query_filter = models.Filter(
                    must=[
                        models.FieldCondition(
                            key="memory_type",
                            match=models.MatchValue(value=memory_type)
                        )
                    ]
                )

            # Busca no Qdrant
            search_result = self.qdrant.search(
                collection_name=self.config.qdrant.collection_memories,
                query_vector=query_embedding,
                query_filter=query_filter,
                limit=limit,
                with_payload=True
            )

            # Formata resultados
            memories = []
            for hit in search_result:
                memories.append({
                    "id": hit.id,
                    "content": hit.payload["content"],
                    "memory_type": hit.payload["memory_type"],
                    "timestamp": hit.payload["timestamp"],
                    "score": hit.score,
                    "metadata": {k: v for k, v in hit.payload.items() 
                               if k not in ["content", "memory_type", "timestamp"]}
                })

            return memories

        except Exception as e:
            self.logger.error(f"Erro ao buscar memórias: {e}")
            return []

    def store_execution_log(self, task_id: str, step_desc: str, command: str, 
                          success: bool, output: str, level: EscalationLevel):
        """Armazena log de execução para aprendizado"""
        log_content = f"""
        Nível: {level.name}
        Tarefa: {step_desc}
        Comando: {command}
        Resultado: {'SUCESSO' if success else 'FALHA'}
        Output: {output}
        """

        embedding = self._generate_embedding(log_content)
        if not embedding:
            return

        try:
            self.qdrant.upsert(
                collection_name=self.config.qdrant.collection_logs,
                points=[
                    models.PointStruct(
                        id=str(uuid.uuid4()),
                        vector=embedding,
                        payload={
                            "task_id": task_id,
                            "step_desc": step_desc,
                            "command": command,
                            "success": success,
                            "output": output,
                            "level": level.name,
                            "timestamp": datetime.now().isoformat()
                        }
                    )
                ]
            )

        except Exception as e:
            self.logger.error(f"Erro ao armazenar log: {e}")

    def get_task_history(self, task_id: str) -> List[Dict[str, Any]]:
        """Recupera histórico de uma tarefa específica"""
        try:
            search_result = self.qdrant.scroll(
                collection_name=self.config.qdrant.collection_logs,
                scroll_filter=models.Filter(
                    must=[
                        models.FieldCondition(
                            key="task_id",
                            match=models.MatchValue(value=task_id)
                        )
                    ]
                ),
                limit=50,
                with_payload=True
            )

            history = []
            if search_result and search_result[0]:
                for point in search_result[0]:
                    history.append(point.payload)

            # Ordena por timestamp
            history.sort(key=lambda x: x.get('timestamp', ''))

            return history

        except Exception as e:
            self.logger.error(f"Erro ao recuperar histórico: {e}")
            return []

    def import_claude_conversations(self, claude_json_path: str) -> int:
        """Importa conversas do Claude a partir de arquivo JSON"""
        try:
            with open(claude_json_path, 'r', encoding='utf-8') as f:
                claude_data = json.load(f)

            imported_count = 0

            # Processa conversas (estrutura pode variar)
            conversations = claude_data.get('conversations', [])

            for conversation in conversations:
                messages = conversation.get('messages', [])

                for message in messages:
                    content = message.get('content', '')
                    author = message.get('author', 'unknown')

                    if content.strip():
                        self.store_memory(
                            content=content,
                            memory_type="conversation",
                            metadata={
                                "author": author,
                                "conversation_id": conversation.get('id', ''),
                                "source": "claude_import"
                            }
                        )
                        imported_count += 1

            self.logger.info(f"Importadas {imported_count} mensagens do Claude")
            return imported_count

        except Exception as e:
            self.logger.error(f"Erro ao importar conversas do Claude: {e}")
            return 0

    def create_personality_from_memories(self, personality_name: str = "default") -> str:
        """Cria personalidade baseada nas memórias armazenadas"""
        try:
            # Busca memórias de conversação
            conversation_memories = self.search_memories(
                query="conversação personalidade comportamento",
                memory_type="conversation",
                limit=20
            )

            # Extrai padrões de personalidade
            personality_text = f"Personalidade {personality_name}:\n\n"

            for memory in conversation_memories:
                personality_text += f"- {memory['content'][:200]}...\n"

            # Armazena como personalidade
            personality_id = self.store_memory(
                content=personality_text,
                memory_type="personality",
                metadata={"personality_name": personality_name}
            )

            return personality_id

        except Exception as e:
            self.logger.error(f"Erro ao criar personalidade: {e}")
            return ""
