#!/usr/bin/env python3
import json
import requests
from typing import Dict, Any, Optional

class NaturalCommandProcessor:
    """
    Processador de comandos em linguagem natural para diferentes provedores de LLM
    """
    
    def __init__(self, config_file: str = "llm_command_structure.json"):
        with open(config_file, 'r', encoding='utf-8') as f:
            self.config = json.load(f)
    
    def create_payload(self, natural_command: str, provider: str = "ollama", model: Optional[str] = None) -> Dict[str, Any]:
        """
        Cria o payload para enviar ao provedor LLM
        """
        template = self.config["template_payload"].copy()
        
        # Define o modelo baseado no provedor
        if model:
            template["model"] = model
        else:
            provider_config = next((p for p in self.config["supported_providers"] if p["name"] == provider), None)
            if provider_config:
                template["model"] = provider_config["model_format"]
        
        # Substitui o comando natural na mensagem do usuário
        template["messages"][1]["content"] = natural_command
        
        return template
    
    def send_command(self, natural_command: str, provider: str = "ollama", 
                    base_url: str = "http://localhost:11434", model: Optional[str] = None) -> str:
        """
        Envia comando em linguagem natural para o LLM e retorna o comando bash
        """
        payload = self.create_payload(natural_command, provider, model)
        
        # Configura endpoint baseado no provedor
        provider_config = next((p for p in self.config["supported_providers"] if p["name"] == provider), None)
        if not provider_config:
            raise ValueError(f"Provedor {provider} não suportado")
        
        endpoint = f"{base_url.rstrip('/')}{provider_config['endpoint']}"
        
        try:
            response = requests.post(
                endpoint,
                json=payload,
                headers={'Content-Type': 'application/json'},
                timeout=30
            )
            response.raise_for_status()
            
            # Processa resposta baseado no provedor
            if provider == "ollama":
                return response.json().get("response", "").strip()
            else:  # OpenAI/DeepSeek format
                return response.json()["choices"][0]["message"]["content"].strip()
                
        except requests.exceptions.RequestException as e:
            return f"Erro na requisição: {e}"
        except (KeyError, json.JSONDecodeError) as e:
            return f"Erro ao processar resposta: {e}"

def main():
    """
    Exemplo de uso do processador
    """
    processor = NaturalCommandProcessor()
    
    # Comandos de exemplo em linguagem natural
    test_commands = [
        "liste os processos em execução",
        "mostre o uso de disco",
        "verifique conexões de rede ativas",
        "encontre arquivos modificados nas últimas 24 horas",
        "monitore uso de CPU e memória"
    ]
    
    print("=== Teste do Processador de Comandos Naturais ===\n")
    
    for cmd in test_commands:
        print(f"Comando natural: {cmd}")
        
        # Cria payload para Ollama
        payload = processor.create_payload(cmd, "ollama")
        print(f"Payload gerado:")
        print(json.dumps(payload, indent=2, ensure_ascii=False))
        
        # Nota: Para testar com servidor real, descomente a linha abaixo
        # bash_command = processor.send_command(cmd, "ollama", "http://localhost:11434")
        # print(f"Comando bash retornado: {bash_command}")
        
        print("-" * 50)

if __name__ == "__main__":
    main()