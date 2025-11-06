# GenAI Mini Framework

Um framework completo e simplificado para integração de GenAI com llama.cpp, Qdrant, GPTCache e Claude, focado em automação e personalização através de memória contextual.

## 🚀 Características Principais

- **Sistema Hierárquico de Fallback**: 4 níveis de escalonamento (Local → Equipe → Supervisor → Falha)
- **Memória Contextual Permanente**: Armazenamento no Qdrant com embeddings semânticos
- **Cache Inteligente**: GPTCache com similaridade semântica para performance
- **Integração Claude**: Importação automática de conversas JSON para personalização
- **Múltiplos LLMs**: Suporte a llama.cpp local + Google GenAI online
- **Aprendizado Contínuo**: Sistema aprende com sucessos e falhas

## 📦 Instalação

### Pré-requisitos

```bash
# Instalar dependências Python
pip install google-generativeai qdrant-client gptcache sentence-transformers openai

# Iniciar Qdrant (Docker)
docker run -p 6333:6333 -p 6334:6334 qdrant/qdrant

# Configurar variável de ambiente
export GOOGLE_API_KEY="sua_chave_api_google"
```

### Servidores llama.cpp (Opcional)

```bash
# Servidor Gerente (Porta 8000)
python -m llama_cpp.server --model ./models/gemma-2-9b-it.gguf --port 8000

# Servidor Analista (Porta 8001) 
python -m llama_cpp.server --model ./models/gemma-2-9b-it.gguf --port 8001

# Servidor Programador (Porta 8002)
python -m llama_cpp.server --model ./models/CodeGemma-7B.gguf --port 8002
```

## 🎯 Uso Básico

### Exemplo Simples

```python
from genai_mini_framework import GenAIMiniFramework

# Inicializar framework
framework = GenAIMiniFramework()

# Executar tarefa
result = framework.run_task("Listar arquivos Python no diretório atual")

print(f"Sucesso: {result.success}")
print(f"Passos: {result.steps_executed}")
print(f"Tempo: {result.execution_time:.2f}s")
```

### Configuração Personalizada

```python
from genai_mini_framework import FrameworkConfig, GenAIMiniFramework

# Configurar
config = FrameworkConfig()
config.max_steps = 20
config.timeout_seconds = 30
config.enable_cache = True

# Usar
framework = GenAIMiniFramework(config)
```

## 🧠 Importação de Personalidade Claude

### Exportar Conversas do Claude

1. No Claude, vá em Configurações → Export Data
2. Baixe o arquivo JSON das conversas
3. Salve em um diretório (ex: `./claude_exports/`)

### Importar para o Framework

```python
# Importar arquivo único
stats = framework.import_claude_conversations("conversa.json")

# Importar diretório completo
stats = framework.import_claude_conversations("./claude_exports/")

# Criar perfil de personalidade
personality = framework.create_personality_from_claude()
```

### Estrutura JSON Suportada

```json
{
  "conversations": [
    {
      "id": "conv_001",
      "title": "Título da Conversa", 
      "created_at": "2024-01-15T10:30:00Z",
      "messages": [
        {
          "id": "msg_001",
          "role": "human",
          "content": "Mensagem do usuário",
          "timestamp": "2024-01-15T10:30:00Z"
        },
        {
          "id": "msg_002",
          "role": "assistant", 
          "content": "Resposta do Claude",
          "timestamp": "2024-01-15T10:31:00Z"
        }
      ]
    }
  ]
}
```

## 🏗️ Arquitetura

### Componentes Principais

- **`genai_mini_framework.py`**: Classe principal do framework
- **`framework_config.py`**: Configurações centralizadas
- **`memory_manager.py`**: Gerenciamento Qdrant e embeddings
- **`cache_manager.py`**: Integração GPTCache
- **`fallback_manager.py`**: Sistema hierárquico de fallback
- **`claude_integration.py`**: Processamento de exports Claude

### Fluxo de Funcionamento

1. **Decomposição**: Tarefa é quebrada em passos executáveis
2. **Execução**: Comandos são executados no sistema
3. **Aprendizado**: Resultados são salvos no Qdrant
4. **Fallback**: Em caso de falha, escala para próximo nível
5. **Memória**: Sucessos são lembrados para tarefas futuras

