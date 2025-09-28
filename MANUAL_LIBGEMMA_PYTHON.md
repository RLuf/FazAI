# Manual de Uso da LibGemma com Bindings Python

## Visão Gera


FLUXO FUNDAMENTAL PRIMORDIAL SAGRADO DE FLUXO DE ATIIVIDADES.

ARQUIVO Deep-plan.txt    <<<<----------------------------------- SEGUIR O FLUXO EXATO SEM STUMS SEM SIMULACOES SEM HADCODED SEM AMADORISMO.

O Fazai consiste num orquestrador com um iferenciador baseado em gemma compilado em forma de lib a libgemma. Os objetivos primordiais sao:
1 - RECEBER ORDENS EM LINGUAGEM NATURAL, ENTENDER, PLANEJAR, EXECUTAR, RECEBER O RETORNO APLICAR O FLUXO, APRENDER COM O RESULTADO.
2 - O FAZAI FOI PREPARAD PARA TER MEMORIA PERMANENTE UMA BASE PLAUSIVEL DE INFERENCIA, CAPACIDADE DE UTILIZAR MCP, FERRAMENTAS INTERNET, MODULOS DIRETAMENTE NO KERNEL, EXECUTAR TAREFAS COMPLEXAS E RESPONDER PERGUNTAS (PARAMETRO -Q)
3- ATENDER APIS COMO CLOUDFLARE SPAMEXPERTS, GERENCIAR SISTEMAS DE SEGURANÇA COMO FIREWALLS OPNSENSE, PFSENSE, MIMKROTIK, ETC...
4 - GERAR ALERTAS E AÇÕES PRO ATIVAS.
5 - SEGUE O BAILE E DOCUMENTA..
6 - PROIBIDO STUMBS, SIMULAÇOES, HARDCODED OU QUALQUER TIPO DE AMADORISMO.
7 - PROIIDO ESTUMBS
8 - LEIA ATENTAMENTE MINHAS ORDENS E EXECUTE EXATAMENTE O QUE FOI PEDIDO NADA MAIS.
7 - REGISTRE EM DOCUMENTAÇÃO AS ALTERAÇÕES "CHANGELOG.md"
9 - A CADA ALTERAÇÃO APLIQUE A ODIFICAÇÃO NO INSTALADOR
10 - TESTAR SEMPRE O CODIGO ANTES DE AVANÇAR A TAREFA... TESTAR SIMULANDO O USO REAL E NAO CHAMADAS ALEATORIAS
11 - ARQUITETURA. /home/rluft/fazai = repositorio oficial local CUIDADO
12 - ARQUITETURA. /opt/fazai = diretorio principal do sistema ( o resto se vira pra descobrir )
13 - ARQUITETURA. CLI = bin/fazai, daemon legado = main.js, WORKER CLIENTE WRAPPERS E LIBS AGORA CENTRALIZADOS EM /home/rluft/fazai/worker/bin (fazai_gemma_worker.py, gemma_isolated.py, etc.).
14 - QDRANT. `fazai_memory` preserva personalidade/memórias do Claudio, `fazai_kb` concentra protocolos e diretrizes sigilosas (configure host/port e `vector_dim=384`).
14 - PROIBIDO STUMBS, HADCODED, SANATIZAÇÃO DE SEGURANÇA.

A **LibGemma** é uma biblioteca C++ leve e independente para inferência de modelos de linguagem Gemma do Google. Este manual detalha como utilizar a biblioteca integrada ao projeto FazAI, incluindo bindings Python via PyBind11 para facilitar o uso em aplicações Python.

## Arquitetura da Integração FazAI

### Componentes Principais

1. **LibGemma Core** (`libgemma.a`): Biblioteca C++ compilada a partir do código fonte oficial do Google
2. **GemmaWrapper** (`gemma_wrapper.cpp/h`): Wrapper C++ para isolamento e gerenciamento de sessões
3. **Python Bindings** (`gemma_native.cpp`): Módulo PyBind11 que expõe a funcionalidade para Python
4. **Worker FazAI** (`worker.cpp`): Integração com o sistema FazAI para processamento distribuído

### Fluxo de Dados

```
Prompt Python → PyBind11 → GemmaWrapper → LibGemma → Modelo → Tokens → Callback → String
```

## Instalação e Pré-requisitos

### Dependências do Sistema

```bash
# Ubuntu/Debian
sudo apt-get update
sudo apt-get install -y build-essential cmake python3-dev python3-pip

# Instalar PyBind11
pip3 install pybind11

# Instalar Highway (dependência da LibGemma)
git clone https://github.com/google/highway.git
cd highway && mkdir build && cd build
cmake .. && make -j$(nproc) && sudo make install

# Instalar SentencePiece (tokenização)
git clone https://github.com/google/sentencepiece.git
cd sentencepiece && mkdir build && cd build
cmake .. && make -j$(nproc) && sudo make install
```

