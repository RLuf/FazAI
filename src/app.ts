#!/usr/bin/env node
import { input } from "@inquirer/prompts";
import chalk from "chalk";
import { models } from "./models";
import { checkAPIKey, getAndSetAPIKey, listConfiguredKeys } from "./apiKeyUtils-fazai";
import { getLinuxCommandsFromAI } from "./linux-admin";
import { collectSystemInfo } from "./system-info";
import { LinuxCommandExecutor } from "./linux-executor";
import { askAI } from "./askAI";
import { LinuxCommand } from "./types-linux";
import { ResearchCoordinator } from "./research";
import { runCliMode } from "./cli-mode";

function displayHelp() {
  const helpText = `
🖥️  FAZAI - Administrador Linux Inteligente com IA

Usage:
  fazai [options] [model-nickname]           # Linux Admin Mode (default)
  fazai ask "Your question here"             # General AI questions
  fazai config                               # List configured API keys
  fazai completion                           # Print available CLI completions
  fazai search "query"                       # Manual research via Context7/Web

Options:
  --dry-run                Simulate commands without executing
  --cli                    Open interactive CLI (chat + /exec)
  --auto-research          Reativar pesquisa automática após falhas
  --help, -h               Show this help message

Examples:
  # Admin mode (default)
  fazai
  fazai --dry-run           # Safe simulation mode
  fazai haiku               # Use Claude Haiku (faster/cheaper)

  # General questions
  fazai ask "Como configurar nginx como proxy reverso?"
  fazai ask "Explicar diferença entre systemctl e service"

  # Configuration
  fazai config              # Show configured API keys

Available Models:
  OpenAI (requer API key):
    gpt4mini    - GPT-4o-mini (DEFAULT - rápido e barato)
    gpt4o       - GPT-4o (mais recente e inteligente)
    gpt4turbo   - GPT-4 Turbo

  Claude (Anthropic - requer API key):
    sonnet35    - Claude 3.5 Sonnet (mais inteligente)
    haiku       - Claude 3 Haiku (rápido e barato)

  Ollama (local - configure OLLAMA_BASE_URL no fazai.conf):
    llama32     - Llama 3.2
    qwen        - Qwen 2.5:7b
    mistral     - Mistral
`;
  console.log(helpText);
}

async function checkAndSetAPIKey(selectedModel: (typeof models)[number]) {
  const provider = selectedModel.provider;
  const apiKeyPresent = checkAPIKey(provider);

  if (!apiKeyPresent) {
    await getAndSetAPIKey(provider);
  }

  console.log(chalk.green(`✅ API key configurada (${provider})`));
}

