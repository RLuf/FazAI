(function () {
  const STORAGE_KEY = 'fazai-ops-desktop-v1';
  const API_BASE = window.FAZAI_OPS_API || 'http://localhost:5050';

  const apps = {
    graylog: {
      title: 'Graylog Monitor',
      icon: '🄶',
      content: '<iframe src="http://localhost:9000" frameborder="0"></iframe>'
    },
    grafana: {
      title: 'Grafana Dashboards',
      icon: '🅶',
      content: '<iframe src="http://localhost:3000" frameborder="0"></iframe>'
    },
    loki: {
      title: 'Loki Explorer',
      icon: '🅻',
      content: '<div class="placeholder">Integração Loki pendente</div>'
    },
    promtail: {
      title: 'Promtail Streams',
      icon: '🅿',
      content: '<div class="placeholder">Logs em tempo real</div>'
    },
    mikrotik: {
      title: 'MikroTik Monitor',
      icon: '🅼',
      content: '<div class="network-app">\n        <section class="app-section">\n          <h4>Ping MikroTik</h4>\n          <form data-action="ping">\n            <input name="target" placeholder="Host/IP" required />\n            <button>Ping</button>\n          </form>\n          <pre class="network-output" data-output="ping"></pre>\n        </section>\n        <section class="app-section">\n          <h4>Winbox / SSH</h4>\n          <div class="vnc-links">\n            <input id="mikrotik-host" placeholder="host:porta" />\n            <button data-link="winbox">Winbox</button>\n            <button data-link="ssh">SSH</button>\n          </div>\n        </section>\n      </div>',
      init: initMikrotik
    },
    opnsense: {
      title: 'OPNsense API',
      icon: '🄾',
      content: '<div class="opnsense-app">\n        <section class="opn-section">\n          <header class="opn-section-header">\n            <h4>Servidores OPNsense</h4>\n            <button id="opn-refresh">Atualizar</button>\n          </header>\n          <form id="opn-server-form">\n            <div class="opn-field-group">\n              <label>Nome\n                <input name="name" placeholder="Apelido" />\n              </label>\n              <label>URL Base\n                <input name="baseUrl" placeholder="https://opnsense.local" required />\n              </label>\n              <label>Verificar TLS\n                <select name="verifyTls"><option value="true">Sim</option><option value="false" selected>Não</option></select>\n              </label>\n            </div>\n            <div class="opn-field-group">\n              <label>API Key\n                <input name="key" placeholder="API Key" required />\n              </label>\n              <label>API Secret\n                <input name="secret" placeholder="API Secret" required />\n              </label>\n            </div>\n            <label>Notas\n              <input name="notes" placeholder="Observações" />\n            </label>\n            <div class="opn-actions">\n              <button type="submit">Salvar Servidor</button>\n            </div>\n          </form>\n          <div class="opn-servers" id="opn-servers-list"></div>\n        </section>\n        <section class="opn-section">\n          <header class="opn-section-header">\n            <h4>Operações</h4>\n            <div class="opn-sub-actions">\n              <select id="opn-server-select"></select>\n              <button id="opn-users-btn">Usuários</button>\n              <button id="opn-vpn-btn">VPN</button>\n              <button id="opn-fw-btn">Firewall</button>\n              <button id="opn-system-log-btn">Log Sistema</button>\n              <button id="opn-fw-log-btn">Log Firewall</button>\n              <button id="opn-packages-btn">Pacotes</button>\n              <button id="opn-interfaces-btn">Interfaces</button>\n              <button id="opn-routes-btn">Rotas</button>\n            </div>\n          </header>\n          <form id="opn-user-form">\n            <div class="opn-field-group">\n              <label>Usuário\n                <input name="username" placeholder="usuário" required />\n              </label>\n              <label>Nome completo\n                <input name="fullname" placeholder="Nome" />\n              </label>\n              <label>Email\n                <input name="email" placeholder="email" />\n              </label>\n            </div>\n            <label>Senha\n              <input name="password" type="password" placeholder="Senha" required />\n            </label>\n            <div class="opn-actions">\n              <button type="submit">Criar Usuário</button>\n            </div>\n          </form>\n          <form id="opn-firewall-form">\n            <div class="opn-field-group">\n              <label>Interface\n                <input name="interface" placeholder="wan" required />\n              </label>\n              <label>Fonte\n                <input name="source" placeholder="any" />\n              </label>\n              <label>Destino\n                <input name="destination" placeholder="any" />\n              </label>\n            </div>\n            <label>Descrição\n              <input name="description" placeholder="Regra" />\n            </label>\n            <div class="opn-actions">\n              <button type="submit">Adicionar Regra</button>\n              <button type="button" id="opn-firewall-apply">Aplicar Firewall</button>\n            </div>\n          </form>\n          <form id="opn-request-form">\n            <div class="opn-field-group">\n              <label>Método\n                <input name="method" value="GET" />\n              </label>\n              <label>Endpoint\n                <input name="endpoint" value="/api/core/system/information" />\n              </label>\n            </div>\n            <label>Payload (JSON)\n              <textarea name="payload" rows="3" placeholder="{ }"></textarea>\n            </label>\n            <div class="opn-actions">\n              <button type="submit">Executar</button>\n            </div>\n          </form>\n          <pre class="opn-output" id="opn-output"></pre>\n        </section>\n      </div>',
      init: initOPNSense
    },
    spamexperts: {
      title: 'SpamExperts',
      icon: '🆂',
      content: '<div class="integrations-app"><form id="spamexperts-form">
          <input name="host" placeholder="https://api.spamexperts.com" required />
          <input name="endpoint" placeholder="/api/v2/user" />
          <input name="token" placeholder="API Key" required />
          <input name="method" placeholder="GET" value="GET" />
          <textarea name="body" placeholder="JSON opcional"></textarea>
          <button>Executar</button>
        </form><pre class="integrations-output" id="spamexperts-output"></pre></div>'
    },
    cloudflare: {
      title: 'Cloudflare Zero Trust',
      icon: '🄲',
      content: '<div class="cloudflare-app">\n        <section class="cf-section">\n          <header class="cf-section-header">\n            <h4>Contas Cloudflare</h4>\n            <button id="cf-account-refresh">Atualizar</button>\n          </header>\n          <form id="cf-account-form">\n            <div class="cf-field-group">\n              <label>Nome\n                <input name="name" placeholder="Apelido da conta" />\n              </label>\n              <label>Email\n                <input name="email" placeholder="Email (opcional)" />\n              </label>\n              <label>Account ID\n                <input name="accountId" placeholder="ID da conta" />\n              </label>\n            </div>\n            <label>API Token\n              <input name="token" placeholder="Token" required />\n            </label>\n            <label>Notas\n              <input name="notes" placeholder="Observações" />\n            </label>\n            <div class="cf-actions">\n              <button type="submit">Salvar Conta</button>\n            </div>\n          </form>\n          <div class="cf-accounts" id="cf-accounts-list"></div>\n        </section>\n        <section class="cf-section">\n          <header class="cf-section-header">\n            <h4>Zonas &amp; Registros</h4>\n            <div class="cf-sub-actions">\n              <select id="cf-account-select"></select>\n              <button id="cf-zones-refresh">Atualizar Zonas</button>\n            </div>\n          </header>\n          <div class="cf-zones" id="cf-zones-list"></div>\n          <form id="cf-zone-form">\n            <div class="cf-field-group">\n              <label>Domínio\n                <input name="name" placeholder="ex: dominio.com" required />\n              </label>\n              <label>Jump Start\n                <select name="jump_start"><option value="true" selected>Sim</option><option value="false">Não</option></select>\n              </label>\n              <label>Tipo\n                <input name="type" value="full" />\n              </label>\n              <label>Plano\n                <input name="plan" value="free" />\n              </label>\n            </div>\n            <div class="cf-actions">\n              <button type="submit">Criar Zona</button>\n            </div>\n          </form>\n          <form id="cf-record-form">\n            <div class="cf-field-group">\n              <label>Zona\n                <select name="zoneId" id="cf-zone-select" required></select>\n              </label>\n              <label>Tipo\n                <input name="type" value="A" required />\n              </label>\n              <label>Nome\n                <input name="name" placeholder="host" required />\n              </label>\n            </div>\n            <label>Conteúdo\n              <input name="content" placeholder="IP/Valor" required />\n            </label>\n            <div class="cf-field-group">\n              <label>TTL\n                <input name="ttl" type="number" value="1" min="1" />\n              </label>\n              <label>Priority\n                <input name="priority" type="number" placeholder="(opcional)" />\n              </label>\n              <label>Proxied\n                <select name="proxied"><option value="">Padrão</option><option value="true">Sim</option><option value="false">Não</option></select>\n              </label>\n            </div>\n            <div class="cf-actions">\n              <button type="submit">Criar Registro</button>\n            </div>\n          </form>\n          <pre class="cf-output" id="cf-record-output"></pre>\n        </section>\n        <section class="cf-section">\n          <header class="cf-section-header">\n            <h4>Usuários, Túneis &amp; Logs</h4>\n            <div class="cf-sub-actions">\n              <button id="cf-members-load">Usuários</button>\n              <button id="cf-tunnels-load">Túneis</button>\n              <button id="cf-logs-load">Logs</button>\n            </div>\n          </header>\n          <pre class="cf-output" id="cf-meta-output"></pre>\n        </section>\n        <section class="cf-section">\n          <header class="cf-section-header"><h4>Logs Locais</h4></header>\n          <pre class="cf-output" id="cf-local-logs"></pre>\n        </section>\n      </div>'
    },
    gemma: {
      title: 'Gemma ND-JSON',
      icon: '🄶',
      content: '<div class="gemma-app">
        <form id="gemma-form">
          <textarea name="prompt" rows="4" placeholder="Digite sua instrução"></textarea>
          <button>Enviar</button>
        </form>
        <pre class="gemma-output" id="gemma-output"></pre>
      </div>'
    },
    rag: {
      title: 'Memória RAG',
      icon: '🅁',
      content: '<div class="rag-app">\n        <section class="rag-section">\n          <header class="rag-section-header">\n            <h4>Ingestão de Conhecimento</h4>\n            <p>Carregue PDFs, DOC/DOCX, TXT ou exports JSON do GPT para ampliar a base.</p>\n          </header>\n          <form id="rag-upload-form" enctype="multipart/form-data">\n            <div class="rag-field-group">\n              <label>Coleção\n                <input name="collection" value="fazai_kb" list="rag-collections" placeholder="Coleção Qdrant" />\n              </label>\n              <label>Tags (vírgula)\n                <input name="tags" placeholder="ex: suporte, cliente" />\n              </label>\n            </div>\n            <label class="rag-file">Arquivos\n              <input type="file" name="files" multiple accept=".pdf,.doc,.docx,.txt,.md,.log,.json" />\n            </label>\n            <label>Texto adicional (opcional)\n              <textarea name="text" rows="4" placeholder="Cole aqui trechos ou JSON exportado"></textarea>\n            </label>\n            <div class="rag-actions">\n              <button type="submit">Indexar</button>\n            </div>\n          </form>\n          <pre class="rag-upload-output" id="rag-upload-output"></pre>\n        </section>\n        <section class="rag-section">\n          <header class="rag-section-header">\n            <h4>Consulta / Inferência</h4>\n            <p>Faça perguntas e recupere os trechos mais relevantes para compor respostas.</p>\n          </header>\n          <form id="rag-form">\n            <div class="rag-field-group">\n              <label>Coleção\n                <input name="collection" value="fazai_kb" list="rag-collections" placeholder="Coleção" />\n              </label>\n              <label>Limite\n                <input name="limit" type="number" value="5" min="1" max="20" />\n              </label>\n            </div>\n            <label>Pergunta / Query\n              <input name="query" placeholder="Pergunta" required />\n            </label>\n            <label>Filtrar por tags (vírgula)\n              <input name="filterTags" placeholder="ex: suporte" />\n            </label>\n            <div class="rag-actions">\n              <button type="submit">Pesquisar</button>\n            </div>\n          </form>\n          <div class="rag-results" id="rag-results"></div>\n        </section>\n        <section class="rag-section">\n          <header class="rag-section-header">\n            <h4>Catálogo Ingerido</h4>\n            <button id="rag-catalog-refresh">Atualizar</button>\n          </header>\n          <div class="rag-catalog" id="rag-catalog-list"></div>\n        </section>\n        <datalist id="rag-collections"></datalist>\n      </div>'
    },
    coherence: {
      title: 'Coherence Guard',
      icon: '🄲',
      content: '<div class="placeholder">Em desenvolvimento</div>'
    },
    terminal: {
      title: 'Console Virtual',
      icon: '⌘',
      content: '<div class="terminal-app">
        <form id="terminal-form">
          <input name="command" placeholder="Comando" autocomplete="off" required />
          <button>Executar</button>
        </form>
        <pre class="terminal-output" id="terminal-output"></pre>
      </div>',
      init: initTerminal
    },
    network: {
      title: 'Ferramentas de Rede',
      icon: '🛠',
      content: '<div class="network-app">
        <section class="app-section">
          <h4>Ping</h4>
          <form data-action="ping">
            <input name="target" placeholder="host ou IP" required />
            <button>Executar</button>
          </form>
          <pre class="network-output" data-output="ping"></pre>
        </section>
        <section class="app-section">
          <h4>Traceroute</h4>
          <form data-action="traceroute">
            <input name="target" placeholder="host ou IP" required />
            <button>Executar</button>
          </form>
          <pre class="network-output" data-output="traceroute"></pre>
        </section>
        <section class="app-section">
          <h4>Nmap</h4>
          <form data-action="nmap">
            <input name="target" placeholder="host ou range" required />
            <button>Executar</button>
          </form>
          <pre class="network-output" data-output="nmap"></pre>
        </section>
        <section class="app-section">
          <h4>Porta</h4>
          <form data-action="port">
            <input name="target" placeholder="host ou IP" required />
            <input name="port" placeholder="porta" required />
            <button>Verificar</button>
          </form>
          <pre class="network-output" data-output="port"></pre>
        </section>
      </div>',
      init: initNetwork
    },
    logs: {
      title: 'Logs & Tail',
      icon: '📜',
      content: '<div class="logs-app">
        <div class="logs-list">
          <select id="logs-select"></select>
          <button id="logs-refresh">Atualizar</button>
          <button id="logs-start">Iniciar Tail</button>
          <button id="logs-stop">Parar</button>
        </div>
        <pre class="log-output" id="logs-output"></pre>
      </div>',
      init: initLogs
    },
    docker: {
      title: 'Docker Manager',
      icon: '🐳',
      content: '<div class="docker-app">\n        <div class="docker-toolbar">\n          <div class="docker-actions-left">\n            <button id="docker-refresh">Atualizar agora</button>\n            <label>Auto\n              <select id="docker-refresh-interval">\n                <option value="0">Desligado</option>\n                <option value="5">5s</option>\n                <option value="15">15s</option>\n                <option value="30">30s</option>\n              </select>\n            </label>\n          </div>\n          <div class="docker-actions-right">\n            <span class="docker-hint">Métricas locais: CPU, memória, rede, IO</span>\n          </div>\n        </div>\n        <div id="docker-stats" class="docker-grid"></div>\n      </div>',
      init: initDocker
    },
    monitorBoard: {
      title: 'Painel de Monitoramento',
      icon: '🛰',
      content: '<div class="monitor-app">
        <form id="monitor-form">
          <input name="name" placeholder="Nome" required />
          <input name="target" placeholder="Host/IP" required />
          <select name="mode">
            <option value="ping">Ping</option>
            <option value="http">HTTP</option>
            <option value="port">Porta</option>
            <option value="snmp">SNMP</option>
          </select>
          <input name="port" placeholder="Porta (opcional)" />
          <input name="community" placeholder="Community SNMP" />
          <input name="oid" placeholder="OID SNMP" value=".1.3.6.1.2.1.1.1.0" />
          <button>Adicionar</button>
        </form>
        <div class="status-grid" id="monitor-grid"></div>
      </div>',
      init: initMonitorBoard
    },
    smtp: {
      title: 'SMTP & Alertas',
      icon: '✉',
      content: '<div class="smtp-app">
        <form id="smtp-form">
          <input name="host" placeholder="Servidor SMTP" required />
          <input name="port" placeholder="Porta" value="587" />
          <input name="user" placeholder="Usuário" />
          <input type="password" name="pass" placeholder="Senha" />
          <input name="from" placeholder="De" />
          <input name="to" placeholder="Para" required />
          <input name="subject" placeholder="Assunto" />
          <textarea name="text" rows="3" placeholder="Mensagem"></textarea>
          <label><input type="checkbox" name="secure" /> TLS/SSL</label>
          <button>Enviar Teste</button>
        </form>
        <pre class="smtp-output" id="smtp-output"></pre>
      </div>',
      init: initSMTP
    },
    notifications: {
      title: 'Plugins de Notificação',
      icon: '🔔',
      content: '<div class="integrations-app">\n        <section class="app-section">\n          <h4>Telegram</h4>\n          <form id="telegram-form">\n            <input name="botToken" placeholder="Bot Token" required />\n            <input name="chatId" placeholder="Chat ID" required />\n            <input name="text" placeholder="Mensagem" required />\n            <button>Enviar</button>\n          </form>\n        </section>\n        <section class="app-section">\n          <h4>Instagram (Graph API)</h4>\n          <form id="instagram-form">\n            <input name="accessToken" placeholder="Access Token" required />\n            <input name="igUserId" placeholder="IG User ID" required />\n            <input name="recipientId" placeholder="Recipient ID" required />\n            <input name="text" placeholder="Mensagem" required />\n            <button>Enviar</button>\n          </form>\n        </section>\n        <section class="app-section">\n          <h4>Ligação VoIP (Twilio)</h4>\n          <form id="voip-form">\n            <input name="accountSid" placeholder="Account SID" required />\n            <input name="authToken" placeholder="Auth Token" required />\n            <input name="from" placeholder="De" required />\n            <input name="to" placeholder="Para" required />\n            <input name="twiml" placeholder="<Response><Say>Alerta</Say></Response>" />\n            <button>Discar</button>\n          </form>\n        </section>\n        <pre class="integrations-output" id="notifications-output"></pre>\n      </div>',
      init: initNotifications
    },
    notes: {
      title: 'Notas Rápidas',
      icon: '🗒',
      content: '<div class="notes-app">\n        <form id="notes-form">\n          <textarea name="text" rows="3" placeholder="Escreva uma nota..." required></textarea>\n          <button>Salvar Nota</button>\n        </form>\n        <div class="notes-list" id="notes-list"></div>\n      </div>',
      init: initNotes
    },
    settings: {
      title: 'Configurações de Alertas',
      icon: '⚙',
      content: '<div class="integrations-app">\n        <form id="settings-form">\n          <fieldset>\n            <legend>SMTP</legend>\n            <label><input type="checkbox" name="smtp.enabled" /> Habilitar</label>\n            <input name="smtp.host" placeholder="Servidor SMTP" />\n            <input name="smtp.port" placeholder="Porta 587" />\n            <label><input type="checkbox" name="smtp.secure" /> TLS/SSL</label>\n            <input name="smtp.user" placeholder="Usuário" />\n            <input type="password" name="smtp.pass" placeholder="Senha" />\n            <input name="smtp.from" placeholder="De" />\n            <input name="smtp.to" placeholder="Destinatários (separados por vírgula)" />\n          </fieldset>\n          <fieldset>\n            <legend>Telegram</legend>\n            <label><input type="checkbox" name="telegram.enabled" /> Habilitar</label>\n            <input name="telegram.botToken" placeholder="Bot Token" />\n            <input name="telegram.chatIds" placeholder="Chat IDs (vírgula)" />\n          </fieldset>\n          <fieldset>\n            <legend>VoIP (Twilio)</legend>\n            <label><input type="checkbox" name="voip.enabled" /> Habilitar</label>\n            <input name="voip.accountSid" placeholder="Account SID" />\n            <input name="voip.authToken" placeholder="Auth Token" />\n            <input name="voip.from" placeholder="De" />\n            <input name="voip.to" placeholder="Destinos (vírgula)" />\n          </fieldset>\n          <button>Salvar Configurações</button>\n        </form>\n        <pre class="integrations-output" id="settings-output"></pre>\n      </div>',
      init: initSettings
    },
    notes: {
      title: 'Notas Rápidas',
      icon: '🗒',
      content: '<div class="notes-app">\n        <form id="notes-form">\n          <textarea name="text" rows="3" placeholder="Escreva uma nota..." required></textarea>\n          <button>Salvar Nota</button>\n        </form>\n        <div class="notes-list" id="notes-list"></div>\n      </div>',
      init: initNotes
    },
    ilo: {
      title: 'Cadastro ILO/DRAC',
      icon: '🖥',
      content: '<div class="ilo-app">
        <form class="ilo-form" id="ilo-form">
          <input name="name" placeholder="Nome" required />
          <input name="host" placeholder="Host" required />
          <input name="user" placeholder="Usuário" />
          <input type="password" name="password" placeholder="Senha" />
          <input name="type" placeholder="Tipo (ILO/DRAC)" />
          <button>Salvar</button>
        </form>
        <div class="terminal-output" id="ilo-list"></div>
      </div>',
      init: initILO
    },
    crawler: {
      title: 'Crawler de Rede',
      icon: '🌐',
      content: '<div class="crawler-app">
        <form id="crawler-form">
          <input name="range" value="192.168.0.0/24" placeholder="Range" />
          <select name="mode"><option value="quick">Rápido</option><option value="full">Completo</option></select>
          <button>Executar</button>
        </form>
        <pre class="crawler-output" id="crawler-output"></pre>
      </div>',
      init: initCrawler
    },
    qdrant: {
      title: 'Qdrant UI & Ferramentas',
      icon: '🧠',
      content: '<div class="qdrant-links">
        <a href="http://localhost:6333/dashboard" target="_blank">Abrir Dashboard Qdrant</a>
        <a href="https://github.com/qdrant/qdrant-ui" target="_blank">Instalar UI Static</a>
      </div>'
    },
    vnc: {
      title: 'Acesso Remoto',
      icon: '🖧',
      content: '<div class="vnc-links">
        <input id="vnc-host" placeholder="host:porta" />
        <button id="vnc-open">Abrir VNC</button>
        <button id="rdp-open">Abrir RDP</button>
      </div>',
      init: initVNC
    }
  };

  const appInitializers = {
    spamexperts: initSpamExperts,
    cloudflare: initCloudflare,
    gemma: initGemma,
    rag: initRag,
    terminal: initTerminal,
    network: initNetwork,
    logs: initLogs,
    docker: initDocker,
    monitorBoard: initMonitorBoard,
    mikrotik: initMikrotik,
    opnsense: initOPNSense,
    smtp: initSMTP,
    notifications: initNotifications,
    notes: initNotes,
    settings: initSettings,
    ilo: initILO,
    crawler: initCrawler,
    vnc: initVNC
  };

  const folderAutoOpenMap = {
    'folder-monitor': ['graylog', 'grafana', 'loki', 'promtail', 'monitorBoard'],
    'folder-apis': ['opnsense', 'spamexperts', 'cloudflare'],
    'folder-tools': ['terminal', 'network', 'logs'],
    'folder-integrations': ['smtp', 'notifications'],
    'folder-infra': ['ilo', 'crawler']
  };

  const defaultIcons = [
    { id: 'icon-graylog', type: 'app', app: 'graylog', label: 'Graylog' },
    { id: 'icon-grafana', type: 'app', app: 'grafana', label: 'Grafana' },
    { id: 'icon-loki', type: 'app', app: 'loki', label: 'Loki' },
    { id: 'icon-promtail', type: 'app', app: 'promtail', label: 'Promtail' },
    { id: 'icon-mikrotik', type: 'app', app: 'mikrotik', label: 'MikroTik' },
    { id: 'icon-opnsense', type: 'app', app: 'opnsense', label: 'OPNsense' },
    { id: 'icon-spamexperts', type: 'app', app: 'spamexperts', label: 'SpamExp' },
    { id: 'icon-cloudflare', type: 'app', app: 'cloudflare', label: 'Cloudflare' },
    { id: 'icon-gemma', type: 'app', app: 'gemma', label: 'Gemma' },
    { id: 'icon-rag', type: 'app', app: 'rag', label: 'RAG' },
    { id: 'icon-coherence', type: 'app', app: 'coherence', label: 'Coherence' },
    { id: 'icon-terminal', type: 'app', app: 'terminal', label: 'Console' },
    { id: 'icon-network', type: 'app', app: 'network', label: 'Rede' },
    { id: 'icon-logs', type: 'app', app: 'logs', label: 'Logs' },
    { id: 'icon-notes', type: 'app', app: 'notes', label: 'Notas' },
    { id: 'icon-docker', type: 'app', app: 'docker', label: 'Docker' },
    { id: 'icon-monitor-board', type: 'app', app: 'monitorBoard', label: 'Painel' },
    { id: 'icon-smtp', type: 'app', app: 'smtp', label: 'SMTP' },
    { id: 'icon-notify', type: 'app', app: 'notifications', label: 'Alertas' },
    { id: 'icon-settings', type: 'app', app: 'settings', label: 'Configs' },
    { id: 'icon-ilo', type: 'app', app: 'ilo', label: 'ILO/DRAC' },
    { id: 'icon-crawler', type: 'app', app: 'crawler', label: 'Crawler' },
    { id: 'icon-qdrant', type: 'app', app: 'qdrant', label: 'Qdrant' },
    { id: 'icon-vnc', type: 'app', app: 'vnc', label: 'VNC/RDP' },
    { id: 'folder-monitor', type: 'folder', label: 'Monitoramento' },
    { id: 'folder-apis', type: 'folder', label: 'APIs' },
    { id: 'folder-clientes', type: 'folder', label: 'Clientes' },
    { id: 'folder-tools', type: 'folder', label: 'Ferramentas' },
    { id: 'folder-integrations', type: 'folder', label: 'Integrações' },
    { id: 'folder-infra', type: 'folder', label: 'Infra' }
  ];

  const folderAssignments = {
    'folder-monitor': ['icon-graylog', 'icon-grafana', 'icon-loki', 'icon-promtail', 'icon-monitor-board'],
    'folder-apis': ['icon-opnsense', 'icon-spamexperts', 'icon-cloudflare'],
    'folder-clientes': ['icon-mikrotik'],
    'folder-tools': ['icon-terminal', 'icon-network', 'icon-logs', 'icon-notes', 'icon-docker', 'icon-vnc'],
    'folder-integrations': ['icon-smtp', 'icon-notify', 'icon-settings', 'icon-gemma', 'icon-rag', 'icon-coherence', 'icon-qdrant'],
    'folder-infra': ['icon-ilo', 'icon-crawler']
  };

  const desktopLayer = document.getElementById('desktop-layer');
  const startButton = document.getElementById('start-button');
  const newFolderButton = document.getElementById('new-folder-button');
  const startMenu = document.getElementById('start-menu');
  const taskbarWindows = document.getElementById('taskbar-windows');
  const clockEl = document.getElementById('clock');
  const avatarImg = document.getElementById('avatar');
  const avatarDockImg = document.getElementById('avatar-dock-img');
  const hologram = document.querySelector('.hologram');

  let state = loadState();
  let activeIconId = null;
  let windowsZ = 30;
  const openFolderWindows = new Map();
  const monitorRegistry = new Map();

  function loadState() {
    let stored = null;
    try {
      stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
    } catch (err) {
      stored = null;
    }
    const nextState = stored && stored.icons ? stored : { icons: [], folderCounter: 0 };

    defaultIcons.forEach((def) => {
      if (!nextState.icons.some((ic) => ic.id === def.id)) {
        nextState.icons.push({ ...def, x: null, y: null, folder: null });
      }
    });

    const iconMap = new Map(nextState.icons.map((ic) => [ic.id, ic]));
    Object.entries(folderAssignments).forEach(([folderId, children]) => {
      const folder = iconMap.get(folderId);
      if (folder) folder.type = 'folder';
      children.forEach((childId) => {
        const child = iconMap.get(childId);
        if (child) child.folder = folderId;
      });
    });

    nextState.folderCounter = nextState.folderCounter || 0;
    return nextState;
  }

  function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function autoLayout() {
    const rect = desktopLayer.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const icons = state.icons.filter((icon) => !icon.folder);
    const columnWidth = 120;
    const rowHeight = 110;
    let x = Math.max(40, rect.width - 140);
    let y = 40;

    icons.forEach((icon) => {
      icon.x = x;
      icon.y = y;
      y += rowHeight;
      if (y > rect.height - 140) {
        y = 40;
        x = Math.max(40, x - columnWidth);
      }
    });
  }

  function ensurePositions() {
    if (state.icons.some((icon) => !icon.folder && (typeof icon.x !== 'number' || typeof icon.y !== 'number'))) {
      autoLayout();
    }
  }

  function clampAllIcons() {
    const rect = desktopLayer.getBoundingClientRect();
    state.icons.filter((icon) => icon.folder === null).forEach((icon) => {
      const pos = clampToLayer(icon.x ?? 0, icon.y ?? 0, icon, rect);
      icon.x = pos.x;
      icon.y = pos.y;
    });
  }

  function renderDesktop() {
    ensurePositions();
    desktopLayer.innerHTML = '';
    state.icons.filter((icon) => icon.folder === null).forEach(createIconElement);
    refreshFolderWindows();
    saveState();
  }

  function createIconElement(icon) {
    const el = document.createElement('div');
    el.className = 'desktop-icon' + (icon.type === 'folder' ? ' folder' : '');
    el.dataset.id = icon.id;
    el.style.left = `${icon.x}px`;
    el.style.top = `${icon.y}px`;

    const iconFace = document.createElement('div');
    iconFace.className = 'icon';
    iconFace.textContent = icon.type === 'folder' ? '🗁' : (apps[icon.app]?.icon || '◎');
    const label = document.createElement('span');
    label.className = 'label';
    label.textContent = icon.label;

    el.appendChild(iconFace);
    el.appendChild(label);

    el.addEventListener('click', () => setActiveIcon(icon.id));
    el.addEventListener('dblclick', () => handleIconAction(icon));
    el.addEventListener('mousedown', (ev) => startDrag(ev, icon));

    if (icon.id === activeIconId) {
      el.classList.add('active');
    }

    desktopLayer.appendChild(el);
  }

  function setActiveIcon(id) {
    activeIconId = id;
    document.querySelectorAll('.desktop-icon').forEach((el) => {
      el.classList.toggle('active', el.dataset.id === id);
    });
  }

  function handleIconAction(icon) {
    if (icon.type === 'folder') openFolder(icon);
    else if (icon.type === 'app') openAppWindow(icon.app, icon.label);
  }

  let dragData = null;
  function startDrag(ev, icon) {
    ev.preventDefault();
    const el = ev.currentTarget;
    const startX = ev.clientX;
    const startY = ev.clientY;
    const layerRect = desktopLayer.getBoundingClientRect();
    const iconRect = el.getBoundingClientRect();
    const offsetX = startX - iconRect.left;
    const offsetY = startY - iconRect.top;

    function onMouseMove(moveEv) {
      const dx = moveEv.clientX - startX;
      const dy = moveEv.clientY - startY;
      if (!dragData && Math.hypot(dx, dy) < 4) return;
      if (!dragData) {
        dragData = { icon, el };
        el.classList.add('dragging');
      }
      const newLeft = moveEv.clientX - layerRect.left - offsetX;
      const newTop = moveEv.clientY - layerRect.top - offsetY;
      const clamped = clampToLayer(newLeft, newTop, icon, layerRect);
      el.style.left = `${clamped.x}px`;
      el.style.top = `${clamped.y}px`;
    }

    function onMouseUp(upEv) {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);

      if (!dragData) {
        setActiveIcon(icon.id);
        return;
      }

      el.classList.remove('dragging');
      const newLeft = upEv.clientX - layerRect.left - offsetX;
      const newTop = upEv.clientY - layerRect.top - offsetY;
      const finalPos = clampToLayer(newLeft, newTop, icon, layerRect);

      el.style.pointerEvents = 'none';
      const dropTarget = document.elementFromPoint(upEv.clientX, upEv.clientY);
      el.style.pointerEvents = '';
      const folderEl = dropTarget ? dropTarget.closest('.desktop-icon.folder') : null;

      if (folderEl && icon.type === 'app' && icon.id !== folderEl.dataset.id) {
        icon.folder = folderEl.dataset.id;
        icon.x = finalPos.x;
        icon.y = finalPos.y;
      } else {
        icon.folder = null;
        icon.x = finalPos.x;
        icon.y = finalPos.y;
      }

      dragData = null;
      renderDesktop();
    }

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }

  function clampToLayer(x, y, icon, layerRect) {
    const width = 96;
    const height = 90;
    const minX = 20;
    const minY = 20;
    const maxX = layerRect.width - width - 20;
    const maxY = layerRect.height - height - 20;
    return {
      x: Math.min(Math.max(x, minX), maxX),
      y: Math.min(Math.max(y, minY), maxY)
    };
  }

  function openAppWindow(appId, fallbackTitle) {
    const app = apps[appId];
    if (!app) return;
    openWindow(appId, app.title || fallbackTitle, app.content, { appId });
  }

  function buildFolderContent(folderId) {
    const items = state.icons.filter((icon) => icon.folder === folderId);
    if (!items.length) return '<div class="placeholder">Pasta vazia</div>';
    return `<div class="folder-items">${items
      .map((item) => {
        const openButton = item.type === 'app' ? `<button data-action="open" data-target="${item.app}">Abrir</button>` : '';
        return `<div class="folder-item" data-icon="${item.id}"><strong>${item.label}</strong><div class="folder-actions">${openButton}<button data-action="remove" data-target="${item.id}">Enviar à área de trabalho</button></div></div>`;
      })
      .join('')}</div>`;
  }

  function refreshFolderWindows() {
    document.querySelectorAll('.window[data-folder]').forEach((win) => {
      const folderId = win.dataset.folder;
      const body = win.querySelector('.window-body');
      body.innerHTML = buildFolderContent(folderId);
    });
  }

  function openFolder(folderIcon) {
    const windowId = `folder:${folderIcon.id}`;
    const existing = document.querySelector(`.window[data-folder="${folderIcon.id}"]`);
    if (existing) {
      existing.style.zIndex = ++windowsZ;
      existing.classList.remove('minimized');
      updateTaskbarState(windowId, true);
      return;
    }

    const content = buildFolderContent(folderIcon.id);
    const win = openWindow(windowId, folderIcon.label, content, { isFolder: true, folderId: folderIcon.id });
    openFolderWindows.set(folderIcon.id, win);

    const autoApps = folderAutoOpenMap[folderIcon.id];
    if (autoApps) {
      setTimeout(() => {
        autoApps.forEach((appId) => openAppWindow(appId, apps[appId]?.title || appId));
      }, 200);
    }
  }

  function openWindow(id, title, content, options = {}) {
    const existing = document.querySelector(`.window[data-app="${id}"]`);
    if (existing) {
      existing.style.zIndex = ++windowsZ;
      existing.classList.remove('minimized');
      updateTaskbarState(id, true);
      return existing;
    }

    const template = document.getElementById('window-template');
    const node = template.content.cloneNode(true);
    const windowEl = node.querySelector('.window');
    const bodyEl = node.querySelector('.window-body');
    const titleEl = node.querySelector('.window-title');

    windowEl.dataset.app = id;
    if (options.isFolder && options.folderId) {
      windowEl.dataset.folder = options.folderId;
    }

    titleEl.textContent = title;
    bodyEl.innerHTML = content;
    windowEl.style.top = `${120 + Math.random() * 120}px`;
    windowEl.style.left = `${180 + Math.random() * 160}px`;
    windowEl.style.zIndex = ++windowsZ;

    enableDrag(windowEl);
    enableResize(windowEl);
    registerWindowControls(windowEl);

    document.body.appendChild(windowEl);
    createTaskbarItem(id, title);

    if (options.isFolder) {
      bodyEl.addEventListener('click', (ev) => handleFolderAction(ev, options.folderId));
    }

    const app = apps[options.appId || id];
    if (app && typeof app.init === 'function') {
      const cleanup = app.init(bodyEl, windowEl);
      if (typeof cleanup === 'function') {
        windowEl.__cleanup = cleanup;
      }
    }

    return windowEl;
  }

  function handleFolderAction(ev, folderId) {
    const btn = ev.target.closest('[data-action]');
    if (!btn) return;
    const action = btn.dataset.action;
    const target = btn.dataset.target;
    if (action === 'open') {
      openAppWindow(target, target);
    } else if (action === 'remove') {
      const icon = state.icons.find((ic) => ic.id === target);
      if (icon) {
        icon.folder = null;
        const folder = state.icons.find((ic) => ic.id === folderId);
        if (folder) {
          icon.x = (folder.x || 40) + 40;
          icon.y = (folder.y || 40) + 120;
        }
        renderDesktop();
      }
    }
  }

  function registerWindowControls(win) {
    const appId = win.dataset.app;
    win.querySelector('.btn-close').addEventListener('click', () => closeWindow(appId, win));
    win.querySelector('.btn-min').addEventListener('click', () => minimizeWindow(appId, win));
    win.querySelector('.btn-max').addEventListener('click', () => toggleMaximize(win));
    win.addEventListener('mousedown', () => {
      win.style.zIndex = ++windowsZ;
    });
  }

  function closeWindow(appId, win) {
    if (win.__cleanup) {
      try { win.__cleanup(); } catch (err) { console.error(err); }
    }
    if (win.dataset.folder) openFolderWindows.delete(win.dataset.folder);
    if (appId === 'monitorBoard') {
      monitorRegistry.forEach((entry) => clearInterval(entry.interval));
      monitorRegistry.clear();
    }
    win.remove();
    removeTaskbarItem(appId);
  }

  function minimizeWindow(appId, win) {
    win.classList.add('minimized');
    updateTaskbarState(appId, false);
  }

  function toggleMaximize(win) {
    win.classList.toggle('maximized');
  }

  function enableDrag(win) {
    const header = win.querySelector('.window-header');
    let offsetX = 0;
    let offsetY = 0;
    let dragging = false;

    header.addEventListener('mousedown', (e) => {
      if (win.classList.contains('maximized')) return;
      dragging = true;
      offsetX = e.clientX - win.offsetLeft;
      offsetY = e.clientY - win.offsetTop;
      document.body.style.userSelect = 'none';
    });

    window.addEventListener('mousemove', (e) => {
      if (!dragging) return;
      win.style.left = `${e.clientX - offsetX}px`;
      win.style.top = `${e.clientY - offsetY}px`;
    });

    window.addEventListener('mouseup', () => {
      dragging = false;
      document.body.style.userSelect = '';
    });
  }

  function enableResize(win) {
    const resizer = win.querySelector('.window-resizer');
    let resize = false;
    let startX, startY, startW, startH;

    resizer.addEventListener('mousedown', (e) => {
      e.preventDefault();
      resize = true;
      startX = e.clientX;
      startY = e.clientY;
      startW = parseInt(document.defaultView.getComputedStyle(win).width, 10);
      startH = parseInt(document.defaultView.getComputedStyle(win).height, 10);
      document.body.style.userSelect = 'none';
    });

    window.addEventListener('mousemove', (e) => {
      if (!resize) return;
      win.style.width = `${startW + e.clientX - startX}px`;
      win.style.height = `${startH + e.clientY - startY}px`;
    });

    window.addEventListener('mouseup', () => {
      resize = false;
      document.body.style.userSelect = '';
    });
  }

  function createTaskbarItem(appId, title) {
    const existing = taskbarWindows.querySelector(`[data-app="${appId}"]`);
    if (existing) {
      existing.classList.add('active');
      return;
    }
    const item = document.createElement('button');
    item.className = 'taskbar-item active';
    item.dataset.app = appId;
    item.textContent = title;
    item.addEventListener('click', () => {
      const win = document.querySelector(`.window[data-app="${appId}"]`);
      if (!win) return;
      if (win.classList.contains('minimized')) {
        win.classList.remove('minimized');
        updateTaskbarState(appId, true);
      }
      win.style.zIndex = ++windowsZ;
    });
    taskbarWindows.appendChild(item);
  }

  function removeTaskbarItem(appId) {
    const item = taskbarWindows.querySelector(`[data-app="${appId}"]`);
    if (item) item.remove();
  }

  function updateTaskbarState(appId, active) {
    const item = taskbarWindows.querySelector(`[data-app="${appId}"]`);
    if (!item) return;
    item.classList.toggle('active', active);
  }

  function toggleStartMenu(force) {
    const show = force !== undefined ? force : startMenu.classList.contains('hidden');
    startMenu.classList.toggle('hidden', !show);
  }

  function initClock() {
    const update = () => {
      const now = new Date();
      clockEl.textContent = now.toLocaleString('pt-BR', {
        hour: '2-digit', minute: '2-digit', second: '2-digit'
      });
    };
    update();
    setInterval(update, 1000);
  }

  function initStartMenu() {
    startButton.addEventListener('click', () => toggleStartMenu());
    document.addEventListener('click', (e) => {
      if (!startMenu.contains(e.target) && e.target !== startButton) toggleStartMenu(false);
    });
    startMenu.querySelectorAll('.menu-item').forEach((btn) => {
      btn.addEventListener('click', () => {
        const appId = btn.dataset.app;
        toggleStartMenu(false);
        openAppWindow(appId, appId);
      });
    });
  }

  function initNewFolderButton() {
    newFolderButton.addEventListener('click', () => {
      const name = prompt('Nome da pasta:', 'Nova Pasta');
      if (!name) return;
      const rect = desktopLayer.getBoundingClientRect();
      state.folderCounter += 1;
      const folderId = `folder-${state.folderCounter}`;
      const folder = {
        id: folderId,
        type: 'folder',
        label: name.trim() || `Pasta ${state.folderCounter}`,
        x: Math.max(40, rect.width - 160),
        y: 40,
        folder: null
      };
      state.icons.push(folder);
      renderDesktop();
    });
  }

  function setAvatarState(stateName) {
    const src = `assets/avatar-${stateName}.gif`;
    avatarImg.src = src;
    avatarDockImg.src = src;
    hologram.classList.toggle('active', stateName !== 'idle');
  }

  async function httpRequest(path, options = {}) {
    const res = await fetch(`${API_BASE}${path}`, options);
    if (!res.ok) throw new Error((await res.text()) || res.statusText);
    return res.json();
  }

  // Initializers ----------------------------------------------------
  function initTerminal(body) {
    const form = body.querySelector('#terminal-form');
    const output = body.querySelector('#terminal-output');
    form.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const formData = new FormData(form);
      const command = formData.get('command');
      if (!command) return;
      output.textContent = 'Executando...';
      try {
        const data = await httpRequest('/api/exec', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ command })
        });
        output.textContent = [data.stdout, data.stderr].filter(Boolean).join('
');
      } catch (err) {
        output.textContent = `Erro: ${err.message}`;
      }
    });
  }

  function initNetwork(body) {
    body.querySelectorAll('form[data-action]').forEach((form) => {
      const action = form.dataset.action;
      const output = body.querySelector(`.network-output[data-output="${action}"]`);
      form.addEventListener('submit', async (ev) => {
        ev.preventDefault();
        output.textContent = 'Executando...';
        const formData = new FormData(form);
        const target = formData.get('target');
        try {
          let data;
          if (action === 'port') {
            const port = formData.get('port');
            data = await httpRequest(`/api/port-check?target=${encodeURIComponent(target)}&port=${encodeURIComponent(port || '80')}`);
          } else {
            data = await httpRequest(`/api/${action}?target=${encodeURIComponent(target)}`);
          }
          output.textContent = data.output || JSON.stringify(data, null, 2);
        } catch (err) {
          output.textContent = `Erro: ${err.message}`;
        }
      });
    });
  }

  function initMikrotik(body) {
    initNetwork(body);
    const hostInput = body.querySelector('#mikrotik-host');
    body.querySelectorAll('.vnc-links button').forEach((btn) => {
      btn.addEventListener('click', () => {
        const host = hostInput.value.trim();
        if (!host) return;
        if (btn.dataset.link === 'winbox') {
          window.open(`winbox://${host}`);
        } else {
          window.open(`ssh://${host}`);
        }
      });
    });
  }

  function initOPNSense(body) {
    const serverForm = body.querySelector('#opn-server-form');
    const serverList = body.querySelector('#opn-servers-list');
    const serverSelect = body.querySelector('#opn-server-select');
    const refreshBtn = body.querySelector('#opn-refresh');
    const output = body.querySelector('#opn-output');
    const userForm = body.querySelector('#opn-user-form');
    const firewallForm = body.querySelector('#opn-firewall-form');
    const firewallApplyBtn = body.querySelector('#opn-firewall-apply');
    const requestForm = body.querySelector('#opn-request-form');
    const usersBtn = body.querySelector('#opn-users-btn');
    const vpnBtn = body.querySelector('#opn-vpn-btn');
    const fwBtn = body.querySelector('#opn-fw-btn');
    const systemLogBtn = body.querySelector('#opn-system-log-btn');
    const fwLogBtn = body.querySelector('#opn-fw-log-btn');
    const packagesBtn = body.querySelector('#opn-packages-btn');
    const interfacesBtn = body.querySelector('#opn-interfaces-btn');
    const routesBtn = body.querySelector('#opn-routes-btn');

    let servers = [];
    let selectedServerId = null;

    function renderServers() {
      if (!servers.length) {
        serverList.innerHTML = '<div class="placeholder">Nenhum servidor cadastrado.</div>';
        serverSelect.innerHTML = '';
        return;
      }
      serverList.innerHTML = servers
        .map((srv) => `<article class="opn-server" data-id="${srv.id}">
            <header>
              <strong>${srv.name || srv.baseUrl}</strong>
              <span>${srv.baseUrl}</span>
            </header>
            <p>${(srv.notes || '').replace(/</g, '&lt;')}</p>
            <footer>
              <button data-action="select">Selecionar</button>
              <button data-action="delete">Remover</button>
            </footer>
          </article>`)
        .join('');
    serverSelect.innerHTML = servers
      .map((srv) => `<option value="${srv.id}" ${srv.id === selectedServerId ? 'selected' : ''}>${srv.name || srv.baseUrl}</option>`)
      .join('');
    if (selectedServerId) {
      serverSelect.value = selectedServerId;
    }
    }

    async function loadServers() {
      try {
        const data = await httpRequest('/api/opnsense/servers');
        servers = data.servers || [];
        if (!selectedServerId && servers.length) {
          selectedServerId = servers[0].id;
        }
        renderServers();
      } catch (err) {
        serverList.innerHTML = `<div class="placeholder">Erro: ${err.message}</div>`;
      }
    }

    function withServer(cb) {
      if (!selectedServerId) {
        output.textContent = 'Selecione um servidor primeiro.';
        return Promise.resolve(null);
      }
      output.textContent = 'Consultando OPNsense...';
      return cb(selectedServerId)
        .then((data) => {
          output.textContent = JSON.stringify(data, null, 2);
          return data;
        })
        .catch((err) => {
          output.textContent = `Erro: ${err.message}`;
          return null;
        });
    }

    serverList.addEventListener('click', async (ev) => {
      const btn = ev.target.closest('button');
      if (!btn) return;
      const card = btn.closest('.opn-server');
      const id = card?.dataset.id;
      if (!id) return;
      if (btn.dataset.action === 'select') {
        selectedServerId = id;
        renderServers();
      } else if (btn.dataset.action === 'delete') {
        if (!confirm('Remover servidor OPNsense?')) return;
        await httpRequest(`/api/opnsense/servers/${id}`, { method: 'DELETE' });
        if (selectedServerId === id) selectedServerId = null;
        loadServers();
      }
    });

    serverForm.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const data = Object.fromEntries(new FormData(serverForm).entries());
      try {
        await httpRequest('/api/opnsense/servers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });
        serverForm.reset();
        await loadServers();
      } catch (err) {
        alert(`Falha ao salvar servidor: ${err.message}`);
      }
    });

    serverSelect.addEventListener('change', () => {
      selectedServerId = serverSelect.value || null;
    });

    if (refreshBtn) refreshBtn.addEventListener('click', loadServers);

    userForm.addEventListener('submit', (ev) => {
      ev.preventDefault();
      const data = Object.fromEntries(new FormData(userForm).entries());
      withServer((id) => httpRequest(`/api/opnsense/${id}/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      })).then((result) => {
        if (result) userForm.reset();
      });
    });

    firewallForm.addEventListener('submit', (ev) => {
      ev.preventDefault();
      const data = Object.fromEntries(new FormData(firewallForm).entries());
      withServer((id) => httpRequest(`/api/opnsense/${id}/firewall/rules`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rule: data })
      })).then((result) => {
        if (result) firewallForm.reset();
      });
    });

    firewallApplyBtn.addEventListener('click', () => {
      withServer((id) => httpRequest(`/api/opnsense/${id}/firewall/apply`, { method: 'POST' }));
    });

    requestForm.addEventListener('submit', (ev) => {
      ev.preventDefault();
      const formData = Object.fromEntries(new FormData(requestForm).entries());
      let payload = undefined;
      if (formData.payload && formData.payload.trim()) {
        try {
          payload = JSON.parse(formData.payload);
        } catch (err) {
          alert('Payload inválido: ' + err.message);
          return;
        }
      }
      withServer((id) => httpRequest(`/api/opnsense/${id}/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ method: formData.method || 'GET', endpoint: formData.endpoint || '/', payload })
      }));
    });

    usersBtn.addEventListener('click', () => {
      withServer((id) => httpRequest(`/api/opnsense/${id}/users`));
    });

    vpnBtn.addEventListener('click', () => {
      withServer((id) => httpRequest(`/api/opnsense/${id}/vpn/openvpn/status`));
    });

    fwBtn.addEventListener('click', () => {
      withServer((id) => httpRequest(`/api/opnsense/${id}/firewall/rules`));
    });

    systemLogBtn.addEventListener('click', () => {
      withServer((id) => httpRequest(`/api/opnsense/${id}/logs/system`));
    });

    fwLogBtn.addEventListener('click', () => {
      withServer((id) => httpRequest(`/api/opnsense/${id}/logs/firewall`));
    });

    packagesBtn.addEventListener('click', () => {
      withServer((id) => httpRequest(`/api/opnsense/${id}/packages`));
    });

    interfacesBtn.addEventListener('click', () => {
      withServer((id) => httpRequest(`/api/opnsense/${id}/interfaces`));
    });

    routesBtn.addEventListener('click', () => {
      withServer((id) => httpRequest(`/api/opnsense/${id}/routes`));
    });

    loadServers();
  }
  function initLogs(body) {
    const select = body.querySelector('#logs-select');
    const refreshBtn = body.querySelector('#logs-refresh');
    const startBtn = body.querySelector('#logs-start');
    const stopBtn = body.querySelector('#logs-stop');
    const output = body.querySelector('#logs-output');
    let source = null;

    async function loadLogs() {
      try {
        const data = await httpRequest('/api/logs/list');
        select.innerHTML = data.files.map((file) => `<option value="${file}">${file}</option>`).join('');
      } catch (err) {
        output.textContent = `Erro ao listar logs: ${err.message}`;
      }
    }

    function stopStream() {
      if (source) {
        source.close();
        source = null;
      }
    }

    refreshBtn.addEventListener('click', loadLogs);
    stopBtn.addEventListener('click', () => {
      stopStream();
      output.textContent += '
--- stream finalizado ---
';
    });

    startBtn.addEventListener('click', () => {
      const file = select.value;
      if (!file) return;
      stopStream();
      output.textContent = '';
      source = new EventSource(`${API_BASE}/api/logs/stream?file=${encodeURIComponent(file)}`);
      source.onmessage = (ev) => {
        const data = JSON.parse(ev.data);
        output.textContent += data;
        output.scrollTop = output.scrollHeight;
      };
      source.addEventListener('error', (ev) => {
        output.textContent += '
[erro stream]
';
      });
      source.addEventListener('end', () => {
        output.textContent += '
--- fim do arquivo ---
';
      });
    });

    loadLogs();
    return () => stopStream();
  }

  function initDocker(body) {
    const grid = body.querySelector('#docker-stats');
    const refreshBtn = body.querySelector('#docker-refresh');
    const intervalSelect = body.querySelector('#docker-refresh-interval');
    const metaStoreKey = 'docker-meta-overrides';
    let autoTimer = null;
    const metricsHistory = new Map();

    function loadMeta() {
      try {
        return JSON.parse(localStorage.getItem(metaStoreKey)) || {};
      } catch {
        return {};
      }
    }

    function saveMeta(data) {
      localStorage.setItem(metaStoreKey, JSON.stringify(data));
    }

    const metaOverrides = loadMeta();

    function applyMeta(container) {
      const current = metaOverrides[container.id] || {};
      return {
        ip: current.ip ?? container.ip,
        hostname: current.hostname ?? container.hostname,
        user: current.user ?? container.user
      };
    }

    function updateMeta(containerId, field, value) {
      metaOverrides[containerId] = { ...(metaOverrides[containerId] || {}), [field]: value };
      saveMeta(metaOverrides);
    }

    function bytesToHuman(bytes) {
      if (!bytes) return '0 B/s';
      const units = ['B/s', 'KB/s', 'MB/s', 'GB/s', 'TB/s'];
      let idx = 0;
      let value = bytes;
      while (value >= 1024 && idx < units.length - 1) {
        value /= 1024;
        idx += 1;
      }
      return `${value.toFixed(value >= 10 ? 1 : 2)} ${units[idx]}`;
    }

    function drawSparkline(canvas, points, key, options = {}) {
      const ctx = canvas.getContext('2d');
      const width = canvas.width;
      const height = canvas.height;
      ctx.clearRect(0, 0, width, height);
      if (!points.length) return;
      const values = points.map((p) => Number(p[key]) || 0);
      const max = options.max || Math.max(...values, 1);
      const min = options.min || 0;
      const span = max - min || 1;
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = options.color || '#4fd1c5';
      ctx.beginPath();
      values.forEach((val, idx) => {
        const x = (idx / (values.length - 1 || 1)) * width;
        const y = height - ((val - min) / span) * height;
        if (idx === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
    }

    function updateHistory(container) {
      const now = Date.now();
      const entry = metricsHistory.get(container.id) || { last: null, points: [] };
      let netRate = 0;
      let ioRate = 0;
      if (entry.last) {
        const delta = Math.max((now - entry.last.ts) / 1000, 0.1);
        const prevNet = entry.last.netBytes;
        const prevIO = entry.last.ioBytes;
        const currentNet = container.network.rxBytes + container.network.txBytes;
        const currentIO = container.io.readBytes + container.io.writeBytes;
        netRate = Math.max((currentNet - prevNet) / delta, 0);
        ioRate = Math.max((currentIO - prevIO) / delta, 0);
        entry.last = {
          ts: now,
          netBytes: currentNet,
          ioBytes: currentIO
        };
      } else {
        entry.last = {
          ts: now,
          netBytes: container.network.rxBytes + container.network.txBytes,
          ioBytes: container.io.readBytes + container.io.writeBytes
        };
      }
      entry.points.push({
        ts: now,
        cpu: container.cpu.percent,
        mem: container.memory.percent,
        net: netRate,
        io: ioRate
      });
      if (entry.points.length > 60) entry.points.shift();
      metricsHistory.set(container.id, entry);
      return { history: entry.points, netRate, ioRate };
    }

    function renderContainers(data) {
      if (!data.containers.length) {
        grid.innerHTML = '<div class="placeholder">Nenhum container em execução.</div>';
        return;
      }
      grid.innerHTML = '';
      data.containers.forEach((container) => {
        const meta = applyMeta(container);
        const { history: points, netRate, ioRate } = updateHistory(container);
        const card = document.createElement('div');
        card.className = 'docker-card';

        card.innerHTML = `
          <div class="docker-card-header">
            <div>
              <h4>${container.name}</h4>
              <small>${container.image || ''}</small>
            </div>
            <div class="docker-card-status ${container.state || 'unknown'}">${container.state || 'unknown'}</div>
          </div>
          <div class="docker-card-body">
            <div class="docker-meta">
              <label>IP <input data-meta="ip" value="${meta.ip || ''}" placeholder="IP" /></label>
              <label>Hostname <input data-meta="hostname" value="${meta.hostname || ''}" placeholder="Hostname" /></label>
              <label>Usuário <input data-meta="user" value="${meta.user || ''}" placeholder="Usuário" /></label>
            </div>
            <div class="docker-metrics">
              <div class="metric">
                <div class="metric-label">CPU <span>${container.cpu.percent.toFixed(1)}%</span></div>
                <div class="metric-bar" style="--value:${Math.min(container.cpu.percent, 100)}"></div>
                <canvas width="140" height="40" data-chart="cpu"></canvas>
              </div>
              <div class="metric">
                <div class="metric-label">Memória <span>${container.memory.percent.toFixed(1)}% (${container.memory.raw || ''})</span></div>
                <div class="metric-bar" style="--value:${Math.min(container.memory.percent, 100)}"></div>
                <canvas width="140" height="40" data-chart="mem"></canvas>
              </div>
              <div class="metric">
                <div class="metric-label">Rede <span>${bytesToHuman(netRate)}</span></div>
                <canvas width="140" height="40" data-chart="net"></canvas>
              </div>
              <div class="metric">
                <div class="metric-label">IO Disco <span>${bytesToHuman(ioRate)}</span></div>
                <canvas width="140" height="40" data-chart="io"></canvas>
              </div>
            </div>
          </div>
          <div class="docker-card-footer">
            <div class="docker-actions">
              <button data-act="start">Start</button>
              <button data-act="stop">Stop</button>
              <button data-act="restart">Restart</button>
              <button data-act="logs">Logs</button>
            </div>
            <pre class="docker-logs" hidden></pre>
          </div>`;

        const logBox = card.querySelector('.docker-logs');
        card.querySelectorAll('button[data-act]').forEach((btn) => {
          btn.addEventListener('click', async () => {
            const act = btn.dataset.act;
            try {
              if (act === 'logs') {
                btn.disabled = true;
                const resp = await httpRequest('/api/docker/logs', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ container: container.id })
                });
                logBox.textContent = resp.output || '[sem logs]';
                logBox.hidden = false;
              } else {
                btn.disabled = true;
                await httpRequest(`/api/docker/${act}`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ container: container.id })
                });
                await load();
              }
            } catch (err) {
              alert(`Docker ${act} falhou: ${err.message}`);
            } finally {
              btn.disabled = false;
            }
          });
        });

        card.querySelectorAll('input[data-meta]').forEach((input) => {
          input.addEventListener('change', () => {
            updateMeta(container.id, input.dataset.meta, input.value.trim());
          });
        });

        grid.appendChild(card);

        const charts = card.querySelectorAll('canvas[data-chart]');
        charts.forEach((canvas) => {
          const type = canvas.dataset.chart;
          if (type === 'cpu' || type === 'mem') {
            drawSparkline(canvas, points, type === 'cpu' ? 'cpu' : 'mem', {
              max: 100,
              color: type === 'cpu' ? '#f87171' : '#60a5fa'
            });
          } else if (type === 'net') {
            const max = Math.max(...points.map((p) => p.net), netRate, 1);
            drawSparkline(canvas, points, 'net', { max, color: '#34d399' });
          } else if (type === 'io') {
            const max = Math.max(...points.map((p) => p.io), ioRate, 1);
            drawSparkline(canvas, points, 'io', { max, color: '#a78bfa' });
          }
        });
      });
    }

    async function load() {
      grid.innerHTML = '<div class="placeholder">Carregando métricas...</div>';
      try {
        const data = await httpRequest('/api/docker/metrics');
        renderContainers(data);
      } catch (err) {
        grid.innerHTML = `<div class="placeholder">Erro: ${err.message}</div>`;
      }
    }

    function setAutoRefresh(value) {
      if (autoTimer) {
        clearInterval(autoTimer);
        autoTimer = null;
      }
      const seconds = Number(value);
      if (seconds > 0) {
        autoTimer = setInterval(load, seconds * 1000);
      }
    }

    refreshBtn.addEventListener('click', load);
    intervalSelect.addEventListener('change', () => {
      setAutoRefresh(intervalSelect.value);
    });

    load().then(() => {
      setAutoRefresh(intervalSelect.value);
    });

    return () => {
      if (autoTimer) clearInterval(autoTimer);
    };
  }


  function initMonitorBoard(body) {
    const form = body.querySelector('#monitor-form');
    const grid = body.querySelector('#monitor-grid');

    function render() {
      grid.innerHTML = '';
      monitorRegistry.forEach((entry, id) => {
        const div = document.createElement('div');
        div.className = `status-node ${entry.status}`;
        div.innerHTML = `<span class="node-title">${entry.name}</span><span>${entry.target}</span><span class="node-status">${entry.statusText}</span><button data-remove="${id}">Remover</button>`;
        grid.appendChild(div);
        div.querySelector('button').addEventListener('click', () => removeMonitor(id));
      });
    }

    function updateEntry(id, status, statusText) {
      const entry = monitorRegistry.get(id);
      if (!entry) return;
      const prev = entry.status;
      entry.status = status;
      entry.statusText = statusText;
      if (prev !== 'offline' && status === 'offline') {
        triggerAlert(entry);
      }
      render();
    }

    function removeMonitor(id) {
      const entry = monitorRegistry.get(id);
      if (!entry) return;
      clearInterval(entry.interval);
      monitorRegistry.delete(id);
      render();
    }

    async function triggerAlert(entry) {
      try {
        await httpRequest('/api/alerts/notify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            subject: `Alerta ${entry.name}`,
            message: `Monitor ${entry.name} (${entry.mode}) fora do ar. Host: ${entry.target}.`,
            severity: 'critical',
            target: entry.target,
            details: { mode: entry.mode }
          })
        });
      } catch (err) {
        console.error('triggerAlert', err.message);
      }
    }

    form.addEventListener('submit', (ev) => {
      ev.preventDefault();
      const formData = new FormData(form);
      const name = formData.get('name');
      const target = formData.get('target');
      const mode = formData.get('mode');
      const port = formData.get('port');
      const community = formData.get('community');
      const oid = formData.get('oid');
      const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
      const entry = {
        id,
        name,
        target,
        mode,
        port,
        community,
        oid,
        status: 'warning',
        statusText: 'Aguardando'
      };
      async function performCheck() {
        try {
          if (mode === 'ping') {
            await httpRequest(`/api/ping?target=${encodeURIComponent(target)}`);
          } else if (mode === 'http') {
            await httpRequest(`/api/http-check?target=${encodeURIComponent(target)}`);
          } else if (mode === 'port') {
            await httpRequest(`/api/port-check?target=${encodeURIComponent(target)}&port=${encodeURIComponent(port || '80')}`);
          } else if (mode === 'snmp') {
            await httpRequest('/api/snmp/get', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ host: target, community, oid })
            });
          }
          updateEntry(id, 'online', 'OK');
        } catch (err) {
          updateEntry(id, 'offline', err.message.slice(0, 120));
        }
      }

      entry.interval = setInterval(performCheck, 15000);
      monitorRegistry.set(id, entry);
      render();
      performCheck();
    });

    render();
    return () => {
      monitorRegistry.forEach((entry) => clearInterval(entry.interval));
      monitorRegistry.clear();
    };
  }

  function initSMTP(body) {
    const form = body.querySelector('#smtp-form');
    const output = body.querySelector('#smtp-output');
    form.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      output.textContent = 'Enviando...';
      const data = Object.fromEntries(new FormData(form).entries());
      data.secure = form.querySelector('input[name="secure"]').checked;
      try {
        const resp = await httpRequest('/api/smtp/test', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });
        output.textContent = JSON.stringify(resp, null, 2);
      } catch (err) {
        output.textContent = `Erro: ${err.message}`;
      }
    });
  }

  function initNotes(body) {
    const form = body.querySelector('#notes-form');
    const list = body.querySelector('#notes-list');

    async function load() {
      list.innerHTML = '<div class\"placeholder\">Carregando...</div>'.replace('\\', '\');
      try {
        const data = await httpRequest('/api/notes');
        if (!data.notes.length) {
          list.innerHTML = '<div class=\"placeholder\">Nenhuma nota</div>';
          return;
        }
        list.innerHTML = data.notes
          .map((note) => `<div class=\"note-card\" data-id=\"${note.id}\"><div>${note.text.replace(/</g, '&lt;')}</div><small>${note.createdAt}</small><button data-remove=\"${note.id}\">Excluir</button></div>`)
          .join('');
        list.querySelectorAll('button[data-remove]').forEach((btn) => {
          btn.addEventListener('click', async () => {
            const id = btn.dataset.remove;
            await httpRequest(`/api/notes/${id}`, { method: 'DELETE' });
            load();
          });
        });
      } catch (err) {
        list.innerHTML = `<div class=\"placeholder\">Erro: ${err.message}</div>`;
      }
    }

    form.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const data = Object.fromEntries(new FormData(form).entries());
      try {
        await httpRequest('/api/notes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });
        form.reset();
        load();
      } catch (err) {
        alert(`Falha ao salvar nota: ${err.message}`);
      }
    });

    load();
  }

  function initNotifications(body) {
    const output = body.querySelector('#notifications-output');
    body.querySelectorAll('form').forEach((form) => {
      form.addEventListener('submit', async (ev) => {
        ev.preventDefault();
        output.textContent = 'Executando...';
        const data = Object.fromEntries(new FormData(form).entries());
        const id = form.id.replace('-form', '');
        const endpoint = id === 'voip' ? '/api/voip/call' : `/api/${id}/send`;
        try {
          const resp = await httpRequest(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
          });
          output.textContent = JSON.stringify(resp, null, 2);
        } catch (err) {
          output.textContent = `Erro: ${err.message}`;
        }
      });
    });
  }


