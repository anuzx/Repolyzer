import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { SourceFile } from "../scan.service";
import type {
  KnowledgeGraph,
  GraphNode,
  GraphEdge,
  ArchitectureLayer,
} from "../types";

const PY_EXTENSION = ".py";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const PYTHON_SCRIPT = path.join(SCRIPT_DIR, "py_ast.py");

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

export async function buildPyKnowledgeGraph(
  files: SourceFile[],
): Promise<KnowledgeGraph> {
  const graph: KnowledgeGraph = { nodes: [], edges: [] };

  const pyFiles = files.filter((f) => f.extension === PY_EXTENSION);
  if (pyFiles.length === 0) {
    for (const file of files) {
      graph.nodes.push(
        node("file", file.relativePath, file.relativePath, classifyByPath(file.relativePath), {
          extension: file.extension,
          size: file.size,
        }),
      );
    }
    return graph;
  }

  const absToRel = new Map<string, string>();
  const absPaths = new Set<string>();
  for (const f of files) {
    absToRel.set(f.absolutePath, f.relativePath);
    absPaths.add(f.absolutePath);
  }

  const pythonBin = process.env.PYTHON_BIN || "python3";

  let rawResult: string;
  try {
    rawResult = await spawnPython(pythonBin, pyFiles);
  } catch {
    for (const file of pyFiles) {
      graph.nodes.push(
        node("file", file.relativePath, file.relativePath, classifyByPath(file.relativePath), {
          extension: file.extension,
          size: file.size,
        }),
      );
    }
    return graph;
  }

  let parsed: PythonOutput;
  try {
    parsed = JSON.parse(rawResult) as PythonOutput;
  } catch {
    for (const file of pyFiles) {
      graph.nodes.push(
        node("file", file.relativePath, file.relativePath, classifyByPath(file.relativePath), {
          extension: file.extension,
          size: file.size,
        }),
      );
    }
    return graph;
  }

  if (parsed.error) {
    for (const file of pyFiles) {
      graph.nodes.push(
        node("file", file.relativePath, file.relativePath, classifyByPath(file.relativePath), {
          extension: file.extension,
          size: file.size,
        }),
      );
    }
    return graph;
  }

  for (const file of pyFiles) {
    const fileData = parsed.files?.[file.relativePath];
    if (!fileData) {
      graph.nodes.push(
        node("file", file.relativePath, file.relativePath, classifyByPath(file.relativePath), {
          extension: file.extension,
          size: file.size,
        }),
      );
      continue;
    }

    const layer = classifyByPath(file.relativePath);

    graph.nodes.push(
      node("file", file.relativePath, file.relativePath, layer, {
        extension: file.extension,
        size: file.size,
        summary: fileData.summary,
      }),
    );

    for (const pyNode of fileData.nodes) {
      pyNode.layer = layer;
      graph.nodes.push(pyNode as unknown as GraphNode);
    }

    for (const pyEdge of fileData.edges) {
      graph.edges.push(pyEdge as unknown as GraphEdge);
    }

    for (const imp of fileData.imports) {
      const resolved = resolvePyImport(imp.module, file.absolutePath, absPaths, absToRel);
      if (resolved) {
        graph.edges.push(edge(file.relativePath, resolved, "imports"));
      }
    }
  }

  return graph;
}

function spawnPython(
  pythonBin: string,
  files: SourceFile[],
): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn(pythonBin, [PYTHON_SCRIPT], {
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString();
    });

    proc.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    proc.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`Python script exited with code ${code}: ${stderr}`));
      } else {
        resolve(stdout);
      }
    });

    proc.on("error", (err) => {
      reject(new Error(`Failed to spawn Python: ${err.message}`));
    });

    const input = JSON.stringify({
      files: files.map((f) => ({
        absolutePath: f.absolutePath,
        relativePath: f.relativePath,
      })),
    });

    proc.stdin.write(input);
    proc.stdin.end();
  });
}

