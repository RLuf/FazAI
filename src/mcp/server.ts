import http from "http";
import chalk from "chalk";
import { ResearchCoordinator } from "../research";

export interface MCPServerOptions {
  host?: string;
  port?: number;
  researchCoordinator: ResearchCoordinator;
}

export class MCPServer {
  private server?: http.Server;
  private readonly options: Required<MCPServerOptions>;

  constructor(options: MCPServerOptions) {
    this.options = {
      host: options.host ?? "127.0.0.1",
      port: options.port ?? 7700,
      researchCoordinator: options.researchCoordinator,
    };
  }

  async start(): Promise<void> {
    if (this.server) {
      return;
    }

    this.server = http.createServer(async (req, res) => {
      if (!req.url) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: "invalid_request" }));
        return;
      }

      const { method, url } = req;

      if (method !== "POST" || url !== "/context7/search") {
        res.writeHead(404);
        res.end(JSON.stringify({ error: "not_found" }));
        return;
      }

      try {
        const body = await this.readBody(req);
        const query = typeof body.query === "string" ? body.query.trim() : "";

        if (!query) {
          res.writeHead(400);
          res.end(JSON.stringify({ error: "missing_query" }));
          return;
        }

        const result = await this.options.researchCoordinator.research(query, {
          reason: "Solicitado via MCP server",
          trigger: "pre-execution",
        });

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ query, result }));
      } catch (error) {
        console.error(chalk.red(`❌ Erro no MCP server: ${String(error)}`));
        res.writeHead(500);
        res.end(JSON.stringify({ error: "internal_error" }));
      }
    });

    await new Promise<void>((resolve) => {
      this.server!.listen(this.options.port, this.options.host, () => {
        console.log(chalk.green(`🛰️  MCP server ativo em http://${this.options.host}:${this.options.port}`));
        resolve();
      });
    });
  }

  async stop(): Promise<void> {
    if (!this.server) {
      return;
    }

    await new Promise<void>((resolve) => {
      this.server!.close(() => resolve());
    });
    this.server = undefined;
  }

  private async readBody(request: http.IncomingMessage): Promise<any> {
    const chunks: Buffer[] = [];
    for await (const chunk of request) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    if (!chunks.length) {
      return {};
    }
    const payload = Buffer.concat(chunks).toString("utf-8");
    try {
      return JSON.parse(payload);
    } catch {
      return {};
    }
  }
}
