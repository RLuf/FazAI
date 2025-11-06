# Guia de Deployment - GenAI Mini Framework

## 🚀 Deploy em Produção

### Infraestrutura Recomendada

#### Requisitos Mínimos
- **CPU**: 4 cores (8 cores recomendado)
- **RAM**: 8GB (16GB recomendado)  
- **Armazenamento**: 50GB SSD
- **Rede**: Conexão estável para APIs externas

#### Requisitos para llama.cpp Local
- **RAM**: +8GB por modelo carregado
- **GPU**: NVIDIA com 8GB+ VRAM (opcional, mas recomendado)
- **CPU**: 8+ cores para inference CPU

### Arquitetura de Deploy

```
┌─────────────────────────────────────────────────────────┐
│                Load Balancer                            │
└─────────────────────┬───────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────┐
│               GenAI Framework API                       │
│  ┌─────────────┬──────────────┬─────────────────────┐   │
│  │   Cache     │    Memory    │    Fallback         │   │
│  │ (GPTCache)  │  (Qdrant)    │   (Hierarchy)       │   │
│  └─────────────┴──────────────┴─────────────────────┘   │
└─────────────────────┬───────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────┐
│           Local LLM Cluster (llama.cpp)                │
│  ┌─────────────┬──────────────┬─────────────────────┐   │
│  │   Gerente   │   Analista   │   Programador       │   │
│  │   :8000     │   :8001      │   :8002             │   │
│  └─────────────┴──────────────┴─────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

## 🐳 Deploy com Docker

### Dockerfile Principal

```dockerfile
FROM python:3.11-slim

WORKDIR /app

# Instalar dependências do sistema
RUN apt-get update && apt-get install -y \
    curl \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Copiar arquivos do framework
COPY requirements.txt .
COPY *.py ./
COPY scripts/ ./scripts/
COPY docs/ ./docs/

# Instalar dependências Python
RUN pip install --no-cache-dir -r requirements.txt

# Criar usuário não-root
RUN useradd -m -s /bin/bash genai
USER genai

# Expor porta para API
EXPOSE 8080

# Comando padrão
CMD ["python", "api_server.py"]
```

### Docker Compose Completo

```yaml
version: '3.8'

services:
  # Qdrant Vector Database
  qdrant:
    image: qdrant/qdrant:latest
    ports:
      - "6333:6333"
      - "6334:6334"
    volumes:
      - qdrant_data:/qdrant/storage
    environment:
      - QDRANT__SERVICE__HTTP_PORT=6333
      - QDRANT__SERVICE__GRPC_PORT=6334

  # GenAI Framework API
  genai-framework:
    build: .
    ports:
      - "8080:8080"
    environment:
      - GOOGLE_API_KEY=${GOOGLE_API_KEY}
      - QDRANT_HOST=qdrant
      - QDRANT_PORT=6333
      - LOG_LEVEL=INFO
    depends_on:
      - qdrant
    volumes:
      - ./claude_exports:/app/claude_exports
      - ./models:/app/models
    restart: unless-stopped

  # Servidor Gerente (llama.cpp)
  llama-gerente:
    image: ghcr.io/ggerganov/llama.cpp:server
    ports:
      - "8000:8000"
    volumes:
      - ./models:/models
    command: >
      --server 
      --host 0.0.0.0 
      --port 8000
      --model /models/gemma-2-9b-it.Q4_K_M.gguf
      --n-gpu-layers -1
      --ctx-size 4096
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: 1
              capabilities: [gpu]

  # Servidor Analista (llama.cpp)  
  llama-analista:
    image: ghcr.io/ggerganov/llama.cpp:server
    ports:
      - "8001:8001"
    volumes:
      - ./models:/models
    command: >
      --server
      --host 0.0.0.0
      --port 8001  
      --model /models/gemma-2-9b-it.Q4_K_M.gguf
      --n-gpu-layers -1
      --ctx-size 4096

  # Servidor Programador (llama.cpp)
  llama-programador:
    image: ghcr.io/ggerganov/llama.cpp:server
    ports:
      - "8002:8002"
    volumes:
      - ./models:/models
    command: >
      --server
      --host 0.0.0.0
      --port 8002
      --model /models/CodeGemma-7B-Instruct.Q4_K_M.gguf
      --n-gpu-layers -1
      --ctx-size 4096

