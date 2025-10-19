import fs from "fs";
import os from "os";
import path from "path";

export const CONFIG_FILE_NAME = "fazai.conf";
const CONFIG_ENV_PATH = "FAZAI_CONFIG_PATH";

const HOME_DIR = os.homedir() || "";
const DEFAULT_HOME_CONFIG_DIR = HOME_DIR ? path.join(HOME_DIR, ".config", "fazai") : "";

const DEFAULT_WRITE_PATH = DEFAULT_HOME_CONFIG_DIR
  ? path.join(DEFAULT_HOME_CONFIG_DIR, CONFIG_FILE_NAME)
  : path.join(process.cwd(), CONFIG_FILE_NAME);

function getExplicitPath(): string | undefined {
  const explicitPath = process.env[CONFIG_ENV_PATH];
  if (explicitPath && explicitPath.trim().length > 0) {
    return path.resolve(explicitPath.trim());
  }
  return undefined;
}

function getSearchPaths(): string[] {
  const paths: string[] = [];

  const cwdPath = path.resolve(process.cwd(), CONFIG_FILE_NAME);
  paths.push(cwdPath);

  if (process.argv[1]) {
    const scriptPath = path.resolve(process.argv[1]);
    const scriptDir = path.dirname(scriptPath);
    paths.push(path.join(scriptDir, CONFIG_FILE_NAME));
    paths.push(path.join(path.resolve(scriptDir, ".."), CONFIG_FILE_NAME));
  }

  if (DEFAULT_HOME_CONFIG_DIR) {
    paths.push(path.join(DEFAULT_HOME_CONFIG_DIR, CONFIG_FILE_NAME));
  }

  if (HOME_DIR) {
    paths.push(path.join(HOME_DIR, CONFIG_FILE_NAME));
  }

  // Deduplicate preserving order
  return Array.from(new Set(paths));
}

function findExistingConfigPath(): string | undefined {
  const explicit = getExplicitPath();
  if (explicit && fs.existsSync(explicit)) {
    return explicit;
  }

  for (const candidate of getSearchPaths()) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return undefined;
}

function resolveConfigPath(): string {
  const explicit = getExplicitPath();
  const existing = findExistingConfigPath();

  if (existing) {
    return existing;
  }

  if (explicit) {
    return explicit;
  }

  return DEFAULT_WRITE_PATH;
}

function readConfigLines(): string[] {
  const configPath = resolveConfigPath();
  if (!fs.existsSync(configPath)) {
    return [];
  }

  const content = fs.readFileSync(configPath, "utf-8");
  return content.split(/\r?\n/);
}

function writeConfigLines(lines: string[]): void {
  const configPath = resolveConfigPath();
  const content = lines.join("\n").replace(/\n+$/g, "\n");
  const configDir = path.dirname(configPath);
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }
  fs.writeFileSync(configPath, content.endsWith("\n") ? content : `${content}\n`, { encoding: "utf-8" });
}

export function getConfigValue(key: string): string | undefined {
  const lines = readConfigLines();
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    const [entryKey, ...rest] = line.split("=");
    if (entryKey === key) {
      return rest.join("=").trim();
    }
  }
  return undefined;
}

export function setConfigValue(key: string, value: string): void {
  const lines = readConfigLines();
  const filtered = lines.filter((rawLine) => {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      return true;
    }
    return !line.startsWith(`${key}=`);
  });

  filtered.push(`${key}=${value}`);
  writeConfigLines(filtered);
}

export function listConfigEntries(): Record<string, string> {
  const entries: Record<string, string> = {};
  const lines = readConfigLines();
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }
    const [entryKey, ...rest] = line.split("=");
    if (entryKey) {
      entries[entryKey] = rest.join("=").trim();
    }
  }
  return entries;
}

export function getConfigFilePath(): string {
  return resolveConfigPath();
}

export function configFileExists(): boolean {
  return findExistingConfigPath() !== undefined;
}
