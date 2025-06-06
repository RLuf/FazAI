# Changelog

## [v1.3.4] - 05/06/2025

### Added
- Bash completion para todos os comandos do FazAI
- Sistema robusto de checagem de versões de dependências
- Fallback inteligente para instalação de dependências
- Estado de instalação com retomada automática
- Logging detalhado de cada etapa da instalação
- Unificação do fazai-config como subcomando do CLI principal
- Suporte oficial a Docker com imagem pronta para uso
- Definição da faixa de portas oficial do FazAI (3210-3215)

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
- Aprimoramento da ****ção e ****ção de erros
- Expansão dos diretórios criados automaticamente

### Fixed
- Problemas de resiliência na compilação de módulos nativos
- Falhas na importação de chaves de API de múltiplas fontes
- Erros na instalação em **** com versões antigas de Node.js

## [v1.3.2] - 02/06/2025

### Added
- Aprimoramentos no instalador para ****ção de versões e dependências
- Sistema de **** em caso de erros durante a instalação
- Geração de logs detalhados durante o **** de instalação
- Script de sincronização para manter ambientes ****
- Sistema de ****ção de permissões e diretórios

### Changed
- Melhorias na estrutura de diretórios
- ****ção do sistema de logging
- Otimização do **** de instalação

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
- Suporte a múltiplos provedores de IA (OpenRouter, ****, OpenAI)
- Melhoria na detecção de dependências do sistema
- ****ção de disponibilidade dos recursos do sistema

### Changed
- Reestruturação da arquitetura do daemon
- Aprimoramento do sistema de logging
- Otimização da comunicação com APIs externas

## [v1.2.2] - 10/04/2025

### Added
- **** avançados do sistema sem necessidade de IA
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
- Suporte a versão **** (standalone) para ambientes com restrições

### Changed
- Melhoria na estrutura de plugins
- Otimização do uso de memória
- Aprimoramento da interface de linha de comando

## [v1.2.0] - 15/02/2025

### Added
- Modo de instalação standalone para ambientes offline
- Suporte a plugins e módulos nativos
- Integração com **** específicos do sistema
- Mecanismos de ****ção de falhas

### Changed
- Revisão completa do sistema de logging
- Aprimoramento da estrutura de diretórios
- Otimização do processo de instalação

## [v1.1.0] - 10/01/2025

### Added
- Sistema de plugins para extensibilidade
- Suporte a módulos nativos em C
- Mecanismos avançados de logging
- **** básicos do sistema sem IA

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
