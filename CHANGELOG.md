# Changelog
Todas as alterações notáveis neste projeto serão documentadas neste arquivo.

O formato é baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/),
e este projeto adere ao [Versionamento Semântico](https://semver.org/lang/pt-BR/).

## [1.2.0] - 2025-05-22
### Adicionado
- Novo script `uninstall.sh` para desinstalação completa do sistema
- Novo script `reinstall.sh` para reinstalação e testes de diferentes versões
- Suporte para preservação de configurações durante a desinstalação
- Backup automático de configurações durante a reinstalação
- Opções para reinstalar a partir de branches ou commits específicos

### Alterado
- Melhorado o processo de instalação para lidar com instalações existentes
- Aprimorada a documentação sobre desinstalação e reinstalação

### Corrigido
- Problemas com resíduos de arquivos após desinstalação manual

## [1.1.0] - 2025-05-21
### Adicionado
- Novo arquivo de configuração `fazai.conf` para personalização avançada do sistema
- Suporte para múltiplos provedores de IA: OpenRouter, Requesty e OpenAI
- Sistema de orquestração com modos de planejamento e ação
- Novas opções de configuração para ferramentas, cache e limites de contexto
- Documentação detalhada sobre o novo sistema de configuração

### Alterado
- Melhorado o sistema de fallback para modelos de IA
- Aprimorada a documentação com exemplos de configuração
- Otimizado o gerenciamento de contexto para conversas longas

### Corrigido
- Problemas de timeout em chamadas de API
- Tratamento de erros em comandos complexos

## [1.0.1] - 2025-05-20
### Corrigido
- Adicionada verificação robusta de dependências no install.sh
- Adicionada saída verbose para o processo de instalação npm
- Corrigido problema de instalação de módulos Node.js
- Melhorada a manipulação de erros e mensagens de solução de problemas
- Adicionada verificação de versão mínima do Node.js (>=14.0.0)
- Adicionada instalação de dependências no diretório /etc/fazai
- Adicionada verificação de CLI após instalação

## [1.0.0] - 2025-05-01
### Adicionado
- Versão inicial do FazAI
- Funcionalidades básicas de automação
- Interface de linha de comando
- Serviço systemd para execução em segundo plano
- Módulos nativos para integração com o sistema
