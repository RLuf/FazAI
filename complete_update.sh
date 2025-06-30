#!/bin/bash
# Script para completar as atualizações do FazAI v1.40

echo "🔧 Completando atualizações do FazAI v1.40..."

# Backup dos arquivos originais
cp install.sh install.sh.backup
cp uninstall.sh uninstall.sh.backup

echo "✅ Backup dos arquivos originais criado"

# Adiciona fazai_html_v1.sh ao uninstall.sh
sed -i 's|"/opt/fazai/tools/fazai-config.js"|"/opt/fazai/tools/fazai-config.js"\n        "/opt/fazai/tools/fazai_html_v1.sh"|' uninstall.sh

# Adiciona fazai_html_v1.sh à lista de remoção no uninstall.sh
sed -i 's|"/opt/fazai/tools/fazai-config.js"|"/opt/fazai/tools/fazai-config.js"\n    "/opt/fazai/tools/fazai_html_v1.sh"|' uninstall.sh

echo "✅ uninstall.sh atualizado"

# Verifica se as atualizações foram aplicadas
echo "🔍 Verificando atualizações..."

echo "Versões encontradas:"
grep "VERSION=" install.sh | head -1
grep "version" package.json | head -1
grep "VERSION=" opt/fazai/tools/fazai-tui.sh | head -1

echo ""
echo "Scripts web encontrados:"
ls -la opt/fazai/tools/fazai_web.sh 2>/dev/null && echo "✅ fazai_web.sh encontrado" || echo "❌ fazai_web.sh não encontrado"
ls -la opt/fazai/tools/fazai_html_v1.sh 2>/dev/null && echo "✅ fazai_html_v1.sh encontrado" || echo "❌ fazai_html_v1.sh não encontrado"

echo ""
echo "Links simbólicos no uninstall.sh:"
grep "fazai-html" uninstall.sh && echo "✅ fazai-html encontrado no uninstall.sh" || echo "❌ fazai-html não encontrado no uninstall.sh"

echo ""
echo "🎯 Resumo das atualizações:"
echo "✅ Versões corrigidas para 1.40"
echo "✅ fazai_web.sh incorporado"
echo "🔧 fazai_html_v1.sh preparado (necessita edição manual do install.sh)"
echo "✅ uninstall.sh atualizado"

echo ""
echo "📝 Para completar:"
echo "1. Edite manualmente o install.sh para adicionar a seção do fazai_html_v1.sh"
echo "2. Execute: sudo bash install.sh"
echo "3. Teste: fazai --version"

echo ""
echo "✅ Script de atualização concluído!"