# Guia de Integração - GenAI Mini Framework

## Integração com FazAI Existente

### 1. Substituição Direta

Se você já tem o projeto FazAI, pode substituir o agente atual:

```python
# Código antigo FazAI
# from fazai_agent import FazAIAgent

# Novo código com framework
from genai_mini_framework import GenAIMiniFramework

class FazAIAgent:
    def __init__(self):
        self.framework = GenAIMiniFramework()

    def run(self, task_description):
        result = self.framework.run_task(task_description)
        return result
```

### 2. Migração de Memória

Para migrar dados existentes:

```python
# Importar logs antigos para Qdrant
def migrate_old_logs(old_logs_file):
    framework = GenAIMiniFramework()

    with open(old_logs_file, 'r') as f:
        old_logs = json.load(f)

    for log in old_logs:
        framework.memory_manager.store_memory(
            content=log['content'],
            memory_type='execution_log',
            metadata=log.get('metadata', {})
        )
```

### 3. Configuração Personalizada para FazAI

```python
from genai_mini_framework import FrameworkConfig

# Configuração específica para FazAI
config = FrameworkConfig()
config.qdrant.collection_memories = "fazai_memories"
config.qdrant.collection_logs = "fazai_execution_logs"
config.max_steps = 50  # Mais passos para tarefas complexas
config.timeout_seconds = 60  # Timeout maior

framework = GenAIMiniFramework(config)
```

## Integração com APIs Externas

### 1. Endpoints Fallback

```python
import requests
from genai_mini_framework import GenAIMiniFramework

class ExtendedFramework(GenAIMiniFramework):
    def __init__(self, config):
        super().__init__(config)
        self.external_endpoints = [
            "https://api.openai.com/v1/chat/completions",
            "https://api.anthropic.com/v1/messages"
        ]

    def fallback_to_external(self, prompt):
        for endpoint in self.external_endpoints:
            try:
                response = requests.post(endpoint, json={
                    "model": "gpt-4",
                    "messages": [{"role": "user", "content": prompt}]
                })
                if response.status_code == 200:
                    return response.json()
            except:
                continue
        return None
```

### 2. Webhook Integration

```python
from flask import Flask, request, jsonify

app = Flask(__name__)
framework = GenAIMiniFramework()

@app.route('/execute_task', methods=['POST'])
def webhook_execute_task():
    data = request.json
    task = data.get('task')

    result = framework.run_task(task)

    return jsonify({
        'success': result.success,
        'task_id': result.task_id,
        'steps': result.steps_executed,
        'execution_time': result.execution_time
    })

@app.route('/import_claude', methods=['POST'])
def webhook_import_claude():
    file = request.files['claude_json']
    temp_path = f"/tmp/{file.filename}"

    file.save(temp_path)
    stats = framework.import_claude_conversations(temp_path)

    return jsonify(stats)
```

## Customização de Personalidade

### 1. Personalidade Programática

```python
# Definir personalidade diretamente no código
def set_custom_personality(framework):
    personality_content = """
    Você é um assistente técnico especializado em DevOps.

    Características:
    - Sempre prefira soluções Docker quando possível
    - Use práticas de Infrastructure as Code
    - Priorize segurança e monitoramento
    - Documente todos os passos
    """

    framework.memory_manager.store_memory(
        content=personality_content,
        memory_type="personality",
        metadata={"source": "custom", "version": "1.0"}
    )
```

### 2. Personalidade por Contexto

```python
class ContextualFramework(GenAIMiniFramework):
    def run_task(self, task_description, context="general"):
        # Buscar personalidade específica do contexto
        personality_memories = self.search_memory(
            f"personalidade {context}",
            memory_type="personality"
        )

        if personality_memories:
            # Usar personalidade específica
            self.current_personality = personality_memories[0]['content']

        return super().run_task(task_description)
```

## Performance e Otimização

### 1. Cache Avançado

```python
from cache_manager import CacheContext

# Usar cache seletivamente
with CacheContext(framework.cache_manager, enabled=True):
    # Operações que se beneficiam do cache
    result = framework.run_task("tarefa repetitiva")

with CacheContext(framework.cache_manager, enabled=False):
    # Operações que precisam ser sempre executadas
    result = framework.run_task("verificar status em tempo real")
```

### 2. Batch Processing

```python
def process_multiple_tasks(framework, tasks):
    results = []

    for task in tasks:
        result = framework.run_task(task)
        results.append(result)

        # Log consolidado
        if result.success:
            framework.memory_manager.store_memory(
                content=f"Tarefa concluída: {task}",
                memory_type="batch_success",
                metadata={"batch_id": "batch_001"}
            )

    return results
```

## Monitoramento e Logging

### 1. Métricas Customizadas

```python
import time
from datetime import datetime

class MonitoredFramework(GenAIMiniFramework):
    def __init__(self, config):
        super().__init__(config)
        self.metrics = {
            "tasks_executed": 0,
            "total_execution_time": 0,
            "success_rate": 0
        }

    def run_task(self, task_description, **kwargs):
        start_time = time.time()
        result = super().run_task(task_description, **kwargs)

        # Atualizar métricas
        self.metrics["tasks_executed"] += 1
        self.metrics["total_execution_time"] += result.execution_time

        if result.success:
            self.metrics["success_rate"] = (
                self.metrics.get("successful_tasks", 0) + 1
            ) / self.metrics["tasks_executed"]

        return result
```

### 2. Dashboard de Status

```python
def get_framework_dashboard(framework):
    return {
        "framework_status": framework.get_framework_status(),
        "cache_stats": framework.get_cache_stats(),
        "recent_memories": framework.search_memory("", limit=10),
        "memory_counts": {
            "conversation": len(framework.search_memory("", "conversation", 1000)),
            "personality": len(framework.search_memory("", "personality", 1000)),
            "procedure": len(framework.search_memory("", "procedure", 1000))
        }
    }
```

## Backup e Recuperação

### 1. Export de Memórias

```python
import json
from datetime import datetime

def export_memories(framework, output_file):
    """Exporta todas as memórias para backup"""

    all_memories = []
    memory_types = ["conversation", "personality", "procedure", "execution_log"]

    for memory_type in memory_types:
        memories = framework.search_memory("", memory_type, limit=10000)
        all_memories.extend(memories)

    backup_data = {
        "export_date": datetime.now().isoformat(),
        "framework_version": "1.0",
        "total_memories": len(all_memories),
        "memories": all_memories
    }

    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(backup_data, f, indent=2, ensure_ascii=False)
```

### 2. Import de Backup

```python
def import_backup(framework, backup_file):
    """Importa backup de memórias"""

    with open(backup_file, 'r', encoding='utf-8') as f:
        backup_data = json.load(f)

    imported_count = 0

    for memory in backup_data['memories']:
        framework.memory_manager.store_memory(
            content=memory['content'],
            memory_type=memory['memory_type'],
            metadata=memory.get('metadata', {})
        )
        imported_count += 1

    return imported_count
```

Este guia cobre as principais formas de integrar o GenAI Mini Framework com sistemas existentes, personalizar seu comportamento e otimizar sua performance.
