"use client";

import { useMemo, useState } from "react";
import { FiCopy, FiCheck, FiFolder, FiFile } from "react-icons/fi";

interface FileEntry {
  path: string;
  extension: string | null;
  summary: string | null;
}

interface FileTreeNode {
  name: string;
  path: string;
  isDir: boolean;
  extension: string | null;
  summary: string | null;
  children: Map<string, FileTreeNode>;
}

function buildFileTree(files: FileEntry[]): FileTreeNode {
  const root: FileTreeNode = {
    name: "",
    path: "",
    isDir: true,
    extension: null,
    summary: null,
    children: new Map(),
  };

  for (const f of files) {
    const parts = f.path.split("/").filter(Boolean);
    let node = root;
    let acc = "";
    parts.forEach((part, i) => {
      acc = acc ? `${acc}/${part}` : part;
      const isLast = i === parts.length - 1;
      let child = node.children.get(part);
      if (!child) {
        child = {
          name: part,
          path: acc,
          isDir: !isLast,
          extension: isLast ? f.extension : null,
          summary: isLast ? f.summary : null,
          children: new Map(),
        };
        node.children.set(part, child);
      }
      node = child;
    });
  }
  return root;
}

function sortedChildren(node: FileTreeNode): FileTreeNode[] {
  return Array.from(node.children.values()).sort((a, b) => {
    if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

// Lightweight heuristic description generator. There's no backend field for
// per-file summaries yet, so this infers a plausible one-liner purely from
// the filename / extension / path — good enough for a quick skim, not meant
// to replace a real AI-generated description.
const EXACT_NAME_HINTS: Record<string, string> = {
  "package.json": "npm package manifest — dependencies & scripts",
  "package-lock.json": "Locked npm dependency versions",
  "pnpm-lock.yaml": "Locked pnpm dependency versions",
  "yarn.lock": "Locked yarn dependency versions",
  "tsconfig.json": "TypeScript compiler configuration",
  "next.config.js": "Next.js build/runtime configuration",
  "next.config.ts": "Next.js build/runtime configuration",
  "tailwind.config.js": "Tailwind CSS configuration",
  "tailwind.config.ts": "Tailwind CSS configuration",
  "postcss.config.js": "PostCSS configuration",
  ".gitignore": "Files/paths excluded from git",
  ".env": "Environment variables (local, untracked)",
  ".env.example": "Template for required environment variables",
  "README.md": "Project overview & usage docs",
  "LICENSE": "Project license",
  "Dockerfile": "Container build instructions",
  "docker-compose.yml": "Multi-container orchestration config",
  "vercel.json": "Vercel deployment configuration",
  "vite.config.ts": "Vite build configuration",
  "eslint.config.js": "ESLint linting rules",
  ".eslintrc.json": "ESLint linting rules",
  "jest.config.js": "Jest test runner configuration",
};

function describeFile(node: FileTreeNode): string {
  const hint = EXACT_NAME_HINTS[node.name];
  if (hint) return hint;

  const lower = node.path.toLowerCase();
  const ext = (node.extension || "").toLowerCase();

  if (/\.(test|spec)\.[jt]sx?$/.test(node.name)) return "Test file";
  if (lower.includes("/api/") || lower.startsWith("api/"))
    return "API route handler";
  if (lower.includes("/hooks/") || node.name.startsWith("use"))
    return "Custom React hook";
  if (lower.includes("/components/")) return "UI component";
  if (lower.includes("/lib/") || lower.includes("/utils/"))
    return "Shared utility module";
  if (lower.includes("/styles/") || ext === "css")
    return "Stylesheet";
  if (lower.includes("/middleware")) return "Request middleware";
  if (lower.includes("/schema") || lower.includes("/prisma"))
    return "Database schema definition";

  switch (ext) {
    case "tsx":
    case "jsx":
      return "React component";
    case "ts":
      return "TypeScript module";
    case "js":
    case "mjs":
    case "cjs":
      return "JavaScript module";
    case "json":
      return "Configuration / data file";
    case "md":
    case "mdx":
      return "Documentation";
    case "py":
      return "Python script";
    case "sql":
      return "SQL script / migration";
    case "yml":
    case "yaml":
      return "YAML configuration";
    case "svg":
      return "Vector image asset";
    case "png":
    case "jpg":
    case "jpeg":
    case "gif":
    case "webp":
      return "Image asset";
    case "html":
      return "HTML markup";
    case "sh":
      return "Shell script";
    default:
      return "";
  }
}

function CopyPathButton({ path, className = "" }: { path: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        navigator.clipboard.writeText(path).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1200);
        });
      }}
      title={copied ? "Copied" : "Copy path"}
      className={`opacity-0 group-hover:opacity-100 flex items-center justify-center w-5 h-5 rounded text-neutral-600 hover:text-white hover:bg-neutral-800 transition-colors shrink-0 ${className}`}
    >
      {copied ? (
        <FiCheck className="w-3 h-3" />
      ) : (
        <FiCopy className="w-3 h-3" />
      )}
    </button>
  );
}

