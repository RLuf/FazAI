# FazAI - Script de Versionamento Automático

## 🚀 Visão Geral

O script `version-bump.sh` automatiza completamente o processo de atualização de versão do FazAI, detectando automaticamente todos os arquivos que precisam ser alterados e aplicando as mudanças de forma inteligente e segura.

## ✨ Funcionalidades

### 🔍 Detecção Automática
- **Versão Atual**: Lê automaticamente a versão atual do `CHANGELOG.md`
- **Próxima Versão**: Calcula automaticamente a próxima versão (incrementa patch)
- **Arquivos**: Detecta todos os arquivos que precisam ser atualizados

### 🛡️ Segurança
- **Backup Automático**: Cria backup antes das alterações
- **Validação**: Verifica se as alterações foram aplicadas corretamente
- **Dry-Run**: Simula alterações sem aplicar (para teste)

### 🎯 Inteligência
- **Padrões Específicos**: Cada tipo de arquivo tem seu próprio padrão de substituição
- **Detecção de Mudanças**: Só altera arquivos que realmente precisam ser alterados
- **Logs Detalhados**: Mostra exatamente o que está sendo feito

## 📋 Arquivos Atualizados Automaticamente

O script atualiza automaticamente os seguintes arquivos:

### Arquivos Principais
- `package.json` - Versão do npm
- `bin/fazai` - CLI principal
- `opt/fazai/lib/main.js` - Daemon principal
- `install.sh` - Script de instalação
- `uninstall.sh` - Script de desinstalação

### Documentação
- `README.md` - Documentação principal
- `USAGE.md` - Guia de uso
- `TODO.md` - Roadmap
- `IMPROVEMENTS_v1.41.0.md` - Melhorias
- `CHANGELOG.md` - Histórico de versões

### Testes e Configuração
- `tests/version.test.sh` - Teste de versão
- `tests/test-improvements.sh` - Teste de melhorias
- `etc/fazai/fazai-completion.sh` - Bash completion
- `etc/fazai/fazai.conf.example` - Configuração exemplo
- `opt/fazai/tools/fazai-config.js` - Ferramenta de configuração

### Outros
- `a` - Arquivo de log de instalação

## 🎮 Como Usar

### Comandos Básicos

```bash
# Bump automático (próxima versão)
./bin/tools/version-bump.sh -a

# Bump manual para versão específica
./bin/tools/version-bump.sh -v 1.42.2

# Simular bump automático (dry-run)
./bin/tools/version-bump.sh -a -d

# Bump com backup
./bin/tools/version-bump.sh -a -b

# Ver ajuda
./bin/tools/version-bump.sh -h
```

### Exemplos Práticos

```bash
# Cenário 1: Correção de bug (patch)
./bin/tools/version-bump.sh -a
# Resultado: 1.42.1 → 1.42.2

# Cenário 2: Nova funcionalidade (minor)
./bin/tools/version-bump.sh -v 1.43.0
# Resultado: 1.42.1 → 1.43.0

# Cenário 3: Mudança breaking (major)
./bin/tools/version-bump.sh -v 2.0.0
# Resultado: 1.42.1 → 2.0.0

# Cenário 4: Teste antes de aplicar
./bin/tools/version-bump.sh -a -d -b
# Simula alterações, cria backup, mostra diferenças
```

## 🔧 Opções Disponíveis

| Opção | Descrição | Exemplo |
|-------|-----------|---------|
| `-v, --version VERSION` | Versão específica | `-v 1.42.2` |
| `-a, --auto` | Detecção automática | `-a` |
| `-d, --dry-run` | Simular sem aplicar | `-d` |
| `-b, --backup` | Criar backup | `-b` |
| `-h, --help` | Exibir ajuda | `-h` |

## 📊 Padrões de Substituição

### package.json
```json
"version": "1.42.1" → "version": "1.42.2"
```

### main.js
```javascript
version: '1.42.1' → version: '1.42.2'
* Versão: 1.42.1 → * Versão: 1.42.2
```

### install.sh / uninstall.sh
```bash
VERSION="1.42.1" → VERSION="1.42.2"
FazAI v1.42.1 → FazAI v1.42.2
```

