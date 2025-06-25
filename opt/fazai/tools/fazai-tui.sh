#!/bin/bash
# FazAI - Interface TUI Dashboard Completa
# Caminho: /opt/fazai/tools/fazai-tui.sh
# Versão: 1.3.7

# Configurações
CONFIG_FILE="/etc/fazai/fazai.conf"
LOG_FILE="/var/log/fazai/fazai.log"
API_URL="http://localhost:3120"
DIALOG_TITLE="FazAI - Dashboard TUI"
VERSION="1.3.7"

# Cores para dialog
export DIALOGRC="/tmp/fazai_dialogrc"
cat > "$DIALOGRC" << 'EOF'
# FazAI Dialog Theme
screen_color = (CYAN,BLACK,ON)
shadow_color = (BLACK,BLACK,ON)
dialog_color = (BLACK,WHITE,OFF)
title_color = (BLUE,WHITE,ON)
border_color = (WHITE,WHITE,ON)
button_active_color = (WHITE,BLUE,ON)
button_inactive_color = (BLACK,WHITE,OFF)
button_key_active_color = (WHITE,BLUE,ON)
button_key_inactive_color = (RED,WHITE,OFF)
button_label_active_color = (YELLOW,BLUE,ON)
button_label_inactive_color = (BLACK,WHITE,ON)
inputbox_color = (BLACK,WHITE,OFF)
inputbox_border_color = (BLACK,WHITE,OFF)
searchbox_color = (BLACK,WHITE,OFF)
searchbox_title_color = (BLUE,WHITE,ON)
searchbox_border_color = (WHITE,WHITE,ON)
position_indicator_color = (BLUE,WHITE,ON)
menubox_color = (BLACK,WHITE,OFF)
menubox_border_color = (WHITE,WHITE,ON)
item_color = (BLACK,WHITE,OFF)
item_selected_color = (WHITE,BLUE,ON)
tag_color = (BLUE,WHITE,ON)
tag_selected_color = (YELLOW,BLUE,ON)
tag_key_color = (RED,WHITE,OFF)
tag_key_selected_color = (RED,BLUE,ON)
check_color = (BLACK,WHITE,OFF)
check_selected_color = (WHITE,BLUE,ON)
udarrow_color = (GREEN,WHITE,ON)
darrow_color = (GREEN,WHITE,ON)
itemhelp_color = (WHITE,BLACK,OFF)
form_active_text_color = (WHITE,BLUE,ON)
form_text_color = (WHITE,CYAN,ON)
form_item_readonly_color = (CYAN,WHITE,ON)
EOF

