"""
Claude Integration - Integração Específica com Exports JSON do Claude
Parseia e processa arquivos JSON exportados do Claude para embedar no Qdrant
"""

import json
import os
import logging
from typing import Dict, List, Optional, Any, Tuple
from dataclasses import dataclass
from datetime import datetime, timezone
import re

from framework_config import FrameworkConfig
from memory_manager import MemoryManager

@dataclass
class ClaudeMessage:
    """Mensagem estruturada do Claude"""
    id: str
    content: str
    role: str  # "human" ou "assistant"
    timestamp: Optional[datetime]
    conversation_id: str
    metadata: Dict[str, Any]

@dataclass
class ClaudeConversation:
    """Conversa estruturada do Claude"""
    id: str
    title: str
    messages: List[ClaudeMessage]
    created_at: Optional[datetime]
    updated_at: Optional[datetime]
    metadata: Dict[str, Any]

class ClaudeIntegration:
    """Integrador para arquivos JSON do Claude"""

    def __init__(self, config: FrameworkConfig, memory_manager: MemoryManager):
        self.config = config
        self.memory_manager = memory_manager
        self.logger = logging.getLogger(__name__)

    def _parse_timestamp(self, timestamp_str: str) -> Optional[datetime]:
        """Parseia timestamp do formato Claude"""
        if not timestamp_str:
            return None

        try:
            # Formatos comuns do Claude
            formats = [
                "%Y-%m-%dT%H:%M:%S.%fZ",
                "%Y-%m-%dT%H:%M:%SZ", 
                "%Y-%m-%d %H:%M:%S",
                "%Y-%m-%d"
            ]

            for fmt in formats:
                try:
                    return datetime.strptime(timestamp_str, fmt)
                except ValueError:
                    continue

            self.logger.warning(f"Formato de timestamp não reconhecido: {timestamp_str}")
            return None

        except Exception as e:
            self.logger.error(f"Erro ao parsear timestamp: {e}")
            return None

    def _clean_content(self, content: str) -> str:
        """Limpa e normaliza conteúdo da mensagem"""
        if not content:
            return ""

        # Remove marcações XML/HTML básicas
        content = re.sub(r'<[^>]+>', '', content)

        # Normaliza espaços em branco
        content = re.sub(r'\s+', ' ', content)

        # Remove caracteres de controle
        content = ''.join(char for char in content if ord(char) >= 32 or char in '\n\t')

        return content.strip()

    def _extract_conversation_metadata(self, conversation_data: Dict[str, Any]) -> Dict[str, Any]:
        """Extrai metadados da conversa"""
        metadata = {}

        # Metadados básicos
        if 'model' in conversation_data:
            metadata['model'] = conversation_data['model']

        if 'temperature' in conversation_data:
            metadata['temperature'] = conversation_data['temperature']

        if 'max_tokens' in conversation_data:
            metadata['max_tokens'] = conversation_data['max_tokens']

        # Tags ou categorias
        if 'tags' in conversation_data:
            metadata['tags'] = conversation_data['tags']

        if 'category' in conversation_data:
            metadata['category'] = conversation_data['category']

        # Informações de sessão
        if 'session_id' in conversation_data:
            metadata['session_id'] = conversation_data['session_id']

        return metadata

    def parse_claude_json(self, json_path: str) -> List[ClaudeConversation]:
        """Parseia arquivo JSON do Claude"""
        try:
            with open(json_path, 'r', encoding='utf-8') as f:
                data = json.load(f)

            conversations = []

            # Estrutura pode variar - tentar diferentes formatos
            if isinstance(data, list):
                # Lista de conversas
                for conv_data in data:
                    conversation = self._parse_conversation(conv_data)
                    if conversation:
                        conversations.append(conversation)

            elif isinstance(data, dict):
                if 'conversations' in data:
                    # Formato com wrapper
                    for conv_data in data['conversations']:
                        conversation = self._parse_conversation(conv_data)
                        if conversation:
                            conversations.append(conversation)
                else:
                    # Conversa única
                    conversation = self._parse_conversation(data)
                    if conversation:
                        conversations.append(conversation)

            self.logger.info(f"Parseadas {len(conversations)} conversas de {json_path}")
            return conversations

        except Exception as e:
            self.logger.error(f"Erro ao parsear JSON do Claude: {e}")
            return []

    def _parse_conversation(self, conv_data: Dict[str, Any]) -> Optional[ClaudeConversation]:
        """Parseia uma conversa individual"""
        try:
            conv_id = conv_data.get('id', conv_data.get('uuid', f"conv_{hash(str(conv_data))}"))
            title = conv_data.get('title', conv_data.get('name', 'Conversa sem título'))

            # Parsear timestamps
            created_at = self._parse_timestamp(conv_data.get('created_at', ''))
            updated_at = self._parse_timestamp(conv_data.get('updated_at', ''))

            # Metadados
            metadata = self._extract_conversation_metadata(conv_data)

            # Parsear mensagens
            messages = []
            messages_data = conv_data.get('messages', conv_data.get('chat_messages', []))

            for i, msg_data in enumerate(messages_data):
                message = self._parse_message(msg_data, conv_id, i)
                if message:
                    messages.append(message)

            return ClaudeConversation(
                id=conv_id,
                title=title,
                messages=messages,
                created_at=created_at,
                updated_at=updated_at,
                metadata=metadata
            )

        except Exception as e:
            self.logger.error(f"Erro ao parsear conversa: {e}")
            return None

    def _parse_message(self, msg_data: Dict[str, Any], conv_id: str, index: int) -> Optional[ClaudeMessage]:
        """Parseia uma mensagem individual"""
        try:
            msg_id = msg_data.get('id', f"{conv_id}_msg_{index}")

            # Conteúdo da mensagem
            content = msg_data.get('content', msg_data.get('text', ''))
            if isinstance(content, list):
                # Conteúdo pode ser lista de blocos
                content = ' '.join([
                    block.get('text', str(block)) for block in content 
                    if isinstance(block, dict)
                ])

            content = self._clean_content(str(content))

            if not content:
                return None

            # Role/autor
            role = msg_data.get('role', msg_data.get('author', 'unknown'))
            if role == 'user':
                role = 'human'
            elif role == 'assistant':
                role = 'assistant'

            # Timestamp
            timestamp = self._parse_timestamp(msg_data.get('timestamp', msg_data.get('created_at', '')))

            # Metadados da mensagem
            metadata = {}
            if 'model' in msg_data:
                metadata['model'] = msg_data['model']
            if 'tokens' in msg_data:
                metadata['tokens'] = msg_data['tokens']
            if 'finish_reason' in msg_data:
                metadata['finish_reason'] = msg_data['finish_reason']

            return ClaudeMessage(
                id=msg_id,
                content=content,
                role=role,
                timestamp=timestamp,
                conversation_id=conv_id,
                metadata=metadata
            )

        except Exception as e:
            self.logger.error(f"Erro ao parsear mensagem: {e}")
            return None

    def import_conversations_to_memory(self, conversations: List[ClaudeConversation]) -> Dict[str, int]:
        """Importa conversas para a memória Qdrant"""
        stats = {
            "conversations": 0,
            "messages": 0,
            "personality_entries": 0,
            "procedural_entries": 0
        }

        for conversation in conversations:
            try:
                # Importar mensagens individuais
                for message in conversation.messages:
                    memory_type = "conversation"

                    # Detectar tipo de conteúdo
                    if self._is_personality_content(message.content):
                        memory_type = "personality"
                        stats["personality_entries"] += 1
                    elif self._is_procedural_content(message.content):
                        memory_type = "procedure"
                        stats["procedural_entries"] += 1

                    # Metadados da memória
                    memory_metadata = {
                        "conversation_id": conversation.id,
                        "conversation_title": conversation.title,
                        "message_id": message.id,
                        "role": message.role,
                        "source": "claude_import",
                        **message.metadata,
                        **conversation.metadata
                    }

                    if message.timestamp:
                        memory_metadata["original_timestamp"] = message.timestamp.isoformat()

                    # Armazenar na memória
                    self.memory_manager.store_memory(
                        content=message.content,
                        memory_type=memory_type,
                        metadata=memory_metadata
                    )

                    stats["messages"] += 1

                stats["conversations"] += 1

            except Exception as e:
                self.logger.error(f"Erro ao importar conversa {conversation.id}: {e}")

        return stats

    def _is_personality_content(self, content: str) -> bool:
        """Detecta se o conteúdo é relacionado à personalidade"""
        personality_keywords = [
            "personalidade", "comportamento", "estilo", "preferência",
            "como eu", "minha forma", "meu jeito", "costumo",
            "sempre faço", "nunca faço", "gosto de", "não gosto",
            "minha abordagem", "meu método"
        ]

        content_lower = content.lower()
        return any(keyword in content_lower for keyword in personality_keywords)

    def _is_procedural_content(self, content: str) -> bool:
        """Detecta se o conteúdo é relacionado a procedimentos"""
        procedural_keywords = [
            "como fazer", "passo a passo", "procedimento", "processo",
            "primeiro", "segundo", "terceiro", "depois", "em seguida",
            "tutorial", "guia", "método", "técnica", "comando",
            "execute", "rode", "instale", "configure"
        ]

        content_lower = content.lower()
        return any(keyword in content_lower for keyword in procedural_keywords)

    def import_from_directory(self, directory_path: str) -> Dict[str, Any]:
        """Importa todos os arquivos JSON de um diretório"""
        if not os.path.exists(directory_path):
            self.logger.error(f"Diretório não existe: {directory_path}")
            return {"error": "Diretório não encontrado"}

        total_stats = {
            "files_processed": 0,
            "files_failed": 0,
            "conversations": 0,
            "messages": 0,
            "personality_entries": 0,  
            "procedural_entries": 0
        }

        json_files = [f for f in os.listdir(directory_path) if f.endswith('.json')]

        for json_file in json_files:
            try:
                file_path = os.path.join(directory_path, json_file)
                conversations = self.parse_claude_json(file_path)

                if conversations:
                    file_stats = self.import_conversations_to_memory(conversations)

                    # Somar estatísticas
                    for key in file_stats:
                        total_stats[key] = total_stats.get(key, 0) + file_stats[key]

                    total_stats["files_processed"] += 1
                    self.logger.info(f"Arquivo processado: {json_file}")
                else:
                    total_stats["files_failed"] += 1
                    self.logger.warning(f"Nenhuma conversa encontrada em: {json_file}")

            except Exception as e:
                total_stats["files_failed"] += 1
                self.logger.error(f"Erro ao processar {json_file}: {e}")

        return total_stats

    def create_personality_profile(self, conversation_limit: int = 50) -> str:
        """Cria um perfil de personalidade baseado nas conversas importadas"""
        try:
            # Buscar entradas de personalidade
            personality_memories = self.memory_manager.search_memories(
                query="personalidade comportamento estilo preferências",
                memory_type="personality",
                limit=conversation_limit
            )

            if not personality_memories:
                return "Nenhuma informação de personalidade encontrada."

            # Compilar perfil
            profile_parts = [
                "## Perfil de Personalidade Baseado em Conversas Claude\n"
            ]

            for i, memory in enumerate(personality_memories, 1):
                profile_parts.append(f"### Aspecto {i}")
                profile_parts.append(f"**Conteúdo:** {memory['content'][:300]}...")
                profile_parts.append(f"**Relevância:** {memory['score']:.3f}")
                profile_parts.append("")

            profile = "\n".join(profile_parts)

            # Armazenar perfil compilado
            profile_id = self.memory_manager.store_memory(
                content=profile,
                memory_type="personality",
                metadata={
                    "profile_type": "compiled",
                    "source_count": len(personality_memories),
                    "created_at": datetime.now().isoformat()
                }
            )

            self.logger.info(f"Perfil de personalidade criado: {profile_id}")
            return profile

        except Exception as e:
            self.logger.error(f"Erro ao criar perfil de personalidade: {e}")
            return f"Erro ao criar perfil: {e}"
