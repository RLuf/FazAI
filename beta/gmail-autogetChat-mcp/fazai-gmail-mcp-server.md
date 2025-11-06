# FazAI Gmail MCP Server

## 📋 Visão Geral

Este projeto cria um **MCP Server (Model Context Protocol)** integrado que combina:
- **Verificação automática do Gmail** para detectar emails com instruções de export de chats
- **Download automático** de exports solicitados
- **Integração completa com FazAI** para administração Linux inteligente
- **Interface streaming/endpoint** para interação via Claude Desktop

## 🚀 Instalação e Configuração

### Pré-requisitos

```bash
# Node.js 18+ e npm
node --version
npm --version

# FazAI instalado e configurado
fazai --version

# Claude Desktop instalado
# Baixar de: https://claude.ai/desktop
```

### 1. Instalação Automática

```bash
# Clone e instale com um comando
curl -fsSL https://raw.githubusercontent.com/seu-usuario/fazai-gmail-mcp/main/install.sh | bash
```

### 2. Instalação Manual

```bash
# Clone o repositório
git clone https://github.com/seu-usuario/fazai-gmail-mcp-server.git
cd fazai-gmail-mcp-server

# Instalar dependências
npm install

# Build do projeto
npm run build

# Configurar variáveis de ambiente
cp .env.example .env
# Editar .env com suas credenciais
```

### 3. Configuração do Gmail API

1. **Criar projeto no Google Cloud Console**
   - Acesse: https://console.cloud.google.com
   - Crie um novo projeto ou selecione existente
   - Ative a Gmail API

2. **Criar credenciais OAuth2**
   ```bash
   # No Google Cloud Console:
   # APIs & Services > Credentials > Create Credentials > OAuth 2.0 Client IDs
   # Application type: Desktop application
   ```

3. **Configurar arquivo .env**
   ```bash
   GMAIL_CLIENT_ID=seu-client-id-aqui
   GMAIL_CLIENT_SECRET=seu-client-secret-aqui
   GMAIL_REDIRECT_URI=http://localhost:3000/oauth/callback
   FAZAI_PATH=/usr/local/bin/fazai
   MCP_PORT=3001
   LOG_LEVEL=info
   ```

### 4. Configuração do Claude Desktop

**Localização do arquivo de configuração:**
- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
- **Linux**: `~/.config/Claude/claude_desktop_config.json`

**Configuração:**
```json
{
  "mcpServers": {
    "fazai-gmail-mcp": {
      "command": "node",
      "args": ["caminho/para/fazai-gmail-mcp-server/dist/server.js"],
      "env": {
        "GMAIL_CLIENT_ID": "seu-client-id",
        "GMAIL_CLIENT_SECRET": "seu-client-secret", 
        "FAZAI_PATH": "/usr/local/bin/fazai",
        "MCP_PORT": "3001"
      }
    }
  }
}
```

## 🔧 Funcionalidades Principais

### 1. Verificação Automática de Gmail

```typescript
// Verifica emails com instruções de export
const emails = await checkGmailExportEmails({
  query: "export conversation chat download",
  maxResults: 10
});
```

### 2. Download Automático de Exports

```typescript
// Baixa exports automaticamente
const downloadResult = await downloadChatExport({
  exportUrl: "https://takeout.google.com/...",
  destinationPath: "./downloads/"
});
```

### 3. Integração FazAI

```typescript
// Executa comandos via FazAI
const result = await fazaiExecute({
  command: "instalar nginx como proxy reverso para porta 3000",
  dryRun: false
});
```

### 4. Interação Desktop

```typescript
// Interage com desktop via streaming
const stream = await desktopInteract({
  action: "stream_fazai_cli",
  params: { mode: "interactive" }
});
```

## 🛠 Ferramentas MCP Disponíveis

### Gmail Tools

| Ferramenta | Descrição | Parâmetros |
|------------|-----------|------------|
| `check_gmail_export_emails` | Verifica emails com instruções de export | `query`, `maxResults`, `labelIds` |
| `download_chat_export` | Baixa exports de chat automaticamente | `exportUrl`, `destinationPath` |
| `list_exports` | Lista exports disponíveis | `status`, `dateRange` |
| `get_export_status` | Verifica status de export | `exportId` |

