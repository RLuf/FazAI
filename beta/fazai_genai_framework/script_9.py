# Criando scripts de instalação e configuração
setup_script = '''#!/bin/bash

# GenAI Mini Framework - Script de Instalação
# Configura ambiente completo com dependências e serviços

set -e  # Parar em caso de erro

echo "🚀 Iniciando instalação do GenAI Mini Framework..."

# Cores para output
RED='\\033[0;31m'
GREEN='\\033[0;32m'
YELLOW='\\033[1;33m'
BLUE='\\033[0;34m'
NC='\\033[0m' # No Color

# Função para log
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"  
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Verificar Python
log_info "Verificando Python..."
if ! command -v python3 &> /dev/null; then
    log_error "Python 3 não encontrado. Instale Python 3.8+ primeiro."
    exit 1
fi

PYTHON_VERSION=$(python3 -c 'import sys; print(".".join(map(str, sys.version_info[:2])))')
log_success "Python $PYTHON_VERSION encontrado"

# Verificar pip
log_info "Verificando pip..."
if ! command -v pip &> /dev/null && ! command -v pip3 &> /dev/null; then
    log_error "pip não encontrado. Instale pip primeiro."
    exit 1
fi

# Usar pip ou pip3
PIP_CMD="pip"
if command -v pip3 &> /dev/null; then
    PIP_CMD="pip3"
fi

log_success "pip encontrado"

# Criar ambiente virtual (opcional)
read -p "🤔 Criar ambiente virtual? (y/n): " CREATE_VENV
if [[ $CREATE_VENV == "y" || $CREATE_VENV == "Y" ]]; then
    log_info "Criando ambiente virtual..."
    python3 -m venv genai_env
    source genai_env/bin/activate
    log_success "Ambiente virtual criado e ativado"
    
    # Atualizar pip no venv
    pip install --upgrade pip
fi

# Instalar dependências Python
log_info "Instalando dependências Python..."

# Lista de dependências
DEPENDENCIES=(
    "google-generativeai>=0.3.0"
    "qdrant-client>=1.7.0"
    "gptcache>=0.1.43"
    "sentence-transformers>=2.2.0"
    "openai>=1.0.0"
    "python-dotenv>=1.0.0"
)

for dep in "${DEPENDENCIES[@]}"; do
    log_info "Instalando $dep..."
    $PIP_CMD install "$dep"
done

log_success "Dependências Python instaladas"

# Verificar Docker
log_info "Verificando Docker..."
if ! command -v docker &> /dev/null; then
    log_warning "Docker não encontrado. Qdrant precisa ser instalado manualmente."
else
    log_success "Docker encontrado"
    
    # Perguntar sobre Qdrant
    read -p "🤔 Iniciar Qdrant com Docker? (y/n): " START_QDRANT
    if [[ $START_QDRANT == "y" || $START_QDRANT == "Y" ]]; then
        log_info "Iniciando Qdrant..."
        
        # Parar container existente se houver
        docker stop qdrant 2>/dev/null || true
        docker rm qdrant 2>/dev/null || true
        
        # Iniciar novo container
        docker run -d \\
            --name qdrant \\
            -p 6333:6333 \\
            -p 6334:6334 \\
            -v qdrant_storage:/qdrant/storage \\
            qdrant/qdrant
        
        # Aguardar inicialização
        log_info "Aguardando Qdrant inicializar..."
        sleep 10
        
        # Verificar se está rodando
        if curl -s http://localhost:6333/health > /dev/null; then
            log_success "Qdrant iniciado com sucesso"
        else
            log_warning "Qdrant pode não ter iniciado corretamente"
        fi
    fi
fi

# Configurar variáveis de ambiente
log_info "Configurando variáveis de ambiente..."

if [ ! -f .env ]; then
    cat > .env << EOF
# GenAI Mini Framework - Configurações

# Google GenAI (OBRIGATÓRIO)
GOOGLE_API_KEY=

# Qdrant
QDRANT_HOST=localhost
QDRANT_PORT=6333

# Cache
CACHE_DB_FILE=genai_cache.db

# Servers llama.cpp (opcional)
LLAMA_GERENTE_URL=http://localhost:8000/v1
LLAMA_ANALISTA_URL=http://localhost:8001/v1
LLAMA_PROGRAMADOR_URL=http://localhost:8002/v1
EOF
    
    log_success "Arquivo .env criado"
    log_warning "IMPORTANTE: Configure GOOGLE_API_KEY no arquivo .env"
else
    log_info "Arquivo .env já existe"
fi

# Verificar Google API Key
if [ -f .env ]; then
    source .env
    if [ -z "$GOOGLE_API_KEY" ]; then
        log_warning "Google API Key não configurada"
        echo "Configure no arquivo .env:"
        echo "GOOGLE_API_KEY=sua_chave_aqui"
    fi
fi

# Testar instalação
log_info "Testando instalação..."

cat > test_installation.py << 'EOF'
#!/usr/bin/env python3

try:
    # Testar imports
    from genai_mini_framework import GenAIMiniFramework, FrameworkConfig
    import google.generativeai as genai
    from qdrant_client import QdrantClient
    import gptcache
    import sentence_transformers
    import openai
    
    print("✅ Todos os imports funcionaram")
    
    # Configuração básica
    config = FrameworkConfig()
    print("✅ Configuração criada")
    
    # Testar Qdrant (se disponível)
    try:
        client = QdrantClient(host="localhost", port=6333)
        print("✅ Conexão Qdrant OK")
    except Exception as e:
        print(f"⚠️  Qdrant não disponível: {e}")
    
    print("\\n🎉 Instalação parece estar OK!")
    print("\\n📝 Próximos passos:")
    print("1. Configure GOOGLE_API_KEY no arquivo .env")
    print("2. Execute: python basic_usage.py")
    
except ImportError as e:
    print(f"❌ Erro de import: {e}")
    exit(1)
except Exception as e:
    print(f"❌ Erro geral: {e}")
    exit(1)
EOF

python3 test_installation.py
rm test_installation.py

# Criar diretório para exports Claude
mkdir -p claude_exports
log_info "Diretório claude_exports criado"

# Sumário final
echo
echo "🎉 Instalação concluída!"
echo
echo "📋 Próximos passos:"
echo "1. Configure GOOGLE_API_KEY no arquivo .env"
echo "2. (Opcional) Execute servidores llama.cpp"
echo "3. Teste com: python basic_usage.py"
echo
echo "📚 Documentação: README.md"
echo "💡 Exemplos: basic_usage.py, claude_import.py"
echo

if [[ $CREATE_VENV == "y" || $CREATE_VENV == "Y" ]]; then
    echo "🔄 Para reativar o ambiente virtual:"
    echo "   source genai_env/bin/activate"
fi

log_success "Setup concluído!"
'''

with open('setup.sh', 'w') as f:
    f.write(setup_script)

# Tornar executável
import os
os.chmod('setup.sh', 0o755)

print("✅ Script setup.sh criado com sucesso!")