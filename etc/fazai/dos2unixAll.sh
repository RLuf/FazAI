#!/bin/bash

# Encontra e converte todos os arquivos relevantes
find . -type f \
    \( -name "*.sh" \
    -o -name "*.bash" \
    -o -name "*.conf" \
    -o -name "*.yml" \
    -o -name "*.yaml" \
    -o -name "*.json" \
    -o -name "Dockerfile" \) \
    -exec sh -c '
        for file do
            echo "🔄 Convertendo: $file"
            dos2unix "$file" 2>/dev/null
            if [ $? -eq 0 ]; then
                echo "✅ Convertido com sucesso: $file"
            else
                echo "❌ Erro ao converter: $file"
            fi
        done
    ' sh {} +