### FazAI Tools

| Ferramenta | Descrição | Parâmetros |
|------------|-----------|------------|
| `fazai_execute` | Executa comandos via FazAI | `command`, `dryRun`, `model` |
| `fazai_status` | Verifica status do FazAI | - |
| `fazai_config` | Mostra configuração FazAI | - |
| `fazai_history` | Histórico de comandos | `limit`, `filter` |

### Desktop Tools

| Ferramenta | Descrição | Parâmetros |
|------------|-----------|------------|
| `desktop_interact` | Interage com desktop via streaming | `action`, `params` |
| `start_fazai_stream` | Inicia stream do FazAI CLI | `mode` |
| `stop_fazai_stream` | Para stream ativo | `streamId` |

## 📚 Exemplos de Uso

### Exemplo 1: Verificar e Processar Exports

```bash
# No Claude Desktop, pergunte:
"Verifique se chegaram emails com instruções para baixar exports de chat e proceda com o download"
```

O MCP server irá:
1. 🔍 Verificar Gmail por emails relevantes
2. 📧 Identificar links de download
3. ⬇️ Baixar exports automaticamente
4. 📝 Notificar o usuário sobre o progresso

### Exemplo 2: Administração Linux via FazAI

```bash
# No Claude Desktop:
"Configure nginx como proxy reverso para aplicação na porta 3000 usando FazAI"
```

O MCP server irá:
1. 🤖 Executar FazAI com comando natural
2. ⚡ Mostrar comandos gerados
3. ✅ Confirmar execução se necessário
4. 📊 Retornar resultados

### Exemplo 3: Streaming Interativo

```bash
# No Claude Desktop:
"Inicie uma sessão interativa do FazAI para configurar servidor web"
```

O MCP server irá:
1. 🚀 Iniciar stream do FazAI CLI
2. 💬 Permitir interação em tempo real
3. 📺 Mostrar output ao vivo
4. 🎛️ Permitir controle da sessão

## 🔒 Segurança e Autenticação

### OAuth2 Flow Seguro

```typescript
// Fluxo de autenticação seguro
const authClient = new GoogleAuth({
  scopes: [
    'https://www.googleapis.com/auth/gmail.readonly',
    'https://www.googleapis.com/auth/gmail.metadata'
  ],
  credentials: {
    client_id: process.env.GMAIL_CLIENT_ID,
    client_secret: process.env.GMAIL_CLIENT_SECRET
  }
});
```

### Validação de Comandos FazAI

```typescript
// Validação de comandos perigosos
const validateCommand = (command: string): ValidationResult => {
  const dangerousPatterns = [
    /rm\s+-rf\s+\//, 
    /dd\s+if=.*of=/, 
    /mkfs/, 
    /fdisk/
  ];
  
  return {
    safe: !dangerousPatterns.some(pattern => pattern.test(command)),
    risk: assessRisk(command)
  };
};
```

## 📊 Monitoramento e Logs

### Estrutura de Logs

```typescript
// Sistema de logs estruturado
interface LogEntry {
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  component: 'gmail' | 'fazai' | 'mcp' | 'desktop';
  action: string;
  details: any;
  userId?: string;
}
```

### Dashboard de Monitoramento

Acesse: `http://localhost:3001/dashboard`

- 📈 Métricas em tempo real
- 📧 Status de verificação Gmail
- 🤖 Execuções FazAI
- 🔄 Streams ativos
- ⚠️ Alertas e erros

## 🐛 Resolução de Problemas

### Problema: Gmail API não autorizada

```bash
# Solução: Re-autorizar aplicação
npm run auth:reset
npm run auth:setup
```

### Problema: FazAI não encontrado

```bash
# Verificar instalação
which fazai
# Se não encontrado:
curl -fsSL https://github.com/RLuf/FazAI/raw/master/scripts/install.sh | bash
```

### Problema: Claude Desktop não conecta

```bash
# Verificar configuração
cat ~/.config/Claude/claude_desktop_config.json
# Reiniciar Claude Desktop
pkill Claude && open -a Claude
```

### Logs de Debug

```bash
# Ativar logs detalhados
export LOG_LEVEL=debug
npm run start

# Ou verificar logs
tail -f logs/fazai-mcp.log
```

