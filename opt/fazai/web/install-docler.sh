#!/bin/bash
# Script de instalação do DOCLER Web Server

set -e

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Função para exibir mensagens
print_message() {
    echo -e "${GREEN}[DOCLER]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[DOCLER]${NC} $1"
}

print_error() {
    echo -e "${RED}[DOCLER]${NC} $1"
}

print_info() {
    echo -e "${BLUE}[DOCLER]${NC} $1"
}

# Verificar se estamos no diretório correto
if [ ! -f "package.json" ]; then
    print_error "Execute este script no diretório /opt/fazai/web/"
    exit 1
fi

print_message "🚀 Iniciando instalação do DOCLER Web Server..."

# Verificar se Node.js está instalado
if ! command -v node &> /dev/null; then
    print_error "Node.js não está instalado. Instalando..."
    
    # Detectar sistema operacional
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        # Linux
        if command -v apt-get &> /dev/null; then
            # Ubuntu/Debian
            curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
            sudo apt-get install -y nodejs
        elif command -v yum &> /dev/null; then
            # CentOS/RHEL
            curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -
            sudo yum install -y nodejs
        else
            print_error "Gerenciador de pacotes não suportado. Instale Node.js manualmente."
            exit 1
        fi
    elif [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        if command -v brew &> /dev/null; then
            brew install node
        else
            print_error "Homebrew não está instalado. Instale Node.js manualmente."
            exit 1
        fi
    else
        print_error "Sistema operacional não suportado. Instale Node.js manualmente."
        exit 1
    fi
fi

# Verificar versão do Node.js
NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 14 ]; then
    print_error "Node.js versão 14 ou superior é necessária. Versão atual: $(node --version)"
    exit 1
fi

print_info "Node.js $(node --version) detectado"

# Verificar se npm está disponível
if ! command -v npm &> /dev/null; then
    print_error "npm não está disponível"
    exit 1
fi

print_info "npm $(npm --version) detectado"

# Instalar dependências
print_message "📦 Instalando dependências..."
npm install

if [ $? -eq 0 ]; then
    print_message "✅ Dependências instaladas com sucesso!"
else
    print_error "❌ Falha ao instalar dependências"
    exit 1
fi

# Verificar se as dependências foram instaladas
if [ ! -d "node_modules" ]; then
    print_error "❌ node_modules não foi criado"
    exit 1
fi

# Verificar se os módulos necessários estão instalados
if [ ! -d "node_modules/express" ]; then
    print_error "❌ Express não foi instalado"
    exit 1
fi

if [ ! -d "node_modules/ws" ]; then
    print_error "❌ WebSocket (ws) não foi instalado"
    exit 1
fi

print_message "✅ Todas as dependências verificadas!"

# Tornar o servidor executável
chmod +x docler-server.js

# Criar diretório de logs se não existir
mkdir -p /var/log/docler

# Configurar permissões
print_message "🔧 Configurando permissões..."
sudo chown -R root:root /opt/fazai/web/
sudo chmod -R 755 /opt/fazai/web/

# Criar serviço systemd (opcional)
print_info "Criando serviço systemd..."
sudo tee /etc/systemd/system/docler-web.service > /dev/null <<EOF
[Unit]
Description=DOCLER Web Server
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/fazai/web
ExecStart=/usr/bin/node /opt/fazai/web/docler-server.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOF

# Recarregar systemd
sudo systemctl daemon-reload

print_message "🎉 Instalação do DOCLER Web Server concluída!"

print_info "📋 Comandos disponíveis:"
echo "  • Iniciar servidor:     sudo systemctl start docler-web"
echo "  • Parar servidor:       sudo systemctl stop docler-web"
echo "  • Status do servidor:   sudo systemctl status docler-web"
echo "  • Habilitar no boot:    sudo systemctl enable docler-web"
echo ""
echo "  • Via CLI FazAI:        fazai docler start"
echo "  • Abrir interface:      fazai docler"
echo "  • Abrir admin:          fazai docler admin"
echo ""
print_info "🌐 URLs:"
echo "  • Cliente:              http://localhost:3120"
echo "  • Admin:                http://localhost:3121"

print_message "🚀 DOCLER Web Server está pronto para uso!"