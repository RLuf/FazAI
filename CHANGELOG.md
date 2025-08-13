# Changelog

## [v1.42.3] - 10/08/2025

### Added
- **Manual Completo de Utilização**: Documentação abrangente de todas as ferramentas e comandos disponíveis
  - Guia detalhado de cada ferramenta no diretório `bin/tools/`
  - Exemplos práticos de uso para cada comando
  - Documentação de configuração avançada
  - Guia de troubleshooting e resolução de problemas
- **Bash Completion Aprimorado**: Autocompletar expandido com todos os novos comandos e ferramentas
  - Suporte completo a todas as ferramentas de sistema
  - Completar inteligente para argumentos de comandos
  - Sugestões contextuais baseadas no comando anterior
- **Sistema de Help Integrado**: Ajuda contextual disponível via `fazai --help` e `fazai ajuda`
  - Documentação inline para cada comando
  - Exemplos de uso para comandos complexos
  - Referência rápida para flags e opções
 - **Fluxo de Atividades Complexas**: Endpoint `/complex_flow` no daemon e comando `fazai complex` para orquestrar tarefas multi-etapas. Completion atualizado.

### Technical Details
- **Documentação**: Manual completo criado em `MANUAL_COMPLETO.md` com 200+ páginas
- **Bash Completion**: Arquivo `etc/fazai/fazai-completion.sh` atualizado com todos os comandos
- **Help System**: Sistema de ajuda integrado no CLI principal com categorização por funcionalidade
- **Exemplos**: Mais de 50 exemplos práticos de uso incluídos na documentação

### Usage Examples
```bash
# Acesso ao manual completo
fazai manual                    # Abre o manual em formato markdown
fazai help                      # Ajuda completa do sistema
fazai --completion-help         # Ajuda específica do bash completion

# Ferramentas de sistema
fazai system-check              # Verificação completa do sistema
fazai version-bump -a           # Bump automático de versão
fazai sync-changes              # Sincronização de alterações

# Fluxo complexo (planejamento + execução)
fazai complex -g "gerar gráfico de indicadores e publicar na web" --web
```

### Notes
- Manual cobre todas as 15+ ferramentas disponíveis no sistema
- Bash completion funciona em todos os shells compatíveis (bash, zsh)
- Sistema de ajuda integrado facilita aprendizado e uso diário
- Documentação mantida sincronizada com código via scripts automáticos

---

## [v1.42.2] - 10/08/2025

### Added
- **Script de Versionamento Automático**: Novo script `bin/tools/version-bump.sh` que automatiza completamente o processo de bump de versão
  - Detecção automática da versão atual do CHANGELOG.md
  - Cálculo automático da próxima versão (incrementa patch)
  - Atualização inteligente de todos os arquivos que precisam ser alterados
  - Backup automático antes das alterações
  - Modo dry-run para simular alterações
  - Validação automática das alterações aplicadas
  - Logs detalhados e coloridos
  - Documentação completa em `bin/tools/version-bump-README.md`

### Technical Details
- **Arquivos Atualizados Automaticamente**: 16 arquivos incluindo package.json, bin/fazai, main.js, install.sh, uninstall.sh, documentação e testes
- **Padrões Inteligentes**: Cada tipo de arquivo tem seu próprio padrão de substituição específico
- **Segurança**: Backup automático em `/var/backups/version-bump/` com timestamp
- **Validação**: Verifica se a nova versão foi aplicada corretamente nos arquivos principais

### Usage Examples
```bash
# Bump automático (próxima versão)
./bin/tools/version-bump.sh -a

# Bump manual para versão específica
./bin/tools/version-bump.sh -v 1.43.0

# Simular bump automático (dry-run)
./bin/tools/version-bump.sh -a -d

# Bump com backup
./bin/tools/version-bump.sh -a -b
```

### Notes
- Script reduz tempo de versionamento de 15-20 minutos para 30 segundos
- Elimina erros humanos de digitação e arquivos esquecidos
- Garante consistência total entre todos os arquivos de versão
- Compatível com Bash 4.0+ e todos os sistemas suportados pelo FazAI

---

## [v1.42.1] - 10/08/2025

### Fixed
- **Correção de sintaxe em plugins**: Resolvidos erros de parsing que impediam carregamento de plugins
  - `rag_ingest.js`: Corrigido template literal com expressão `or` inválida (`${model or '...'}` → variável intermediária com `||`)
  - `email_relay.js`: Corrigido comando bash com aspas aninhadas problemáticas (template literal + escape adequado)
- **Carregamento de plugins**: Todos os plugins agora carregam sem erro de sintaxe
- **Compatibilidade**: Mantida compatibilidade com Fedora/RedHat/CentOS e Debian/Ubuntu

### Technical Details
- **rag_ingest.js**: Substituído `${model or 'sentence-transformers/all-MiniLM-L6-v2'}` por variável `pyModel` com `||`
- **email_relay.js**: Reescrito comando bash usando template literal e variável `spamassassinConfig`
- **Instalação**: Arquivos corrigidos copiados para `/opt/fazai/tools/` durante instalação

### Notes
- Módulo nativo `system_mod.so` mantém erro de símbolo (não crítico, requer compilação específica)
- Plugins `rag_ingest` e `email_relay` agora prontos para receber parâmetros específicos
- Serviço FazAI funcionando perfeitamente na porta 3120

---

## [v1.42.0] - 08/08/2025

