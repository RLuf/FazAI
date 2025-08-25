Visão e escopo

O FazAI é um sistema inteligente de automação e orquestração que atua como um “piloto” operacional para servidores e serviços. Ele não se limita a responder perguntas: ele analisa, decide, executa e aprende — tudo em ciclos iterativos, com saída em tempo real no terminal, integrando conhecimento local e pesquisa externa.
🌐 O que é
Um agente persistente que mantém um raciocínio contínuo sobre um objetivo até concluí-lo. Ele combina:
•	Modelo local (via libgemma.a) para raciocínio rápido e contextual.
•	Recuperação de contexto em fontes como Qdrant (memória operacional) e Context7 (documentos técnicos).
•	Acesso à internet para pesquisa de soluções quando necessário.
•	Síntese dinâmica de ferramentas: gera o código que precisa, carrega e executa sob demanda.
•	Execução como root para aplicar mudanças diretamente na máquina.
⚙️ Como funciona
1.	Você descreve o que quer Ex.: “FazAI cria um servidor de e mail relay only com antispam, antivírus e políticas inteligentes para mensagens suspeitas”.
2.	O agente lê o estado real Verifica serviços, portas, configurações existentes, histórico e conhecimento prévio armazenado.
3.	Recupera contexto útil Busca trechos relevantes no Qdrant e Context7; se faltar informação, faz pesquisa online.
4.	Planeja e decide a primeira ação O raciocínio é transmitido ao vivo pelo terminal: você vê tokens, plano, escolha da ação.
5.	Executa de forma controlada Pode ser um comando shell, a geração de uma nova ferramenta, ou a execução de uma tool já gerada — sempre com logs em tempo real.
6.	Observa e registra resultados Analisa a saída, detecta sucesso ou falha, e decide o próximo passo. Soluções validadas são gravadas na base de conhecimento para reaproveitamento futuro.
7.	Repete o ciclo Continua até que o objetivo esteja cumprido ou um bloqueio/ambiguidade demande sua confirmação.
📌 Funcionalidades principais
•	Sessões persistentes: mantém o estado entre iterações, com uso de KV cache para reduzir latência.
•	Streaming em tempo real: tokens, ações, logs e observações aparecem ao vivo no terminal.
•	Uma ação por iteração: facilita controle, auditoria e correção de curso.
•	Ferramentas sob demanda: nada é pré fixo; o próprio agente cria o que precisa.
•	Pesquisa inteligente: combina contexto interno e resultados externos para decisões mais precisas.
•	Base de conhecimento própria: cada solução confirmada vira referência para cenários futuros.
•	Execução direta: interage com serviços, instala pacotes, ajusta configurações e valida resultados.
📍 Aplicações
O FazAI pode ser usado para:
•	Configuração e manutenção de serviços: e mail, web, proxy, firewall, IDS, backup.
•	Diagnóstico e correção: identificar problemas e aplicar patches.
•	Automação de políticas: segurança, controle de acesso, filtragem de conteúdo.
•	Orquestração multi servidor: atuar como “control tower” para vários nós.
•	Aprendizado contínuo: sistemas que ficam mais eficientes à medida que resolvem mais tarefas.
🔮 Diferenciais
•	Autonomia real: não depende de um conjunto pré montado de scripts.
•	Transparência: você vê cada decisão, ação e resultado em tempo real.
•	Evolução: cada execução alimenta uma memória que melhora a próxima.
•	Flexibilidade: adaptável a diferentes ambientes e objetivos.



