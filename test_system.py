#!/usr/bin/env python3
"""
Script de teste para validar o sistema Shell Assistant
"""

import json
import requests
import subprocess
import sys
from typing import Dict, List, Tuple

def test_ollama_connection() -> bool:
    """Testa conexão com Ollama"""
    try:
        response = requests.get("http://localhost:11434/api/tags", timeout=5)
        return response.status_code == 200
    except:
        return False

def test_model_availability(model: str) -> bool:
    """Testa se o modelo está disponível"""
    try:
        response = requests.get("http://localhost:11434/api/tags", timeout=5)
        if response.status_code == 200:
            models = response.json().get("models", [])
            return any(m.get("name", "").startswith(model) for m in models)
        return False
    except:
        return False

def test_command_generation(prompt: str, expected_command: str, model: str = "llama3.2:latest") -> Tuple[bool, str]:
    """Testa geração de comando"""
    url = "http://localhost:11434/api/chat"
    
    payload = {
        "model": model,
        "messages": [
            {
                "role": "system",
                "content": "Você é um assistente especializado em comandos shell Linux. Sua função é interpretar comandos em linguagem natural e retornar APENAS o comando shell correspondente, sem explicações, comentários ou formatação adicional.\n\nRegras:\n- Retorne apenas o comando shell puro\n- Não adicione explicações ou comentários\n- Não use markdown ou formatação\n- Use comandos padrão do Linux\n- Considere o contexto: usuário root, diretório atual, variáveis de ambiente\n- Se múltiplos comandos forem necessários, separe-os com '&&' ou ';'\n- Para comandos que requerem privilégios, use 'sudo' quando apropriado"
            },
            {
                "role": "user",
                "content": prompt
            }
        ],
        "max_tokens": 2000,
        "temperature": 0.1,
        "stream": False
    }
    
    try:
        response = requests.post(url, json=payload, timeout=30)
        if response.status_code == 200:
            result = response.json()
            generated_command = result['message']['content'].strip()
            
            # Comparação flexível - ignora espaços extras e diferenças menores
            generated_clean = generated_command.replace("  ", " ").strip()
            expected_clean = expected_command.replace("  ", " ").strip()
            
            success = generated_clean == expected_clean
            return success, generated_command
        else:
            return False, f"Erro HTTP: {response.status_code}"
    except Exception as e:
        return False, f"Erro: {str(e)}"

def test_safe_command_execution(command: str) -> Tuple[bool, str]:
    """Testa execução segura de comando (apenas comandos de leitura)"""
    safe_commands = [
        "ps aux", "df -h", "free -h", "ls -la", "uname -a", 
        "whoami", "pwd", "echo 'test'", "date", "uptime"
    ]
    
    # Verifica se é um comando seguro
    command_base = command.split()[0] if command else ""
    is_safe = any(safe in command for safe in safe_commands)
    
    if not is_safe:
        return False, "Comando não é seguro para teste automático"
    
    try:
        result = subprocess.run(command, shell=True, capture_output=True, text=True, timeout=10)
        if result.returncode == 0:
            return True, result.stdout[:200] + "..." if len(result.stdout) > 200 else result.stdout
        else:
            return False, result.stderr
    except subprocess.TimeoutExpired:
        return False, "Timeout na execução"
    except Exception as e:
        return False, f"Erro: {str(e)}"

def run_tests():
    """Executa todos os testes"""
    print("=== Teste do Sistema Shell Assistant ===\n")
    
    # Teste 1: Conexão com Ollama
    print("1. Testando conexão com Ollama...")
    if test_ollama_connection():
        print("   ✅ Ollama está rodando")
    else:
        print("   ❌ Ollama não está acessível")
        print("   Execute: ollama serve")
        return False
    
    # Teste 2: Disponibilidade do modelo
    print("\n2. Testando disponibilidade do modelo llama3.2...")
    if test_model_availability("llama3.2"):
        print("   ✅ Modelo llama3.2 disponível")
    else:
        print("   ❌ Modelo llama3.2 não encontrado")
        print("   Execute: ollama pull llama3.2:latest")
        return False
    
    # Teste 3: Geração de comandos
    print("\n3. Testando geração de comandos...")
    
    test_cases = [
        ("liste os processos em execução", "ps aux"),
        ("mostre o espaço em disco", "df -h"),
        ("mostre o uso de memória", "free -h"),
        ("crie um arquivo teste.txt", "touch teste.txt"),
        ("mostre informações do sistema", "uname -a")
    ]
    
    passed_tests = 0
    total_tests = len(test_cases)
    
    for prompt, expected in test_cases:
        print(f"   Testando: '{prompt}'")
        success, result = test_command_generation(prompt, expected)
        
        if success:
            print(f"   ✅ Gerado: '{result}'")
            passed_tests += 1
        else:
            print(f"   ❌ Esperado: '{expected}', Gerado: '{result}'")
    
    print(f"\n   Resultado: {passed_tests}/{total_tests} testes passaram")
    
    # Teste 4: Execução segura de comandos
    print("\n4. Testando execução segura de comandos...")
    
    safe_test_cases = [
        ("ps aux", "Lista de processos"),
        ("df -h", "Espaço em disco"),
        ("free -h", "Uso de memória"),
        ("uname -a", "Informações do sistema")
    ]
    
    safe_passed = 0
    safe_total = len(safe_test_cases)
    
    for command, description in safe_test_cases:
        print(f"   Testando: {description} ({command})")
        success, output = test_safe_command_execution(command)
        
        if success:
            print(f"   ✅ Executado com sucesso")
            safe_passed += 1
        else:
            print(f"   ❌ Falha: {output}")
    
    print(f"\n   Resultado: {safe_passed}/{safe_total} comandos executados com sucesso")
    
    # Resumo final
    print("\n=== Resumo dos Testes ===")
    print(f"✅ Conexão Ollama: OK")
    print(f"✅ Modelo disponível: OK")
    print(f"✅ Geração de comandos: {passed_tests}/{total_tests}")
    print(f"✅ Execução segura: {safe_passed}/{safe_total}")
    
    overall_success = passed_tests >= total_tests * 0.8 and safe_passed >= safe_total * 0.8
    
    if overall_success:
        print("\n🎉 Sistema funcionando corretamente!")
        return True
    else:
        print("\n⚠️  Sistema com problemas. Verifique os erros acima.")
        return False

def test_specific_command():
    """Testa um comando específico fornecido pelo usuário"""
    if len(sys.argv) < 3:
        print("Uso: python3 test_system.py test <comando em linguagem natural>")
        return
    
    prompt = " ".join(sys.argv[2:])
    print(f"Testando comando: '{prompt}'")
    
    success, result = test_command_generation(prompt, "")
    if success:
        print(f"✅ Comando gerado: '{result}'")
        
        # Testa execução se for seguro
        exec_success, exec_output = test_safe_command_execution(result)
        if exec_success:
            print(f"✅ Executado com sucesso")
            print(f"Saída: {exec_output}")
        else:
            print(f"⚠️  Não foi possível executar automaticamente: {exec_output}")
    else:
        print(f"❌ Erro na geração: {result}")

if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "test":
        test_specific_command()
    else:
        run_tests()