async function main() {
  let inputs = process.argv.slice(2);

  if (inputs.includes("--cli")) {
    await runCliMode();
    return;
  }

  // Show help if no arguments or help flag is present
  if (
    inputs.length === 0 ||
    inputs.includes("--help") ||
    inputs.includes("-h")
  ) {
    displayHelp();
    return;
  }

  // Config command
  if (inputs[0] === "config") {
    listConfiguredKeys();
    return;
  }

  if (inputs[0] === "completion") {
    const suggestions = [
      "ask",
      "config",
      "completion",
      "search",
      "--help",
      "--dry-run",
      "--cli",
      "--auto-research",
      "--yolo",
      ...models.map((model) => model.nickName),
    ];
    console.log(suggestions.join("\n"));
    return;
  }

  let dryRun = false;
  let yoloMode = false;
  let autoResearchOnFailure = false;

  // Parse special arguments
  inputs = inputs.filter((input) => {
    if (input === "--dry-run") {
      dryRun = true;
      return false;
    }
    if (input === "--yolo" || input === "-y") {
      yoloMode = true;
      return false;
    }
    if (input === "--auto-research") {
      autoResearchOnFailure = true;
      return false;
    }
    if (input === "--help" || input === "-h") {
      displayHelp();
      process.exit(0);
    }
    return true;
  });

  // Manual research command
  if (inputs[0] === "search") {
    const query = inputs.slice(1).join(" ");
    if (!query) {
      console.error('Usage: fazai search "Your query here"');
      process.exit(1);
    }

    const researchCoordinator = new ResearchCoordinator();
    await researchCoordinator.research(query, { reason: "Pesquisa manual", trigger: "pre-execution" });
    return;
  }

  // Ask mode (general questions)
  if (inputs[0] === "ask") {
    const question = inputs.slice(1).join(" ");

    if (!question) {
      console.error('Usage: fazai ask "Your question here"');
      process.exit(1);
    }

    const selectedModel = models[0]; // Default model for ask
    await checkAndSetAPIKey(selectedModel);

    console.log(chalk.blue("🤔 Fazendo pergunta..."));

    const answerStream = askAI(
      "",
      question,
      selectedModel.name,
      selectedModel.provider,
      true
    );

    for await (const chunk of answerStream) {
      process.stdout.write(chunk);
    }
    console.log("\n");
    return;
  }

  // Admin Mode (DEFAULT!)
  console.log(chalk.cyan("\n🖥️  FAZAI - MODO ADMINISTRADOR LINUX"));
  console.log(chalk.gray("Administração inteligente de sistemas Linux\n"));

  // Check if direct command mode (first arg is not a model nickname and not a flag)
  let directCommand: string | null = null;
  const modelNickname = inputs[inputs.length - 1]; // Model is always last if provided
  let selectedModel = models.find((model) => model.nickName === modelNickname);

  if (!selectedModel && inputs.length > 0) {
    // No model specified, all inputs are the command
    directCommand = inputs.join(" ");
    selectedModel = models[0]; // Use default
  } else if (selectedModel && inputs.length > 1) {
    // Model specified, everything before it is the command
    directCommand = inputs.slice(0, -1).join(" ");
  }

  console.log(`Modelo: ${selectedModel ? selectedModel.nickName : models[0].nickName} (${selectedModel ? selectedModel.name : models[0].name})\n`);
  if (!selectedModel) selectedModel = models[0];

  await checkAndSetAPIKey(selectedModel);
  const researchCoordinator = new ResearchCoordinator({ researchOnFailure: autoResearchOnFailure });

  // Collect system info
  console.log(chalk.gray("Coletando informações do sistema..."));
  const systemInfo = await collectSystemInfo();
  console.log(chalk.green("✅ Sistema analisado\n"));

  if (dryRun) {
    console.log(chalk.yellow("🔍 MODO DRY-RUN - Simulação apenas\n"));
  }

  if (yoloMode) {
    console.log(chalk.red("⚡ MODO YOLO - Execução automática sem confirmações!\n"));
  }

  // Get task (either from direct command or prompt)
  const task = directCommand || await input({
    message: "O que você precisa fazer? ",
    validate: (input: string) => input.trim() !== "" || "Tarefa não pode estar vazia",
  });

  // Generate Linux commands
  const commandStream = getLinuxCommandsFromAI(
    systemInfo,
    task,
    selectedModel.name,
    selectedModel.provider
  );

  // Execute commands
  const executor = new LinuxCommandExecutor(dryRun, researchCoordinator);
  let commandCount = 0;
  const attemptedCommands = new Set<string>();
  const maxRetryCycles = 2;

  const requestAlternativeCommands = async (
    failureContext: {
      command: LinuxCommand;
      output: string;
      attempts: number;
    }
  ): Promise<LinuxCommand[]> => {
    const attemptedList = Array.from(attemptedCommands);
    const attemptedSection =
      attemptedList.length > 0
        ? `\n\nComandos já tentados (não repita estes exatamente):\n- ${attemptedList.join("\n- ")}`
        : "";

    const retryTask = `${task}

O comando abaixo falhou:
Comando: ${failureContext.command.command}
Erro/saída:
${failureContext.output}

Gere uma nova sequência de comandos para atingir o mesmo objetivo, evitando repetir os comandos já usados e propondo uma abordagem alternativa.${attemptedSection}
`;

    const altStream = getLinuxCommandsFromAI(
      systemInfo,
      retryTask,
      selectedModel.name,
      selectedModel.provider
    );

    const alternatives: LinuxCommand[] = [];

    for await (const packet of altStream) {
      if (packet.type === "command") {
        alternatives.push(packet.command);
      } else if (packet.type === "allcommands") {
        break;
      } else if (packet.type === "error") {
        console.error(`❌ Erro ao gerar alternativa: ${packet.error}`);
      }
    }

    return alternatives;
  };

  const tryAlternativeApproach = async (
    failedCommand: LinuxCommand,
    failureOutput: string
  ): Promise<boolean> => {
    let lastOutput = failureOutput;
    let lastCommand = failedCommand;

    for (let cycle = 1; cycle <= maxRetryCycles; cycle++) {
      console.log(chalk.yellow(`\n⚙️  Tentando abordagem alternativa (${cycle}/${maxRetryCycles})...`));
      const alternatives = await requestAlternativeCommands({
        command: lastCommand,
        output: lastOutput,
        attempts: cycle,
      });

      if (alternatives.length === 0) {
        console.log(chalk.red("Nenhuma alternativa fornecida pela IA."));
        return false;
      }

      for (const alternative of alternatives) {
        if (attemptedCommands.has(alternative.command)) {
          continue;
        }

        attemptedCommands.add(alternative.command);
        commandCount++;
        console.log(chalk.blue(`\n🔧 Comando ${commandCount} (alternativa):`));
        const altResult = await executor.executeCommand(alternative);

        if (altResult.success) {
          console.log(chalk.green("✅ Abordagem alternativa executada com sucesso"));
          return true;
        }

        console.log(chalk.red("❌ Alternativa falhou. Avaliando próxima opção..."));
        lastOutput = altResult.output;
        lastCommand = alternative;
      }
    }

    console.log(chalk.red("⚠️  Nenhuma alternativa teve sucesso após múltiplas tentativas."));
    return false;
  };

  for await (const commandPacket of commandStream) {
    if (commandPacket.type === "command") {
      commandCount++;
      console.log(chalk.blue(`\n🔧 Comando ${commandCount}:`));
      attemptedCommands.add(commandPacket.command.command);
      const result = await executor.executeCommand(commandPacket.command);

      if (!result.success && !dryRun) {
        await tryAlternativeApproach(commandPacket.command, result.output);
      }
    } else if (commandPacket.type === "allcommands") {
      console.log(chalk.green(`\n✅ ${commandCount} comandos processados`));

      if (!dryRun) {
        const history = executor.getExecutionHistory();
        if (history.length > 0) {
          console.log(chalk.gray("\n📋 Histórico:"));
          history.forEach((entry, index) => {
            const status = entry.success ? chalk.green("✅") : chalk.red("❌");
            console.log(`  ${index + 1}. ${status} ${entry.command.command}`);
          });
        }
      }
      break;
    } else if (commandPacket.type === "error") {
      console.error(`❌ Erro: ${commandPacket.error}`);
      break;
    }
  }

  console.log(chalk.cyan("\n⭐ FAZAI - Administração Linux com IA"));
}

main().catch(console.error);