function FileTreeRow({
  node,
  prefix,
  isLast,
}: {
  node: FileTreeNode;
  prefix: string;
  isLast: boolean;
}) {
  const children = sortedChildren(node);
  const connector = isLast ? "└── " : "├── ";
  const childPrefix = prefix + (isLast ? "    " : "│   ");
  const description = !node.isDir ? (node.summary ?? describeFile(node)) : "";

  return (
    <div>
      <div
        className="group flex items-start gap-2 text-xs leading-6 hover:bg-neutral-900/60 rounded px-1 -mx-1 min-w-0"
        style={{ fontFamily: "var(--font-mono)" }}
        title={`${node.path}${description ? ` — ${description}` : ""}`}
      >
        <span className="text-neutral-700 shrink-0 whitespace-pre">
          {prefix}
          {connector}
        </span>
        {node.isDir ? (
          <FiFolder className="w-3 h-3 text-neutral-400 shrink-0 mt-1.5" />
        ) : (
          <FiFile className="w-3 h-3 text-neutral-600 shrink-0 mt-1.5" />
        )}
        <span className={`flex-1 min-w-0 break-words whitespace-normal ${node.isDir ? "text-neutral-200" : "text-neutral-400"}`}>
          {node.name}
          {node.isDir ? "/" : ""}
          {description && (
            <span className="text-neutral-600 ml-1 break-words">
              # {description}
            </span>
          )}
        </span>
        {!node.isDir && <CopyPathButton path={node.path} className="mt-1" />}
      </div>
      {children.map((child, i) => (
        <FileTreeRow
          key={child.path}
          node={child}
          prefix={childPrefix}
          isLast={i === children.length - 1}
        />
      ))}
    </div>
  );
}

export function FilesView({ files }: { files: FileEntry[] }) {
  const [filter, setFilter] = useState("");

  const filteredFiles = useMemo(() => {
    if (!filter.trim()) return files;
    const q = filter.toLowerCase();
    return files.filter((f) => f.path.toLowerCase().includes(q));
  }, [files, filter]);

  const root = useMemo(() => buildFileTree(filteredFiles), [filteredFiles]);
  const children = useMemo(() => sortedChildren(root), [root]);

  if (files.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-neutral-600 text-sm">
        No files
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 min-w-0">
      {/* Toolbar */}
      <div className="sticky top-0 z-10 flex items-center gap-2 px-4 py-2 bg-black/90 backdrop-blur-sm border-b border-neutral-900 shrink-0">
        <span
          className="text-xs text-neutral-500 uppercase tracking-wide shrink-0"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          Files
        </span>
        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter files…"
          className="ml-2 flex-1 max-w-xs px-3 py-1.5 rounded-md bg-neutral-900/60 border border-neutral-800 text-xs text-white placeholder-neutral-600 focus:outline-none focus:ring-1 focus:ring-neutral-500 focus:border-neutral-600 transition-colors"
          style={{ fontFamily: "var(--font-mono)" }}
        />
        <span
          className="ml-auto text-[11px] text-neutral-600 shrink-0"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          {filteredFiles.length} file{filteredFiles.length === 1 ? "" : "s"}
        </span>
      </div>

      {/* Tree */}
      <div
        className="flex-1 min-h-0 min-w-0 overflow-y-auto overflow-x-hidden p-4 no-scrollbar"
        style={{
          scrollbarWidth: "none",
          msOverflowStyle: "none",
          scrollBehavior: "smooth",
        }}
      >
        {children.length === 0 ? (
          <p className="text-xs text-neutral-700 px-2">No matching files</p>
        ) : (
          children.map((child, i) => (
            <FileTreeRow
              key={child.path}
              node={child}
              prefix=""
              isLast={i === children.length - 1}
            />
          ))
        )}
      </div>
      <style jsx>{`
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
      `}</style>
    </div>
  );
}