# 🔐 Configuração Gmail API - Guia Passo a Passo

Este guia detalha como configurar a Gmail API para o FazAI Gmail MCP Server.

## 🚀 Passo 1: Criar Projeto no Google Cloud Console

### 1.1 Acessar Console
- Acesse: https://console.cloud.google.com
- Faça login com sua conta Google

### 1.2 Criar Novo Projeto
```bash
1. Clique em "Select a project" no topo
2. Clique em "New Project"  
3. Nome: "FazAI Gmail MCP Server"
4. Clique em "Create"
```

### 1.3 Selecionar Projeto
- Aguarde criação e selecione o projeto criado

## 📧 Passo 2: Ativar Gmail API

### 2.1 Navegar para APIs
```bash
1. No menu lateral: "APIs & Services" → "Library"
2. Buscar por: "Gmail API"
3. Clicar em "Gmail API"
4. Clicar em "Enable"
```

### 2.2 Verificar Ativação
- Aguarde ativação (pode levar alguns segundos)
- Verifique se aparece "API enabled" ✅

## 🔑 Passo 3: Criar Credenciais OAuth2

### 3.1 Configurar Tela de Consentimento
```bash
1. "APIs & Services" → "OAuth consent screen"
2. User Type: "External" → "Create"
3. Preencher informações obrigatórias:
   - App name: "FazAI Gmail MCP"
   - User support email: seu-email@gmail.com
   - Developer contact: seu-email@gmail.com
4. Clicar em "Save and Continue"
5. Scopes: Clicar "Save and Continue" (usaremos padrão)
6. Test users: Adicione seu email → "Save and Continue"
7. Summary: "Back to Dashboard"
```

### 3.2 Criar Credenciais
```bash
1. "APIs & Services" → "Credentials"
2. "+ Create Credentials" → "OAuth 2.0 Client IDs"
3. Application type: "Desktop application"
4. Name: "FazAI Gmail MCP Client"
5. Clicar em "Create"
```

### 3.3 Baixar Credenciais
```bash
1. Aparecerá popup com Client ID e Client Secret
2. Anote estas informações:
   - Client ID: 1234567890-abcdef.apps.googleusercontent.com
   - Client Secret: GOCSPX-abc123def456
3. Clique em "Download JSON" (opcional)
4. Clique em "OK"
```

## ⚙️ Passo 4: Configurar MCP Server

### 4.1 Editar Arquivo .env
```bash
cd ~/.local/share/fazai-gmail-mcp-server
nano .env
```

### 4.2 Adicionar Credenciais
```env
# Gmail API Configuration
GMAIL_CLIENT_ID=1234567890-abcdef.apps.googleusercontent.com
GMAIL_CLIENT_SECRET=GOCSPX-abc123def456
GMAIL_REDIRECT_URI=http://localhost:3000/oauth/callback

# Manter outras configurações...
FAZAI_PATH=/usr/local/bin/fazai
MCP_PORT=3001
LOG_LEVEL=info
```

### 4.3 Salvar e Fechar
```bash
Ctrl+X → Y → Enter
```

## 🔓 Passo 5: Autenticar Aplicação

### 5.1 Executar Setup de Autenticação
```bash
cd ~/.local/share/fazai-gmail-mcp-server
npm run auth:setup
```

### 5.2 Seguir Fluxo OAuth
```bash
1. Script abrirá URL no navegador
2. Faça login na conta Google
3. Autorize aplicação "FazAI Gmail MCP"
4. Permita acesso ao Gmail (read-only)
5. Volte ao terminal - token será salvo
```

### 5.3 Verificar Token
```bash
# Deve existir arquivo gmail-token.json
ls -la gmail-token.json

# Testar conexão
npm run test:gmail
```

## ✅ Passo 6: Verificar Configuração

### 6.1 Teste Integrado
```bash
# Executar servidor de teste
node dist/server.js --test

# Em outro terminal, testar ferramenta
echo '{"tool":"check_gmail_export_emails","args":{"maxResults":5}}' | node dist/server.js
```

### 6.2 Teste Claude Desktop
```bash
# Reiniciar Claude Desktop
pkill Claude || true
open -a Claude  # macOS
# ou
claude  # Linux com aplicativo

# Testar no Claude:
# "Verifique se chegaram emails com instruções de export"
```

## 🛠 Resolução de Problemas

### Erro: "Client ID inválido"
```bash
# Verificar credenciais no .env
grep GMAIL_CLIENT_ID .env

# Recriar credenciais no Google Cloud Console
# Certificar que tipo é "Desktop application"
```

### Erro: "Scope insuficiente" 
```bash
# Deletar token e re-autenticar
rm gmail-token.json
npm run auth:setup

# Garantir que aceita todas as permissões solicitadas
```

### Erro: "Gmail API não ativada"
```bash
# Verificar no Google Cloud Console:
# APIs & Services → Dashboard
# Gmail API deve aparecer como "Enabled"
```

### Erro: "Quota excedida"
```bash
# Verificar limites no Google Cloud Console:
# APIs & Services → Gmail API → Quotas
# Limite padrão: 1 bilhão de requests/dia
# Mais que suficiente para uso pessoal
```

## 🔒 Considerações de Segurança

### Permissões Mínimas
```bash
# O MCP server solicita apenas:
- gmail.readonly: Ler emails (não modificar)  
- gmail.metadata: Acessar metadados

# NÃO solicitamos:
- gmail.modify: Modificar emails
- gmail.compose: Criar emails
- gmail.send: Enviar emails
```

### Armazenamento Seguro
```bash
# Token armazenado localmente em:
~/.local/share/fazai-gmail-mcp-server/gmail-token.json

# Permissões do arquivo:
chmod 600 gmail-token.json

# Nunca compartilhe este arquivo!
```

### Rotação de Credenciais
```bash
# Re-gerar credenciais a cada 90 dias:
npm run auth:reset
npm run auth:setup

# Ou configurar rotação automática (avançado)
```

## 📊 Monitoramento

### Logs de Autenticação
```bash
# Verificar logs OAuth
tail -f fazai-gmail-mcp.log | grep "auth\|oauth"

# Verificar expiração de token
cat gmail-token.json | jq .expiry_date
```

### Métricas de API
```bash
# Verificar uso no Google Cloud Console:
# APIs & Services → Gmail API → Metrics
# Monitore requests/day e errors
```

## ✨ Finalização

Após completar todos os passos:

1. ✅ Gmail API ativada e configurada
2. ✅ Credenciais OAuth2 criadas  
3. ✅ Token de autenticação salvo
4. ✅ MCP Server configurado
5. ✅ Claude Desktop integrado

**🎉 Pronto! Agora você pode usar:**
- "Verifique meus emails por exports de chat"
- "Baixe o export mais recente disponível"  
- "Liste todos os exports disponíveis"

**📞 Suporte:**
- GitHub Issues: https://github.com/RLuf/fazai-gmail-mcp/issues
- Discord: https://discord.gg/fazai
- Email: support@fazai.dev