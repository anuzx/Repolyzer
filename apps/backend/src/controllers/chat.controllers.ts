import type { Request, Response } from "express";
import { ApiError } from "../utils/ApiError";
import { ApiResponse } from "../utils/ApiResponse";
import { prisma } from "@repo/db";
import { embed, chatStream } from "@repo/ai";

const SIMILARITY_LIMIT = 10;
const HISTORY_LIMIT = 20;

const SYSTEM_PROMPT_BASE = `You are a codebase analyst assistant. You help developers understand a GitHub repository.

Guidelines:
- Answer based strictly on the provided code context.
- Reference specific files and code snippets when relevant.
- If the context doesn't contain enough information, say so clearly.
- Be concise and technical. Use code blocks with language tags.
- When explaining architecture, mention how files relate to each other.`;

interface ChunkResult {
  id: string;
  content: string;
  fileId: string;
  path: string;
}

async function findRelevantChunks(
  repoId: string,
  query: string,
): Promise<{ content: string; path: string }[]> {
  const queryVec = await embed(query);
  if (queryVec.length === 0) return [];

  const vectorStr = `[${queryVec.join(",")}]`;

  const chunks = await prisma.$queryRawUnsafe<ChunkResult[]>(
    `SELECT c.id, c.content, c."fileId", f.path
     FROM "Chunk" c
     JOIN "File" f ON f.id = c."fileId"
     WHERE c."repositoryId" = $1 AND c.embedding IS NOT NULL
     ORDER BY c.embedding <=> $2::vector
     LIMIT ${SIMILARITY_LIMIT}`,
    repoId,
    vectorStr,
  );

  return chunks.map((c) => ({ content: c.content, path: c.path }));
}

function buildContextBlocks(
  chunks: { content: string; path: string }[],
): string {
  if (chunks.length === 0) return "";

  const blocks = chunks.map(
    (c) => `File: ${c.path}\n\`\`\`\n${c.content}\n\`\`\``,
  );

  return ["Relevant code from the repository:", ...blocks].join("\n\n");
}

export const sendMessage = async (req: Request, res: Response) => {
  const chatId = req.params.chatId as string;
  const { content } = req.body;

  if (!content || typeof content !== "string" || !content.trim()) {
    throw new ApiError(400, "message content is required");
  }

  const chat = await prisma.chat.findUnique({
    where: { id: chatId },
    include: { repository: true },
  });

  if (!chat) {
    throw new ApiError(404, "chat not found");
  }

  const repoId = chat.repositoryId;

  await prisma.message.create({
    data: {
      chatId,
      role: "USER",
      content: content.trim(),
    },
  });

  const [chunks, history] = await Promise.all([
    findRelevantChunks(repoId, content),
    prisma.message.findMany({
      where: { chatId },
      orderBy: { createdAt: "asc" },
      take: HISTORY_LIMIT,
    }),
  ]);

  const contextBlock = buildContextBlocks(chunks);

  const systemPrompt = contextBlock
    ? `${SYSTEM_PROMPT_BASE}\n\n${contextBlock}`
    : SYSTEM_PROMPT_BASE;

  const aiMessages: (
    | { role: "system"; content: string }
    | { role: "user"; content: string }
    | { role: "assistant"; content: string }
  )[] = [{ role: "system", content: systemPrompt }];

  for (const msg of history) {
    aiMessages.push({
      role: msg.role.toLowerCase() as "user" | "assistant",
      content: msg.content,
    });
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  let fullResponse = "";

  try {
    await chatStream(aiMessages, "openrouter/free", (chunk) => {
      fullResponse += chunk;
      res.write(`data: ${JSON.stringify({ content: chunk })}\n\n`);
    });

    await prisma.message.create({
      data: {
        chatId,
        role: "ASSISTANT",
        content: fullResponse,
      },
    });

    res.write(`data: [DONE]\n\n`);
    res.end();
  } catch (err) {
    const errorMsg =
      err instanceof Error ? err.message : "stream generation failed";

    if (fullResponse) {
      await prisma.message.create({
        data: {
          chatId,
          role: "ASSISTANT",
          content: fullResponse,
        },
      });
    }

    res.write(`data: ${JSON.stringify({ error: errorMsg })}\n\n`);
    res.end();
  }
};

export const getMessages = async (req: Request, res: Response) => {
  const chatId = req.params.chatId as string;

  const chat = await prisma.chat.findUnique({
    where: { id: chatId },
  });

  if (!chat) {
    throw new ApiError(404, "chat not found");
  }

  const messages = await prisma.message.findMany({
    where: { chatId },
    orderBy: { createdAt: "asc" },
  });

  return res
    .status(200)
    .json(new ApiResponse(200, messages, "messages fetched"));
};