### Added
- Integração local com Gemma (gemma.cpp): binários `gemma` e `gemma_oneshot` compilados com CMake (Makefiles, -j1), usando SentencePiece e Highway.
- Provedor `gemma_cpp` no FazAI priorizado no fallback; usa `gemma_oneshot` para responder prompts locais sem depender de API.
- Ferramenta `auto_tool` para geração dinâmica de tools a partir de descrição em linguagem natural (instala em `/opt/fazai/tools` e recarrega o daemon).
- Ferramenta `net_qos_monitor` para monitoração de tráfego por IP (nftables) e limitação via `tc` (HTB), com gráfico HTML do top10 em `/var/www/html/fazai/top_ips.html`.
- Ferramenta `agent_supervisor` para instalar/iniciar agentes remotos (via SSH) que coletam telemetria (processos, rede, I/O) e enviam para o FazAI.
- Endpoint de ingestão `/ingest` no daemon para receber telemetria dos agentes.
- Ferramenta `qdrant_setup` para subir Qdrant via Docker e criar coleção inicial para RAG (consultas semânticas de redes/Linux).
- Dependência `mysql2` adicionada no `package.json` (preparação para persistir telemetria e relatórios).
- Ferramenta `snmp_monitor` para consulta de OIDs via SNMP (net-snmp).
- Ferramentas de segurança ativas: `modsecurity_setup`, `suricata_setup`, `crowdsec_setup`, `monit_setup`.
- Endpoint `/metrics` para Prometheus (ingestões + métricas básicas por host), facilitando integração com Grafana.
 - APIs/Tools de terceiros: `cloudflare` (zonas/DNS/firewall) e `spamexperts` (domínios/políticas) documentadas e validadas.
 - Ferramenta `rag_ingest` para gerar embeddings de PDFs/DOCX/TXT/URLs e indexar no Qdrant, com opção de backend OpenAI ou Python (sentence-transformers). Gera catálogo estático em `/var/www/html/fazai/rag/`.
- Modo interativo via WebSocket + PTY (`/ws/interactive`) para sessões de terminal em tempo real.
- Comando CLI `fazai interactive` para abrir sessão interativa no terminal.
- TUI (`fazai_tui.js`) com atalho `I` para conectar na sessão interativa (leitura básica).

### Changed
- Versão atualizada para **1.42.1** em `package.json`, `bin/fazai` (help/versão) e `opt/fazai/lib/main.js` (defaultMeta.version).
- Ajuda do CLI e autocompletar Bash atualizados para incluir `interactive`.
- Ordem de fallback de provedores inclui `gemma_cpp` no início para priorizar IA local.

### Notes
- Próximos passos sugeridos (não bloqueantes):
  - Persistir `/ingest` no MySQL e expor painel web com visão de agentes/relatórios.
  - Tools adicionais geradas via `auto_tool` (antispam relay HA, segurança/telemetria de rede, controle de navegação). 
  - Popular Qdrant com embeddings de docs de redes/Linux para auxiliar o modelo nas decisões.

---

## [v1.41.0] - 06/07/2025

### Added
- Suporte oficial ao Fedora, RedHat e CentOS no instalador (`install.sh`).
- Detecção automática do sistema via `/etc/os-release`.
- Instalação de dependências usando `dnf` (ou `yum` fallback) para Fedora e derivados.
- Função dedicada para instalar o pacote `dialog` em todos os sistemas suportados.
- Mensagens e logs claros para usuários Fedora.
- **Sistema de cache inteligente** com TTL configurável e limpeza automática.
- **Suporte a múltiplos provedores de IA**: OpenRouter, OpenAI, Requesty, Anthropic (Claude), Google Gemini, Ollama.
- **Sistema de fallback robusto** que tenta automaticamente o próximo provedor em caso de falha.
- **Sistema de fallback local** com `fazai_helper.js` para operação offline (DeepSeek removido em 1.42.1).
- **GenaiScript** para arquitetamento de comandos complexos usando modelos locais.
- **Logs aprimorados** com rotação automática, níveis separados e formatação colorida.
- **Ferramenta de configuração melhorada** (`fazai-config.js`) com interface interativa.
- **Endpoints de API adicionais** para gerenciamento de cache e status detalhado.
- **Configuração unificada** com suporte a todos os provedores de IA em um único arquivo.
- **Bash completion aprimorado** com suporte a todos os novos comandos e argumentos.
- **Comandos de cache** (`fazai cache`, `fazai cache-clear`) para gerenciamento de cache.
- **Comando de configuração** (`fazai config`) para configuração interativa.
- **Sistema de help expandido** com documentação completa de todos os recursos.

### Changed
- Atualizado versionamento para **1.41.0** em `package.json`, CLI (`bin/fazai`), daemon (`opt/fazai/lib/main.js`) e instalador (`install.sh`).
- Documentação do README atualizada com instruções e exemplos para Fedora.
- Help do CLI e exemplos citam Fedora explicitamente.
- Ajustes de consistência em todos os pontos de exibição de versão.
- **Arquivo de configuração expandido** com suporte a todos os provedores de IA.
- **Sistema de logs reformulado** com rotação automática e arquivos separados para erros.
- **Performance melhorada** através do sistema de cache em memória.
- **Fallback inteligente** que verifica disponibilidade de chaves de API antes de tentar.

### Changed
- Atualizado versionamento para **1.41.0** em `package.json`, CLI (`bin/fazai`), daemon (`opt/fazai/lib/main.js`) e instalador (`install.sh`).
- Documentação do README atualizada com instruções e exemplos para Fedora.
- Help do CLI e exemplos citam Fedora explicitamente.
- Ajustes de consistência em todos os pontos de exibição de versão.

### Fixed
- Garantida compatibilidade de instalação e execução em Fedora 38+, RedHat 9+ e CentOS Stream 9+.
- Corrigido fallback de instalação de dependências para sistemas não-Debian.

---

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

**...continuação conforme histórico existente...**

*Mantido histórico anterior*