import { cloneRepository } from "@repo/github";
import { deleteTempDirectory } from "../utils/cleanup";
import { createTempDirectory } from "../utils/temp";
import { prisma } from "@repo/db";
import type { Job } from "bullmq";
import { scanRepository } from "../services/scan.service";
import { buildKnowledgeGraph } from "../services/ast.service";
import { generateMermaid } from "../services/graph.service";
import crypto from "node:crypto";
import fs from "node:fs/promises";

export interface RepositoryJob {
  repositoryId: string;
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

    for (const file of files) {
      const content = await fs.readFile(file.absolutePath, "utf-8");
      const hash = crypto
        .createHash("sha256")
        .update(content)
        .digest("hex")
        .slice(0, 16);

      const fileNode = graph.nodes.find(
        (n) => n.type === "file" && n.id === file.relativePath,
      );

      await prisma.file.create({
        data: {
          repositoryId: repo.id,
          path: file.relativePath,
          extension: file.extension,
          language: file.extension.replace(".", ""),
          size: file.size,
          hash,
          summary: (fileNode?.metadata?.summary as string) ?? null,
        },
      });
    }

    await prisma.aiArtifact.create({
      data: {
        repositoryId: repo.id,
        type: "ARCHITECTURE",
        content: JSON.stringify(mermaid),
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