O FazAI será o “piloto” único para administrar e monitorar OPNsense e servidores Linux em larga escala. Um cérebro central orquestra agentes distribuídos, toma decisões em ciclos curtos (pensar → agir → observar), e oferece interfaces unificadas para operação, automação e auditoria. Nada de scripts rígidos: o sistema é dinâmico, aprende com o uso e gera ferramentas sob demanda quando necessário.
Arquitetura do sistema
mermaid
graph TD
  U[Operador] -->|Web/TUI/CLI| UI[Interface FazAI]
  UI --> API[FazAI API/Daemon]
  API --> CTRL[Plano de controle (orquestração)]
  CTRL --> PROV[Provider de IA (sessão persistente)]
  CTRL --> RAG[Contexto (Qdrant/Context7/KB)]
  CTRL --> EVT[Bus de eventos/telemetria]
  CTRL --> PLAY[Playbooks/Workflows]
  CTRL --> SEC[Segredos/RBAC/Auditoria]

  CTRL -->|HTTPS/API| OPN[OPNsense (REST/configd)]
  CTRL -->|SSH/Agent| LNX[Linux Nodes]
  OPN --> TEL_OPN[Logs/Suricata/Estatísticas]
  LNX --> TEL_LNX[Logs/Métricas/Serviços]
  TEL_OPN --> EVT
  TEL_LNX --> EVT
  RAG -. feedback .-> CTRL
