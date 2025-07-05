# Contexto da Sessão: Atualização FazAI v1.40.12
Data: 05/07/2025

## Visão Geral
Este documento resume o contexto e as alterações realizadas na sessão de desenvolvimento do FazAI, versão **1.40.12**.

### Objetivo
- Adicionar modo debug (`-d`/`--debug`) ao CLI para exibir verbose em tempo real.
- Bump de versionamento para 1.40.12 em todos os pontos.
- Atualizar documentação e changelog.
- Explicar o componente `dmon` para supervisão do daemon.

## Modificações Principais
1. **Versão**
   - Atualizada de 1.40.6 para **1.40.12** em:
     - `package.json`
     - CLI (`bin/fazai`)
     - Daemon (`opt/fazai/lib/main.js`)
     - Instalador (`install.sh`)
2. **Flag de Debug no CLI**
   - Nova flag `-d`/`--debug` para ativar o modo verbose.
   - Função `printDebug(message)` implementada (cor magenta).
   - Pontos de debug adicionados em:
     - `sendCommand`: payload e resposta HTTP.
     - `sendCommandMcps`: payload e resposta HTTP.
3. **Documentação**
   - **CHANGELOG.md**: seção [v1.40.12] com detalhes de Added/Changed.
   - **README.md**: seção **Modo Debug** com exemplos de uso.
4. **Instalador (`install.sh`)**
   - Bump da variável `VERSION` para 1.40.12.
   - Logs de debug no mecanismo interno (`log "DEBUG"`).
   - Teste de execução em modo debug validado.
5. **Explicação do `dmon`**
   - Binário supervisor (monitor de daemon) de ~25KB.
   - Reinicializa o daemon Node.js em caso de falha, sem depender de `systemd`.
   - Usado como alternativa em ambientes sem gerenciador de serviços.

## Testes Realizados
- Execução do instalador em modo debug:
  ```bash
  DEBUG_MODE=true bash install.sh --with-llama 2>&1 | sed -n '1,20p'
  ```
- Conferida saída inicial com logs `[INFO]`, `[DEBUG]` e `[SUCESSO]`.

## Arquivos Alterados
- bin/fazai
- opt/fazai/lib/main.js
- package.json
- CHANGELOG.md
- README.md
- install.sh

## Próximos Passos
- Commit e merge das alterações.
- Utilizar este arquivo para futuras consultas ou apresentações.
  Basta abrir `CONTEXT.md` para revisar o histórico.