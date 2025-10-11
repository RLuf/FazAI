#!/usr/bin/env python3
"""
FazAI Gemma Native - Teste e Exemplo de Uso
Neste script testamos o módulo gemma_native compilado
"""

import sys
import os

# Importar módulo (assumindo que foi compilado)
try:
    import gemma_native
    print("✓ Módulo gemma_native importado com sucesso!")
except ImportError as e:
    print(f"✗ Erro ao importar gemma_native: {e}")
    print("\nCertifique-se que o módulo foi compilado:")
    print("g++ -O3 -Wall -shared -std=c++17 -fPIC `python3 -m pybind11 --includes` gemma_native.cpp worker/build/libgemma_capi_real.a -o gemma_native`python3-config --extension-suffix`")
    sys.exit(1)

def test_function_interface():
    """Testa interface da função direta"""
    print("\n" + "="*60)
    print("Testando interface da função generate()")
    print("="*60)

    try:
        # Teste básico
        prompt = "Oi Gemma, como você está?"
        print(f"Prompt: {prompt}")
        result = gemma_native.generate(prompt)
        print(f"Resposta: {result}")

        # Teste técnico
        prompt2 = "Explique brevemente o que é Python"
        print(f"\nPrompt: {prompt2}")
        result2 = gemma_native.generate(prompt2)
        print(f"Resposta: {result2}")

    except Exception as e:
        print(f"✗ Erro na chamada direta: {e}")

def test_class_interface():
    """Testa interface da classe GemmaNative"""
    print("\n" + "="*60)
    print("Testando interface da classe GemmaNative")
    print("="*60)

    try:
        # Criar instância
        gemma = gemma_native.GemmaNative()
        print(f"Instância criada: {gemma}")
        print(f"Inicializada: {gemma.is_initialized()}")

        # Testar inicialização preguiçosa
        prompt = "Olá, quem é você?"
        print(f"\nPrompt: {prompt}")
        result = gemma.generate(prompt)
        print(f"Resposta: {result}")
        print(f"Inicializada após uso: {gemma.is_initialized()}")

        # Testar isolamento (múltiplas instâncias)
        gemma2 = gemma_native.GemmaNative()
        prompt2 = "Diga apenas 'oi' em português"
        print(f"\nSegunda instância - Prompt: {prompt2}")
        result2 = gemma2.generate(prompt2)
        print(f"Resposta segunda instância: {result2}")

        # Verificar versão do módulo
        print(f"Versão do módulo: {gemma_native.__version__}")
        print(f"Autor: {gemma_native.__author__}")

    except Exception as e:
        print(f"✗ Erro na classe: {e}")

def demo_fazai_integration():
    """Demonstra integração com workflow FazAI"""
    print("\n" + "="*60)
    print("Demonstração de Integração FazAI")
    print("="*60)

    try:
        # Simular chamadas típicas do FazAI
        commands = [
            "listar arquivos no diretório atual",
            "verificar status da memória",
            "explicar o que é docker",
            "criar uma função simples em python",
        ]

        for cmd in commands:
            print(f"\n→ Comando: {cmd}")
            response = gemma_native.generate(cmd)
            print(f"← Gemma: {response[:100]}..." if len(response) > 100 else f"← Gemma: {response}")

        print("\n✓ Demonstração concluída!")

    except Exception as e:
        print(f"✗ Erro na integração: {e}")

def main():
    """Função principal do teste"""
    print("FazAI Gemma Native - Teste e Demonstração")
    print("Dev Planet - Roger Luft")
    print("="*60)

    # Verificar se está executando no FazAI
    if not os.path.exists('/opt/fazai/models/gemma/2.0-2b-it-sfp.sbs'):
        print("⚠️  AVISO: Pesos do modelo não encontrados em /opt/fazai/models/gemma/")
        print("   Compilação em stub mode - apenas demonstração estrutural")
        print()

    # Executar testes
    test_function_interface()
    test_class_interface()
    demo_fazai_integration()

    print("\n" + "="*60)
    print("Teste concluído!")
    print("="*60)

if __name__ == "__main__":
    main()
