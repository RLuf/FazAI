#!/usr/bin/bash

# Script para sincronizar chaves do .env com o fazai.conf
# Este script lê as chaves do arquivo .env e as atualiza no fazai.conf

# Configurações
ENV_FILE="/root/.env"
FAZAI_CONF="/etc/fazai/fazai.conf"
BACKUP_DIR="/var/backups/fazai"
DATE=$(date '+%Y%m%d_%H%M%S')

# Criar diretório de backup se não existir
mkdir -p "$BACKUP_DIR"

# Fazer backup do arquivo de configuração atual
cp "$FAZAI_CONF" "$BACKUP_DIR/fazai.conf_$DATE"

# Função para extrair chaves do .env
extract_keys() {
    if [ ! -f "$ENV_FILE" ]; then
        echo "Arquivo .env não encontrado em $ENV_FILE"
        exit 1
    fi

    # Extrair chaves relacionadas a APIs e processar uma por vez
    while IFS='=' read -r key value; do
        # Pular linhas vazias ou comentários
        [[ -z "$key" || "$key" =~ ^[[:space:]]*# ]] && continue
        
        # Determinar a seção baseada no nome da chave
        section=""
        case "$key" in
            *OPENAI*) section="openai" ;;
            *OPENROUTER*) section="openrouter" ;;
            *REQUESTY*) section="requesty" ;;
            *ANTHROPIC*) section="anthropic" ;;
            *OLLAMA*) section="ollama" ;;
            *) section="other" ;;
        esac
        
        # Atualizar o valor no fazai.conf
        update_config "$section" "$key" "$value"
    done < <(grep -E "^[A-Z_]+(KEY|TOKEN|SECRET)=" "$ENV_FILE")
}

# Função para atualizar configuração
update_config() {
    local section=$1
    local key=$2
    local value=$3
    
    # Verificar se a seção existe
    if ! grep -q "^\[$section\]" "$FAZAI_CONF"; then
        echo -e "\n[$section]" >> "$FAZAI_CONF"
    fi
    
    # Atualizar ou adicionar a chave
    if grep -q "^$key=" "$FAZAI_CONF"; then
        sed -i "s|^$key=.*|$key=$value|" "$FAZAI_CONF"
    else
        sed -i "/\[$section\]/a $key=$value" "$FAZAI_CONF"
    fi
}

# Executar
echo "Iniciando sincronização de chaves..."
extract_keys
echo "Sincronização concluída. Backup salvo em: $BACKUP_DIR/fazai.conf_$DATE"
