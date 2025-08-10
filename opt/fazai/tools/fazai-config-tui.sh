#!/bin/bash
# FazAI - Interface TUI baseada em ncurses/dialog
# Caminho: /opt/fazai/tools/fazai-config-tui.sh

CONFIG_FILE="/etc/fazai/fazai.conf"
LOG_FILE="/var/log/fazai/fazai.log"
DIALOG_TITLE="FazAI - Configuração TUI"

# Verifica dependência do dialog
if ! command -v dialog &>/dev/null; then
    echo "[ERRO] O utilitário 'dialog' não está instalado. Instale com: sudo apt-get install dialog"
    exit 1
fi

# Função para mostrar status do sistema
show_status() {
    STATUS=""
    NODE=$(command -v node && node -v 2>/dev/null || echo 'Não instalado')
    NPM=$(command -v npm && npm -v 2>/dev/null || echo 'Não instalado')
    SERVICE=$(systemctl is-active fazai 2>/dev/null || echo 'inativo')
    STATUS+="Node.js: $NODE\n"
    STATUS+="npm: $NPM\n"
    STATUS+="Serviço FazAI: $SERVICE\n"
    dialog --backtitle "$DIALOG_TITLE" --title "Status do Sistema" --msgbox "$STATUS" 12 60
}

# Função para configurar chaves de API
configure_api_keys() {
    OPENAI_KEY=$(grep '^openai_api_key' "$CONFIG_FILE" 2>/dev/null | cut -d'=' -f2 | xargs)
    ANTHROPIC_KEY=$(grep '^anthropic_api_key' "$CONFIG_FILE" 2>/dev/null | cut -d'=' -f2 | xargs)
    exec 3>&1
    VALUES=$(dialog --backtitle "$DIALOG_TITLE" --title "Configurar API Keys" \
        --form "Preencha as chaves de API (deixe em branco para não alterar):" 15 70 2 \
        "OpenAI API Key:" 1 1 "$OPENAI_KEY" 1 25 40 0 \
        "Anthropic API Key:" 2 1 "$ANTHROPIC_KEY" 2 25 40 0 \
        2>&1 1>&3)
    exec 3>&-
    OPENAI_NEW=$(echo "$VALUES" | sed -n 1p)
    ANTHROPIC_NEW=$(echo "$VALUES" | sed -n 2p)
    
    if [ -n "$OPENAI_NEW" ]; then
        if grep -q '^openai_api_key' "$CONFIG_FILE"; then
            sed -i "s|^openai_api_key.*|openai_api_key = $OPENAI_NEW|" "$CONFIG_FILE"
        else
            echo "openai_api_key = $OPENAI_NEW" >> "$CONFIG_FILE"
        fi
    fi
    if [ -n "$ANTHROPIC_NEW" ]; then
        if grep -q '^anthropic_api_key' "$CONFIG_FILE"; then
            sed -i "s|^anthropic_api_key.*|anthropic_api_key = $ANTHROPIC_NEW|" "$CONFIG_FILE"
        else
            echo "anthropic_api_key = $ANTHROPIC_NEW" >> "$CONFIG_FILE"
        fi
    fi
    dialog --backtitle "$DIALOG_TITLE" --title "API Keys" --msgbox "Chaves de API salvas com sucesso!" 7 50
}

# Função para visualizar logs
show_logs() {
    if [ ! -f "$LOG_FILE" ]; then
        dialog --backtitle "$DIALOG_TITLE" --title "Logs" --msgbox "Arquivo de log não encontrado: $LOG_FILE" 7 60
        return
    fi
    tail -n 20 "$LOG_FILE" > /tmp/fazai_tui_logs.txt
    dialog --backtitle "$DIALOG_TITLE" --title "Últimos 20 logs" --textbox /tmp/fazai_tui_logs.txt 20 80
    rm -f /tmp/fazai_tui_logs.txt
}

# Função para gerenciar serviço
manage_service() {
    CHOICE=$(dialog --backtitle "$DIALOG_TITLE" --title "Gerenciar Serviço FazAI" \
        --menu "Escolha uma ação:" 15 50 5 \
        1 "Iniciar FazAI" \
        2 "Parar FazAI" \
        3 "Reiniciar FazAI" \
        4 "Status do FazAI" \
        5 "Voltar" \
        3>&1 1>&2 2>&3)
    case $CHOICE in
        1)
            systemctl start fazai && dialog --msgbox "FazAI iniciado!" 6 30
            ;;
        2)
            systemctl stop fazai && dialog --msgbox "FazAI parado!" 6 30
            ;;
        3)
            systemctl restart fazai && dialog --msgbox "FazAI reiniciado!" 6 30
            ;;
        4)
            systemctl status fazai > /tmp/fazai_tui_status.txt 2>&1
            dialog --textbox /tmp/fazai_tui_status.txt 20 80
            rm -f /tmp/fazai_tui_status.txt
            ;;
        *)
            ;;
    esac
}

# Loop principal
while true; do
    CHOICE=$(dialog --backtitle "$DIALOG_TITLE" --title "Menu Principal" \
        --menu "Selecione uma opção:" 15 60 6 \
        1 "Status do Sistema" \
        2 "Configurar API Keys" \
        3 "Ver Logs do Sistema" \
        4 "Gerenciar Serviço FazAI" \
        5 "Sair" \
        3>&1 1>&2 2>&3)
    case $CHOICE in
        1)
            show_status
            ;;
        2)
            configure_api_keys
            ;;
        3)
            show_logs
            ;;
        4)
            manage_service
            ;;
        5|*)
            clear
            exit 0
            ;;
    esac
done
