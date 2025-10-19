# 🖥️ FazAI 3.0-RC - Administrador Linux Inteligente com IA

<h3 align="center">FazAI converte linguagem natural em comandos Linux seguros, com validação de risco e rollback automático.</h3>

## 🌟 Features

- **Linguagem Natural para Linux**: Descreva o que quer fazer, FazAI gera os comandos
- **Segurança em Camadas**: Detecção automática de comandos perigosos
- **Confirmação Inteligente**: Pedidos de confirmação baseados no nível de risco
- **Rollback Automático**: Comandos reversíveis incluem rollback
- **Modo Dry-Run**: Simule comandos sem executar nada
- **Context-Aware**: Analisa seu sistema (OS, serviços, pacotes) para gerar comandos corretos
- **IA Poderosa**: Claude 3.5 Sonnet e Haiku da Anthropic
- **Chat Interativo**: Modo `--cli` com memória contextual persistente, comandos especiais e histórico navegável
- **Fallback Inteligente**: Pesquisa via MCP Context7 com fallback para busca web quando precisa de mais contexto

## 🚀 Instalação

### Script (recomendado)
```bash
curl -fsSL https://github.com/RLuf/FazAI/raw/master/scripts/install.sh | bash
start-codex
```

### Via NPX (sem instalação)
```bash
npx fazai
```

### Instalação Global (npm)
```bash
npm install -g fazai
fazai
```

### Build Local
```bash
git clone https://github.com/seu-usuario/fazai.git
cd fazai
npm install
npm run build
npm link
fazai
```

### Instalador Local
```bash
git clone https://github.com/seu-usuario/fazai.git
cd fazai
./scripts/install.sh --prefix ~/.local/bin --pack
```
O script compila o projeto, instala o executável `fazai` no diretório escolhido e, com `--pack`, gera um pacote `.tgz` pronto para distribuição.

## 📖 Uso

### Modo Admin (Default)

```bash
# Iniciar FazAI
fazai

# Com modelo específico
fazai haiku          # Claude Haiku (rápido e barato)
fazai sonnet35       # Claude 3.5 Sonnet (default, mais inteligente)

# Modo simulação (nada é executado)
fazai --dry-run

# Modo CLI interativo com chat e memória persistente
fazai --cli
```

**Exemplos de tarefas:**
```bash
> O que você precisa fazer?

"instalar e configurar nginx como proxy reverso para porta 3000"
"verificar uso de disco e limpar arquivos temporários antigos"
"reiniciar serviço apache e verificar se está funcionando"
"criar usuário admin com permissões sudo"
"configurar firewall ufw para permitir apenas portas 22, 80, 443"
"fazer backup do diretório /var/www em /backup"
"atualizar sistema e reiniciar se necessário"
```

### Modo Ask (Perguntas Gerais)

```bash
fazai ask "Como configurar nginx como proxy reverso?"
fazai ask "Diferença entre systemctl e service?"
fazai ask "Explicar como funciona iptables"
```

### Configuração

```bash
# Listar API keys configuradas
fazai config

# Ver ajuda
fazai --help

# Listar sugestões para auto-complete
fazai completion
```

### Fallback Automático (MCP Context7 + Busca Web)

- Quando o modelo identifica que precisa de mais contexto, ele pode definir `researchNeeded=true` e sugerir uma `researchQuery` no JSON retornado.
- Se um comando falhar, FazAI dispara automaticamente uma pesquisa:
  1. Consulta o provider configurado via MCP Context7 (HTTP ou comando externo).
  2. Faz fallback para uma busca na internet (DuckDuckGo por padrão).
- Os resultados são exibidos diretamente no terminal, com título, resumo e URL, ajudando você a decidir a próxima ação.
- Defina `FAZAI_DISABLE_RESEARCH=true` caso prefira operar offline ou em ambientes sem acesso à internet.

## 🛡️ Sistema de Segurança

FazAI possui **5 camadas de proteção**:

### 1. Pattern Matching
Bloqueia comandos conhecidamente perigosos:
- `rm -rf /` (destruição de sistema)
- `dd if=/dev/zero` (sobrescrever disco)
- `mkfs`, `fdisk`, `wipefs` (formatar disco)
- `chmod 777 -R /` (permissões inseguras)

### 2. Avaliação de Risco Automática
- **CRITICAL**: Prompt forte, default=não, exige confirmação explícita
- **HIGH**: Confirmação obrigatória
- **MEDIUM**: Confirmação normal
- **LOW**: Executa direto (ou confirma dependendo da flag)

### 3. Safety Checks
Claude gera verificações pré-execução:
- "Verificar se nginx está instalado"
- "Checar se porta 80 está livre"
- "Confirmar que há espaço em disco"

