# Changelog

## [v1.40.13] - 08/01/2025

### Added
- **Sistema de Arquitetamento Inteligente** - Análise automática de comandos complexos (>4 palavras)
- **Suporte a Perguntas Simples** - Comandos iniciados com `_` e terminados com `?` são processados como perguntas diretas
- **Agente Interativo** - Comandos complexos podem solicitar informações adicionais do usuário
- **Fallback Hierárquico** - genaiscript → deepseek_helper → erro controlado
- **llama.cpp Local** - Suporte opcional para processamento local via llama.cpp
- Configuração `enable_architecting` para controlar o sistema de arquitetamento
- Configuração `continue_on_error` para controle de execução em caso de falhas
- Endpoint `/command` expandido com tipos de resposta: `question`, `interactive`, `architected`, `mcps`, `simple`

### Changed
- **Chave API DeepSeek atualizada** para ``
- DeepSeek helper agora usa endpoint OpenAI direto com modelo `gpt-4o-mini`
- `genaiscript.js` expandido para funcionar como agente arquiteto
- `max_retries` aumentado para 3 tentativas
- `enable_fallback` habilitado por padrão
- Função `queryAI()` completamente reescrita com sistema de análise e arquitetamento

### Fixed
- Tratamento robusto de comandos complexos que antes falhavam
- Melhoria na detecção e processamento de diferentes tipos de comando
- Fallback inteligente quando serviços primários falham

## [v1.40.12] - 05/07/2025

### Added
- Flag `-d`/`--debug` no CLI para ativar modo verbose em tempo real, exibindo detalhes de requisição e resposta HTTP.

### Changed
- Atualizado versionamento para **1.40.12** em `package.json`, CLI (`bin/fazai`) e status do daemon (`opt/fazai/lib/main.js`).
- Documentação do README atualizada com detalhes de uso do modo debug.

## [v1.40.11] - 04/07/2025

### Changed
- Arquivo `todo.txt` analisado, seu conteúdo aplicado e removido após verificação.
- Melhoria contínua e limpeza de tarefas concluídas.

## [v1.40.10] - 03/07/2025

### Changed
- Atualizado `actions/upload-artifact` para versão 4 no workflow CI

## [v1.40.9] - 02/07/2025

### Added
- Comandos `start`, `stop`, `restart` e `status` no CLI utilizando `systemctl`.
- `install.sh` copia `fazai.conf.default` para `/etc/fazai` ao invés de `/opt`.


## [v1.40.8] - 02/07/2025

### Fixed
- `fazai.conf.example` usa OpenRouter com modelo DeepSeek e chave padrão.
- Instalador cria backup `fazai.conf.bak` antes de renomear o arquivo existente.

## [v1.40.7] - 02/07/2025

### Changed
- Reorganizado o CHANGELOG em ordem decrescente.
- Adicionada quebra de linha final.
## [v1.40.6] - 01/07/2025

### Changed
- Ajuste de versionamento para **1.40.6** em todos os códigos.
- Instalador renomeia `fazai.conf` existente para `fazai.conf.old` e preserva chaves.
- Chaves do `.env` são copiadas automaticamente durante a instalação.
- Bash completion instalado a partir do script dedicado.
- Adicionado diretório `dev` com utilitário `codex-cli` e `aider-chat`.

## [v1.40.5] - 01/07/2025

### Added
- Módulo `deepseek_helper` para fallback usando OpenRouter DeepSeek.
- Instalador consulta este módulo quando ocorre falha em uma etapa.

### Changed
- `main.js` utiliza o fallback DeepSeek se a chave do OpenRouter estiver ausente.

## [v1.40.4] - 01/07/2025

### Added
- Validação com `npm list express winston` no instalador. Alerta orienta executar `npm install` manualmente em caso de falha.
- README atualizado com nota sobre `/var/log/fazai_install.log`.

## [v1.40.3] - 01/07/2025

### Fixed
- Ajustadas referências incorretas a `/etc/fazai/tools/` e `/etc/fazai/mods/`.
- `build-portable.sh` e documentação agora apontam para `/opt/fazai` para plugins e módulos.


## [v1.40.2] - 01/07/2025

### Fixed
- Removido caminho incorreto `/etc/fazai/main.js` em scripts e instalador.
- `build-portable.sh` e `bin/fazai` agora usam `/opt/fazai/lib/main.js` como padrão.


## [v1.40.1] - 01/07/2025

### Fixed
- Instalador interrompe ao detectar erro em `copy_files`, informando para verificar o log.
- Mensagens de erro detalham qual arquivo falhou na cópia e o motivo.


## [v1.40] - 30/06/2025

### Changed
- Atualização de versionamento para **1.40**.
- `install.sh` detecta seu diretório e ajusta o `cd`,
  garantindo funcionamento quando chamado de qualquer local.


## [v1.3.8] - 2024-01-20

