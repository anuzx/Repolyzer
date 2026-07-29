import { client } from "./client";

export async function chatStream(
  messages: (
    | { role: "user"; content: string }
    | { role: "assistant"; content: string }
    | { role: "system"; content: string }
  )[],
  model = "openrouter/free",
  onChunk?: (text: string) => void,
): Promise<string> {
  const response = await client.chat.completions.create({
    model,
    messages,
    stream: true,
  });

  let full = "";
  for await (const chunk of response) {
    const content = chunk.choices[0]?.delta?.content;
    if (content) {
      full += content;
      onChunk?.(content);
    }
  }
  return full;
}
