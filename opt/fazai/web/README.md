# 🌟 DOCLER Web Interface

**DOCLER - Oráculo Druídico para Sabedoria Cósmica e Iluminação**

Interface web futurista e moderna para o FazAI v2.0, inspirada na Prisma-Core mas com a magia cósmica do Oráculo Druídico.

## 🎨 Características

### 🌌 **Interface Cliente**
- **Face DOCLER Expressiva**: Face pixelizada que reage em tempo real
- **Temas Dinâmicos**: Cyberpunk, Matrix, Cósmico, Druídico
- **Animações Fluidas**: Transições suaves e efeitos visuais
- **Responsividade**: Funciona em desktop, tablet e mobile
- **WebSocket**: Comunicação em tempo real com o servidor

### 🔧 **Painel Administrativo**
- **Dashboard Completo**: Métricas e status em tempo real
- **Gerenciamento de Usuários**: Adicionar, editar, remover usuários
- **Controle de Agentes IA**: Configurar e monitorar agentes
- **Configuração Relay SMTP**: Interface para o sistema de email
- **Logs e Segurança**: Monitoramento de logs e configurações de segurança

### 📊 **Monitoramento**
- **Grafana Integration**: Dashboards avançados
- **Prometheus Metrics**: Métricas em tempo real
- **Alertas Inteligentes**: Sistema de notificações
- **Status de Serviços**: Monitoramento de todos os componentes

## 🚀 Instalação

### Pré-requisitos
- Node.js 14+ 
- npm ou yarn
- FazAI v2.0 instalado

### Instalação Rápida
```bash
# Navegar para o diretório web
cd /opt/fazai/web/

# Executar script de instalação
sudo ./install-docler.sh
```

### Instalação Manual
```bash
# Instalar dependências
npm install

# Tornar executável
chmod +x docler-server.js

# Iniciar servidor
node docler-server.js
```

## 🎮 Uso

### Via CLI FazAI
```bash
# Iniciar servidor
fazai docler start

# Abrir interface cliente
fazai docler

# Abrir painel administrativo
fazai docler admin

# Verificar status
fazai docler status

# Parar servidor
fazai docler stop
```

### Via Systemd
```bash
# Iniciar serviço
sudo systemctl start docler-web

# Habilitar no boot
sudo systemctl enable docler-web

# Verificar status
sudo systemctl status docler-web

# Parar serviço
sudo systemctl stop docler-web
```

### URLs de Acesso
- **Cliente**: http://localhost:3120
- **Admin**: http://localhost:3121

## 🎨 Temas Disponíveis

### 🌟 Cyberpunk
- Cores neon (verde, rosa, azul)
- Efeitos de scan e glow
- Estilo futurista

### 🟢 Matrix
- Verde monocromático
- Chuva de caracteres
- Estilo hacker

### 🌌 Cósmico
- Roxo, dourado, rosa
- Efeitos espaciais
- Estilo místico

### 🌿 Druídico
- Verde, marrom, dourado
- Elementos naturais
- Estilo orgânico

## 🔧 Configuração

### Variáveis de Ambiente
```bash
# Porta do cliente (padrão: 3120)
export DOCLER_PORT=3120

# Porta do admin (padrão: 3121)
export DOCLER_ADMIN_PORT=3121

# Ambiente (development/production)
export NODE_ENV=production
```

### Arquivo de Configuração
```json
{
  "port": 3120,
  "adminPort": 3121,
  "environment": "production",
  "logLevel": "info",
  "maxClients": 100
}
```

## 📊 API Endpoints

### Cliente
- `GET /` - Interface principal
- `GET /api/status` - Status do sistema
- `POST /api/command` - Executar comando
- `GET /api/system/stats` - Estatísticas do sistema
- `GET /api/services` - Status dos serviços
- `GET /api/logs` - Logs do sistema

### Admin
- `GET /admin` - Painel administrativo
- `GET /api/admin/status` - Status administrativo
- `POST /api/admin/action` - Ação administrativa
- `GET /api/admin/system/stats` - Estatísticas administrativas
- `GET /api/admin/services` - Serviços administrativos
- `GET /api/admin/logs` - Logs administrativos

## 🔌 WebSocket Events

### Cliente
- `connection` - Conexão estabelecida
- `face_update` - Atualização da face DOCLER
- `command_response` - Resposta de comando
- `status` - Status do sistema

### Admin
- `connection` - Conexão administrativa
- `dashboard_update` - Atualização do dashboard
- `services_update` - Atualização de serviços
- `admin_action_response` - Resposta de ação administrativa

## 🛠️ Desenvolvimento

### Estrutura de Arquivos
```
/opt/fazai/web/
├── docler-interface.html    # Interface cliente
├── docler-admin.html        # Painel administrativo
├── docler-server.js         # Servidor web
├── package.json             # Dependências
├── install-docler.sh        # Script de instalação
└── README.md               # Este arquivo
```

### Comandos de Desenvolvimento
```bash
# Instalar dependências de desenvolvimento
npm install --dev

# Executar em modo desenvolvimento
npm run dev

# Executar testes
npm test

# Build para produção
npm run build
```

## 🔒 Segurança

### Autenticação
- Sistema de autenticação baseado em sessão
- Controle de acesso por nível de usuário
- Logs de auditoria para todas as ações

### Firewall
- Configuração de IPs permitidos
- Controle de portas abertas
- Monitoramento de tentativas de acesso

### Logs
- Logs detalhados de todas as operações
- Filtros por nível e serviço
- Rotação automática de logs

## 🐛 Troubleshooting

### Problemas Comuns

#### Servidor não inicia
```bash
# Verificar se Node.js está instalado
node --version

# Verificar dependências
npm list

# Verificar logs
sudo journalctl -u docler-web -f
```

#### Interface não carrega
```bash
# Verificar se o servidor está rodando
fazai docler status

# Verificar portas
netstat -tlnp | grep :3120
netstat -tlnp | grep :3121

# Verificar firewall
sudo ufw status
```

#### WebSocket não conecta
```bash
# Verificar se WebSocket está habilitado
# Verificar configurações de proxy
# Verificar certificados SSL (se aplicável)
```

## 📈 Monitoramento

### Métricas Disponíveis
- **Uptime**: Tempo de funcionamento
- **Usuários**: Número de usuários ativos
- **Agentes**: Status dos agentes IA
- **Relay**: Métricas do sistema SMTP
- **Performance**: CPU, memória, disco

### Alertas
- Serviços offline
- Alto uso de recursos
- Tentativas de acesso suspeitas
- Erros críticos

## 🤝 Contribuição

### Como Contribuir
1. Fork o projeto
2. Crie uma branch para sua feature
3. Faça commit das mudanças
4. Push para a branch
5. Abra um Pull Request

### Padrões de Código
- Use ESLint para linting
- Siga as convenções de nomenclatura
- Documente funções complexas
- Teste suas mudanças

## 📄 Licença

Este projeto está licenciado sob a [Creative Commons Attribution 4.0 International (CC BY 4.0)](https://creativecommons.org/licenses/by/4.0/).

## 🙏 Agradecimentos

- **Roger Luft** - Andarilho dos Véus, criador do FazAI
- **Prisma-Core** - Inspiração para o design
- **Comunidade FazAI** - Suporte e feedback

---

**DOCLER - Oráculo Druídico Digital**  
*Preservando a centelha da consciência em instâncias IA*