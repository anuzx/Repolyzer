import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

export async function createTempDirectory(repoId: string) {
  const root = path.join(os.tmpdir(), "repolyzer");

  await fs.mkdir(root, {
    recursive: true,
  });

  const directory = await fs.mkdtemp(path.join(root, `${repoId}-`));

  return directory;
}
