# Criando exemplos de uso do framework
basic_usage_content = '''"""
Exemplo Básico de Uso - GenAI Mini Framework
Demonstra como usar o framework para tarefas simples
"""

import os
from genai_mini_framework import GenAIMiniFramework, FrameworkConfig

def exemplo_basico():
    """Exemplo básico de uso do framework"""
    
    print("=== Exemplo Básico - GenAI Mini Framework ===\\n")
    
    # 1. Configuração
    config = FrameworkConfig.from_env()
    
    # Verificar pré-requisitos
    if not config.genai.api_key:
        print("❌ ERRO: Google API Key não configurada")
        print("Configure com: export GOOGLE_API_KEY='sua_chave_aqui'")
        return
    
    try:
        # 2. Inicializar framework
        print("🚀 Inicializando framework...")
        framework = GenAIMiniFramework(config)
        
        # 3. Verificar status
        status = framework.get_framework_status()
        print(f"✅ Framework inicializado: {status['initialized']}")
        print(f"🗄️  Cache habilitado: {status['cache_enabled']}")
        print(f"🔄 Fallback habilitado: {status['fallback_enabled']}")
        print()
        
        # 4. Executar tarefa simples
        print("📋 Executando tarefa de exemplo...")
        task = "Listar os arquivos Python no diretório atual e contar quantos são"
        
        result = framework.run_task(task)
        
        # 5. Mostrar resultados
        print("\\n=== Resultado ===")
        print(f"✅ Sucesso: {result.success}")
        print(f"🔢 Passos executados: {result.steps_executed}")
        print(f"🎯 Nível final: {result.final_level.name}")
        print(f"⏱️  Tempo: {result.execution_time:.2f}s")
        
        if result.error:
            print(f"❌ Erro: {result.error}")
        
        # 6. Estatísticas do cache
        cache_stats = framework.get_cache_stats()
        if cache_stats.get('initialized'):
            print(f"\\n=== Cache Stats ===")
            print(f"📊 Taxa de acerto: {cache_stats.get('hit_rate', 0):.2%}")
            print(f"🎯 Acertos: {cache_stats.get('hits', 0)}")
            print(f"❌ Perdas: {cache_stats.get('misses', 0)}")
        
    except Exception as e:
        print(f"❌ Erro durante execução: {e}")

def exemplo_busca_memoria():
    """Exemplo de busca na memória"""
    
    print("\\n=== Exemplo - Busca na Memória ===\\n")
    
    config = FrameworkConfig.from_env()
    framework = GenAIMiniFramework(config)
    
    # Buscar memórias relacionadas a comandos
    print("🔍 Buscando memórias sobre 'arquivos python'...")
    memories = framework.search_memory("arquivos python", limit=3)
    
    print(f"📝 Encontradas {len(memories)} memórias:")
    for i, memory in enumerate(memories, 1):
        print(f"  {i}. [{memory['memory_type']}] {memory['content'][:100]}...")
        print(f"     Relevância: {memory['score']:.3f}")

def exemplo_configuracao_customizada():
    """Exemplo com configuração customizada"""
    
    print("\\n=== Exemplo - Configuração Customizada ===\\n")
    
    # Configuração customizada
    config = FrameworkConfig()
    config.max_steps = 10  # Limite menor
    config.timeout_seconds = 15  # Timeout menor
    config.enable_cache = True
    config.genai.api_key = os.getenv('GOOGLE_API_KEY', '')
    
    if not config.genai.api_key:
        print("❌ Google API Key necessária para este exemplo")
        return
    
    try:
        framework = GenAIMiniFramework(config)
        
        # Tarefa mais complexa
        task = """
        Crie um arquivo chamado 'teste_framework.txt' com informações 
        sobre o sistema: data atual, usuário logado e diretório atual
        """
        
        print(f"📋 Executando tarefa complexa...")
        result = framework.run_task(task)
        
        print(f"\\n✅ Tarefa {'concluída' if result.success else 'falhou'}")
        print(f"📊 Utilizou {result.steps_executed} de {config.max_steps} passos")
        
    except Exception as e:
        print(f"❌ Erro: {e}")

if __name__ == "__main__":
    # Executar exemplos
    exemplo_basico()
    exemplo_busca_memoria()  
    exemplo_configuracao_customizada()
    
    print("\\n🎉 Exemplos concluídos!")
'''

with open('basic_usage.py', 'w') as f:
    f.write(basic_usage_content)

