#!/usr/bin/env python3
"""
FazAI CLI - Comandos em Linguagem Natural
Interface para testar comandos complexos via worker Gemma
"""

import sys
import json
import socket
import argparse
from pathlib import Path

def send_to_worker(message: str, use_tcp: bool = True) -> str:
    """Envia mensagem para o worker via socket"""
    try:
        if use_tcp:
            # TCP connection
            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            sock.connect(('127.0.0.1', 5557))
        else:
            # Unix socket
            sock = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
            sock.connect('/run/fazai/gemma.sock')
        
        # Enviar mensagem ND-JSON
        message_json = {
            "action": "ask",
            "action_id": f"cli_{hash(message)}",
            "input": message,
            "timestamp": None,
            "source": "cli_natural",
            "model": None
        }
        
        sock.send((json.dumps(message_json) + '\n').encode('utf-8'))
        
        # Receber resposta
        response = sock.recv(65536).decode('utf-8')
        sock.close()
        
        return response
        
    except Exception as e:
        return f"Erro conectando ao worker: {e}"

def main():
    parser = argparse.ArgumentParser(description='FazAI CLI - Comandos em Linguagem Natural')
    parser.add_argument('command', nargs='?', help='Comando em linguagem natural')
    parser.add_argument('--tcp', action='store_true', help='Usar TCP ao invés de Unix socket')
    parser.add_argument('--interactive', '-i', action='store_true', help='Modo interativo')
    
    args = parser.parse_args()
    
    if args.interactive:
        print("🔥 FazAI CLI - Modo Interativo")
        print("Digite comandos em linguagem natural (Ctrl+C para sair)")
        print("=" * 50)
        
        try:
            while True:
                command = input("\nFazAI> ").strip()
                if not command:
                    continue
                    
                if command.lower() in ['quit', 'exit', 'sair']:
                    break
                
                print(f"\n🧠 Processando: {command}")
                print("-" * 30)
                
                response = send_to_worker(command, args.tcp)
                
                # Parse resposta JSON
                try:
                    response_data = json.loads(response)
                    if 'result' in response_data:
                        print(response_data['result'])
                    else:
                        print(response)
                except:
                    print(response)
                    
        except KeyboardInterrupt:
            print("\n\n👋 Saindo...")
            
    elif args.command:
        print(f"🧠 Processando: {args.command}")
        print("-" * 30)
        
        response = send_to_worker(args.command, args.tcp)
        
        # Parse resposta JSON
        try:
            response_data = json.loads(response)
            if 'result' in response_data:
                print(response_data['result'])
            else:
                print(response)
        except:
            print(response)
    else:
        parser.print_help()

if __name__ == "__main__":
    main()
