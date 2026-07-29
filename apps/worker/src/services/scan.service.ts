import fg from "fast-glob";
import fs from "node:fs/promises";
import path from "node:path";

export interface SourceFile {
  absolutePath: string;
  relativePath: string;
  extension: string;
  size: number;
}

const ignored = [
  "**/node_modules/**",
  "**/.git/**",
  "**/.next/**",
  "**/dist/**",
  "**/build/**",
  "**/coverage/**",
  "**/target/**",
  "**/.turbo/**",
];

const supportedExtensions = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".py",
  ".go",
  ".java",
  ".rs",
  ".md",
  ".json",
  ".yaml",
  ".yml",
]);

export async function scanRepository(root: string) {
  const files = await fg("**/*", {
    cwd: root,
    onlyFiles: true,
    absolute: true,
    ignore: ignored,
  });

  const result: SourceFile[] = [];

  for (const file of files) {
    const stat = await fs.stat(file);

    if (!supportedExtensions.has(path.extname(file))) {
      continue;
    }

    result.push({
      absolutePath: file,
      relativePath: path.relative(root, file),
      extension: path.extname(file),
      size: stat.size,
    });
  }

  return result;
}