•	Plano de controle: orquestra ações, coordena sessões de IA, impõe “uma ação por iteração” e valida resultados.
•	Plano de dados (telemetria): coleta métricas, logs e alertas (stream) para dashboards e decisões do agente.
•	Conectividade dual: OPNsense via API nativa; Linux via SSH e/ou agente leve.
Agentes e conectividade
OPNsense (sem instalação local)
•	Autenticação: chave/segredo de API com perfis específicos; TLS mTLS opcional.
•	Ações típicas:
o	Firewall: aliases, regras, NAT, schedules, apply/reload.
o	IDS/IPS: Suricata (regras, políticas, drop/alert), atualizações.
o	DNS/Resolver: Unbound/dnsmasq, overrides, DNSBL.
o	VPN: WireGuard/OpenVPN peers e ACLs.
o	Sistema: interfaces, gateways, rotas, serviços, backups, config.xml..
•	Execução: chamadas REST/configd idempotentes; “dry-run” quando suportado; delta-diffs do config.
Linux (com agente leve ou SSH)
•	Modo agente (recomendado):
o	Funções: inventário (CPU/RAM/distro), métricas, logs, execução de ações, coleta de resultados.
o	Canal: WebSocket/SSE outbound (sem portas abertas), com assinatura de mensagens e fila local.
•	Modo SSH (fallback/rápido):
o	Ações: systemd, pacotes, firewall (nftables/iptables), serviços (Nginx/Postfix/Suricata), arquivos e permissões.
o	Segurança: chaves dedicadas; restrições por “forced commands” (quando decidirmos endurecer).
Modelo de dados de inventário
•	Organização → Site/Região → Cluster/Grupo → Nó/Dispositivo → Serviços → Agentes.
•	Metadados-chave: SO/versão, papéis (edge, core, mail, proxy), etiquetas (zona, compliance), chaves/API.
Monitoramento e telemetria
Coleta e normalização
•	OPNsense: métricas do sistema, status dos serviços, Suricata (eve.json via API/log pull), firewall hits, filas de NAT.
•	Linux: CPU, memória, disco, rede (RX/TX/pps), status systemd, filas de mail/proxy, IDS/IPS locais.
•	Logs estruturados: normalização (JSON), correlação por sessão/ação, enriquecimento (GeoIP/reputação) quando aplicável.
Dashboards essenciais
•	Visão geral (fleet):
o	Saúde: up/down, alertas críticos.
o	Segurança: eventos por severidade, top origens/destinos, blocos recentes.
o	Mudanças: últimas ações aplicadas, status e rollbacks.
•	Nível OPNsense:
o	Firewall: top regras acionadas, drops/accepts por intervalo, aliases dinâmicos.
o	IDS/IPS: alertas por assinatura/política, taxa de drops, atualização de regras.
o	Sistema: carga, estado das interfaces, rotas/gateways.
•	Nível Linux:
o	Serviços: uptime e status, erros recentes, portas expostas.
o	Desempenho: CPU, memória, I/O, rede, p95.
o	Segurança: Suricata/Auditd falhas, tentativas SSH, listas de bloqueio.
Linha do tempo operacional
•	Eventos: cada ação do FazAI, com tokens, comando aplicado, diffs de config, logs e resultado.
•	Replays: reproduz stream de uma sessão para auditoria/treinamento.
Interfaces de administração
Web (SPA) e TUI/CLI sincronizados
•	Lista de nós: filtros por org/site/papel/saúde; ações em massa.
•	Detalhe do nó:
o	Aba Visão Geral: saúde, últimas ações, alertas.
o	Aba Segurança: Suricata/Firewall/DNSBL (OPNsense); IDS/Firewall (Linux).
o	Aba Configuração: visual diffs (antes/depois), histórico de versões.
o	Aba Sessões de IA: transcrições, plano, ações, logs e observações.
•	Compositor de políticas:
o	Firewall/IPS: regras, prioridades, grupos, “what-if” (simulação).
o	Atualizações: janelas de manutenção, canary, ordem de implantação.
•	Playbooks: fluxo gráfico (drag-and-drop) para automações e correções.
UX de execução em tempo real
•	Painel de sessão: tokens do modelo (stream), ação decidida, logs STDOUT/STDERR, observação e botão “aprovar/abortar”.
•	Confirmações inteligentes: ações destrutivas pedem toque; políticas podem autoaprovar sob critérios.
Automação, workflows e conhecimento
Ciclo de ação seguro
•	Planejar: o FazAI propõe plano (curto).
•	Simular: para OPNsense, valida config; para Linux, “lint/check” de arquivos/reglas.
•	Executar: uma ação por iteração, logs em tempo real.
•	Observar: diffs/estados; decide próximo passo.
•	Rollback: snapshots de config (OPNsense) e backup de arquivos/RC (Linux).
Geração dinâmica de ferramentas
•	Quando necessário: o FazAI emite ToolSpec (contrato), gera o código, carrega, executa e valida.
•	Reutilização: soluções validadas vão para o KB; recomposição rápida no futuro.
Base de conhecimento (KB)
•	Estrutura: título, tags, SO/versão, serviço, snippet, status (verified), fonte (local/web).
•	Uso: RAG prioriza “verified” e contexto similar; acelera novas execuções.
•	Curadoria: promoção de ferramentas geradas a “estáveis” conforme decisão do operador.
Playbooks e eventos
•	Disparadores: alerta (Suricata), anomalia (métrica), alteração de estado.
•	Ações: bloquear IP/ASN, ajustar regra, abrir incidente, notificar, criar exceção temporária, executar teste.
Segurança, RBAC e multi tenancy
•	Identidades e acesso:
o	RBAC granular: organização/site/nó/serviço/ação; perfis (viewer, operator, approver, admin).
o	SSO: integração futura (IdP).
•	Segredos: cofre isolado (chaves API OPNsense, SSH, webhooks).
•	Auditoria: trilhas completas por sessão/ação, com diffs e logs.
•	Isolamento multi tenant: segregação lógica por org; limites e quotas (execuções, nós, throughput).
Plano de implantação
MVP (foco em funcionamento)
•	Conectar OPNsense: cadastro de instâncias (URL, key/secret); operações base (regras firewall, apply/reload, Suricata update).
•	Conectar Linux: SSH com chave; inventário e execução de comandos básicos; coleta de métricas/logs essenciais.
•	Sessão de IA: streaming em tempo real, contrato JSON, uma ação por iteração.
•	Dashboards básicos: saúde do fleet, eventos de segurança, últimas mudanças.
•	KB inicial: registrar soluções aplicadas e resultados.
Fase 2 (fortalecer operação)
•	Agente Linux dedicado: canal outbound com SSE/WebSocket, buffer offline.
•	Playbooks: orquestração com aprovações; canary e rollout progressivo.
•	Simulação/“what if”: preflight para regras firewall/IPS.
•	UI avançada: compositores, replays, filtros ricos.
Fase 3 (escala e inteligência)
•	Autonomia assistida: o FazAI pode executar correções sob políticas pré acordadas.
•	Roteador de modelos: fallback/arbitragem quando a solução local empacar.
•	Anomalia/Previsão: heurísticas e alertas proativos.
Fluxos exemplares
Mudança de regra no OPNsense (simular → aplicar → validar)
mermaid
sequenceDiagram
  participant UI as UI/CLI
  participant API as FazAI API
  participant OPN as OPNsense
  UI->>API: Propor regra (bloquear /24 suspeito)
  API->>OPN: POST /firewall/alias + POST /firewall/rule (dry-run)
  OPN-->>API: Validação OK
  API->>OPN: Apply (configd action)
  OPN-->>API: Resultado + logs
  API-->>UI: Diff + status + métricas de hits
