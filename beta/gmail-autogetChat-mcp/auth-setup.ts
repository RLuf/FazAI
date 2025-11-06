import { OAuth2Client } from 'google-auth-library';
import { google } from 'googleapis';
import fs from 'fs/promises';
import path from 'path';
import http from 'http';
import { URL } from 'url';
import open from 'open';
import chalk from 'chalk';

interface AuthSetupOptions {
  clientId?: string;
  clientSecret?: string;
  redirectUri?: string;
  tokenPath?: string;
}

class GmailAuthSetup {
  private oAuth2Client: OAuth2Client;
  private tokenPath: string;
  
  constructor(options: AuthSetupOptions = {}) {
    const clientId = options.clientId || process.env.GMAIL_CLIENT_ID;
    const clientSecret = options.clientSecret || process.env.GMAIL_CLIENT_SECRET;
    const redirectUri = options.redirectUri || 'http://localhost:3000/oauth/callback';
    
    if (!clientId || !clientSecret) {
      throw new Error('GMAIL_CLIENT_ID e GMAIL_CLIENT_SECRET são obrigatórios');
    }
    
    this.oAuth2Client = new OAuth2Client(clientId, clientSecret, redirectUri);
    this.tokenPath = options.tokenPath || './gmail-token.json';
  }

  async setupAuth(): Promise<void> {
    console.log(chalk.blue('\n🔐 Configurando autenticação Gmail API...\n'));
    
    try {
      // Verificar se token já existe
      if (await this.tokenExists()) {
        console.log(chalk.yellow('⚠️  Token existente encontrado'));
        
        const shouldReplace = await this.askUserConfirmation(
          'Deseja substituir o token existente? (s/n): '
        );
        
        if (!shouldReplace) {
          console.log(chalk.green('✅ Mantendo token existente'));
          return;
        }
      }
      
      // Gerar URL de autorização
      const authUrl = this.generateAuthUrl();
      
      console.log(chalk.cyan('🌐 Abrindo navegador para autenticação...'));
      console.log(chalk.gray(`URL: ${authUrl}\n`));
      
      // Abrir navegador
      await open(authUrl);
      
      // Iniciar servidor temporário para capturar callback
      const authCode = await this.captureAuthCode();
      
      // Trocar código por token
      const { tokens } = await this.oAuth2Client.getToken(authCode);
      this.oAuth2Client.setCredentials(tokens);
      
      // Salvar token
      await this.saveToken(tokens);
      
      // Testar token
      await this.testToken();
      
      console.log(chalk.green('\n✅ Autenticação Gmail configurada com sucesso!'));
      console.log(chalk.gray(`Token salvo em: ${this.tokenPath}`));
      
    } catch (error) {
      console.error(chalk.red('\n❌ Erro na configuração:'), error.message);
      throw error;
    }
  }
  
  private generateAuthUrl(): string {
    const scopes = [
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/gmail.metadata'
    ];
    
    return this.oAuth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      prompt: 'consent'
    });
  }
  
  private async captureAuthCode(): Promise<string> {
    return new Promise((resolve, reject) => {
      const server = http.createServer((req, res) => {
        const url = new URL(req.url!, 'http://localhost:3000');
        
        if (url.pathname === '/oauth/callback') {
          const code = url.searchParams.get('code');
          const error = url.searchParams.get('error');
          
          if (error) {
            res.writeHead(400, { 'Content-Type': 'text/html' });
            res.end(`
              <h1>❌ Erro na Autenticação</h1>
              <p>Erro: ${error}</p>
              <p>Feche esta janela e tente novamente.</p>
            `);
            server.close();
            reject(new Error(`Erro OAuth: ${error}`));
            return;
          }
          
          if (!code) {
            res.writeHead(400, { 'Content-Type': 'text/html' });
            res.end(`
              <h1>❌ Código de Autorização Não Encontrado</h1>
              <p>Feche esta janela e tente novamente.</p>
            `);
            server.close();
            reject(new Error('Código de autorização não encontrado'));
            return;
          }
          
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end(`
            <h1>✅ Autenticação Bem-sucedida!</h1>
            <p>Você pode fechar esta janela.</p>
            <p>Volte ao terminal para continuar.</p>
          `);
          
          server.close();
          resolve(code);
        } else {
          res.writeHead(404);
          res.end('Not found');
        }
      });
      
      server.listen(3000, () => {
        console.log(chalk.yellow('⏳ Aguardando autenticação no navegador...'));
      });
      
      server.on('error', (error) => {
        reject(new Error(`Erro do servidor: ${error.message}`));
      });
      
      // Timeout após 5 minutos
      setTimeout(() => {
        server.close();
        reject(new Error('Timeout - autenticação não concluída em 5 minutos'));
      }, 5 * 60 * 1000);
    });
  }
  
  private async tokenExists(): Promise<boolean> {
    try {
      await fs.access(this.tokenPath);
      return true;
    } catch {
      return false;
    }
  }
  
  private async saveToken(tokens: any): Promise<void> {
    const tokenData = {
      ...tokens,
      created_at: new Date().toISOString()
    };
    
    await fs.writeFile(
      this.tokenPath, 
      JSON.stringify(tokenData, null, 2),
      { mode: 0o600 } // Apenas dono pode ler/escrever
    );
  }
  
  private async testToken(): Promise<void> {
    console.log(chalk.cyan('🧪 Testando token...'));
    
    const gmail = google.gmail({ version: 'v1', auth: this.oAuth2Client });
    
    try {
      const response = await gmail.users.getProfile({ userId: 'me' });
      const profile = response.data;
      
      console.log(chalk.green('✅ Token válido!'));
      console.log(chalk.gray(`   Email: ${profile.emailAddress}`));
      console.log(chalk.gray(`   Total de mensagens: ${profile.messagesTotal}`));
      
    } catch (error) {
      throw new Error(`Token inválido: ${error.message}`);
    }
  }
  
  private async askUserConfirmation(question: string): Promise<boolean> {
    return new Promise((resolve) => {
      process.stdout.write(chalk.yellow(question));
      process.stdin.once('data', (data) => {
        const answer = data.toString().trim().toLowerCase();
        resolve(answer === 's' || answer === 'sim' || answer === 'y' || answer === 'yes');
      });
    });
  }
}

// Script de linha de comando
async function main() {
  try {
    console.log(chalk.blue.bold('\n📧 FAZAI GMAIL MCP - CONFIGURAÇÃO DE AUTENTICAÇÃO\n'));
    
    // Verificar variáveis de ambiente
    if (!process.env.GMAIL_CLIENT_ID || !process.env.GMAIL_CLIENT_SECRET) {
      console.log(chalk.red('❌ Variáveis de ambiente não configuradas!'));
      console.log(chalk.yellow('\nConfigure no arquivo .env:'));
      console.log('GMAIL_CLIENT_ID=seu-client-id');
      console.log('GMAIL_CLIENT_SECRET=seu-client-secret\n');
      process.exit(1);
    }
    
    const authSetup = new GmailAuthSetup();
    await authSetup.setupAuth();
    
    console.log(chalk.green('\n🎉 Configuração concluída com sucesso!'));
    console.log(chalk.cyan('\n🚀 Próximos passos:'));
    console.log('1. Reinicie Claude Desktop');
    console.log('2. Teste: "Verifique meus emails por exports"');
    console.log('3. Use: "Baixe o export mais recente"\n');
    
  } catch (error) {
    console.error(chalk.red('\n💥 Falha na configuração:'), error.message);
    process.exit(1);
  }
}

// Executar se chamado diretamente
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { GmailAuthSetup };