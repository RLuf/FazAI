#!/bin/bash

# FazAI - Script de Configuração do GitHub
# Este script ajuda a inicializar um repositório Git e configurá-lo para o GitHub

# Cores para saída no terminal
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== FazAI - Script de Configuração do GitHub ===${NC}"
echo -e "Este script irá ajudá-lo a configurar seu repositório Git e conectá-lo ao GitHub."
echo

# Verificar se o Git está instalado
if ! command -v git &> /dev/null; then
    echo -e "${RED}Git não está instalado. Por favor, instale o Git primeiro.${NC}"
    exit 1
fi

# Verificar se já existe um repositório Git
if [ -d .git ]; then
    echo -e "${YELLOW}Repositório Git já existe neste diretório.${NC}"
    
    # Verificar se já existe um remote
    REMOTE_URL=$(git config --get remote.origin.url)
    if [ -n "$REMOTE_URL" ]; then
        echo -e "${YELLOW}Remote 'origin' já configurado: ${REMOTE_URL}${NC}"
        
        read -p "Deseja alterar o remote? (s/N): " CHANGE_REMOTE
        if [[ $CHANGE_REMOTE =~ ^[Ss]$ ]]; then
            read -p "Digite o novo URL do repositório GitHub (ex: https://github.com/rluf/fazai.git): " REPO_URL
            git remote set-url origin $REPO_URL
            echo -e "${GREEN}Remote atualizado para: ${REPO_URL}${NC}"
        fi
    else
        read -p "Digite o URL do repositório GitHub (ex: https://github.com/rluf/fazai.git): " REPO_URL
        git remote add origin $REPO_URL
        echo -e "${GREEN}Remote 'origin' adicionado: ${REPO_URL}${NC}"
    fi
else
    echo -e "${YELLOW}Nenhum repositório Git encontrado. Inicializando...${NC}"
    git init
    echo -e "${GREEN}Repositório Git inicializado.${NC}"
    
    read -p "Digite o URL do repositório GitHub (ex: https://github.com/rluf/fazai.git): " REPO_URL
    git remote add origin $REPO_URL
    echo -e "${GREEN}Remote 'origin' adicionado: ${REPO_URL}${NC}"
    
    # Adicionar todos os arquivos
    git add .
    echo -e "${GREEN}Arquivos adicionados ao staging.${NC}"
    
    # Commit inicial
    git commit -m "Commit inicial"
    echo -e "${GREEN}Commit inicial criado.${NC}"
fi

# Verificar branches
CURRENT_BRANCH=$(git branch --show-current)
echo -e "${BLUE}Branch atual: ${CURRENT_BRANCH}${NC}"

# Listar branches
echo -e "${BLUE}Branches locais:${NC}"
git branch

# Perguntar se deseja criar uma nova branch
read -p "Deseja criar uma nova branch? (s/N): " CREATE_BRANCH
if [[ $CREATE_BRANCH =~ ^[Ss]$ ]]; then
    read -p "Digite o nome da nova branch: " BRANCH_NAME
    git checkout -b $BRANCH_NAME
    echo -e "${GREEN}Branch '${BRANCH_NAME}' criada e selecionada.${NC}"
fi

# Perguntar se deseja fazer push
read -p "Deseja fazer push para o GitHub? (s/N): " DO_PUSH
if [[ $DO_PUSH =~ ^[Ss]$ ]]; then
    CURRENT_BRANCH=$(git branch --show-current)
    
    # Verificar se é o primeiro push
    if ! git ls-remote --exit-code origin &>/dev/null; then
        echo -e "${YELLOW}Primeiro push para o repositório remoto.${NC}"
        git push -u origin $CURRENT_BRANCH
    else
        git push origin $CURRENT_BRANCH
    fi
    
    echo -e "${GREEN}Push realizado com sucesso para a branch '${CURRENT_BRANCH}'.${NC}"
fi

# Perguntar se deseja fazer merge com a main
read -p "Deseja fazer merge com a branch main? (s/N): " DO_MERGE
if [[ $DO_MERGE =~ ^[Ss]$ ]]; then
    CURRENT_BRANCH=$(git branch --show-current)
    
    if [ "$CURRENT_BRANCH" = "main" ]; then
        echo -e "${YELLOW}Você já está na branch main.${NC}"
    else
        # Verificar se a branch main existe localmente
        if git show-ref --verify --quiet refs/heads/main; then
            echo -e "${BLUE}Fazendo checkout para a branch main...${NC}"
            git checkout main
            
            echo -e "${BLUE}Fazendo merge da branch '${CURRENT_BRANCH}' para main...${NC}"
            git merge $CURRENT_BRANCH
            
            echo -e "${GREEN}Merge realizado com sucesso.${NC}"
            
            read -p "Deseja fazer push da branch main para o GitHub? (s/N): " PUSH_MAIN
            if [[ $PUSH_MAIN =~ ^[Ss]$ ]]; then
                git push origin main
                echo -e "${GREEN}Push da branch main realizado com sucesso.${NC}"
            fi
        else
            echo -e "${YELLOW}A branch main não existe localmente.${NC}"
            read -p "Deseja criar a branch main a partir da branch atual? (s/N): " CREATE_MAIN
            
            if [[ $CREATE_MAIN =~ ^[Ss]$ ]]; then
                git checkout -b main
                echo -e "${GREEN}Branch main criada a partir de '${CURRENT_BRANCH}'.${NC}"
                
                read -p "Deseja fazer push da branch main para o GitHub? (s/N): " PUSH_MAIN
                if [[ $PUSH_MAIN =~ ^[Ss]$ ]]; then
                    git push -u origin main
                    echo -e "${GREEN}Push da branch main realizado com sucesso.${NC}"
                fi
            fi
        fi
    fi
fi

echo -e "${BLUE}=== Configuração do GitHub concluída ===${NC}"
echo -e "Resumo:"
echo -e "  Repositório: $(git config --get remote.origin.url)"
echo -e "  Branch atual: $(git branch --show-current)"
echo -e "${YELLOW}Para mais informações sobre como usar o Git e GitHub, consulte a documentação oficial:${NC}"
echo -e "  https://docs.github.com/pt"
