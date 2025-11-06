"""
Exemplo Básico de Uso - GenAI Mini Framework
Demonstra como usar o framework para tarefas simples
"""

import os
from genai_mini_framework import GenAIMiniFramework, FrameworkConfig

def exemplo_basico():
    """Exemplo básico de uso do framework"""

    print("=== Exemplo Básico - GenAI Mini Framework ===\n")

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
        print("\n=== Resultado ===")
        print(f"✅ Sucesso: {result.success}")
        print(f"🔢 Passos executados: {result.steps_executed}")
        print(f"🎯 Nível final: {result.final_level.name}")
        print(f"⏱️  Tempo: {result.execution_time:.2f}s")

        if result.error:
            print(f"❌ Erro: {result.error}")

        # 6. Estatísticas do cache
        cache_stats = framework.get_cache_stats()
        if cache_stats.get('initialized'):
            print(f"\n=== Cache Stats ===")
            print(f"📊 Taxa de acerto: {cache_stats.get('hit_rate', 0):.2%}")
            print(f"🎯 Acertos: {cache_stats.get('hits', 0)}")
            print(f"❌ Perdas: {cache_stats.get('misses', 0)}")

    except Exception as e:
        print(f"❌ Erro durante execução: {e}")

def exemplo_busca_memoria():
    """Exemplo de busca na memória"""

    print("\n=== Exemplo - Busca na Memória ===\n")

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

    print("\n=== Exemplo - Configuração Customizada ===\n")

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

        print(f"\n✅ Tarefa {'concluída' if result.success else 'falhou'}")
        print(f"📊 Utilizou {result.steps_executed} de {config.max_steps} passos")

    except Exception as e:
        print(f"❌ Erro: {e}")

if __name__ == "__main__":
    # Executar exemplos
    exemplo_basico()
    exemplo_busca_memoria()  
    exemplo_configuracao_customizada()

    print("\n🎉 Exemplos concluídos!")
