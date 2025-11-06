#!/bin/bash

# FazAI Gmail MCP Server - Script de Teste e Demonstração
# Versão: 1.0.0

set -e

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m' 
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m'

print_banner() {
    echo -e "${CYAN}"
    cat << "EOF"
🧪 ======================================================== 🧪
     FAZAI GMAIL MCP SERVER - TESTE E DEMONSTRAÇÃO
🧪 ======================================================== 🧪
EOF
    echo -e "${NC}"
}

print_status() { echo -e "${GREEN}[✓]${NC} $1"; }
print_warning() { echo -e "${YELLOW}[⚠]${NC} $1"; }
print_error() { echo -e "${RED}[✗]${NC} $1"; }
print_step() { echo -e "${BLUE}[→]${NC} $1"; }
print_info() { echo -e "${PURPLE}[ℹ]${NC} $1"; }

# Configurações
INSTALL_DIR="$HOME/.local/share/fazai-gmail-mcp-server"
BIN_DIR="$HOME/.local/bin" 
CONFIG_DIR="$HOME/.config/fazai-gmail-mcp-server"
CLAUDE_CONFIG="$HOME/.config/Claude/claude_desktop_config.json"

check_prerequisites() {
    print_step "Verificando pré-requisitos..."
    
    local all_good=true
    
    # Node.js
    if command -v node &> /dev/null; then
        local node_version=$(node -v)
        print_status "Node.js $node_version encontrado"
    else
        print_error "Node.js não encontrado"
        all_good=false
    fi
    
    # FazAI
    if command -v fazai &> /dev/null; then
        local fazai_version=$(fazai --version 2>/dev/null || echo "detectado")
        print_status "FazAI $fazai_version encontrado"
    else
        print_warning "FazAI não encontrado - algumas funcionalidades ficaram limitadas"
    fi
    
    # Claude Desktop
    if [[ -f "$CLAUDE_CONFIG" ]]; then
        print_status "Claude Desktop configurado"
    else
        print_warning "Configuração Claude Desktop não encontrada"
    fi
    
    # Servidor MCP
    if [[ -f "$INSTALL_DIR/dist/server.js" ]]; then
        print_status "Servidor MCP compilado"
    else
        print_error "Servidor MCP não encontrado - execute o instalador primeiro"
        all_good=false
    fi
    
    if [[ "$all_good" == false ]]; then
        echo
        print_error "Alguns pré-requisitos não foram atendidos"
        print_info "Execute: curl -fsSL https://github.com/RLuf/fazai-gmail-mcp/raw/main/install.sh | bash"
        exit 1
    fi
    
    echo
    print_status "Todos os pré-requisitos verificados!"
}

test_gmail_connection() {
    print_step "Testando conexão Gmail..."
    
    # Verificar se credenciais estão configuradas
    if [[ ! -f "$INSTALL_DIR/.env" ]]; then
        print_error "Arquivo .env não encontrado"
        print_info "Configure suas credenciais Gmail em: $INSTALL_DIR/.env"
        return 1
    fi
    
    # Verificar se token existe
    if [[ -f "$INSTALL_DIR/gmail-token.json" ]]; then
        print_status "Token Gmail encontrado"
    else
        print_warning "Token Gmail não encontrado"
        print_info "Execute: cd $INSTALL_DIR && npm run auth:setup"
    fi
}

test_fazai_integration() {
    print_step "Testando integração FazAI..."
    
    if command -v fazai &> /dev/null; then
        # Teste básico do FazAI
        local test_output
        if test_output=$(timeout 10s fazai --dry-run --no-confirm ask "teste de conectividade" 2>&1); then
            print_status "FazAI respondeu corretamente"
        else
            print_warning "FazAI pode não estar configurado corretamente"
            print_info "Output: ${test_output:0:100}..."
        fi
    else
        print_warning "FazAI não disponível para teste"
    fi
}

test_mcp_server() {
    print_step "Testando servidor MCP..."
    
    cd "$INSTALL_DIR"
    
    # Teste de inicialização rápida
    local server_pid
    timeout 5s node dist/server.js &
    server_pid=$!
    
    sleep 2
    
    if ps -p $server_pid > /dev/null; then
        print_status "Servidor MCP iniciou corretamente"
        kill $server_pid 2>/dev/null || true
    else
        print_error "Servidor MCP falhou ao iniciar"
        return 1
    fi
}

