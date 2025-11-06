# GenAI Mini Framework - Arquivos Criados

## 📁 Estrutura Completa do Framework

### 🏗️ Core Framework (7 arquivos)
- **genai_mini_framework.py** - Classe principal do framework
- **framework_config.py** - Configurações centralizadas e dataclasses
- **memory_manager.py** - Gerenciamento de memória Qdrant e embeddings
- **cache_manager.py** - Integração GPTCache com wrappers
- **fallback_manager.py** - Sistema hierárquico de 4 níveis
- **claude_integration.py** - Parser e importador de JSON do Claude
- **fazai_integration.py** - Integração específica com projeto FazAI

### 📚 Exemplos e Utilitários (3 arquivos)
- **basic_usage.py** - Exemplos básicos de uso do framework
- **claude_import.py** - Exemplos de importação de diálogos Claude  
- **tests.py** - Suite de testes unitários

### 🔧 Scripts de Automação (3 arquivos)
- **setup.sh** - Script de instalação automatizada
- **run_servers.sh** - Script para gerenciar servidores llama.cpp
- **import_claude.py** - Script CLI para importar conversas Claude

### 📖 Documentação (4 arquivos)
- **README.md** - Documentação principal e guia de início
- **API_REFERENCE.md** - Referência completa da API
- **INTEGRATION_GUIDE.md** - Guia de integração avançada
- **DEPLOYMENT.md** - Guia de deploy em produção

### ⚙️ Configuração (2 arquivos)  
- **requirements.txt** - Dependências Python
- **.env.example** - Exemplo de configuração de ambiente

## 🎯 Funcionalidades Implementadas

### ✅ Sistema de Fallback Hierárquico
- **N2**: Gerente Local + Memória Qdrant
- **N3**: Equipe Local (Analista + Programador)  
- **N4**: Supervisor Online (Google GenAI)
- **N5**: Desistir (todos os níveis falharam)

### ✅ Memória Contextual Permanente
- Collection **fz_memories**: Memória contextual geral
- Collection **fazai_logs_execucao**: Logs de aprendizado
- Collection **fazai_personalidade**: Perfis de personalidade
- Embeddings semânticos com Google text-embedding-004
- Busca por similaridade com scores

### ✅ Cache Inteligente
- GPTCache com embeddings locais (sentence-transformers)
- Threshold de similaridade configurável (padrão: 0.98)
- Wrappers automáticos para clientes OpenAI e GenAI
- Estatísticas de hit rate em tempo real

### ✅ Integração Claude Completa
- Parser robusto para múltiplos formatos JSON
- Detecção automática de conteúdo de personalidade
- Detecção de conteúdo procedimental  
- Importação em lote de diretórios
- Criação de perfil de personalidade compilado

### ✅ Compatibilidade FazAI
- Interface compatível com código existente
- Migração automática de dados antigos
- Extensões para funcionalidades avançadas
- Manutenção do histórico de tarefas

## 🔗 Integrações Automatizadas

### Google GenAI
- **Embeddings**: text-embedding-004 para vetorização
- **LLM**: gemini-1.5-pro-latest como supervisor online
- **Fallback**: Automático quando servidores locais falham

### Qdrant Vector Database  
- **3 Collections**: Memórias, logs, personalidade
- **Auto-criação**: Collections criadas automaticamente
- **Embeddings**: Integração transparente com Google
- **Busca**: Similaridade semântica com scores

### llama.cpp Servers
- **3 Especialistas**: Gerente, Analista, Programador
- **Portas**: 8000, 8001, 8002 respectivamente
- **Modelos**: Gemma-2-9B e CodeGemma-7B
- **Fallback**: Para GenAI online se indisponível

### GPTCache  
- **Cache Semântico**: Baseado em similaridade de embeddings
- **Performance**: Reduz chamadas desnecessárias para LLMs
- **Transparente**: Wrappers automáticos para clientes
- **Configurável**: Threshold ajustável

## 🎛️ Configuração Flexível

### Variáveis de Ambiente
```bash
# Obrigatório
GOOGLE_API_KEY=sua_chave

# Opcional - Qdrant
QDRANT_HOST=localhost
QDRANT_PORT=6333

# Opcional - Comportamento
MAX_STEPS=30
TIMEOUT_SECONDS=30
ENABLE_CACHE=true
LOG_LEVEL=INFO
```

### Configuração Programática
```python
config = FrameworkConfig()
config.max_steps = 50
config.enable_cache = True
config.qdrant.collection_memories = "custom_memories"

framework = GenAIMiniFramework(config)
```

## 🚀 Como Usar

### Uso Básico
```python
from genai_mini_framework import GenAIMiniFramework

framework = GenAIMiniFramework()
result = framework.run_task("Criar arquivo teste.txt")
```

### Importar Claude
```python
stats = framework.import_claude_conversations("./claude_exports/")
personality = framework.create_personality_from_claude()
```

### Integração FazAI
```python
from fazai_integration import FazAIEnhanced

fazai = FazAIEnhanced()
success = fazai.run("Sua tarefa aqui")
```

## 📊 Métricas e Monitoramento

### Estatísticas Disponíveis
- Taxa de sucesso de tarefas
- Distribuição por nível de fallback
- Cache hit rate e performance
- Contagem de memórias por tipo
- Tempo médio de execução

### Logs Estruturados
- Logs por nível (INFO, DEBUG, ERROR)
- Timestamps e identificadores únicos
- Rastreamento de task_id através do sistema
- Métricas de performance por componente

## 🔄 Fluxo de Aprendizado

1. **Execução**: Tarefa é decomposta e executada
2. **Registro**: Sucesso/falha são salvos no Qdrant  
3. **Aprendizado**: Próximas tarefas consultam histórico
4. **Melhoria**: Sistema aprende padrões e evita erros
5. **Personalização**: Comportamento se adapta ao usuário

## 🎉 Diferenciais do Framework

### vs Código Original genai_engine.py
- ✅ **Modular**: Componentes separados e reutilizáveis
- ✅ **Testável**: Suite de testes e mocks  
- ✅ **Configurável**: Sistema de configuração flexível
- ✅ **Documentado**: Documentação completa com exemplos
- ✅ **Robusto**: Tratamento de erros melhorado
- ✅ **Extensível**: Fácil adição de novos componentes

### vs Outros Frameworks
- ✅ **Fallback Inteligente**: 4 níveis hierárquicos únicos
- ✅ **Memória Semântica**: Qdrant com embeddings Google
- ✅ **Cache Otimizado**: GPTCache com similaridade
- ✅ **Claude Integration**: Import nativo de conversas
- ✅ **Peso Leve**: Funciona com modelos pequenos locais
- ✅ **Auto-aprendizado**: Sistema aprende com experiência

Total de arquivos criados: **19 arquivos** + **2 diagramas**

Framework pronto para integração com FazAI e deploy em produção! 🚀
