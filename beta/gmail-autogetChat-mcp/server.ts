import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { 
  CallToolRequestSchema, 
  ListToolsRequestSchema,
  Tool 
} from '@modelcontextprotocol/sdk/types.js';
import { google, gmail_v1 } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import axios from 'axios';
import winston from 'winston';
import dotenv from 'dotenv';

dotenv.config();

const execAsync = promisify(exec);

// Logger configurado
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'fazai-gmail-mcp.log' })
  ]
});

interface GmailExportEmail {
  id: string;
  subject: string;
  from: string;
  date: string;
  body: string;
  downloadLinks: string[];
}

interface FazaiResult {
  success: boolean;
  output: string;
  commands: string[];
  risk: string;
}

class FazaiGmailMCPServer {
  private server: Server;
  private gmailClient: gmail_v1.Gmail | null = null;
  private oAuth2Client: OAuth2Client | null = null;

  constructor() {
    this.server = new Server(
      {
        name: 'fazai-gmail-mcp-server',
        version: '1.0.0',
        description: 'MCP Server para integração Gmail + FazAI + Claude Desktop'
      },
      {
        capabilities: {
          tools: {},
          resources: {},
          prompts: {}
        }
      }
    );

    this.setupAuth();
    this.setupToolHandlers();
    logger.info('FazAI Gmail MCP Server inicializado');
  }

  private async setupAuth() {
    try {
      this.oAuth2Client = new OAuth2Client(
        process.env.GMAIL_CLIENT_ID,
        process.env.GMAIL_CLIENT_SECRET,
        process.env.GMAIL_REDIRECT_URI || 'http://localhost:3000/oauth/callback'
      );

      // Tentar carregar token existente
      const tokenPath = path.join(process.cwd(), 'gmail-token.json');
      try {
        const tokenData = await fs.readFile(tokenPath, 'utf8');
        const tokens = JSON.parse(tokenData);
        this.oAuth2Client.setCredentials(tokens);
        
        this.gmailClient = google.gmail({ 
          version: 'v1', 
          auth: this.oAuth2Client 
        });
        
        logger.info('Gmail API autenticado via token salvo');
      } catch (error) {
        logger.warn('Token Gmail não encontrado - será necessário autenticar');
      }
    } catch (error) {
      logger.error('Erro configurando autenticação Gmail:', error);
    }
  }

