import chalk from "chalk";
import readline from "readline";
import { askAI } from "./askAI";
import { models } from "./models";
import { getLinuxCommandsFromAI } from "./linux-admin";
import { collectSystemInfo } from "./system-info";
import { LinuxCommand } from "./types-linux";
import { LinuxCommandExecutor } from "./linux-executor";
import { ResearchCoordinator } from "./research";
import { checkAPIKey, getAndSetAPIKey } from "./apiKeyUtils-fazai";
import { logger } from "./logger";
import {
  appendCommandHistory,
  appendConversationEntry,
  clearPersistentHistory,
  clearPersistentMemory,
  loadCommandHistory,
  loadConversationHistory,
} from "./memory";

type ConversationTurn = {
  role: "user" | "assistant";
  content: string;
};

const SLASH_COMMANDS = ["/help", "/exec", "/history", "/history clear", "/memory clear", "/quit", "/exit"];

function buildChatPrompt(history: ConversationTurn[]): string {
  const trimmedHistory = history.slice(-10); // limita contexto imediato
  const conversation = trimmedHistory
    .map((turn) =>
      turn.role === "user"
        ? `Usuário: ${turn.content}`
        : `Assistente: ${turn.content}`
    )
    .join("\n");

  return `${conversation}\nAssistente:`;
}

function parseExecPayload(raw: string): string | null {
  const withoutCommand = raw.replace(/^\/exec\s*/i, "");
  if (!withoutCommand.trim()) {
    return null;
  }

  if (withoutCommand.startsWith("'''") && withoutCommand.endsWith("'''")) {
    return withoutCommand.slice(3, -3).trim();
  }

  return withoutCommand.trim();
}

function createCompleter() {
  return (line: string) => {
    if (line.startsWith("/")) {
      const hits = SLASH_COMMANDS.filter((cmd) => cmd.startsWith(line));
      return [hits.length ? hits : SLASH_COMMANDS, line];
    }
    return [[], line];
  };
}

export async function runCliMode(): Promise<void> {
  const defaultModel = models[0];
  logger.info(chalk.cyan.bold("\n🤖 FazAI CLI interativo"));
  logger.info(chalk.gray("Digite mensagens livres para conversar ou use comandos especiais começando com '/'"));
  logger.info(chalk.gray("Comandos disponíveis: /help, /exec, /history, /quit, /exit\n"));

  if (!checkAPIKey(defaultModel.provider)) {
    await getAndSetAPIKey(defaultModel.provider);
  }
  logger.info(chalk.green(`✅ API key configurada (${defaultModel.provider})`));

  const storedConversation = loadConversationHistory();
  const conversationHistory: ConversationTurn[] = storedConversation.map((entry) => ({
    role: entry.role,
    content: entry.content,
  }));
  const historyBuffer: string[] = loadCommandHistory();

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: chalk.cyan("fazai> "),
    completer: createCompleter(),
    historySize: 100,
  });
  if (historyBuffer.length) {
    rl.history = [...historyBuffer].reverse();
  }

  const systemInfo = await collectSystemInfo();
  const researchCoordinator = new ResearchCoordinator();
  const executor = new LinuxCommandExecutor(false, researchCoordinator);

  rl.prompt();

  const handleChat = async (message: string) => {
    conversationHistory.push({ role: "user", content: message });
    appendConversationEntry({
      role: "user",
      content: message,
      timestamp: new Date().toISOString(),
    });
    const prompt = buildChatPrompt(conversationHistory);
    logger.info(chalk.blueBright("\n🤖 FazAI:"));

    let response = "";
    try {
      const stream = askAI(
        "",
        prompt,
        defaultModel.name,
        defaultModel.provider,
        true
      );

      for await (const chunk of stream) {
        process.stdout.write(chunk);
        response += chunk;
      }
      logger.info("");
    } catch (error) {
      logger.error(chalk.red("\n❌ Erro ao conversar com o modelo:"), error);
    } finally {
      conversationHistory.push({
        role: "assistant",
        content: response.trim() || "(sem resposta)",
      });
      appendConversationEntry({
        role: "assistant",
        content: response.trim() || "(sem resposta)",
        timestamp: new Date().toISOString(),
      });
    }
  };

  const handleExec = async (task: string) => {
    if (!task) {
      logger.warn(chalk.yellow("Forneça uma instrução após /exec. Ex: /exec limpar /tmp"));
      return;
    }

    logger.info(chalk.magentaBright("\n⚙️  Gerando comandos para: "), chalk.magenta(task));

    const commandStream = getLinuxCommandsFromAI(
      systemInfo,
      task,
      defaultModel.name,
      defaultModel.provider
    );

    const collectedCommands: LinuxCommand[] = [];

    for await (const packet of commandStream) {
      if (packet.type === "command") {
        collectedCommands.push(packet.command);
      }
    }

    if (!collectedCommands.length) {
      logger.warn(chalk.yellow("Nenhum comando gerado para a tarefa informada."));
      return;
    }

    for (const command of collectedCommands) {
      await executor.executeCommand(command);
    }
  };

  rl.on("line", async (input) => {
    const line = input.trim();
    if (line.length > 0) {
      historyBuffer.push(line);
      appendCommandHistory(line);
    }

    if (!line) {
      rl.prompt();
      return;
    }

    if (line.startsWith("/")) {
      if (line === "/help") {
        logger.info(chalk.cyan("\nComandos disponíveis:"));
        logger.info("/help           Mostra esta ajuda");
        logger.info("/exec ...       Converte instrução natural em comandos Linux e executa");
        logger.info("/history        Lista entradas anteriores (persistente)");
        logger.info("/history clear  Limpa histórico persistente");
        logger.info("/memory clear   Limpa memória contextual persistente");
        logger.info("/quit           Encerra o modo CLI");
        logger.info("/exit           Mesmo que /quit\n");
      } else if (line === "/quit" || line === "/exit") {
        rl.close();
        return;
      } else if (line === "/history") {
        if (!historyBuffer.length) {
          logger.info(chalk.gray("Sem histórico registrado nesta sessão."));
        } else {
          logger.info(chalk.cyan("\nHistórico recente:"));
          historyBuffer.slice(-20).forEach((entry, index) => {
            logger.info(`${index + 1}. ${entry}`);
          });
        }
      } else if (line === "/history clear") {
        clearPersistentHistory();
        historyBuffer.length = 0;
        rl.history = [];
        logger.info(chalk.green("✅ Histórico de comandos limpo."));
      } else if (line === "/memory clear") {
        clearPersistentMemory();
        conversationHistory.length = 0;
        logger.info(chalk.green("✅ Memória contextual limpa."));
      } else if (line.startsWith("/exec")) {
        const task = parseExecPayload(line);
        await handleExec(task ?? "");
      } else {
        logger.warn(chalk.yellow("Comando não reconhecido. Use /help para ver as opções."));
      }
      rl.prompt();
      return;
    }

    await handleChat(line);
    rl.prompt();
  });

  rl.on("close", () => {
    logger.info(chalk.green("\nAté breve!"));
    process.exit(0);
  });
}