Resposta automática a alerta Suricata (OPNsense → bloqueio → notificação)
mermaid
sequenceDiagram
  participant OPN as OPNsense (Suricata)
  participant EVT as Bus eventos
  participant API as FazAI
  participant LNX as Linux/Firewall
  OPN-->>EVT: Alert(severity=high, src=IP)
  EVT->>API: Enriquecer (GeoIP/Reputação)
  API->>OPN: Add alias/Rule drop IP
  API->>LNX: (Opcional) Propagar bloqueio no edge
  API-->>Admin: Notificação (email/webhook)
  API-->>KB: Registrar decisão (verified)
O que torna o FazAI diferente
•	Operação em tempo real: você vê o sistema pensar, decidir e agir no seu terminal (e no painel).
•	Sem caixa de ferramentas fixa: quando precisa, ele cria a própria ferramenta, executa e aprende com o resultado.
•	Unificação de mundos: OPNsense e Linux sob o mesmo comando — com segurança, rastreabilidade e autonomia crescente.
•	Aprendizado acumulado: cada mudança bem-sucedida vira conhecimento reutilizável, acelerando operações futuras.
Se quiser, eu já preparo rascunhos da UI (wireframes) para:
•	Painel “Fleet Overview”
•	Detalhe de OPNsense (Firewall/Suricata)
•	Sessão ao vivo (stream)
•	Compositor de políticas (firewall/IDS/updates)
E, em paralelo, um roteiro de testes reais (mudança de regra, alerta IPS, rollout de atualização) para provar o ciclo completo em produção-controlada.


INTERFACE CLIENTE-SERVIDOR

Arquitetura cliente-servidor
mermaid
graph TD
  UI[UI Web / CLI / TUI] --> API[FazAI API (Control Plane)]
  API --> KB[Qdrant / Context7 / Config]
  API <-->|mTLS WS/SSE| AG[Agentes Linux (Outbound)]
  API <-->|HTTPS/mTLS| OPN[OPNsense (REST/configd)]
  API --> EVT[Bus de eventos]
  AG --> TEL[Telemetria (métricas/logs)]
  OPN --> TEL
  TEL --> API
