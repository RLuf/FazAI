#!/usr/bin/env python3
"""
Shell Assistant - Executa comandos shell a partir de linguagem natural usando diferentes modelos de IA
"""

import json
import requests
import subprocess
import sys
import os
from typing import Optional, Dict, Any

class ShellAssistant:
    def __init__(self, config_file: str = "model_configs.json"):
        """Inicializa o assistente com configurações dos modelos"""
        self.config = self.load_config(config_file)
        self.current_model = "llama3.2"
        
    def load_config(self, config_file: str) -> Dict[str, Any]:
        """Carrega configurações dos modelos"""
        try:
            with open(config_file, 'r', encoding='utf-8') as f:
                return json.load(f)
        except FileNotFoundError:
            print(f"Arquivo de configuração {config_file} não encontrado.")
            sys.exit(1)
    
    def set_model(self, model_name: str) -> bool:
        """Define o modelo a ser usado"""
        if model_name in self.config["models"]:
            self.current_model = model_name
            print(f"Modelo alterado para: {model_name}")
            return True
        else:
            print(f"Modelo {model_name} não encontrado. Modelos disponíveis: {list(self.config['models'].keys())}")
            return False
    
    def get_shell_command(self, prompt: str) -> Optional[str]:
        """Obtém comando shell do modelo de IA"""
        model_config = self.config["models"][self.current_model]
        
        payload = {
            "model": model_config["model"],
            "messages": [
                {
                    "role": "system",
                    "content": model_config["system_prompt"]
                },
                {
                    "role": "user",
                    "content": prompt
                }
            ],
            "max_tokens": model_config["max_tokens"],
            "temperature": model_config["temperature"],
            "stream": False
        }
        
        try:
            response = requests.post(
                model_config["api_endpoint"], 
                json=payload, 
                timeout=30
            )
            response.raise_for_status()
            
            result = response.json()
            
            # Adapta para diferentes formatos de resposta
            if "message" in result:
                return result["message"]["content"].strip()
            elif "choices" in result:
                return result["choices"][0]["message"]["content"].strip()
            else:
                print(f"Formato de resposta inesperado: {result}")
                return None
                
        except requests.exceptions.RequestException as e:
            print(f"Erro na comunicação com {self.current_model}: {e}")
            return None
        except KeyError as e:
            print(f"Erro no formato da resposta: {e}")
            return None
    
    def execute_command(self, command: str, auto_execute: bool = False) -> bool:
        """Executa o comando shell"""
        try:
            print(f"Comando gerado: {command}")
            
            if not auto_execute:
                response = input("Executar este comando? (y/N): ").lower().strip()
                if response not in ['y', 'yes', 's', 'sim']:
                    print("Comando não executado.")
                    return False
            
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
    
    def show_examples(self):
        """Mostra exemplos de comandos"""
        print("\nExemplos de comandos:")
        for name, example in self.config["examples"].items():
            print(f"  {example['input']} → {example['expected_output']}")
    
    def interactive_mode(self):
        """Modo interativo"""
        print(f"Shell Assistant - Modelo atual: {self.current_model}")
        print("Digite 'help' para ajuda, 'exit' para sair, 'model <nome>' para trocar modelo")
        
        while True:
            try:
                prompt = input(f"\n[{self.current_model}] Digite seu comando: ").strip()
                
                if not prompt:
                    continue
                
                if prompt.lower() == 'exit':
                    break
                elif prompt.lower() == 'help':
                    self.show_help()
                elif prompt.lower() == 'examples':
                    self.show_examples()
                elif prompt.lower().startswith('model '):
                    model_name = prompt[6:].strip()
                    self.set_model(model_name)
                elif prompt.lower().startswith('auto '):
                    # Modo automático - executa sem perguntar
                    auto_prompt = prompt[5:].strip()
                    command = self.get_shell_command(auto_prompt)
                    if command:
                        self.execute_command(command, auto_execute=True)
                else:
                    command = self.get_shell_command(prompt)
                    if command:
                        self.execute_command(command)
                    else:
                        print("Não foi possível gerar um comando.")
                        
            except KeyboardInterrupt:
                print("\nSaindo...")
                break
            except EOFError:
                break
    
    def show_help(self):
        """Mostra ajuda"""
        print("\nComandos disponíveis:")
        print("  <comando em linguagem natural> - Gera e executa comando shell")
        print("  auto <comando> - Executa automaticamente sem perguntar")
        print("  model <nome> - Troca o modelo de IA")
        print("  examples - Mostra exemplos de comandos")
        print("  help - Mostra esta ajuda")
        print("  exit - Sai do programa")
        print(f"\nModelos disponíveis: {list(self.config['models'].keys())}")

def main():
    if len(sys.argv) < 2:
        # Modo interativo
        assistant = ShellAssistant()
        assistant.interactive_mode()
    else:
        # Modo linha de comando
        assistant = ShellAssistant()
        prompt = " ".join(sys.argv[1:])
        
        command = assistant.get_shell_command(prompt)
        if command:
            assistant.execute_command(command)
        else:
            print("Não foi possível gerar um comando.")

if __name__ == "__main__":
    main()