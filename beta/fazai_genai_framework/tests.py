"""
Testes Básicos - GenAI Mini Framework
Suite de testes para validar funcionalidades principais
"""

import unittest
import tempfile
import json
import os
from unittest.mock import patch, MagicMock

from genai_mini_framework import GenAIMiniFramework, FrameworkConfig, TaskResult
from memory_manager import MemoryManager
from cache_manager import CacheManager
from claude_integration import ClaudeIntegration

class TestFrameworkConfig(unittest.TestCase):
    """Testes da configuração do framework"""

    def test_default_config(self):
        """Testa configuração padrão"""
        config = FrameworkConfig()

        self.assertEqual(config.qdrant.host, "localhost")
        self.assertEqual(config.qdrant.port, 6333)
        self.assertEqual(config.max_steps, 30)
        self.assertTrue(config.enable_cache)
        self.assertTrue(config.enable_fallback)

    def test_config_from_env(self):
        """Testa carregamento de configuração via ambiente"""
        with patch.dict(os.environ, {
            'GOOGLE_API_KEY': 'test_key',
            'QDRANT_HOST': 'remote_host',
            'MAX_STEPS': '20'
        }):
            config = FrameworkConfig.from_env()
            self.assertEqual(config.genai.api_key, 'test_key')
            self.assertEqual(config.qdrant.host, 'remote_host')

class TestMemoryManager(unittest.TestCase):
    """Testes do gerenciador de memória"""

    def setUp(self):
        self.config = FrameworkConfig()
        self.config.genai.api_key = "test_key"

    @patch('memory_manager.QdrantClient')
    @patch('memory_manager.genai')
    def test_store_memory(self, mock_genai, mock_qdrant):
        """Testa armazenamento de memória"""

        # Mock embedding
        mock_genai.embed_content.return_value = {'embedding': [0.1, 0.2, 0.3]}

        # Mock Qdrant
        mock_client = MagicMock()
        mock_qdrant.return_value = mock_client

        memory_manager = MemoryManager(self.config)

        result = memory_manager.store_memory(
            content="Teste de memória",
            memory_type="test",
            metadata={"test": True}
        )

        self.assertTrue(isinstance(result, str))
        self.assertTrue(mock_client.upsert.called)

class TestClaudeIntegration(unittest.TestCase):
    """Testes da integração com Claude"""

    def setUp(self):
        self.config = FrameworkConfig()
        self.memory_manager = MagicMock()
        self.claude_integration = ClaudeIntegration(self.config, self.memory_manager)

    def test_parse_claude_json(self):
        """Testa parsing de JSON do Claude"""

        # Criar arquivo JSON de teste
        test_data = {
            "conversations": [
                {
                    "id": "test_conv",
                    "title": "Conversa de Teste",
                    "messages": [
                        {
                            "id": "msg_1",
                            "role": "human",
                            "content": "Olá, como fazer cache?"
                        },
                        {
                            "id": "msg_2", 
                            "role": "assistant",
                            "content": "Para fazer cache, use GPTCache..."
                        }
                    ]
                }
            ]
        }

        with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
            json.dump(test_data, f)
            temp_path = f.name

        try:
            conversations = self.claude_integration.parse_claude_json(temp_path)

            self.assertEqual(len(conversations), 1)
            self.assertEqual(conversations[0].id, "test_conv")
            self.assertEqual(len(conversations[0].messages), 2)

        finally:
            os.unlink(temp_path)

    def test_personality_detection(self):
        """Testa detecção de conteúdo de personalidade"""

        personality_content = "Minha personalidade é ser direto e prático"
        non_personality = "Como instalar o Docker?"

        self.assertTrue(
            self.claude_integration._is_personality_content(personality_content)
        )
        self.assertFalse(
            self.claude_integration._is_personality_content(non_personality)
        )

class TestFrameworkIntegration(unittest.TestCase):
    """Testes de integração completa"""

    @patch('genai_mini_framework.GenAIMiniFramework._initialize_components')
    def test_framework_initialization(self, mock_init):
        """Testa inicialização do framework"""

        config = FrameworkConfig()
        framework = GenAIMiniFramework(config)

        self.assertIsNotNone(framework.config)
        self.assertTrue(mock_init.called)

    def test_task_result_structure(self):
        """Testa estrutura do TaskResult"""

        result = TaskResult(
            task_id="test_123",
            success=True,
            steps_executed=3,
            final_level=EscalationLevel.N2_LOCAL_MEMORIA,
            execution_time=1.5
        )

        self.assertEqual(result.task_id, "test_123")
        self.assertTrue(result.success)
        self.assertEqual(result.steps_executed, 3)
        self.assertIsNone(result.error)

# Test Runner
if __name__ == "__main__":
    # Configurar logging para testes
    logging.basicConfig(level=logging.WARNING)

    # Executar testes
    unittest.main(verbosity=2)
