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

interface GraphNode {
  id: string;
  type: string;
  name: string;
  filePath: string;
  layer: string;
  metadata: Record<string, unknown>;
}

interface GraphEdge {
  source: string;
  target: string;
  type: string;
}

interface KnowledgeGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

const LAYER_LABELS: Record<string, string> = {
  presentation: "Presentation Layer (UI)",
  api: "API Layer (Routes & Endpoints)",
  controller: "Controller Layer (Request Handlers)",
  service: "Service Layer (Business Logic)",
  "data-access": "Data Access Layer (Database & ORM)",
  infrastructure: "Infrastructure (Workers & Queues)",
  shared: "Shared Layer (Utils & Types)",
  unknown: "Other Files",
};

function buildKGContext(graph: KnowledgeGraph): string {
  const fileNodes = graph.nodes.filter((n) => n.type === "file");

  const layerFiles = new Map<string, string[]>();
  for (const node of fileNodes) {
    const l = node.layer || "unknown";
    if (!layerFiles.has(l)) layerFiles.set(l, []);
    layerFiles.get(l)!.push(node.name);
  }

  const lines: string[] = ["## Repository Architecture"];

  lines.push("", "### Files by Layer");
  const layerOrder = [
    "presentation",
    "api",
    "controller",
    "service",
    "data-access",
    "infrastructure",
    "shared",
    "unknown",
  ];
  for (const layer of layerOrder) {
    const files = layerFiles.get(layer);
    if (!files || files.length === 0) continue;
    const label = LAYER_LABELS[layer] || layer;
    lines.push(`- **${label}**: ${files.join(", ")}`);
  }

  const typeNodes = graph.nodes.filter((n) => n.type !== "file");
  if (typeNodes.length > 0) {
    lines.push("", "### Key Components");
    for (const node of typeNodes) {
      const icon =
        node.type === "class"
          ? "(class)"
          : node.type === "interface"
            ? "(interface)"
            : node.type === "function"
              ? "(function)"
              : `(${node.type})`;
      lines.push(`- **${node.name}** ${icon} → ${node.filePath || "?"}`);
      if (node.type === "class" || node.type === "interface") {
        const props =
          (node.metadata?.properties as
            Array<{ name: string; type: string }> | undefined) || [];
        if (props.length > 0) {
          lines.push(
            `  Properties: ${props.map((p) => `${p.name}: ${p.type}`).join(", ")}`,
          );
        }
        const methods =
          (node.metadata?.methods as Array<{ name: string }> | undefined) || [];
        if (methods.length > 0) {
          lines.push(
            `  Methods: ${methods.map((m) => `${m.name}()`).join(", ")}`,
          );
        }
      }
      if (node.type === "function") {
        const params =
          (node.metadata?.parameters as
            Array<{ name: string; type: string }> | undefined) || [];
        const returnType = node.metadata?.returnType as string | undefined;
        if (params.length > 0) {
          lines.push(
            `  Params: ${params.map((p) => `${p.name}: ${p.type}`).join(", ")}`,
          );
        }
        if (returnType) {
          lines.push(`  Returns: ${returnType}`);
        }
      }
    }
  }

  const imports = graph.edges.filter((e) => e.type === "imports");
  const extImpl = graph.edges.filter(
    (e) => e.type === "extends" || e.type === "implements",
  );

  if (imports.length > 0) {
    lines.push("", "### Import Dependencies");
    const bySource = new Map<string, string[]>();
    for (const edge of imports) {
      if (!bySource.has(edge.source)) bySource.set(edge.source, []);
      bySource.get(edge.source)!.push(edge.target);
    }
    for (const [src, targets] of bySource) {
      if (targets.length > 0) {
        lines.push(`- ${src} → ${targets.join(", ")}`);
      }
    }
  }

  if (extImpl.length > 0) {
    lines.push("", "### Inheritance");
    for (const edge of extImpl) {
      const arrow = edge.type === "extends" ? "extends" : "implements";
      const srcName = edge.source.split("::").pop() || edge.source;
      lines.push(`- ${srcName} ${arrow} ${edge.target}`);
    }
  }

  return lines.join("\n");
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

// Shared by sendMessage (user typed something) and startIssueChat (an issue
// was clicked). Both cases boil down to the same thing once a Message with
// role USER already exists in the DB: gather context, stream a reply, persist
// it. Keeping this in one place means issueContext/kgContext/history behavior
// never drifts between the two entry points.
async function streamAssistantReply(
  req: Request,
  res: Response,
  chatId: string,
  repoId: string,
  content: string,
  issueNumber?: number,
): Promise<void> {
  const [chunks, historyDesc, kgArtifact] = await Promise.all([
    findRelevantChunks(repoId, content),
    // orderBy desc + take so we get the MOST RECENT N messages (including
    // the user message we just inserted). Sorting asc+take would instead
    // grab the OLDEST N messages, so once a chat passed HISTORY_LIMIT
    // messages the model would silently stop seeing anything recent.
    prisma.message.findMany({
      where: { chatId },
      orderBy: { createdAt: "desc" },
      take: HISTORY_LIMIT,
    }),
    prisma.aiArtifact.findFirst({
      where: { repositoryId: repoId, type: "CODE_REVIEW" },
    }),
  ]);

  const history = historyDesc.reverse();

  let kgContext = "";
  if (kgArtifact) {
    try {
      const graph = JSON.parse(kgArtifact.content) as KnowledgeGraph;
      kgContext = buildKGContext(graph);
    } catch {}
  }

  let issueContext = "";
  if (issueNumber && typeof issueNumber === "number") {
    try {
      const issue = await prisma.githubIssue.findUnique({
        where: {
          repositoryId_issueNumber: { repositoryId: repoId, issueNumber },
        },
      });
      if (issue) {
        const labelsText =
          Array.isArray(issue.labels) && issue.labels.length > 0
            ? `Labels: ${(issue.labels as string[]).join(", ")}`
            : "";
        issueContext = [
          "## Context: GitHub Issue #" + issue.issueNumber,
          `Title: ${issue.title}`,
          labelsText,
          issue.body
            ? `Description:\n> ${issue.body.replace(/\n/g, "\n> ")}`
            : "",
        ]
          .filter(Boolean)
          .join("\n");
      }
    } catch {}
  }

  const contextBlock = buildContextBlocks(chunks);

  const systemPrompt = [
    SYSTEM_PROMPT_BASE,
    issueContext || null,
    kgContext || null,
    contextBlock || null,
  ]
    .filter(Boolean)
    .join("\n\n");

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

  let fullResponse = "";

  const HEARTBEAT_INTERVAL_MS = 15000;
  const heartbeat = setInterval(() => {
    res.write(`: ping\n\n`);
  }, HEARTBEAT_INTERVAL_MS);

  const stopHeartbeat = () => clearInterval(heartbeat);

  // If the client navigates away / closes the tab mid-stream, stop wasting
  // an interval on a socket nobody's listening on.
  req.on("close", stopHeartbeat);

  try {
    await chatStream(aiMessages, "openrouter/free", (chunk) => {
      fullResponse += chunk;
      res.write(`data: ${JSON.stringify({ content: chunk })}\n\n`);
    });

    stopHeartbeat();

    if (!fullResponse.trim()) {
      res.write(
        `data: ${JSON.stringify({
          error: "The model returned an empty response. Please try again.",
        })}\n\n`,
      );
      res.end();
      return;
    }

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
    stopHeartbeat();

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
}

/**
 *
 *Triggered when a user clicks an issue and wants to jump straight into a
 chat about it: creates a new chat for the repo, seeds it with a message
 asking the model to locate the relevant file(s) and propose a fix, then
 streams the reply the same way sendMessage does.

 Because this is an SSE response, there's no ordinary JSON body to hand
 back the new chat's id — so the very first thing written to the stream is
  a `chat` event carrying { chatId }. The frontend should read that first,
  then treat everything after it exactly like a normal sendMessage stream
 (data: {content} chunks, then data: [DONE]).
 */
const sendMessage = async (req: Request, res: Response) => {
  const chatId = req.params.chatId as string;
  const { content, issueNumber } = req.body;

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
  const trimmed = content.trim();

  await prisma.message.create({
    data: {
      chatId,
      role: "USER",
      content: trimmed,
    },
  });

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  await streamAssistantReply(req, res, chatId, repoId, trimmed, issueNumber);
};

const startIssueChat = async (req: Request, res: Response) => {
  const repoId = req.params.repoId as string;
  const issueNumber = parseInt(req.params.issueNumber as string, 10);

  if (Number.isNaN(issueNumber)) {
    throw new ApiError(400, "invalid issue number");
  }

  const repository = await prisma.repository.findUnique({
    where: { id: repoId },
  });

  if (!repository) {
    throw new ApiError(404, "repository not found");
  }

  const issue = await prisma.githubIssue.findUnique({
    where: { repositoryId_issueNumber: { repositoryId: repoId, issueNumber } },
  });

  if (!issue) {
    throw new ApiError(404, "issue not found");
  }

  const chat = await prisma.chat.create({
    data: {
      repositoryId: repoId,
      title: `Issue #${issue.issueNumber}: ${issue.title}`.slice(0, 200),
    },
  });

  const prompt = [
    `I want to work on GitHub issue #${issue.issueNumber}: "${issue.title}".`,
    "",
    issue.body
      ? `Description:\n${issue.body}`
      : "No description was provided for this issue.",
    "",
    "Based on this repository's code, which file(s) does this issue most likely",
    "live in, and how would you go about solving it? Be specific about file",
    "paths, and outline the concrete change needed.",
  ].join("\n");

  await prisma.message.create({
    data: {
      chatId: chat.id,
      role: "USER",
      content: prompt,
    },
  });

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  res.write(`event: chat\ndata: ${JSON.stringify({ chatId: chat.id })}\n\n`);

  await streamAssistantReply(
    req,
    res,
    chat.id,
    repoId,
    prompt,
    issue.issueNumber,
  );
};

const getMessages = async (req: Request, res: Response) => {
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

export { sendMessage, startIssueChat, getMessages };
