#!/bin/bash

# FazAI - Script de Reinstalação
# Este script reinstala o FazAI, permitindo testar diferentes versões

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
echo -e "${BLUE}       FazAI - Reinstalação Automatizada         ${NC}"
echo -e "${BLUE}=================================================${NC}"
echo

# Verifica se o FazAI está instalado
if [ ! -d "/etc/fazai" ] && [ ! -f "/bin/fazai" ]; then
    print_warning "FazAI não parece estar instalado. Este script é para reinstalação."
    read -p "Deseja continuar com uma instalação limpa? (s/n): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Ss]$ ]]; then
        print_message "Operação cancelada."
        exit 0
    fi
fi

# Backup de configurações
print_message "Fazendo backup das configurações existentes..."
BACKUP_DIR="/tmp/fazai_backup_$(date +%Y%m%d%H%M%S)"
mkdir -p "$BACKUP_DIR"

# Copia arquivos de configuração se existirem
if [ -f "/etc/fazai/fazai.conf" ]; then
    cp /etc/fazai/fazai.conf "$BACKUP_DIR/"
    print_success "Configuração principal salva."
fi

# Backup de outros arquivos importantes
if [ -d "/etc/fazai/tools" ]; then
    mkdir -p "$BACKUP_DIR/tools"
    cp -r /etc/fazai/tools/* "$BACKUP_DIR/tools/"
    print_success "Plugins personalizados salvos."
fi

if [ -d "/etc/fazai/mods" ]; then
    mkdir -p "$BACKUP_DIR/mods"
    cp -r /etc/fazai/mods/* "$BACKUP_DIR/mods/"
    print_success "Módulos personalizados salvos."
fi

print_success "Backup concluído em $BACKUP_DIR"

# Para o serviço se estiver em execução
if systemctl is-active --quiet fazai; then
    print_message "Parando o serviço FazAI..."
    systemctl stop fazai
    print_success "Serviço parado."
else
    print_message "Serviço FazAI não está em execução."
fi

# Desabilita o serviço
if systemctl is-enabled --quiet fazai; then
    print_message "Desabilitando o serviço..."
    systemctl disable fazai
    print_success "Serviço desabilitado."
fi

# Pergunta se deseja especificar uma versão ou branch
echo
print_message "Opções de reinstalação:"
echo "1. Reinstalar a versão atual (local)"
echo "2. Reinstalar a partir de uma branch específica do Git"
echo "3. Reinstalar a partir de um commit específico"
read -p "Escolha uma opção (1-3): " -n 1 -r
echo

case $REPLY in
    1)
        # Reinstala a versão atual
        print_message "Reinstalando a versão atual..."
        
        # Executa o script de instalação
        if [ -f "./install.sh" ]; then
            bash ./install.sh
            INSTALL_RESULT=$?
        else
            print_error "Script de instalação não encontrado no diretório atual."
            exit 1
        fi
        ;;
    2)
        # Reinstala a partir de uma branch
        read -p "Digite o nome da branch (ex: main, develop): " BRANCH_NAME
        
        if [ -z "$BRANCH_NAME" ]; then
            print_error "Nome da branch não pode ser vazio."
            exit 1
        fi
        
        print_message "Reinstalando a partir da branch: $BRANCH_NAME"
        
        # Cria diretório temporário
        TMP_DIR=$(mktemp -d)
        cd "$TMP_DIR"
        
        # Clona o repositório
        print_message "Clonando repositório..."
        git clone -b "$BRANCH_NAME" https://github.com/Rluf/fazai.git
        
        if [ $? -ne 0 ]; then
            print_error "Falha ao clonar o repositório ou branch não encontrada."
            rm -rf "$TMP_DIR"
            exit 1
        fi
        
        # Executa o script de instalação
        cd fazai
        bash ./install.sh
        INSTALL_RESULT=$?
        
        # Limpa diretório temporário
        cd /
        rm -rf "$TMP_DIR"
        ;;
    3)
        # Reinstala a partir de um commit
        read -p "Digite o hash do commit: " COMMIT_HASH
        
        if [ -z "$COMMIT_HASH" ]; then
            print_error "Hash do commit não pode ser vazio."
            exit 1
        fi
        
        print_message "Reinstalando a partir do commit: $COMMIT_HASH"
        
        # Cria diretório temporário
        TMP_DIR=$(mktemp -d)
        cd "$TMP_DIR"
        
        # Clona o repositório
        print_message "Clonando repositório..."
        git clone https://github.com/Rluf/fazai.git
        
        if [ $? -ne 0 ]; then
            print_error "Falha ao clonar o repositório."
            rm -rf "$TMP_DIR"
            exit 1
        fi
        
        # Checkout para o commit específico
        cd fazai
        git checkout "$COMMIT_HASH"
        
        if [ $? -ne 0 ]; then
            print_error "Falha ao fazer checkout para o commit especificado."
            rm -rf "$TMP_DIR"
            exit 1
        fi
        
        # Executa o script de instalação
        bash ./install.sh
        INSTALL_RESULT=$?
        
        # Limpa diretório temporário
        cd /
        rm -rf "$TMP_DIR"
        ;;
    *)
        print_error "Opção inválida."
        exit 1
        ;;
esac

# Verifica se a instalação foi bem-sucedida
if [ $INSTALL_RESULT -ne 0 ]; then
    print_error "Falha na reinstalação. Código de erro: $INSTALL_RESULT"
    
    # Pergunta se deseja restaurar o backup
    read -p "Deseja restaurar o backup das configurações? (s/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Ss]$ ]]; then
        print_message "Restaurando configurações..."
        
        # Restaura arquivos de configuração
        if [ -f "$BACKUP_DIR/fazai.conf" ]; then
            cp "$BACKUP_DIR/fazai.conf" /etc/fazai/
            print_success "Configuração principal restaurada."
        fi
        
        # Restaura plugins personalizados
        if [ -d "$BACKUP_DIR/tools" ] && [ -d "/etc/fazai/tools" ]; then
            cp -r "$BACKUP_DIR/tools/"* /etc/fazai/tools/
            print_success "Plugins personalizados restaurados."
        fi
        
        # Restaura módulos personalizados
        if [ -d "$BACKUP_DIR/mods" ] && [ -d "/etc/fazai/mods" ]; then
            cp -r "$BACKUP_DIR/mods/"* /etc/fazai/mods/
            print_success "Módulos personalizados restaurados."
        fi
        
        print_success "Backup restaurado."
    fi
    
    exit $INSTALL_RESULT
fi

# Restaura configurações se a instalação foi bem-sucedida
print_message "Reinstalação concluída com sucesso."

# Pergunta se deseja restaurar as configurações
read -p "Deseja restaurar as configurações anteriores? (s/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Ss]$ ]]; then
    print_message "Restaurando configurações..."
    
    # Restaura arquivos de configuração
    if [ -f "$BACKUP_DIR/fazai.conf" ]; then
        cp "$BACKUP_DIR/fazai.conf" /etc/fazai/
        print_success "Configuração principal restaurada."
    fi
    
    # Restaura plugins personalizados
    if [ -d "$BACKUP_DIR/tools" ] && [ -d "/etc/fazai/tools" ]; then
        cp -r "$BACKUP_DIR/tools/"* /etc/fazai/tools/
        print_success "Plugins personalizados restaurados."
    fi
    
    # Restaura módulos personalizados
    if [ -d "$BACKUP_DIR/mods" ] && [ -d "/etc/fazai/mods" ]; then
        cp -r "$BACKUP_DIR/mods/"* /etc/fazai/mods/
        print_success "Módulos personalizados restaurados."
    fi
    
    # Recompila módulos nativos se necessário
    if [ -d "/etc/fazai/mods" ]; then
        print_message "Recompilando módulos nativos..."
        cd /etc/fazai/mods
        gcc -shared -fPIC -o system_mod.so system_mod.c
        if [ $? -eq 0 ]; then
            print_success "Módulos nativos recompilados."
        else
            print_error "Falha ao recompilar módulos nativos."
        fi
        cd - > /dev/null
    fi
    
    # Reinicia o serviço
    print_message "Reiniciando o serviço..."
    systemctl daemon-reload
    systemctl enable fazai
    systemctl restart fazai
    
    if systemctl is-active --quiet fazai; then
        print_success "Serviço reiniciado com sucesso."
    else
        print_error "Falha ao reiniciar o serviço. Verifique os logs com 'journalctl -u fazai'."
    fi
    
    print_success "Configurações restauradas."
else
    # Inicia o serviço com a configuração padrão
    print_message "Iniciando o serviço com configuração padrão..."
    systemctl daemon-reload
    systemctl enable fazai
    systemctl start fazai
    
    if systemctl is-active --quiet fazai; then
        print_success "Serviço iniciado com sucesso."
    else
        print_error "Falha ao iniciar o serviço. Verifique os logs com 'journalctl -u fazai'."
    fi
fi

# Conclusão
echo
echo -e "${GREEN}=================================================${NC}"
echo -e "${GREEN}       FazAI reinstalado com sucesso!            ${NC}"
echo -e "${GREEN}=================================================${NC}"
echo
echo -e "Para usar o FazAI, execute: ${BLUE}fazai <comando>${NC}"
echo -e "Exemplos:"
echo -e "  ${BLUE}fazai ajuda${NC}"
echo -e "  ${BLUE}fazai informações do sistema${NC}"
echo
echo -e "Para verificar o status do serviço: ${BLUE}systemctl status fazai${NC}"
echo -e "Para ver os logs: ${BLUE}fazai logs${NC} ou ${BLUE}journalctl -u fazai${NC}"
echo
echo -e "${YELLOW}[IMPORTANTE]${NC} Backup das configurações anteriores disponível em: ${BLUE}$BACKUP_DIR${NC}"
echo

exit 0