•	Ponto único: API do FazAI é o plano de controle. Tudo passa por ela: comandos, sessões de IA, telemetria e auditoria.
•	Clientes: agentes Linux outbound e conectores OPNsense via REST; ambos falam com o mesmo contrato de mensagens.
Conectividade e protocolos
•	Canal agentes Linux (recomendado):
o	Transporte: WebSocket sobre HTTP/2 com mTLS; fallback SSE para redes restritivas.
o	Padrões: RPC leve (comandos) + streams (logs/telemetria).
o	Direção: outbound do agente para a API (não exige portas abertas).
•	Conector OPNsense:
o	Transporte: HTTPS REST/configd nativos do OPNsense com API key/secret; opcional mTLS.
o	Execução: chamadas idempotentes; “dry-run” quando disponível; diffs de config.
•	Sessões de IA (terminal e web):
o	Streaming: SSE para o CLI/UI (tokens, ações, logs, observações).
o	Controle: uma ação por iteração; abort assíncrono.
•	Serialização:
o	Mensagens: JSON com versões (v, kind) e IDs correlacionados.
o	Compressão: permessage-deflate no WS; gzip nas rotas REST.
Segurança e onboarding
•	Identidade do nó:
o	Âncoras: machine-id/TPM/UUID + hostname + fingerprint do agente.
o	Certificados: CSR no primeiro contato; CA interna assina e devolve mTLS (renovação automática).
o	Tags: org, site, papel (edge, mail, web), zona (DMZ/core), compliance.
•	Autorização:
o	RBAC: papéis por organização/site/nó/ação (viewer, operator, approver, admin).
o	Tokens: JWT de curta duração para UI/CLI; mTLS para agentes.
o	Segredos: cofre central (chaves OPNsense, credenciais SSH, webhooks) com rotação.
•	Onboarding (enrollment):
o	Passo 1: gerar bootstrap token no FazAI UI/CLI.
o	Passo 2: instalar agente “fazai-agent” no Linux, apontando para a API, envia CSR + inventário.
o	Passo 3: aprovação no painel; políticas e perfis aplicados; canal WS estabelecido.
APIs e modelo de dados
•	Northbound (UI/CLI → API):
o	/agent/sessions: criar/retomar sessão de IA.
o	/agent/generate (SSE): stream de tokens/ações/logs/observações.
o	/nodes: CRUD de nós, rótulos, credenciais, capacidade.
o	/actions: disparo de comandos/playbooks (assíncrono).
o	/telemetry/queries: gráficos e séries.
o	/policy: regras (firewall/IPS/atualizações), simulação, aprovação.
•	Southbound (Agente → API, WS):
o	hello: handshake com versão/capacidades.
o	heartbeat: liveness + carga.
o	telemetry.push: métricas/logs/alerts (batch).
o	command.exec: requisição da API; resposta stream de stdout/stderr + exit code.
o	file.diff/apply: patch de config com pré-validação.
o	tool.codegen/run: gerar e executar ferramentas sob demanda.
•	Esquema de mensagens (exemplo):
json
{
  "v": 1,
  "kind": "command.exec",
  "id": "act_7f3a",
  "node": "srv-ops-01",
  "corr": "sess_f1c2", 
  "spec": { "shell": "dnf -y install suricata", "timeout": 900 }
}
•	Entidades principais:
o	Node: identidade, capacidades, agente, estado.
o	Session: turnos de IA, histórico, KV-cache lógico.
o	Action: comando/playbook com estado (queued, running, done, failed).
o	Event: telemetria e logs com correlação.
o	Policy/Playbook: automações, critérios e aprovações.
o	Credential/Secret: materiais sensíveis com rotação.
Agente no cliente (Linux) e conector OPNsense
•	Agente Linux (serviço):
o	Módulos: inventário, exec, arquivos/diff, serviços, firewall, IDS/IPS, coleta (métricas/logs).
o	Fila local: buffer em disco (store and forward) para telemetria/ações offline.
o	Resiliência: reconexão exponencial, backoff, deduplicação por action_id.
o	Segurança: mTLS, escopo de permissões (endurecer depois), sandbox opcional futura.
•	Conector OPNsense (server-side):
o	Operações: aliases, rules/NAT, Suricata (rulesets/policies), system (backup/config).
o	Validação: parse de diffs; rollback via backup automático.
o	Modelo idempotente: “aplicar estado desejado” e confirmar com leitura.
•	Anúncio de capacidades:
o	Hello: { os, distro, versions, modules, limits } para roteamento de ações.
o	Feature flags: habilitam/parametrizam codegen e execuções específicas.
Confiabilidade, observabilidade e escala
•	Confiabilidade:
o	Idempotência: action_id + idempotency_key; replays não duplicam efeitos.
o	Retentativas: exponencial com jitter; circuit breaker por tipo/host.
o	Backpressure: créditos no WS; limites por nó/organização; priorização de filas.
o	Timeouts: por ação e sessão; limites de iterações.
•	Observabilidade:
o	Métricas: tempo até primeiro token, tokens/s, taxa de sucesso por ação, latência WS, buffers, uso de CPU/RAM dos agentes.
o	Logs estruturados: JSON com corr e session_id; níveis por componente.
o	Traços: spans por ação (planejar, executar, observar, commit_kb).
o	Auditoria: trilha completa (quem, quando, o quê, antes/depois, resultado).
•	Escala e topologia:
o	Multi região ativo/ativo: API com replicação; agentes conectam ao ponto mais próximo.
o	Shard por organização: isolamento lógico; cotas de throughput e armazenamento.
o	Armazenamento:
	Config/estado: banco relacional.
	Telemetria: time series/columnar.
	KB: Qdrant (vetorial).