### bin/fazai
```javascript
FazAI - Orquestrador Inteligente de Automação v1.42.1 → v1.42.2
```

### CHANGELOG.md
Adiciona nova seção no topo:
```markdown
## [v1.42.2] - 10/08/2025

### Added
- [Adicione novas funcionalidades aqui]

### Changed
- [Adicione mudanças aqui]

### Fixed
- [Adicione correções aqui]

### Notes
- [Adicione notas aqui]

---
```

## 🛡️ Backup e Segurança

### Localização do Backup
```
/var/backups/version-bump/version-bump-backup-YYYYMMDD_HHMMSS.tar.gz
```

### Conteúdo do Backup
- Todos os arquivos que serão alterados
- Timestamp no nome do arquivo
- Formato tar.gz para compressão

### Restauração
```bash
# Extrair backup
tar -xzf /var/backups/version-bump/version-bump-backup-YYYYMMDD_HHMMSS.tar.gz

# Restaurar arquivos específicos
tar -xzf backup.tar.gz package.json bin/fazai
```

## ✅ Validação

O script valida automaticamente se as alterações foram aplicadas corretamente:

### Arquivos Validados
- `package.json`
- `bin/fazai`
- `opt/fazai/lib/main.js`
- `install.sh`

### Critério de Validação
- Verifica se a nova versão está presente em cada arquivo
- Reporta erros se algum arquivo não foi atualizado
- Mostra resumo final do processo

## 🐛 Troubleshooting

### Problema: "CHANGELOG.md não encontrado"
**Solução**: Execute o script do diretório raiz do projeto
```bash
cd /caminho/para/fazai
./bin/tools/version-bump.sh -a
```

### Problema: "Formato de versão inválido"
**Solução**: Use o formato correto MAJOR.MINOR.PATCH
```bash
./bin/tools/version-bump.sh -v 1.42.2  # ✓ Correto
./bin/tools/version-bump.sh -v 1.42    # ✗ Incorreto
```

### Problema: "A versão já é X.Y.Z"
**Solução**: A versão já está atualizada, nenhuma ação necessária

### Problema: "Arquivo não encontrado"
**Solução**: O script continua funcionando, apenas ignora arquivos ausentes

## 🔄 Fluxo de Trabalho Recomendado

### 1. Desenvolvimento
```bash
# Fazer alterações no código
git add .
git commit -m "Nova funcionalidade"
```

### 2. Versionamento
```bash
# Bump automático com backup
./bin/tools/version-bump.sh -a -b

# Verificar alterações
git diff
```

### 3. Commit e Push
```bash
# Commitar alterações de versão
git add .
git commit -m "Bump version to 1.42.2"

# Push para repositório
git push origin main
```

### 4. Release
```bash
# Criar tag
git tag v1.42.2
git push origin v1.42.2
```

## 🎯 Vantagens

### ⚡ Velocidade
- **Antes**: 15-20 minutos de trabalho manual
- **Depois**: 30 segundos de execução

### 🛡️ Segurança
- **Antes**: Risco de esquecer arquivos
- **Depois**: Garantia de atualização completa

### 🎯 Precisão
- **Antes**: Erros humanos de digitação
- **Depois**: Substituição automática e precisa

### 📝 Rastreabilidade
- **Antes**: Difícil de rastrear mudanças
- **Depois**: Logs detalhados e backup automático

## 🤝 Contribuição

Para melhorar o script:

1. **Adicionar novos arquivos**: Edite a lista `files_to_update` no script
2. **Novos padrões**: Adicione casos específicos na função `update_file`
3. **Testes**: Use sempre `-d` antes de aplicar alterações
4. **Documentação**: Atualize este README conforme necessário

## 📞 Suporte

- **Issues**: Reporte bugs no GitHub
- **Documentação**: Este arquivo e `--help`
- **Logs**: O script mostra logs detalhados durante execução

---

**Autor**: Roger Luft  
**Versão do Script**: 1.0  
**Compatibilidade**: Bash 4.0+  
**Licença**: Creative Commons Attribution 4.0 International (CC BY 4.0) 