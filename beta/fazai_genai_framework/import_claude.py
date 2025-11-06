#!/usr/bin/env python3

"""
Script de Importação de Diálogos Claude
Ferramenta de linha de comando para importar conversas do Claude para o framework
"""

import argparse
import os
import sys
import logging
from pathlib import Path

# Adicionar o diretório atual ao path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

try:
    from genai_mini_framework import GenAIMiniFramework, FrameworkConfig
    from claude_integration import ClaudeIntegration
    from memory_manager import MemoryManager
except ImportError as e:
    print(f"❌ Erro de import: {e}")
    print("Certifique-se de que o framework está instalado corretamente")
    sys.exit(1)

def setup_logging(verbose=False):
    """Configura logging"""
    level = logging.DEBUG if verbose else logging.INFO
    logging.basicConfig(
        level=level,
        format='%(asctime)s - %(levelname)s - %(message)s'
    )

def validate_google_api_key():
    """Valida se Google API Key está configurada"""
    api_key = os.getenv('GOOGLE_API_KEY')
    if not api_key:
        print("❌ ERRO: Google API Key não configurada")
        print("Configure com:")
        print("  export GOOGLE_API_KEY='sua_chave_aqui'")
        print("  ou crie arquivo .env com GOOGLE_API_KEY=sua_chave_aqui")
        return False
    return True

def import_single_file(framework, file_path, verbose=False):
    """Importa um arquivo JSON único"""
    if not os.path.exists(file_path):
        print(f"❌ Arquivo não encontrado: {file_path}")
        return False

    print(f"📥 Importando arquivo: {file_path}")

    try:
        stats = framework.import_claude_conversations(file_path)

        print("✅ Importação concluída!")
        print(f"  📄 Conversas: {stats.get('conversations', 0)}")
        print(f"  💬 Mensagens: {stats.get('messages', 0)}")
        print(f"  🎭 Personalidade: {stats.get('personality_entries', 0)}")
        print(f"  ⚙️  Procedimentos: {stats.get('procedural_entries', 0)}")

        return True

    except Exception as e:
        print(f"❌ Erro durante importação: {e}")
        if verbose:
            import traceback
            traceback.print_exc()
        return False

def import_directory(framework, dir_path, verbose=False):
    """Importa todos os arquivos JSON de um diretório"""
    if not os.path.isdir(dir_path):
        print(f"❌ Diretório não encontrado: {dir_path}")
        return False

    print(f"📁 Importando diretório: {dir_path}")

    # Contar arquivos JSON
    json_files = list(Path(dir_path).glob("*.json"))
    if not json_files:
        print(f"⚠️  Nenhum arquivo JSON encontrado em {dir_path}")
        return False

    print(f"📋 Encontrados {len(json_files)} arquivos JSON")

    try:
        stats = framework.import_claude_conversations(dir_path)

        print("✅ Importação concluída!")
        print(f"  📁 Arquivos processados: {stats.get('files_processed', 0)}")
        print(f"  ❌ Arquivos com erro: {stats.get('files_failed', 0)}")
        print(f"  📄 Total conversas: {stats.get('conversations', 0)}")
        print(f"  💬 Total mensagens: {stats.get('messages', 0)}")
        print(f"  🎭 Entradas personalidade: {stats.get('personality_entries', 0)}")
        print(f"  ⚙️  Entradas procedimentos: {stats.get('procedural_entries', 0)}")

        return True

    except Exception as e:
        print(f"❌ Erro durante importação: {e}")
        if verbose:
            import traceback
            traceback.print_exc()
        return False