o	Fila/eventos: broker leve para fan out de telemetria e notificações.
Fluxos essenciais (exemplos)
mermaid
sequenceDiagram
  participant A as Agente Linux
  participant API as FazAI API
  participant UI as UI/CLI
  UI->>API: Criar sessão de IA / Disparar ação
  API->>A: command.exec (id: act_123)
  A-->>API: stream stdout/stderr + exit_code
  API-->>UI: SSE tokens/ação/logs/observe
  API->>API: Registrar diffs + auditoria + métricas
mermaid
sequenceDiagram
  participant UI as UI/CLI
  participant API as FazAI API
  participant O as OPNsense
  UI->>API: Nova regra IPS (simular)
  API->>O: configd dry-run
  O-->>API: OK + diff
  UI->>API: Aprovar
  API->>O: Apply
  O-->>API: Resultado + logs
  API-->>UI: Status + validação pós-aplicação
Passo a passo de implantação (resumo)
•	Servidor (FazAI API):
o	Configurar: endpoints /agent, /nodes, /actions, /telemetry, /policy; SSE/WS habilitados; CA interna para mTLS.
o	Persistência: banco (estado), timeseries (telemetria), Qdrant (KB).
•	Clientes Linux:
o	Instalar agente: binário/serviço com bootstrap token; estabelece WS mTLS outbound.
o	Aprovar: no painel, aplicar rótulos e políticas.
o	Operar: disparar ações, abrir sessões de IA, acompanhar stream.
•	OPNsense:
o	Cadastrar instâncias: URL + key/secret (ou mTLS); validar acesso.
o	Executar: simulação/aplicação de mudanças, coleta de métricas e alertas.
•	UI/CLI:
o	Usar sessão ao vivo: ver tokens/ações/logs.
o	Playbooks/Políticas: compor, simular, aprovar e aplicar.
o	Dashboards: saúde, segurança, mudanças e auditoria.
Com esses blocos, conectar um sistema cliente servidor ao FazAI fica direto: há um ponto único de controle, canais outbound seguros para os clientes, contratos estáveis de mensagens, e toda a inteligência (planejamento, execução e aprendizagem) centralizada — transparente e auditável.

