import chalk from "chalk";
import { MCPClient } from "./mcp/client";
import { Context7Result } from "./mcp/context7";
import { getConfigValue } from "./config";
import { LinuxCommand } from "./types-linux";

export interface ResearchFinding {
  title: string;
  url?: string;
  snippet?: string;
}

export interface ResearchResult {
  provider: string;
  query: string;
  reason: string;
  findings: ResearchFinding[];
  summary?: string;
}

type ResearchTrigger = "pre-execution" | "failure";

const truthy = new Set(["1", "true", "yes", "on"]);

function resolveFlag(value?: string | null): boolean {
  if (!value) {
    return false;
  }
  return truthy.has(value.toLowerCase());
}

export interface ResearchCoordinatorOptions {
  enabled: boolean;
  context7Url?: string;
  context7Command?: string;
  context7ApiKey?: string;
  webSearchProvider?: string;
  researchOnFailure?: boolean;
}

export class ResearchCoordinator {
  private client: MCPClient;
  private options: ResearchCoordinatorOptions;

  constructor(options: Partial<ResearchCoordinatorOptions> = {}) {
    this.options = {
      enabled: true,
      ...options,
    };
    this.client = this.buildClient();
  }

  async maybeRunPreExecutionResearch(command: LinuxCommand): Promise<ResearchResult | null> {
    const researchNeeded = command.researchNeeded ?? false;
    const researchQuery = command.researchQuery?.trim();

    if (!researchNeeded && !researchQuery) {
      return null;
    }

    const query = researchQuery && researchQuery.length > 0
      ? researchQuery
      : `${command.command} contexto`;

    const reason = command.researchReason?.trim() || "Modelo solicitou pesquisa complementar antes da execução";
    return this.research(query, { reason, trigger: "pre-execution" });
  }

  async handleExecutionFailure(command: LinuxCommand, errorOutput: string): Promise<ResearchResult | null> {
    if (!this.isFailureResearchEnabled()) {
      return null;
    }

    const condensedError = errorOutput.replace(/\s+/g, " ").trim().slice(0, 220);
    const query = `${command.command} erro ${condensedError}`.trim();
    const reason = "Fallback automático após falha na execução do comando";

    return this.research(query, { reason, trigger: "failure" });
  }

  async research(query: string, options: { reason?: string; trigger?: ResearchTrigger } = {}): Promise<ResearchResult | null> {
    if (!this.isEnabled()) {
      return null;
    }

    const reason = options.reason ?? "Solicitação externa";
    const trigger = options.trigger ?? "pre-execution";
    return this.performResearch(query, reason, trigger);
  }

  private async performResearch(query: string, reason: string, trigger: ResearchTrigger): Promise<ResearchResult | null> {
    this.refreshClient();

    const context7 = await this.tryContext7(query, reason, trigger);
    if (context7) {
      this.logResearch(context7);
      return context7;
    }

    const web = await this.tryWebSearch(query, reason, trigger);
    if (web) {
      this.logResearch(web);
      return web;
    }

    console.log(chalk.gray(`\n🤷  Nenhum resultado de pesquisa encontrado para "${query}" (${reason}).`));
    return null;
  }

  private async tryContext7(query: string, reason: string, trigger: ResearchTrigger): Promise<ResearchResult | null> {
    const context7Result: Context7Result | null = await this.client.queryContext7(query);
    if (!context7Result) {
      return null;
    }

    return {
      provider: "context7",
      query,
      reason: this.decorateReason(reason, trigger, "context7"),
      findings: context7Result.findings,
      summary: context7Result.summary,
    };
  }

  private async tryWebSearch(query: string, reason: string, trigger: ResearchTrigger): Promise<ResearchResult | null> {
    const provider = (this.options.webSearchProvider
      ?? getConfigValue("WEB_SEARCH_PROVIDER")
      ?? process.env.WEB_SEARCH_PROVIDER
      ?? "duckduckgo").toLowerCase();

    if (provider === "duckduckgo") {
      const result = await this.searchDuckDuckGo(query);
      if (!result) {
        return null;
      }

      return {
        provider: "duckduckgo",
        query,
        reason: this.decorateReason(reason, trigger, "duckduckgo"),
        findings: result,
      };
    }

    console.warn(chalk.yellow(`⚠️  Provedor de busca "${provider}" não suportado. Configure WEB_SEARCH_PROVIDER=duckduckgo.`));
    return null;
  }