# Verifica dependências
check_dependencies() {
    local missing_deps=()
    
    if ! command -v dialog &>/dev/null; then
        missing_deps+=("dialog")
    fi
    
    if ! command -v curl &>/dev/null; then
        missing_deps+=("curl")
    fi
    
    if [ ${#missing_deps[@]} -gt 0 ]; then
        echo "ERRO: Dependências não encontradas: ${missing_deps[*]}"
        echo "Instale com: sudo apt-get install ${missing_deps[*]}"
        exit 1
    fi
}

# Função para fazer requisições à API
api_request() {
    local method="$1"
    local endpoint="$2"
    local data="$3"
    
    if [ "$method" = "GET" ]; then
        curl -s -X GET "$API_URL$endpoint" 2>/dev/null
    elif [ "$method" = "POST" ]; then
        if [ -n "$data" ]; then
            curl -s -X POST -H "Content-Type: application/json" -d "$data" "$API_URL$endpoint" 2>/dev/null
        else
            curl -s -X POST "$API_URL$endpoint" 2>/dev/null
        fi
    fi
}

# Função para verificar status do daemon
check_daemon_status() {
    local response=$(api_request "GET" "/status")
    if echo "$response" | grep -q '"success":true'; then
        echo "online"
    else
        echo "offline"
    fi
}

# Função para mostrar dashboard principal
show_dashboard() {
    local daemon_status=$(check_daemon_status)
    local node_version=$(node -v 2>/dev/null || echo "N/A")
    local npm_version=$(npm -v 2>/dev/null || echo "N/A")
    local service_status=$(systemctl is-active fazai 2>/dev/null || echo "inativo")
    
    local status_text="Status do Sistema:\n\n"
    status_text+="• Daemon FazAI: $daemon_status\n"
    status_text+="• Serviço systemd: $service_status\n"
    status_text+="• Node.js: $node_version\n"
    status_text+="• npm: $npm_version\n"
    status_text+="• Versão FazAI: $VERSION\n\n"
    status_text+="Pressione qualquer tecla para continuar..."
    
    dialog --backtitle "$DIALOG_TITLE" \
           --title "Dashboard - Status do Sistema" \
           --msgbox "$status_text" 15 60
}

# Função para executar comandos FazAI
execute_command() {
    local command=$(dialog --backtitle "$DIALOG_TITLE" \
                           --title "Executar Comando FazAI" \
                           --inputbox "Digite o comando para executar:" 10 60 \
                           3>&1 1>&2 2>&3)
    
    if [ -n "$command" ]; then
        local response=$(api_request "POST" "/command" "{\"command\":\"$command\"}")
        
        if [ -n "$response" ]; then
            echo "$response" | python3 -m json.tool > /tmp/fazai_command_result.txt 2>/dev/null || echo "$response" > /tmp/fazai_command_result.txt
            dialog --backtitle "$DIALOG_TITLE" \
                   --title "Resultado do Comando" \
                   --textbox /tmp/fazai_command_result.txt 20 80
            rm -f /tmp/fazai_command_result.txt
        else
            dialog --backtitle "$DIALOG_TITLE" \
                   --title "Erro" \
                   --msgbox "Erro ao executar comando. Verifique se o daemon está rodando." 8 50
        fi
    fi
}

# Função para gerenciar logs
manage_logs() {
    while true; do
        local choice=$(dialog --backtitle "$DIALOG_TITLE" \
                              --title "Gerenciamento de Logs" \
                              --menu "Escolha uma opção:" 15 60 5 \
                              1 "Ver Logs (últimas 20 linhas)" \
                              2 "Ver Logs (últimas 50 linhas)" \
                              3 "Limpar Logs" \
                              4 "Download Logs" \
                              5 "Voltar ao Menu Principal" \
                              3>&1 1>&2 2>&3)
        
        case $choice in
            1)
                view_logs 20
                ;;
            2)
                view_logs 50
                ;;
            3)
                clear_logs
                ;;
            4)
                download_logs
                ;;
            5|*)
                break
                ;;
        esac
    done
}

# Função para visualizar logs
view_logs() {
    local lines=${1:-20}
    local response=$(api_request "GET" "/logs?lines=$lines")
    
    if [ -n "$response" ]; then
        echo "$response" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    if data.get('success'):
        for log in data.get('logs', []):
            timestamp = log.get('timestamp', '')
            level = log.get('level', 'INFO').upper()
            message = log.get('message', '')
            print(f'[{timestamp}] {level}: {message}')
    else:
        print('Erro:', data.get('error', 'Erro desconhecido'))
except:
    print('Erro ao processar logs')
" > /tmp/fazai_logs.txt
        
        dialog --backtitle "$DIALOG_TITLE" \
               --title "Logs do Sistema (últimas $lines linhas)" \
               --textbox /tmp/fazai_logs.txt 20 100
        rm -f /tmp/fazai_logs.txt
    else
        dialog --backtitle "$DIALOG_TITLE" \
               --title "Erro" \
               --msgbox "Erro ao carregar logs. Verifique se o daemon está rodando." 8 50
    fi
}

# Função para limpar logs
clear_logs() {
    if dialog --backtitle "$DIALOG_TITLE" \
              --title "Confirmar Limpeza" \
              --yesno "Tem certeza que deseja limpar todos os logs?\n\nUm backup será criado automaticamente." 10 50; then
        
        local response=$(api_request "POST" "/logs/clear")
        
        if echo "$response" | grep -q '"success":true'; then
            local backup=$(echo "$response" | python3 -c "import sys,json; data=json.load(sys.stdin); print(data.get('backup', 'N/A'))" 2>/dev/null)
            dialog --backtitle "$DIALOG_TITLE" \
                   --title "Sucesso" \
                   --msgbox "Logs limpos com sucesso!\n\nBackup criado em:\n$backup" 10 60
        else
            dialog --backtitle "$DIALOG_TITLE" \
                   --title "Erro" \
                   --msgbox "Erro ao limpar logs. Verifique se o daemon está rodando." 8 50
        fi
    fi
}

