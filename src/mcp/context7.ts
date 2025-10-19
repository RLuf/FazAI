import { exec } from "child_process";
import { promisify } from "util";
import chalk from "chalk";
import { logger } from "../logger";

const execAsync = promisify(exec);

export interface Context7Options {
  url?: string;
  apiKey?: string;
  command?: string;
}

export interface Context7Finding {
  title: string;
  url?: string;
  snippet?: string;
}

export interface Context7Result {
  provider: "context7";
  query: string;
  summary?: string;
  findings: Context7Finding[];
}

export class Context7Client {
  constructor(private readonly options: Context7Options = {}) {}

  async search(query: string): Promise<Context7Result | null> {
    if (this.options.url) {
      const httpResult = await this.searchViaHttp(query);
      if (httpResult) {
        return httpResult;
      }
    }

    if (this.options.command) {
      const commandResult = await this.searchViaCommand(query);
      if (commandResult) {
        return commandResult;
      }
    }

    return null;
  }

  private async searchViaHttp(query: string): Promise<Context7Result | null> {
    const endpoint = this.options.url;
    if (!endpoint) {
      return null;
    }

    try {
      let requestUrl = endpoint;
      let method: "GET" | "POST" = "POST";
      let body: string | undefined = JSON.stringify({ query });
      const headers: Record<string, string> = {
        Accept: "application/json",
        "Content-Type": "application/json",
      };

      if (endpoint.includes("{query}")) {
        requestUrl = endpoint.replace("{query}", encodeURIComponent(query));
        method = "GET";
        delete headers["Content-Type"];
      } else {
        try {
          const urlObj = new URL(endpoint);
          if (!urlObj.searchParams.has("query")) {
            urlObj.searchParams.set("query", query);
          }
          requestUrl = urlObj.toString();
          method = "GET";
          delete headers["Content-Type"];
          body = undefined;
        } catch {
          // keep POST fallback if URL is not absolute
        }
      }

      if (this.options.apiKey) {
        headers.Authorization = `Bearer ${this.options.apiKey}`;
      }

      const response = await fetch(requestUrl, {
        method,
        headers,
        body,
      });

      if (!response.ok) {
        const text = await response.text().catch(() => "");
        logger.warn(chalk.yellow(`⚠️  Context7 HTTP retornou status ${response.status}: ${text}`));
        return null;
      }

      const contentType = response.headers.get("Content-Type") ?? "";
      const payload = contentType.includes("application/json")
        ? await response.json()
        : await response.text();

      const findings = this.normalizeResults(payload);
      return {
        provider: "context7",
        query,
        summary: typeof payload?.summary === "string" ? payload.summary : undefined,
        findings,
      };
    } catch (error) {
      logger.warn(chalk.yellow(`⚠️  Falha ao consultar Context7 via HTTP: ${String(error)}`));
      return null;
    }
  }

  private async searchViaCommand(query: string): Promise<Context7Result | null> {
    const commandTemplate = this.options.command;
    if (!commandTemplate) {
      return null;
    }

    const escapedQuery = query.replace(/"/g, '\\"');
    const command = commandTemplate.includes("{query}")
      ? commandTemplate.replace(/\{query\}/g, escapedQuery)
      : `${commandTemplate} "${escapedQuery}"`;

    try {
      const { stdout } = await execAsync(command, { maxBuffer: 1024 * 1024, shell: true });
      return {
        provider: "context7",
        query,
        summary: undefined,
        findings: this.parseCommandOutput(stdout),
      };
    } catch (error) {
      logger.warn(chalk.yellow(`⚠️  Falha ao executar comando Context7: ${String(error)}`));
      return null;
    }
  }

  private normalizeResults(payload: any): Context7Finding[] {
    if (!payload) {
      return [];
    }

    if (Array.isArray(payload?.results)) {
      return payload.results
        .map((item: any) => this.mapFinding(item))
        .filter((item): item is Context7Finding => !!item);
    }

    if (Array.isArray(payload)) {
      return payload
        .map((item) => this.mapFinding(item))
        .filter((item): item is Context7Finding => !!item);
    }

    return [];
  }

  private mapFinding(item: any): Context7Finding | null {
    if (!item) {
      return null;
    }

    if (typeof item === "string") {
      return { title: item, snippet: item };
    }

    if (typeof item === "object") {
      const title = item.title ?? item.heading ?? item.topic ?? item.name;
      const snippet = item.snippet ?? item.summary ?? item.text ?? item.description;
      const url = item.url ?? item.link ?? item.href;

      if (!title && !snippet) {
        return null;
      }

      return {
        title: String(title || snippet || "Resultado"),
        snippet: snippet ? String(snippet) : undefined,
        url: url ? String(url) : undefined,
      };
    }

    return null;
  }

  private parseCommandOutput(stdout: string): Context7Finding[] {
    const trimmed = stdout.trim();
    if (!trimmed) {
      return [];
    }

    try {
      const parsed = JSON.parse(trimmed);
      return this.normalizeResults(parsed);
    } catch {
      const lines = trimmed.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
      return lines.map((line) => ({ title: line, snippet: line }));
    }
  }
}
