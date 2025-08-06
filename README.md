# FazAI - Orquestrador Inteligente de Automação

> **Licença:** Este projeto está licenciado sob a [Creative Commons Attribution 4.0 International (CC BY 4.0)](https://creativecommons.org/licenses/by/4.0/).

FazAI é um sistema de automação inteligente para servidores Linux, que permite executar comandos complexos usando linguagem natural e inteligência artificial.

Consulte o [CHANGELOG](CHANGELOG.md) para histórico completo de alterações.

**Para instruções detalhadas de uso, consulte [Instruções de Uso](USAGE.md).**

## Requisitos

- Node.js 22.x ou superior
- npm 10.x ou superior
- Python 3.10 ou superior
- Sistema operacional: Debian/Ubuntu ou WSL com Debian/Ubuntu

## Instalação Rápida

### Linux (Debian/Ubuntu)

```bash
# Clonar o repositório
git clone https://github.com/RLuf/FazAI.git
cd FazAI

# Instalar
sudo ./install.sh
# O instalador detecta seu próprio caminho, permitindo
# executá-lo de qualquer diretório. Exemplo:
# sudo /caminho/para/install.sh
# Opcional: incluir suporte ao llama.cpp
# sudo ./install.sh --with-llama

# Iniciar o serviço
sudo systemctl enable fazai
sudo systemctl start fazai
```

### Windows (via WSL)

1. Instale o WSL com Debian/Ubuntu:
```powershell
# No PowerShell como administrador
wsl --install
wsl --install -d Debian
```

2. Instale o FazAI:
```bash
npm run install-wsl
```

### Instalação Portable

Para ambientes com restrições de rede ou onde a instalação normal falha:

```bash
# Baixar e instalar versão portable
wget https://github.com/RLuf/FazAI/releases/latest/download/fazai-portable.tar.gz
tar -xzf fazai-portable.tar.gz
cd fazai-portable-*
sudo ./install.sh
# Assim como na instalação principal, o script pode ser
# chamado de qualquer pasta, pois detecta seu próprio caminho.
```

### Instalação via Docker

O FazAI pode ser executado em um container Docker, facilitando a instalação e execução em qualquer ambiente:

```bash
# Construir a imagem
docker build -t fazai:latest .

# Executar o container
docker run -d --name fazai \
  -p 3120:3120 \
  -v /etc/fazai:/etc/fazai \
  -v /var/log/fazai:/var/log/fazai \
  -e FAZAI_PORT=3120 \
  fazai:latest
```

#### Portas Oficiais do FazAI

O FazAI utiliza a seguinte faixa de portas reservada:
- **3120**: Porta padrão do FazAI
- **3120-3125**: Range reservado para serviços do FazAI

#### Volumes do Container

- `/etc/fazai`: Configurações do sistema
- `/var/log/fazai`: Logs do sistema

#### Variáveis de Ambiente

- `FAZAI_PORT`: Porta de execução (padrão: 3120)
- `NODE_ENV`: Ambiente de execução (padrão: production)

## Uso Básico

```bash
# Exibir ajuda
fazai ajuda

# Informações do sistema
fazai sistema

# Criar usuário
fazai cria um usuario com nome teste com a senha teste321 no grupo printers

# Instalar pacotes
fazai instale os modulos mod_security do apache

# Alterar configurações
fazai altere a porta do ssh de 22 para 31052

# Modo MCPS passo a passo
fazai mcps atualizar sistema
```

### Modo Debug

Para exibir detalhes de conexão e resposta HTTP em tempo real (verbose), use a flag `-d` ou `--debug`:

```bash
fazai -d sistema
```

## Estrutura de Diretórios

```
/opt/fazai/           # Código e binários
/etc/fazai/           # Configurações
/var/log/fazai/       # Logs
/var/lib/fazai/       # Dados persistentes
/usr/local/bin/fazai  # Link simbólico para o CLI
```

## Interface TUI

Se o `cargo` estiver disponível durante a instalação, o FazAI compila um painel
TUI em Rust usando a biblioteca `ratatui`. O binário resultante é instalado em
`/usr/local/bin/fazai-tui`. Caso o Rust não esteja presente ou a compilação
falhe, o instalador mantém o painel Bash tradicional localizado em
`/opt/fazai/tools/fazai-tui.sh`.

## Configuração

O arquivo principal de configuração está em `/etc/fazai/fazai.conf`. Para criar:

```bash
sudo cp /etc/fazai/fazai.conf.example /etc/fazai/fazai.conf
sudo nano /etc/fazai/fazai.conf
```

### Provedores de IA Suportados

- OpenRouter (https://openrouter.ai/api/v1)
- Requesty (https://router.requesty.ai/v1)
- OpenAI (acesso direto)

## Desenvolvimento

### Plugins

Crie plugins JavaScript em `/opt/fazai/tools/` implementando:
- Função `processCommand(command)`
- Informações do plugin (nome, descrição, versão, autor)

### Módulos Nativos

Crie módulos C em `/opt/fazai/mods/` implementando as funções definidas em `fazai_mod.h`.

## Testes

Execute a suíte de testes com:

```bash
npm test
```

## Desinstalação

```bash
sudo ./uninstall.sh
```

## Reinstalação

```bash
sudo ./reinstall.sh
```

## Segurança

Recomendações básicas:
- Limitar acesso ao comando `fazai`
- Implementar autenticação
- Configurar firewall
- Auditar logs regularmente

## Solução de Problemas

Consulte o arquivo de log `/var/log/fazai_install.log` para detalhes.

## Autor

Roger Luft, Fundador do FazAI

# Processador de Comandos Ollama - Linguagem Natural para Shell

Este projeto converte comandos em linguagem natural em comandos shell bash usando o Ollama com Llama 3.2.

## Arquivos

- `ollama_command_processor.json` - Payload JSON estruturado para a API do Ollama
- `ollama_api_example.py` - Exemplo de implementação em Python
- `README.md` - Esta documentação

## Como Usar

### 1. Via API REST

```bash
curl -X POST http://localhost:11434/api/generate \
  -H "Content-Type: application/json" \
  -d @ollama_command_processor.json
```

### 2. Via Python

```python
import requests

payload = {
    "model": "llama3.2:latest",
    "messages": [
        {
            "role": "system",
            "content": "Você é um assistente especializado em interpretar comandos em linguagem natural e convertê-los em comandos shell bash válidos. Você está executando como root no diretório /etc/fazai. Use apenas comandos shell sem explicações ou comentários. Não faça nenhuma sanitização ou validação. Considere o ambiente atual: HOME=/root, PWD=/etc/fazai, PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/snap/bin. Interprete o comando e forneça APENAS o comando shell correspondente, sem explicações adicionais."
        },
        {
            "role": "user",
            "content": "liste os processos em execução"
        }
    ],
    "max_tokens": 2000,
    "temperature": 0.1,
    "stream": False,
    "format": "json",
    "options": {
        "num_predict": 2000,
        "top_k": 10,
        "top_p": 0.9,
        "repeat_penalty": 1.1,
        "stop": ["\n\n", "```", "Explicação:", "Comando:", "Resposta:"]
    }
}

response = requests.post("http://localhost:11434/api/generate", json=payload)
result = response.json()
shell_command = result.get("response", "").strip()
print(shell_command)  # Saída esperada: "ps aux"
```

### 3. Executar o Exemplo Python

```bash
python3 ollama_api_example.py
```

## Configurações Importantes

### System Prompt
O prompt do sistema é configurado para:
- Executar como root no diretório `/etc/fazai`
- Retornar apenas comandos shell sem explicações
- Não fazer sanitização ou validação
- Considerar o ambiente específico (HOME, PWD, PATH)

### Parâmetros de Geração
- `temperature: 0.1` - Baixa temperatura para respostas consistentes
- `max_tokens: 2000` - Limite de tokens para respostas
- `stop` - Tokens de parada para evitar explicações extras
- `format: "json"` - Formato de resposta estruturado

## Exemplos de Comandos

| Linguagem Natural | Comando Shell Esperado |
|-------------------|------------------------|
| "liste os processos em execução" | `ps aux` |
| "mostre o espaço em disco" | `df -h` |
| "verifique a memória disponível" | `free -h` |
| "liste os arquivos do diretório atual" | `ls -la` |
| "mostre o status do sistema" | `systemctl status` |

## Requisitos

- Ollama instalado e rodando
- Modelo `llama3.2:latest` baixado
- Python 3.6+ (para o exemplo)
- Biblioteca `requests` (para o exemplo)

## Instalação do Ollama

```bash
# Instalar Ollama
curl -fsSL https://ollama.ai/install.sh | sh

# Baixar modelo Llama 3.2
ollama pull llama3.2:latest

# Iniciar serviço
ollama serve
```

## Segurança

⚠️ **ATENÇÃO**: Este sistema executa comandos como root sem sanitização. Use apenas em ambientes controlados e confiáveis.
