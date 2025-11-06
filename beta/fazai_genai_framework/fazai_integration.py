"""
Integração com FazAI - Exemplo Completo
Demonstra como integrar o GenAI Mini Framework com o projeto FazAI existente
"""

import sys
import os
import logging
from typing import Optional, Dict, Any

# Adicionar framework ao path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from genai_mini_framework import GenAIMiniFramework, FrameworkConfig, TaskResult
from claude_integration import ClaudeIntegration

class FazAIEnhanced:
    """Versão melhorada do FazAI usando o GenAI Mini Framework"""

    def __init__(self, config: Optional[FrameworkConfig] = None):
        """Inicializa FazAI Enhanced com o framework"""

        # Configuração específica para FazAI
        if config is None:
            config = FrameworkConfig.from_env()

            # Customizações para FazAI
            config.qdrant.collection_memories = "fazai_memories"
            config.qdrant.collection_logs = "fazai_execution_logs"
            config.qdrant.collection_personality = "fazai_personality"
            config.max_steps = 50  # Mais passos para tarefas complexas
            config.timeout_seconds = 60  # Timeout maior

        self.config = config
        self.framework = GenAIMiniFramework(config)
        self.logger = logging.getLogger(__name__)

        # Compatibilidade com API original do FazAI
        self.task_history = []

        self.logger.info("🚀 FazAI Enhanced inicializado com GenAI Mini Framework")

    def run(self, task_description: str) -> bool:
        """
        Interface compatível com FazAI original
        Retorna True se sucesso, False se falha
        """
        try:
            result = self.framework.run_task(task_description)

            # Manter histórico para compatibilidade
            self.task_history.append({
                "task": task_description,
                "result": result,
                "timestamp": datetime.now().isoformat()
            })

            return result.success

        except Exception as e:
            self.logger.error(f"Erro ao executar tarefa: {e}")
            return False

    def run_detailed(self, task_description: str) -> TaskResult:
        """
        Versão estendida que retorna resultado completo
        """
        return self.framework.run_task(task_description)

    def import_claude_personality(self, claude_json_path: str) -> Dict[str, Any]:
        """Importa personalidade do Claude para melhorar o agente"""

        self.logger.info(f"Importando personalidade do Claude: {claude_json_path}")

        try:
            # Importar conversas
            stats = self.framework.import_claude_conversations(claude_json_path)

            # Criar perfil de personalidade
            personality_profile = self.framework.create_personality_from_claude()

            self.logger.info("✅ Personalidade do Claude importada com sucesso")

            return {
                "import_stats": stats,
                "personality_created": len(personality_profile) > 0,
                "personality_preview": personality_profile[:200] + "..." if personality_profile else ""
            }

        except Exception as e:
            self.logger.error(f"Erro ao importar personalidade: {e}")
            return {"error": str(e)}

    def learn_from_conversation(self, human_message: str, ai_response: str, context: str = ""):
        """Aprende de uma conversa específica"""

        # Armazenar como memória de aprendizado
        learning_content = f"""
        Contexto: {context}
        Pergunta: {human_message}
        Resposta: {ai_response}
        """

        self.framework.memory_manager.store_memory(
            content=learning_content,
            memory_type="conversation",
            metadata={
                "source": "fazai_learning",
                "human_message": human_message,
                "ai_response": ai_response,
                "context": context
            }
        )

        self.logger.info("💡 Aprendizado armazenado na memória")

    def search_knowledge(self, query: str, knowledge_type: str = "all") -> List[Dict[str, Any]]:
        """Busca conhecimento na base de memória"""

        if knowledge_type == "all":
            memories = self.framework.search_memory(query, limit=10)
        else:
            memories = self.framework.search_memory(query, knowledge_type, limit=10)

        return memories

    def get_enhanced_status(self) -> Dict[str, Any]:
        """Status estendido com métricas do FazAI"""

        base_status = self.framework.get_framework_status()
        cache_stats = self.framework.get_cache_stats()

        # Métricas específicas do FazAI
        fazai_metrics = {
            "tasks_in_history": len(self.task_history),
            "recent_success_rate": self._calculate_recent_success_rate(),
            "memory_knowledge_base": {
                "conversations": len(self.search_knowledge("", "conversation")),
                "procedures": len(self.search_knowledge("", "procedure")), 
                "personality": len(self.search_knowledge("", "personality"))
            }
        }

        return {
            **base_status,
            "cache_stats": cache_stats,
            "fazai_metrics": fazai_metrics
        }

    def _calculate_recent_success_rate(self, last_n: int = 10) -> float:
        """Calcula taxa de sucesso das últimas N tarefas"""
        if not self.task_history:
            return 0.0

        recent_tasks = self.task_history[-last_n:]
        successful = sum(1 for task in recent_tasks if task['result'].success)

        return successful / len(recent_tasks)

    def export_fazai_knowledge(self, output_file: str):
        """Exporta conhecimento acumulado para arquivo"""

        knowledge_export = {
            "export_date": datetime.now().isoformat(),
            "fazai_version": "enhanced_1.0",
            "framework_version": "genai_mini_1.0",
            "task_history": self.task_history,
            "knowledge_base": {
                "conversations": self.search_knowledge("", "conversation"),
                "procedures": self.search_knowledge("", "procedure"),
                "personality": self.search_knowledge("", "personality")
            },
            "performance_metrics": {
                "cache_stats": self.framework.get_cache_stats(),
                "success_rate": self._calculate_recent_success_rate()
            }
        }

        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(knowledge_export, f, indent=2, ensure_ascii=False, default=str)

        self.logger.info(f"Conhecimento exportado para: {output_file}")

