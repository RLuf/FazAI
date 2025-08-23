# FazAI - Fluxo Inteligente de Automação

## Visão Geral

O FazAI foi transformado num sistema de fluxo inteligente que opera como um "piloto" operacional para servidores e serviços. Ele não se limita a responder perguntas: analisa, decide, executa e aprende — tudo em ciclos iterativos, com saída em tempo real no terminal, integrando conhecimento local e pesquisa externa.

## Arquitetura do Sistema Inteligente

### Componentes Principais

1. **Agente Persistente**: Mantém raciocínio contínuo sobre um objetivo até concluí-lo
2. **Modelo Local**: Via libgemma.a para raciocínio rápido e contextual
3. **Recuperação de Contexto**: Fontes como Qdrant (memória operacional) e Context7 (documentos técnicos)
4. **Acesso à Internet**: Para pesquisa de soluções quando necessário
5. **Síntese Dinâmica de Ferramentas**: Gera código sob demanda, carrega e executa
6. **Execução como Root**: Para aplicar mudanças diretamente na máquina

### Fluxo de Operação

```
1. Entrada → Modo
   - Usuário descreve objetivo
   - Sistema escolhe modo de operação
   - Define ferramentas disponíveis

2. Contexto do Projeto
   - Injeção de contexto via MCP Context7
   - Recuperação de conhecimento local
   - Análise do estado atual do sistema

3. Raciocina → Decide Ação
   - LLM analisa e decide próxima ação
   - Uma iteração = máximo uma ação
   - Mantém controle e rastreabilidade

4. Execução Controlada
   - Executa ferramenta (file/terminal/browser)
   - Captura resultado (logs, diffs, screenshots)
   - Devolve como novo contexto

5. Valida/Auto-corrige
   - Se falha, entra em depuração
   - Itera até passar
   - Confirmação para ações destrutivas

6. Extensão por MCP
   - Conecta MCP servers quando necessário
   - Ferramentas plugáveis aparecem como comandos

7. Providers de IA
   - Chama modelos via provedor configurado
   - Fallback automático em caso de falha
```

## Protocolo de Agentes

### Contratos e Formatos

#### 1. Mensagens de Socket (Worker Local)
- **Protocolo**: ND-JSON, 1 objeto por linha
- **Métodos**:
  - `create_session` → `{ "method": "create_session", "params": {...} }`
  - `generate` / `generate_stream`
  - `abort`
  - `close_session`
- **Campos obrigatórios**: `id`, `method`, `params`, `timestamp`

#### 2. SSE (Daemon ⇄ CLI/UI)
- **Eventos padronizados**:
  - `token` – Token de texto gerado
  - `action` – Objeto de ação emitido pelo modelo
  - `log` – Log textual
  - `observe` – Observação retornada após ação
  - `done` – Encerramento da iteração

#### 3. Southbound (Agentes Remotos)
- **Método hello**: Anuncia agente e versão
- **Comandos**: `command.exec`, `telemetry.push`, `file.diff/apply`
- **Transporte**: WS/mTLS ou HTTP/REST assinado
- **Formato**: JSON com `action_id` idempotente

### Regras Obrigatórias para Agentes

1. **1 ação por iteração** – Evita concorrência indesejada
2. **Validação estrita** – Rejeitar payloads fora do SPEC
3. **Idempotência** – Repetir `action_id` não pode causar efeitos duplicados
4. **Timeouts** – Definir limite por operação
5. **Segurança** – Respeitar mTLS para agentes remotos

## Tipos de Ações (ND-JSON)

### 1. Plan
```json
{
  "type": "plan",
  "steps": ["inventário", "configuração", "validação"]
}
```
- **Uso**: Organizar próximos passos
- **Executor**: Apenas exibe no CLI

