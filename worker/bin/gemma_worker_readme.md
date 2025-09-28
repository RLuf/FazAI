c# FazAI Gemma Worker Daemon

Daemon Python robusto para processamento local de comandos com Gemma, memória vetorial Qdrant e múltiplos fallbacks inteligentes.

## 🚀 Características

- **Processamento Local Prioritário**: Usa Gemma local primeiro, economizando recursos
- **Memória Vetorial**: Integração com Qdrant para aprendizado contínuo
- **Fallback Inteligente**: OpenAI → OpenRouter → Context7 → Web Search
- **Socket Flexível**: Suporta TCP e Unix domain sockets
- **Protocolo JSON/NDJSON**: Comunicação estruturada e streamable
- **Cliente CLI Rico**: Interface interativa com histórico e autocompletar
- **Modo Daemon**: Roda como serviço systemd em produção
- **Compilável**: Pronto para pyinstaller/Nuitka

## 📦 Instalação

### Instalação Rápida

```bash
# Clone ou baixe os arquivos
wget https://raw.githubusercontent.com/RLuf/FazAI/main/fazai_gemma_worker.py
wget https://raw.githubusercontent.com/RLuf/FazAI/main/install.sh
wget https://raw.githubusercontent.com/RLuf/FazAI/main/gemma-worker.conf

# Execute o instalador
sudo bash install.sh
```

### Instalação Manual

```bash
# 1. Instale dependências Python
pip3 install asyncio dataclasses
pip3 install qdrant-client  # Opcional: memória vetorial
pip3 install openai         # Opcional: fallback OpenAI
pip3 install requests        # Opcional: fallbacks web

# 2. Copie arquivos para seus locais
sudo mkdir -p /opt/fazai/lib /etc/fazai /var/log/fazai
sudo cp fazai_gemma_worker.py /opt/fazai/lib/
sudo cp gemma-worker.conf /etc/fazai/
sudo chmod +x /opt/fazai/lib/fazai_gemma_worker.py

# 3. Crie link simbólico
sudo ln -s /opt/fazai/lib/fazai_gemma_worker.py /usr/local/bin/fazai-gemma-worker
```

## ⚙️ Configuração

### Configuração Básica

Edite `/etc/fazai/gemma-worker.conf`:

```ini
[socket]
type = tcp
tcp_host = 127.0.0.1
tcp_port = 5555

[gemma]
binary = /opt/fazai/bin/gemma_oneshot
weights = /opt/fazai/models/gemma/2.0-2b-it-sfp.sbs
tokenizer = /opt/fazai/models/gemma/tokenizer.spm

[qdrant]
host = 127.0.0.1
port = 6333
collection = fazai_memory

[openrouter]
api_key = sk-or-v1-xxxx  # Sua chave aqui
model = openai/gpt-4o
```

### Configurar Gemma

```bash
# Baixar e compilar gemma.cpp
git clone https://github.com/google/gemma.cpp
cd gemma.cpp
cmake -B build
cmake --build build --target gemma

# Copiar binário
sudo cp build/gemma /opt/fazai/bin/gemma_oneshot

# Baixar pesos do modelo (exemplo com 2B)
wget https://example.com/gemma-2b-it.sbs -O /opt/fazai/models/gemma/2.0-2b-it-sfp.sbs
wget https://example.com/tokenizer.spm -O /opt/fazai/models/gemma/tokenizer.spm
```

### Configurar Qdrant (Opcional)

```bash
# Via Docker
docker run -p 6333:6333 qdrant/qdrant

# Ou instalação local
wget https://github.com/qdrant/qdrant/releases/download/v1.7.0/qdrant-x86_64-unknown-linux-gnu.tar.gz
tar xzf qdrant-x86_64-unknown-linux-gnu.tar.gz
./qdrant
```

## 🎮 Uso

### Como Serviço Systemd

