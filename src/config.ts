import fs from "fs";
import path from "path";

export const CONFIG_FILE_NAME = "fazai.conf";
const CONFIG_ENV_PATH = "FAZAI_CONFIG_PATH";

function resolveConfigPath(): string {
  const explicitPath = process.env[CONFIG_ENV_PATH];
  if (explicitPath && explicitPath.trim().length > 0) {
    return path.resolve(explicitPath.trim());
  }
  return path.resolve(process.cwd(), CONFIG_FILE_NAME);
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
  return fs.existsSync(resolveConfigPath());
}
