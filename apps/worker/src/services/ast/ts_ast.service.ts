import {
  Project,
  ScriptTarget,
  ModuleKind,
  ModuleResolutionKind,
  SyntaxKind,
} from "ts-morph";
import ts from "typescript";
import path from "node:path";
import type { SourceFile } from "../scan.service";
import type {
  KnowledgeGraph,
  GraphNode,
  GraphEdge,
  ArchitectureLayer,
} from "../types";

const TS_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx"]);

export function buildTsKnowledgeGraph(
  files: SourceFile[],
): KnowledgeGraph {
  const tsFiles = files.filter((f) => TS_EXTENSIONS.has(f.extension));
  const otherFiles = files.filter((f) => !TS_EXTENSIONS.has(f.extension));

  const graph: KnowledgeGraph = { nodes: [], edges: [] };

  const absToRel = new Map<string, string>();
  const absPaths = new Set<string>();
  for (const f of files) {
    absToRel.set(f.absolutePath, f.relativePath);
    absPaths.add(f.absolutePath);
  }

  for (const file of otherFiles) {
    graph.nodes.push(
      node("file", file.relativePath, file.relativePath, classifyByPath(file.relativePath), {
        extension: file.extension,
        size: file.size,
      }),
    );
  }

  if (tsFiles.length === 0) return graph;

  const project = new Project({
    compilerOptions: {
      target: ScriptTarget.ESNext,
      module: ModuleKind.ESNext,
      moduleResolution: ModuleResolutionKind.Bundler,
      strict: true,
      allowJs: true,
      jsx: ts.JsxEmit.Preserve,
    },
  });
  project.addSourceFilesAtPaths(tsFiles.map((f) => f.absolutePath));

  for (const file of tsFiles) {
    try {
      const sf = project.getSourceFile(file.absolutePath);
      if (!sf) continue;

      const layer = classifyLayer(sf, file.relativePath);

      const fileNode = node("file", file.relativePath, file.relativePath, layer, {
        extension: file.extension,
        size: file.size,
      });
      graph.nodes.push(fileNode);

      const exportedNames: string[] = [];
      const exportedDecls = sf.getExportedDeclarations();

      for (const cls of sf.getClasses()) {
        const n = cls.getName();
        if (!n) continue;

        const id = `${file.relativePath}::class::${n}`;
        graph.nodes.push(
          node("class", id, n, layer, {
            methods: cls.getMethods().map((m) => ({
              name: m.getName(),
              isStatic: m.isStatic(),
              isPrivate: m.hasModifier(SyntaxKind.PrivateKeyword),
              isAsync: m.isAsync(),
              returnType: m.getReturnType().getText(),
            })),
            properties: cls.getProperties().map((p) => ({
              name: p.getName(),
              isStatic: p.isStatic(),
              isPrivate: p.hasModifier(SyntaxKind.PrivateKeyword),
              type: p.getType().getText(),
            })),
          }),
        );
        graph.edges.push(edge(file.relativePath, id, "contains"));
        exportedNames.push(n);

        const ext = cls.getExtends();
        if (ext) {
          graph.edges.push(
            edge(id, ext.getExpression().getText(), "extends"),
          );
        }

        for (const impl of cls.getImplements()) {
          graph.edges.push(
            edge(id, impl.getExpression().getText(), "implements"),
          );
        }
      }

      for (const iface of sf.getInterfaces()) {
        const n = iface.getName();
        if (!n) continue;

        const id = `${file.relativePath}::interface::${n}`;
        graph.nodes.push(
          node("interface", id, n, layer, {
            properties: iface.getProperties().map((p) => ({
              name: p.getName(),
              type: p.getType().getText(),
            })),
          }),
        );
        graph.edges.push(edge(file.relativePath, id, "contains"));
        exportedNames.push(n);

        for (const ext of iface.getExtends()) {
          graph.edges.push(
            edge(id, ext.getExpression().getText(), "extends"),
          );
        }
      }

      for (const fn of sf.getFunctions()) {
        const n = fn.getName();
        if (!n) continue;

        const id = `${file.relativePath}::function::${n}`;
        graph.nodes.push(
          node("function", id, n, layer, {
            isAsync: fn.isAsync(),
            isExported: fn.isExported(),
            params: fn.getParameters().map((p) => ({
              name: p.getName(),
              type: p.getType().getText(),
            })),
            returnType: fn.getReturnType().getText(),
          }),
        );
        graph.edges.push(edge(file.relativePath, id, "contains"));
        exportedNames.push(n);
      }

      for (const [name] of exportedDecls) {
        if (!exportedNames.includes(name)) {
          exportedNames.push(name);
        }
      }

      fileNode.metadata.summary = buildSummary(exportedNames, sf);

      // Track unresolved, non-relative specifiers (i.e. real npm packages) separately
      // from internal imports. This is the evidence system-diagram.service.ts uses to
      // detect infra (Redis, Postgres, HTTP frameworks, ...) per file/service — an
      // import edge alone can't tell you a file talks to Redis, but the specifier can.
      const externalImports: string[] = [];

      for (const imp of sf.getImportDeclarations()) {
        const specifier = imp.getModuleSpecifierValue();
        const resolved = resolveImport(specifier, file.absolutePath, absPaths, absToRel);
        if (resolved) {
          graph.edges.push(edge(file.relativePath, resolved, "imports"));
        } else if (!specifier.startsWith(".") && !specifier.startsWith("/")) {
          externalImports.push(specifier);
        }
      }

      fileNode.metadata.externalImports = externalImports;
    } catch {
      if (!graph.nodes.find((n) => n.id === file.relativePath)) {
        graph.nodes.push(
          node("file", file.relativePath, file.relativePath, "unknown", {
            extension: file.extension,
            size: file.size,
          }),
        );
      }
    }
  }

  return graph;
}

