"""
GenAI Mini Framework - Arquivo Principal
Framework completo com integração Qdrant, GPTCache, Claude, llama.cpp e Google GenAI
Baseado no genai_engine.py original com melhorias e automação
"""

import subprocess
import json
import uuid
import os
import logging
from typing import Dict, List, Optional, Any, Tuple
from datetime import datetime
from dataclasses import dataclass

# Imports do framework
from framework_config import FrameworkConfig, EscalationLevel
from memory_manager import MemoryManager
from cache_manager import CacheManager
from fallback_manager import FallbackManager
from claude_integration import ClaudeIntegration

@dataclass
class TaskResult:
    """Resultado de execução de uma tarefa"""
    task_id: str
    success: bool
    steps_executed: int
    final_level: EscalationLevel
    execution_time: float
    error: Optional[str] = None

class GenAIMiniFramework:
    """Framework principal - versão melhorada do FazAIAgent"""

    def __init__(self, config: Optional[FrameworkConfig] = None):
        """Inicializa o framework com configuração"""

        # Configuração
        self.config = config or FrameworkConfig.from_env()

        # Setup logging
        self._setup_logging()

        # Componentes principais
        self.memory_manager = None
        self.cache_manager = None  
        self.fallback_manager = None
        self.claude_integration = None

        # Estado
        self.initialized = False

        self.logger.info("=== Inicializando GenAI Mini Framework ===")
        self._initialize_components()

    def _setup_logging(self):
        """Configura sistema de logging"""
        logging.basicConfig(
            level=getattr(logging, self.config.log_level),
            format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
        )
        self.logger = logging.getLogger(__name__)

    def _initialize_components(self):
        """Inicializa todos os componentes do framework"""
        try:
            # 1. Memory Manager (Qdrant)
            self.logger.info("Inicializando Memory Manager...")
            self.memory_manager = MemoryManager(self.config)

            # 2. Cache Manager (GPTCache)
            self.logger.info("Inicializando Cache Manager...")
            self.cache_manager = CacheManager(self.config)

            # 3. Fallback Manager (Sistema Hierárquico)
            self.logger.info("Inicializando Fallback Manager...")
            self.fallback_manager = FallbackManager(
                self.config, 
                self.memory_manager, 
                self.cache_manager
            )

            # 4. Claude Integration
            self.logger.info("Inicializando Claude Integration...")
            self.claude_integration = ClaudeIntegration(
                self.config,
                self.memory_manager
            )

            self.initialized = True
            self.logger.info("=== Framework inicializado com sucesso ===")

        except Exception as e:
            self.logger.error(f"Erro ao inicializar framework: {e}")
            raise

    def _execute_command(self, command: str) -> Tuple[bool, str]:
        """Executa comando no sistema com segurança melhorada"""
        self.logger.info(f"Executando: {command}")

        try:
            # Lista de comandos perigosos (blacklist básica)
            dangerous_commands = [
                'rm -rf /', 'format', 'mkfs', 'dd if=', 'sudo rm',
                '> /dev/', 'chmod 777', 'chown -R'
            ]

            command_lower = command.lower()
            if any(dangerous in command_lower for dangerous in dangerous_commands):
                return False, "Comando considerado perigoso e foi bloqueado"

            # Executar comando
            result = subprocess.run(
                command,
                shell=True,
                capture_output=True,
                text=True,
                timeout=self.config.timeout_seconds,
                check=False
            )

            if result.returncode == 0:
                output = result.stdout or "[Comando executado com sucesso]"
                self.logger.info(f"Sucesso: {output[:100]}...")
                return True, output
            else:
                output = result.stderr or "[Comando falhou sem detalhes]"
                self.logger.warning(f"Falha: {output[:100]}...")
                return False, output

        except subprocess.TimeoutExpired:
            error_msg = f"Comando excedeu timeout de {self.config.timeout_seconds}s"
            self.logger.error(error_msg)
            return False, error_msg

        except Exception as e:
            error_msg = f"Erro ao executar comando: {str(e)}"
            self.logger.error(error_msg)
            return False, error_msg

    def run_task(self, task_description: str, max_steps: Optional[int] = None) -> TaskResult:
        """Executa uma tarefa usando o sistema hierárquico"""

        if not self.initialized:
            raise RuntimeError("Framework não foi inicializado")

        task_id = f"task_{uuid.uuid4().hex[:8]}"
        start_time = datetime.now()
        max_steps = max_steps or self.config.max_steps

        self.logger.info(f"=== Iniciando tarefa {task_id} ===")
        self.logger.info(f"Descrição: {task_description}")

        # Fila de comandos e estado
        task_queue = []
        current_level = EscalationLevel.N2_LOCAL_MEMORIA
        steps_executed = 0

        try:
            while steps_executed < max_steps:
                steps_executed += 1

                # Se fila vazia, precisa de novo plano
                if not task_queue:
                    self.logger.info(f"Solicitando plano do nível {current_level.name}")

                    fallback_result = self.fallback_manager.execute_fallback_chain(
                        task_id, task_description, current_level
                    )

                    if not fallback_result.success:
                        if fallback_result.level == EscalationLevel.DESISTIR:
                            # Todos os níveis falharam
                            execution_time = (datetime.now() - start_time).total_seconds()
                            return TaskResult(
                                task_id=task_id,
                                success=False,
                                steps_executed=steps_executed,
                                final_level=fallback_result.level,
                                execution_time=execution_time,
                                error="Todos os níveis de fallback falharam"
                            )
                        else:
                            # Escalar nível
                            current_level = self._get_next_level(current_level)
                            continue

                    # Processar resposta do fallback
                    response = fallback_result.response
                    if isinstance(response, list):
                        task_queue = response
                    elif isinstance(response, dict):
                        task_queue = [response]
                    else:
                        self.logger.error(f"Resposta inválida do fallback: {type(response)}")
                        current_level = self._get_next_level(current_level)
                        continue

                # Executar próximo passo da fila
                if not task_queue:
                    continue

                current_step = task_queue.pop(0)
                step_desc = current_step.get("descricao", "Passo sem descrição")
                command = current_step.get("comando")

                # Verificar se tarefa está completa
                if command is None or current_step.get("finalizado"):
                    execution_time = (datetime.now() - start_time).total_seconds()
                    self.logger.info(f"=== Tarefa {task_id} concluída com sucesso ===")

                    return TaskResult(
                        task_id=task_id,
                        success=True,
                        steps_executed=steps_executed,
                        final_level=current_level,
                        execution_time=execution_time
                    )

                # Executar comando
                success, output = self._execute_command(command)

                # Registrar resultado na memória
                self.memory_manager.store_execution_log(
                    task_id, step_desc, command, success, output, current_level
                )

                if success:
                    # Sucesso - se fila vazia, volta ao nível 2
                    if not task_queue:
                        current_level = EscalationLevel.N2_LOCAL_MEMORIA
                else:
                    # Falha - limpar fila e escalar nível
                    task_queue.clear()
                    current_level = self._get_next_level(current_level)

            # Limite de passos atingido
            execution_time = (datetime.now() - start_time).total_seconds()
            return TaskResult(
                task_id=task_id,
                success=False,
                steps_executed=steps_executed,
                final_level=current_level,
                execution_time=execution_time,
                error=f"Limite de {max_steps} passos atingido"
            )

        except Exception as e:
            execution_time = (datetime.now() - start_time).total_seconds()
            self.logger.error(f"Erro durante execução da tarefa: {e}")

            return TaskResult(
                task_id=task_id,
                success=False,
                steps_executed=steps_executed,
                final_level=current_level,
                execution_time=execution_time,
                error=str(e)
            )

    def _get_next_level(self, current_level: EscalationLevel) -> EscalationLevel:
        """Retorna o próximo nível de escalação"""
        if current_level == EscalationLevel.N2_LOCAL_MEMORIA:
            return EscalationLevel.N3_EQUIPE_LOCAL
        elif current_level == EscalationLevel.N3_EQUIPE_LOCAL:
            return EscalationLevel.N4_SUPERVISOR_ONLINE
        elif current_level == EscalationLevel.N4_SUPERVISOR_ONLINE:
            return EscalationLevel.DESISTIR
        else:
            return EscalationLevel.DESISTIR

    def import_claude_conversations(self, json_path_or_directory: str) -> Dict[str, Any]:
        """Importa conversas do Claude para a memória"""
        if not self.initialized:
            raise RuntimeError("Framework não foi inicializado")

        self.logger.info(f"Importando conversas do Claude de: {json_path_or_directory}")

        if os.path.isdir(json_path_or_directory):
            return self.claude_integration.import_from_directory(json_path_or_directory)
        else:
            conversations = self.claude_integration.parse_claude_json(json_path_or_directory)
            return self.claude_integration.import_conversations_to_memory(conversations)

    def create_personality_from_claude(self) -> str:
        """Cria personalidade baseada nas conversas importadas do Claude"""
        if not self.initialized:
            raise RuntimeError("Framework não foi inicializado")

        return self.claude_integration.create_personality_profile()

    def search_memory(self, query: str, memory_type: Optional[str] = None, limit: int = 5) -> List[Dict[str, Any]]:
        """Busca na memória do framework"""
        if not self.initialized:
            raise RuntimeError("Framework não foi inicializado")

        return self.memory_manager.search_memories(query, memory_type, limit)

    def get_cache_stats(self) -> Dict[str, Any]:
        """Retorna estatísticas do cache"""
        if not self.initialized:
            return {"error": "Framework não inicializado"}

        return self.cache_manager.get_cache_stats()

    def clear_cache(self):
        """Limpa o cache do framework"""
        if not self.initialized:
            raise RuntimeError("Framework não foi inicializado")

        self.cache_manager.clear_cache()

    def get_framework_status(self) -> Dict[str, Any]:
        """Retorna status geral do framework"""
        return {
            "initialized": self.initialized,
            "cache_enabled": self.config.enable_cache,
            "fallback_enabled": self.config.enable_fallback,
            "qdrant_host": self.config.qdrant.host,
            "qdrant_port": self.config.qdrant.port,
            "max_steps": self.config.max_steps,
            "timeout_seconds": self.config.timeout_seconds,
            "cache_stats": self.get_cache_stats() if self.initialized else None
        }

