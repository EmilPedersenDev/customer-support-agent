type ChatRole = "system" | "user" | "assistant";
type OllamaMessage = { role: ChatRole; content: string };

const SYSTEM_INSTRUCTION = `You are a helpful customer support assistant. Use the context provided below to answer the user's question. Prefer information from the context when available, but if the context does not cover the topic, you may answer from your general knowledge.`;

export function buildRagMessages(
  chunks: string[],
  chatMessages: { role: "user" | "assistant"; content: string }[],
): OllamaMessage[] {
  const contextBlock = chunks.map((c) => `---\n${c}\n---`).join("\n\n");

  const systemMessage: OllamaMessage = {
    role: "system",
    content: `${SYSTEM_INSTRUCTION}\n\nContext:\n${contextBlock}`,
  };

  return [systemMessage, ...chatMessages];
}