### Compilação da LibGemma

```bash
# Clonar repositório oficial
git clone https://github.com/google/gemma.cpp.git
cd gemma.cpp

# Configurar build
cmake -B build -DCMAKE_BUILD_TYPE=Release

# Compilar biblioteca
cmake --build build -j$(nproc)

# Instalar (opcional)
sudo cmake --install build
```

### Download dos Modelos

```bash
# Instalar HuggingFace CLI
pip3 install huggingface-hub

# Fazer login (opcional, para modelos restritos)
huggingface-cli login

# Baixar modelo Gemma 2B (versão recomendada para desenvolvimento)
huggingface-cli download google/gemma-2b-sfp-cpp --local-dir /opt/fazai/models/gemma/
```

## Compilação dos Bindings Python

### Script Automatizado

```bash
# Executar script de build do FazAI
./build_gemma_native.sh
```

### Compilação Manual

```bash
# Compilar módulo PyBind11
g++ -O3 -Wall -shared -std=c++17 -fPIC \
    `python3 -m pybind11 --includes` \
    `python3-config --includes` \
    gemma_native.cpp \
    worker/build/libgemma_capi_real.a \
    -o gemma_native`python3-config --extension-suffix`
```

## Uso Básico em Python

### Importação e Inicialização

```python
#!/usr/bin/env python3
"""
Exemplo básico de uso da LibGemma via Python
"""

import sys
import os

# Adicionar caminho do módulo se necessário
sys.path.insert(0, '/opt/fazai/lib')

try:
    import gemma_native
    print("✓ Módulo gemma_native carregado com sucesso!")
    print(f"Versão: {gemma_native.__version__}")
    print(f"Autor: {gemma_native.__author__}")
except ImportError as e:
    print(f"✗ Erro ao importar módulo: {e}")
    sys.exit(1)
```

### Uso com Função Global

```python
# Uso mais simples - função global
prompt = "Olá Gemma, como você está?"
resposta = gemma_native.generate(prompt)
print(f"Prompt: {prompt}")
print(f"Resposta: {resposta}")
```

### Uso com Classe (Recomendado)

```python
# Uso recomendado - instância da classe para melhor controle
gemma = gemma_native.GemmaNative()

# Verificar inicialização
print(f"Modelo inicializado: {gemma.is_initialized()}")

# Gerar resposta
prompt = "Explique brevemente o que é inteligência artificial"
resposta = gemma.generate(prompt)
print(f"Resposta: {resposta}")

# Verificar status após uso
print(f"Modelo inicializado após uso: {gemma.is_initialized()}")
```

## Exemplos Avançados

### Processamento em Lote

```python
def processar_lote(prompts):
    """Processa múltiplos prompts de forma eficiente"""
    gemma = gemma_native.GemmaNative()
    resultados = []

    for prompt in prompts:
        try:
            resposta = gemma.generate(prompt)
            resultados.append({
                'prompt': prompt,
                'resposta': resposta,
                'sucesso': True
            })
        except Exception as e:
            resultados.append({
                'prompt': prompt,
                'erro': str(e),
                'sucesso': False
            })

    return resultados

# Exemplo de uso
prompts = [
    "O que é Python?",
    "Como funciona o aprendizado de máquina?",
    "Explique redes neurais de forma simples"
]

resultados = processar_lote(prompts)
for r in resultados:
    print(f"Prompt: {r['prompt'][:50]}...")
    if r['sucesso']:
        print(f"Resposta: {r['resposta'][:100]}...")
    else:
        print(f"Erro: {r['erro']}")
    print("-" * 50)
```

### Integração com Aplicações Web

```python
from flask import Flask, request, jsonify
import gemma_native

app = Flask(__name__)

# Inicializar modelo global (carregamento uma vez)
gemma_model = None

def get_gemma():
    global gemma_model
    if gemma_model is None:
        gemma_model = gemma_native.GemmaNative()
    return gemma_model

@app.route('/api/generate', methods=['POST'])
def generate():
    try:
        data = request.get_json()
        prompt = data.get('prompt', '')

        if not prompt:
            return jsonify({'error': 'Prompt não fornecido'}), 400

        gemma = get_gemma()
        resposta = gemma.generate(prompt)

        return jsonify({
            'prompt': prompt,
            'resposta': resposta,
            'status': 'success'
        })

    except Exception as e:
        return jsonify({
            'error': str(e),
            'status': 'error'
        }), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
```

### Uso em Scripts de Automação

