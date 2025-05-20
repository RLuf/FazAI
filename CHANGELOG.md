# Changelog
Todas as alterações notáveis neste projeto serão documentadas neste arquivo.

O formato é baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/),
e este projeto adere ao [Versionamento Semântico](https://semver.org/lang/pt-BR/).

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