### 4. Rollback Automático
Comandos reversíveis incluem comando de rollback:
```json
{
  "command": "systemctl stop nginx",
  "rollbackCommand": "systemctl start nginx"
}
```

### 5. Dry-Run Mode
```bash
fazai --dry-run
```
Simula tudo sem executar, perfeito para testar.

## 🔧 Como Funciona

1. **Coleta de Sistema**: FazAI analisa seu sistema (OS, distribuição, kernel, serviços ativos, gerenciador de pacotes, etc.)
2. **Você descreve a tarefa**: Em português ou qualquer linguagem natural
3. **Claude gera comandos**: Com estrutura JSON completa (comando, risco, rollback, checks)
4. **Validação de segurança**: Pattern matching + avaliação de risco
5. **Confirmação interativa**: Baseada no nível de risco
6. **Execução com streaming**: Você vê o output em tempo real
7. **Histórico**: Todas as execuções são registradas

## 📋 Exemplo de Execução

```bash
$ fazai

🖥️  FAZAI - MODO ADMINISTRADOR LINUX
Administração inteligente de sistemas Linux

Modelo: sonnet35 (claude-3-5-sonnet-latest)

✅ API key configurada (anthropic)
Coletando informações do sistema...
✅ Sistema analisado

O que você precisa fazer? instalar nginx

🔧 Comando 1:
┌─────────────────────────────────────────────┐
│ Atualizar lista de pacotes                  │
└─────────────────────────────────────────────┘
Comando: apt update
Risco: LOW
Executar? [Y/n] y

✅ Sucesso
...

🔧 Comando 2:
┌─────────────────────────────────────────────┐
│ Instalar nginx                              │
└─────────────────────────────────────────────┘
Comando: apt install -y nginx
Risco: MEDIUM
Rollback: apt remove -y nginx
Executar? [Y/n] y

✅ Sucesso
...

✅ 3 comandos processados

📋 Histórico:
  1. ✅ apt update
  2. ✅ apt install -y nginx
  3. ✅ systemctl enable nginx

⭐ FAZAI - Administração Linux com IA
```

## 🎯 Modelos Disponíveis

### Claude (Anthropic)
| Modelo | Velocidade | Custo | Quando Usar |
|--------|-----------|-------|-------------|
| `sonnet35` | Rápido | Médio | Tarefas complexas, múltiplos serviços (default) |
| `haiku` | Muito Rápido | Baixo | Tarefas simples, comandos únicos |

### OpenAI (GPT)
| Modelo | Velocidade | Custo | Quando Usar |
|--------|-----------|-------|-------------|
| `gpt4o` | Rápido | Médio | Mais recente, tarefas complexas |
| `gpt4mini` | Muito Rápido | Baixo | Rápido e barato |
| `gpt4turbo` | Rápido | Alto | Tarefas que exigem máxima capacidade |

### Ollama (Local)
| Modelo | Velocidade | Custo | Quando Usar |
|--------|-----------|-------|-------------|
| `llama32` | Variável | Grátis | Execução 100% local, privacidade total |
| `qwen` | Variável | Grátis | Modelo Qwen 2.5:7b local |
| `mistral` | Variável | Grátis | Modelo Mistral local |

**Nota**: Ollama requer servidor Ollama rodando (local ou remoto).

## 🔑 Configuração

### Método 1: Arquivo fazai.conf (Recomendado)

Copie o arquivo de exemplo e edite com suas credenciais:

```bash
cp fazai.conf.example fazai.conf
nano fazai.conf
```

Exemplo de configuração:
```bash
# Anthropic Claude (opcional - se você tiver)
ANTHROPIC_API_KEY=sk-ant-api03-xxxxx

# OpenAI (cole sua chave aqui)
OPENAI_API_KEY=sk-xxxxx

# Ollama (se estiver rodando em outro servidor)
OLLAMA_BASE_URL=http://192.168.1.100:11434
```

### Método 2: Interativo

Na primeira execução, FazAI pedirá a API key necessária e salvará automaticamente em `fazai.conf`.

### Obter API Keys

**OpenAI** (você já tem!):
- Use sua chave existente da OpenAI
- Cole no arquivo `fazai.conf` na linha `OPENAI_API_KEY=`