def create_personality_profile(framework, verbose=False):
    """Cria perfil de personalidade baseado nas memórias"""
    print("🎨 Criando perfil de personalidade...")

    try:
        profile = framework.create_personality_from_claude()

        if profile:
            print("✅ Perfil de personalidade criado!")

            # Salvar em arquivo
            profile_file = "personality_profile.txt"
            with open(profile_file, 'w', encoding='utf-8') as f:
                f.write(profile)

            print(f"💾 Perfil salvo em: {profile_file}")

            # Mostrar preview
            lines = profile.split('\n')[:10]
            print("\n📋 Preview do perfil:")
            for line in lines:
                print(f"  {line}")

            if len(profile.split('\n')) > 10:
                print("  ...")

            return True
        else:
            print("⚠️  Nenhuma informação de personalidade encontrada")
            return False

    except Exception as e:
        print(f"❌ Erro ao crear perfil: {e}")
        if verbose:
            import traceback
            traceback.print_exc()
        return False

def search_memories(framework, query, memory_type=None, limit=5):
    """Busca memórias importadas"""
    print(f"🔍 Buscando: '{query}'")
    if memory_type:
        print(f"   Tipo: {memory_type}")

    try:
        memories = framework.search_memory(query, memory_type, limit)

        if memories:
            print(f"\n📝 Encontradas {len(memories)} memórias:")
            for i, memory in enumerate(memories, 1):
                print(f"\n  {i}. [{memory['memory_type']}] Score: {memory['score']:.3f}")
                content = memory['content'][:200] + "..." if len(memory['content']) > 200 else memory['content']
                print(f"     {content}")

                # Metadados relevantes
                if 'conversation_title' in memory['metadata']:
                    print(f"     📄 Conversa: {memory['metadata']['conversation_title']}")
        else:
            print("❌ Nenhuma memória encontrada")

    except Exception as e:
        print(f"❌ Erro na busca: {e}")

def main():
    parser = argparse.ArgumentParser(
        description="Import Claude conversations to GenAI Mini Framework",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Exemplos de uso:

  # Importar arquivo único
  python import_claude.py -f conversa.json

  # Importar diretório
  python import_claude.py -d ./claude_exports/

  # Criar perfil de personalidade após importação
  python import_claude.py --create-personality

  # Buscar memórias
  python import_claude.py --search "configurar servidor"

  # Buscar só personalidade
  python import_claude.py --search "preferências" --type personality
        """
    )

    # Argumentos principais
    group = parser.add_mutually_exclusive_group()
    group.add_argument('-f', '--file', help='Arquivo JSON do Claude para importar')
    group.add_argument('-d', '--directory', help='Diretório com arquivos JSON do Claude')
    group.add_argument('--create-personality', action='store_true', 
                      help='Criar perfil de personalidade das memórias existentes')
    group.add_argument('--search', help='Buscar nas memórias importadas')

    # Argumentos opcionais
    parser.add_argument('--type', choices=['conversation', 'personality', 'procedure'],
                       help='Tipo de memória para buscar')
    parser.add_argument('--limit', type=int, default=5,
                       help='Limite de resultados na busca (padrão: 5)')
    parser.add_argument('-v', '--verbose', action='store_true',
                       help='Logs detalhados')

    args = parser.parse_args()

    # Setup
    setup_logging(args.verbose)

    # Validar API Key
    if not validate_google_api_key():
        sys.exit(1)

    try:
        # Inicializar framework
        print("🚀 Inicializando framework...")
        config = FrameworkConfig.from_env()
        framework = GenAIMiniFramework(config)
        print("✅ Framework inicializado")

        # Executar ação solicitada
        success = False

        if args.file:
            success = import_single_file(framework, args.file, args.verbose)

        elif args.directory:
            success = import_directory(framework, args.directory, args.verbose)

        elif args.create_personality:
            success = create_personality_profile(framework, args.verbose)

        elif args.search:
            search_memories(framework, args.search, args.type, args.limit)
            success = True

        else:
            print("❌ Nenhuma ação especificada")
            print("Use --help para ver opções disponíveis")
            sys.exit(1)

        if success:
            print("\n🎉 Operação concluída com sucesso!")
        else:
            print("\n❌ Operação falhou")
            sys.exit(1)

    except KeyboardInterrupt:
        print("\n⏹️  Operação cancelada pelo usuário")
        sys.exit(1)

    except Exception as e:
        print(f"\n❌ Erro inesperado: {e}")
        if args.verbose:
            import traceback
            traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    main()