## 🔄 Fluxo de Trabalho Completo

### Cenário: Backup e Administração Automática

1. **🕐 Verificação Periódica**
   ```typescript
   // A cada 30 minutos
   setInterval(checkGmailExportEmails, 30 * 60 * 1000);
   ```

2. **📧 Detecção de Email**
   ```typescript
   // Email detectado: "Your chat export is ready"
   if (email.subject.includes('export') && email.body.includes('download')) {
     await processExportEmail(email);
   }
   ```

3. **⬇️ Download Automático**
   ```typescript
   // Download e extração
   const exportData = await downloadAndExtract(exportUrl);
   await notifyUser(`Export baixado: ${exportData.size} mensagens`);
   ```

4. **🤖 Processamento Inteligente**
   ```typescript
   // Usar FazAI para organizar dados
   await fazaiExecute(
     `organizar arquivos de backup em /home/user/backups/chats-${date}`
   );
   ```

## 🔗 Integração com Claude Desktop

### Comandos Naturais Suportados

- ✅ "Verifique meus emails por exports de chat"
- ✅ "Baixe o export mais recente disponível"
- ✅ "Configure backup automático dos chats"
- ✅ "Use FazAI para instalar servidor web"
- ✅ "Mostre status do sistema via FazAI"
- ✅ "Inicie sessão interativa de administração"

### Respostas Inteligentes

O MCP server fornece contexto rico para Claude:

```typescript
// Exemplo de resposta contextual
{
  tool: "check_gmail_export_emails",
  result: {
    found: 2,
    exports: [
      {
        subject: "Your Google Takeout export is ready",
        date: "2025-11-05",
        downloadUrl: "https://takeout.google.com/...",
        size: "1.2GB",
        type: "Google Chat"
      }
    ]
  }
}
```

## 🚀 Deployment e Produção

### Docker Deployment

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY dist/ ./dist/
EXPOSE 3001
CMD ["node", "dist/server.js"]
```

```bash
# Build e deploy
docker build -t fazai-gmail-mcp .
docker run -d --name fazai-mcp \
  -p 3001:3001 \
  -e GMAIL_CLIENT_ID="$GMAIL_CLIENT_ID" \
  -e GMAIL_CLIENT_SECRET="$GMAIL_CLIENT_SECRET" \
  fazai-gmail-mcp
```

### Systemd Service

```ini
[Unit]
Description=FazAI Gmail MCP Server
After=network.target

[Service]
Type=simple
User=fazai
WorkingDirectory=/opt/fazai-gmail-mcp
ExecStart=/usr/bin/node dist/server.js
Restart=always
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

## 📞 Suporte e Contribuição

### Suporte

- 📧 Email: support@fazai-mcp.com
- 💬 Discord: [FazAI Community](https://discord.gg/fazai)
- 🐛 Issues: [GitHub Issues](https://github.com/seu-usuario/fazai-gmail-mcp/issues)

### Contribuição

```bash
# Fork e clone
git clone https://github.com/seu-fork/fazai-gmail-mcp-server.git
cd fazai-gmail-mcp-server

# Criar branch
git checkout -b feature/nova-funcionalidade

# Desenvolver e testar
npm run test
npm run lint

# Commit e push
git commit -m "feat: adicionar nova funcionalidade"
git push origin feature/nova-funcionalidade

# Criar Pull Request
```

## 📄 Licença

**Código**: Apache License 2.0 (compatível com FazAI)
**Documentação**: Creative Commons Attribution 4.0 International

---

## 🎯 Próximos Passos

Para implementar este MCP server:

1. **⚡ Setup Inicial**
   - Configure Gmail API
   - Instale FazAI
   - Configure Claude Desktop

2. **🔧 Desenvolvimento**
   - Implemente servidor MCP base
   - Adicione tools Gmail
   - Integre FazAI

3. **🧪 Testes**
   - Teste integração Gmail
   - Valide comandos FazAI
   - Configure Claude Desktop

4. **🚀 Deploy**
   - Configure produção
   - Monitore performance
   - Documente uso

**Este MCP server transforma Claude Desktop em um assistente completo para backup de chats e administração Linux inteligente via FazAI!**