### 2. Ask
```json
{
  "type": "ask",
  "question": "Qual relayhost usar?",
  "options": ["smtp.gmail.com", "smtp.office365.com"]
}
```
- **Uso**: Resolver ambiguidades
- **Executor**: Pergunta no CLI

### 3. Research
```json
{
  "type": "research",
  "queries": ["postfix relay configuration", "rspamd setup"],
  "maxDocs": 5
}
```
- **Uso**: Lacuna de conhecimento local
- **Executor**: Busca e resume

### 4. Shell
```json
{
  "type": "shell",
  "command": "apt-get update && apt-get install -y postfix"
}
```
- **Uso**: Ações diretas no sistema
- **Executor**: Spawn como root com streaming

### 5. ToolSpec
```json
{
  "type": "tool_spec",
  "name": "configure_postfix_relay",
  "description": "Configura Postfix como relay",
  "parameters": {
    "relayhost": "string",
    "domains": "array"
  }
}
```
- **Uso**: Criar ferramentas reutilizáveis
- **Executor**: Codegen dinâmico

### 6. UseTool
```json
{
  "type": "use_tool",
  "name": "configure_postfix_relay",
  "args": {
    "relayhost": "smtp.gmail.com",
    "domains": ["example.com"]
  }
}
```
- **Uso**: Invocar ferramenta gerada
- **Executor**: Executa tool com streaming

### 7. Observe
```json
{
  "type": "observe",
  "summary": "Postfix instalado e configurado como relay"
}
```
- **Uso**: Resumir o que foi feito
- **Executor**: Exibe e fecha iteração

### 8. CommitKB
```json
{
  "type": "commit_kb",
  "title": "Postfix Relay Setup",
  "tags": ["postfix", "relay", "email"],
  "snippet": "Configuração completa de relay Postfix",
  "status": "verified"
}
```
- **Uso**: Cristalizar conhecimento
- **Executor**: Gera embedding e salva no Qdrant

### 9. Done
```json
{
  "type": "done",
  "result": "Servidor de email relay configurado com sucesso"
}
```
- **Uso**: Objetivo atingido
- **Executor**: Encerra iteração

## Implementação do Worker Gemma

### Estrutura do Worker C++
```cpp
class GemmaEngine {
public:
  explicit GemmaEngine(const std::string& model_path);
  std::string create_session(const nlohmann::json& params);
  void generate_stream(const std::string& sid, const std::string& prompt,
                       std::function<bool(const std::string&)> on_token);
  void abort(const std::string& sid);
  void close_session(const std::string& sid);
private:
  std::unordered_map<std::string, SessionState> sessions_;
};
```

### Provider Node.js
```javascript
export async function createSession(params={}){
  const sock = net.createConnection(SOCK);
  await once(sock,"connect");
  sendJson(sock,{type:"create_session",params});
  const resp = await readJson(sock);
  sock.end();
  return resp.session_id;
}

export function generateStream(session_id,prompt){
  const ee=new EventEmitter();
  const sock=net.createConnection(SOCK,()=>
    sendJson(sock,{type:"generate",session_id,prompt,stream:true}));
  // ... parser de tokens
  return ee;
}
```

## Handlers do Agente

### Rotas Principais
```javascript
app.post("/agent/sessions", async (req,res)=>{
  const sid = await createSession(req.body.params||{});
  res.json({ok:true,session_id:sid});
});

app.post("/agent/generate", async (req,res)=>{
  res.setHeader("Content-Type","text/event-stream");
  const {session_id,objective,history=[]}=req.body;
  const ctx = await searchContext(objective,history);
  const prompt = await buildPrompt({objective,ctx,history});
  const stream = generateStream(session_id,prompt);
  // ... parsing de ações ND-JSON
});
```

## Base de Conhecimento (Qdrant)

### Estrutura de Dados
```javascript
const payload = {
  title: obj.title,
  tags: obj.tags || [],
  snippet: obj.snippet || "",
  status: obj.status || "unverified",
  source: obj.source || "local",
  ts: Date.now()
};
```

