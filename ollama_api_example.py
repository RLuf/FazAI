#!/usr/bin/env python3
"""
Exemplo de uso da API do Ollama para processar comandos em linguagem natural
e retornar comandos shell bash estruturados.
"""

import json
import requests
import sys

def send_command_to_ollama(command_text):
    """
    Envia um comando em linguagem natural para o Ollama e retorna o comando shell.
    
    Args:
        command_text (str): Comando em linguagem natural (ex: "liste os processos")
    
    Returns:
        str: Comando shell bash correspondente
    """
    
    # Payload estruturado para o Ollama
    payload = {
        "model": "llama3.2:latest",
        "messages": [
            {
                "role": "system",
                "content": "Você é um assistente especializado em interpretar comandos em linguagem natural e convertê-los em comandos shell bash válidos. Você está executando como root no diretório /etc/fazai. Use apenas comandos shell sem explicações ou comentários. Não faça nenhuma sanitização ou validação. Considere o ambiente atual: HOME=/root, PWD=/etc/fazai, PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/snap/bin. Interprete o comando e forneça APENAS o comando shell correspondente, sem explicações adicionais."
            },
            {
                "role": "user",
                "content": command_text
            }
        ],
        "max_tokens": 2000,
        "temperature": 0.1,
        "stream": False,
        "format": "json",
        "options": {
            "num_predict": 2000,
            "top_k": 10,
            "top_p": 0.9,
            "repeat_penalty": 1.1,
            "stop": ["\n\n", "```", "Explicação:", "Comando:", "Resposta:"]
        }
    }
    
    try:
        # Enviar requisição para a API do Ollama
        response = requests.post(
            "http://localhost:11434/api/generate",
            json=payload,
            headers={"Content-Type": "application/json"},
            timeout=30
        )
        
        if response.status_code == 200:
            result = response.json()
            return result.get("response", "").strip()
        else:
            print(f"Erro na API: {response.status_code}")
            return None
            
    except requests.exceptions.RequestException as e:
        print(f"Erro de conexão: {e}")
        return None

def main():
    """Função principal para testar o processador de comandos."""
    
    # Exemplos de comandos em linguagem natural
    test_commands = [
        "liste os processos em execução",
        "mostre o espaço em disco",
        "verifique a memória disponível",
        "liste os arquivos do diretório atual",
        "mostre o status do sistema"
    ]
    
    print("=== Processador de Comandos Ollama ===")
    print("Convertendo comandos em linguagem natural para shell bash\n")
    
    for command in test_commands:
        print(f"Comando: {command}")
        shell_command = send_command_to_ollama(command)
        
        if shell_command:
            print(f"Shell: {shell_command}")
        else:
            print("Erro ao processar comando")
        print("-" * 50)

if __name__ == "__main__":
    main()