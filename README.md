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

# Processador de Comandos Naturais para LLM

Este projeto converte comandos em linguagem natural para comandos bash usando diferentes provedores de LLM (Ollama, OpenAI, DeepSeek, etc.).

## Arquivos Principais

- `llm_command_structure.json` - Estrutura principal de configuração
- `example_payloads.json` - Exemplos de payloads para diferentes provedores
- `natural_command_processor.py` - Script Python para processar comandos

## Estrutura do JSON

### Configuração Base

```json
{
  "request_config": {
    "model": "llama3.2:latest",
    "max_tokens": 2000,
    "temperature": 0.1,
    "stream": false
  },
  "system_prompt": {
    "role": "system",
    "content": "Prompt que instrui o modelo a retornar apenas comandos bash"
  }
}
```

### Template de Payload

```json
{
  "model": "{{ model_name }}",
  "messages": [
    {
      "role": "system",
      "content": "Instrução para o modelo"
    },
    {
      "role": "user",
      "content": "{{ natural_language_command }}"
    }
  ],
  "max_tokens": 2000,
  "temperature": 0.1
}
```

## Uso com Diferentes Provedores

### Ollama
```bash
curl -X POST http://localhost:11434/api/generate \
  -H "Content-Type: application/json" \
  -d @ollama_payload.json
```

### OpenAI
```bash
curl -X POST https://api.openai.com/v1/chat/completions \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  -H "Content-Type: application/json" \
  -d @openai_payload.json
```

### DeepSeek
```bash
curl -X POST https://api.deepseek.com/v1/chat/completions \
  -H "Authorization: Bearer $DEEPSEEK_API_KEY" \
  -H "Content-Type: application/json" \
  -d @deepseek_payload.json
```

## Exemplos de Comandos Naturais

| Comando Natural | Comando Bash Esperado |
|----------------|----------------------|
| "liste os processos em execução" | `ps aux` |
| "mostre o uso de disco" | `df -h` |
| "verifique conexões de rede" | `netstat -tulpn` |
| "encontre arquivos modificados hoje" | `find . -type f -mtime 0` |

## Script Python

```python
from natural_command_processor import NaturalCommandProcessor

processor = NaturalCommandProcessor()

# Criar payload
payload = processor.create_payload("liste os arquivos", "ollama")

# Enviar comando (requer servidor rodando)
bash_command = processor.send_command("liste os arquivos", "ollama", "http://localhost:11434")
print(f"Comando: {bash_command}")
```

## Configuração do Sistema

O prompt do sistema instrui os modelos a:
- Executar como root no diretório `/etc/fazai`
- Retornar apenas comandos shell sem explicações
- Considerar o ambiente Linux atual
- Não fazer sanitização ou validação

## Resposta Esperada

Os modelos devem retornar apenas o comando bash necessário, por exemplo:
- Input: "liste os processos em execução"
- Output: `ps aux`

## Parâmetros Importantes

- `temperature: 0.1` - Para respostas determinísticas
- `max_tokens: 2000` - Limite de tokens na resposta
- `stream: false` - Para receber resposta completa