demo_mode() {
    print_step "Iniciando modo demonstração..."
    
    echo
    cat << EOF
🎯 DEMONSTRAÇÃO INTERATIVA

Este modo simula como o MCP server funcionaria integrado ao Claude Desktop.
Vamos simular alguns cenários típicos de uso.

EOF

    echo -e "${CYAN}Cenário 1: Verificação de emails por exports${NC}"
    echo "Simulando: 'Verifique se chegaram emails com instruções para exports'"
    echo
    
    # Simular busca Gmail
    print_info "🔍 Buscando emails com: 'export conversation chat download takeout'"
    sleep 1
    print_info "📧 Analisando 15 emails encontrados..."
    sleep 1
    print_status "📨 Encontrados 2 emails com links de export!"
    
    echo
    echo -e "${GREEN}Resultado simulado:${NC}"
    cat << EOF
• **Your Google Takeout export is ready**
  De: noreply@accounts.google.com
  Data: 2025-11-04 
  Links: 1 encontrado
  
• **Chat export download ready**  
  De: workspace-exports@google.com
  Data: 2025-11-03
  Links: 1 encontrado
EOF
    
    echo
    read -p "Pressione Enter para continuar..."
    
    echo -e "${CYAN}Cenário 2: Download automático de export${NC}"
    echo "Simulando download de export encontrado..."
    echo
    
    print_info "⬇️ Iniciando download de: https://takeout.google.com/export-12345"
    sleep 1
    print_info "📊 Tamanho: 1.2GB - Progresso: 25%"  
    sleep 1
    print_info "📊 Progresso: 75%"
    sleep 1
    print_status "✅ Download concluído: ./downloads/chat-export-1730875200.zip"
    
    echo
    echo -e "${GREEN}Export baixado com sucesso!${NC}"
    echo "📁 Arquivo: ./downloads/chat-export-1730875200.zip"
    echo "📊 Tamanho: 1.2GB"
    echo "⏰ Data: $(date)"
    
    echo
    read -p "Pressione Enter para continuar..."
    
    echo -e "${CYAN}Cenário 3: Administração Linux via FazAI${NC}"
    echo "Simulando: 'Configure nginx como proxy reverso para porta 3000'"
    echo
    
    if command -v fazai &> /dev/null; then
        print_info "🤖 Executando FazAI com comando real..."
        
        # Executar FazAI em modo dry-run
        local fazai_output
        if fazai_output=$(timeout 30s fazai --dry-run --no-confirm ask "configurar nginx como proxy reverso para porta 3000" 2>&1); then
            print_status "✅ FazAI processou o comando!"
            echo
            echo -e "${GREEN}Output do FazAI:${NC}"
            echo "${fazai_output:0:800}"
            [[ ${#fazai_output} -gt 800 ]] && echo "..."
        else
            print_warning "⚠️ FazAI não pôde processar (timeout ou erro)"
        fi
    else
        print_info "🎭 Simulando resposta do FazAI..."
        sleep 2
        
        cat << EOF

🔧 Comando 1:
┌─────────────────────────────────────────────┐
│ Instalar nginx                              │
└─────────────────────────────────────────────┘
Comando: apt update && apt install -y nginx
Risco: MEDIUM
Rollback: apt remove -y nginx

🔧 Comando 2:  
┌─────────────────────────────────────────────┐
│ Configurar proxy reverso                    │
└─────────────────────────────────────────────┘
Comando: cat > /etc/nginx/sites-available/proxy <<EOF
server {
    listen 80;
    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host \$host;
    }
}
EOF
Risco: LOW

EOF
    fi
    
    echo
    read -p "Pressione Enter para continuar..."
    
    echo -e "${CYAN}Cenário 4: Streaming interativo${NC}"
    echo "Simulando sessão CLI streaming do FazAI..."
    echo
    
    print_info "🚀 Iniciando stream FazAI CLI..."
    sleep 1
    print_status "📺 Stream ativo em: http://localhost:3001/stream"
    print_info "💬 Modo: interativo"
    print_info "🔗 WebSocket conectado"
    
    echo
    echo -e "${GREEN}Stream simulado ativo!${NC}"
    echo "Use Claude Desktop para enviar comandos via streaming."
    
    echo
}

interactive_menu() {
    while true; do
        echo
        echo -e "${PURPLE}=========================="
        echo -e "    MENU DE TESTES"  
        echo -e "==========================${NC}"
        echo
        echo "1. 🔍 Verificar pré-requisitos"
        echo "2. 📧 Testar conexão Gmail"
        echo "3. 🤖 Testar integração FazAI" 
        echo "4. 🖥️ Testar servidor MCP"
        echo "5. 🎭 Modo demonstração completa"
        echo "6. 📋 Ver configurações"
        echo "7. 🔧 Executar diagnóstico completo"
        echo "8. 📊 Ver logs do servidor"
        echo "9. 🚫 Sair"
        echo
        
        read -p "Escolha uma opção (1-9): " choice
        
        case $choice in
            1) check_prerequisites ;;
            2) test_gmail_connection ;;
            3) test_fazai_integration ;;
            4) test_mcp_server ;;
            5) demo_mode ;;
            6) show_config ;;
            7) run_diagnostics ;;
            8) show_logs ;;
            9) 
                echo -e "${GREEN}👋 Obrigado por testar o FazAI Gmail MCP Server!${NC}"
                exit 0 
                ;;
            *) 
                print_error "Opção inválida: $choice"
                ;;
        esac
        
        echo
        read -p "Pressione Enter para voltar ao menu..."
    done
}

