import { client } from "./client";

export async function complete(
  prompt: string,
  system?: string,
  model = "openrouter/free",
): Promise<string> {
  const messages: (
    | { role: "system"; content: string }
    | { role: "user"; content: string }
  )[] = [];

  if (system) {
    messages.push({ role: "system", content: system });
  }
  messages.push({ role: "user", content: prompt });

  const response = await client.chat.completions.create({
    model,
    messages,
  });

  return response.choices[0]?.message?.content ?? "";
}