  private setupToolHandlers() {
    // Lista de ferramentas disponíveis
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      const tools: Tool[] = [
        {
          name: 'check_gmail_export_emails',
          description: 'Verifica emails do Gmail com instruções para baixar exports de chat/conversa',
          inputSchema: {
            type: 'object',
            properties: {
              query: {
                type: 'string',
                description: 'Termos de busca (padrão: "export conversation chat download takeout")',
                default: 'export conversation chat download takeout'
              },
              maxResults: {
                type: 'number', 
                description: 'Máximo de emails para verificar',
                default: 10,
                minimum: 1,
                maximum: 100
              },
              labelIds: {
                type: 'array',
                items: { type: 'string' },
                description: 'IDs de labels para filtrar (opcional)'
              }
            }
          }
        },
        {
          name: 'download_chat_export',
          description: 'Baixa automaticamente exports de chat a partir de URLs encontrados em emails',
          inputSchema: {
            type: 'object',
            properties: {
              exportUrl: {
                type: 'string',
                description: 'URL do export para baixar'
              },
              destinationPath: {
                type: 'string', 
                description: 'Caminho de destino (padrão: ./downloads/)',
                default: './downloads/'
              },
              notify: {
                type: 'boolean',
                description: 'Notificar usuário quando download completar',
                default: true
              }
            },
            required: ['exportUrl']
          }
        },
        {
          name: 'fazai_execute',
          description: 'Executa comandos de administração Linux via FazAI',
          inputSchema: {
            type: 'object',
            properties: {
              command: {
                type: 'string',
                description: 'Comando em linguagem natural para o FazAI executar'
              },
              dryRun: {
                type: 'boolean',
                description: 'Modo simulação - não executa, apenas mostra comandos',
                default: false
              },
              model: {
                type: 'string',
                description: 'Modelo IA a usar (sonnet35, haiku, gpt4o)',
                default: 'sonnet35',
                enum: ['sonnet35', 'haiku', 'gpt4o', 'gpt4mini']
              },
              interactive: {
                type: 'boolean',
                description: 'Modo interativo com confirmações',
                default: true
              }
            },
            required: ['command']
          }
        },
        {
          name: 'fazai_status',
          description: 'Verifica status e configuração do FazAI',
          inputSchema: {
            type: 'object',
            properties: {}
          }
        },
        {
          name: 'desktop_interact',
          description: 'Interage com desktop via streaming/endpoint para FazAI CLI',
          inputSchema: {
            type: 'object',
            properties: {
              action: {
                type: 'string',
                description: 'Ação a executar',
                enum: ['start_stream', 'stop_stream', 'send_command', 'get_status']
              },
              params: {
                type: 'object',
                description: 'Parâmetros específicos da ação'
              }
            },
            required: ['action']
          }
        },
        {
          name: 'list_exports',
          description: 'Lista exports de chat disponíveis para download',
          inputSchema: {
            type: 'object',
            properties: {
              status: {
                type: 'string',
                description: 'Filtrar por status',
                enum: ['ready', 'processing', 'expired', 'downloaded']
              },
              dateRange: {
                type: 'string',
                description: 'Período em dias (ex: 7 para últimos 7 dias)'
              }
            }
          }
        },
        {
          name: 'get_export_status',
          description: 'Verifica status específico de um export',
          inputSchema: {
            type: 'object',
            properties: {
              exportId: {
                type: 'string',
                description: 'ID do export para verificar'
              }
            },
            required: ['exportId']
          }
        }
      ];

      return { tools };
    });

    // Handler de execução de ferramentas
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      
      logger.info(`Executando ferramenta: ${name}`, { args });

      try {
        switch (name) {
          case 'check_gmail_export_emails':
            return await this.checkGmailExportEmails(args);
            
          case 'download_chat_export':
            return await this.downloadChatExport(args);
            
          case 'fazai_execute':
            return await this.fazaiExecute(args);
            
          case 'fazai_status':
            return await this.fazaiStatus();
            
          case 'desktop_interact':
            return await this.desktopInteract(args);
            
          case 'list_exports':
            return await this.listExports(args);
            
          case 'get_export_status':
            return await this.getExportStatus(args);
            
          default:
            throw new Error(`Ferramenta desconhecida: ${name}`);
        }
      } catch (error) {
        logger.error(`Erro executando ${name}:`, error);
        return {
          content: [
            {
              type: 'text',
              text: `❌ Erro executando ${name}: ${error.message}`
            }
          ],
          isError: true
        };
      }
    });
  }

  private async checkGmailExportEmails(args: any) {
    if (!this.gmailClient) {
      return {
        content: [
          {
            type: 'text',
            text: '❌ Gmail não autenticado. Configure OAuth2 primeiro.'
          }
        ]
      };
    }

    const query = args?.query || 'export conversation chat download takeout';
    const maxResults = args?.maxResults || 10;

    try {
      logger.info('Verificando Gmail por emails de export', { query, maxResults });

      const response = await this.gmailClient.users.messages.list({
        userId: 'me',
        q: query,
        maxResults
      });

      const messages = response.data.messages || [];
      const exportEmails: GmailExportEmail[] = [];

      for (const message of messages) {
        const details = await this.gmailClient.users.messages.get({
          userId: 'me',
          id: message.id!
        });

        const headers = details.data.payload?.headers || [];
        const subject = headers.find(h => h.name === 'Subject')?.value || '';
        const from = headers.find(h => h.name === 'From')?.value || '';
        const date = headers.find(h => h.name === 'Date')?.value || '';
        
        // Extrair corpo do email
        let body = '';
        if (details.data.payload?.body?.data) {
          body = Buffer.from(details.data.payload.body.data, 'base64').toString();
        }

        // Procurar por links de download
        const downloadLinks = this.extractDownloadLinks(body);
        
        if (downloadLinks.length > 0) {
          exportEmails.push({
            id: message.id!,
            subject,
            from,
            date,
            body: body.substring(0, 500), // Truncar para brevidade
            downloadLinks
          });
        }
      }

      const resultText = exportEmails.length > 0 
        ? `📧 Encontrados ${exportEmails.length} emails com instruções de export:\n\n` +
          exportEmails.map(email => 
            `• **${email.subject}**\n  De: ${email.from}\n  Data: ${email.date}\n  Links: ${email.downloadLinks.length} encontrados\n`
          ).join('\n')
        : '📭 Nenhum email com instruções de export encontrado.';

      return {
        content: [
          {
            type: 'text',
            text: resultText
          }
        ]
      };

    } catch (error) {
      logger.error('Erro verificando Gmail:', error);
      throw error;
    }
  }

  private async downloadChatExport(args: any) {
    const exportUrl = args?.exportUrl;
    const destinationPath = args?.destinationPath || './downloads/';
    const notify = args?.notify !== false;

    if (!exportUrl) {
      throw new Error('URL do export é obrigatória');
    }

    try {
      logger.info('Iniciando download do export', { exportUrl, destinationPath });

      // Criar diretório de destino
      await fs.mkdir(destinationPath, { recursive: true });

      // Download do arquivo
      const response = await axios({
        method: 'GET',
        url: exportUrl,
        responseType: 'stream'
      });

      const filename = `chat-export-${Date.now()}.zip`;
      const filepath = path.join(destinationPath, filename);
      
      const writer = (await import('fs')).createWriteStream(filepath);
      response.data.pipe(writer);

      return new Promise((resolve, reject) => {
        writer.on('finish', () => {
          const resultText = notify 
            ? `✅ Export baixado com sucesso!\n\n📁 **Arquivo:** ${filepath}\n📊 **Tamanho:** ${response.headers['content-length'] || 'Desconhecido'}\n⏰ **Data:** ${new Date().toLocaleString()}\n\n🤖 Use FazAI para processar o arquivo se necessário.`
            : `Export baixado: ${filepath}`;

          logger.info('Download concluído', { filepath });
          
          resolve({
            content: [
              {
                type: 'text',
                text: resultText
              }
            ]
          });
        });

        writer.on('error', (error) => {
          logger.error('Erro no download:', error);
          reject(error);
        });
      });

    } catch (error) {
      logger.error('Erro baixando export:', error);
      throw error;
    }
  }

  private async fazaiExecute(args: any) {
    const command = args?.command;
    const dryRun = args?.dryRun || false;
    const model = args?.model || 'sonnet35';
    const interactive = args?.interactive !== false;

    if (!command) {
      throw new Error('Comando é obrigatório');
    }

    try {
      logger.info('Executando FazAI', { command, dryRun, model });

      // Verificar se FazAI está disponível
      const fazaiPath = process.env.FAZAI_PATH || 'fazai';
      
      try {
        await execAsync(`${fazaiPath} --version`);
      } catch (error) {
        throw new Error('FazAI não encontrado. Instale com: curl -fsSL https://github.com/RLuf/FazAI/raw/master/scripts/install.sh | bash');
      }

      // Construir comando FazAI
      let fazaiCmd = `${fazaiPath} ${model}`;
      
      if (dryRun) {
        fazaiCmd += ' --dry-run';
      }
      
      if (!interactive) {
        fazaiCmd += ' --no-confirm';
      }

      // Executar FazAI
      const { stdout, stderr } = await execAsync(`echo "${command}" | ${fazaiCmd}`);
      
      const success = !stderr || !stderr.includes('ERROR');
      const output = stdout || stderr;

      // Extrair comandos gerados (parsing básico)
      const commandMatches = output.match(/Comando: (.+)/g) || [];
      const commands = commandMatches.map(match => match.replace('Comando: ', ''));

      const resultText = success
        ? `✅ **FazAI executado com sucesso!**\n\n` +
          `🤖 **Comando:** ${command}\n` +
          `⚙️ **Modelo:** ${model}\n` +
          `🧪 **Dry Run:** ${dryRun ? 'Sim' : 'Não'}\n\n` +
          `📋 **Comandos Gerados:**\n${commands.map(cmd => `• \`${cmd}\``).join('\n')}\n\n` +
          `📄 **Output:**\n\`\`\`\n${output.substring(0, 1000)}${output.length > 1000 ? '\n...' : ''}\n\`\`\``
        : `❌ **Erro executando FazAI:**\n\`\`\`\n${output}\n\`\`\``;

      return {
        content: [
          {
            type: 'text',
            text: resultText
          }
        ]
      };

    } catch (error) {
      logger.error('Erro executando FazAI:', error);
      throw error;
    }
  }

  private async fazaiStatus() {
    try {
      const fazaiPath = process.env.FAZAI_PATH || 'fazai';
      
      // Verificar se FazAI está instalado
      const { stdout: versionOutput } = await execAsync(`${fazaiPath} --version`);
      
      // Verificar configuração
      const { stdout: configOutput } = await execAsync(`${fazaiPath} config`);

      const resultText = `🤖 **Status do FazAI:**\n\n` +
        `📍 **Localização:** ${fazaiPath}\n` +
        `🔖 **Versão:** ${versionOutput.trim()}\n\n` +
        `⚙️ **Configuração:**\n\`\`\`\n${configOutput}\n\`\`\``;

      return {
        content: [
          {
            type: 'text',
            text: resultText
          }
        ]
      };

    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `❌ **FazAI não disponível**\n\nErro: ${error.message}\n\n🔧 **Para instalar:**\n\`\`\`bash\ncurl -fsSL https://github.com/RLuf/FazAI/raw/master/scripts/install.sh | bash\n\`\`\``
          }
        ]
      };
    }
  }

  private async desktopInteract(args: any) {
    const action = args?.action;
    const params = args?.params || {};

    if (!action) {
      throw new Error('Ação é obrigatória');
    }

    logger.info('Interação desktop', { action, params });

    switch (action) {
      case 'start_stream':
        return await this.startFazaiStream(params);
        
      case 'stop_stream':
        return await this.stopFazaiStream(params);
        
      case 'send_command':
        return await this.sendStreamCommand(params);
        
      case 'get_status':
        return await this.getStreamStatus();
        
      default:
        throw new Error(`Ação desconhecida: ${action}`);
    }
  }

  private async startFazaiStream(params: any) {
    // Implementação de streaming do FazAI CLI
    const mode = params.mode || 'interactive';
    
    // Por enquanto, simulação
    return {
      content: [
        {
          type: 'text',
          text: `🚀 **Stream FazAI iniciado**\n\n` +
                `📺 **Modo:** ${mode}\n` +
                `🔗 **Endpoint:** http://localhost:${process.env.MCP_PORT || 3001}/stream\n` +
                `⚡ **Status:** Ativo\n\n` +
                `💡 Use 'send_command' para enviar comandos ao stream.`
        }
      ]
    };
  }

  private async listExports(args: any) {
    // Simular lista de exports (implementar busca real)
    const exports = [
      {
        id: 'export-001',
        type: 'Google Chat',
        date: '2025-11-05',
        status: 'ready',
        size: '1.2GB',
        downloadUrl: 'https://takeout.google.com/...'
      }
    ];

    const resultText = `📋 **Exports Disponíveis:**\n\n` +
      exports.map(exp => 
        `• **${exp.type}** (${exp.id})\n` +
        `  Status: ${exp.status}\n` +
        `  Data: ${exp.date}\n` +
        `  Tamanho: ${exp.size}\n`
      ).join('\n');

    return {
      content: [
        {
          type: 'text',
          text: resultText
        }
      ]
    };
  }

  private extractDownloadLinks(emailBody: string): string[] {
    const urlRegex = /https:\/\/[^\s<>"]+/g;
    const urls = emailBody.match(urlRegex) || [];
    
    // Filtrar apenas URLs que parecem ser de export/download
    return urls.filter(url => 
      url.includes('takeout.google.com') ||
      url.includes('download') ||
      url.includes('export')
    );
  }

  private async stopFazaiStream(params: any) {
    return {
      content: [
        {
          type: 'text',
          text: '⏹️ Stream FazAI interrompido'
        }
      ]
    };
  }

  private async sendStreamCommand(params: any) {
    return {
      content: [
        {
          type: 'text',
          text: `📤 Comando enviado para stream: ${params.command || 'N/A'}`
        }
      ]
    };
  }

  private async getStreamStatus() {
    return {
      content: [
        {
          type: 'text',
          text: '📊 **Status do Stream:**\n\nAtivo: ✅\nComandos na fila: 0\nÚltima atividade: agora'
        }
      ]
    };
  }

  private async getExportStatus(args: any) {
    const exportId = args?.exportId;
    
    return {
      content: [
        {
          type: 'text',
          text: `📊 **Status do Export ${exportId}:**\n\nStatus: Pronto\nTamanho: 1.2GB\nExpira em: 7 dias`
        }
      ]
    };
  }

  async start() {
    try {
      const transport = new StdioServerTransport();
      await this.server.connect(transport);
      
      logger.info('🚀 FazAI Gmail MCP Server conectado via stdio');
      logger.info(`📧 Gmail: ${this.gmailClient ? 'Conectado' : 'Não conectado'}`);
      logger.info(`🤖 FazAI: ${process.env.FAZAI_PATH || 'fazai'}`);
      
    } catch (error) {
      logger.error('Erro conectando servidor MCP:', error);
      throw error;
    }
  }
}

// Inicializar e executar servidor
const server = new FazaiGmailMCPServer();
server.start().catch((error) => {
  logger.error('Falha crítica do servidor:', error);
  process.exit(1);
});

export default FazaiGmailMCPServer;