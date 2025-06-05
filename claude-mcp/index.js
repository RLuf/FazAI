#!/usr/bin/env node
// claude-mcp/index.js
const { Server } = require("@modelcontextprotocol/sdk/server");
const { StdioServerTransport } = require("@modelcontextprotocol/sdk/server/stdio");
const Anthropic = require("@anthropic-ai/sdk");
const { CallToolRequestSchema } = require("@modelcontextprotocol/sdk/types");

// Configuração do cliente Claude
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});

// Ferramentas disponíveis
const TOOLS = [
  {
    name: "call_claude",
    description: "Envia um prompt para o modelo Claude e retorna a resposta",
    inputSchema: {
      type: "object",
      properties: {
        prompt: { type: "string", description: "Prompt para enviar ao Claude" },
        model: { 
          type: "string", 
          description: "Modelo a ser usado",
          enum: ["claude-3-opus-20240229", "claude-3-sonnet-20240229", "claude-3-haiku-20240307"],
          default: "claude-3-haiku-20240307"
        },
        max_tokens: { 
          type: "number", 
          description: "Número máximo de tokens na resposta", 
          default: 1024 
        }
      },
      required: ["prompt"]
    }
  },
  {
    name: "list_models",
    description: "Lista os modelos Claude disponíveis",
    inputSchema: {
      type: "object",
      properties: {} // Sem parâmetros necessários
    }
  }
];

// Inicializa o servidor MCP
const server = new Server({
  name: "claude-mcp",
  version: "1.0.0",
}, {
  capabilities: {
    tools: {},
  },
});

// Configura o transporte
const transport = new StdioServerTransport();
server.connect(transport).catch((error) => {
  console.error("Failed to start server:", error);
  process.exit(1);
});

// Manipulador de ferramentas
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  switch (request.params.name) {
    case "call_claude":
      const { prompt, model = "claude-3-haiku-20240307", max_tokens = 1024 } = request.params.arguments;
      
      try {
        const response = await anthropic.messages.create({
          model,
          max_tokens,
          messages: [{ role: "user", content: prompt }]
        });
        
        return {
          content: [{
            type: "text",
            text: response.content[0]?.text || "Sem resposta"
          }]
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: `Erro ao chamar Claude: ${error.message}`
          }],
          isError: true
        };
      }
      
    case "list_models":
      try {
        return {
          content: [{
            type: "text",
            text: JSON.stringify([
              "claude-3-opus-20240229",
              "claude-3-sonnet-20240229",
              "claude-3-haiku-20240307"
            ])
          }]
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: `Erro ao listar modelos: ${error.message}`
          }],
          isError: true
        };
      }
      
    default:
      return {
        content: [{
          type: "text",
          text: `Ferramenta desconhecida: ${request.params.name}`
        }],
        isError: true
      };
  }
});

// Manipulador para listar ferramentas
server.setRequestHandler("ListToolsRequest", async () => ({
  tools: TOOLS
}));

console.log("Servidor Claude MCP iniciado. Aguardando requisições...");
