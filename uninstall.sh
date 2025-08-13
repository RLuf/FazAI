#!/bin/bash

# FazAI - Script de Desinstalação
# Este script remove o FazAI do sistema
# Versão: 1.42.1 - Atualizado para limpeza completa e reinstalação

# Cores para saída no terminal
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Versão do script
VERSION="1.42.2"

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

print_info() {
    echo -e "${CYAN}[INFO]${NC} $1"
}

# Verifica se está sendo executado como root
if [ "$EUID" -ne 0 ]; then
    print_error "Este script precisa ser executado como root (sudo)."
    exit 1
fi

# Cabeçalho
echo -e "${BLUE}=================================================${NC}"
echo -e "${BLUE}       FazAI - Desinstalação Automatizada        ${NC}"
echo -e "${BLUE}              Versão $VERSION                    ${NC}"
echo -e "${BLUE}=================================================${NC}"
echo

# Verificar se o FazAI está instalado
if [ ! -f "/opt/fazai/lib/main.js" ] && [ ! -f "/usr/local/bin/fazai" ]; then
    print_warning "FazAI não parece estar instalado ou já foi removido."
    read -p "Deseja continuar com a limpeza de resíduos? (s/n): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Ss]$ ]]; then
        print_message "Operação cancelada."
        exit 0
    fi
fi

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
systemctl stop fazai 2>/dev/null
if [ $? -eq 0 ]; then
    print_success "Serviço parado."
else
    print_warning "Serviço não estava rodando ou não foi encontrado."
fi

# Desabilita o serviço
print_message "Desabilitando o serviço..."
systemctl disable fazai 2>/dev/null
if [ $? -eq 0 ]; then
    print_success "Serviço desabilitado."
else
    print_warning "Serviço não estava habilitado ou não foi encontrado."
fi