function resolvePyImport(
  module: string,
  sourceFileAbs: string,
  scannedAbs: Set<string>,
  absToRel: Map<string, string>,
): string | null {
  if (!module || module.startsWith("http") || module.startsWith("git+")) return null;

  const stdlibModules = new Set([
    "os", "sys", "re", "json", "math", "collections", "itertools", "functools",
    "pathlib", "typing", "datetime", "uuid", "hashlib", "base64", "copy",
    "abc", "enum", "dataclasses", "inspect", "textwrap", "string",
    "random", "statistics", "decimal", "fractions", "io", "types", "pickle",
    "sqlite3", "xml", "csv", "configparser", "argparse", "logging", "warnings",
    "traceback", "pprint", "tempfile", "shutil", "glob", "fnmatch", "linecache",
    "ast", "dis", "tokenize", "keyword", "token", "symtable", "builtins",
    "__future__", "gc", "sysconfig", "site", "imp", "importlib", "modulefinder",
    "runpy", "zipimport", "pkgutil", "pdb", "profile", "timeit", "unittest",
    "doctest", "subprocess", "threading", "multiprocessing", "concurrent",
    "socket", "ssl", "email", "mailbox", "mimetypes", "base64", "binascii",
    "struct", "codecs", "difflib", "unicodedata", "stringprep",
    "readline", "rlcompleter", "platform", "errno", "ctypes", "array",
    "weakref", "numbers", "secrets", "os.path",
  ]);

  if (module.startsWith(".")) {
    return resolveRelativePyImport(module, sourceFileAbs, scannedAbs, absToRel);
  }

  const topLevel = module.split(".")[0]!;
  if (stdlibModules.has(topLevel)) return null;
  if (topLevel.startsWith("_")) return null;

  return resolveAbsolutePyImport(module, sourceFileAbs, scannedAbs, absToRel);
}

function resolveRelativePyImport(
  module: string,
  sourceFileAbs: string,
  scannedAbs: Set<string>,
  absToRel: Map<string, string>,
): string | null {
  const sourceDir = path.dirname(sourceFileAbs);

  const leadingDots = module.match(/^\.+/)?.[0]?.length ?? 0;

  let resolvedDir = sourceDir;
  for (let i = 0; i < leadingDots - 1; i++) {
    resolvedDir = path.dirname(resolvedDir);
  }

  const modulePath = module.slice(leadingDots).replace(/\./g, "/");

  const exts = [".py", ".pyi", ".so", ".pyd"];

  if (modulePath) {
    const resolved = path.resolve(resolvedDir, modulePath);
    if (scannedAbs.has(resolved) && absToRel.has(resolved)) return absToRel.get(resolved)!;

    for (const ext of exts) {
      const withExt = resolved + ext;
      if (scannedAbs.has(withExt) && absToRel.has(withExt)) return absToRel.get(withExt)!;
    }

    const initPy = path.join(resolved, "__init__.py");
    if (scannedAbs.has(initPy) && absToRel.has(initPy)) return absToRel.get(initPy)!;
  } else {
    const initPy = path.join(resolvedDir, "__init__.py");
    if (scannedAbs.has(initPy) && absToRel.has(initPy)) return absToRel.get(initPy)!;
  }

  return null;
}

function resolveAbsolutePyImport(
  module: string,
  sourceFileAbs: string,
  scannedAbs: Set<string>,
  absToRel: Map<string, string>,
): string | null {
  const sourceDir = path.dirname(sourceFileAbs);

  const allPaths = Array.from(scannedAbs);

  const moduleAsPath = module.replace(/\./g, "/");

  const candidates = [
    path.resolve(sourceDir, moduleAsPath),
    path.resolve(sourceDir, moduleAsPath + ".py"),
    path.resolve(sourceDir, moduleAsPath, "__init__.py"),
  ];

  for (const candidate of candidates) {
    if (scannedAbs.has(candidate) && absToRel.has(candidate)) {
      return absToRel.get(candidate)!;
    }
  }

  for (const scanned of allPaths) {
    if (scanned.endsWith(`/${moduleAsPath}.py`) || scanned.endsWith(`/${moduleAsPath}/__init__.py`)) {
      if (absToRel.has(scanned)) return absToRel.get(scanned)!;
    }
  }

  return null;
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

interface PythonOutput {
  error?: string;
  traceback?: string;
  files?: Record<
    string,
    {
      nodes: Array<{
        id: string;
        type: string;
        name: string;
        filePath: string;
        layer: string;
        metadata: Record<string, unknown>;
      }>;
      edges: Array<{
        source: string;
        target: string;
        type: string;
      }>;
      imports: Array<{
        source: string;
        module: string;
        names: string[];
      }>;
      summary: string;
    }
  >;
}
