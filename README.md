# Shell Assistant - Comandos Shell via Linguagem Natural

Este projeto permite executar comandos shell Linux a partir de linguagem natural usando diferentes modelos de IA como Llama 3.2, DeepSeek, GPT-4, etc.

## Arquivos do Projeto

- `shell_command_prompt.json` - JSON estruturado para API do Ollama
- `ollama_api_example.py` - Exemplo básico de uso da API
- `shell_assistant.py` - Assistente completo com interface interativa
- `model_configs.json` - Configurações para diferentes modelos de IA

## Pré-requisitos

1. **Ollama instalado e rodando**:
   ```bash
   # Instalar Ollama (se não estiver instalado)
   curl -fsSL https://ollama.ai/install.sh | sh
   
   # Baixar modelo Llama 3.2
   ollama pull llama3.2:latest
   
   # Baixar modelo DeepSeek (opcional)
   ollama pull deepseek:latest
   ```

2. **Python 3.7+ com dependências**:
   ```bash
   pip install requests
   ```

## Uso Rápido

### 1. JSON Estruturado para API

O arquivo `shell_command_prompt.json` contém o formato correto para enviar para a API do Ollama:

```json
{
  "model": "llama3.2:latest",
  "messages": [
    {
      "role": "system",
      "content": "Você é um assistente especializado em comandos shell Linux..."
    },
    {
      "role": "user",
      "content": "liste os processos em execução"
    }
  ],
  "max_tokens": 2000,
  "temperature": 0.1,
  "stream": false
}
```

### 2. Exemplo Básico

```bash
python3 ollama_api_example.py "liste os processos em execução"
```

### 3. Assistente Interativo

```bash
python3 shell_assistant.py
```

No modo interativo, você pode:
- Digitar comandos em linguagem natural
- Usar `auto <comando>` para execução automática
- Trocar modelos com `model <nome>`
- Ver exemplos com `examples`
- Obter ajuda com `help`

## Exemplos de Comandos

| Linguagem Natural | Comando Shell |
|-------------------|---------------|
| "liste os processos em execução" | `ps aux` |
| "mostre o espaço em disco" | `df -h` |
| "mostre o uso de memória" | `free -h` |
| "crie um arquivo teste.txt" | `touch teste.txt` |
| "liste arquivos e depois mostre o uso de memória" | `ls -la && free -h` |
| "mostre as conexões de rede ativas" | `netstat -tuln` |
| "mostre informações do sistema" | `uname -a` |

## Configuração de Modelos

O arquivo `model_configs.json` permite configurar diferentes modelos:

- **llama3.2**: Modelo local via Ollama
- **deepseek**: Modelo local via Ollama
- **gpt-4**: OpenAI API (requer chave de API)
- **claude**: Anthropic API (requer chave de API)

### Configurando APIs Externas

Para usar GPT-4 ou Claude, adicione suas chaves de API:

```bash
export OPENAI_API_KEY="sua-chave-openai"
export ANTHROPIC_API_KEY="sua-chave-anthropic"
```

## Uso via API Direta

### cURL

```bash
curl -X POST http://localhost:11434/api/chat \
  -H "Content-Type: application/json" \
  -d @shell_command_prompt.json
```

### Python

```python
import requests

url = "http://localhost:11434/api/chat"
payload = {
    "model": "llama3.2:latest",
    "messages": [
        {
            "role": "system",
            "content": "Você é um assistente especializado em comandos shell Linux..."
        },
        {
            "role": "user",
            "content": "liste os processos em execução"
        }
    ],
    "max_tokens": 2000,
    "temperature": 0.1
}

response = requests.post(url, json=payload)
result = response.json()
command = result['message']['content']
print(f"Comando: {command}")
```

## Características do Sistema

### Prompt do Sistema

O prompt do sistema é projetado para:

1. **Especificidade**: Foca apenas em comandos shell Linux
2. **Clareza**: Instruções explícitas sobre o formato de saída
3. **Contexto**: Considera variáveis de ambiente e privilégios
4. **Segurança**: Usa `sudo` quando apropriado
5. **Flexibilidade**: Suporta múltiplos comandos com `&&` ou `;`

### Regras de Saída

- Retorna apenas o comando shell puro
- Sem explicações ou comentários
- Sem formatação markdown
- Comandos padrão do Linux
- Considera contexto do usuário e diretório

## Segurança

⚠️ **Atenção**: Este sistema executa comandos shell reais. Sempre revise o comando gerado antes da execução.

- O sistema pergunta confirmação antes de executar (exceto no modo `auto`)
- Comandos são exibidos antes da execução
- Use com cuidado em ambientes de produção

## Troubleshooting

### Ollama não responde
```bash
# Verificar se Ollama está rodando
ollama list

# Reiniciar Ollama
sudo systemctl restart ollama
```

### Modelo não encontrado
```bash
# Baixar modelo específico
ollama pull llama3.2:latest
```

### Erro de conexão
- Verifique se Ollama está rodando na porta 11434
- Confirme se o modelo está baixado
- Verifique logs do Ollama

## Contribuição

Para adicionar novos modelos ou melhorar o sistema:

1. Adicione configurações no `model_configs.json`
2. Atualize o prompt do sistema se necessário
3. Teste com diferentes cenários
4. Documente mudanças no README

## Licença

Este projeto é de código aberto. Sinta-se livre para usar e modificar conforme necessário.
