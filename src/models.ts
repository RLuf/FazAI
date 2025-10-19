export const models: {
  name: string;
  provider: "anthropic" | "openai" | "ollama";
  nickName: string;
}[] = [
  // OpenAI models (DEFAULT)
  {
    name: "gpt-4o-mini",
    provider: "openai",
    nickName: "gpt4mini",
  },
  {
    name: "gpt-4o",
    provider: "openai",
    nickName: "gpt4o",
  },
  {
    name: "gpt-4-turbo",
    provider: "openai",
    nickName: "gpt4turbo",
  },
  // Anthropic Claude models
  {
    name: "claude-3-5-sonnet-latest",
    provider: "anthropic",
    nickName: "sonnet35",
  },
  {
    name: "claude-3-haiku-20240307",
    provider: "anthropic",
    nickName: "haiku",
  },
  // Ollama models (local)
  {
    name: "llama3.2",
    provider: "ollama",
    nickName: "llama32",
  },
  {
    name: "qwen2.5:7b",
    provider: "ollama",
    nickName: "qwen",
  },
  {
    name: "mistral",
    provider: "ollama",
    nickName: "mistral",
  },
];
