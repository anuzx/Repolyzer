import { cloneRepository } from "@repo/github";
import { deleteTempDirectory } from "../utils/cleanup";
import { createTempDirectory } from "../utils/temp";
import { prisma } from "@repo/db";
import type { Job } from "bullmq";
import pLimit from "p-limit";
import { scanRepository } from "../services/scan.service";
import { buildKnowledgeGraph } from "../services/ast";
import { generateMermaid } from "../services/graph.service";
import { generateSystemArchitecture } from "../services/system-diagram.service";
import { generateSummary } from "../services/summary.service";
import { chunkRepository } from "../services/chunk.service";
import { embedRepositoryChunks } from "../services/embedding.service";
import crypto from "node:crypto";
import fs from "node:fs/promises";

export interface RepositoryJob {
  repositoryId: string;
}

const READ_CONCURRENCY = 15;

function extractFileDescription(content: string, extension: string): string | null {
  const lines = content.split("\n");
  const maxLines = 20;
  for (let i = 0; i < Math.min(lines.length, maxLines); i++) {
    const trimmed = lines[i]!.trim();
    if (trimmed.startsWith("#!")) continue;
    if (trimmed.startsWith("#")) {
      const desc = trimmed.replace(/^#\s*/, "");
      if (desc) return desc.slice(0, 120);
    }
    if (trimmed.startsWith("//")) {
      const desc = trimmed.replace(/^\/\/\s*/, "");
      if (desc) return desc.slice(0, 120);
    }
    if (/^\/\*+/.test(trimmed)) {
      const desc = trimmed.replace(/^\/\*+\*?\s*/, "").replace(/\s*\*+\/$/, "");
      if (desc) return desc.slice(0, 120);
    }
    if (/^\s*\*/.test(trimmed)) {
      const desc = trimmed.replace(/^\s*\*\s*/, "");
      if (desc) return desc.slice(0, 120);
    }
  }
  return null;
}

export async function repositoryProcessor(job: Job<RepositoryJob>) {
  const repo = await prisma.repository.findUnique({
    where: { id: job.data.repositoryId },
  });

  if (!repo) {
    throw new Error("Repository does not exist");
  }

  const dbJob = await prisma.job.create({
    data: {
      repositoryId: repo.id,
      status: "RUNNING",
      startedAt: new Date(),
    },
  });

  const tempDir = await createTempDirectory(repo.id);

  try {
    await prisma.repository.update({
      where: { id: repo.id },
      data: { status: "CLONING" },
    });

    await cloneRepository(repo.cloneUrl, tempDir);

    await prisma.repository.update({
      where: { id: repo.id },
      data: { status: "PARSING" },
    });

    const files = await scanRepository(tempDir);
    const graph = await buildKnowledgeGraph(files);
    const mermaid = await generateMermaid(graph);

    // Read every file's content ONCE, with bounded concurrency, and reuse it
    // for hashing + the file row AND for chunking below — avoids double disk I/O
    // across the whole repo and avoids the fully-sequential await-in-a-loop.
    const limit = pLimit(READ_CONCURRENCY);
    const fileContents = new Map<string, string>();

    const fileRecords = await Promise.all(
      files.map((file) =>
        limit(async () => {
          const content = await fs.readFile(file.absolutePath, "utf-8");
          fileContents.set(file.relativePath, content);

          const hash = crypto
            .createHash("sha256")
            .update(content)
            .digest("hex")
            .slice(0, 16);

          const fileNode = graph.nodes.find(
            (n) => n.type === "file" && n.id === file.relativePath,
          );

          return {
            id: crypto.randomUUID(),
            repositoryId: repo.id,
            path: file.relativePath,
            extension: file.extension,
            language: file.extension.replace(".", ""),
            size: file.size,
            hash,
            summary: extractFileDescription(content, file.extension) ?? (fileNode?.metadata?.summary as string) ?? null,
          };
        }),
      ),
    );

    // One bulk insert instead of N sequential prisma.file.create calls.
    // IDs are generated client-side so chunkRepository can look them up
    // without an extra round trip.
    const INSERT_BATCH_SIZE = 500;
    for (let i = 0; i < fileRecords.length; i += INSERT_BATCH_SIZE) {
      await prisma.file.createMany({
        data: fileRecords.slice(i, i + INSERT_BATCH_SIZE),
      });
    }

    await prisma.aiArtifact.create({
      data: {
        repositoryId: repo.id,
        type: "ARCHITECTURE",
        content: JSON.stringify(mermaid),
      },
    });

    // Requires fileContents (populated just above) to read package.json contents
    // for service/dependency detection — must run after that loop, not before.
    const systemArchitecture = await generateSystemArchitecture(graph, files, fileContents, {
      owner: repo.owner,
      name: repo.name,
      description: repo.description,
    });

    await prisma.aiArtifact.create({
      data: {
        repositoryId: repo.id,
        type: "SYSTEM_ARCHITECTURE",
        content: systemArchitecture,
      },
    });

    await prisma.aiArtifact.create({
      data: {
        repositoryId: repo.id,
        type: "CODE_REVIEW",
        content: JSON.stringify(graph),
      },
    });

    await prisma.repository.update({
      where: { id: repo.id },
      data: { status: "SUMMARY" },
    });

    const summary = await generateSummary(graph, files, {
      owner: repo.owner,
      name: repo.name,
      description: repo.description,
      language: repo.language,
      defaultBranch: repo.defaultBranch,
      stars: repo.stars,
      forks: repo.forks,
    });

    await prisma.aiArtifact.create({
      data: {
        repositoryId: repo.id,
        type: "DOCUMENTATION",
        content: summary,
      },
    });

    await prisma.repository.update({
      where: { id: repo.id },
      data: { status: "CHUNKING" },
    });

    // Pass in the content we already read — chunkRepository won't hit disk again.
    const chunkCount = await chunkRepository(repo.id, files, fileContents);

    await prisma.repository.update({
      where: { id: repo.id },
      data: { status: "EMBEDDING" },
    });

    const embedCount = await embedRepositoryChunks(repo.id);

    await prisma.repository.update({
      where: { id: repo.id },
      data: { status: "COMPLETED", indexedAt: new Date() },
    });

    await prisma.job.update({
      where: { id: dbJob.id },
      data: { status: "COMPLETED", completedAt: new Date() },
    });
  } catch (error) {
    await prisma.job.update({
      where: { id: dbJob.id },
      data: {
        status: "FAILED",
        completedAt: new Date(),
        error: error instanceof Error ? error.message : "Unknown error",
      },
    });

    try {
      await prisma.repository.update({
        where: { id: repo.id },
        data: { status: "FAILED" },
      });
    } catch {}

    throw error;
  } finally {
    await deleteTempDirectory(tempDir);
  }
}