Visão geral do agente FazAI e detalhamentos de funcionalidades com um exemplo de execução para parametros
O agente opera como um orquestrador cognitivo persistente: ele mantém sessões com KV cache do modelo, recupera contexto vivo (Qdrant, Context7, estado do sistema), planeja em turnos, emite ações estruturadas (JSON por linha), executa uma ação por iteração, observa resultados (logs/diffs), aprende (KB) e repete — tudo com streaming em tempo real no shell.
Componentes
•	CLI (fazai): inicia/retoma sessões de agente, abre um stream SSE, imprime tokens/ações/logs/observações em tempo real, e encaminha respostas do usuário quando solicitado.
•	Daemon (main.js): orquestra o ciclo Pensar → Agir → Observar. Monta contexto, chama o provedor do modelo, interpreta o protocolo ND JSON, executa ações (shell/geração de tool/pesquisa), injeta observações e fecha a iteração.
•	Provider do modelo (gemma worker.js): cliente Node que conversa com um worker residente via socket Unix, expondo createSession/generateStream/abort/destroySession com streaming de tokens.
•	Worker Gemma (C++ com libgemma.a): processo residente que carrega o modelo uma vez, gerencia múltiplas sessões com KV cache e fornece geração em fluxo, com cancelamento assíncrono.
•	Recuperação de contexto: consulta Qdrant (memória operacional/KB), Context7 (documentos/trechos) e estado recente (logs/diffs/telemetria).
•	Pesquisa e fallback: quando o contexto local não basta, o agente emite “research”; se ficar empacado, um “árbitro” externo pode decidir/patchar.
•	Síntese dinâmica de ferramentas: a cada necessidade, o agente emite um ToolSpec; o daemon gera código na hora, carrega dinamicamente e executa.
•	Base de conhecimento (KB/Qdrant): decisões, patches e soluções verificadas são registradas (com metadados) para reuso futuro.
Fluxo ponta a ponta no shell
1.	Disparo:
o	Comando: fazai agent "cria um servidor de email somente relay com antispam e antivirus..."
o	Efeito: o CLI cria/retoma uma sessão no daemon e abre um stream SSE.
2.	Preparação de contexto:
o	Recuperação: daemon busca top k no Qdrant (soluções/decisões), puxa trechos do Context7 e coleta estado atual (serviços/portas/logs).
o	Prompt: constrói um prompt com regras do protocolo (ND JSON; uma ação por iteração), objetivo e contexto.
3.	Geração em sessão persistente:
o	Provider: envia o prompt ao worker via socket; recebe tokens conforme gerados (streaming).
o	CLI: imprime tokens “ao vivo”, como um coder.
4.	Detecção de ação (ND JSON):
o	Parser: o daemon detecta linhas JSON completas dentro do stream de tokens.
o	Ação: Plan/Ask/Research/Shell/ToolSpec/UseTool/Observe/CommitKB/Done.
5.	Execução controlada (uma ação):
o	Shell: executa o comando como root, streamando stdout/stderr.
o	ToolSpec → UseTool: gera código conforme spec, grava em _generated/, carrega e executa; streama logs.
o	Research: consulta fontes online e retorna resumo/links.
o	Ask: pausa para perguntar no CLI (ou aplica defaults).
o	CommitKB: registra a solução/decisão no Qdrant.
6.	Observação e iteração:
o	Observe: o daemon envia um resumo/diff do que mudou.
o	Done: encerra a iteração (não a sessão), permitindo próxima rodada até alcançar o objetivo.
7.	Autonomia com telemetria:
o	Ingestão: eventos/telemetria entram como contexto adicional.
o	Decisão: o agente pode continuar sem intervenção se a política permitir.
Sessão do modelo e streaming
•	Inicialização única: o worker carrega pesos/tokenizer da libgemma.a uma vez e fica residente.
•	Sessões: cada objetivo MCPS tem um session_id com KV cache próprio, reduzindo latência entre turnos.
•	Geração por token: callback por token envia pedaços de texto para o provider; o daemon transmite via SSE para o CLI.
•	Cancelamento: um sinal de abort interrompe a decodificação no worker e fecha a rodada no daemon/CLI.
•	Parâmetros: temperatura, top_p, repeat_penalty, max_tokens são configuráveis por sessão.
Recuperação de contexto e construção do prompt
•	Fontes de contexto:
o	Qdrant: memória operacional (decisões, patches, configs validadas, status verified/unverified, tags).
o	Context7: trechos documentais técnicos (configurações, melhores práticas, snippets).
o	Estado: inventário, serviços ativos, portas, erros recentes, diffs de arquivos.
•	Montagem do prompt:
o	Regras do protocolo: responder somente ND JSON; uma ação por iteração; shell em linha única; emitir ToolSpec antes de UseTool; usar Research/Ask em caso de ambiguidade; observar e concluir com Done.
o	Blocos: regras; contexto sintetizado (bullets curtos/pragmáticos); histórico mínimo da sessão; objetivo textual; instrução “saída: JSON por linha”.
•	Efeito prático: o modelo emite ação estruturada cedo (após um curto Plan), acelerando o laço Pensar → Agir → Observar.
Protocolo de ações (ND JSON) e executores
•	Plan:
o	Uso: organizar os próximos passos.
o	Executor: apenas exibe no CLI; não executa nada.
•	Ask:
o	Uso: ambiguidade (ex.: relayhost, domínios, faixas IP).
o	Executor: pergunta no CLI; resposta entra como histórico na próxima chamada.
•	Research:
o	Uso: lacuna de conhecimento local; versões/distro específicas.
o	Executor: busca e resume; devolve docs (title/url/snippet) e injeta no contexto da próxima rodada.
•	Shell:
o	Uso: ações diretas (instalar pacotes, editar arquivos, systemctl, firewall).
o	Executor: spawn “bash -lc” como root, com streaming de stdout/stderr e código de saída; injeta resultado para Observe.
•	ToolSpec:
o	Uso: quando uma capacidade repetível é necessária (configurar Postfix relay, integrar rspamd, etc.).
o	Executor: codegen dinâmico:
	Geração: usa LLM local; se falhar nos testes diffs/logs, tenta patch; se persistir, aciona fallback (árbitro).
	Hot load: salva em /opt/fazai/tools/_generated/<sessão>/<toolName>.mjs; registra para UseTool.
	Idempotência: o spec exige comportamento idempotente e logging de diffs.
