#!/usr/bin/env python3
"""
Exemplo de uso da API Ollama para executar comandos shell a partir de linguagem natural
"""

import json
import requests
import subprocess
import sys

def send_to_ollama(prompt, model="llama3.2:latest"):
    """
    Envia prompt para Ollama e retorna o comando shell
    """
    url = "http://localhost:11434/api/chat"
    
    payload = {
        "model": model,
        "messages": [
            {
                "role": "system",
                "content": "Você é um assistente especializado em comandos shell Linux. Sua função é interpretar comandos em linguagem natural e retornar APENAS o comando shell correspondente, sem explicações, comentários ou formatação adicional.\n\nRegras:\n- Retorne apenas o comando shell puro\n- Não adicione explicações ou comentários\n- Não use markdown ou formatação\n- Use comandos padrão do Linux\n- Considere o contexto: usuário root, diretório atual, variáveis de ambiente\n- Se múltiplos comandos forem necessários, separe-os com '&&' ou ';'\n- Para comandos que requerem privilégios, use 'sudo' quando apropriado\n\nExemplos:\n- Input: 'liste os processos em execução' → Output: 'ps aux'\n- Input: 'mostre o espaço em disco' → Output: 'df -h'\n- Input: 'crie um arquivo teste.txt' → Output: 'touch teste.txt'\n- Input: 'liste arquivos e depois mostre o uso de memória' → Output: 'ls -la && free -h'"
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
        response.raise_for_status()
        
        result = response.json()
        return result['message']['content'].strip()
        
    except requests.exceptions.RequestException as e:
        print(f"Erro na comunicação com Ollama: {e}")
        return None
    except KeyError as e:
        print(f"Erro no formato da resposta: {e}")
        return None

def execute_command(command):
    """
    Executa o comando shell retornado pelo modelo
    """
    try:
        print(f"Executando: {command}")
        result = subprocess.run(command, shell=True, capture_output=True, text=True)
        
        if result.stdout:
            print("Saída:")
            print(result.stdout)
        
        if result.stderr:
            print("Erros:")
            print(result.stderr)
            
        return result.returncode == 0
        
    except Exception as e:
        print(f"Erro ao executar comando: {e}")
        return False

def main():
    if len(sys.argv) < 2:
        print("Uso: python3 ollama_api_example.py 'comando em linguagem natural'")
        print("Exemplo: python3 ollama_api_example.py 'liste os processos em execução'")
        sys.exit(1)
    
    prompt = " ".join(sys.argv[1:])
    print(f"Prompt: {prompt}")
    
    # Obtém o comando do Ollama
    command = send_to_ollama(prompt)
    
    if command:
        print(f"Comando gerado: {command}")
        
        # Pergunta se deve executar
        response = input("Executar este comando? (y/N): ").lower().strip()
        if response in ['y', 'yes', 's', 'sim']:
            execute_command(command)
        else:
            print("Comando não executado.")
    else:
        print("Não foi possível gerar um comando.")

if __name__ == "__main__":
    main()