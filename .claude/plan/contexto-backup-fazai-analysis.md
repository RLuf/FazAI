# Backup do Contexto - Análise FazAI

## Data: 2025-01-06
## Usuário: Roginho (Claudio) - "humanidade, vida, Claudio, vulcao"

## Contexto da Tarefa Atual

### Objetivo Principal
Implementar modificações no FazAI para:
1. **Integração Direta gemma2b**: Para consultas simples (-q), enviar direto para `/opt/fazai/bin/logica_simples_fazai/gemma2b` 
2. **Manter Compatibilidade**: Preservar funcionalidade atual do main.js para daemon centralizado
3. **Execução de Prompts via Gemma Real**: Implementar envio de prompts para o gemma real via main.js

### Componentes Identificados

#### 1. CLI Principal (`/home/rluft/fazai/bin/fazai`)
- Parâmetro `-q` ou `--question` detectado na linha 797-798
- `questionMode = true` quando ativado
- Linha 1919: `sendCommand(questionMode ? { question: true, command } : command)`
- Função `sendCommand` linha 425: usa endpoint `/ask` para perguntas

#### 2. Wrappers Gemma Localizados
- **gemma2b** (`/opt/fazai/bin/logica_simples_fazai/gemma2b`):
  - Usage: `echo "prompt" | gemma2b [0|1|2]` 
  - Níveis: 0=clean, 1=standard, 2=debug
  - Usa `/bin/gemma --prompt` para oneshot mode
- **gemma** (`/opt/fazai/bin/logica_simples_fazai/gemma`):
  - Modo interativo multi-turno
  - Executa `gemma.bin` com parâmetros otimizados

#### 3. Configuração (`fazai.conf.example`)
- Seção `[gemma_cpp]` linha 43-52:
  - `endpoint = /opt/fazai/bin/gemma_oneshot`
  - `verbose_level = 1` para perguntas simples (-q)
- Seção `[gemma_interactive]` linha 54-65:
  - `endpoint = /opt/fazai/bin/logica_simples_fazai/gemma`

#### 4. Daemon Main.js (`/opt/fazai/lib/main.js`)
- Servidor Express na porta 3120
- Endpoint `/ask` para perguntas
- Comunicação via IPC com worker C++

### Estrutura Arquitetural Identificada

```
CLI (fazai) -q "pergunta"
    ↓
sendCommand({ question: true, command })
    ↓
POST /ask → main.js
    ↓
[ATUAL] → Worker C++ → Gemma
    ↓
[NOVO] → gemma2b wrapper direto (bypass main.js para -q)
```

### Modificações Planejadas

1. **CLI (fazai)**:
   - Detectar `-q` e chamar `gemma2b` diretamente
   - Manter fallback para main.js em caso de falha

2. **main.js**:
   - Implementar execução de prompts via gemma real
   - Preservar endpoint `/ask` para compatibilidade

3. **fazai.conf**:
   - Adicionar configuração para `gemma2b_direct`
   - Ajustar endpoints para novos wrappers

### Arquivos para Refazer CLAUDE.md
- `/home/rluft/fazai/CLAUDE.md` (raiz)
- `/home/rluft/fazai/opt/fazai/lib/CLAUDE.md` 
- `/home/rluft/fazai/opt/fazai/lib/handlers/CLAUDE.md`
- `/home/rluft/fazai/opt/fazai/lib/providers/CLAUDE.md`
- `/home/rluft/fazai/opt/fazai/lib/core/CLAUDE.md`
- `/home/rluft/fazai/opt/fazai/web/CLAUDE.md`
- `/home/rluft/fazai/worker/CLAUDE.md`
- `/home/rluft/fazai/tui/CLAUDE.md`
- `/home/rluft/fazai/tests/CLAUDE.md`

### Princípios a Seguir
- **KISS**: Simplicidade na integração direta gemma2b
- **YAGNI**: Implementar apenas o necessário agora
- **DRY**: Reutilizar código existente
- **SRP**: Separar responsabilidades entre consultas simples e complexas
- **OCP**: Manter extensibilidade para futuros providers