show_config() {
    print_step "Mostrando configurações..."
    
    echo -e "${YELLOW}📍 Localizações:${NC}"
    echo "   Instalação: $INSTALL_DIR"
    echo "   Executável: $BIN_DIR/fazai-gmail-mcp"
    echo "   Config: $INSTALL_DIR/.env"  
    echo "   Claude: $CLAUDE_CONFIG"
    echo
    
    if [[ -f "$INSTALL_DIR/.env" ]]; then
        echo -e "${YELLOW}⚙️ Configurações (.env):${NC}"
        grep -E '^[A-Z]' "$INSTALL_DIR/.env" | head -10
    else
        print_warning "Arquivo .env não encontrado"
    fi
    
    echo
    if [[ -f "$CLAUDE_CONFIG" ]]; then
        echo -e "${YELLOW}🖥️ Claude Desktop Config:${NC}"
        cat "$CLAUDE_CONFIG" | jq . 2>/dev/null || cat "$CLAUDE_CONFIG"
    else
        print_warning "Configuração Claude Desktop não encontrada"
    fi
}

run_diagnostics() {
    print_step "Executando diagnóstico completo..."
    echo
    
    # Sistema
    print_info "💻 Sistema:"
    echo "   OS: $(uname -s) $(uname -r)"
    echo "   User: $(whoami)"
    echo "   PWD: $(pwd)"
    echo
    
    # Node.js e npm
    print_info "📦 Node.js:"
    if command -v node &> /dev/null; then
        echo "   Node: $(node -v)"
        echo "   npm: $(npm -v)"
    else
        print_error "   Node.js não encontrado"
    fi
    echo
    
    # FazAI
    print_info "🤖 FazAI:"
    if command -v fazai &> /dev/null; then
        echo "   Path: $(which fazai)"
        echo "   Version: $(fazai --version 2>/dev/null || echo 'Erro')"
        
        # Testar configuração FazAI
        if fazai config &>/dev/null; then
            print_status "   Configuração: OK"
        else
            print_warning "   Configuração: Incompleta"
        fi
    else
        print_error "   FazAI não encontrado"
    fi
    echo
    
    # MCP Server
    print_info "🔧 MCP Server:"
    if [[ -d "$INSTALL_DIR" ]]; then
        echo "   Diretório: $INSTALL_DIR ✓"
        
        if [[ -f "$INSTALL_DIR/package.json" ]]; then
            local version=$(jq -r .version "$INSTALL_DIR/package.json" 2>/dev/null || echo "unknown")
            echo "   Versão: $version"
        fi
        
        if [[ -f "$INSTALL_DIR/dist/server.js" ]]; then
            print_status "   Build: OK"
        else
            print_error "   Build: Não encontrado"
        fi
        
        if [[ -f "$INSTALL_DIR/.env" ]]; then
            print_status "   Configuração: OK"
        else
            print_error "   Configuração: .env não encontrado"
        fi
    else
        print_error "   Diretório não encontrado"
    fi
    echo
    
    # Claude Desktop
    print_info "🖥️ Claude Desktop:"
    if [[ -f "$CLAUDE_CONFIG" ]]; then
        print_status "   Config encontrado: $CLAUDE_CONFIG"
        
        if grep -q "fazai-gmail-mcp" "$CLAUDE_CONFIG" 2>/dev/null; then
            print_status "   MCP configurado no Claude"
        else
            print_warning "   MCP não configurado no Claude"
        fi
    else
        print_warning "   Claude Desktop não configurado"
    fi
    echo
    
    # Rede e conectividade
    print_info "🌐 Conectividade:"
    if ping -c 1 google.com &>/dev/null; then
        print_status "   Internet: OK"
    else
        print_error "   Internet: Falha"
    fi
    
    if command -v curl &>/dev/null; then
        if curl -s "https://gmail.googleapis.com" > /dev/null; then
            print_status "   Gmail API: Acessível"
        else
            print_error "   Gmail API: Inacessível"
        fi
    fi
    echo
    
    print_status "Diagnóstico concluído!"
}

