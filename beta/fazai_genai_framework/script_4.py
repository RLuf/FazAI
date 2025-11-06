# Criando o fallback manager - sistema hierárquico de fallback
fallback_manager_content = '''"""
Fallback Manager - Sistema Hierárquico de Fallback
Gerencia os níveis de escalação conforme definido no genai_engine.py original
"""

import logging
import json
from typing import Dict, List, Optional, Any, Tuple
from dataclasses import dataclass
from datetime import datetime

from openai import OpenAI
import google.generativeai as genai

from framework_config import FrameworkConfig, EscalationLevel
from memory_manager import MemoryManager
from cache_manager import CacheManager

@dataclass
class FallbackResult:
    """Resultado de uma tentativa de fallback"""
    success: bool
    level: EscalationLevel
    response: Optional[Dict[str, Any]]
    error: Optional[str]
    execution_time: float

class FallbackManager:
    """Gerenciador do sistema hierárquico de fallback"""
    
    def __init__(self, config: FrameworkConfig, memory_manager: MemoryManager, 
                 cache_manager: CacheManager):
        self.config = config
        self.memory_manager = memory_manager
        self.cache_manager = cache_manager
        self.logger = logging.getLogger(__name__)
        
        # Clientes LLM
        self.llm_clients = {}
        self.genai_model = None
        
        self._initialize_clients()
    
    def _initialize_clients(self):
        """Inicializa todos os clientes LLM"""
        try:
            # Inicializar clientes Llama.cpp locais
            for role, url in self.config.llama.urls.items():
                client = OpenAI(base_url=url, api_key="local")
                
                # Aplicar cache se habilitado
                if self.cache_manager.is_enabled():
                    client = self.cache_manager.wrap_openai_client(client)
                
                self.llm_clients[role] = client
                self.logger.info(f"Cliente {role} inicializado em {url}")
            
            # Inicializar Google GenAI
            if self.config.genai.api_key:
                genai.configure(api_key=self.config.genai.api_key)
                model = genai.GenerativeModel(self.config.genai.supervisor_model)
                
                # Aplicar cache se habilitado
                if self.cache_manager.is_enabled():
                    model = self.cache_manager.wrap_genai_model(model)
                
                self.genai_model = model
                self.logger.info("Modelo GenAI supervisor inicializado")
                
        except Exception as e:
            self.logger.error(f"Erro ao inicializar clientes: {e}")
            raise
    
    def _get_personality_prompt(self) -> str:
        """Obtém prompt de personalidade da memória"""
        try:
            # Busca personalidade na memória
            memories = self.memory_manager.search_memories(
                query="personalidade sistema comportamento",
                memory_type="personality",
                limit=1
            )
            
            if memories:
                return memories[0]['content']
            else:
                # Personalidade padrão
                return """
                Você é um assistente de terminal Linux inteligente e eficiente.
                1. Analise tarefas e decomponha em passos executáveis
                2. Aprenda com erros anteriores consultando a memória
                3. Retorne sempre JSON no formato: {"descricao": "...", "comando": "..."}
                4. Se a tarefa estiver completa, retorne "comando": null
                """
                
        except Exception as e:
            self.logger.error(f"Erro ao obter personalidade: {e}")
            return "Você é um assistente prestativo."
    
    def _build_context_from_history(self, task_id: str, original_task: str) -> str:
        """Constrói contexto baseado no histórico da tarefa"""
        try:
            history = self.memory_manager.get_task_history(task_id)
            
            context = f"Tarefa Original: {original_task}\\n\\n"
            context += "Histórico de Tentativas:\\n"
            
            if not history:
                context += "Nenhuma tentativa registrada ainda.\\n"
                return context
            
            for i, log_entry in enumerate(history):
                context += f"Passo {i+1} ({log_entry.get('level', 'N/A')}):\\n"
                context += f"  - Descrição: {log_entry.get('step_desc', 'N/A')}\\n"
                context += f"  - Comando: {log_entry.get('command', 'N/A')}\\n"
                context += f"  - Resultado: {'SUCESSO' if log_entry.get('success') else 'FALHA'}\\n"
                context += f"  - Output: {log_entry.get('output', '')[:200]}...\\n\\n"
            
            return context
            
        except Exception as e:
            self.logger.error(f"Erro ao construir contexto: {e}")
            return f"Tarefa Original: {original_task}\\n"
    
    def _execute_level_2(self, task_id: str, original_task: str) -> FallbackResult:
        """Nível 2: Gerente Local + Memória Qdrant"""
        start_time = datetime.now()
        
        try:
            self.logger.info("Executando Nível 2: Gerente Local + Memória")
            
            system_prompt = self._get_personality_prompt()
            context = self._build_context_from_history(task_id, original_task)
            
            user_prompt = f"""
            {context}
            
            Com base no histórico, qual é o próximo passo para completar a tarefa?
            Responda APENAS com o JSON no formato especificado.
            """
            
            client = self.llm_clients.get('gerente')
            if not client:
                raise Exception("Cliente gerente não disponível")
            
            response = client.chat.completions.create(
                model=self.config.llama.models['gerente'],
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                response_format={"type": "json_object"},
                temperature=0.0
            )
            
            result = json.loads(response.choices[0].message.content)
            execution_time = (datetime.now() - start_time).total_seconds()
            
            return FallbackResult(
                success=True,
                level=EscalationLevel.N2_LOCAL_MEMORIA,
                response=result,
                error=None,
                execution_time=execution_time
            )
            
        except Exception as e:
            execution_time = (datetime.now() - start_time).total_seconds()
            self.logger.error(f"Erro no Nível 2: {e}")
            
            return FallbackResult(
                success=False,
                level=EscalationLevel.N2_LOCAL_MEMORIA,
                response=None,
                error=str(e),
                execution_time=execution_time
            )
    
    def _execute_level_3(self, task_id: str, original_task: str) -> FallbackResult:
        """Nível 3: Equipe de Especialistas Local (Analista + Programador)"""
        start_time = datetime.now()
        
        try:
            self.logger.info("Executando Nível 3: Equipe de Especialistas")
            
            context = self._build_context_from_history(task_id, original_task)
            
            # Passo A: Consultar Analista
            analista_prompt = f"""
            Você é um analista de sistemas. Um agente está com dificuldades.
            
            {context}
            
            Analise o histórico de falhas e forneça um diagnóstico e plano 
            de correção em linguagem natural. Não escreva código.
            """
            
            analista_client = self.llm_clients.get('analista')
            if not analista_client:
                raise Exception("Cliente analista não disponível")
            
            analista_response = analista_client.chat.completions.create(
                model=self.config.llama.models['analista'],
                messages=[
                    {"role": "system", "content": "Você é um analista de sistemas especializado em diagnóstico."},
                    {"role": "user", "content": analista_prompt}
                ],
                temperature=0.1
            )
            
            plano_analista = analista_response.choices[0].message.content
            self.logger.info(f"Plano do Analista: {plano_analista[:200]}...")
            
            # Passo B: Consultar Programador
            programador_prompt = f"""
            Você é um especialista em shell Linux.
            
            Converta o seguinte plano em uma lista JSON de comandos:
            
            Plano do Analista: "{plano_analista}"
            
            Responda APENAS com a lista JSON.
            Formato: [{"descricao": "...", "comando": "..."}, ...]
            """
            
            programador_client = self.llm_clients.get('programador')
            if not programador_client:
                raise Exception("Cliente programador não disponível")
            
            programador_response = programador_client.chat.completions.create(
                model=self.config.llama.models['programador'],
                messages=[
                    {"role": "system", "content": "Você é um expert em shell que SÓ responde com JSON."},
                    {"role": "user", "content": programador_prompt}
                ],
                response_format={"type": "json_object"}
            )
            
            result_raw = json.loads(programador_response.choices[0].message.content)
            
            # Normalizar resultado para lista
            if isinstance(result_raw, dict):
                result = result_raw.get("plan", [result_raw])
            elif isinstance(result_raw, list):
                result = result_raw
            else:
                raise ValueError("Programador retornou formato inválido")
            
            execution_time = (datetime.now() - start_time).total_seconds()
            
            return FallbackResult(
                success=True,
                level=EscalationLevel.N3_EQUIPE_LOCAL,
                response=result,
                error=None,
                execution_time=execution_time
            )
            
        except Exception as e:
            execution_time = (datetime.now() - start_time).total_seconds()
            self.logger.error(f"Erro no Nível 3: {e}")
            
            return FallbackResult(
                success=False,
                level=EscalationLevel.N3_EQUIPE_LOCAL,
                response=None,
                error=str(e),
                execution_time=execution_time
            )
    
    def _execute_level_4(self, task_id: str, original_task: str) -> FallbackResult:
        """Nível 4: Supervisor Online (Google GenAI)"""
        start_time = datetime.now()
        
        try:
            self.logger.info("Executando Nível 4: Supervisor Online")
            
            if not self.genai_model:
                raise Exception("Modelo GenAI não disponível")
            
            context = self._build_context_from_history(task_id, original_task)
            
            supervisor_prompt = f"""
            Você é um Engenheiro Sênior de DevOps.
            
            Um agente júnior e sua equipe local falharam. Este é o último recurso.
            
            {context}
            
            Forneça o plano de correção definitivo, passo a passo, em JSON.
            Responda APENAS com uma lista JSON de passos no formato:
            [{"descricao": "...", "comando": "..."}, ...]
            """
            
            response = self.genai_model.generate_content(supervisor_prompt)
            
            # Limpar resposta (remover markdown se presente)
            json_text = response.text.strip().lstrip("```json").rstrip("```")
            result = json.loads(json_text)
            
            if not isinstance(result, list):
                raise ValueError("Supervisor não retornou lista JSON válida")
            
            execution_time = (datetime.now() - start_time).total_seconds()
            
            return FallbackResult(
                success=True,
                level=EscalationLevel.N4_SUPERVISOR_ONLINE,
                response=result,
                error=None,
                execution_time=execution_time
            )
            
        except Exception as e:
            execution_time = (datetime.now() - start_time).total_seconds()
            self.logger.error(f"Erro no Nível 4: {e}")
            
            return FallbackResult(
                success=False,
                level=EscalationLevel.N4_SUPERVISOR_ONLINE,
                response=None,
                error=str(e),
                execution_time=execution_time
            )
    
    def execute_fallback_chain(self, task_id: str, original_task: str, 
                             start_level: EscalationLevel = EscalationLevel.N2_LOCAL_MEMORIA) -> FallbackResult:
        """Executa a cadeia de fallback a partir do nível especificado"""
        
        current_level = start_level
        
        while current_level != EscalationLevel.DESISTIR:
            self.logger.info(f"Tentando nível {current_level.name}")
            
            if current_level == EscalationLevel.N2_LOCAL_MEMORIA:
                result = self._execute_level_2(task_id, original_task)
            elif current_level == EscalationLevel.N3_EQUIPE_LOCAL:
                result = self._execute_level_3(task_id, original_task)
            elif current_level == EscalationLevel.N4_SUPERVISOR_ONLINE:
                result = self._execute_level_4(task_id, original_task)
            else:
                break
            
            if result.success:
                self.logger.info(f"Sucesso no nível {current_level.name}")
                return result
            else:
                self.logger.warning(f"Falha no nível {current_level.name}: {result.error}")
                # Escalar para próximo nível
                if current_level == EscalationLevel.N2_LOCAL_MEMORIA:
                    current_level = EscalationLevel.N3_EQUIPE_LOCAL
                elif current_level == EscalationLevel.N3_EQUIPE_LOCAL:
                    current_level = EscalationLevel.N4_SUPERVISOR_ONLINE
                elif current_level == EscalationLevel.N4_SUPERVISOR_ONLINE:
                    current_level = EscalationLevel.DESISTIR
        
        # Todos os níveis falharam
        return FallbackResult(
            success=False,
            level=EscalationLevel.DESISTIR,
            response=None,
            error="Todos os níveis de fallback falharam",
            execution_time=0.0
        )
'''

with open('fallback_manager.py', 'w') as f:
    f.write(fallback_manager_content)

print("✅ Arquivo fallback_manager.py criado com sucesso!")