### Níveis de Escalonamento

| Nível | Responsável | Descrição |
|-------|-------------|-----------|
| N2 | Gerente Local + Qdrant | Usa experiência passada |
| N3 | Equipe (Analista + Programador) | Análise colaborativa |
| N4 | Supervisor Online (GenAI) | Inteligência de ponta |
| N5 | Desistir | Todos os níveis falharam |

## 📊 Collections Qdrant

### `fz_memories` - Memória Contextual
Armazena conversas, procedimentos e personalidade importados do Claude.

### `fazai_logs_execucao` - Logs de Aprendizado  
Registra sucessos e falhas para aprendizado contínuo.

### `fazai_personalidade` - Perfil Comportamental
Perfis de personalidade compilados para influenciar comportamento.

## ⚙️ Configuração Avançada

### Variáveis de Ambiente

```bash
# Obrigatório
export GOOGLE_API_KEY="sua_chave_google"

# Opcional
export QDRANT_HOST="localhost"
export QDRANT_PORT="6333" 
export CACHE_DB_FILE="framework_cache.db"
```

### Arquivo de Configuração

```python
config = FrameworkConfig()

# Qdrant
config.qdrant.host = "localhost"
config.qdrant.port = 6333
config.qdrant.collection_memories = "fz_memories"

# Cache  
config.cache.similarity_threshold = 0.95
config.enable_cache = True

# Execução
config.max_steps = 30
config.timeout_seconds = 20
```

## 🔧 Integração com FazAI

Para integrar com o projeto [FazAI](https://github.com/RLuf/FazAI/tree/master):

```python
# No seu código FazAI existente
from genai_mini_framework import GenAIMiniFramework

# Substituir agente original
framework = GenAIMiniFramework()

# Manter interface compatível
def fazer_tarefa(descricao):
    result = framework.run_task(descricao)
    return result.success
```

## 📈 Monitoramento

### Status do Framework

```python
status = framework.get_framework_status()
print(f"Inicializado: {status['initialized']}")
print(f"Cache habilitado: {status['cache_enabled']}")
```

### Estatísticas do Cache

```python
stats = framework.get_cache_stats()
print(f"Taxa de acerto: {stats['hit_rate']:.2%}")
print(f"Total de requests: {stats['total_requests']}")
```

### Busca na Memória

```python
# Buscar memórias específicas
memories = framework.search_memory("configurar servidor", limit=5)

# Buscar por tipo
personality = framework.search_memory("personalidade", memory_type="personality")
procedures = framework.search_memory("passo a passo", memory_type="procedure")
```

## 🚨 Troubleshooting

### Problemas Comuns

**Erro: Google API Key não configurada**
```bash
export GOOGLE_API_KEY="sua_chave_aqui"
```

**Erro: Qdrant não conecta**
```bash
docker run -p 6333:6333 qdrant/qdrant
```

**Erro: llama.cpp servers offline**
- Framework funciona apenas com GenAI online
- Fallback automático para Supervisor Online

### Logs e Debug

```python
import logging
logging.basicConfig(level=logging.DEBUG)

# Framework com logs detalhados
framework = GenAIMiniFramework(config)
```

## 🤝 Contribuição

1. Fork o projeto
2. Crie sua feature branch (`git checkout -b feature/nova-feature`)
3. Commit suas mudanças (`git commit -m 'Adiciona nova feature'`)
4. Push para a branch (`git push origin feature/nova-feature`)
5. Abra um Pull Request

## 📝 Licença

Este projeto está sob a licença MIT. Veja `LICENSE` para mais detalhes.

## 🔗 Links Úteis

- [Qdrant Documentation](https://qdrant.tech/documentation/)
- [GPTCache GitHub](https://github.com/zilliztech/GPTCache)
- [llama.cpp](https://github.com/ggerganov/llama.cpp)
- [Google GenAI Python](https://ai.google.dev/tutorials/python_quickstart)

---

**Desenvolvido para integração com [FazAI](https://github.com/RLuf/FazAI/tree/master)**
