import { complete } from "@repo/ai";
import type { KnowledgeGraph } from "./types";
import type { SourceFile } from "./scan.service";

interface RepoMeta {
  owner: string;
  name: string;
  description: string | null;
  language: string | null;
  defaultBranch: string | null;
  stars: number;
  forks: number;
}

function buildFileTree(files: SourceFile[]): string {
  const tree: Record<string, string[]> = {};
  const roots = new Set<string>();

  for (const f of files) {
    const parts = f.relativePath.split("/");
    if (parts.length === 1) {
      roots.add(parts[0]!);
    } else {
      const dir = parts.slice(0, -1).join("/");
      if (!tree[dir]) tree[dir] = [];
      tree[dir]!.push(parts[parts.length - 1]!);
    }
  }

  const lines: string[] = [];
  const sortedDirs = Object.keys(tree).sort();

  const topDirs = new Set<string>();
  for (const dir of sortedDirs) {
    const top = dir.split("/")[0];
    if (top) topDirs.add(top);
  }

  for (const root of [...roots].sort()) {
    if (!topDirs.has(root)) {
      lines.push(`├── ${root}`);
    }
  }

  const added = new Set<string>();
  for (const dir of sortedDirs) {
    const depth = dir.split("/").length;
    const prefix = depth > 1 ? "│   ".repeat(depth - 1) + "├── " : "├── ";
    if (!added.has(dir)) {
      lines.push(`${prefix}${dir}/`);
      added.add(dir);
    }
    const files = tree[dir]?.sort() ?? [];
    for (const file of files) {
      lines.push(`${prefix}${"│   ".repeat(depth - 1)}    ├── ${file}`);
    }
  }

  return lines.slice(0, 150).join("\n") + (lines.length > 150 ? "\n\n  ... and more" : "");
}

function summarizeGraph(graph: KnowledgeGraph): string {
  const fileCount = graph.nodes.filter((n) => n.type === "file").length;
  const classCount = graph.nodes.filter((n) => n.type === "class").length;
  const funcCount = graph.nodes.filter((n) => n.type === "function").length;
  const ifaceCount = graph.nodes.filter((n) => n.type === "interface").length;
  const edgeCount = graph.edges.length;

  const layers = new Map<string, number>();
  for (const n of graph.nodes) {
    if (n.type === "file") {
      const l = n.layer || "unknown";
      layers.set(l, (layers.get(l) ?? 0) + 1);
    }
  }
  const layerSummary = [...layers.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([l, c]) => `  - ${l}: ${c} files`)
    .join("\n");

  const importedEdges = graph.edges.filter((e) => e.type === "imports");
  const extEdges = graph.edges.filter((e) => e.type === "extends" || e.type === "implements");

  return [
    `Files: ${fileCount}`,
    `Classes: ${classCount}`,
    `Functions: ${funcCount}`,
    `Interfaces: ${ifaceCount}`,
    `Total relationships: ${edgeCount} (${importedEdges.length} imports, ${extEdges.length} inheritance)`,
    "",
    "Architecture layers:",
    layerSummary,
  ].join("\n");
}

export async function generateSummary(
  graph: KnowledgeGraph,
  files: SourceFile[],
  repo: RepoMeta,
): Promise<string> {
  const fileTree = buildFileTree(files);
  const graphSummary = summarizeGraph(graph);

  const prompt = [
    `Analyze this GitHub repository and generate a comprehensive summary in markdown format.`,
    "",
    `## Repository`,
    `- Owner: ${repo.owner}`,
    `- Name: ${repo.name}`,
    `- Description: ${repo.description ?? "N/A"}`,
    `- Language: ${repo.language ?? "N/A"}`,
    `- Stars: ${repo.stars}`,
    `- Forks: ${repo.forks}`,
    "",
    `## Knowledge Graph Summary`,
    graphSummary,
    "",
    `## File Structure`,
    "```",
    fileTree,
    "```",
    "",
    `## Instructions`,
    `Generate a summary.md with these sections:`,
    ``,
    `1. **Project Overview** — What does this project do? What problem does it solve?`,
    `2. **What's Implemented** — Key features and functionality already built. Be specific about what exists.`,
    `3. **Tech Stack** — Languages, frameworks, databases, tools used.`,
    `4. **Project Structure** — Brief explanation of the folder/package organization.`,
    `5. **Architecture Overview** — How the system is organized (layers, data flow between components).`,
    `6. **Getting Started** — How to run the project (infer from package.json scripts, config files).`,
    ``,
    `Write in clear, concise markdown. Use the file structure and knowledge graph above as ground truth.`,
    `Don't guess or fabricate features.`,
  ].join("\n");

  const system = `You are a codebase analyst. Given a repository's knowledge graph and file structure, generate an accurate, well-structured markdown summary. Be factual and concise.`;

  return await complete(prompt, system);
}
