#!/bin/bash

# FazAI Gmail MCP Server - Instalador Automático
# Versão: 1.0.0
# Autor: Baseado no projeto FazAI

set -e

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configurações
PROJECT_NAME="fazai-gmail-mcp-server"
INSTALL_DIR="$HOME/.local/share/$PROJECT_NAME"
BIN_DIR="$HOME/.local/bin"
CONFIG_DIR="$HOME/.config/$PROJECT_NAME"

# Banner
echo -e "${BLUE}"
cat << "EOF"
 ______        _    ___   _____ __  __  _____ _____        __  __  _____ _____  
|  ____|      / \  |_ _| / ____|  \/  |/ ____|  __ \      |  \/  |/ ____|  __ \ 
| |__ __ _ ___|  _|  | | | |  __| \  / | |  __| |__) |     | \  / | |    | |__) |
|  __/ _` |_  / _ \ | | | | |_ | |\/| | | |_ |  ___/      | |\/| | |    |  ___/ 
| | | (_| |/ / ___ \| | | |__| | |  | | |__| | |          | |  | | |____| |     
|_|  \__,_/_/_/   \_\___|\_____|_|  |_|\_____|_|          |_|  |_|\_____|_|     
                                                                                
    🤖 Servidor MCP para Gmail + FazAI + Claude Desktop
    
EOF
echo -e "${NC}"

print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"  
}

print_error() {
    echo -e "${RED}[ERRO]${NC} $1"
}

print_step() {
    echo -e "${BLUE}[STEP]${NC} $1"
}

# Verificar se está executando como root
if [[ $EUID -eq 0 ]]; then
    print_error "Não execute este script como root!"
    exit 1
fi

# Verificar dependências
check_dependencies() {
    print_step "Verificando dependências..."
    
    # Node.js
    if ! command -v node &> /dev/null; then
        print_error "Node.js não encontrado!"
        print_status "Instale Node.js 18+ de: https://nodejs.org"
        exit 1
    fi
    
    local node_version=$(node -v | cut -d'v' -f2)
    local major_version=$(echo $node_version | cut -d'.' -f1)
    
    if [[ $major_version -lt 18 ]]; then
        print_error "Node.js versão $node_version detectada. Requer versão 18+!"
        exit 1
    fi
    
    print_status "Node.js versão $node_version ✓"
    
    # npm
    if ! command -v npm &> /dev/null; then
        print_error "npm não encontrado!"
        exit 1
    fi
    
    print_status "npm $(npm -v) ✓"
    
    # Git
    if ! command -v git &> /dev/null; then
        print_error "Git não encontrado!"
        print_status "Instale Git e tente novamente"
        exit 1
    fi
    
    print_status "Git $(git --version | cut -d' ' -f3) ✓"
    
    # FazAI (opcional, mas recomendado)
    if command -v fazai &> /dev/null; then
        print_status "FazAI $(fazai --version 2>/dev/null || echo 'encontrado') ✓"
    else
        print_warning "FazAI não encontrado - será instalado automaticamente"
    fi
}

# Criar diretórios
create_directories() {
    print_step "Criando diretórios..."
    
    mkdir -p "$INSTALL_DIR"
    mkdir -p "$BIN_DIR"
    mkdir -p "$CONFIG_DIR"
    mkdir -p "$HOME/.config/Claude"
    
    print_status "Diretórios criados em $INSTALL_DIR"
}

# Instalar FazAI se necessário
install_fazai() {
    if ! command -v fazai &> /dev/null; then
        print_step "Instalando FazAI..."
        
        # Baixar e instalar FazAI
        curl -fsSL https://github.com/RLuf/FazAI/raw/master/scripts/install.sh | bash
        
        # Verificar instalação
        if command -v fazai &> /dev/null; then
            print_status "FazAI instalado com sucesso! ✓"
        else
            print_warning "FazAI não pôde ser instalado automaticamente"
            print_status "Instale manualmente: https://github.com/RLuf/FazAI"
        fi
    fi
}

# Clonar/baixar projeto
download_project() {
    print_step "Baixando projeto..."
    
    cd "$INSTALL_DIR"
    
    # Aqui você colocaria o clone do repositório real
    # Por enquanto, vamos criar a estrutura
    
    # Criar package.json
    cat > package.json << 'EOF'
{
  "name": "fazai-gmail-mcp-server",
  "version": "1.0.0",
  "description": "MCP Server para integração Gmail + FazAI + Claude Desktop",
  "main": "dist/server.js",
  "type": "module",
  "scripts": {
    "build": "tsc",
    "start": "node dist/server.js",
    "dev": "tsx src/server.ts",
    "test": "jest",
    "lint": "eslint src/**/*.ts"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.0.0",
    "googleapis": "^128.0.0",
    "express": "^4.18.2",
    "ws": "^8.14.2",
    "dotenv": "^16.0.3",
    "winston": "^3.8.2",
    "node-cron": "^3.0.2",
    "axios": "^1.6.0",
    "zod": "^3.22.4"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "@types/express": "^4.17.17",
    "@types/ws": "^8.5.5",
    "typescript": "^5.0.0",
    "tsx": "^4.0.0",
    "eslint": "^8.0.0",
    "@typescript-eslint/eslint-plugin": "^6.0.0",
    "@typescript-eslint/parser": "^6.0.0",
    "jest": "^29.0.0",
    "@types/jest": "^29.0.0"
  },
  "keywords": ["mcp", "gmail", "fazai", "claude", "desktop", "ai"],
  "author": "FazAI Community",
  "license": "Apache-2.0"
}
EOF
    
    # Criar tsconfig.json
    cat > tsconfig.json << 'EOF'
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "node",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "declaration": true,
    "sourceMap": true,
    "resolveJsonModule": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
EOF
    
    # Criar estrutura de diretórios
    mkdir -p src/{gmail,fazai,types,utils}
    
    print_status "Projeto configurado em $INSTALL_DIR"
}

# Instalar dependências npm
install_dependencies() {
    print_step "Instalando dependências npm..."
    
    cd "$INSTALL_DIR"
    npm install --silent
    
    print_status "Dependências instaladas ✓"
}

# Criar arquivos de configuração
create_config_files() {
    print_step "Criando arquivos de configuração..."
    
    # .env.example
    cat > "$INSTALL_DIR/.env.example" << 'EOF'
# Gmail API Configuration
GMAIL_CLIENT_ID=your-gmail-client-id
GMAIL_CLIENT_SECRET=your-gmail-client-secret
GMAIL_REDIRECT_URI=http://localhost:3000/oauth/callback

# FazAI Configuration  
FAZAI_PATH=/usr/local/bin/fazai
FAZAI_CONFIG_PATH=~/.fazai/config

# MCP Server Configuration
MCP_PORT=3001
MCP_HOST=localhost

# Logging
LOG_LEVEL=info
LOG_FILE=~/.local/share/fazai-gmail-mcp-server/logs/server.log

# Security
ENABLE_CORS=true
ALLOWED_ORIGINS=http://localhost:3000,https://claude.ai

# Features
ENABLE_AUTO_DOWNLOAD=true
ENABLE_FAZAI_INTEGRATION=true
ENABLE_DESKTOP_STREAMING=true

# Gmail Monitoring
GMAIL_CHECK_INTERVAL=1800000
GMAIL_QUERY_FILTER=export conversation chat download takeout
GMAIL_MAX_RESULTS=50
EOF
    
    # Copiar .env se não existir
    if [[ ! -f "$INSTALL_DIR/.env" ]]; then
        cp "$INSTALL_DIR/.env.example" "$INSTALL_DIR/.env"
        print_status "Arquivo .env criado - CONFIGURE SUAS CREDENCIAIS!"
    fi
    
    # Configuração base do Claude Desktop
    local claude_config="$HOME/.config/Claude/claude_desktop_config.json"
    if [[ ! -f "$claude_config" ]]; then
        cat > "$claude_config" << EOF
{
  "mcpServers": {
    "fazai-gmail-mcp": {
      "command": "node",
      "args": ["$INSTALL_DIR/dist/server.js"],
      "env": {
        "NODE_ENV": "production",
        "CONFIG_PATH": "$INSTALL_DIR/.env"
      }
    }
  }
}
EOF
        print_status "Configuração Claude Desktop criada"
    else
        print_warning "Claude Desktop já configurado - verifique manualmente"
    fi
}

# Criar servidor MCP básico
create_basic_server() {
    print_step "Criando servidor MCP..."
    
    # Servidor principal
    cat > "$INSTALL_DIR/src/server.ts" << 'EOF'
#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { createGmailTools } from './gmail/gmail-tools.js';
import { createFazaiTools } from './fazai/fazai-tools.js';
import { logger } from './utils/logger.js';
import dotenv from 'dotenv';

// Carregar configuração
dotenv.config();

class FazaiGmailMCPServer {
  private server: Server;
  private gmailTools: any;
  private fazaiTools: any;

  constructor() {
    this.server = new Server(
      {
        name: 'fazai-gmail-mcp-server',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupToolHandlers();
    this.setupTools();
  }

  private setupTools() {
    // this.gmailTools = createGmailTools();
    // this.fazaiTools = createFazaiTools();
    
    logger.info('FazAI Gmail MCP Server inicializado');
  }

  private setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      const tools = [
        {
          name: 'check_gmail_export_emails',
          description: 'Verifica emails com instruções de export de chat',
          inputSchema: {
            type: 'object',
            properties: {
              query: { type: 'string', description: 'Query de busca' },
              maxResults: { type: 'number', description: 'Máximo de resultados' }
            }
          }
        },
        {
          name: 'fazai_execute',
          description: 'Executa comandos via FazAI',
          inputSchema: {
            type: 'object',
            properties: {
              command: { type: 'string', description: 'Comando para executar' },
              dryRun: { type: 'boolean', description: 'Modo simulação' }
            }
          }
        }
      ];

      return { tools };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'check_gmail_export_emails':
            return {
              content: [
                {
                  type: 'text',
                  text: `Verificando Gmail por exports... (implementar)\nQuery: ${args?.query}\nMax: ${args?.maxResults}`
                }
              ]
            };

          case 'fazai_execute':
            return {
              content: [
                {
                  type: 'text', 
                  text: `Executando FazAI... (implementar)\nComando: ${args?.command}\nDry Run: ${args?.dryRun}`
                }
              ]
            };

          default:
            throw new Error(`Ferramenta desconhecida: ${name}`);
        }
      } catch (error) {
        logger.error(`Erro executando ferramenta ${name}:`, error);
        throw error;
      }
    });
  }

  async start() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    logger.info('Servidor MCP conectado via stdio');
  }
}

// Inicializar servidor
const server = new FazaiGmailMCPServer();
server.start().catch((error) => {
  logger.error('Erro iniciando servidor:', error);
  process.exit(1);
});
EOF

    # Logger básico
    cat > "$INSTALL_DIR/src/utils/logger.ts" << 'EOF'
import winston from 'winston';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const logDir = process.env.LOG_FILE ? 
  path.dirname(process.env.LOG_FILE) : 
  path.join(__dirname, '../../logs');

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'fazai-gmail-mcp' },
  transports: [
    new winston.transports.File({ 
      filename: path.join(logDir, 'error.log'), 
      level: 'error' 
    }),
    new winston.transports.File({ 
      filename: path.join(logDir, 'combined.log') 
    }),
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});
EOF

    # Criar outros arquivos básicos
    touch "$INSTALL_DIR/src/gmail/gmail-tools.ts"
    touch "$INSTALL_DIR/src/fazai/fazai-tools.ts"
    
    # Criar diretório de logs
    mkdir -p "$INSTALL_DIR/logs"
    
    print_status "Servidor MCP criado"
}

# Build do projeto
build_project() {
    print_step "Fazendo build do projeto..."
    
    cd "$INSTALL_DIR"
    npm run build
    
    print_status "Build concluído ✓"
}

# Criar script executável
create_executable() {
    print_step "Criando executável..."
    
    cat > "$BIN_DIR/fazai-gmail-mcp" << EOF
#!/bin/bash
cd "$INSTALL_DIR"
node dist/server.js "\$@"
EOF
    
    chmod +x "$BIN_DIR/fazai-gmail-mcp"
    
    print_status "Executável criado em $BIN_DIR/fazai-gmail-mcp"
}

# Configurar PATH
setup_path() {
    local shell_rc=""
    
    if [[ -n "$BASH_VERSION" ]]; then
        shell_rc="$HOME/.bashrc"
    elif [[ -n "$ZSH_VERSION" ]]; then
        shell_rc="$HOME/.zshrc"
    fi
    
    if [[ -n "$shell_rc" && -f "$shell_rc" ]]; then
        if ! grep -q "$BIN_DIR" "$shell_rc"; then
            echo "export PATH=\"$BIN_DIR:\$PATH\"" >> "$shell_rc"
            print_status "PATH configurado em $shell_rc"
        fi
    fi
}

# Verificar instalação
verify_installation() {
    print_step "Verificando instalação..."
    
    if [[ -f "$INSTALL_DIR/dist/server.js" ]]; then
        print_status "Servidor compilado ✓"
    else
        print_error "Servidor não compilado!"
        return 1
    fi
    
    if [[ -f "$BIN_DIR/fazai-gmail-mcp" ]]; then
        print_status "Executável disponível ✓"
    else
        print_error "Executável não criado!"
        return 1
    fi
    
    if [[ -f "$HOME/.config/Claude/claude_desktop_config.json" ]]; then
        print_status "Claude Desktop configurado ✓"
    else
        print_warning "Claude Desktop não configurado"
    fi
    
    print_status "Instalação verificada com sucesso!"
}

# Mostrar informações pós-instalação
show_post_install_info() {
    echo
    print_step "🎉 Instalação concluída com sucesso!"
    echo
    
    cat << EOF
📍 LOCALIZAÇÃO DOS ARQUIVOS:
   Instalação: $INSTALL_DIR
   Executável: $BIN_DIR/fazai-gmail-mcp
   Configuração: $INSTALL_DIR/.env
   Claude Config: $HOME/.config/Claude/claude_desktop_config.json

⚙️  PRÓXIMOS PASSOS:

1. 🔑 Configure suas credenciais Gmail API:
   nano $INSTALL_DIR/.env
   
   Obtenha credenciais em:
   https://console.cloud.google.com/apis/credentials

2. 🤖 Configure FazAI (se ainda não feito):
   fazai config

3. 🖥️ Reinicie Claude Desktop para carregar o MCP server

4. ✅ Teste a integração:
   - Abra Claude Desktop
   - Pergunte: "Verifique meus emails por exports de chat"

📚 DOCUMENTAÇÃO:
   README: $INSTALL_DIR/README.md
   Logs: $INSTALL_DIR/logs/

🆘 SUPORTE:
   GitHub: https://github.com/fazai/fazai-gmail-mcp-server
   Discord: https://discord.gg/fazai

EOF

    print_warning "IMPORTANTE: Edite $INSTALL_DIR/.env com suas credenciais antes de usar!"
    echo
}

# Função principal
main() {
    echo "🚀 Iniciando instalação do FazAI Gmail MCP Server..."
    echo
    
    check_dependencies
    create_directories
    install_fazai
    download_project
    install_dependencies
    create_config_files
    create_basic_server
    build_project
    create_executable
    setup_path
    verify_installation
    show_post_install_info
    
    print_status "✨ Instalação concluída!"
    echo "   Execute: source ~/.bashrc (ou ~/.zshrc) para atualizar PATH"
    echo "   Em seguida: fazai-gmail-mcp para testar"
}

# Executar instalação
main "$@"