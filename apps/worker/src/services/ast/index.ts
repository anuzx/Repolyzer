import type { SourceFile } from "../scan.service";
import type { KnowledgeGraph } from "../types";
import { buildTsKnowledgeGraph } from "./ts_ast.service";
import { buildPyKnowledgeGraph } from "./py_ast.service";

const TS_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx"]);
const PY_EXTENSION = ".py";

export async function buildKnowledgeGraph(
  files: SourceFile[],
): Promise<KnowledgeGraph> {
  const tsFiles = files.filter((f) => TS_EXTENSIONS.has(f.extension));
  const pyFiles = files.filter((f) => f.extension === PY_EXTENSION);
  const otherFiles = files.filter(
    (f) => !TS_EXTENSIONS.has(f.extension) && f.extension !== PY_EXTENSION,
  );

  const tsResult = buildTsKnowledgeGraph([...tsFiles, ...otherFiles]);

  const pyResult = await buildPyKnowledgeGraph(pyFiles);

  return {
    nodes: [...tsResult.nodes, ...pyResult.nodes],
    edges: [...tsResult.edges, ...pyResult.edges],
  };
}