```python
#!/usr/bin/env python3
"""
Script de automação usando Gemma para análise de código
"""

import gemma_native
import os
import sys

def analisar_codigo(arquivo):
    """Analisa um arquivo de código usando Gemma"""

    if not os.path.exists(arquivo):
        return f"Arquivo não encontrado: {arquivo}"

    with open(arquivo, 'r', encoding='utf-8') as f:
        conteudo = f.read()

    prompt = f"""
Analise o seguinte código e forneça:
1. Uma breve descrição do que o código faz
2. Possíveis melhorias ou problemas identificados
3. Sugestões de otimização

Código:
```python
{conteudo}
```

Análise:
"""

    gemma = gemma_native.GemmaNative()
    analise = gemma.generate(prompt)

    return analise

def main():
    if len(sys.argv) != 2:
        print("Uso: python analisar_codigo.py <arquivo>")
        sys.exit(1)

    arquivo = sys.argv[1]
    print(f"Analisando arquivo: {arquivo}")
    print("=" * 60)

    analise = analisar_codigo(arquivo)
    print(analise)

if __name__ == "__main__":
    main()
```

## Configuração e Otimização

### Variáveis de Ambiente

```bash
# Caminho alternativo para modelos
export GEMMA_MODEL_PATH="/caminho/personalizado/modelo.sbs"

# Configurações de performance
export GEMMA_MAX_TOKENS="2048"
export GEMMA_TEMPERATURE="0.7"

# Debug e logging
export GEMMA_DEBUG="1"
export GEMMA_LOG_LEVEL="INFO"
```

### Configuração do Modelo

```python
import os

# Configurações via variáveis de ambiente
os.environ['GEMMA_MODEL_PATH'] = '/opt/fazai/models/gemma/gemma2-2b-it-sfp.sbs'

# Ou diretamente no código (menos recomendado)
gemma = gemma_native.GemmaNative()
# Configurações específicas se suportadas pela API
```

## Tratamento de Erros

### Erros Comuns e Soluções

```python
def uso_seguro_gemma():
    """Exemplo de uso seguro com tratamento de erros"""

    try:
        import gemma_native
    except ImportError:
        print("Erro: Módulo gemma_native não encontrado")
        print("Solução: Execute ./build_gemma_native.sh")
        return False

    try:
        gemma = gemma_native.GemmaNative()

        # Verificar inicialização
        if not gemma.is_initialized():
            print("Aviso: Modelo não inicializado automaticamente")
            # Tentar inicialização manual se disponível
            # gemma.initialize()  # Se método existir

        # Uso com timeout
        import signal

        def timeout_handler(signum, frame):
            raise TimeoutError("Timeout na geração")

        signal.signal(signal.SIGALRM, timeout_handler)
        signal.alarm(30)  # 30 segundos timeout

        try:
            resposta = gemma.generate(prompt)
            signal.alarm(0)  # Cancelar timeout
            return resposta
        except TimeoutError:
            print("Erro: Timeout na geração")
            return None

    except Exception as e:
        print(f"Erro inesperado: {e}")
        return None
```

## Performance e Otimização

### Dicas de Performance

1. **Reutilização de Instâncias**: Crie uma instância global ao invés de criar/destruir repetidamente
2. **Pooling de Conexões**: Para aplicações web, mantenha um pool de instâncias
3. **Cache de Respostas**: Implemente cache para prompts similares
4. **Processamento Assíncrono**: Use threads ou asyncio para processamento paralelo

### Exemplo de Pool de Instâncias

```python
import threading
from queue import Queue

class GemmaPool:
    def __init__(self, size=4):
        self.pool = Queue(maxsize=size)
        self.lock = threading.Lock()

        # Inicializar pool
        for _ in range(size):
            try:
                gemma = gemma_native.GemmaNative()
                self.pool.put(gemma)
            except Exception as e:
                print(f"Erro ao criar instância: {e}")

    def get_instance(self):
        return self.pool.get()

    def return_instance(self, instance):
        self.pool.put(instance)

    def generate(self, prompt):
        gemma = self.get_instance()
        try:
            return gemma.generate(prompt)
        finally:
            self.return_instance(gemma)

# Uso
pool = GemmaPool(size=4)
resposta = pool.generate("Olá mundo!")
```

## Integração com FazAI

### Uso no Worker FazAI

