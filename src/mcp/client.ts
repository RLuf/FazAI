import { Context7Client, Context7Options, Context7Result } from "./context7";

export interface MCPClientOptions {
  context7?: Context7Options;
}

export class MCPClient {
  private readonly context7Client: Context7Client | null;

  constructor(options: MCPClientOptions = {}) {
    this.context7Client = options.context7 ? new Context7Client(options.context7) : null;
  }

  async queryContext7(query: string): Promise<Context7Result | null> {
    if (!this.context7Client) {
      return null;
    }
    return this.context7Client.search(query);
  }
}