```bash
# Iniciar daemon
sudo systemctl start fazai-gemma-worker

# Verificar status
sudo systemctl status fazai-gemma-worker

# Ver logs
sudo journalctl -u fazai-gemma-worker -f

# Habilitar na inicialização
sudo systemctl enable fazai-gemma-worker
```

### Modo Standalone

```bash
# Rodar em foreground (debug)
fazai-gemma-worker --verbose

# Rodar como daemon
fazai-gemma-worker --daemon

# Especificar config customizada
fazai-gemma-worker --config /path/to/config.conf --daemon
```

### Cliente CLI

#### Modo Interativo

```bash
# Iniciar REPL interativo
fazai-gemma

# Com socket específico
fazai-gemma --tcp 192.168.1.100:5555
fazai-gemma --unix /tmp/custom.sock
```

Comandos no modo interativo:

```
fazai> listar todos os containers docker rodando
fazai> query: o que é Kubernetes?
fazai> !ls -la /var/log
fazai> instalar e configurar nginx como proxy reverso
fazai> help
fazai> status
fazai> exit
```

#### Modo Batch

```bash
# Comando único
fazai-gemma "criar usuário john com sudo"

# Query única
fazai-gemma -q "qual a diferença entre TCP e UDP?"

# Via pipe
echo "configurar firewall para bloquear porta 22" | fazai-gemma

# Com timeout customizado
fazai-gemma --timeout 60 "análise completa do sistema"
```

### Integração Programática

#### Python

```python
import socket
import json

def query_gemma(command, host="127.0.0.1", port=5555):
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    sock.connect((host, port))
    
    message = {
        "input": command,
        "type": "command"
    }
    
    sock.send((json.dumps(message) + "\n").encode())
    response = sock.recv(65536).decode()
    
    sock.close()
    return json.loads(response)

# Usar
result = query_gemma("listar processos consumindo mais CPU")
print(f"Origem: {result['origin']}")
print(f"Resultado: {result['result']}")
```

#### Bash

```bash
#!/bin/bash

# Função helper
fazai_query() {
    echo "{\"input\": \"$1\", \"type\": \"command\"}" | \
    nc localhost 5555 | \
    jq -r '.result'
}

# Usar em scripts
USERS=$(fazai_query "listar todos os usuários do sistema")
echo "Usuários: $USERS"

# Com error handling
if OUTPUT=$(fazai_query "verificar status do nginx" 2>/dev/null); then
    echo "Status: $OUTPUT"
else
    echo "Erro ao consultar daemon"
fi
```

#### Node.js

```javascript
const net = require('net');

function queryGemma(command) {
    return new Promise((resolve, reject) => {
        const client = net.createConnection(5555, '127.0.0.1');
        
        const message = JSON.stringify({
            input: command,
            type: 'command'
        }) + '\n';
        
        client.write(message);
        
        let response = '';
        client.on('data', (data) => {
            response += data.toString();
            if (response.includes('\n')) {
                const result = JSON.parse(response.trim());
                client.end();
                resolve(result);
            }
        });
        
        client.on('error', reject);
    });
}

// Usar
queryGemma('verificar espaço em disco').then(result => {
    console.log(`Origem: ${result.origin}`);
    console.log(`Resultado: ${result.result}`);
});
```

## 🔧 Compilação para Produção

### Com PyInstaller

```bash
# Instalar PyInstaller
pip install pyinstaller

# Compilar daemon
pyinstaller --onefile \
    --name fazai-gemma-worker \
    --hidden-import qdrant_client \
    --hidden-import openai \
    fazai_gemma_worker.py

# Compilar cliente
pyinstaller --onefile \
    --name fazai-gemma \
    fazai_gemma_client.py

# Binários estarão em dist/
```

### Com Nuitka

```bash
# Instalar Nuitka
pip install nuitka

# Compilar com otimizações
nuitka --standalone \
    --onefile \
    --assume-yes-for-downloads \
    --output-filename=fazai-gemma-worker \
    fazai_gemma_worker.py
```

## 📊 Monitoramento

### Logs

