#!/usr/bin/env python3
"""
Script standalone para descoberta de bindings FazAI
Uso: python discover_bindings.py [--detailed] [--test-load]
"""

import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from fazai_integration_adapter import discover_fazai_bindings
import argparse

def main():
    parser = argparse.ArgumentParser(description="Descoberta de bindings FazAI")
    parser.add_argument('--detailed', action='store_true', 
                       help="Análise detalhada com símbolos e dependências")
    parser.add_argument('--test-load', action='store_true',
                       help="Testa carregamento de todas as bindings encontradas")
    parser.add_argument('--search-path', action='append',
                       help="Path adicional para busca")
    
    args = parser.parse_args()
    
    # Configura ambiente
    if args.detailed:
        os.environ['FAZAI_DEBUG_BINDINGS'] = '1'
    
    # Executa descoberta
    print("🚀 Iniciando descoberta de bindings FazAI...\n")
    discovery = discover_fazai_bindings()
    
    # Testes de carregamento se solicitado
    if args.test_load and discovery['analyzed_bindings']:
        print("\n🧪 TESTANDO CARREGAMENTO DAS BINDINGS:")
        for binding in discovery['analyzed_bindings']:
            print(f"\n   Testando: {binding['name']}")
            
            if binding['loadable']['ctypes_loadable']:
                print("   ✓ ctypes.CDLL() - OK")
            else:
                print(f"   ✗ ctypes.CDLL() - {binding['loadable'].get('error', 'Erro desconhecido')}")
            
            if binding['loadable']['python_importable']:
                print("   ✓ importlib - OK")
                if 'attributes' in binding['loadable']:
                    print(f"     Métodos: {', '.join(binding['loadable']['attributes'][:3])}")
            else:
                print("   ✗ importlib - Não é módulo Python")
    
    # Sumário final
    total_found = len(discovery['found_bindings'])
    loadable = len([b for b in discovery['analyzed_bindings'] if b['loadable']['ctypes_loadable']])
    
    print(f"\n📊 SUMÁRIO:")
    print(f"   Total encontradas: {total_found}")
    print(f"   Carregáveis: {loadable}")
    print(f"   Taxa sucesso: {(loadable/total_found*100) if total_found > 0 else 0:.1f}%")
    
    if loadable == 0:
        print("\n⚠️  NENHUMA BINDING CARREGÁVEL ENCONTRADA!")
        print("   Possíveis causas:")
        print("   - Bindings não compiladas")
        print("   - Dependências faltantes (ldd <path>)")  
        print("   - Incompatibilidade arquitetura")
        print("   - Permissões incorretas")
        return 1
    
    return 0

if __name__ == "__main__":
    sys.exit(main())
