#!/bin/bash

# FazAI - Script de Versionamento Automático
# Este script automatiza o processo de bump de versão em todos os arquivos do projeto
# Autor: Roger Luft
# Versão: 1.0

# set -e

# Cores para saída
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configurações
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
CHANGELOG_FILE="$PROJECT_ROOT/CHANGELOG.md"
BACKUP_DIR="$PROJECT_ROOT/var/backups/version-bump"
DATE=$(date '+%Y%m%d_%H%M%S')

# Função para logging
log() {
    echo -e "${BLUE}[$(date '+%H:%M:%S')]${NC} $1"
}

log_success() {
    echo -e "${GREEN}✓${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

log_error() {
    echo -e "${RED}✗${NC} $1"
}

log_info() {
    echo -e "${CYAN}ℹ${NC} $1"
}

# Função para exibir ajuda
show_help() {
    echo -e "${CYAN}FazAI - Script de Versionamento Automático${NC}"
    echo ""
    echo "Uso: $0 [OPÇÕES]"
    echo ""
    echo "Opções:"
    echo "  -v, --version VERSION    Nova versão (ex: 1.42.2)"
    echo "  -a, --auto               Detectar versão automaticamente do CHANGELOG"
    echo "  -d, --dry-run            Simular alterações sem aplicar"
    echo "  -b, --backup             Criar backup antes das alterações"
    echo "  -h, --help               Exibir esta ajuda"
    echo ""
    echo "Exemplos:"
    echo "  $0 -v 1.42.2             Bump manual para versão 1.42.2"
    echo "  $0 -a                    Bump automático (próxima versão)"
    echo "  $0 -a -d                 Simular bump automático"
    echo "  $0 -v 1.43.0 -b          Bump com backup"
    echo ""
}

# Função para detectar versão atual do CHANGELOG
detect_current_version() {
    local current_version
    current_version=$(grep -E '^## \[v[0-9]+\.[0-9]+\.[0-9]+\]' "$CHANGELOG_FILE" | head -1 | sed -E 's/^## \[v([0-9]+\.[0-9]+\.[0-9]+)\].*/\1/')
    
    if [[ -z "$current_version" ]]; then
        log_error "Não foi possível detectar a versão atual no CHANGELOG.md"
        exit 1
    fi
    
    echo "$current_version"
}

# Função para calcular próxima versão
calculate_next_version() {
    local current_version=$1
    local major minor patch
    
    IFS='.' read -r major minor patch <<< "$current_version"
    
    # Incrementa patch por padrão
    patch=$((patch + 1))
    
    echo "${major}.${minor}.${patch}"
}

# Função para criar backup
create_backup() {
    log_info "Criando backup das alterações..."
    
    mkdir -p "$BACKUP_DIR"
    local backup_file="$BACKUP_DIR/version-bump-backup-$DATE.tar.gz"
    
    # Lista de arquivos que serão alterados
    local files_to_backup=(
        "package.json"
        "bin/fazai"
        "opt/fazai/lib/main.js"
        "install.sh"
        "uninstall.sh"
        "README.md"
        "tests/version.test.sh"
        "tests/test-improvements.sh"
        "etc/fazai/fazai-completion.sh"
        "etc/fazai/fazai.conf.example"
        "opt/fazai/tools/fazai-config.js"
        "USAGE.md"
        "TODO.md"
        "IMPROVEMENTS_v1.41.0.md"
    )
    
    # Criar backup apenas dos arquivos que existem
    local existing_files=()
    for file in "${files_to_backup[@]}"; do
        if [[ -f "$PROJECT_ROOT/$file" ]]; then
            existing_files+=("$file")
        fi
    done
    
    if [[ ${#existing_files[@]} -gt 0 ]]; then
        tar -czf "$backup_file" -C "$PROJECT_ROOT" "${existing_files[@]}"
        log_success "Backup criado: $backup_file"
    else
        log_warning "Nenhum arquivo encontrado para backup"
    fi
}

# Função para validar formato de versão
validate_version() {
    local version=$1
    
    if [[ ! "$version" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
        log_error "Formato de versão inválido: $version"
        log_error "Use o formato: MAJOR.MINOR.PATCH (ex: 1.42.2)"
        exit 1
    fi
    
    log_success "Versão validada: $version"
}

# Função para atualizar arquivo
update_file() {
    local file_path=$1
    local old_version=$2
    local new_version=$3
    local dry_run=$4
    
    if [[ ! -f "$file_path" ]]; then
        log_warning "Arquivo não encontrado: $file_path"
        return 1
    fi
    
    local temp_file=$(mktemp)
    local changes_made=false
    
    # Padrões de substituição específicos para cada tipo de arquivo
    case "$(basename "$file_path")" in
        "package.json")
            # Substituir "version": "X.Y.Z"
            sed -E "s/\"version\": \"$old_version\"/\"version\": \"$new_version\"/g" "$file_path" > "$temp_file"
            if ! cmp -s "$file_path" "$temp_file"; then
                changes_made=true
            fi
            ;;
        "main.js")
            # Substituir versões em comentários e strings
            sed -E "s/version: '$old_version'/version: '$new_version'/g; s/Version: $old_version/Version: $new_version/g" "$file_path" > "$temp_file"
            if ! cmp -s "$file_path" "$temp_file"; then
                changes_made=true
            fi
            ;;
        "install.sh"|"uninstall.sh")
            # Substituir VERSION="X.Y.Z" e versões em strings
            sed -E "s/VERSION=\"1\.42\.[0-9]+\"/VERSION=\"$new_version\"/g; s/v1\.42\.[0-9]+/v$new_version/g; s/FazAI v1\.42\.[0-9]+/FazAI v$new_version/g; s/\"version\": \"1\.42\.[0-9]+\"/\"version\": \"$new_version\"/g" "$file_path" > "$temp_file"
            if ! cmp -s "$file_path" "$temp_file"; then
                changes_made=true
            fi
            ;;
        "fazai")
            # Substituir versões em strings e comentários
            sed -E "s/v1\.42\.[0-9]+/v$new_version/g; s/FazAI v1\.42\.[0-9]+/FazAI v$new_version/g; s/FazAI.*v1\.42\.[0-9]+/FazAI v$new_version/g" "$file_path" > "$temp_file"
            if ! cmp -s "$file_path" "$temp_file"; then
                changes_made=true
            fi
            ;;
        "CHANGELOG.md")
            # Adicionar nova seção no topo
            local new_section="## [v$new_version] - $(date '+%d/%m/%Y')

### Added
- [Adicione novas funcionalidades aqui]

### Changed
- [Adicione mudanças aqui]

### Fixed
- [Adicione correções aqui]

### Notes
- [Adicione notas aqui]

---"
            
            # Inserir nova seção após a primeira linha
            if sed "2i\\$new_section" "$file_path" > "$temp_file"; then
                changes_made=true
            fi
            ;;
        *)
            # Substituição genérica para outros arquivos
            sed -E "s/$old_version/$new_version/g" "$file_path" > "$temp_file"
            if ! cmp -s "$file_path" "$temp_file"; then
                changes_made=true
            fi
            ;;
    esac
    
    if [[ "$changes_made" == true ]]; then
        if [[ "$dry_run" == true ]]; then
            log_info "DRY-RUN: Alterações detectadas em $file_path"
            diff "$file_path" "$temp_file" || true
        else
            mv "$temp_file" "$file_path"
            log_success "Atualizado: $file_path"
        fi
    else
        rm -f "$temp_file"
        log_info "Nenhuma alteração necessária em: $file_path"
    fi
    
    return 0
}