function node(
  type: GraphNode["type"],
  id: string,
  name: string,
  layer: ArchitectureLayer,
  metadata: Record<string, unknown> = {},
): GraphNode {
  return { id, type, name, filePath: type === "file" ? id : "", layer, metadata };
}

function edge(source: string, target: string, type: GraphEdge["type"]): GraphEdge {
  return { source, target, type };
}

function resolveImport(
  specifier: string,
  sourceFileAbs: string,
  scannedAbs: Set<string>,
  absToRel: Map<string, string>,
): string | null {
  if (!specifier.startsWith(".") && !specifier.startsWith("/")) return null;

  const sourceDir = path.dirname(sourceFileAbs);
  const resolved = path.resolve(sourceDir, specifier);

  const exts = [".ts", ".tsx", ".js", ".jsx", ".d.ts", ".mjs", ".cjs"];

  if (scannedAbs.has(resolved) && absToRel.has(resolved)) return absToRel.get(resolved)!;

  for (const ext of exts) {
    const withExt = resolved + ext;
    if (scannedAbs.has(withExt) && absToRel.has(withExt)) return absToRel.get(withExt)!;
  }

  for (const ext of exts) {
    const index = path.join(resolved, "index" + ext);
    if (scannedAbs.has(index) && absToRel.has(index)) return absToRel.get(index)!;
  }

  return null;
}

const LAYER_BY_PATH: [RegExp, ArchitectureLayer][] = [
  [/\/components\//, "presentation"],
  [/\/routes\//, "api"],
  [/\/controllers\//, "controller"],
  [/\/services\//, "service"],
  [/\/db\//, "data-access"],
  [/\/models\//, "data-access"],
  [/\/repositories?\//, "data-access"],
  [/\/workers?\//, "infrastructure"],
  [/\/queue\//, "infrastructure"],
  [/\/utils?\//, "shared"],
  [/\/types\//, "shared"],
  [/\/config\//, "shared"],
  [/\/constants?\//, "shared"],
  [/\/helpers?\//, "shared"],
];

function classifyByPath(relativePath: string): ArchitectureLayer {
  for (const [pattern, layer] of LAYER_BY_PATH) {
    if (pattern.test(relativePath)) return layer;
  }
  return "unknown";
}

function classifyLayer(
  sf: import("ts-morph").SourceFile,
  relativePath: string,
): ArchitectureLayer {
  const pathLayer = classifyByPath(relativePath);

  if (/\.(tsx|jsx)$/.test(relativePath) && pathLayer === "unknown") {
    return "presentation";
  }

  const imports = sf.getImportDeclarations().map((d) => d.getModuleSpecifierValue());

  if (imports.some((s) => s === "react" || s.startsWith("next/"))) return "presentation";

  if (imports.some((s) => s.includes("prisma") || s === "@repo/db")) return "data-access";

  if (imports.some((s) => s.includes("bullmq") || s === "@repo/queue")) return "infrastructure";

  if (pathLayer !== "unknown") return pathLayer;

  return "shared";
}

function buildSummary(exportedNames: string[], sf: import("ts-morph").SourceFile): string {
  const parts: string[] = [];

  const classes = sf.getClasses().filter((c) => c.getName());
  if (classes.length) {
    parts.push(`Classes: ${classes.map((c) => c.getName()).join(", ")}`);
  }

  const functions = sf.getFunctions().filter((f) => f.getName());
  if (functions.length) {
    parts.push(`Functions: ${functions.map((f) => f.getName()).join(", ")}`);
  }

  const interfaces = sf.getInterfaces().filter((i) => i.getName());
  if (interfaces.length) {
    parts.push(`Interfaces: ${interfaces.map((i) => i.getName()).join(", ")}`);
  }

  const otherExports = exportedNames.filter(
    (n) =>
      !classes.some((c) => c.getName() === n) &&
      !functions.some((f) => f.getName() === n) &&
      !interfaces.some((i) => i.getName() === n),
  );
  if (otherExports.length) {
    parts.push(`Exports: ${otherExports.join(", ")}`);
  }

  return parts.join(" | ") || "No exports";
}