# Função para migração suave do FazAI original
def migrate_from_original_fazai(original_fazai_data: str, output_dir: str = "./fazai_migration/"):
    """Migra dados do FazAI original para o framework enhanced"""

    os.makedirs(output_dir, exist_ok=True)

    try:
        # Carregar dados originais (formato específico do seu FazAI)
        with open(original_fazai_data, 'r', encoding='utf-8') as f:
            old_data = json.load(f)

        # Inicializar framework enhanced
        enhanced_fazai = FazAIEnhanced()

        # Migrar logs de execução (se existirem)
        if 'execution_logs' in old_data:
            for log in old_data['execution_logs']:
                enhanced_fazai.framework.memory_manager.store_memory(
                    content=log.get('description', ''),
                    memory_type="execution_log",
                    metadata={
                        "migrated_from": "original_fazai",
                        "original_timestamp": log.get('timestamp'),
                        "command": log.get('command'),
                        "success": log.get('success')
                    }
                )

        # Migrar configurações (se existirem)
        if 'settings' in old_data:
            settings_content = json.dumps(old_data['settings'], indent=2)
            enhanced_fazai.framework.memory_manager.store_memory(
                content=f"Configurações migradas: {settings_content}",
                memory_type="procedure",
                metadata={"migrated_from": "original_fazai_settings"}
            )

        # Salvar configuração migrada
        migration_report = {
            "migration_date": datetime.now().isoformat(),
            "source_file": original_fazai_data,
            "items_migrated": len(old_data.keys()),
            "framework_status": enhanced_fazai.get_enhanced_status()
        }

        with open(f"{output_dir}/migration_report.json", 'w') as f:
            json.dump(migration_report, f, indent=2, default=str)

        print(f"✅ Migração concluída. Relatório em: {output_dir}/migration_report.json")

        return enhanced_fazai

    except Exception as e:
        print(f"❌ Erro durante migração: {e}")
        return None

# Exemplo de uso com integração FazAI
if __name__ == "__main__":
    import argparse
    from datetime import datetime

    parser = argparse.ArgumentParser(description="FazAI Enhanced com GenAI Mini Framework")
    parser.add_argument("--task", help="Tarefa para executar")
    parser.add_argument("--import-claude", help="Arquivo JSON do Claude para importar")
    parser.add_argument("--migrate", help="Arquivo de dados do FazAI original para migrar")
    parser.add_argument("--status", action="store_true", help="Mostrar status do sistema")

    args = parser.parse_args()

    try:
        # Configurar logging
        logging.basicConfig(level=logging.INFO)

        # Inicializar FazAI Enhanced
        print("🚀 Inicializando FazAI Enhanced...")
        fazai = FazAIEnhanced()

        if args.task:
            # Executar tarefa
            print(f"📋 Executando tarefa: {args.task}")
            result = fazai.run_detailed(args.task)

            print(f"\n=== Resultado ===")
            print(f"✅ Sucesso: {result.success}")
            print(f"🔢 Passos: {result.steps_executed}")
            print(f"🎯 Nível final: {result.final_level.name}")
            print(f"⏱️ Tempo: {result.execution_time:.2f}s")

            if result.error:
                print(f"❌ Erro: {result.error}")

        elif args.import_claude:
            # Importar personalidade do Claude
            print(f"📥 Importando personalidade: {args.import_claude}")
            result = fazai.import_claude_personality(args.import_claude)

            print(f"\n=== Importação ===")
            print(f"Conversas: {result.get('import_stats', {}).get('conversations', 0)}")
            print(f"Mensagens: {result.get('import_stats', {}).get('messages', 0)}")
            print(f"Personalidade criada: {result.get('personality_created', False)}")

        elif args.migrate:
            # Migrar do FazAI original
            print(f"🔄 Migrando dados: {args.migrate}")
            migrated_fazai = migrate_from_original_fazai(args.migrate)

            if migrated_fazai:
                print("✅ Migração concluída com sucesso")
            else:
                print("❌ Falha na migração")

        elif args.status:
            # Mostrar status
            status = fazai.get_enhanced_status()

            print("\n=== Status FazAI Enhanced ===")
            print(f"Inicializado: {status['initialized']}")
            print(f"Cache habilitado: {status['cache_enabled']}")
            print(f"Tarefas no histórico: {status['fazai_metrics']['tasks_in_history']}")
            print(f"Taxa de sucesso: {status['fazai_metrics']['recent_success_rate']:.2%}")

            knowledge = status['fazai_metrics']['memory_knowledge_base']
            print(f"\nBase de Conhecimento:")
            print(f"  Conversas: {knowledge['conversations']}")
            print(f"  Procedimentos: {knowledge['procedures']}")
            print(f"  Personalidade: {knowledge['personality']}")

        else:
            print("❌ Nenhuma ação especificada")
            print("Use --help para ver opções disponíveis")

    except Exception as e:
        print(f"❌ Erro: {e}")
        sys.exit(1)
