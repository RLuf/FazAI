#!/bin/bash

# FazAI - Script de Desinstalação
# Este script remove o FazAI do sistema

# Cores para saída no terminal
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Função para exibir mensagens
print_message() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCESSO]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERRO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[AVISO]${NC} $1"
}

# Verifica se está sendo executado como root
if [ "$EUID" -ne 0 ]; then
    print_error "Este script precisa ser executado como root (sudo)."
    exit 1
fi

# Cabeçalho
echo -e "${BLUE}=================================================${NC}"
echo -e "${BLUE}       FazAI - Desinstalação Automatizada        ${NC}"
echo -e "${BLUE}=================================================${NC}"
echo

# Pergunta se deseja preservar configurações
read -p "Deseja preservar arquivos de configuração? (s/n): " -n 1 -r
echo
PRESERVE_CONFIG=false
if [[ $REPLY =~ ^[Ss]$ ]]; then
    PRESERVE_CONFIG=true
    print_message "Arquivos de configuração serão preservados."
else
    print_warning "Todos os arquivos, incluindo configurações, serão removidos."
fi

# Confirmação final
echo
print_warning "Esta ação removerá o FazAI do seu sistema."
read -p "Tem certeza que deseja continuar? (s/n): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Ss]$ ]]; then
    print_message "Desinstalação cancelada."
    exit 0
fi

# Para o serviço
print_message "Parando o serviço FazAI..."
systemctl stop fazai
print_success "Serviço parado."

# Desabilita o serviço
print_message "Desabilitando o serviço..."
systemctl disable fazai
print_success "Serviço desabilitado."

# Backup de configurações se solicitado
if [ "$PRESERVE_CONFIG" = true ]; then
    print_message "Fazendo backup das configurações..."
    BACKUP_DIR="/tmp/fazai_config_backup_$(date +%Y%m%d%H%M%S)"
    mkdir -p "$BACKUP_DIR"
    
    # Copia arquivos de configuração
    if [ -f /etc/fazai/fazai.conf ]; then
        cp /etc/fazai/fazai.conf "$BACKUP_DIR/"
    fi
    
    # Outros arquivos de configuração que possam existir
    # cp /etc/fazai/outros_arquivos.conf "$BACKUP_DIR/"
    
    print_success "Backup criado em $BACKUP_DIR"
fi

# Remove arquivos do sistema
print_message "Removendo arquivos do sistema..."

# Remove o executável CLI e link simbólico
if [ -f /usr/local/bin/fazai ]; then
    rm -f /usr/local/bin/fazai
    print_success "Link simbólico do CLI removido."
else
    print_warning "Link simbólico do CLI não encontrado."
fi

# Remove o serviço systemd
if [ -f /etc/systemd/system/fazai.service ]; then
    rm -f /etc/systemd/system/fazai.service
    print_success "Serviço systemd removido."
else
    print_warning "Arquivo de serviço não encontrado."
fi

# Preserva ou remove configurações
if [ "$PRESERVE_CONFIG" = true ]; then
    # Faz backup das configurações
    print_message "Fazendo backup das configurações..."
    BACKUP_DIR="/tmp/fazai_config_backup_$(date +%Y%m%d%H%M%S)"
    mkdir -p "$BACKUP_DIR"
    
    # Copia arquivos de configuração
    if [ -f /etc/fazai/fazai.conf ]; then
        cp /etc/fazai/fazai.conf "$BACKUP_DIR/"
        print_success "Configuração principal salva em $BACKUP_DIR/fazai.conf"
    fi
    
    # Remove diretório de código
    print_message "Removendo diretório de código..."
    rm -rf /opt/fazai
    print_success "Diretório /opt/fazai removido."
    
    print_message "Configurações preservadas em /etc/fazai/"
else
    # Remove tudo
    print_message "Removendo todos os arquivos e diretórios..."
    rm -rf /opt/fazai
    rm -rf /etc/fazai
    print_success "Diretórios /opt/fazai e /etc/fazai removidos."
fi

# Opcionalmente, remove diretórios de dados
read -p "Deseja remover também os dados e logs? (s/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Ss]$ ]]; then
    rm -rf /var/lib/fazai
    rm -rf /var/log/fazai
    print_success "Dados e logs removidos."
else
    print_message "Dados e logs preservados."
fi

# Opcionalmente, preserva dados de treinamento
if [ -d "/var/lib/fazai/training" ] && [[ ! $REPLY =~ ^[Ss]$ ]]; then
    read -p "Deseja preservar os dados de treinamento? (s/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Ss]$ ]]; then
        TRAINING_BACKUP="/tmp/fazai_training_backup_$(date +%Y%m%d%H%M%S)"
        mkdir -p "$TRAINING_BACKUP"
        cp -r /var/lib/fazai/training/* "$TRAINING_BACKUP/"
        print_success "Dados de treinamento preservados em $TRAINING_BACKUP"
    fi
fi

# Recarrega o daemon do systemd
print_message "Recarregando o daemon do systemd..."
systemctl daemon-reload
print_success "Daemon recarregado."

# Conclusão
echo
echo -e "${GREEN}=================================================${NC}"
echo -e "${GREEN}       FazAI desinstalado com sucesso!           ${NC}"
echo -e "${GREEN}=================================================${NC}"
echo

if [ "$PRESERVE_CONFIG" = true ]; then
    echo -e "${YELLOW}[IMPORTANTE]${NC} Arquivos de configuração foram preservados em /etc/fazai/"
    echo -e "Backup adicional disponível em: ${BLUE}$BACKUP_DIR${NC}"
fi

exit 0