# Função para download de logs
download_logs() {
    local download_path="/tmp/fazai-logs-$(date +%Y%m%d-%H%M%S).log"
    
    if curl -s "$API_URL/logs/download" -o "$download_path" 2>/dev/null; then
        dialog --backtitle "$DIALOG_TITLE" \
               --title "Download Concluído" \
               --msgbox "Logs salvos em:\n$download_path\n\nTamanho: $(du -h "$download_path" | cut -f1)" 10 60
    else
        dialog --backtitle "$DIALOG_TITLE" \
               --title "Erro" \
               --msgbox "Erro ao fazer download dos logs." 8 40
    fi
}

# Função para informações do sistema
system_info() {
    while true; do
        local choice=$(dialog --backtitle "$DIALOG_TITLE" \
                              --title "Informações do Sistema" \
                              --menu "Escolha uma opção:" 15 60 6 \
                              1 "Memória" \
                              2 "Disco" \
                              3 "Processos" \
                              4 "Rede" \
                              5 "CPU" \
                              6 "Voltar ao Menu Principal" \
                              3>&1 1>&2 2>&3)
        
        case $choice in
            1)
                show_system_command "memoria" "free -h"
                ;;
            2)
                show_system_command "disco" "df -h"
                ;;
            3)
                show_system_command "processos" "ps aux | head -20"
                ;;
            4)
                show_system_command "rede" "ip a"
                ;;
            5)
                show_system_command "cpu" "lscpu"
                ;;
            6|*)
                break
                ;;
        esac
    done
}

# Função para mostrar comando do sistema
show_system_command() {
    local title="$1"
    local command="$2"
    
    eval "$command" > /tmp/fazai_system_info.txt 2>&1
    dialog --backtitle "$DIALOG_TITLE" \
           --title "Informações: $title" \
           --textbox /tmp/fazai_system_info.txt 20 100
    rm -f /tmp/fazai_system_info.txt
}

# Função para controle do daemon
daemon_control() {
    while true; do
        local daemon_status=$(check_daemon_status)
        local service_status=$(systemctl is-active fazai 2>/dev/null || echo "inativo")
        
        local choice=$(dialog --backtitle "$DIALOG_TITLE" \
                              --title "Controle do Daemon (Status: $daemon_status)" \
                              --menu "Escolha uma opção:" 15 60 6 \
                              1 "Iniciar Serviço" \
                              2 "Parar Serviço" \
                              3 "Reiniciar Serviço" \
                              4 "Status Detalhado" \
                              5 "Recarregar Módulos" \
                              6 "Voltar ao Menu Principal" \
                              3>&1 1>&2 2>&3)
        
        case $choice in
            1)
                systemctl start fazai 2>/dev/null && \
                dialog --msgbox "Serviço iniciado!" 6 30 || \
                dialog --msgbox "Erro ao iniciar serviço!" 6 30
                ;;
            2)
                systemctl stop fazai 2>/dev/null && \
                dialog --msgbox "Serviço parado!" 6 30 || \
                dialog --msgbox "Erro ao parar serviço!" 6 30
                ;;
            3)
                systemctl restart fazai 2>/dev/null && \
                dialog --msgbox "Serviço reiniciado!" 6 30 || \
                dialog --msgbox "Erro ao reiniciar serviço!" 6 30
                ;;
            4)
                systemctl status fazai > /tmp/fazai_service_status.txt 2>&1
                dialog --textbox /tmp/fazai_service_status.txt 20 80
                rm -f /tmp/fazai_service_status.txt
                ;;
            5)
                reload_modules
                ;;
            6|*)
                break
                ;;
        esac
    done
}

# Função para recarregar módulos
reload_modules() {
    local response=$(api_request "POST" "/reload")
    
    if echo "$response" | grep -q '"success":true'; then
        dialog --backtitle "$DIALOG_TITLE" \
               --title "Sucesso" \
               --msgbox "Módulos recarregados com sucesso!" 8 40
    else
        dialog --backtitle "$DIALOG_TITLE" \
               --title "Erro" \
               --msgbox "Erro ao recarregar módulos. Verifique se o daemon está rodando." 8 50
    fi
}