volumes:
  qdrant_data:
```

### .env para Docker

```env
# Google GenAI
GOOGLE_API_KEY=sua_chave_aqui

# Configurações de produção
LOG_LEVEL=INFO
MAX_STEPS=50
TIMEOUT_SECONDS=60

# Cache settings  
ENABLE_CACHE=true
CACHE_SIMILARITY_THRESHOLD=0.95
```

## ☸️ Deploy em Kubernetes

### ConfigMap

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: genai-framework-config
data:
  QDRANT_HOST: "qdrant-service"
  QDRANT_PORT: "6333"
  LOG_LEVEL: "INFO"
  MAX_STEPS: "50"
  TIMEOUT_SECONDS: "60"
  ENABLE_CACHE: "true"
```

### Secret

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: genai-framework-secrets
type: Opaque
data:
  GOOGLE_API_KEY: <base64-encoded-api-key>
```

### Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: genai-framework
spec:
  replicas: 2
  selector:
    matchLabels:
      app: genai-framework
  template:
    metadata:
      labels:
        app: genai-framework
    spec:
      containers:
      - name: genai-framework
        image: genai-framework:latest
        ports:
        - containerPort: 8080
        env:
        - name: GOOGLE_API_KEY
          valueFrom:
            secretKeyRef:
              name: genai-framework-secrets
              key: GOOGLE_API_KEY
        envFrom:
        - configMapRef:
            name: genai-framework-config
        resources:
          requests:
            memory: "2Gi"
            cpu: "1000m"
          limits:
            memory: "4Gi"
            cpu: "2000m"
        livenessProbe:
          httpGet:
            path: /health
            port: 8080
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /ready
            port: 8080
          initialDelaySeconds: 5
          periodSeconds: 5
```

### Service

```yaml
apiVersion: v1
kind: Service
metadata:
  name: genai-framework-service
spec:
  selector:
    app: genai-framework
  ports:
  - protocol: TCP
    port: 80
    targetPort: 8080
  type: LoadBalancer
```

## 🔄 CI/CD Pipeline

### GitHub Actions

```yaml
name: Deploy GenAI Framework

on:
  push:
    branches: [main]
    tags: ['v*']

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v4
    
    - name: Set up Python
      uses: actions/setup-python@v4
      with:
        python-version: '3.11'
    
    - name: Install dependencies
      run: |
        pip install -r requirements.txt
        pip install pytest
    
    - name: Run tests
      run: pytest tests/
      
  build:
    needs: test
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v4
    
    - name: Build Docker image
      run: |
        docker build -t genai-framework:${{ github.sha }} .
        docker tag genai-framework:${{ github.sha }} genai-framework:latest
    
    - name: Push to registry
      run: |
        # Push para seu registry preferido
        docker push genai-framework:${{ github.sha }}
        docker push genai-framework:latest

  deploy:
    needs: build
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    steps:
    - name: Deploy to production
      run: |
        # Deploy script específico da sua infraestrutura
        kubectl apply -f k8s/
```

## 📊 Monitoramento

### Health Check Endpoint

