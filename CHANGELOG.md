# Changelog


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


## [v1.3.8] - 14/06/2025

### Changed
- Porta padrão restaurada para **3120** com range reservado **3120-3125**.
- Documentação e scripts atualizados para refletir a porta correta.


## [v1.3.7] - 13/06/2025

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


## [v1.3.5] - 06/06/2025

### Added
- Interface web completa para gerenciamento do FazAI (`fazai_web_frontend.html`)
- Funcionalidade de limpeza de logs com backup automático
- Novos comandos CLI: `limpar-logs`, `clear-logs`, `web`
- Endpoints REST para gerenciamento de logs:
  - `GET /logs` - Visualizar logs com parâmetro de linhas
  - `POST /logs/clear` - Limpar logs com backup automático
  - `GET /logs/download` - Download do arquivo de log
  - `GET /status` - Verificar status do daemon
- Script `fazai_web.sh` para lançamento da interface web
- Dashboard interativo com painéis para:
  - Execução de comandos FazAI
  - Gerenciamento completo de logs
  - Informações do sistema em tempo real
  - Visualização de dados com gráficos Chart.js
  - Controle do daemon (reload, status, dependências)
  - Configuração de API e monitoramento
- Sistema de backup automático de logs com timestamp
- Monitoramento em tempo real do status do daemon
- Interface responsiva com design moderno e gradientes
- Logs formatados com cores por nível (ERROR, WARN, INFO, DEBUG)
- Documentação completa em `LOGS_MANAGEMENT.md`

### Changed
- Daemon principal (`main.js`) expandido com novos endpoints REST
- CLI (`bin/fazai`) aprimorado com comandos de gerenciamento de logs
- Help text atualizado com novos comandos disponíveis
- Estrutura de comandos básicos expandida para incluir interface web

### Fixed
- Tratamento robusto de erros na manipulação de arquivos de log
- Validação de entrada para parâmetros de visualização de logs
- Verificação de existência de arquivos antes de operações
- Gestão segura de permissões para operações de log

### Security
- Criação automática de backup antes da limpeza de logs
- Validação de parâmetros de entrada em todos os endpoints
- Tratamento seguro de arquivos com verificação de existência
- Logs de auditoria para todas as operações de gerenciamento


## [v1.3.4] - 05/06/2025

### Added
- Bash completion para todos os comandos do FazAI
- Sistema robusto de checagem de versões de dependências
- Fallback inteligente para instalação de dependências
- Estado de instalação com retomada automática
- Logging detalhado de cada etapa da instalação
- Unificação do fazai-config como subcomando do CLI principal
- Suporte oficial a Docker com imagem pronta para uso
- Definição da faixa de portas oficial do FazAI (3120-3125)

### Changed
- Refatoração do install.sh para maior robustez e modularidade
- Melhoria no gerenciamento de dependências com múltiplas fontes
- Interface de configuração movida para 'fazai config'
- Estrutura de comandos mais intuitiva e padronizada

### Fixed
- Problemas de resiliência na instalação de dependências
- Inconsistências no gerenciamento de comandos CLI
- Melhor tratamento de erros durante a instalação


## [v1.3.3] - 05/06/2025

### Added
- Instalação integrada da interface TUI de configuração
- Função execute_with_retry para operações críticas
- Suporte a múltiplas fontes para instalação de Node.js
- Detecção e importação aprimorada de configurações .env
- Validação dupla do serviço após instalação
- Suporte a instalação e execução no Windows via WSL
- Scripts npm para instalação e testes via WSL
- Verificação automática de ambiente WSL no install.sh

### Changed
- Consolidação de todos os scripts de instalação em um único arquivo
- Estrutura modular e organizada do script de instalação
- Aprimoramento da detecção e correção de erros
- Expansão dos diretórios criados automaticamente

### Fixed
- Problemas de resiliência na compilação de módulos nativos
- Falhas na importação de chaves de API de múltiplas fontes
- Erros na instalação em sistemas com versões antigas de Node.js


## [v1.3.2] - 02/06/2025

### Added
- Aprimoramentos no instalador para detecção de versões e dependências
- Sistema de retry em caso de erros durante a instalação
- Geração de logs detalhados durante o processo de instalação
- Script de sincronização para manter ambientes atualizados
- Sistema de verificação de permissões e diretórios

### Changed
- Melhorias na estrutura de diretórios
- Otimização do sistema de logging
- Otimização do processo de instalação


## [v1.3.1] - 25/05/2025

### Added
- Interface TUI básica para configuração do sistema
- Importação automática de chaves do arquivo .env
- Suporte a diferentes versões do Node.js (16, 18, 20)
- Script de diagnóstico de sistema (system-check.sh)

### Changed
- Melhorias no arquivo de serviço systemd
- Redirecionamento aprimorado de logs
- Ajustes na estrutura de diretórios Linux

### Fixed
- Problemas de permissão durante a instalação
- Erros na coleta de logs do sistema
- Problemas com a compilação de módulos nativos em alguns sistemas


## [v1.3.0] - 15/05/2025

### Added
- Sistema de orquestração com modos de planejamento e ação
- Suporte a múltiplos provedores de IA (OpenRouter, Anthropic, OpenAI)
- Melhoria na detecção de dependências do sistema
- Verificação de disponibilidade dos recursos do sistema

### Changed
- Reestruturação da arquitetura do daemon
- Aprimoramento do sistema de logging
- Otimização da comunicação com APIs externas


## [v1.2.2] - 10/04/2025

### Added
- Comandos avançados do sistema sem necessidade de IA
- Suporte a execução em ambiente offline
- Script de reinstalação com preservação de configurações

### Fixed
- Problemas de estabilidade em sistemas com poucos recursos
- Erros de comunicação com APIs externas
- Falhas na compilação de módulos nativos


## [v1.2.1] - 25/03/2025

### Added
- Script de desinstalação com opções de preservação de dados
- Sistema de backup automático de configurações
- Suporte a versão portable (standalone) para ambientes com restrições

### Changed
- Melhoria na estrutura de plugins
- Otimização do uso de memória
- Aprimoramento da interface de linha de comando


## [v1.2.0] - 15/02/2025

### Added
- Modo de instalação standalone para ambientes offline
- Suporte a plugins e módulos nativos
- Integração com recursos específicos do sistema
- Mecanismos de recuperação de falhas

### Changed
- Revisão completa do sistema de logging
- Aprimoramento da estrutura de diretórios
- Otimização do processo de instalação


## [v1.1.0] - 10/01/2025

### Added
- Sistema de plugins para extensibilidade
- Suporte a módulos nativos em C
- Mecanismos avançados de logging
- Comandos básicos do sistema sem IA

### Changed
- Melhoria no CLI com mais opções e documentação
- Estrutura de arquivos organizada seguindo padrões Linux
- Otimização de performance na comunicação com IA


## [v1.0.0] - 01/12/2024

### Added
- Lançamento inicial do FazAI
- Daemon para execução em segundo plano
- CLI para interação com o serviço
- Integração com APIs de IA
- Sistema básico de instalação
- Serviço systemd para gerenciamento
- Configuração básica via arquivo fazai.conf
- Logs básicos do sistema
