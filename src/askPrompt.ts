// prettier-ignore
export const askPrompt = (question: string) =>
`Use the provided code to answer this question. Answer succinctly and provide code snippets if needed.

Use this format for code snippets:

===
filePath.ts:123
\`\`\`typescript
// code goes here
\`\`\`
===

Question: ${question}
`;

// prettier-ignore
export const generalAskPrompt = (question: string) =>
`Responda à pergunta de forma clara, objetiva e informativa. Seja abrangente mas conciso.

Para perguntas técnicas, inclua exemplos práticos quando relevante.
Para comandos ou procedimentos, forneça exemplos de uso.
Para conceitos, explique de forma acessível.

Pergunta: ${question}

Resposta:`;
