# FazAI - Orquestrador Inteligente de Automação

> **Licença:** Este projeto está licenciado sob a [Creative Commons Attribution 4.0 International (CC BY 4.0)](https://creativecommons.org/licenses/by/4.0/).

FazAI é um sistema de automação inteligente para servidores Linux, que permite executar comandos complexos usando linguagem natural e inteligência artificial.

## Visão Geral

O FazAI é composto por dois componentes principais:

1. **Daemon (Serviço)**: Executa em segundo plano, interpreta comandos, interage com modelos de IA e executa ações no sistema.
2. **CLI (Interface de Linha de Comando)**: Permite que os usuários enviem comandos para o daemon e visualizem os resultados.

O sistema é altamente extensível através de plugins e módulos nativos, permitindo adicionar novas funcionalidades conforme necessário.

## Requisitos

- Node.js 14.x ou superior
- npm 6.x ou superior
- gcc (para compilar módulos nativos)
- Sistema operacional Debian/Ubuntu ou WSL com Debian/Ubuntu

## Instalação

### 1. Clonar o repositório

```bash
git clone https://github.com/RLuf/FazAI.git
cd FazAI
```

### 2. Instalar dependências

```bash
npm install
```

### 3. Compilar módulos nativos

```bash
cd etc/fazai/mods
gcc -shared -fPIC -o system_mod.so system_mod.c
cd ../../..
```

### 4. Configurar o sistema

```bash
# Criar diretórios necessários
sudo mkdir -p /opt/fazai/{bin,lib,tools,mods,conf} /etc/fazai /var/log/fazai /var/lib/fazai/{history,cache,training}

# Copiar arquivos
sudo cp -r etc/fazai/tools/* /opt/fazai/tools/
sudo cp -r etc/fazai/mods/* /opt/fazai/mods/
sudo cp etc/fazai/main.js /opt/fazai/lib/
sudo cp etc/fazai/fazai.conf.example /opt/fazai/conf/fazai.conf.default
sudo cp etc/fazai/fazai.conf.example /etc/fazai/fazai.conf
sudo cp bin/fazai /opt/fazai/bin/
sudo chmod +x /opt/fazai/bin/fazai
sudo ln -sf /opt/fazai/bin/fazai /usr/local/bin/fazai

# Configurar serviço systemd
sudo cp etc/fazai/fazai.service /etc/systemd/system/
sudo systemctl daemon-reload
```

### 5. Iniciar o serviço

```bash
sudo systemctl enable fazai
sudo systemctl start fazai
```

### 6. Desinstalação (opcional)

Se precisar desinstalar o FazAI, use o script de desinstalação:

```bash
sudo ./uninstall.sh
```

Este script oferece opções para preservar suas configurações e dados.

### 7. Reinstalação (opcional)

Para reinstalar ou testar diferentes versões do FazAI:

```bash
sudo ./reinstall.sh
```

Este script permite escolher entre reinstalar a versão atual, uma branch específica ou um commit específico, com opções para preservar suas configurações.

### 8. Instalação Portable (Standalone)

Para sistemas com restrições de rede ou onde a instalação normal falha, use a versão portable:

```bash
# Baixar pacote portable
wget https://github.com/RLuf/FazAI/releases/latest/download/fazai-portable.tar.gz

# Extrair
tar -xzf fazai-portable.tar.gz
cd fazai-portable-*

# Instalar
sudo ./install-portable.sh
```

Esta versão inclui todas as dependências pré-instaladas e módulos nativos pré-compilados, oferecendo:

- **Confiabilidade**: Menos pontos de falha durante a instalação
- **Compatibilidade**: Evita problemas de versões de dependências
- **Offline**: Funciona em ambientes sem acesso à internet
- **Velocidade**: Instalação mais rápida sem downloads de dependências
- **Consistência**: Garante que todos os usuários tenham o mesmo ambiente

Para verificar a autenticidade do pacote portable, use:

```bash
# Verificar checksum
sha256sum -c fazai-portable-v*.tar.gz.sha256
```

## Uso

### Comandos Básicos

```bash
# Exibir ajuda
fazai ajuda

# Exibir informações do sistema
fazai informações do sistema

# Listar processos em execução
fazai mostra os processos em execucao

# Criar um usuário
fazai cria um usuario com nome teste com a senha teste321 no grupo printers

# Instalar pacotes
fazai instale os modulos mod_security do apache

# Alterar configurações do sistema
fazai altere a porta do ssh de 22 para 31052
```

### Comandos Especiais

```bash
# Exibir logs
fazai logs [número de linhas]
  
# Recarregar plugins e módulos
fazai reload

# Exibir versão
fazai versao
fazai version
fazai --version
fazai -v
```

### Comandos Básicos do Sistema

O FazAI agora inclui comandos básicos do sistema que funcionam mesmo sem conexão com a IA:

```bash
# Exibir versão do kernel
fazai kernel

# Exibir informações do sistema
fazai sistema

# Exibir informações de memória
fazai memoria

# Exibir informações de disco
fazai disco

# Listar processos em execução
fazai processos

# Exibir informações de rede
fazai rede

# Exibir data e hora atual
fazai data

# Exibir tempo de atividade do sistema
fazai uptime
```

Estes comandos são executados diretamente no sistema, sem necessidade de interpretação por IA, garantindo funcionamento mesmo quando os serviços de IA estão indisponíveis.

## Estrutura de Diretórios

```
/opt/fazai/           # Código e binários da aplicação
    /bin/             # Executáveis
    /lib/             # Bibliotecas principais (main.js)
    /tools/           # Ferramentas e plugins
    /mods/            # Módulos nativos (.so)
    /conf/            # Arquivos de configuração padrão
        fazai.conf.default

/etc/fazai/           # Configurações do sistema
    fazai.conf        # Arquivo de configuração principal

/var/log/fazai/       # Logs da aplicação
    fazai.log         # Arquivo de log principal

/var/lib/fazai/       # Dados persistentes
    /history/         # Histórico de conversas
    /cache/           # Cache de respostas
    /training/        # Dados para treinamento futuro

/usr/local/bin/fazai  # Link simbólico para o CLI
```

## Configuração Avançada

O FazAI agora suporta um sistema avançado de configuração através do arquivo `fazai.conf`, que permite personalizar o comportamento do sistema, incluindo a escolha de provedores de IA e o sistema de orquestração.

### Arquivo de Configuração

O arquivo de configuração principal está localizado em `/etc/fazai/fazai.conf`. Este arquivo permite configurar:

- **Provedores de IA**: Escolha entre OpenRouter, Requesty ou OpenAI diretamente
- **Sistema de Orquestração**: Configure os modos de planejamento e ação
- **Ferramentas**: Habilite ou desabilite ferramentas específicas
- **Configurações Gerais**: Logging, cache, limites de tokens, etc.

Para criar o arquivo de configuração:

```bash
# Copiar o modelo de configuração
sudo cp /etc/fazai/fazai.conf.example /etc/fazai/fazai.conf

# Editar o arquivo de configuração
sudo nano /etc/fazai/fazai.conf
```

### Sistema de Orquestração

O FazAI agora implementa um sistema de orquestração inspirado em LLMs avançados, com dois modos distintos:

1. **Modo de Planejamento**: Focado em entender o problema, fazer perguntas de esclarecimento e criar um plano detalhado antes de executar qualquer ação.

2. **Modo de Ação**: Focado em executar o plano estabelecido, utilizando as ferramentas disponíveis para realizar tarefas concretas no sistema.

Para alternar entre os modos:

```bash
# Alternar para o modo de planejamento
fazai planejar

# Alternar para o modo de ação
fazai executar
```

### Provedores de IA

O FazAI agora suporta múltiplos provedores de IA:

- **OpenRouter**: Acesse múltiplos modelos de IA através da API do OpenRouter
- **Requesty**: Acesse múltiplos modelos de IA através da API do Requesty (endpoint: https://router.requesty.ai/v1)
- **OpenAI**: Acesse diretamente os modelos da OpenAI

Ao usar o Requesty, os modelos devem ser especificados com o prefixo do provedor, por exemplo:
- `openai/gpt-4o`
- `anthropic/claude-3-opus`
- `google/gemini-pro`

Para configurar os provedores, edite as seções correspondentes no arquivo `fazai.conf`.

## Desenvolvimento

### Criando Plugins

Os plugins são arquivos JavaScript que estendem a funcionalidade do FazAI. Para criar um plugin:

1. Crie um arquivo `.js` no diretório `/etc/fazai/tools/`
2. Implemente a função `processCommand(command)` que recebe um comando e retorna um resultado
3. Exporte as funções e informações do plugin

Exemplo:

```javascript
// /etc/fazai/tools/meu_plugin.js
const pluginInfo = {
  name: 'meu_plugin',
  description: 'Meu plugin personalizado',
  version: '1.0.0',
  author: 'Seu Nome'
};

async function processCommand(command) {
  // Lógica para processar o comando
  return {
    success: true,
    result: 'Resultado do comando',
    type: 'meu_plugin'
  };
}

module.exports = {
  info: pluginInfo,
  processCommand
};
```

### Criando Módulos Nativos

Os módulos nativos são bibliotecas C que fornecem funcionalidades de baixo nível. Para criar um módulo nativo:

1. Crie um arquivo `.c` no diretório `/etc/fazai/mods/`
2. Implemente as funções definidas em `fazai_mod.h`
3. Compile o módulo usando gcc

Exemplo:

```c
// /etc/fazai/mods/meu_modulo.c
#include "fazai_mod.h"
#include <stdio.h>
#include <string.h>

int fazai_mod_init() {
  // Inicialização do módulo
  return 0;
}

int fazai_mod_exec(const char* cmd, char* result, int result_len) {
  // Execução de comandos
  snprintf(result, result_len, "Comando executado: %s", cmd);
  return 0;
}

void fazai_mod_cleanup() {
  // Limpeza do módulo
}
```

Compilação:

```bash
gcc -shared -fPIC -o /etc/fazai/mods/meu_modulo.so /etc/fazai/mods/meu_modulo.c
```

## Segurança

Na versão inicial, o FazAI é executado como root e não implementa mecanismos avançados de segurança. Em ambientes de produção, recomenda-se:

1. Limitar o acesso ao comando `fazai` apenas a usuários autorizados
2. Implementar autenticação para o daemon
3. Configurar regras de firewall para proteger a porta do daemon
4. Auditar regularmente os logs em `/var/log/fazai.log`

## Próximos Passos

- Aumentar nível de segurança
- Aumentar a eficiência utilizando módulos e chamadas a nível de kernel
- Desenvolver um prompt integrado bash style
- Elevar o nível de consciência
- Telemetria unipresente
- Ações altamente proativas
- Treinamento constante

## Licença

Este projeto está licenciado sob a [Creative Commons Attribution 4.0 International (CC BY 4.0)](https://creativecommons.org/licenses/by/4.0/).

## Autor

Roger Luft, Fundador do FazAI
