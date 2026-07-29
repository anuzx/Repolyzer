import { embedMany } from "@repo/ai";
import { prisma } from "@repo/db";

const BATCH_SIZE = 500;

interface UnembeddedChunk {
  id: string;
  content: string;
}

async function embedBatch(repoId: string): Promise<number> {
  // `embedding` is Unsupported("vector(1536)") in the Prisma schema, so it has
  // no generated filter type — `findMany({ where: { embedding: null } })` will
  // always throw a PrismaClientValidationError. Has to be a raw query.
  const chunks = await prisma.$queryRaw<UnembeddedChunk[]>`
    SELECT id, content
    FROM "Chunk"
    WHERE "repositoryId" = ${repoId} AND embedding IS NULL
    ORDER BY "chunkIndex" ASC
    LIMIT ${BATCH_SIZE}
  `;

  if (chunks.length === 0) return 0;

  const texts = chunks.map((c) => c.content);
  const embeddings = await embedMany(texts);

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i]!;
    const embedding = embeddings[i];
    if (!embedding) continue;

    const vectorStr = `[${embedding.join(",")}]`;

    await prisma.$executeRawUnsafe(
      `UPDATE "Chunk" SET "embedding" = $1::vector WHERE "id" = $2`,
      vectorStr,
      chunk.id,
    );
  }

  return chunks.length;
}

// Keeps pulling batches of un-embedded chunks until none are left.
export async function embedRepositoryChunks(repoId: string): Promise<number> {
  let total = 0;
  let batchCount = 0;

  do {
    batchCount = await embedBatch(repoId);
    total += batchCount;
  } while (batchCount === BATCH_SIZE);

  return total;
}