# Função para configurações
configure_system() {
    while true; do
        local choice=$(dialog --backtitle "$DIALOG_TITLE" \
                              --title "Configurações" \
                              --menu "Escolha uma opção:" 15 60 4 \
                              1 "Configurar API Keys" \
                              2 "Configurações do Daemon" \
                              3 "Backup/Restore" \
                              4 "Voltar ao Menu Principal" \
                              3>&1 1>&2 2>&3)
        
        case $choice in
            1)
                configure_api_keys
                ;;
            2)
                configure_daemon
                ;;
            3)
                backup_restore
                ;;
            4|*)
                break
                ;;
        esac
    done
}

# Função para configurar API keys
configure_api_keys() {
    local openai_key=$(grep '^openai_api_key' "$CONFIG_FILE" 2>/dev/null | cut -d'=' -f2 | xargs)
    local anthropic_key=$(grep '^anthropic_api_key' "$CONFIG_FILE" 2>/dev/null | cut -d'=' -f2 | xargs)
    
    exec 3>&1
    local values=$(dialog --backtitle "$DIALOG_TITLE" \
                          --title "Configurar API Keys" \
                          --form "Preencha as chaves de API:" 15 70 2 \
                          "OpenAI API Key:" 1 1 "$openai_key" 1 20 40 0 \
                          "Anthropic API Key:" 2 1 "$anthropic_key" 2 20 40 0 \
                          2>&1 1>&3)
    exec 3>&-
    
    if [ $? -eq 0 ]; then
        local openai_new=$(echo "$values" | sed -n 1p)
        local anthropic_new=$(echo "$values" | sed -n 2p)
        
        if [ -n "$openai_new" ]; then
            if grep -q '^openai_api_key' "$CONFIG_FILE"; then
                sed -i "s|^openai_api_key.*|openai_api_key = $openai_new|" "$CONFIG_FILE"
            else
                echo "openai_api_key = $openai_new" >> "$CONFIG_FILE"
            fi
        fi
        
        if [ -n "$anthropic_new" ]; then
            if grep -q '^anthropic_api_key' "$CONFIG_FILE"; then
                sed -i "s|^anthropic_api_key.*|anthropic_api_key = $anthropic_new|" "$CONFIG_FILE"
            else
                echo "anthropic_api_key = $anthropic_new" >> "$CONFIG_FILE"
            fi
        fi
        
        dialog --backtitle "$DIALOG_TITLE" \
               --title "Sucesso" \
               --msgbox "API Keys configuradas com sucesso!" 8 40
    fi
}

# Função para configurar daemon
configure_daemon() {
    local port=$(grep '^daemon_port' "$CONFIG_FILE" 2>/dev/null | cut -d'=' -f2 | xargs || echo "3120")
    local log_level=$(grep '^log_level' "$CONFIG_FILE" 2>/dev/null | cut -d'=' -f2 | xargs || echo "info")
    
    exec 3>&1
    local values=$(dialog --backtitle "$DIALOG_TITLE" \
                          --title "Configurações do Daemon" \
                          --form "Configurações:" 12 60 2 \
                          "Porta:" 1 1 "$port" 1 10 10 0 \
                          "Log Level:" 2 1 "$log_level" 2 12 10 0 \
                          2>&1 1>&3)
    exec 3>&-
    
    if [ $? -eq 0 ]; then
        local new_port=$(echo "$values" | sed -n 1p)
        local new_log_level=$(echo "$values" | sed -n 2p)
        
        if [ -n "$new_port" ]; then
            if grep -q '^daemon_port' "$CONFIG_FILE"; then
                sed -i "s|^daemon_port.*|daemon_port = $new_port|" "$CONFIG_FILE"
            else
                echo "daemon_port = $new_port" >> "$CONFIG_FILE"
            fi
        fi
        
        if [ -n "$new_log_level" ]; then
            if grep -q '^log_level' "$CONFIG_FILE"; then
                sed -i "s|^log_level.*|log_level = $new_log_level|" "$CONFIG_FILE"
            else
                echo "log_level = $new_log_level" >> "$CONFIG_FILE"
            fi
        fi
        
        dialog --backtitle "$DIALOG_TITLE" \
               --title "Sucesso" \
               --msgbox "Configurações salvas! Reinicie o daemon para aplicar." 8 50
    fi
}

