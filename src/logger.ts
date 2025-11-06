import fs from "fs";
import os from "os";
import path from "path";
import util from "util";
import chalk from "chalk";
import { getConfigValue } from "./config";

type LogLevel = "error" | "warn" | "info" | "debug";

type LoggerInitOptions = {
  levelOverride?: LogLevel;
  logFilePathOverride?: string;
};

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
};

const ANSI_REGEX = /[\u001B\u009B][[\]()#;?]*(?:(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><~])/g;

function stripAnsi(input: string): string {
  return input.replace(ANSI_REGEX, "");
}

function parseLogLevel(raw?: string | null): LogLevel | null {
  if (!raw) {
    return null;
  }
  const value = raw.trim().toLowerCase();
  if (value === "error" || value === "warn" || value === "info" || value === "debug") {
    return value;
  }
  return null;
}

let currentLevel: LogLevel = "info";
let logFilePath: string | null = null;
let logStream: fs.WriteStream | null = null;
let hasWarnedAboutLogFile = false;

function closeStream(): void {
  if (logStream) {
    logStream.end();
    logStream = null;
  }
}

function ensureStream(targetPath: string): void {
  if (logFilePath === targetPath && logStream) {
    return;
  }

  closeStream();

  try {
    const dir = path.dirname(targetPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    logStream = fs.createWriteStream(targetPath, { flags: "a" });
    logStream.on("error", (error) => {
      if (!hasWarnedAboutLogFile) {
        console.warn(chalk.yellow(`⚠️  Falha ao escrever log em ${targetPath}: ${error}`));
        hasWarnedAboutLogFile = true;
      }
      closeStream();
    });
    logFilePath = targetPath;
  } catch (error) {
    if (!hasWarnedAboutLogFile) {
      console.warn(chalk.yellow(`⚠️  Não foi possível criar diretório de log (${targetPath}): ${error}`));
      hasWarnedAboutLogFile = true;
    }
    closeStream();
  }
}

function formatArgs(args: unknown[]): string {
  return args
    .map((arg) => {
      if (typeof arg === "string") {
        return arg;
      }
      return util.inspect(arg, { depth: 4, colors: chalk.level > 0 });
    })
    .join(" ");
}

function writeToFile(level: LogLevel, message: string): void {
  if (!logStream || !logFilePath) {
    return;
  }
  const timestamp = new Date().toISOString();
  const plain = stripAnsi(message);
  logStream.write(`${timestamp} [${level.toUpperCase()}] ${plain}\n`);
}

function shouldLog(level: LogLevel): boolean {
  return LEVEL_PRIORITY[level] <= LEVEL_PRIORITY[currentLevel];
}

function log(level: LogLevel, ...args: unknown[]): void {
  const message = formatArgs(args);
  writeToFile(level, message);

  if (!shouldLog(level)) {
    return;
  }

  switch (level) {
    case "error":
      console.error(message);
      break;
    case "warn":
      console.warn(message);
      break;
    case "info":
      console.log(message);
      break;
    case "debug":
      console.debug(message);
      break;
  }
}

export function initLogger(options: LoggerInitOptions = {}): void {
  const envLevel = parseLogLevel(process.env.FAZAI_LOG_LEVEL ?? null);
  const envLogPath = process.env.FAZAI_LOG_FILE?.trim();
  const configLevel = parseLogLevel(getConfigValue("LOG_LEVEL"));
  const configLogPath = getConfigValue("LOG_FILE_PATH")?.trim();

  const level = options.levelOverride ?? envLevel ?? configLevel ?? currentLevel;
  currentLevel = level;

  const defaultLogPath = "/var/log/fazai/fazai.log";
  const fallbackLogPath = path.join(process.cwd(), "fazai.log");
  const logPathCandidate = options.logFilePathOverride ?? envLogPath ?? configLogPath ?? defaultLogPath;

  ensureStream(logPathCandidate);

  if (!logStream) {
    ensureStream(fallbackLogPath);
  }
}

export const logger = {
  error: (...args: unknown[]) => log("error", ...args),
  warn: (...args: unknown[]) => log("warn", ...args),
  info: (...args: unknown[]) => log("info", ...args),
  debug: (...args: unknown[]) => log("debug", ...args),
  getLevel: (): LogLevel => currentLevel,
};

// Inicializa com valores padrão ao importar o módulo.
initLogger();
