#!/bin/bash

# FazAI - Script de Diagnóstico Rápido
echo "=== DIAGNÓSTICO FAZAI ==="

# Verifica sistema
echo "Sistema: $(uname -a)"
echo "Distribuição: $(cat /etc/os-release | grep PRETTY_NAME)"

# Verifica Node.js
if command -v node &> /dev/null; then
    echo "✅ Node.js: $(node -v)"
else
    echo "❌ Node.js não encontrado"
fi

# Verifica NPM  
if command -v npm &> /dev/null; then
    echo "✅ NPM: $(npm -v)"
else
    echo "❌ NPM não encontrado"
fi

# Verifica GCC
if command -v gcc &> /dev/null; then
    echo "✅ GCC: $(gcc --version | head -n1)"
else
    echo "❌ GCC não encontrado"
fi

# Testa instalação das dependências críticas
echo -e "\n=== TESTANDO DEPENDÊNCIAS ==="
npm list axios express winston blessed 2>/dev/null || echo "⚠️  Algumas dependências faltando"

# Verifica se os diretórios existem
echo -e "\n=== VERIFICANDO ESTRUTURA ==="
dirs=("/opt/fazai" "/etc/fazai" "/var/log/fazai")
for dir in "${dirs[@]}"; do
    if [ -d "$dir" ]; then
        echo "✅ $dir existe"
    else
        echo "❌ $dir não existe"
    fi
done

# Verifica permissões
echo -e "\n=== VERIFICANDO PERMISSÕES ==="
if [ "$EUID" -eq 0 ]; then
    echo "✅ Rodando como root"
else
    echo "⚠️  Não é root (pode causar problemas)"
fi

echo -e "\n=== RECOMENDAÇÕES ==="
echo "1. Execute as correções do arquivo fazai-quick-fixes"  
echo "2. Se ainda der erro, rode: sudo apt update && sudo apt install -y nodejs npm build-essential"
echo "3. Teste novamente com: bash debug-fazai.sh"