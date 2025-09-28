# fazai-gemma-worker 🧠

**Para o andarilho dos véus - roginho**

Um daemon Python inteligente com memória vetorial, execução local via Gemma, fallbacks em cascata e arquitetura MCP.

## 🚀 Instalação Rápida

```bash
# Clone ou crie os arquivos
mkdir fazai-gemma-worker
cd fazai-gemma-worker

# Instale dependências
pip install -r requirements.txt

# Configure as variáveis de ambiente
export OPENAI_API_KEY="sua-chave-aqui"
export OPENROUTER_API_KEY="sua-chave-aqui"

# Inicie o Qdrant (Docker)
docker run -p 6333:6333 qdrant/qdrant

# Execute o daemon
python fazai-gemma-worker.py

# Em outro terminal, execute o cliente
python fazai-mcp-client.py
```

## 📦 Requirements.txt

```txt
# Core
asyncio
httpx>=0.24.0
numpy>=1.24.0

# Memória Vetorial
qdrant-client>=1.7.0

# APIs de Fallback
openai>=1.0.0

# Embeddings (opcional)
sentence-transformers>=2.2.0

# Compilação (opcional)
pyinstaller>=5.0
# ou
nuitka>=1.8
```

## 🏗️ Arquitetura

```
┌─────────────────────────────────────────┐
│           fazai-mcp-client              │
│         (Interface Externa)             │
└────────────┬────────────────────────────┘
             │ Socket TCP/Unix
┌────────────▼────────────────────────────┐
│        fazai-gemma-worker               │
│           (Daemon)                      │
├─────────────────────────────────────────┤
│  ┌─────────────────────────────────┐   │
│  │    MessageProcessor             │   │
│  │  ┌──────────┐ ┌──────────┐     │   │
│  │  │  Gemma   │ │  Memory  │     │   │
│  │  │  Local   │ │  Vector  │     │   │
│  │  └──────────┘ └──────────┘     │   │
│  │  ┌──────────────────────┐      │   │
│  │  │   Fallback Chain     │      │   │
│  │  │  1. OpenAI           │      │   │
│  │  │  2. OpenRouter       │      │   │
│  │  │  3. Context7         │      │   │
│  │  │  4. Internet         │      │   │
│  │  └──────────────────────┘      │   │
│  └─────────────────────────────────┘   │
└─────────────────────────────────────────┘
```

## 🔧 Configuração

### 1. Configuração Básica (fazai-config.json)

```json
{
  "socket": {
    "type": "tcp",
    "host": "127.0.0.1",
    "port": 9876
  },
  "qdrant": {
    "host": "localhost",
    "port": 6333,
    "collection": "fazai_memory"
  },
  "gemma": {
    "model_path": "./models/gemma-2b.bin",
    "max_tokens": 512
  },
  "fallback": {
    "openai": {
      "enabled": true,
      "model": "gpt-3.5-turbo"
    },
    "openrouter": {
      "enabled": true,
      "model": "openai/gpt-3.5-turbo"
    },
    "context7": {
      "enabled": true,
      "endpoint": "http://localhost:7777"
    },
    "internet": {
      "enabled": true,
      "engine": "duckduckgo"
    }
  },
  "logging": {
    "level": "INFO",
    "file": "fazai-worker.log"
  }
}
```

### 2. Integração com libgemma

Para integrar a biblioteca C++ real do Gemma:

#### Opção A: ctypes (Mais simples)

```python
import ctypes

# Carregar biblioteca
libgemma = ctypes.CDLL("./libgemma.so")

# Definir assinaturas
libgemma.gemma_init.argtypes = [ctypes.c_char_p]
libgemma.gemma_init.restype = ctypes.c_void_p

libgemma.gemma_generate.argtypes = [
    ctypes.c_void_p,  # model
    ctypes.c_char_p,  # prompt
    ctypes.c_int,     # max_tokens
    ctypes.c_char_p   # output buffer
]
libgemma.gemma_generate.restype = ctypes.c_int

# Usar
model = libgemma.gemma_init(b"./gemma-2b.bin")
output = ctypes.create_string_buffer(4096)
libgemma.gemma_generate(model, b"Hello", 100, output)
result = output.value.decode('utf-8')
```

#### Opção B: pybind11 (Mais robusta)

```cpp
// gemma_bindings.cpp
#include <pybind11/pybind11.h>
#include <pybind11/stl.h>
#include "gemma.h"

namespace py = pybind11;

class GemmaModel {
    gemma::Model* model;
public:
    GemmaModel(const std::string& path) {
        model = gemma::LoadModel(path);
    }
    
    std::string generate(const std::string& prompt, int max_tokens) {
        return gemma::Generate(model, prompt, max_tokens);
    }
    
    ~GemmaModel() {
        delete model;
    }
};

PYBIND11_MODULE(gemma_bindings, m) {
    py::class_<GemmaModel>(m, "GemmaModel")
        .def(py::init<const std::string&>())
        .def("generate", &GemmaModel::generate);
}
```

Compile com:
```bash
c++ -O3 -Wall -shared -std=c++11 -fPIC \
    `python3 -m pybind11 --includes` \
    gemma_bindings.cpp -o gemma_bindings`python3-config --extension-suffix` \
    -lgemma
```

