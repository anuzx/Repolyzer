import fs from "node:fs/promises";

export async function deleteTempDirectory(directory: string) {
  await fs.rm(directory, {
    recursive: true,
    force: true,
  });
}