# Função utilitária para inicialização rápida
def create_framework(config_path: Optional[str] = None, **kwargs) -> GenAIMiniFramework:
    """Cria e inicializa framework com configuração simplificada"""

    if config_path:
        # Carregar de arquivo (implementar se necessário)
        config = FrameworkConfig.from_env()
    else:
        config = FrameworkConfig(**kwargs) if kwargs else FrameworkConfig.from_env()

    return GenAIMiniFramework(config)

# Exemplo de uso
if __name__ == "__main__":
    # Configuração de exemplo
    config = FrameworkConfig.from_env()

    # Verificar se Google API Key está definida
    if not config.genai.api_key:
        print("ERRO: Defina a variável GOOGLE_API_KEY")
        print("export GOOGLE_API_KEY='sua_chave_aqui'")
        exit(1)

    try:
        # Criar framework
        framework = GenAIMiniFramework(config)

        # Exemplo de tarefa
        task_description = """
        Encontre todos os arquivos .py no diretório atual, 
        conte quantos são e salve o resultado em arquivos_python.txt
        """

        # Executar tarefa
        result = framework.run_task(task_description)

        print(f"\n=== Resultado da Tarefa ===")
        print(f"ID: {result.task_id}")
        print(f"Sucesso: {result.success}")
        print(f"Passos executados: {result.steps_executed}")
        print(f"Nível final: {result.final_level.name}")
        print(f"Tempo de execução: {result.execution_time:.2f}s")

        if result.error:
            print(f"Erro: {result.error}")

        # Status do framework
        print(f"\n=== Status do Framework ===")
        status = framework.get_framework_status()
        for key, value in status.items():
            print(f"{key}: {value}")

    except Exception as e:
        print(f"Erro: {e}")