# Função para backup/restore
backup_restore() {
    local choice=$(dialog --backtitle "$DIALOG_TITLE" \
                          --title "Backup/Restore" \
                          --menu "Escolha uma opção:" 12 50 3 \
                          1 "Criar Backup" \
                          2 "Restaurar Backup" \
                          3 "Voltar" \
                          3>&1 1>&2 2>&3)
    
    case $choice in
        1)
            fazai-backup 2>/dev/null && \
            dialog --msgbox "Backup criado em /tmp/" 6 30 || \
            dialog --msgbox "Erro ao criar backup!" 6 30
            ;;
        2)
            dialog --msgbox "Funcionalidade de restore em desenvolvimento." 8 40
            ;;
        *)
            ;;
    esac
}

# Função para mostrar ajuda
show_help() {
    local help_text="FazAI Dashboard TUI v$VERSION\n\n"
    help_text+="Navegação:\n"
    help_text+="• Use as setas para navegar\n"
    help_text+="• Enter para selecionar\n"
    help_text+="• Tab para alternar entre campos\n"
    help_text+="• Esc para voltar/cancelar\n\n"
    help_text+="Funcionalidades:\n"
    help_text+="• Dashboard com status do sistema\n"
    help_text+="• Execução de comandos FazAI\n"
    help_text+="• Gerenciamento completo de logs\n"
    help_text+="• Informações detalhadas do sistema\n"
    help_text+="• Controle do daemon\n"
    help_text+="• Configurações avançadas\n\n"
    help_text+="Para mais informações: fazai --help"
    
    dialog --backtitle "$DIALOG_TITLE" \
           --title "Ajuda" \
           --msgbox "$help_text" 20 60
}

# Menu principal
main_menu() {
    while true; do
        local daemon_status=$(check_daemon_status)
        local choice=$(dialog --backtitle "$DIALOG_TITLE v$VERSION" \
                              --title "Menu Principal (Daemon: $daemon_status)" \
                              --menu "Escolha uma opção:" 18 70 8 \
                              1 "📊 Dashboard" \
                              2 "⚡ Executar Comando" \
                              3 "📋 Gerenciar Logs" \
                              4 "💻 Informações do Sistema" \
                              5 "🔧 Controle do Daemon" \
                              6 "⚙️  Configurações" \
                              7 "❓ Ajuda" \
                              8 "🚪 Sair" \
                              3>&1 1>&2 2>&3)
        
        case $choice in
            1)
                show_dashboard
                ;;
            2)
                execute_command
                ;;
            3)
                manage_logs
                ;;
            4)
                system_info
                ;;
            5)
                daemon_control
                ;;
            6)
                configure_system
                ;;
            7)
                show_help
                ;;
            8|*)
                clear
                echo "Obrigado por usar o FazAI Dashboard TUI!"
                exit 0
                ;;
        esac
    done
}

# Função de inicializa��ão
init() {
    # Verifica dependências
    check_dependencies
    
    # Verifica se está rodando como root para algumas operações
    if [ "$EUID" -ne 0 ]; then
        dialog --backtitle "$DIALOG_TITLE" \
               --title "Aviso" \
               --msgbox "Algumas funcionalidades requerem privilégios de root.\nExecute com sudo para acesso completo." 10 50
    fi
    
    # Tela de boas-vindas
    dialog --backtitle "$DIALOG_TITLE" \
           --title "Bem-vindo ao FazAI Dashboard TUI" \
           --msgbox "FazAI Dashboard TUI v$VERSION\n\nInterface completa para gerenciamento do FazAI\nbaseada em ncurses/dialog.\n\nPressione Enter para continuar..." 12 60
    
    # Inicia menu principal
    main_menu
}

# Limpeza ao sair
cleanup() {
    rm -f /tmp/fazai_*.txt
    rm -f "$DIALOGRC"
    clear
}

# Configura trap para limpeza
trap cleanup EXIT

# Inicia aplicação
init