  private async searchDuckDuckGo(query: string): Promise<ResearchFinding[] | null> {
    const endpoint = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;
    try {
      const response = await fetch(endpoint, {
        headers: { "Accept": "application/json" },
      });

      if (!response.ok) {
        console.warn(chalk.yellow(`⚠️  DuckDuckGo retornou status ${response.status}`));
        return null;
      }

      const payload = await response.json();
      const findings: ResearchFinding[] = [];

      if (payload?.AbstractText) {
        findings.push({
          title: payload.Heading || query,
          snippet: payload.AbstractText,
          url: payload.AbstractURL || undefined,
        });
      }

      if (Array.isArray(payload?.RelatedTopics)) {
        for (const topic of payload.RelatedTopics) {
          if (Array.isArray(topic?.Topics)) {
            for (const nested of topic.Topics) {
              const entry = this.mapDuckDuckGoTopic(nested);
              if (entry) {
                findings.push(entry);
              }
            }
          } else {
            const entry = this.mapDuckDuckGoTopic(topic);
            if (entry) {
              findings.push(entry);
            }
          }
          if (findings.length >= 5) {
            break;
          }
        }
      }

      if (!findings.length && payload?.AbstractURL && payload?.AbstractText) {
        findings.push({
          title: payload.Heading || query,
          snippet: payload.AbstractText,
          url: payload.AbstractURL,
        });
      }

      return findings.length ? findings : null;
    } catch (error) {
      console.warn(chalk.yellow(`⚠️  Falha ao consultar DuckDuckGo: ${String(error)}`));
      return null;
    }
  }

  private mapDuckDuckGoTopic(topic: any): ResearchFinding | null {
    if (!topic) {
      return null;
    }
    const text = topic.Text ?? topic.title ?? topic.Heading;
    const url = topic.FirstURL ?? topic.URL ?? topic.Link;
    if (!text) {
      return null;
    }
    return {
      title: String(text),
      snippet: topic.Result ? String(topic.Result).replace(/<[^>]+>/g, "") : undefined,
      url: url ? String(url) : undefined,
    };
  }

  private decorateReason(base: string, trigger: ResearchTrigger, provider: string): string {
    const cause = trigger === "failure" ? "falha" : "pré-checagem";
    return `${base} (via ${provider}, ${cause})`;
  }

  private logResearch(result: ResearchResult): void {
    console.log(chalk.magentaBright(`\n🧠 Pesquisa (${result.provider})`));
    console.log(chalk.gray(`Motivo: ${result.reason}`));
    if (result.summary) {
      console.log(chalk.magenta(`Resumo: ${result.summary}`));
    }

    if (!result.findings.length) {
      console.log(chalk.gray("Nenhuma referência retornada."));
      return;
    }

    result.findings.slice(0, 5).forEach((finding, index) => {
      console.log(chalk.magenta(` ${index + 1}. ${finding.title}`));
      if (finding.snippet) {
        console.log(chalk.gray(`    ${finding.snippet}`));
      }
      if (finding.url) {
        console.log(chalk.blue(`    ${finding.url}`));
      }
    });
  }

  private isEnabled(): boolean {
    const disabledEnv = resolveFlag(process.env.FAZAI_DISABLE_RESEARCH ?? null);
    const disabledConfig = resolveFlag(getConfigValue("FAZAI_DISABLE_RESEARCH"));
    return this.options.enabled && !disabledEnv && !disabledConfig;
  }

  private isFailureResearchEnabled(): boolean {
    if (!this.isEnabled()) {
      return false;
    }

    if (typeof this.options.researchOnFailure === "boolean") {
      return this.options.researchOnFailure;
    }

    const envRaw = process.env.FAZAI_RESEARCH_ON_FAILURE;
    if (envRaw !== undefined) {
      return resolveFlag(envRaw);
    }

    const configRaw = getConfigValue("FAZAI_RESEARCH_ON_FAILURE");
    if (configRaw !== undefined) {
      return resolveFlag(configRaw);
    }

    return false;
  }

  private buildClient(): MCPClient {
    const context7Url = this.options.context7Url
      ?? process.env.MCP_CONTEXT7_URL
      ?? getConfigValue("MCP_CONTEXT7_URL");
    const context7Command = this.options.context7Command
      ?? process.env.MCP_CONTEXT7_COMMAND
      ?? getConfigValue("MCP_CONTEXT7_COMMAND");
    const context7ApiKey = this.options.context7ApiKey
      ?? process.env.MCP_CONTEXT7_API_KEY
      ?? getConfigValue("MCP_CONTEXT7_API_KEY");

    return new MCPClient({
      context7: (context7Url || context7Command)
        ? { url: context7Url || undefined, command: context7Command || undefined, apiKey: context7ApiKey || undefined }
        : undefined,
    });
  }

  private refreshClient(): void {
    this.client = this.buildClient();
  }
}
