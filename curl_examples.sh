#!/bin/bash

# Exemplos de uso da API Ollama com cURL para comandos shell
# Baseado no JSON estruturado para Llama 3.2

echo "=== Exemplos de uso da API Ollama para comandos shell ==="
echo

# Função para enviar comando para Ollama
send_command() {
    local prompt="$1"
    local temp_file=$(mktemp)
    
    cat > "$temp_file" << EOF
{
  "model": "llama3.2:latest",
  "messages": [
    {
      "role": "system",
      "content": "Você é um assistente especializado em comandos shell Linux. Sua função é interpretar comandos em linguagem natural e retornar APENAS o comando shell correspondente, sem explicações, comentários ou formatação adicional.\n\nRegras:\n- Retorne apenas o comando shell puro\n- Não adicione explicações ou comentários\n- Não use markdown ou formatação\n- Use comandos padrão do Linux\n- Considere o contexto: usuário root, diretório atual, variáveis de ambiente\n- Se múltiplos comandos forem necessários, separe-os com '&&' ou ';'\n- Para comandos que requerem privilégios, use 'sudo' quando apropriado"
    },
    {
      "role": "user",
      "content": "$prompt"
    }
  ],
  "max_tokens": 2000,
  "temperature": 0.1,
  "stream": false
}
EOF

    echo "Enviando: $prompt"
    echo "Resposta:"
    
    curl -s -X POST http://localhost:11434/api/chat \
        -H "Content-Type: application/json" \
        -d @"$temp_file" | jq -r '.message.content'
    
    echo
    rm "$temp_file"
}

# Verificar se Ollama está rodando
echo "Verificando se Ollama está rodando..."
if ! curl -s http://localhost:11434/api/tags > /dev/null; then
    echo "❌ Ollama não está rodando. Execute: ollama serve"
    exit 1
fi
echo "✅ Ollama está rodando"
echo

# Exemplo 1: Listar processos
echo "=== Exemplo 1: Listar processos ==="
send_command "liste os processos em execução"

# Exemplo 2: Mostrar espaço em disco
echo "=== Exemplo 2: Mostrar espaço em disco ==="
send_command "mostre o espaço em disco"

# Exemplo 3: Mostrar uso de memória
echo "=== Exemplo 3: Mostrar uso de memória ==="
send_command "mostre o uso de memória"

# Exemplo 4: Criar arquivo
echo "=== Exemplo 4: Criar arquivo ==="
send_command "crie um arquivo teste.txt"

# Exemplo 5: Informações do sistema
echo "=== Exemplo 5: Informações do sistema ==="
send_command "mostre informações do sistema"

# Exemplo 6: Múltiplos comandos
echo "=== Exemplo 6: Múltiplos comandos ==="
send_command "liste arquivos e depois mostre o uso de memória"

# Exemplo 7: Conexões de rede
echo "=== Exemplo 7: Conexões de rede ==="
send_command "mostre as conexões de rede ativas"

# Exemplo 8: Usuário atual
echo "=== Exemplo 8: Usuário atual ==="
send_command "quem sou eu"

echo "=== Fim dos exemplos ==="
echo
echo "Para usar com um comando personalizado:"
echo "bash curl_examples.sh 'seu comando aqui'"
echo

# Se um argumento foi fornecido, testar com ele
if [ $# -gt 0 ]; then
    echo "=== Testando comando personalizado ==="
    send_command "$*"
fi