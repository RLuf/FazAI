#!/bin/bash

# FazAI - Instalador de Dependências Python
# Autor: Roger Luft
# Versão: 1.0
# 
# Este script instala as dependências Python necessárias para o módulo de tarefas complexas

set -e

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Funções de log
print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Verificar se estamos rodando como root
check_root() {
    if [[ $EUID -eq 0 ]]; then
        print_warning "Executando como root. Isso pode causar problemas de permissão."
        read -p "Continuar mesmo assim? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            print_info "Execute o script sem privilégios de root."
            exit 1
        fi
    fi
}

# Verificar se Python está instalado
check_python() {
    print_info "Verificando instalação do Python..."
    
    if command -v python3 &> /dev/null; then
        PYTHON_CMD="python3"
        PYTHON_VERSION=$(python3 --version 2>&1 | awk '{print $2}')
        print_success "Python encontrado: $PYTHON_VERSION"
    elif command -v python &> /dev/null; then
        PYTHON_CMD="python"
        PYTHON_VERSION=$(python --version 2>&1 | awk '{print $2}')
        print_success "Python encontrado: $PYTHON_VERSION"
    else
        print_error "Python não encontrado no sistema."
        print_info "Por favor, instale Python 3.8+ primeiro."
        exit 1
    fi
    
    # Verificar versão mínima
    PYTHON_MAJOR=$(echo $PYTHON_VERSION | cut -d. -f1)
    PYTHON_MINOR=$(echo $PYTHON_VERSION | cut -d. -f2)
    
    if [[ $PYTHON_MAJOR -lt 3 ]] || [[ $PYTHON_MAJOR -eq 3 && $PYTHON_MINOR -lt 8 ]]; then
        print_error "Python 3.8+ é necessário. Versão atual: $PYTHON_VERSION"
        exit 1
    fi
}

# Verificar se pip está instalado
check_pip() {
    print_info "Verificando instalação do pip..."
    
    if command -v pip3 &> /dev/null; then
        PIP_CMD="pip3"
        print_success "pip encontrado: pip3"
    elif command -v pip &> /dev/null; then
        PIP_CMD="pip"
        print_success "pip encontrado: pip"
    else
        print_warning "pip não encontrado. Tentando instalar..."
        install_pip
    fi
}

# Instalar pip se necessário
install_pip() {
    print_info "Instalando pip..."
    
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        if command -v apt-get &> /dev/null; then
            sudo apt-get update
            sudo apt-get install -y python3-pip
            PIP_CMD="pip3"
        elif command -v yum &> /dev/null; then
            sudo yum install -y python3-pip
            PIP_CMD="pip3"
        elif command -v dnf &> /dev/null; then
            sudo dnf install -y python3-pip
            PIP_CMD="pip3"
        elif command -v pacman &> /dev/null; then
            sudo pacman -S --noconfirm python-pip
            PIP_CMD="pip"
        else
            print_error "Gerenciador de pacotes não suportado."
            print_info "Por favor, instale pip manualmente."
            exit 1
        fi
    elif [[ "$OSTYPE" == "darwin"* ]]; then
        if command -v brew &> /dev/null; then
            brew install python3
            PIP_CMD="pip3"
        else
            print_error "Homebrew não encontrado no macOS."
            print_info "Por favor, instale Homebrew ou pip manualmente."
            exit 1
        fi
    else
        print_error "Sistema operacional não suportado: $OSTYPE"
        exit 1
    fi
    
    print_success "pip instalado com sucesso"
}