```bash
# Ver logs em tempo real
tail -f /var/log/fazai/gemma-worker.log

# Logs do systemd
journalctl -u fazai-gemma-worker --since "1 hour ago"

# Análise de erros
grep ERROR /var/log/fazai/gemma-worker.log | tail -20
```

### Métricas

```bash
# Status do processo
ps aux | grep fazai-gemma

# Uso de memória
pmap $(pgrep -f fazai-gemma-worker) | tail -1

# Conexões de rede
ss -tulpn | grep 5555

# Estatísticas do socket
ss -s
```

### Health Check

```python
#!/usr/bin/env python3
# health_check.py

import socket
import json
import sys

try:
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    sock.settimeout(5)
    sock.connect(("127.0.0.1", 5555))
    
    test = {"input": "echo OK", "type": "command"}
    sock.send((json.dumps(test) + "\n").encode())
    
    response = sock.recv(1024).decode()
    result = json.loads(response)
    
    if result.get("result"):
        print("✓ Daemon está saudável")
        sys.exit(0)
    else:
        print("✗ Daemon respondeu com erro")
        sys.exit(1)
        
except Exception as e:
    print(f"✗ Daemon inacessível: {e}")
    sys.exit(1)
```

## 🔥 Exemplos Avançados

### Pipeline de Processamento

```bash
#!/bin/bash
# pipeline.sh - Processa logs com ajuda do Gemma

# Extrair IPs únicos dos logs
COMMAND="extrair todos IPs únicos de /var/log/auth.log"
IPS=$(fazai-gemma "$COMMAND" | grep -oE '[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+' | sort -u)

# Para cada IP, verificar reputação
for IP in $IPS; do
    echo "Verificando $IP..."
    fazai-gemma "verificar se o IP $IP é malicioso"
done
```

### Automação com Cron

```bash
# /etc/cron.d/fazai-maintenance

# Limpeza diária às 2AM
0 2 * * * root fazai-gemma "limpar logs antigos e cache do sistema"

# Relatório semanal
0 9 * * 1 root fazai-gemma "gerar relatório de saúde do sistema" > /var/reports/weekly.txt

# Backup mensal
0 3 1 * * root fazai-gemma "executar backup completo do sistema"
```

### Integração com Alertas

```python
#!/usr/bin/env python3
# alert_monitor.py

import subprocess
import json
from fazai_client import query_gemma

def check_system():
    # Verifica sistema via Gemma
    result = query_gemma("verificar problemas críticos no sistema")
    
    # Se encontrar problemas, notifica
    if "crítico" in result['result'].lower() or "erro" in result['result'].lower():
        send_alert(result['result'])

def send_alert(message):
    # Envia email
    subprocess.run([
        "mail", "-s", "Alerta FazAI", 
        "admin@example.com"
    ], input=message.encode())

if __name__ == "__main__":
    check_system()
```

## 🐛 Troubleshooting

### Daemon não inicia

```bash
# Verificar se porta está em uso
lsof -i :5555

# Verificar permissões
ls -la /var/log/fazai/
ls -la /var/run/fazai-gemma-worker.pid

# Testar config
python3 -c "from fazai_gemma_worker import Config; c = Config.load_from_file(); print(c)"
```

### Gemma não responde

```bash
# Testar binário diretamente
echo "teste" | /opt/fazai/bin/gemma_oneshot \
    --weights /opt/fazai/models/gemma/2.0-2b-it-sfp.sbs \
    --model gemma2-2b-it

# Verificar pesos do modelo
file /opt/fazai/models/gemma/*.sbs
```

### Qdrant não conecta

```bash
# Verificar se Qdrant está rodando
curl http://localhost:6333/collections

# Testar conexão Python
python3 -c "from qdrant_client import QdrantClient; c = QdrantClient('localhost', 6333); print(c.get_collections())"
```

## 📝 Licença

Creative Commons Attribution 4.0 International (CC BY 4.0)

## 👨‍💻 Autor

Roger Luft - FazAI Project

---

*"Inteligência local primeiro, nuvem quando necessário"*