### Recuperação de Contexto
- **Top-k por similaridade** textual do objetivo
- **Priorização** de itens "verified" e recentes
- **Enriquecimento** com estado atual do sistema

## Configuração do Sistema

### Arquivo de Configuração Principal
```ini
[ai_provider]
provider = gemma-worker (obsoleto pois o gemma eh motor central integrados os providers extras como api openai e opentouter sao apoios.

[gemma_worker]
socket = /run/fazai/gemma.sock
model = /opt/fazai/models/gemma2-2b-it-sfp.bin
threads = auto
temperature = 0.2
top_p = 0.9
repeat_penalty = 1.1

[agent]
stream = sse
max_iterations = 32
action_per_iteration = 1
fallback_enabled = true
```

## CLI Inteligente

### Subcomando Agent
```bash
#!/usr/bin/env node
async function runAgent(obj){
  const sess=await fetch(`${BASE}/agent/sessions`,{method:"POST"}).then(r=>r.json());
  const sid=sess.session_id;
  
  for await(const evt of sse(`${BASE}/agent/generate`,{session_id:sid,objective:obj})){
    switch(evt.type){
      case "token": process.stdout.write(evt.text); break;
      case "plan": console.log(`\n>> plano: ${evt.steps.join(" -> ")}`); break;
      case "action": console.log(`\n>> ação: ${evt.action}`); break;
      case "exec_log": process.stdout.write(evt.chunk); break;
      case "observe": console.log(`\n== observação: ${evt.note}`); break;
      case "ask": /* interação com usuário */ break;
      case "done": console.log("\n? iteração concluída"); return;
    }
  }
}
```

## Fluxo de Exemplo Completo

### Cenário: Configurar Servidor de Email Relay

1. **Entrada**: `fazai agent "cria um servidor de email somente relay com antispam e antivirus"`

2. **Contexto**: Sistema recupera conhecimento sobre Postfix, rspamd, configurações de relay

3. **Planejamento**: 
   ```json
   {"type":"plan","steps":["inventário","instalar postfix","configurar relay","instalar rspamd","configurar antispam","testar"]}
   ```

4. **Execução Iterativa**:
   - **Iteração 1**: `{"type":"shell","command":"apt-get update && apt-get install -y postfix rspamd"}`
   - **Iteração 2**: `{"type":"tool_spec","name":"configure_postfix_relay",...}`
   - **Iteração 3**: `{"type":"use_tool","name":"configure_postfix_relay",...}`
   - **Iteração 4**: `{"type":"observe","summary":"Postfix configurado como relay"}`
   - **Iteração 5**: `{"type":"commit_kb","title":"Postfix Relay Setup",...}`

5. **Conclusão**: `{"type":"done","result":"Servidor de email relay configurado com sucesso"}`

## Benefícios do Fluxo Inteligente

1. **Autonomia Real**: Não depende de scripts pré-montados
2. **Transparência**: Cada decisão, ação e resultado visível em tempo real
3. **Evolução**: Cada execução alimenta memória que melhora próximas execuções
4. **Flexibilidade**: Adaptável a diferentes ambientes e objetivos
5. **Rastreabilidade**: Auditoria completa de todas as ações
6. **Aprendizado Contínuo**: Base de conhecimento cresce com o uso

## Próximos Passos

1. **Implementação do Worker C++** com libgemma.a
2. **Integração com Qdrant** para base de conhecimento
3. **Conectores para OPNsense** e outros sistemas
4. **Interface Web** para visualização de sessões
5. **Agentes Distribuídos** para orquestração multi-servidor
6. **Políticas de Segurança** e RBAC avançado

---

*Este documento define a arquitetura completa do FazAI como um sistema de fluxo inteligente, transformando-o de um simples orquestrador para um agente cognitivo persistente capaz de aprender, decidir e executar de forma autônoma.*
