#!/bin/bash

# Script de teste do FazAI
# Uso: bash test-fazai.sh

echo "🧪 TESTE DO FAZAI"
echo "================="
echo ""

# Verificar se o build existe
if [ ! -f "dist/app.cjs" ]; then
    echo "❌ Build não encontrado! Execute 'npm run build' primeiro."
    exit 1
fi

echo "✅ Build encontrado: dist/app.cjs"
echo ""

# Verificar Node.js
NODE_VERSION=$(node --version)
echo "✅ Node.js: $NODE_VERSION"
echo ""

# Verificar se API key está configurada
if [ -f ~/.fazai/config ]; then
    echo "✅ API key configurada em ~/.fazai/config"
    echo ""
else
    echo "⚠️  API key NÃO configurada"
    echo ""
    echo "Para configurar, você tem 3 opções:"
    echo ""
    echo "1. Criar arquivo manualmente:"
    echo "   mkdir -p ~/.fazai"
    echo "   echo 'ANTHROPIC_API_KEY=sk-ant-sua-chave' > ~/.fazai/config"
    echo ""
    echo "2. Usar variável de ambiente:"
    echo "   export ANTHROPIC_API_KEY=sk-ant-sua-chave"
    echo ""
    echo "3. Deixar o FazAI pedir na primeira execução"
    echo ""
    read -p "Você tem uma API key da Anthropic? (s/n): " tem_key

    if [ "$tem_key" = "s" ] || [ "$tem_key" = "S" ]; then
        echo ""
        read -p "Cole sua API key aqui: " api_key
        mkdir -p ~/.fazai
        echo "ANTHROPIC_API_KEY=$api_key" > ~/.fazai/config
        echo "✅ API key salva em ~/.fazai/config"
        echo ""
    else
        echo ""
        echo "❌ Você precisa de uma API key da Anthropic para usar o FazAI"
        echo "   Obtenha em: https://console.anthropic.com"
        exit 1
    fi
fi

# Menu de testes
echo "=========================================="
echo "ESCOLHA UM TESTE:"
echo "=========================================="
echo ""
echo "1. 🔍 Teste de Help (mostra ajuda)"
echo "2. 💬 Teste de Ask (pergunta segura, não executa nada)"
echo "3. 🧪 Teste Dry-Run (simula comandos sem executar)"
echo "4. ⚙️  Teste Config (lista API keys)"
echo "5. ⚠️  Teste Admin REAL (executa comandos - CUIDADO!)"
echo "6. 🚫 Sair"
echo ""
read -p "Escolha (1-6): " escolha

case $escolha in
    1)
        echo ""
        echo "🔍 Executando: node dist/app.cjs --help"
        echo "=========================================="
        node dist/app.cjs --help
        ;;
    2)
        echo ""
        echo "💬 Executando modo Ask com pergunta de teste..."
        echo "=========================================="
        node dist/app.cjs ask "O que é nginx e para que serve?"
        ;;
    3)
        echo ""
        echo "🧪 Executando modo Dry-Run..."
        echo "Você vai poder digitar uma tarefa e ver os comandos gerados"
        echo "NADA será executado de verdade!"
        echo "=========================================="
        node dist/app.cjs --dry-run
        ;;
    4)
        echo ""
        echo "⚙️  Executando: node dist/app.cjs config"
        echo "=========================================="
        node dist/app.cjs config
        ;;
    5)
        echo ""
        echo "⚠️  ATENÇÃO: Modo Admin REAL"
        echo "=========================================="
        echo "Isso VAI EXECUTAR comandos no seu sistema!"
        echo ""
        read -p "Tem certeza? (digite SIM para confirmar): " confirma

        if [ "$confirma" = "SIM" ]; then
            echo ""
            echo "Sugestões de tarefas SEGURAS para testar:"
            echo "  - mostrar data e hora"
            echo "  - mostrar usuário atual"
            echo "  - listar processos"
            echo ""
            node dist/app.cjs
        else
            echo "❌ Teste cancelado"
        fi
        ;;
    6)
        echo "👋 Até logo!"
        exit 0
        ;;
    *)
        echo "❌ Opção inválida"
        exit 1
        ;;
esac

echo ""
echo "✅ Teste concluído!"