```python
from flask import Flask, jsonify

app = Flask(__name__)
framework = GenAIMiniFramework()

@app.route('/health')
def health_check():
    status = framework.get_framework_status()
    
    is_healthy = (
        status['initialized'] and
        framework.memory_manager and
        framework.cache_manager
    )
    
    return jsonify({
        'status': 'healthy' if is_healthy else 'unhealthy',
        'framework': status,
        'timestamp': datetime.now().isoformat()
    }), 200 if is_healthy else 503

@app.route('/metrics')
def metrics():
    cache_stats = framework.get_cache_stats()
    
    return jsonify({
        'cache': cache_stats,
        'memory': {
            'total_memories': len(framework.search_memory("", limit=10000))
        },
        'uptime': (datetime.now() - framework.start_time).total_seconds()
    })
```

### Prometheus Metrics

```python
from prometheus_client import Counter, Histogram, Gauge, generate_latest

# Métricas
TASKS_TOTAL = Counter('genai_tasks_total', 'Total tasks executed', ['status'])
TASK_DURATION = Histogram('genai_task_duration_seconds', 'Task execution time')
CACHE_HITS = Counter('genai_cache_hits_total', 'Cache hits')
MEMORY_SIZE = Gauge('genai_memory_entries_total', 'Total memory entries')

@app.route('/metrics')
def prometheus_metrics():
    return generate_latest()
```

## 🔒 Segurança

### Autenticação

```python
from functools import wraps
import jwt

def require_auth(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = request.headers.get('Authorization')
        if not token:
            return jsonify({'error': 'Token required'}), 401
        
        try:
            token = token.replace('Bearer ', '')
            jwt.decode(token, app.config['SECRET_KEY'], algorithms=['HS256'])
        except jwt.InvalidTokenError:
            return jsonify({'error': 'Invalid token'}), 401
        
        return f(*args, **kwargs)
    return decorated

@app.route('/execute_task', methods=['POST'])
@require_auth  
def secure_execute_task():
    # Implementação segura
    pass
```

### Rate Limiting

```python
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address

limiter = Limiter(
    app,
    key_func=get_remote_address,
    default_limits=["100 per hour"]
)

@app.route('/execute_task', methods=['POST'])
@limiter.limit("10 per minute")
def rate_limited_execute_task():
    # Implementação com rate limit
    pass
```

## 🔧 Troubleshooting de Produção

### Logs Estruturados

```python
import structlog

logger = structlog.get_logger()

def log_task_execution(task_id, description, result):
    logger.info(
        "task_executed",
        task_id=task_id,
        description=description,
        success=result.success,
        steps=result.steps_executed,
        execution_time=result.execution_time,
        final_level=result.final_level.name
    )
```

### Alertas

```python
import requests

def send_alert(message, severity="warning"):
    if severity == "critical":
        # Slack, PagerDuty, etc
        requests.post(ALERT_WEBHOOK, json={
            "text": f"🚨 GenAI Framework Alert: {message}"
        })

# Usar em casos críticos
try:
    framework = GenAIMiniFramework()
except Exception as e:
    send_alert(f"Framework initialization failed: {e}", "critical")
```

### Backup Automatizado

```bash
#!/bin/bash
# backup.sh - Backup das collections Qdrant

DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/backups/qdrant/$DATE"

mkdir -p "$BACKUP_DIR"

# Backup via API Qdrant
curl -X GET "http://localhost:6333/collections/fz_memories/snapshots" > "$BACKUP_DIR/memories.json"
curl -X GET "http://localhost:6333/collections/fazai_logs_execucao/snapshots" > "$BACKUP_DIR/logs.json"
curl -X GET "http://localhost:6333/collections/fazai_personalidade/snapshots" > "$BACKUP_DIR/personality.json"

# Compactar
tar -czf "/backups/framework_backup_$DATE.tar.gz" "$BACKUP_DIR"
rm -rf "$BACKUP_DIR"

echo "Backup criado: framework_backup_$DATE.tar.gz"
```

### Restore

