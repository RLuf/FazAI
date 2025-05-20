# FazAI - Orquestrador Inteligente de Automação

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
git clone https://github.com/fazai/fazai.git
cd fazai
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
sudo mkdir -p /etc/fazai/tools /etc/fazai/mods /var/log

# Copiar arquivos
sudo cp -r etc/fazai/* /etc/fazai/
sudo cp bin/fazai /bin/
sudo chmod +x /bin/fazai

# Configurar serviço systemd
sudo cp etc/fazai/fazai.service /etc/systemd/system/
sudo systemctl daemon-reload
```

### 5. Iniciar o serviço

```bash
sudo systemctl enable fazai
sudo systemctl start fazai
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
```

## Estrutura de Diretórios

```
/etc/fazai/
    main.js           # Daemon principal
    /tools/           # Plugins e scripts auxiliares
    /mods/            # Módulos nativos (.so)
    fazai.service     # Arquivo de serviço systemd
/bin/fazai            # CLI (interface de linha de comando)
/var/log/fazai.log    # Arquivo de log
```

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

Este projeto está licenciado sob a licença MIT - veja o arquivo LICENSE para detalhes.

## Autor

Roger Luft, Fundador do FazAI