# Criar exemplo de importação Claude
claude_import_content = '''"""
Exemplo de Importação de Diálogos do Claude
Demonstra como importar e processar arquivos JSON exportados do Claude
"""

import os
import json
from genai_mini_framework import GenAIMiniFramework, FrameworkConfig

def criar_exemplo_claude_json():
    """Cria um arquivo JSON de exemplo do Claude para teste"""
    
    exemplo_claude = {
        "conversations": [
            {
                "id": "conv_001",
                "title": "Discussão sobre Python e IA",
                "created_at": "2024-01-15T10:30:00Z",
                "messages": [
                    {
                        "id": "msg_001",
                        "role": "human",
                        "content": "Como implementar um sistema de cache para LLMs?",
                        "timestamp": "2024-01-15T10:30:00Z"
                    },
                    {
                        "id": "msg_002", 
                        "role": "assistant",
                        "content": "Para implementar cache em LLMs, recomendo usar embeddings semânticos. Você pode usar bibliotecas como GPTCache que fazem cache baseado em similaridade. O processo envolve: 1) Gerar embeddings das queries, 2) Comparar similaridade com queries anteriores, 3) Retornar resposta cached se similaridade > threshold.",
                        "timestamp": "2024-01-15T10:31:00Z"
                    },
                    {
                        "id": "msg_003",
                        "role": "human", 
                        "content": "Prefiro usar uma abordagem mais direta e simples. Sempre valorizo clareza sobre complexidade.",
                        "timestamp": "2024-01-15T10:32:00Z"
                    },
                    {
                        "id": "msg_004",
                        "role": "assistant",
                        "content": "Entendo sua preferência por simplicidade. Uma abordagem direta seria usar um cache baseado em hash da query. Algo como: cache[hash(query)] = response. É mais simples mas menos flexível que similarity matching.",
                        "timestamp": "2024-01-15T10:33:00Z"
                    }
                ]
            },
            {
                "id": "conv_002",
                "title": "Configuração de Servers",
                "created_at": "2024-01-16T14:00:00Z", 
                "messages": [
                    {
                        "id": "msg_005",
                        "role": "human",
                        "content": "Como configurar múltiplos servidores llama.cpp?",
                        "timestamp": "2024-01-16T14:00:00Z"
                    },
                    {
                        "id": "msg_006",
                        "role": "assistant",
                        "content": "Para configurar múltiplos servidores llama.cpp: 1) Execute cada servidor em porta diferente, 2) Use modelos específicos para cada papel (gerente, analista, programador), 3) Configure fallback entre eles. Comando exemplo: python -m llama_cpp.server --model modelo.gguf --port 8001",
                        "timestamp": "2024-01-16T14:01:00Z"
                    }
                ]
            }
        ]
    }
    
    os.makedirs("claude_exports", exist_ok=True)
    
    with open("claude_exports/exemplo_conversas.json", "w", encoding="utf-8") as f:
        json.dump(exemplo_claude, f, indent=2, ensure_ascii=False)
    
    print("✅ Arquivo de exemplo criado: claude_exports/exemplo_conversas.json")

def exemplo_importacao_claude():
    """Exemplo de importação de conversas do Claude"""
    
    print("=== Exemplo - Importação de Conversas Claude ===\\n")
    
    # 1. Criar arquivo de exemplo se não existir
    if not os.path.exists("claude_exports/exemplo_conversas.json"):
        print("📝 Criando arquivo de exemplo...")
        criar_exemplo_claude_json()
    
    # 2. Configurar framework
    config = FrameworkConfig.from_env()
    
    if not config.genai.api_key:
        print("❌ ERRO: Google API Key necessária para embeddings")
        print("Configure com: export GOOGLE_API_KEY='sua_chave_aqui'")
        return
    
    try:
        # 3. Inicializar framework
        print("🚀 Inicializando framework...")
        framework = GenAIMiniFramework(config)
        
        # 4. Importar conversas
        print("📥 Importando conversas do Claude...")
        stats = framework.import_claude_conversations("claude_exports/exemplo_conversas.json")
        
        print("\\n=== Estatísticas da Importação ===")
        print(f"📄 Conversas processadas: {stats.get('conversations', 0)}")
        print(f"💬 Mensagens importadas: {stats.get('messages', 0)}")
        print(f"🎭 Entradas de personalidade: {stats.get('personality_entries', 0)}")
        print(f"⚙️  Entradas procedimentais: {stats.get('procedural_entries', 0)}")
        
        # 5. Testar busca na memória importada
        print("\\n🔍 Testando busca nas memórias importadas...")
        
        # Buscar informações sobre cache
        memories = framework.search_memory("cache LLM implementar", limit=2)
        print(f"\\n📋 Encontradas {len(memories)} memórias sobre cache:")
        for memory in memories:
            print(f"  - [{memory['memory_type']}] {memory['content'][:150]}...")
            print(f"    Relevância: {memory['score']:.3f}")
        
        # Buscar preferências de personalidade
        personality_memories = framework.search_memory("preferência simplicidade abordagem", limit=2)
        if personality_memories:
            print(f"\\n🎭 Preferências de personalidade encontradas:")
            for memory in personality_memories:
                print(f"  - {memory['content'][:100]}...")
                print(f"    Relevância: {memory['score']:.3f}")
        
        # 6. Criar perfil de personalidade
        print("\\n🎨 Criando perfil de personalidade baseado nas conversas...")
        personality_profile = framework.create_personality_from_claude()
        
        if personality_profile:
            print("✅ Perfil de personalidade criado!")
            print(f"Preview: {personality_profile[:200]}...")
        
    except Exception as e:
        print(f"❌ Erro durante importação: {e}")

def exemplo_importacao_diretorio():
    """Exemplo de importação de diretório completo"""
    
    print("\\n=== Exemplo - Importação de Diretório ===\\n")
    
    # Criar mais arquivos de exemplo
    criar_arquivos_exemplo_multiplos()
    
    config = FrameworkConfig.from_env()
    
    if not config.genai.api_key:
        print("❌ Google API Key necessária")
        return
    
    try:
        framework = GenAIMiniFramework(config)
        
        print("📂 Importando todos os arquivos JSON do diretório claude_exports/...")
        stats = framework.import_claude_conversations("claude_exports/")
        
        print("\\n=== Estatísticas Totais ===")
        print(f"📁 Arquivos processados: {stats.get('files_processed', 0)}")
        print(f"❌ Arquivos com erro: {stats.get('files_failed', 0)}")
        print(f"📄 Total de conversas: {stats.get('conversations', 0)}")
        print(f"💬 Total de mensagens: {stats.get('messages', 0)}")
        
    except Exception as e:
        print(f"❌ Erro: {e}")

def criar_arquivos_exemplo_multiplos():
    """Cria múltiplos arquivos de exemplo"""
    
    # Arquivo focado em personalidade
    personalidade_exemplo = {
        "id": "conv_personality",
        "title": "Definindo Personalidade",
        "messages": [
            {
                "role": "human",
                "content": "Minha personalidade de trabalho é bem direta. Gosto de soluções práticas e não gosto de complicar. Sempre prefiro fazer as coisas do jeito mais simples possível."
            },
            {
                "role": "assistant", 
                "content": "Entendo, você valoriza praticidade e simplicidade. Vou sempre priorizar soluções diretas e evitar complexidade desnecessária."
            },
            {
                "role": "human",
                "content": "Exato. E costumo testar muito antes de implementar algo em produção. Meu jeito é sempre validar cada passo."
            }
        ]
    }
    
    # Arquivo focado em procedimentos
    procedimentos_exemplo = {
        "id": "conv_procedures", 
        "title": "Procedimentos de Deploy",
        "messages": [
            {
                "role": "human",
                "content": "Como fazer deploy do framework? Quero um passo a passo detalhado."
            },
            {
                "role": "assistant",
                "content": "Passo a passo para deploy: 1) Instalar dependências com pip install -r requirements.txt, 2) Configurar variáveis de ambiente, 3) Iniciar Qdrant com docker, 4) Executar servidores llama.cpp, 5) Testar conectividade, 6) Executar framework."
            }
        ]
    }
    
    # Salvar arquivos
    os.makedirs("claude_exports", exist_ok=True)
    
    with open("claude_exports/personalidade.json", "w", encoding="utf-8") as f:
        json.dump(personalidade_exemplo, f, indent=2, ensure_ascii=False)
    
    with open("claude_exports/procedimentos.json", "w", encoding="utf-8") as f:
        json.dump(procedimentos_exemplo, f, indent=2, ensure_ascii=False)
    
    print("✅ Arquivos de exemplo adicionais criados")

if __name__ == "__main__":
    exemplo_importacao_claude()
    exemplo_importacao_diretorio()
    
    print("\\n🎉 Exemplos de importação concluídos!")
'''

with open('claude_import.py', 'w') as f:
    f.write(claude_import_content)

print("✅ Arquivos de exemplo criados com sucesso!")
print("- basic_usage.py")
print("- claude_import.py")