function initSettings(body) {
  const form = body.querySelector('#settings-form');
  const output = body.querySelector('#settings-output');

  function formToObject(form) {
    const data = {};
    new FormData(form).forEach((value, key) => {
      const segments = key.split('.');
      let ref = data;
      segments.forEach((seg, idx) => {
        if (idx === segments.length - 1) {
          if (value === 'on') value = true;
          ref[seg] = value;
        } else {
          ref[seg] = ref[seg] || {};
          ref = ref[seg];
        }
      });
    });
    return data;
  }

  function populate(settings) {
    if (!settings) return;
    const entries = {
      'smtp.enabled': settings.smtp?.enabled,
      'smtp.host': settings.smtp?.host,
      'smtp.port': settings.smtp?.port,
      'smtp.secure': settings.smtp?.secure,
      'smtp.user': settings.smtp?.user,
      'smtp.pass': settings.smtp?.pass,
      'smtp.from': settings.smtp?.from,
      'smtp.to': Array.isArray(settings.smtp?.to) ? settings.smtp.to.join(',') : settings.smtp?.to,
      'telegram.enabled': settings.telegram?.enabled,
      'telegram.botToken': settings.telegram?.botToken,
      'telegram.chatIds': Array.isArray(settings.telegram?.chatIds) ? settings.telegram.chatIds.join(',') : settings.telegram?.chatIds,
      'voip.enabled': settings.voip?.enabled,
      'voip.accountSid': settings.voip?.accountSid,
      'voip.authToken': settings.voip?.authToken,
      'voip.from': settings.voip?.from,
      'voip.to': Array.isArray(settings.voip?.to) ? settings.voip.to.join(',') : settings.voip?.to
    };
    Object.entries(entries).forEach(([key, value]) => {
      const input = form.querySelector(`[name="${key}"]`);
      if (!input) return;
      if (input.type === 'checkbox') {
        input.checked = Boolean(value);
      } else {
        input.value = value || '';
      }
    });
  }

  async function load() {
    try {
      const data = await httpRequest('/api/settings');
      populate(data.alerts || data);
    } catch (err) {
      output.textContent = `Erro ao carregar: ${err.message}`;
    }
  }

  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    output.textContent = 'Salvando...';
    const raw = formToObject(form);
    const parsed = { ...raw };
    if (form.querySelector('[name="smtp.to"]').value) {
      parsed.smtp = parsed.smtp || {};
      parsed.smtp.to = form.querySelector('[name="smtp.to"]').value
        .split(',').map((s) => s.trim()).filter(Boolean);
    }
    if (form.querySelector('[name="telegram.chatIds"]').value) {
      parsed.telegram = parsed.telegram || {};
      parsed.telegram.chatIds = form.querySelector('[name="telegram.chatIds"]').value
        .split(',').map((s) => s.trim()).filter(Boolean);
    }
    if (form.querySelector('[name="voip.to"]').value) {
      parsed.voip = parsed.voip || {};
      parsed.voip.to = form.querySelector('[name="voip.to"]').value
        .split(',').map((s) => s.trim()).filter(Boolean);
    }
    try {
      await httpRequest('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alerts: parsed })
      });
      output.textContent = 'Configurações salvas.';
    } catch (err) {
      output.textContent = `Erro: ${err.message}`;
    }
  });

  load();
}

