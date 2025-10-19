import { Anthropic } from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { askPrompt, generalAskPrompt } from "./askPrompt";
import { Readable } from "stream";
import { models } from "./models";

export async function* askAI(
  fileContent: string,
  question: string,
  model: string,
  provider: (typeof models)[number]["provider"],
  isGeneralQuestion: boolean = false
): AsyncGenerator<string, void, undefined> {
  const prompt = isGeneralQuestion ? generalAskPrompt(question) : askPrompt(question);

  if (provider === "anthropic") {
    const anthropic = new Anthropic();
    const systemMessage = isGeneralQuestion
      ? "Você é um assistente inteligente e bem-informado. Responda perguntas de forma clara e útil."
      : `CODE:\n${fileContent}\n`;

    const stream = await anthropic.messages.create({
      messages: [{ role: "user", content: prompt }],
      model: model,
      max_tokens: 4096,
      stream: true,
      system: systemMessage,
    });

    for await (const chunk of stream) {
      if (
        chunk.type === "content_block_delta" &&
        chunk.delta?.type === "text_delta"
      ) {
        yield chunk.delta.text;
      }
    }
  } else if (provider === "openai") {
    const openai = new OpenAI();
    const systemMessage = isGeneralQuestion
      ? "Você é um assistente inteligente e bem-informado. Responda perguntas de forma clara e útil."
      : `CODE:\n${fileContent}\n`;

    const stream = await openai.chat.completions.create({
      model: model,
      messages: [
        { role: "system", content: systemMessage },
        { role: "user", content: prompt },
      ],
      stream: true,
    });

    for await (const chunk of stream) {
      yield chunk.choices[0]?.delta?.content || "";
    }
  } else if (provider === "ollama") {
    const baseUrl = process.env.OLLAMA_BASE_URL || "http://localhost:11434";
    const openai = new OpenAI({
      baseURL: `${baseUrl}/v1`,
      apiKey: "ollama", // Ollama não precisa de API key real
    });

    const systemMessage = isGeneralQuestion
      ? "Você é um assistente inteligente e bem-informado. Responda perguntas de forma clara e útil."
      : `CODE:\n${fileContent}\n`;

    const stream = await openai.chat.completions.create({
      model: model,
      messages: [
        { role: "system", content: systemMessage },
        { role: "user", content: prompt },
      ],
      stream: true,
    });

    for await (const chunk of stream) {
      yield chunk.choices[0]?.delta?.content || "";
    }
  }
}