show_logs() {
    print_step "Mostrando logs do servidor..."
    
    local log_file="$INSTALL_DIR/fazai-gmail-mcp.log"
    
    if [[ -f "$log_file" ]]; then
        echo -e "${YELLOW}📋 Últimas 20 linhas do log:${NC}"
        echo "────────────────────────────────────────"
        tail -20 "$log_file"
        echo "────────────────────────────────────────"
    else
        print_warning "Arquivo de log não encontrado: $log_file"
    fi
    
    # Logs do sistema
    if [[ -f "/var/log/fazai/fazai.log" ]]; then
        echo
        echo -e "${YELLOW}📋 FazAI system logs (últimas 10 linhas):${NC}"
        echo "────────────────────────────────────────"
        tail -10 /var/log/fazai/fazai.log
        echo "────────────────────────────────────────"
    fi
}

quick_test() {
    print_step "Executando teste rápido..."
    
    check_prerequisites
    test_gmail_connection
    test_fazai_integration  
    test_mcp_server
    
    echo
    print_status "🎉 Teste rápido concluído!"
    
    cat << EOF

📋 RESULTADO DO TESTE:
   ✅ Pré-requisitos verificados
   📧 Gmail: $([ -f "$INSTALL_DIR/gmail-token.json" ] && echo "Configurado" || echo "Requer configuração")
   🤖 FazAI: $(command -v fazai &>/dev/null && echo "Disponível" || echo "Não encontrado")
   🔧 MCP Server: $([ -f "$INSTALL_DIR/dist/server.js" ] && echo "Pronto" || echo "Requer build")

🚀 PRÓXIMOS PASSOS:
   1. Configure Gmail API (se ainda não feito)
   2. Reinicie Claude Desktop
   3. Teste integração via Claude: "Verifique meus emails por exports"

EOF
}

# Função principal
main() {
    print_banner
    
    # Verificar argumentos
    case "${1:-}" in
        --quick|-q)
            quick_test
            ;;
        --demo|-d) 
            demo_mode
            ;;
        --help|-h)
            cat << EOF
🧪 FAZAI GMAIL MCP SERVER - SCRIPT DE TESTE

USO:
   $0 [opção]

OPÇÕES:
   --quick, -q     Teste rápido de todos os componentes
   --demo, -d      Modo demonstração interativa
   --help, -h      Mostra esta ajuda
   (sem opção)     Menu interativo

EXEMPLOS:
   $0              # Menu interativo
   $0 --quick      # Teste rápido
   $0 --demo       # Demonstração
   
LOCALIZAÇÃO DOS ARQUIVOS:
   Instalação: $INSTALL_DIR
   Configuração: $INSTALL_DIR/.env
   Claude Config: $CLAUDE_CONFIG

EOF
            ;;
        *)
            interactive_menu
            ;;
    esac
}

# Executar
main "$@"