•	UseTool:
o	Uso: invocar a ferramenta recém gerada/carregada.
o	Executor: executa a tool em Node (ou via MCP), streama logs, injeta observações.
•	Observe:
o	Uso: resumir o que foi feito e qual próximo passo técnico.
o	Executor: exibe e fecha a iteração.
•	CommitKB:
o	Uso: cristalizar uma solução/decisão como conhecimento reutilizável.
o	Executor: gera embedding, upsert no Qdrant com metadados (tags, os, versions, source, status).
•	Done:
o	Uso: objetivo atingido ou rodada concluída em estado terminal.
o	Executor: encerra a iteração (podendo manter a sessão para ações subsequentes).
Memória operacional e base de conhecimento
•	Estrutura: cada item contém título, tags, snippet, status (verified/unverified), source (local/web/fallback), timestamp, e opcionalmente diffs e resultados de teste (ex.: GTUBE/EICAR para e mail).
•	Ingestão: CommitKB é acionado pelo modelo ou pelo daemon após sucesso validado.
•	Recuperação: top k por similaridade textual do objetivo e do estado atual; o agente prioriza itens “verified” e recentes.
•	Efeito: com o tempo, o agente fica mais rápido e determinístico em ambientes semelhantes.
Concurrency, confiabilidade e observabilidade
•	Sessões e fila:
o	Sessões paralelas: cada objetivo tem session_id e KV cache próprio.
o	Fila por modelo: se necessário, um pool regula concorrência para evitar saturação de CPU.
•	Tempo de vida e limites:
o	Iterações: limite de iterações por objetivo (ex.: 32) para evitar loops infinitos.
o	Timeouts: por ação (shell, research, codegen) e por geração do modelo.
•	Abort/recuperação:
o	Abort: Ctrl C no CLI envia abort; worker interrompe geração; daemon limpa a rodada.
o	Recuperação: se uma ação falhar, logs entram no contexto e o agente propõe correção ou research.
•	Métricas e logs:
o	Métricas: tokens/s, TTLB (tempo até primeiro token), sessões ativas, ações executadas, taxa de sucesso/falha, origem da solução (local/fallback).
o	Logs: stream no CLI + arquivos persistentes (execuções, diffs, erros); úteis para auditoria e melhoria contínua.
Configuração, implantação e extensibilidade
•	Config chave:
o	[ai_provider]: provider = gemma worker.
o	[gemma_worker]: socket, caminho do modelo, threads, temperature/top_p/repeat_penalty.
o	[agent]: stream = sse, max_iterations, action_per_iteration, fallback_enabled.
•	Implantação:
o	Worker: binário C++ linkado à libgemma.a, iniciado por systemd; usa socket Unix em /run/fazai/gemma.sock.
o	Daemon: expõe /agent/sessions, /agent/generate (SSE), /agent/abort; integra retrieval/research/codegen/KB.
o	CLI: subcomando “agent” conectado às rotas SSE, com render de tokens/ações/logs.
•	Extensões:
o	UI Web: espelhar SSE em WebSocket; dashboards por sessão (plan/actions/logs/observe), replays e controles (abort, next turn).
o	Rede de agentes: MCP/HTTP entre servidores para orquestração distribuída.
o	Política de fallback: roteamento adaptativo por tipo de tarefa (planejamento vs. código vs. diagnóstico).