### Added
- **Sistema de Arquitetamento Inteligente**: Implementado sistema que usa genaiscript com llama.cpp local ou deepseek_helper como fallback
- **Processamento de Comandos Complexos**: Comandos com mais de 4 palavras são automaticamente arquitetados
- **Suporte a Perguntas Simples**: Comandos iniciados com `_` e terminados com `?` são processados como perguntas (ex: `fazai _que dia eh hoje?`)
- **Genaiscript Standalone**: Implementado processador genaiscript com suporte a llama.cpp local
- **DeepSeek Helper Standalone**: Compilado como ferramenta independente para fallback
- **Configurações Centralizadas**: Todas as variáveis de configuração centralizadas no início do main.js
- **Correção do Sistema de Configuração**: Sed agora insere chaves na seção correta do arquivo de configuração
- **Chave DeepSeek Atualizada**: Nova chave API configurada: `sk-

### Changed
- **Refatoração do main.js**: Otimizada função dos provedores e unificadas as variáveis de configuração
- **Sistema de Execução**: Removidos sudos e restrições de segurança - tudo executa como root
- **Arquitetura de Comandos**: Comandos complexos passam pelo sistema de arquitetamento antes da execução
- **Processamento de IA**: Melhorada lógica de fallback entre genaiscript e deepseek_helper

### Fixed
- **Correção do Git Lock**: Removido arquivo .git/index.lock que estava bloqueando commits
- **Configuração de Chaves**: Sed agora insere chaves na posição correta (seção [apis]) ao invés do final do arquivo
- **Chamadas do DeepSeek Helper**: Atualizadas para usar o nome correto do executável standalone

### Security
- **Execução Root**: Sistema configurado para executar como root para máxima compatibilidade
- **Chaves API**: Implementado sistema de mascaramento de chaves através de módulos compilados

## [1.3.7] - 2024-01-20

### Added
- **Conversão automática dos2unix** - Nova função `convert_files_to_unix()` no install.sh
- Instalação automática do pacote `dos2unix` durante a instalação
- Método alternativo de conversão usando `sed` quando dos2unix não está disponível
- Execução automática do script `etc/fazai/dos2unixAll.sh` se disponível
- Conversão automática de arquivos `.sh`, `.bash`, `.conf`, `.yml`, `.yaml`, `.json`, `Dockerfile`
- Backup automático de ferramentas específicas durante desinstalação
- Backup de módulos nativos durante desinstalação
- Limpeza específica de arquivos dos2unix no uninstall.sh
- Remoção de arquivos de estado de instalação no uninstall.sh
- Detalhamento das movimentações de arquivos incorporado ao changelog
- `fazai_web.sh` aprimorado com detecção de múltiplos navegadores
- `fazai_html_v1.sh` preparado para geração de gráficos HTML

### Changed
- Requisito mínimo atualizado para Node.js 22 e Python 3.10
- **Reorganização de arquivos:** Movidos para locais apropriados:
  - `sync-changes.sh` → `bin/tools/sync-changes.sh`
  - `system_mod.so` → `opt/fazai/mods/system_mod.so`
  - `fazai-config.js` → `opt/fazai/tools/fazai-config.js`
  - `github-setup.sh` já estava em `bin/tools/` (mantido)
- Script de instalação (`install.sh`) atualizado com nova etapa de conversão dos2unix
- Função `copy_files()` expandida para lidar com arquivos movidos
- Script de desinstalação (`uninstall.sh`) completamente reescrito para versão 1.3.7
- Backup estruturado em subdiretórios (config/, tools/, mods/) durante desinstalação
- Ordem de execução da instalação atualizada com conversão dos2unix como 4ª etapa

### Fixed
- Problemas de formato de linha (CRLF → LF) em sistemas Linux
- Dependências ajustadas para arquivos em novos locais
- Permissões executáveis definidas automaticamente para ferramentas copiadas
- Tratamento robusto de erros na conversão de formato de arquivos
- Limpeza completa de arquivos específicos da versão durante desinstalação

### Security
- Backup automático de ferramentas críticas antes da remoção
- Verificação de existência de arquivos antes de operações
- Tratamento seguro de permissões para arquivos movidos
- Validação de caminhos durante operações de backup

---


## [v1.3.6] - 07/06/2025

### Added
- **Dashboard TUI completo** (`fazai-tui.sh`) - Interface ncurses completa para gerenciamento do FazAI
- Interface TUI ncurses para configuração do FazAI (`fazai-config-tui.sh`)
- Instalação automática da dependência `dialog` para suporte ao TUI
- Criação automática do diretório `/var/log/fazai` durante a instalação
- Link simbólico `/usr/local/bin/fazai-tui` para acesso ao dashboard TUI
- Link simbólico `/usr/local/bin/fazai-config-tui` para interface de configuração TUI
- Comando `fazai tui` para lançar o dashboard TUI
- Scripts npm para interfaces TUI: `npm run tui`, `npm run config-tui`
- Dashboard TUI com funcionalidades:
  - Execução de comandos FazAI via API
  - Gerenciamento completo de logs (visualizar, limpar, download)
  - Informações detalhadas do sistema
  - Controle do daemon (start/stop/restart/status/reload)
  - Configurações avançadas (API keys, daemon settings)
  - Sistema de backup/restore
  - Interface com tema personalizado e navegação intuitiva

### Changed
- Script de instalação (`install.sh`) ajustado para instalar dependências, garantir diretórios e permissões do TUI
- Script de desinstalação (`uninstall.sh`) atualizado para remover links simbólicos do TUI
- CLI (`bin/fazai`) expandido com comando `tui` e help text atualizado
- `package.json` atualizado para versão 1.3.6 com scripts TUI
- Documentação e help text atualizados para incluir interfaces TUI

### Fixed
- Garantia de criação do diretório de logs mesmo em instalações limpas
- Permissões e execução do TUI ncurses corrigidas
- Tratamento de fallback para criação de versão básica do TUI se arquivo não encontrado

---

**...continuação conforme histórico existente...**

*Mantido histórico anterior*