# Índice Completo dos CLAUDE.md - FazAI v2.0

## Data: 2025-01-06
## Status: INDEXAÇÃO SEM MODIFICAÇÕES

### Arquivos CLAUDE.md Localizados

1. **RAIZ** - `/home/rluft/fazai/CLAUDE.md`
   - Arquivo principal do projeto
   - Contém changelog, visão geral, arquitetura
   - Status: Existente ✅

2. **LIB CORE** - `/home/rluft/fazai/opt/fazai/lib/CLAUDE.md`  
   - Daemon principal (main.js)
   - Documentação do servidor Express
   - Status: Existente ✅

3. **HANDLERS** - `/home/rluft/fazai/opt/fazai/lib/handlers/CLAUDE.md`
   - Handlers HTTP (agent.js, relay.js)
   - Lógica de processamento de comandos
   - Status: Existente ✅

4. **PROVIDERS** - `/home/rluft/fazai/opt/fazai/lib/providers/CLAUDE.md`
   - Provedores de IA (gemma-worker.js)
   - Integração com modelos de IA
   - Status: Existente ✅

5. **CORE FUNCTIONS** - `/home/rluft/fazai/opt/fazai/lib/core/CLAUDE.md`
   - Funcionalidades core (shell, research, kb, retrieval)
   - Módulos fundamentais do sistema
   - Status: Existente ✅

6. **WEB INTERFACE** - `/home/rluft/fazai/opt/fazai/web/CLAUDE.md`
   - Interface web DOCLER
   - WebSocket e servidor web
   - Status: Existente ✅

7. **WORKER C++** - `/home/rluft/fazai/worker/CLAUDE.md`
   - Worker C++ para Gemma
   - Processamento nativo de IA
   - Status: Existente ✅

8. **TERMINAL UI** - `/home/rluft/fazai/tui/CLAUDE.md`
   - Interface TUI em Rust
   - Terminal interativo
   - Status: Existente ✅

9. **TESTS** - `/home/rluft/fazai/tests/CLAUDE.md`
   - Documentação dos testes
   - Suítes de teste e qualidade
   - Status: Existente ✅

### Estrutura de Diretórios Mapeada

```
/home/rluft/fazai/
├── CLAUDE.md ................................. [1] RAIZ
├── bin/
│   ├── fazai ................................. CLI Principal
│   ├── gemma2b ............................... Wrapper oneshot  
│   └── gemma ................................. Wrapper interativo
├── opt/fazai/
│   ├── lib/
│   │   ├── CLAUDE.md ......................... [2] LIB CORE
│   │   ├── main.js ........................... Daemon Express
│   │   ├── handlers/
│   │   │   └── CLAUDE.md ..................... [3] HANDLERS
│   │   ├── providers/
│   │   │   └── CLAUDE.md ..................... [4] PROVIDERS  
│   │   └── core/
│   │       └── CLAUDE.md ..................... [5] CORE FUNCTIONS
│   ├── bin/logica_simples_fazai/
│   │   ├── gemma2b ........................... Wrapper Claudio (oneshot)
│   │   ├── gemma ............................. Wrapper Claudio (interativo)
│   │   └── gemma.bin ......................... Binário Gemma real
│   └── web/
│       └── CLAUDE.md ......................... [6] WEB INTERFACE
├── worker/
│   └── CLAUDE.md ............................. [7] WORKER C++
├── tui/
│   └── CLAUDE.md ............................. [8] TERMINAL UI
└── tests/
    └── CLAUDE.md ............................. [9] TESTS
```

### Componentes Identificados (SEM MODIFICAR)

#### CLI Principal (`bin/fazai`)
- Parâmetro `-q` detectado (linha 797-798)
- Função `sendCommand` usa endpoint `/ask` para perguntas
- Stream mode disponível com `-s`

#### Wrappers Gemma Localizados
- **gemma2b**: `/opt/fazai/bin/logica_simples_fazai/gemma2b` 
  - Usage: `echo "prompt" | gemma2b [0|1|2]`
  - Níveis: 0=clean, 1=standard, 2=debug
- **gemma**: `/opt/fazai/bin/logica_simples_fazai/gemma`
  - Modo interativo multi-turno
  - Chama `gemma.bin` com parâmetros otimizados

#### Daemon Main.js (`opt/fazai/lib/main.js`)
- Servidor Express porta 3120
- Endpoints: `/ask`, `/command`, `/health`, `/relay/*`
- IPC com worker C++ via socket Unix

#### Configuração (`etc/fazai/fazai.conf.example`)
- Seção `[gemma_cpp]` com `verbose_level = 1`
- Seção `[gemma_interactive]` para modo chat
- Configurações de provedores de IA

### Próximos Passos Planejados (NÃO EXECUTADOS)
1. Implementar bypass direto gemma2b para `-q`
2. Manter compatibilidade com main.js
3. Ajustar configurações no fazai.conf
4. Testar integração híbrida

### Status da Documentação
- **INDEXADO**: ✅ Completo
- **MODIFICADO**: ❌ Nenhuma alteração feita
- **BACKUP**: ✅ Contexto preservado em `.claude/plan/`