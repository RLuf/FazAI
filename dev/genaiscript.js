
const fs = require('fs');
const path = require('path');
const { spawn, exec } = require('child_process');

class GenaiscriptProcessor {
  constructor() {
    this.llamaCppPath = '/usr/local/bin/llama.cpp';
    this.modelPath = '/opt/fazai/models/model.gguf';
    this.fallbackApiKey = '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';
  }

  async processCommand(command) {
    try {
      console.log(`Processando com genaiscript: ${command}`);
      
      // Tentar usar llama.cpp local primeiro
      let result = await this.tryLocalLlama(command);
      
      // Se falhar, usar API externa
      if (!result) {
        result = await this.tryExternalAPI(command);
      }
      
      return result;
    } catch (error) {
      console.error(`Erro no genaiscript: ${error.message}`);
      return null;
    }
  }

  async tryLocalLlama(command) {
    try {
      if (!fs.existsSync(this.llamaCppPath) || !fs.existsSync(this.modelPath)) {
        console.log('Llama.cpp ou modelo não encontrado');
        return null;
      }

      const prompt = this.buildArchitecturePrompt(command);
      
      return new Promise((resolve, reject) => {
        const child = spawn(this.llamaCppPath, [
          '-m', this.modelPath,
          '-p', prompt,
          '--temp', '0.7',
          '--repeat_penalty', '1.1',
          '-n', '512'
        ], {
          stdio: 'pipe'
        });

        let output = '';
        child.stdout.on('data', (data) => {
          output += data.toString();
        });

        child.on('close', (code) => {
          if (code === 0) {
            resolve(this.parseArchitectureResponse(output));
          } else {
            resolve(null);
          }
        });

        setTimeout(() => {
          child.kill();
          resolve(null);
        }, 30000);
      });
    } catch (error) {
      console.error(`Erro no llama.cpp local: ${error.message}`);
      return null;
    }
  }

  async tryExternalAPI(command) {
    try {
      const prompt = this.buildArchitecturePrompt(command);
      
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.fallbackApiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'deepseek/deepseek-r1-0528:free',
          messages: [
            {
              role: 'system',
              content: 'Você é um assistente de arquitetura de sistemas. Responda sempre em JSON válido.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          max_tokens: 512,
          temperature: 0.7
        })
      });

      const data = await response.json();
      const content = data.choices[0].message.content;
      
      return this.parseArchitectureResponse(content);
    } catch (error) {
      console.error(`Erro na API externa: ${error.message}`);
      return null;
    }
  }

  buildArchitecturePrompt(command) {
    return `
Analise o comando e crie uma arquitetura de execução em JSON:

Comando: "${command}"

Responda APENAS com JSON válido no formato:
{
  "steps": [
    {
      "description": "Descrição do passo",
      "command": "comando a executar",
      "critical": true/false,
      "requires_input": true/false,
      "input_prompt": "pergunta se precisar de input"
    }
  ],
  "requires_confirmation": true/false,
  "estimated_time": "tempo estimado",
  "risk_level": "baixo/medio/alto"
}

Exemplo para "instale um smtp simples":
{
  "steps": [
    {
      "description": "Atualizar repositórios",
      "command": "apt update",
      "critical": true,
      "requires_input": false
    },
    {
      "description": "Instalar Postfix",
      "command": "apt install -y postfix",
      "critical": true,
      "requires_input": false
    },
    {
      "description": "Configurar Postfix",
      "command": "dpkg-reconfigure postfix",
      "critical": true,
      "requires_input": true,
      "input_prompt": "Configure como 'Internet Site' quando solicitado"
    }
  ],
  "requires_confirmation": true,
  "estimated_time": "5-10 minutos",
  "risk_level": "baixo"
}
`;
  }

  parseArchitectureResponse(response) {
    try {
      // Extrair JSON da resposta
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('JSON não encontrado na resposta');
      }

      const json = JSON.parse(jsonMatch[0]);
      
      // Validar estrutura
      if (!json.steps || !Array.isArray(json.steps)) {
        throw new Error('Estrutura de steps inválida');
      }

      return json;
    } catch (error) {
      console.error(`Erro ao parsear resposta: ${error.message}`);
      return null;
    }
  }
}

// Se chamado diretamente
if (require.main === module) {
  const processor = new GenaiscriptProcessor();
  const command = process.argv[2];
  
  if (!command) {
    console.error('Comando não fornecido');
    process.exit(1);
  }

  processor.processCommand(command)
    .then(result => {
      if (result) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        console.error('Falha ao processar comando');
        process.exit(1);
      }
    })
    .catch(error => {
      console.error(`Erro: ${error.message}`);
      process.exit(1);
    });
}

module.exports = GenaiscriptProcessor;
