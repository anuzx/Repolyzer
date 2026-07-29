import { prisma } from "@repo/db";
import fs from "node:fs/promises";
import pLimit from "p-limit";
import type { SourceFile } from "./scan.service";

const TARGET_CHARS = 2000;
const OVERLAP_CHARS = 200;
// Hard ceiling for a single line (minified bundles, lockfiles, long data URIs, etc).
// Anything past this gets sliced by character instead of becoming one giant chunk.
const MAX_LINE_CHARS = TARGET_CHARS * 2;

// How many files to read + chunk concurrently. Tune based on disk/CPU.
const READ_CONCURRENCY = 15;
// How many chunk rows to send to Postgres per createMany call.
const INSERT_BATCH_SIZE = 500;

const DECLARATION_START = /^\s*(export\s+)?(async\s+)?(function|class|interface|const|let|var|import|type|enum)\s/;

function countTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

function findSplitLine(lines: string[], start: number, end: number): number {
  for (let i = end; i > start; i--) {
    if (lines[i] === undefined) continue;
    if (lines[i]!.trim() === "" && i > start + 5) {
      return i + 1;
    }
  }
  for (let i = end; i > start; i--) {
    if (lines[i] === undefined) continue;
    if (DECLARATION_START.test(lines[i]!)) {
      return i;
    }
  }
  // No good boundary found — fall back to the char-count boundary itself.
  // (Forward progress is still guaranteed by the caller via Math.max(..., start + 1).)
  return end;
}

function splitLongLine(line: string): string[] {
  const parts: string[] = [];
  for (let i = 0; i < line.length; i += MAX_LINE_CHARS) {
    parts.push(line.slice(i, i + MAX_LINE_CHARS));
  }
  return parts;
}

export function chunkContent(content: string): { content: string; tokenCount: number }[] {
  const lines = content.split("\n");
  const chunks: { content: string; tokenCount: number }[] = [];
  let i = 0;

  while (i < lines.length) {
    const firstLine = lines[i] ?? "";

    // A single line alone can exceed TARGET_CHARS (minified/generated files).
    // Handle it directly by character-slicing instead of letting the window
    // logic below stall on a chunk that can never grow.
    if (firstLine.length >= MAX_LINE_CHARS) {
      for (const part of splitLongLine(firstLine)) {
        if (part.trim()) {
          chunks.push({ content: part, tokenCount: countTokens(part) });
        }
      }
      i += 1;
      continue;
    }

    let chars = 0;
    let split = i + 1; // always at least one line of progress by default

    for (let j = i; j < lines.length; j++) {
      chars += (lines[j]?.length ?? 0) + 1;
      if (chars >= TARGET_CHARS) {
        split = findSplitLine(lines, i, j);
        break;
      }
      split = j + 1;
    }

    // Guaranteed forward progress no matter what findSplitLine returns.
    split = Math.max(split, i + 1);

    const chunkLines = lines.slice(i, split);
    const chunkText = chunkLines.join("\n").trim();
    if (chunkText) {
      chunks.push({ content: chunkText, tokenCount: countTokens(chunkText) });
    }

    // Step back a little for overlap, but never past i — must always move forward overall.
    let overlapChars = 0;
    let overlapStart = split;
    for (let j = split - 1; j > i && j >= split - 20; j--) {
      const line = lines[j] ?? "";
      overlapChars += line.length + 1;
      if (overlapChars >= OVERLAP_CHARS) {
        overlapStart = j;
        break;
      }
    }
    i = Math.max(overlapStart, i + 1);
  }

  return chunks;
}

interface ChunkRecord {
  repositoryId: string;
  fileId: string;
  chunkIndex: number;
  content: string;
  tokenCount: number;
}

export async function chunkRepository(
  repoId: string,
  files: SourceFile[],
  // Optional: pass already-read file contents (e.g. from repository.processor.ts)
  // to avoid reading every file from disk a second time.
  fileContents?: Map<string, string>,
): Promise<number> {
  const dbFiles = await prisma.file.findMany({
    where: { repositoryId: repoId },
    select: { id: true, path: true },
  });
  const pathToDbFile = new Map(dbFiles.map((f) => [f.path, f.id]));

  const limit = pLimit(READ_CONCURRENCY);
  const allRecords: ChunkRecord[] = [];

  await Promise.all(
    files.map((file) =>
      limit(async () => {
        const dbFileId = pathToDbFile.get(file.relativePath);
        if (!dbFileId) return;

        const content =
          fileContents?.get(file.relativePath) ??
          (await fs.readFile(file.absolutePath, "utf-8"));

        const chunks = chunkContent(content);
        chunks.forEach((chunk, idx) => {
          allRecords.push({
            repositoryId: repoId,
            fileId: dbFileId,
            chunkIndex: idx,
            content: chunk.content,
            tokenCount: chunk.tokenCount,
          });
        });
      }),
    ),
  );

  for (let i = 0; i < allRecords.length; i += INSERT_BATCH_SIZE) {
    const batch = allRecords.slice(i, i + INSERT_BATCH_SIZE);
    await prisma.chunk.createMany({ data: batch });
  }

  return allRecords.length;
}