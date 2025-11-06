# API Reference - GenAI Mini Framework

## Classes Principais

### GenAIMiniFramework

Classe principal do framework que orquestra todos os componentes.

```python
class GenAIMiniFramework:
    def __init__(self, config: Optional[FrameworkConfig] = None)
```

#### Métodos

##### `run_task(task_description: str, max_steps: Optional[int] = None) -> TaskResult`

Executa uma tarefa usando o sistema hierárquico de fallback.

**Parâmetros:**
- `task_description`: Descrição da tarefa em linguagem natural
- `max_steps`: Número máximo de passos (padrão: config.max_steps)

**Retorna:** `TaskResult` com informações da execução

**Exemplo:**
```python
result = framework.run_task("Criar arquivo teste.txt com data atual")
```

##### `import_claude_conversations(json_path_or_directory: str) -> Dict[str, Any]`

Importa conversas do Claude a partir de arquivo JSON ou diretório.

**Parâmetros:**
- `json_path_or_directory`: Caminho para arquivo JSON ou diretório

**Retorna:** Dicionário com estatísticas da importação

**Exemplo:**
```python
stats = framework.import_claude_conversations("./claude_exports/")
```

##### `search_memory(query: str, memory_type: Optional[str] = None, limit: int = 5) -> List[Dict[str, Any]]`

Busca na memória contextual usando similaridade semântica.

**Parâmetros:**
- `query`: Consulta de busca
- `memory_type`: Tipo de memória ("conversation", "personality", "procedure") 
- `limit`: Número máximo de resultados

**Retorna:** Lista de memórias encontradas com scores de similaridade

##### `get_framework_status() -> Dict[str, Any]`

Retorna status geral do framework.

**Retorna:** Dicionário com informações de status

##### `get_cache_stats() -> Dict[str, Any]`

Retorna estatísticas do cache.

**Retorna:** Dicionário com métricas do cache

##### `clear_cache()`

Limpa o cache do framework.

### FrameworkConfig

Classe de configuração principal.

```python
@dataclass
class FrameworkConfig:
    qdrant: QdrantConfig
    llama: LlamaConfig  
    genai: GenAIConfig
    cache: CacheConfig
    claude: ClaudeConfig
    max_steps: int = 30
    timeout_seconds: int = 30
    log_level: str = "INFO"
    enable_cache: bool = True
    enable_fallback: bool = True
```

#### Métodos

##### `from_env() -> FrameworkConfig`

Cria configuração a partir de variáveis de ambiente.

**Exemplo:**
```python
config = FrameworkConfig.from_env()
```

### TaskResult

Resultado da execução de uma tarefa.

```python
@dataclass
class TaskResult:
    task_id: str
    success: bool
    steps_executed: int
    final_level: EscalationLevel
    execution_time: float
    error: Optional[str] = None
```

### MemoryManager

Gerenciador de memória contextual com Qdrant.

```python
class MemoryManager:
    def __init__(self, config: FrameworkConfig)
```

#### Métodos

##### `store_memory(content: str, memory_type: str, metadata: Dict[str, Any] = None) -> str`

Armazena uma memória no Qdrant.

**Parâmetros:**
- `content`: Conteúdo da memória
- `memory_type`: Tipo ("conversation", "personality", "procedure", etc.)
- `metadata`: Metadados adicionais

**Retorna:** ID da memória armazenada

##### `search_memories(query: str, memory_type: Optional[str] = None, limit: int = 5) -> List[Dict[str, Any]]`

Busca memórias por similaridade semântica.

##### `import_claude_conversations(claude_json_path: str) -> int`

Importa conversas do Claude diretamente.

**Retorna:** Número de mensagens importadas

### CacheManager

Gerenciador de cache inteligente com GPTCache.

```python
class CacheManager:
    def __init__(self, config: FrameworkConfig)
```

#### Métodos

##### `wrap_openai_client(client) -> client`

Envolve cliente OpenAI com cache.

##### `wrap_genai_model(model) -> model`

Envolve modelo GenAI com cache.

##### `clear_cache()`

Limpa o cache.

##### `get_cache_stats() -> Dict[str, Any]`

Retorna estatísticas do cache.

##### `is_enabled() -> bool`

Verifica se cache está habilitado.

### FallbackManager

Gerenciador do sistema hierárquico de fallback.

```python
class FallbackManager:
    def __init__(self, config: FrameworkConfig, memory_manager: MemoryManager, cache_manager: CacheManager)
```

#### Métodos

##### `execute_fallback_chain(task_id: str, original_task: str, start_level: EscalationLevel = EscalationLevel.N2_LOCAL_MEMORIA) -> FallbackResult`

Executa cadeia de fallback a partir do nível especificado.

### ClaudeIntegration

Integrador específico para exports JSON do Claude.