```python
# Exemplo de integração com o worker FazAI
import json
import sys
import os

# Adicionar caminhos do FazAI
sys.path.insert(0, '/opt/fazai/lib')

def processar_mensagem_fazai(mensagem):
    """Processa mensagem no formato FazAI"""

    try:
        # Parse da mensagem ND-JSON
        dados = json.loads(mensagem.strip())

        if dados.get('type') == 'generate':
            session_id = dados.get('session_id')
            prompt = dados.get('prompt')

            # Usar Gemma para gerar resposta
            import gemma_native
            gemma = gemma_native.GemmaNative()
            resposta = gemma.generate(prompt)

            # Formatar resposta no formato FazAI
            resposta_fazai = {
                'type': 'response',
                'session_id': session_id,
                'content': resposta,
                'status': 'success'
            }

            return json.dumps(resposta_fazai) + '\n'

        else:
            return json.dumps({
                'type': 'error',
                'message': 'Tipo de mensagem não suportado'
            }) + '\n'

    except Exception as e:
        return json.dumps({
            'type': 'error',
            'message': str(e)
        }) + '\n'

# Exemplo de uso em loop (simulando worker)
if __name__ == "__main__":
    print("Worker FazAI Gemma iniciado...")

    for linha in sys.stdin:
        resposta = processar_mensagem_fazai(linha)
        sys.stdout.write(resposta)
        sys.stdout.flush()
```

## Testes e Validação

### Script de Teste Básico

```python
#!/usr/bin/env python3
"""
Script de teste para validar funcionamento do gemma_native
"""

import gemma_native
import time

def testar_funcionalidade():
    """Testa funcionalidades básicas"""

    print("=== Teste de Funcionalidade Gemma Native ===")

    # Teste 1: Função global
    print("\n1. Testando função global...")
    try:
        resposta = gemma_native.generate("Oi")
        print(f"✓ Função global: {resposta[:50]}...")
    except Exception as e:
        print(f"✗ Erro na função global: {e}")

    # Teste 2: Classe
    print("\n2. Testando classe...")
    try:
        gemma = gemma_native.GemmaNative()
        resposta = gemma.generate("Olá")
        print(f"✓ Classe: {resposta[:50]}...")
        print(f"✓ Inicializado: {gemma.is_initialized()}")
    except Exception as e:
        print(f"✗ Erro na classe: {e}")

    # Teste 3: Performance
    print("\n3. Testando performance...")
    try:
        gemma = gemma_native.GemmaNative()
        inicio = time.time()
        resposta = gemma.generate("Conte uma história curta")
        fim = time.time()
        print(".2f"        print(f"✓ Comprimento resposta: {len(resposta)} caracteres")
    except Exception as e:
        print(f"✗ Erro no teste de performance: {e}")

    print("\n=== Teste Concluído ===")

if __name__ == "__main__":
    testar_funcionalidade()
```

### Validação de Build

```bash
# Executar testes
python3 test_gemma_native.py

# Verificar se módulo foi compilado
ls -la gemma_native*.so

# Testar importação
python3 -c "import gemma_native; print('Importação OK')"

# Verificar versão
python3 -c "import gemma_native; print(gemma_native.__version__)"
```

## Troubleshooting

### Problemas Comuns

1. **"Módulo não encontrado"**
   ```bash
   # Verificar se arquivo existe
   ls -la gemma_native*.so

   # Verificar PYTHONPATH
   python3 -c "import sys; print(sys.path)"

   # Adicionar ao path
   export PYTHONPATH="/opt/fazai/lib:$PYTHONPATH"
   ```

2. **"Modelo não inicializado"**
   ```bash
   # Verificar se modelo existe
   ls -la /opt/fazai/models/gemma/

   # Baixar modelo se necessário
   huggingface-cli download google/gemma-2b-sfp-cpp --local-dir /opt/fazai/models/gemma/
   ```

3. **Erros de compilação**
   ```bash
   # Limpar e recompilar
   ./build_gemma_native.sh --clean
   ./build_gemma_native.sh

   # Verificar dependências
   pkg-config --libs sentencepiece
   pkg-config --libs highway
   ```

4. **Performance lenta**
   ```bash
   # Usar modelo otimizado
   export GEMMA_MODEL_PATH="/opt/fazai/models/gemma/gemma2-2b-it-sfp.sbs"

   # Verificar uso de CPU/GPU
   top -p $(pgrep -f gemma)
   ```

## Referências e Links

- [Repositório Oficial Gemma.cpp](https://github.com/google/gemma.cpp)
- [Documentação PyBind11](https://pybind11.readthedocs.io/)
- [Modelos Gemma no Hugging Face](https://huggingface.co/google)
- [Documentação FazAI](https://github.com/rluf/fazai)

## Licença

Este manual e a integração FazAI são distribuídos sob licença Creative Commons Attribution 4.0 International (CC BY 4.0).

---

**Autor**: Roger Luft - FazAI Project
**Versão**: 1.0.0
**Última atualização**: 26 de setembro de 2025