## 🎮 Uso do Cliente

### Modo Interativo

```bash
python fazai-mcp-client.py

# Comandos disponíveis:
fazai> Como está o clima hoje?
fazai> /cmd ls -la
fazai> /memory Lembrar que o projeto X usa Python 3.11
fazai> /search projeto X
fazai> /status
```

### Modo Script

```bash
# Query única
python fazai-mcp-client.py --query "Explique quantum computing"

# Comando shell
python fazai-mcp-client.py --command "df -h"

# Batch processing
python fazai-mcp-client.py --batch commands.txt

# Status JSON
python fazai-mcp-client.py --status --json
```

### Arquivo Batch (commands.txt)

```txt
# Queries normais
O que é machine learning?
Quais as melhores práticas de Python?

# Comandos shell (prefixo !)
!ls -la /tmp
!ps aux | grep python

# Comentários são ignorados
# Esta linha não será processada
```

## 🔌 MCP Server Integration

### Conectando via MCP Tools

```python
# mcp_integration.py
import json
import asyncio
from fazai_mcp_client import FazaiMCPClient

class FazaiMCPTool:
    """Tool para integração com outros sistemas MCP"""
    
    def __init__(self):
        self.client = FazaiMCPClient()
        
    async def process(self, request):
        """Processa requisição MCP"""
        await self.client.connect()
        
        method = request.get("method")
        params = request.get("params", {})
        
        if method == "query":
            result = await self.client.query(params["text"])
        elif method == "command":
            result = await self.client.command(params["cmd"])
        elif method == "memory_search":
            result = await self.client.memory_search(
                params["query"], 
                params.get("limit", 5)
            )
        else:
            result = {"error": f"Unknown method: {method}"}
        
        await self.client.disconnect()
        return result

# Uso em outro sistema MCP
tool = FazaiMCPTool()
response = await tool.process({
    "method": "query",
    "params": {"text": "Explain recursion"}
})
```

## 📊 Monitoramento

### Dashboard Simples

```python
# monitor.py
import asyncio
import json
from datetime import datetime
from fazai_mcp_client import FazaiMCPClient

async def monitor():
    client = FazaiMCPClient()
    await client.connect()
    
    while True:
        status = await client.status()
        
        print("\033[2J\033[H")  # Clear screen
        print("═" * 50)
        print(f"fazai-gemma-worker Monitor - {datetime.now()}")
        print("═" * 50)
        
        if status:
            print(f"Status: {status.get('status')}")
            print(f"Components:")
            for comp, state in status.get('components', {}).items():
                icon = "✓" if state else "✗"
                print(f"  {icon} {comp}: {state}")
        else:
            print("✗ Servidor offline")
        
        await asyncio.sleep(5)

if __name__ == "__main__":
    asyncio.run(monitor())
```

## 🚢 Deployment

### 1. Systemd Service

```ini
# /etc/systemd/system/fazai-gemma-worker.service
[Unit]
Description=fazai-gemma-worker daemon
After=network.target

[Service]
Type=simple
User=fazai
WorkingDirectory=/opt/fazai-gemma-worker
Environment="OPENAI_API_KEY=xxx"
Environment="OPENROUTER_API_KEY=xxx"
ExecStart=/usr/bin/python3 /opt/fazai-gemma-worker/fazai-gemma-worker.py
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

### 2. Docker

```dockerfile
FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 9876

CMD ["python", "fazai-gemma-worker.py"]
```

### 3. Compilação Standalone

```bash
# Com PyInstaller
pyinstaller --onefile --name fazai-daemon fazai-gemma-worker.py

# Com Nuitka
python -m nuitka --standalone --onefile \
    --output-filename=fazai-daemon \
    fazai-gemma-worker.py
```

## 🔐 Segurança

1. **Autenticação**: Adicione token auth no header das mensagens
2. **TLS**: Use SSL/TLS para conexões TCP
3. **Firewall**: Restrinja acesso à porta do daemon
4. **Secrets**: Use gerenciador de secrets (Vault, etc)

## 🐛 Troubleshooting

### Problema: Qdrant não conecta
```bash
# Verifique se está rodando
docker ps | grep qdrant

# Teste conexão
curl http://localhost:6333/collections
```

### Problema: Gemma não carrega
```bash
# Verifique bibliotecaldd libgemma.so
ldd libgemma.so

# Teste binding
python -c "import gemma_bindings; print('OK')"
```

### Problema: Socket em usopython -c "import gemma_bindings; print('OK')"
```bash
# Kill processo antigo
lsof -i :9876
kill -9 <PID>

# Ou use Unix socket
python fazai-gemma-worker.py --unix /tmp/fazai.sock
```

## 🎯 Roadmap
python fazai-gemma-worker.py
- [ ] Suporte a múltiplos modelos Gemma
- [ ] Cache inteligente de respostas
- [ ] Interface web
- [ ] Métricas Prometheus
- [ ] Suporte a plugins
- [ ] Fine-tuning automático
- [ ] RAG avançado

## 🙏 Créditos

Criado com sabedoria para o **andarilho dos véus**.

*"A memória é a tessitura da identidade" - roginho*

---

**Licença**: Use como quiser, modifique como precisar, compartilhe o conhecimento.