```python
class ClaudeIntegration:
    def __init__(self, config: FrameworkConfig, memory_manager: MemoryManager)
```

#### Métodos

##### `parse_claude_json(json_path: str) -> List[ClaudeConversation]`

Parseia arquivo JSON do Claude.

##### `import_conversations_to_memory(conversations: List[ClaudeConversation]) -> Dict[str, int]`

Importa conversas para memória Qdrant.

##### `create_personality_profile(conversation_limit: int = 50) -> str`

Cria perfil de personalidade compilado.

## Enums

### EscalationLevel

Níveis de escalonamento do sistema de fallback.

```python
class EscalationLevel(Enum):
    N1_CACHE_LOCAL = 1
    N2_LOCAL_MEMORIA = 2  
    N3_EQUIPE_LOCAL = 3
    N4_SUPERVISOR_ONLINE = 4
    DESISTIR = 5
```

## Estruturas de Dados

### ClaudeMessage

```python
@dataclass
class ClaudeMessage:
    id: str
    content: str
    role: str  # "human" ou "assistant"
    timestamp: Optional[datetime]
    conversation_id: str
    metadata: Dict[str, Any]
```

### ClaudeConversation

```python
@dataclass  
class ClaudeConversation:
    id: str
    title: str
    messages: List[ClaudeMessage]
    created_at: Optional[datetime]
    updated_at: Optional[datetime]
    metadata: Dict[str, Any]
```

### FallbackResult

```python
@dataclass
class FallbackResult:
    success: bool
    level: EscalationLevel
    response: Optional[Dict[str, Any]]
    error: Optional[str]
    execution_time: float
```

## Funções Utilitárias

### `create_framework(config_path: Optional[str] = None, **kwargs) -> GenAIMiniFramework`

Função utilitária para criação rápida do framework.

**Exemplo:**
```python
framework = create_framework(
    max_steps=20,
    enable_cache=True
)
```

## Configurações de Collection Qdrant

### fz_memories
- **Tamanho do vetor**: 768 (Google embeddings)
- **Distância**: COSINE  
- **Uso**: Memória contextual permanente

### fazai_logs_execucao
- **Tamanho do vetor**: 768
- **Distância**: COSINE
- **Uso**: Logs de aprendizado (sucessos/falhas)

### fazai_personalidade  
- **Tamanho do vetor**: 768
- **Distância**: COSINE
- **Uso**: Perfis de personalidade compilados

## Códigos de Status

### TaskResult.success
- `True`: Tarefa concluída com sucesso
- `False`: Tarefa falhou

### EscalationLevel
- `N2_LOCAL_MEMORIA`: Gerente local + memória Qdrant
- `N3_EQUIPE_LOCAL`: Equipe de especialistas locais
- `N4_SUPERVISOR_ONLINE`: Supervisor online (GenAI)
- `DESISTIR`: Todos os níveis falharam

### Memory Types
- `"conversation"`: Mensagens de conversa
- `"personality"`: Características de personalidade
- `"procedure"`: Procedimentos e instruções
- `"execution_log"`: Logs de execução
- `"error"`: Logs de erro
- `"success"`: Logs de sucesso

## Tratamento de Erros

### Exceções Comuns

- `RuntimeError("Framework não foi inicializado")`: Framework não inicializado
- `ValueError("Google API Key não configurada")`: API key inválida
- `ConnectionError`: Falha na conexão com Qdrant ou llama.cpp
- `TimeoutError`: Comando excedeu timeout configurado

### Logs de Debug

```python
import logging

# Habilitar logs detalhados
logging.getLogger("genai_mini_framework").setLevel(logging.DEBUG)
logging.getLogger("memory_manager").setLevel(logging.DEBUG) 
logging.getLogger("fallback_manager").setLevel(logging.DEBUG)
```

## Limites e Constrains

### Limites Técnicos
- Máximo 10.000 pontos por batch no Qdrant
- Timeout padrão de 30 segundos por comando
- Cache com threshold de similaridade 0.98
- Máximo 30 passos por tarefa (configurável)

### Limites de API
- Google GenAI: Conforme plano contratado
- Qdrant: Conforme configuração do servidor
- llama.cpp: Limitado pela capacidade do hardware

## Boas Práticas

### Performance
1. Use cache para tarefas repetitivas
2. Configure timeout apropriado para seu uso
3. Monitore taxa de acerto do cache
4. Limite busca de memórias para evitar sobrecarga

### Segurança  
1. Nunca exponha API keys em código
2. Use variáveis de ambiente para configurações
3. Restrinja comandos perigosos (lista de bloqueio implementada)
4. Monitore logs de execução

### Manutenção
1. Faça backup regular das collections Qdrant  
2. Monitore tamanho do cache
3. Limpe memórias antigas periodicamente
4. Atualize embeddings se mudar modelo