# Resumo das Movimentações de Arquivos

## Arquivos Movidos

### ✅ Arquivos movidos com sucesso:

1. **sync-changes.sh**
   - **De:** `e:\fazai\sync-changes.sh`
   - **Para:** `e:\fazai\bin\tools\sync-changes.sh`
   - **Status:** ✅ Movido com sucesso

2. **system_mod.so**
   - **De:** `e:\fazai\system_mod.so`
   - **Para:** `e:\fazai\opt\fazai\mods\system_mod.so`
   - **Status:** ✅ Movido com sucesso

3. **fazai-config.js**
   - **De:** `e:\fazai\fazai-config.js`
   - **Para:** `e:\fazai\opt\fazai\tools\fazai-config.js`
   - **Status:** ✅ Movido com sucesso

### ℹ️ Arquivos já nos locais corretos:

4. **github-setup.sh**
   - **Localização:** `e:\fazai\bin\tools\github-setup.sh`
   - **Status:** ✅ Já estava no local correto

## Atualizações no install.sh

### ✅ Funcionalidades adicionadas:

1. **Função `convert_files_to_unix()`**
   - Instala `dos2unix` automaticamente
   - Executa o script `etc/fazai/dos2unixAll.sh` se disponível
   - Converte arquivos `.sh`, `.bash`, `.conf`, `.yml`, `.yaml`, `.json`, `Dockerfile`
   - Método alternativo usando `sed` se `dos2unix` não estiver disponível
   - Adicionada como etapa na instalação

2. **Melhorias na função `copy_files()`**
   - Copia ferramentas do `bin/tools/` para `/opt/fazai/tools/`
   - Copia módulos nativos do `opt/fazai/mods/` para `/opt/fazai/mods/`
   - Copia `fazai-config.js` para `/opt/fazai/tools/`
   - Define permissões executáveis automaticamente

### 🔧 Ordem de execução atualizada:

1. Configurando sistema de logs
2. Verificando permissões
3. Verificando sistema operacional
4. **🆕 Convertendo arquivos para formato Linux** ← Nova etapa
5. Instalando Node.js
6. Verificando npm
7. Instalando ferramentas de compilação
8. Criando estrutura de diretórios
9. Copiando arquivos (com novos arquivos)
10. Importando configurações
11. Configurando serviço systemd
12. Instalando dependências Node.js
13. Compilando módulos nativos
14. Instalando interface TUI
15. Configurando segurança
16. Criando scripts auxiliares
17. Configurando rotação de logs
18. Instalando autocompletar

## Conversão dos2unix

### 📋 Arquivos que serão convertidos:

- Todos os arquivos `.sh` e `.bash`
- Arquivos de configuração `.conf`
- Arquivos YAML (`.yml`, `.yaml`)
- Arquivos JSON (`.json`)
- Dockerfiles

### 🛠️ Métodos de conversão:

1. **Método principal:** Usa `dos2unix` (instalado automaticamente)
2. **Método alternativo:** Usa `sed 's/\r$//'` se `dos2unix` não estiver disponível
3. **Script personalizado:** Executa `etc/fazai/dos2unixAll.sh` se existir

## Dependências Ajustadas

### ✅ O install.sh agora gerencia:

- **Ferramentas do sistema:** `github-setup.sh`, `sync-changes.sh`, `sync-keys.sh`, `system-check.sh`
- **Módulos nativos:** `system_mod.so`
- **Configurações JS:** `fazai-config.js`
- **Conversão de formato:** Automática para todos os arquivos relevantes

## Como usar

1. Execute o script de instalação:
   ```bash
   sudo bash install.sh
   ```

2. O script automaticamente:
   - Converterá todos os arquivos para formato Linux
   - Copiará os arquivos movidos para os locais corretos
   - Configurará permissões adequadas
   - Instalará todas as dependências

## Verificação

Após a instalação, verifique se os arquivos estão nos locais corretos:

```bash
# Verificar ferramentas
ls -la /opt/fazai/tools/

# Verificar módulos
ls -la /opt/fazai/mods/

# Verificar se os scripts são executáveis
file /opt/fazai/tools/*.sh
```

---

**Data da movimentação:** $(date)
**Status:** ✅ Concluído com sucesso