# Função principal de atualização
update_version() {
    local old_version=$1
    local new_version=$2
    local dry_run=$3
    
    log_info "Iniciando atualização de versão: $old_version → $new_version"
    
    # Lista de arquivos que precisam ser atualizados
    local files_to_update=(
        "package.json"
        "bin/fazai"
        "opt/fazai/lib/main.js"
        "install.sh"
        "uninstall.sh"
        "README.md"
        "tests/version.test.sh"
        "tests/test-improvements.sh"
        "etc/fazai/fazai-completion.sh"
        "etc/fazai/fazai.conf.example"
        "opt/fazai/tools/fazai-config.js"
        "USAGE.md"
        "TODO.md"
        "IMPROVEMENTS_v1.41.0.md"
    )
    
    local updated_count=0
    local total_files=${#files_to_update[@]}
    
    for file in "${files_to_update[@]}"; do
        local file_path="$PROJECT_ROOT/$file"
        
        update_file "$file_path" "$old_version" "$new_version" "$dry_run"
        ((updated_count++))
    done
    
    # Atualizar CHANGELOG.md por último
    if [[ "$dry_run" != true ]]; then
        update_file "$CHANGELOG_FILE" "$old_version" "$new_version" "$dry_run"
        ((updated_count++))
    fi
    
    log_success "Processo concluído: $updated_count/$total_files arquivos processados"
}

# Função para validar alterações
validate_changes() {
    local new_version=$1
    
    log_info "Validando alterações..."
    
    # Verificar se a versão foi atualizada nos arquivos principais
    local validation_files=(
        "package.json"
        "bin/fazai"
        "opt/fazai/lib/main.js"
        "install.sh"
    )
    
    local errors=0
    
    for file in "${validation_files[@]}"; do
        local file_path="$PROJECT_ROOT/$file"
        
        if [[ -f "$file_path" ]]; then
            if grep -q "$new_version" "$file_path"; then
                log_success "✓ $file contém versão $new_version"
            else
                log_error "✗ $file não contém versão $new_version"
                ((errors++))
            fi
        fi
    done
    
    if [[ $errors -eq 0 ]]; then
        log_success "Todas as validações passaram!"
        return 0
    else
        log_error "Encontrados $errors erro(s) de validação"
        return 1
    fi
}

# Função principal
main() {
    local new_version=""
    local auto_detect=false
    local dry_run=false
    local create_backup_flag=false
    
    # Parse de argumentos
    while [[ $# -gt 0 ]]; do
        case $1 in
            -v|--version)
                new_version="$2"
                shift 2
                ;;
            -a|--auto)
                auto_detect=true
                shift
                ;;
            -d|--dry-run)
                dry_run=true
                shift
                ;;
            -b|--backup)
                create_backup_flag=true
                shift
                ;;
            -h|--help)
                show_help
                exit 0
                ;;
            *)
                log_error "Opção desconhecida: $1"
                show_help
                exit 1
                ;;
        esac
    done
    
    # Verificar se estamos no diretório correto
    if [[ ! -f "$CHANGELOG_FILE" ]]; then
        log_error "CHANGELOG.md não encontrado. Execute este script do diretório raiz do projeto."
        exit 1
    fi
    
    # Detectar versão atual do CHANGELOG
    local changelog_version
    changelog_version=$(detect_current_version)
    log_info "Versão atual do CHANGELOG: $changelog_version"
    
    # Determinar nova versão
    if [[ -n "$new_version" ]]; then
        validate_version "$new_version"
    elif [[ "$auto_detect" == true ]]; then
        new_version=$(calculate_next_version "$changelog_version")
        log_info "Próxima versão calculada: $new_version"
    else
        log_error "Especifique uma versão (-v) ou use detecção automática (-a)"
        show_help
        exit 1
    fi
    
    # Verificar se a versão é diferente (apenas para auto-detect)
    if [[ "$auto_detect" == true && "$changelog_version" == "$new_version" ]]; then
        log_warning "A versão já é $new_version no CHANGELOG. Nenhuma alteração necessária."
        exit 0
    fi
    
    # Criar backup se solicitado
    if [[ "$create_backup_flag" == true ]]; then
        create_backup
    fi
    
    # Executar atualização
    if [[ "$dry_run" == true ]]; then
        log_info "MODO DRY-RUN: Simulando alterações..."
        update_version "$changelog_version" "$new_version" true
        log_info "Simulação concluída. Execute sem --dry-run para aplicar as alterações."
    else
        update_version "$changelog_version" "$new_version" false
        validate_changes "$new_version"
        
        log_success "Versionamento concluído com sucesso!"
        log_info "Versão atualizada: $changelog_version → $new_version"
        log_info "Execute 'git add . && git commit -m \"Bump version to $new_version\"' para commitar as alterações"
    fi
}

# Executar função principal
main "$@" 