function initCloudflare(body) {
  const accountForm = body.querySelector('#cf-account-form');
  const accountList = body.querySelector('#cf-accounts-list');
  const accountSelect = body.querySelector('#cf-account-select');
  const zoneSelect = body.querySelector('#cf-zone-select');
  const zoneList = body.querySelector('#cf-zones-list');
  const zoneForm = body.querySelector('#cf-zone-form');
  const recordForm = body.querySelector('#cf-record-form');
  const recordOutput = body.querySelector('#cf-record-output');
  const metaOutput = body.querySelector('#cf-meta-output');
  const localLogs = body.querySelector('#cf-local-logs');
  const accountRefresh = body.querySelector('#cf-account-refresh');
  const zonesRefresh = body.querySelector('#cf-zones-refresh');
  const membersBtn = body.querySelector('#cf-members-load');
  const tunnelsBtn = body.querySelector('#cf-tunnels-load');
  const logsBtn = body.querySelector('#cf-logs-load');

  let accounts = [];
  let zones = [];
  let selectedAccountId = null;

  function renderAccounts() {
    if (!accounts.length) {
      accountList.innerHTML = '<div class="placeholder">Nenhuma conta cadastrada.</div>';
      accountSelect.innerHTML = '';
      return;
    }
    accountList.innerHTML = accounts
      .map((acc) => `<article class="cf-account" data-id="${acc.id}">
          <header>
            <strong>${acc.name || acc.email || 'Sem nome'}</strong>
            <span>${acc.accountId || ''}</span>
          </header>
          <p>${(acc.notes || '').replace(/</g, '&lt;')}</p>
          <footer>
            <button data-action="select">Selecionar</button>
            <button data-action="delete">Remover</button>
          </footer>
        </article>`)
      .join('');
    accountSelect.innerHTML = accounts
      .map((acc) => `<option value="${acc.id}" ${acc.id === selectedAccountId ? 'selected' : ''}>${acc.name || acc.email || acc.id}</option>`)
      .join('');
    if (selectedAccountId) {
      accountSelect.value = selectedAccountId;
    }
  }

  function renderZones() {
    if (!zones.length) {
      zoneList.innerHTML = '<div class="placeholder">Nenhuma zona carregada.</div>';
      zoneSelect.innerHTML = '';
      return;
    }
    zoneList.innerHTML = zones
      .map((zone) => `<article class="cf-zone">
          <header>
            <strong>${zone.name}</strong>
            <span>${zone.status}</span>
          </header>
          <p>ID: ${zone.id}<br>Plano: ${zone.plan?.name || '-'}<br>DNS: ${zone.account?.name || ''}</p>
        </article>`)
      .join('');
    zoneSelect.innerHTML = zones.map((zone) => `<option value="${zone.id}">${zone.name}</option>`).join('');
    if (zoneSelect.options.length) {
      zoneSelect.value = zoneSelect.options[0].value;
    }
  }

  async function loadAccounts() {
    try {
      const data = await httpRequest('/api/cloudflare/accounts');
      accounts = data.accounts || [];
      if (!selectedAccountId && accounts.length) {
        selectedAccountId = accounts[0].id;
      }
      renderAccounts();
    } catch (err) {
      accountList.innerHTML = `<div class="placeholder">Erro: ${err.message}</div>`;
    }
  }

  async function loadZones() {
    if (!selectedAccountId) {
      zoneList.innerHTML = '<div class="placeholder">Selecione uma conta.</div>';
      zoneSelect.innerHTML = '';
      return;
    }
    try {
      const data = await httpRequest(`/api/cloudflare/accounts/${selectedAccountId}/zones`);
      zones = data.zones || [];
      renderZones();
    } catch (err) {
      zoneList.innerHTML = `<div class="placeholder">Erro: ${err.message}</div>`;
    }
  }

  async function loadLocalLogs() {
    try {
      const data = await httpRequest('/api/cloudflare/logs/local');
      localLogs.textContent = JSON.stringify(data.logs || [], null, 2);
    } catch (err) {
      localLogs.textContent = `Erro: ${err.message}`;
    }
  }

  accountList.addEventListener('click', async (ev) => {
    const btn = ev.target.closest('button');
    if (!btn) return;
    const card = btn.closest('.cf-account');
    const id = card?.dataset.id;
    if (!id) return;
    if (btn.dataset.action === 'select') {
      selectedAccountId = id;
      renderAccounts();
      loadZones();
    } else if (btn.dataset.action === 'delete') {
      if (!confirm('Remover conta Cloudflare?')) return;
      await httpRequest(`/api/cloudflare/accounts/${id}`, { method: 'DELETE' });
      if (selectedAccountId === id) selectedAccountId = null;
      loadAccounts().then(loadZones);
    }
  });

  accountForm.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const data = Object.fromEntries(new FormData(accountForm).entries());
    try {
      await httpRequest('/api/cloudflare/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      accountForm.reset();
      await loadAccounts();
      await loadZones();
    } catch (err) {
      alert(`Falha ao salvar conta: ${err.message}`);
    }
  });

  if (accountRefresh) {
    accountRefresh.addEventListener('click', () => {
      loadAccounts().then(loadZones);
    });
  }

  zonesRefresh.addEventListener('click', loadZones);

  recordForm.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    if (!selectedAccountId) {
      alert('Selecione uma conta.');
      return;
    }
    const data = Object.fromEntries(new FormData(recordForm).entries());
    const zoneId = data.zoneId;
    if (!zoneId) {
      alert('Selecione uma zona.');
      return;
    }
    delete data.zoneId;
    ['ttl', 'priority'].forEach((key) => {
      if (data[key] === '') delete data[key];
    });
    if (data.proxied === '') delete data.proxied;
    try {
      const resp = await httpRequest(`/api/cloudflare/accounts/${selectedAccountId}/zones/${zoneId}/records`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      recordOutput.textContent = JSON.stringify(resp.record || resp, null, 2);
      recordForm.reset();
      loadZones();
      loadLocalLogs();
    } catch (err) {
      recordOutput.textContent = `Erro: ${err.message}`;
    }
  });

  zoneForm.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    if (!selectedAccountId) {
      alert('Selecione uma conta.');
      return;
    }
    const data = Object.fromEntries(new FormData(zoneForm).entries());
    try {
      await httpRequest(`/api/cloudflare/accounts/${selectedAccountId}/zones`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: data.name,
          jump_start: data.jump_start !== 'false',
          type: data.type || 'full',
          plan: data.plan || 'free'
        })
      });
      zoneForm.reset();
      zoneForm.querySelector('[name="jump_start"]').value = 'true';
      zoneForm.querySelector('[name="type"]').value = 'full';
      zoneForm.querySelector('[name="plan"]').value = 'free';
      loadZones();
      loadLocalLogs();
    } catch (err) {
      alert(`Falha ao criar zona: ${err.message}`);
    }
  });

  async function withAccount(action) {
    if (!selectedAccountId) {
      metaOutput.textContent = 'Selecione uma conta primeiro.';
      return null;
    }
    metaOutput.textContent = 'Consultando Cloudflare...';
    try {
      const resp = await action(selectedAccountId);
      metaOutput.textContent = JSON.stringify(resp, null, 2);
      loadLocalLogs();
      return resp;
    } catch (err) {
      metaOutput.textContent = `Erro: ${err.message}`;
      return null;
    }
  }

  membersBtn.addEventListener('click', () => {
    withAccount((id) => httpRequest(`/api/cloudflare/accounts/${id}/users`));
  });

  tunnelsBtn.addEventListener('click', () => {
    withAccount((id) => httpRequest(`/api/cloudflare/accounts/${id}/tunnels`));
  });

  logsBtn.addEventListener('click', () => {
    withAccount((id) => httpRequest(`/api/cloudflare/accounts/${id}/logs`));
  });

  loadAccounts().then(loadZones);
  loadLocalLogs();
}

  function initSpamExperts(body) {
    const form = body.querySelector('#spamexperts-form');
    const output = body.querySelector('#spamexperts-output');
    form.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      output.textContent = 'Executando...';
      const data = Object.fromEntries(new FormData(form).entries());
      try {
        const resp = await httpRequest('/api/spamexperts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });
        output.textContent = JSON.stringify(resp, null, 2);
      } catch (err) {
        output.textContent = `Erro: ${err.message}`;
      }
    });
  }

  function initILO(body) {
    const form = body.querySelector('#ilo-form');
    const list = body.querySelector('#ilo-list');

    async function load() {
      try {
        const data = await httpRequest('/api/ilo-drac');
        list.textContent = data.entries
          .map((entry) => `${entry.name} -> ${entry.host} (${entry.type || 'N/A'})`)
          .join('
');
      } catch (err) {
        list.textContent = `Erro: ${err.message}`;
      }
    }

    form.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const data = Object.fromEntries(new FormData(form).entries());
      try {
        await httpRequest('/api/ilo-drac', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });
        form.reset();
        load();
      } catch (err) {
        list.textContent = `Erro: ${err.message}`;
      }
    });

    load();
  }

  function initCrawler(body) {
    const form = body.querySelector('#crawler-form');
    const output = body.querySelector('#crawler-output');
    form.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      output.textContent = 'Executando varredura...';
      const data = Object.fromEntries(new FormData(form).entries());
      try {
        const resp = await httpRequest('/api/crawler/network', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });
        output.textContent = resp.output;
      } catch (err) {
        output.textContent = `Erro: ${err.message}`;
      }
    });
  }

  function initGemma(body) {
    const form = body.querySelector('#gemma-form');
    const output = body.querySelector('#gemma-output');
    form.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const prompt = new FormData(form).get('prompt');
      if (!prompt) return;
      output.textContent = 'Consultando Gemma...';
      try {
        const resp = await httpRequest('/api/gemma/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt })
        });
        output.textContent = resp.output || JSON.stringify(resp, null, 2);
      } catch (err) {
        output.textContent = `Erro: ${err.message}`;
      }
    });
  }

  function initRag(body) {
    const searchForm = body.querySelector('#rag-form');
    const uploadForm = body.querySelector('#rag-upload-form');
    const uploadOutput = body.querySelector('#rag-upload-output');
    const resultsDiv = body.querySelector('#rag-results');
    const catalogList = body.querySelector('#rag-catalog-list');
    const catalogRefresh = body.querySelector('#rag-catalog-refresh');
    const collectionsList = body.querySelector('#rag-collections');

    async function loadCollections() {
      try {
        const data = await httpRequest('/api/rag/collections');
        if (!data.collections) return;
        collectionsList.innerHTML = data.collections
          .map((col) => `<option value="${col.name}">${col.name}</option>`)
          .join('');
      } catch (err) {
        console.warn('Falha ao listar coleções', err.message);
      }
    }

    function renderCatalog(entries) {
      if (!entries || !entries.length) {
        catalogList.innerHTML = '<div class="placeholder">Nenhum documento ingerido ainda.</div>';
        return;
      }
      catalogList.innerHTML = entries
        .map((entry) => `<article class="rag-catalog-item">
            <header>
              <strong>${entry.title || entry.source || 'Sem título'}</strong>
              <span>${entry.collection || ''}</span>
            </header>
            <p>${(entry.preview || '').replace(/</g, '&lt;')}</p>
            <footer>
              <span>${entry.source || 'desconhecido'}</span>
              <span>${(entry.tags || []).join(', ')}</span>
              <time>${entry.ingested_at ? new Date(entry.ingested_at).toLocaleString() : ''}</time>
            </footer>
          </article>`)
        .join('');
    }

    async function loadCatalog() {
      try {
        const data = await httpRequest('/api/rag/catalog');
        renderCatalog(data.entries || []);
      } catch (err) {
        catalogList.innerHTML = `<div class="placeholder">Erro: ${err.message}</div>`;
      }
    }

    function renderResults(response) {
      const results = response.results || response.points || [];
      if (!results.length) {
        resultsDiv.innerHTML = '<div class="placeholder">Nenhum resultado encontrado.</div>';
        return;
      }
      resultsDiv.innerHTML = results
        .map((item) => {
          const payload = item.payload || {};
          const text = (payload.text || payload.content || '').replace(/</g, '&lt;');
          const tags = Array.isArray(payload.tags) ? payload.tags.join(', ') : '';
          const score = typeof item.score === 'number' ? item.score.toFixed(4) : '';
          return `<article class="rag-result">
              <header>
                <strong>${payload.title || payload.source || 'Sem título'}</strong>
                <span>${payload.source || ''}</span>
              </header>
              <pre>${text}</pre>
              <footer>
                <span>${tags}</span>
                <span>${score}</span>
              </footer>
            </article>`;
        })
        .join('');
    }

    uploadForm.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      uploadOutput.textContent = 'Indexando conteúdo...';
      try {
        const formData = new FormData(uploadForm);
        const res = await fetch(`${API_BASE}/api/rag/upload`, {
          method: 'POST',
          body: formData
        });
        const data = await res.json();
        if (!res.ok || !data.ok) throw new Error(data.error || res.statusText);
        uploadOutput.textContent = `✓ Indexados ${data.chunks || 0} chunks em ${data.collection}`;
        uploadForm.reset();
        loadCatalog();
      } catch (err) {
        uploadOutput.textContent = `Erro: ${err.message}`;
      }
    });

    searchForm.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const formEntries = Object.fromEntries(new FormData(searchForm).entries());
      resultsDiv.innerHTML = '<div class="placeholder">Consultando Qdrant...</div>';
      try {
        const payload = {
          collection: formEntries.collection,
          query: formEntries.query,
          limit: Number(formEntries.limit) || 5,
          filterTags: formEntries.filterTags
        };
        const resp = await httpRequest('/api/rag/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        renderResults(resp);
      } catch (err) {
        resultsDiv.innerHTML = `<div class="placeholder">Erro: ${err.message}</div>`;
      }
    });

    catalogRefresh.addEventListener('click', loadCatalog);

    loadCollections();
    loadCatalog();
  }

  function initVNC(body) {
    const hostInput = body.querySelector('#vnc-host');
    body.querySelector('#vnc-open').addEventListener('click', () => {
      const host = hostInput.value.trim();
      if (host) window.open(`vnc://${host}`);
    });
    body.querySelector('#rdp-open').addEventListener('click', () => {
      const host = hostInput.value.trim();
      if (host) window.open(`rdp://${host}`);
    });
  }

  window.addEventListener('resize', () => {
    clampAllIcons();
    renderDesktop();
  });

  const avatarStates = ['idle', 'focus', 'empathy'];
  let stateIndex = 0;
  setInterval(() => {
    stateIndex = (stateIndex + 1) % avatarStates.length;
    setAvatarState(avatarStates[stateIndex]);
  }, 15000);

  initClock();
  initStartMenu();
  initNewFolderButton();
  renderDesktop();
  setAvatarState('idle');
})();
