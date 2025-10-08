#!/bin/bash
# Teste para o FazAI Container Manager TUI
# Verifica se a ferramenta está instalada e funcional

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo "=== Teste do FazAI Container Manager TUI ==="

# Verificar se Docker está disponível
if ! command -v docker >/dev/null 2>&1; then
    echo "SKIP: Docker não está disponível - pulando testes de container"
    exit 0
fi

# Verificar se o arquivo TUI existe
CONTAINER_TUI="$PROJECT_ROOT/opt/fazai/tools/container_manager_tui.py"
if [ ! -f "$CONTAINER_TUI" ]; then
    echo "FAIL: Arquivo $CONTAINER_TUI não encontrado"
    exit 1
fi

echo "✓ Arquivo TUI encontrado: $CONTAINER_TUI"

# Verificar se é executável
if [ ! -x "$CONTAINER_TUI" ]; then
    echo "FAIL: Arquivo TUI não é executável"
    exit 1
fi

echo "✓ Arquivo TUI é executável"

# Testar dependências Python
if ! python3 -c "import json, subprocess, os, asyncio" 2>/dev/null; then
    echo "FAIL: Dependências Python básicas não disponíveis"
    exit 1
fi

echo "✓ Dependências Python básicas OK"

# Testar dependência Textual (opcional)
if python3 -c "import textual" 2>/dev/null; then
    echo "✓ Biblioteca Textual disponível"
    TEXTUAL_AVAILABLE=true
else
    echo "! Biblioteca Textual não disponível (será instalada quando necessário)"
    TEXTUAL_AVAILABLE=false
fi

# Verificar CLI wrapper
CLI_WRAPPER="$PROJECT_ROOT/bin/fazai-containers"
if [ ! -f "$CLI_WRAPPER" ]; then
    echo "FAIL: CLI wrapper não encontrado: $CLI_WRAPPER"
    exit 1
fi

echo "✓ CLI wrapper encontrado: $CLI_WRAPPER"

if [ ! -x "$CLI_WRAPPER" ]; then
    echo "FAIL: CLI wrapper não é executável"
    exit 1
fi

echo "✓ CLI wrapper é executável"

# Verificar Dockerfile de teste
DOCKER_TEST_FILE="$PROJECT_ROOT/Dockerfile.installer-test"
if [ ! -f "$DOCKER_TEST_FILE" ]; then
    echo "FAIL: Dockerfile de teste não encontrado: $DOCKER_TEST_FILE"
    exit 1
fi

echo "✓ Dockerfile de teste encontrado"

# Verificar script de entrypoint
ENTRYPOINT_SCRIPT="$PROJECT_ROOT/docker-installer-test-entrypoint.sh"
if [ ! -f "$ENTRYPOINT_SCRIPT" ]; then
    echo "FAIL: Script de entrypoint não encontrado: $ENTRYPOINT_SCRIPT"
    exit 1
fi

echo "✓ Script de entrypoint encontrado"

if [ ! -x "$ENTRYPOINT_SCRIPT" ]; then
    echo "FAIL: Script de entrypoint não é executável"
    exit 1
fi

echo "✓ Script de entrypoint é executável"

# Teste funcional básico (sem executar TUI, apenas importar)
if python3 -c "
import sys
sys.path.insert(0, '$PROJECT_ROOT/opt/fazai/tools')
try:
    import container_manager_tui
    # Testar funções básicas
    result = container_manager_tui.run_docker_command(['--version'])
    if result['success']:
        print('Docker funcional via TUI')
    else:
        print('Docker não funcional via TUI')
        sys.exit(1)
except ImportError as e:
    print(f'Erro ao importar TUI: {e}')
    sys.exit(1)
except Exception as e:
    print(f'Erro no teste funcional: {e}')
    sys.exit(1)
" 2>/dev/null; then
    echo "✓ Teste funcional básico OK"
else
    echo "FAIL: Teste funcional básico falhou"
    exit 1
fi

# Testar templates (verificar se estão bem formados)
python3 -c "
import sys
sys.path.insert(0, '$PROJECT_ROOT/opt/fazai/tools')
import container_manager_tui

templates = container_manager_tui.CONTAINER_TEMPLATES
print(f'Templates disponíveis: {len(templates)}')

for template_id, template in templates.items():
    required_fields = ['name', 'image', 'description', 'command', 'ports', 'volumes', 'env_vars', 'interactive']
    for field in required_fields:
        if field not in template:
            print(f'Template {template_id} não tem campo obrigatório: {field}')
            sys.exit(1)
    print(f'✓ Template {template_id}: {template[\"name\"]}')

print('Todos os templates estão bem formados')
"

if [ $? -eq 0 ]; then
    echo "✓ Validação de templates OK"
else
    echo "FAIL: Validação de templates falhou"
    exit 1
fi

echo ""
echo "=== Todos os testes passaram! ==="
echo "Container Manager TUI está funcional"
echo ""
echo "Para usar:"
echo "  npm run containers-tui"
echo "  ou"
echo "  $CLI_WRAPPER"
echo ""