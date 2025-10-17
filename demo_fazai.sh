#!/bin/bash

# Demonstração do FazAI - Administrador Linux Inteligente
# Este script mostra exemplos de uso do FazAI

echo "🎯 FazAI - Demonstração de Funcionalidades"
echo "=========================================="
echo ""

echo "1. 📋 Verificando configuração de chaves API:"
echo "   ./fazai config"
./fazai config
echo ""

echo "2. ❓ Modo de perguntas sobre código:"
echo "   ./fazai ask https://github.com/microsoft/vscode 'Como funciona a extensão API?'"
echo "   (Não executado para não consumir tokens)"
echo ""

echo "3. 🖥️ Modo administrador Linux (dry-run):"
echo "   ./fazai --admin --dry-run"
echo "   Comandos de exemplo:"
echo "   - 'verificar uso de disco'"
echo "   - 'instalar nginx'"
echo "   - 'reiniciar serviço ssh'"
echo "   - 'criar usuário admin'"
echo ""

echo "4. 📚 Ajuda completa:"
echo "   ./fazai --help | head -20"
./fazai --help | head -20
echo ""

echo "✅ FazAI instalado e configurado com sucesso!"
echo "📖 Consulte README.md para documentação completa"