**Anthropic** (opcional):
1. Acesse [console.anthropic.com](https://console.anthropic.com)
2. Crie conta (ganha $5 grátis)
3. Gere uma API key
4. Cole no `fazai.conf`

**Ollama** (local/gratuito):
1. Instale Ollama: https://ollama.com
2. Baixe um modelo: `ollama pull llama3.2`
3. Configure `OLLAMA_BASE_URL` no `fazai.conf` (se não for localhost)

### Configurações adicionais (MCP, pesquisa e caminho do config)

Adicione as chaves abaixo ao `fazai.conf` (ou exporte como variáveis de ambiente) para habilitar a pesquisa assistida:

```ini
# Endpoint HTTP que atenda POST /context7/search
MCP_CONTEXT7_URL=http://localhost:7700/context7/search

# OU um comando local que aceite a consulta (substitui {query})
MCP_CONTEXT7_COMMAND=context7 --json --query "{query}"

# Chave opcional para autenticação do endpoint HTTP
MCP_CONTEXT7_API_KEY=seu_token

# Provedor de fallback web (suporta: duckduckgo)
WEB_SEARCH_PROVIDER=duckduckgo

# Desative pesquisas automáticas quando estiver offline
FAZAI_DISABLE_RESEARCH=true

# Defina um caminho alternativo para o arquivo de configuração
FAZAI_CONFIG_PATH=/etc/fazai/fazai.conf
```

Se `FAZAI_CONFIG_PATH` for informado, o CLI usará esse caminho para ler e gravar configurações.

## 🛰️ Servidor MCP embutido (opcional)

Deseja compartilhar a camada de pesquisa do FazAI com outras ferramentas que falam MCP? Você pode subir um microservidor HTTP:

```ts
import { ResearchCoordinator } from "./src/research";
import { MCPServer } from "./src/mcp/server";

const research = new ResearchCoordinator();
const server = new MCPServer({ researchCoordinator: research, port: 7700 });
await server.start();
```

O endpoint `POST /context7/search` aceitará `{ "query": "..." }` e retornará os mesmos resultados exibidos pelo CLI (incluindo fallback web se configurado).

## 💬 Modo CLI Interativo

O modo `fazai --cli` oferece:
- Chat natural com memória contextual persistente (mantém as últimas interações entre sessões)
- Comandos especiais:
  - `/help` — lista as opções disponíveis
  - `/exec ...` — executa fluxos administrativos a partir de linguagem natural (suporta `'''texto'''`)
  - `/history` — exibe o histórico persistente de entradas
- `/history clear` — limpa esse histórico
- `/memory clear` — limpa a memória contextual gravada
- `/quit` ou `/exit` — encerra o modo CLI
- Histórico navegável com setas ↑/↓ e auto-complete para comandos iniciados com `/`

### Script de inicialização “Codex // Andarilho”

Para iniciar o FazAI com a marca registrada do projeto e exibir o contexto do **Andarilho dos Véus** antes do CLI:

```bash
./scripts/start-codex.sh
```

O script:
- Mostra o banner “Codex // Andarilho”;
- Exibe o conteúdo de `context/andarilho-context.md` (personalize conforme desejar);
- Garante que o build exista (`dist/app.cjs`);
- Lança o `fazai --cli`.

## 🛠️ Desenvolvimento

```bash
# Clone o repositório
git clone https://github.com/seu-usuario/fazai.git
cd fazai

# Instale dependências
npm install

# Desenvolvimento (com hot reload)
npm run dev

# Build para produção
npm run build

# Testar build
npm link
fazai
```

## 📦 Stack Técnico

- **TypeScript** - Tipagem estática
- **Anthropic Claude API** - IA conversacional
- **Inquirer** - Prompts interativos
- **Chalk** - Cores no terminal
- **Zod** - Validação de schemas
- **Node.js 18+** - Runtime

## 🤝 Contribuindo

Contribuições são muito bem-vindas!

1. Fork o projeto
2. Crie uma branch (`git checkout -b feature/MinhaFeature`)
3. Commit suas mudanças (`git commit -m 'Add: MinhaFeature'`)
4. Push para a branch (`git push origin feature/MinhaFeature`)
5. Abra um Pull Request

## 📄 Licença

- **Código**: [Apache License 2.0](LICENSE) (mantendo os termos do fork Mandark original)
- **Documentação, prompts e materiais de apoio**: [Creative Commons Attribution 4.0 International](LICENSE-CC-BY-4.0.md)

Consulte o arquivo [`NOTICE`](NOTICE) para detalhes de atribuição e histórico do projeto.

## 🙏 Créditos

FazAI deriva de [Mandark](https://github.com/hrishioa/mandark) por Hrishi Olickel. Este projeto mantém todos os créditos e direitos previstos pela licença Apache-2.0 original, adicionando documentação e adaptações específicas para administração Linux sob CC BY 4.0.

## ⚠️ Aviso

FazAI executa comandos reais no seu sistema. Sempre:
- Use `--dry-run` para testar primeiro
- Revise comandos antes de confirmar
- Tenha backups dos dados importantes
- Entenda o que cada comando faz

**FazAI não se responsabiliza por dados perdidos ou sistemas danificados.**

---

⭐ **Se FazAI te ajudou, deixe uma estrela!**
