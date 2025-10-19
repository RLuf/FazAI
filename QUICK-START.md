# 🚀 FazAI - Guia Rápido de Início

## ⚡ Configuração em 3 Passos

### 1️⃣ Instale o FazAI rapidamente

```bash
curl -fsSL https://github.com/RLuf/FazAI/raw/master/scripts/install.sh | bash
start-codex
```

### 2️⃣ Configure sua API Key da OpenAI

```bash
# Copie o arquivo de exemplo
cp fazai.conf.example fazai.conf

# Edite e cole sua chave OpenAI
nano fazai.conf
```

Cole sua chave OpenAI no arquivo:
```
OPENAI_API_KEY=sk-sua-chave-aqui
```

### 3️⃣ Build manual (opcional)

```bash
npm install
npm run build
```

### 4️⃣ Teste!

```bash
# Modo ask (seguro, não executa nada)
node dist/app.cjs ask "O que é nginx?" gpt4mini

# Modo admin com GPT-4o-mini
node dist/app.cjs --dry-run gpt4mini
```

---

## 📖 Exemplos de Uso

### Modo Ask (Perguntas)

```bash
# Com GPT-4o-mini (rápido e barato)
node dist/app.cjs ask "Como configurar nginx?" gpt4mini

# Com GPT-4o (mais inteligente)
node dist/app.cjs ask "Explicar diferença entre systemctl e service" gpt4o
```

### Modo Admin (Comandos Linux)

```bash
# Dry-run (simula, não executa)
node dist/app.cjs --dry-run gpt4mini

# Admin real (CUIDADO! Executa comandos)
node dist/app.cjs gpt4o
```

### Ver Configuração

```bash
# Listar API keys configuradas
node dist/app.cjs config

# Abrir o CLI interativo com chat e memória persistente
node dist/app.cjs --cli
```

---

## 🔍 Pesquisa Automatizada (Opcional)

Quer que o FazAI busque documentação automaticamente?

1. Configure um endpoint MCP Context7 **ou** um comando local no `fazai.conf`:

```ini
# Endpoint HTTP
MCP_CONTEXT7_URL=http://localhost:7700/context7/search

# OU comando CLI (usa {query})
MCP_CONTEXT7_COMMAND=context7 --json --query "{query}"
```

2. (Opcional) Defina o fallback web:

```ini
WEB_SEARCH_PROVIDER=duckduckgo
```

3. Para desabilitar pesquisas automáticas (ex.: ambiente offline):

```ini
FAZAI_DISABLE_RESEARCH=true
```

> Dica: use `FAZAI_CONFIG_PATH=/caminho/fazai.conf` se quiser centralizar a configuração em outro local.

---

## 🎯 Modelos Disponíveis

| Nickname | Modelo | Custo | Uso |
|----------|--------|-------|-----|
| `gpt4o` | GPT-4o | Médio | Tarefas complexas |
| `gpt4mini` | GPT-4o-mini | **Baixo** | Recomendado para começar |
| `gpt4turbo` | GPT-4 Turbo | Alto | Máxima capacidade |

---

## 🔧 Configuração Avançada (Ollama Local)

Se você tem Ollama rodando local ou em outro servidor:

```bash
# 1. Adicione ao fazai.conf
echo "OLLAMA_BASE_URL=http://localhost:11434" >> fazai.conf

# 2. Use modelos Ollama
node dist/app.cjs llama32    # Llama 3.2
node dist/app.cjs qwen        # Qwen 2.5
node dist/app.cjs mistral     # Mistral
```

---

## ⚠️ Avisos Importantes

1. **Modo Ask**: Completamente seguro, só responde perguntas
2. **Modo --dry-run**: Simula comandos, não executa nada
3. **Modo Admin Normal**: **EXECUTA comandos de verdade!**
   - Comece com tarefas seguras
   - Sempre revise os comandos antes de confirmar

---

## 🆘 Problemas Comuns

### "API key não encontrada"
```bash
# Verifique se o arquivo existe e tem a chave
cat fazai.conf
```

### "Build failed"
```bash
# Reinstale dependências
rm -rf node_modules package-lock.json
npm install
npm run build
```

### "Ollama não conecta"
```bash
# Verifique se o Ollama está rodando
curl http://localhost:11434/api/tags

# Se estiver em outro servidor, configure a URL no fazai.conf
echo "OLLAMA_BASE_URL=http://IP:11434" >> fazai.conf
```

---

## 📚 Próximos Passos

1. Teste com `--dry-run` primeiro
2. Experimente diferentes modelos (gpt4mini é barato!)
3. Use modo ask para perguntas sobre Linux
4. Configure Ollama para uso local gratuito

---

**Dúvidas?** Veja o [README.md](README.md) completo ou abra uma issue!