```bash
#!/bin/bash
# restore.sh - Restore de backup

BACKUP_FILE="$1"

if [ ! -f "$BACKUP_FILE" ]; then
    echo "Arquivo de backup não encontrado: $BACKUP_FILE"
    exit 1
fi

# Extrair backup
TEMP_DIR="/tmp/restore_$(date +%s)"
mkdir -p "$TEMP_DIR"
tar -xzf "$BACKUP_FILE" -C "$TEMP_DIR"

# Restore collections (implementar conforme necessidade)
echo "Restore iniciado de $BACKUP_FILE"
```

## 📈 Scaling

### Horizontal Scaling

Para escalar horizontalmente:

1. **API Layer**: Múltiplas instâncias atrás de load balancer
2. **Qdrant**: Cluster Qdrant com sharding
3. **Cache**: Cache distribuído com Redis
4. **LLM Servers**: Pool de servidores llama.cpp

### Auto Scaling

```yaml
# HPA para Kubernetes
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: genai-framework-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: genai-framework
  minReplicas: 2
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
```

## 🔍 Observability

### Logging Centralizado

```yaml
# Fluentd config para logs
<source>
  @type tail
  path /var/log/genai-framework/*.log
  pos_file /var/log/fluentd/genai.log.pos
  tag genai.framework
  format json
</source>

<match genai.**>
  @type elasticsearch
  host elasticsearch
  port 9200
  index_name genai-logs
</match>
```

### Grafana Dashboard

Métricas importantes para dashboards:

- **Taxa de sucesso de tarefas**
- **Tempo médio de execução** 
- **Distribuição por nível de fallback**
- **Cache hit rate**
- **Número de memórias por tipo**
- **Latência das APIs externas**

## 🛠️ Manutenção

### Tarefas Regulares

1. **Diário**: Verificar logs de erro
2. **Semanal**: Backup das collections Qdrant  
3. **Mensal**: Limpeza de cache antigo
4. **Trimestral**: Análise de performance e otimização

### Scripts de Manutenção

```python
#!/usr/bin/env python3
# maintenance.py

def cleanup_old_memories(framework, days=90):
    """Remove memórias antigas"""
    cutoff_date = datetime.now() - timedelta(days=days)
    
    # Implementar limpeza baseada em timestamp
    # (Requer implementação específica no memory_manager)

def optimize_cache(framework):
    """Otimiza cache removendo entradas pouco usadas"""
    framework.clear_cache()
    print("Cache otimizado")

def health_check_all_services(framework):
    """Verifica saúde de todos os serviços"""
    status = framework.get_framework_status()
    
    checks = {
        "framework": status['initialized'],
        "cache": status.get('cache_enabled', False),
        "qdrant": True,  # Implementar check real
        "llama_servers": True  # Implementar check real
    }
    
    return all(checks.values())
```

## 🚨 Disaster Recovery

### Plano de Contingência

1. **Falha do Qdrant**: 
   - Framework continua funcionando apenas com GenAI online
   - Restore do último backup quando serviço voltar

2. **Falha da API Google**:
   - Sistema automaticamente usa apenas llama.cpp local
   - Alertas para equipe técnica

3. **Falha dos servidores locais**:
   - Framework escala automaticamente para GenAI online
   - Performance reduzida mas funcional

### Recovery Procedures

```bash
#!/bin/bash
# disaster_recovery.sh

echo "🚨 Iniciando procedimento de recovery..."

# 1. Verificar serviços
systemctl status qdrant || systemctl restart qdrant
docker ps | grep llama || docker-compose up -d

# 2. Restore de backup se necessário
if [ "$1" == "--restore" ]; then
    ./restore.sh /backups/latest_backup.tar.gz
fi

# 3. Verificar saúde
python -c "
from genai_mini_framework import GenAIMiniFramework
framework = GenAIMiniFramework()
status = framework.get_framework_status()
print('Framework healthy:', status['initialized'])
"

echo "✅ Recovery procedure completed"
```

Este guia cobre todas as aspectos principais de deploy em produção do GenAI Mini Framework, desde configuração básica até disaster recovery.