# Backup de configurações se solicitado
if [ "$PRESERVE_CONFIG" = true ]; then
    print_message "Fazendo backup das configurações e ferramentas..."
    BACKUP_DIR="/tmp/fazai_config_backup_$(date +%Y%m%d%H%M%S)"
    mkdir -p "$BACKUP_DIR/config"
    mkdir -p "$BACKUP_DIR/tools"
    mkdir -p "$BACKUP_DIR/mods"
    mkdir -p "$BACKUP_DIR/cache"
    
    # Copia arquivos de configuração
    if [ -f /etc/fazai/fazai.conf ]; then
        cp /etc/fazai/fazai.conf "$BACKUP_DIR/config/"
        print_success "Configuração principal salva no backup"
    fi
    
    # Backup das ferramentas específicas (v1.42.2)
    TOOLS_TO_BACKUP=(
        "/opt/fazai/tools/github-setup.sh"
        "/opt/fazai/tools/sync-changes.sh"
        "/opt/fazai/tools/sync-keys.sh"
        "/opt/fazai/tools/system-check.sh"
        "/opt/fazai/tools/fazai-config.js"
        "/opt/fazai/tools/fazai_html_v1.sh"
        "/opt/fazai/tools/fazai_web.sh"
        "/opt/fazai/tools/fazai_web_frontend.html"
        "/opt/fazai/tools/fazai-tui.sh"
        "/opt/fazai/tools/fazai-config-tui.sh"
    )
    
    for tool in "${TOOLS_TO_BACKUP[@]}"; do
        if [ -f "$tool" ]; then
            cp "$tool" "$BACKUP_DIR/tools/"
            print_success "Ferramenta salva no backup: $(basename "$tool")"
        fi
    done
    
    # Backup dos módulos nativos
    MODULES_TO_BACKUP=(
        "/opt/fazai/mods/system_mod.so"
        "/opt/fazai/mods/system_mod.c"
        "/opt/fazai/mods/fazai_mod.h"
    )
    
    for module in "${MODULES_TO_BACKUP[@]}"; do
        if [ -f "$module" ]; then
            cp "$module" "$BACKUP_DIR/mods/"
            print_success "Módulo salvo no backup: $(basename "$module")"
        fi
    done
    
    # Backup de arquivos relacionados ao dos2unix
    if [ -f /etc/fazai/dos2unixAll.sh ]; then
        cp /etc/fazai/dos2unixAll.sh "$BACKUP_DIR/config/"
        print_success "Script dos2unix salvo no backup"
    fi
    
    # Backup de cache se existir
    if [ -d /var/lib/fazai/cache ]; then
        cp -r /var/lib/fazai/cache/* "$BACKUP_DIR/cache/" 2>/dev/null
        print_success "Cache salvo no backup"
    fi
    
    print_success "Backup completo criado em $BACKUP_DIR"
fi

# Remove arquivos do sistema
print_message "Removendo arquivos do sistema..."

# Remove o executável CLI e links simbólicos
if [ -f /usr/local/bin/fazai ]; then
    rm -f /usr/local/bin/fazai
    print_success "Link simbólico do CLI removido."
else
    print_warning "Link simbólico do CLI não encontrado."
fi

# Remove outros links simbólicos relacionados (v1.42.2)
LINKS_TO_REMOVE=(
    "fazai-config"
    "fazai-backup"
    "fazai-uninstall"
    "fazai-config-tui"
    "fazai-tui"
    "fazai-html"
    "fazai-web"
)

for link in "${LINKS_TO_REMOVE[@]}"; do
    if [ -f "/usr/local/bin/$link" ]; then
        rm -f "/usr/local/bin/$link"
        print_success "Link simbólico $link removido."
    fi
done

# Remove ferramentas específicas (v1.42.2)
print_message "Removendo ferramentas específicas..."
TOOLS_TO_REMOVE=(
    "/opt/fazai/tools/github-setup.sh"
    "/opt/fazai/tools/sync-changes.sh"
    "/opt/fazai/tools/sync-keys.sh"
    "/opt/fazai/tools/system-check.sh"
    "/opt/fazai/tools/fazai-config.js"
    "/opt/fazai/tools/fazai_html_v1.sh"
    "/opt/fazai/tools/fazai_web.sh"
    "/opt/fazai/tools/fazai_web_frontend.html"
    "/opt/fazai/tools/fazai-tui.sh"
    "/opt/fazai/tools/fazai-config-tui.sh"
)

for tool in "${TOOLS_TO_REMOVE[@]}"; do
    if [ -f "$tool" ]; then
        rm -f "$tool"
        print_success "Ferramenta removida: $(basename "$tool")"
    fi
done

# Remove módulos nativos específicos
print_message "Removendo módulos nativos..."
NATIVE_MODULES=(
    "/opt/fazai/mods/system_mod.so"
    "/opt/fazai/mods/system_mod.c"
    "/opt/fazai/mods/fazai_mod.h"
)

for module in "${NATIVE_MODULES[@]}"; do
    if [ -f "$module" ]; then
        rm -f "$module"
        print_success "Módulo nativo removido: $(basename "$module")"
    fi
done

# Remove arquivos relacionados ao dos2unix e conversão de formato
print_message "Removendo arquivos de conversão de formato..."
DOS2UNIX_FILES=(
    "/etc/fazai/dos2unixAll.sh"
    "/opt/fazai/tools/dos2unixAll.sh"
)

for dos2unix_file in "${DOS2UNIX_FILES[@]}"; do
    if [ -f "$dos2unix_file" ]; then
        rm -f "$dos2unix_file"
        print_success "Arquivo dos2unix removido: $(basename "$dos2unix_file")"
    fi
done

# Remove o serviço systemd
if [ -f /etc/systemd/system/fazai.service ]; then
    rm -f /etc/systemd/system/fazai.service
    print_success "Serviço systemd removido."
else
    print_warning "Arquivo de serviço não encontrado."
fi

# Preserva ou remove configurações
if [ "$PRESERVE_CONFIG" = true ]; then
    # Remove diretório de código (incluindo interface web)
    print_message "Removendo diretório de código e interface web..."
    rm -rf /opt/fazai
    print_success "Diretório /opt/fazai removido (incluindo interface web)."
    
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
        cp -r /var/lib/fazai/training/* "$TRAINING_BACKUP/" 2>/dev/null
        print_success "Dados de treinamento preservados em $TRAINING_BACKUP"
    fi
fi

# Remove configurações adicionais
print_message "Removendo configurações adicionais..."

# Remove bash completion
if [ -f /etc/bash_completion.d/fazai ]; then
    rm -f /etc/bash_completion.d/fazai
    print_success "Bash completion removido."
fi

# Remove logrotate configuration
if [ -f /etc/logrotate.d/fazai ]; then
    rm -f /etc/logrotate.d/fazai
    print_success "Configuração de logrotate removida."
fi

# Remove sudoers configuration
if [ -f /etc/sudoers.d/fazai ]; then
    rm -f /etc/sudoers.d/fazai
    print_success "Configuração sudoers removida."
fi

# Remove arquivos de estado de instalação
if [ -f /var/lib/fazai/install.state ]; then
    rm -f /var/lib/fazai/install.state
    print_success "Estado de instalação removido."
fi

# Limpeza de processos órfãos (v1.42.2)
print_message "Verificando processos órfãos..."
PIDS=$(pgrep -f "fazai" 2>/dev/null || true)
if [ -n "$PIDS" ]; then
    print_warning "Encontrados processos órfãos do FazAI: $PIDS"
    read -p "Deseja encerrar esses processos? (s/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Ss]$ ]]; then
        for pid in $PIDS; do
            kill -TERM "$pid" 2>/dev/null
            print_success "Processo $pid encerrado."
        done
    fi
else
    print_success "Nenhum processo órfão encontrado."
fi

# Limpeza de arquivos temporários (v1.42.2)
print_message "Limpando arquivos temporários..."
TEMP_FILES=(
    "/tmp/fazai_*.log"
    "/tmp/fazai_*.tmp"
    "/tmp/fazai_cache_*"
)

for pattern in "${TEMP_FILES[@]}"; do
    for file in $pattern; do
        if [ -f "$file" ]; then
            rm -f "$file"
            print_success "Arquivo temporário removido: $(basename "$file")"
        fi
    done
done

# Recarrega o daemon do systemd
print_message "Recarregando o daemon do systemd..."
systemctl daemon-reload
print_success "Daemon recarregado."

# Conclusão
echo
echo -e "${GREEN}=================================================${NC}"
echo -e "${GREEN}       FazAI desinstalado com sucesso!           ${NC}"
echo -e "${GREEN}              Versão $VERSION                    ${NC}"
echo -e "${GREEN}=================================================${NC}"
echo

if [ "$PRESERVE_CONFIG" = true ]; then
    echo -e "${YELLOW}[IMPORTANTE]${NC} Arquivos de configuração foram preservados em /etc/fazai/"
    echo -e "Backup adicional disponível em: ${BLUE}$BACKUP_DIR${NC}"
fi

echo -e "${PURPLE}[INFO]${NC} Limpeza específica da versão 1.42.1 concluída:"
echo -e "  • Ferramentas movidas removidas"
echo -e "  • Módulos nativos removidos"
echo -e "  • Arquivos dos2unix removidos"
echo -e "  • Estado de instalação limpo"
echo -e "  • Processos órfãos verificados"
echo -e "  • Arquivos temporários limpos"
echo -e "  • Cache e dados de IA removidos"

echo
echo -e "${CYAN}[PRÓXIMOS PASSOS]${NC}"
echo -e "Para reinstalar o FazAI:"
echo -e "  1. Clone o repositório: git clone https://github.com/RLuf/FazAI.git"
echo -e "  2. Execute: sudo ./install.sh"
echo -e "  3. Configure os provedores de IA: fazai config"

exit 0
