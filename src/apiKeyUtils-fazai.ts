import chalk from "chalk";
import { password } from "@inquirer/prompts";
import { configFileExists, getConfigFilePath, getConfigValue, listConfigEntries, setConfigValue } from "./config";

export function checkAPIKey(provider: string): boolean {
  // Ollama não precisa de API key
  if (provider === "ollama") {
    const baseUrl = getOllamaBaseUrl();
    if (baseUrl) {
      process.env.OLLAMA_BASE_URL = baseUrl;
    }
    return true; // Ollama sempre retorna true
  }

  const apiKey = getAPIKeyFromConfig(provider);
  if (apiKey) {
    // Definir a variável de ambiente para o SDK
    const envVar = getEnvVarName(provider);
    process.env[envVar] = apiKey;
  }
  return !!apiKey;
}

export async function getAndSetAPIKey(provider: string): Promise<string> {
  // Ollama não precisa de API key
  if (provider === "ollama") {
    const baseUrl = getOllamaBaseUrl();
    if (baseUrl) {
      process.env.OLLAMA_BASE_URL = baseUrl;
      console.log(chalk.green(`✅ Ollama configurado: ${baseUrl}`));
    } else {
      console.log(chalk.yellow(`⚠️  OLLAMA_BASE_URL não configurado no ${configFileLabel()}, usando http://localhost:11434`));
      process.env.OLLAMA_BASE_URL = "http://localhost:11434";
    }
    return "ollama"; // Retorna string dummy
  }

  let apiKey = getAPIKeyFromConfig(provider);

  if (!apiKey) {
    console.log(chalk.yellow(`\nAPI key para ${provider} não encontrada no ${configFileLabel()}.`));
    const key = await password({
      message: `Digite sua chave API do ${provider.charAt(0).toUpperCase() + provider.slice(1)}:`,
      mask: "*",
    });

    // Salvar no arquivo de configuração
    saveAPIKeyToConfig(provider, key);
    apiKey = key;
  }

  // Definir a variável de ambiente para o SDK
  const envVar = getEnvVarName(provider);
  process.env[envVar] = apiKey;

  return apiKey;
}

function getAPIKeyFromConfig(provider: string): string | undefined {
  const envVar = getEnvVarName(provider);
  return getConfigValue(envVar);
}

function saveAPIKeyToConfig(provider: string, apiKey: string): void {
  const envVar = getEnvVarName(provider);
  try {
    setConfigValue(envVar, apiKey);
    console.log(chalk.green(`✅ Chave API salva em ${configFileLabel()}`));
  } catch (error) {
    console.error(`❌ Erro ao salvar chave API em ${configFileLabel()}:`, error);
  }
}

function getEnvVarName(provider: string): string {
  switch (provider) {
    case "anthropic":
      return "ANTHROPIC_API_KEY";
    case "openai":
      return "OPENAI_API_KEY";
    case "fireworks":
      return "FIREWORKS_API_KEY";
    case "ollama":
      return "OLLAMA_BASE_URL";
    default:
      throw new Error(`Provider não suportado: ${provider}`);
  }
}

function getOllamaBaseUrl(): string | undefined {
  return getConfigValue("OLLAMA_BASE_URL");
}

// Função para listar todas as chaves configuradas
export function listConfiguredKeys(): void {
  try {
    if (!configFileExists()) {
      console.log(chalk.yellow(`Arquivo ${configFileLabel()} não encontrado.`));
      return;
    }

    const entries = listConfigEntries();
    console.log(chalk.cyan(`\n🔑 Configurações em ${configFileLabel()}:`));

    const providers = ["anthropic", "openai", "ollama"];
    let found = false;

    for (const provider of providers) {
      const envVar = getEnvVarName(provider);
      const value = entries[envVar];

      if (value) {
        if (provider === "ollama") {
          console.log(`  ${provider}: ${value || "não definida"}`);
        } else {
          const masked = "*".repeat(Math.min(value.length, 20));
          console.log(`  ${provider}: ${masked}`);
        }
        found = true;
      }
    }

    if (!found) {
      console.log(chalk.gray("  Nenhuma configuração encontrada."));
    }

  } catch (error) {
    console.error(`Erro ao listar chaves:`, error);
  }
}

function configFileLabel(): string {
  return getConfigFilePath();
}