# Instalar dependências Python
install_python_deps() {
    print_info "Instalando dependências Python..."
    
    # Lista de dependências
    DEPS=(
        "matplotlib>=3.5.0"
        "numpy>=1.21.0"
        "seaborn>=0.11.0"
        "pandas>=1.3.0"
        "requests>=2.25.0"
        "pillow>=8.0.0"
    )
    
    # Instalar cada dependência
    for dep in "${DEPS[@]}"; do
        print_info "Instalando $dep..."
        if $PIP_CMD install --user "$dep"; then
            print_success "$dep instalado com sucesso"
        else
            print_warning "Falha ao instalar $dep. Tentando com sudo..."
            if sudo $PIP_CMD install "$dep"; then
                print_success "$dep instalado com sucesso (com sudo)"
            else
                print_error "Falha ao instalar $dep"
                FAILED_DEPS+=("$dep")
            fi
        fi
    done
    
    # Verificar se todas as dependências foram instaladas
    if [[ ${#FAILED_DEPS[@]} -gt 0 ]]; then
        print_warning "Algumas dependências falharam na instalação:"
        for dep in "${FAILED_DEPS[@]}"; do
            echo "  - $dep"
        done
        print_info "Tente instalar manualmente ou verifique as permissões."
    fi
}

# Verificar instalação das dependências
verify_installation() {
    print_info "Verificando instalação das dependências..."
    
    local all_ok=true
    
    # Testar importação das bibliotecas
    python3 -c "
import sys
deps = ['matplotlib', 'numpy', 'seaborn', 'pandas', 'requests', 'PIL']
failed = []

for dep in deps:
    try:
        if dep == 'PIL':
            import PIL
        else:
            __import__(dep)
        print(f'✓ {dep}')
    except ImportError:
        print(f'✗ {dep}')
        failed.append(dep)

if failed:
    print(f'\\nFalharam: {len(failed)} dependências')
    sys.exit(1)
else:
    print('\\n✓ Todas as dependências estão funcionando!')
" || all_ok=false
    
    if [[ "$all_ok" == false ]]; then
        print_error "Algumas dependências não estão funcionando corretamente."
        return 1
    fi
    
    print_success "Todas as dependências Python foram verificadas com sucesso!"
    return 0
}

# Criar diretórios necessários
create_directories() {
    print_info "Criando diretórios necessários..."
    
    local dirs=(
        "/var/www/fazai"
        "/var/cache/fazai/charts"
        "/var/lib/fazai/data"
        "/var/log/fazai"
        "/var/reports/fazai"
    )
    
    for dir in "${dirs[@]}"; do
        if [[ ! -d "$dir" ]]; then
            if sudo mkdir -p "$dir"; then
                print_success "Diretório criado: $dir"
            else
                print_warning "Falha ao criar diretório: $dir"
            fi
        else
            print_info "Diretório já existe: $dir"
        fi
    done
    
    # Definir permissões adequadas
    for dir in "${dirs[@]}"; do
        if [[ -d "$dir" ]]; then
            if sudo chown -R $USER:$USER "$dir" 2>/dev/null; then
                print_success "Permissões definidas para: $dir"
            else
                print_warning "Não foi possível definir permissões para: $dir"
            fi
        fi
    done
}

# Testar geração de gráfico simples
test_chart_generation() {
    print_info "Testando geração de gráfico..."
    
    local test_script="/tmp/test_chart.py"
    local test_output="/tmp/test_chart.png"
    
    cat > "$test_script" << 'EOF'
import matplotlib.pyplot as plt
import numpy as np

# Dados de teste
x = np.linspace(0, 10, 100)
y = np.sin(x)

# Criar gráfico
plt.figure(figsize=(8, 6))
plt.plot(x, y, 'b-', linewidth=2)
plt.title('Teste de Gráfico - FazAI')
plt.xlabel('X')
plt.ylabel('Y')
plt.grid(True, alpha=0.3)

# Salvar
plt.savefig('/tmp/test_chart.png', dpi=150, bbox_inches='tight')
plt.close()

print("Gráfico de teste gerado com sucesso!")
EOF
    
    if python3 "$test_script"; then
        if [[ -f "$test_output" ]]; then
            print_success "Gráfico de teste gerado com sucesso!"
            print_info "Arquivo: $test_output"
            
            # Mostrar informações do arquivo
            local file_size=$(du -h "$test_output" | cut -f1)
            local file_type=$(file "$test_output" | cut -d: -f2)
            print_info "Tamanho: $file_size, Tipo: $file_type"
        else
            print_error "Gráfico não foi gerado"
            return 1
        fi
    else
        print_error "Falha ao executar script de teste"
        return 1
    fi
    
    # Limpar arquivos de teste
    rm -f "$test_script" "$test_output"
}

# Função principal
main() {
    echo "🧪 FazAI - Instalador de Dependências Python"
    echo "============================================="
    echo
    
    # Inicializar array para dependências falhadas
    FAILED_DEPS=()
    
    # Executar verificações e instalações
    check_root
    check_python
    check_pip
    install_python_deps
    create_directories
    
    echo
    print_info "Verificando instalação..."
    if verify_installation; then
        echo
        print_info "Testando funcionalidade..."
        if test_chart_generation; then
            echo
            print_success "🎉 Instalação concluída com sucesso!"
            print_info "O módulo de tarefas complexas está pronto para uso."
            echo
            print_info "Próximos passos:"
            print_info "1. Configure o arquivo complex_tasks.conf"
            print_info "2. Execute o teste: node opt/fazai/tools/test_complex_tasks.js"
            print_info "3. Integre com o FazAI principal"
        else
            print_error "❌ Falha no teste de funcionalidade"
            exit 1
        fi
    else
        print_error "❌ Falha na verificação das dependências"
        exit 1
    fi
}

# Tratamento de erros
trap 'print_error "Erro na linha $LINENO. Saindo..."; exit 1' ERR

# Executar função principal
main "$@"