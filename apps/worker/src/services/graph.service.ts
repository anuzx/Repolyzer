import type {
  KnowledgeGraph,
  GraphNode,
  MermaidOutput,
  ArchitectureLayer,
} from "./types";

const LAYER_LABELS: Record<ArchitectureLayer, string> = {
  presentation: "Presentation Layer (UI)",
  api: "API Layer (Routes & Endpoints)",
  controller: "Controller Layer (Request Handlers)",
  service: "Service Layer (Business Logic)",
  "data-access": "Data Access Layer (Database & ORM)",
  infrastructure: "Infrastructure (Workers & Queues)",
  shared: "Shared Layer (Utils & Types)",
  unknown: "Other Files",
};

export async function generateMermaid(
  graph: KnowledgeGraph,
): Promise<MermaidOutput> {
  return {
    architecture: buildArchitecture(graph),
    flowchart: buildFlowchart(graph),
    classDiagram: buildClassDiagram(graph),
  };
}

export function nodeKey(path: string): string {
  let hash = 5381;
  for (let i = 0; i < path.length; i++) {
    hash = ((hash << 5) + hash + path.charCodeAt(i)) | 0;
  }
  return "n" + Math.abs(hash).toString(36);
}

function clsKey(name: string): string {
  return "c" + name.replace(/[^a-zA-Z0-9]/g, "_");
}

export function esc(value: string): string {
  return value
    .replace(/"/g, "#quot;")
    .replace(/\[/g, "&#91;")
    .replace(/\]/g, "&#93;")
    .replace(/\(/g, "&#40;")
    .replace(/\)/g, "&#41;")
    .replace(/\{/g, "&#123;")
    .replace(/\}/g, "&#125;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function simplifyType(raw: string | undefined | null): string {
  if (!raw) return "";
  let t = raw
    .replace(/import\([^)]+\)\./g, "")
    .replace(/import\([^)]+\)/g, "any");
  if (t.includes("{") || t.includes("}") || t.includes("=>")) {
    t = "object";
  }
  return t;
}

function topDir(filePath: string): string {
  const i = filePath.indexOf("/");
  return i > 0 ? filePath.slice(0, i) : "root";
}

function buildArchitecture(graph: KnowledgeGraph): string {
  const layerFiles = new Map<ArchitectureLayer, GraphNode[]>();
  for (const node of graph.nodes) {
    if (node.type !== "file") continue;
    const l = node.layer || "unknown";
    if (!layerFiles.has(l)) layerFiles.set(l, []);
    layerFiles.get(l)!.push(node);
  }

  if (layerFiles.size === 0) return "";

  const nodeId = new Map<string, string>();
  const seen = new Set<string>();

  const order: ArchitectureLayer[] = [
    "presentation",
    "api",
    "controller",
    "service",
    "data-access",
    "infrastructure",
    "shared",
    "unknown",
  ];

  const present = order.filter((l) => layerFiles.has(l));

  const lines: string[] = ["graph TB"];

  for (const layer of present) {
    const files = layerFiles.get(layer)!;
    const lid = nodeKey("layer_" + layer);
    lines.push(`  subgraph ${lid}["${LAYER_LABELS[layer]}"]`);
    for (const f of files) {
      const kid = nodeKey(f.id);
      nodeId.set(f.id, kid);
      const shortName = f.name.split("/").pop() || f.name;
      lines.push(`    ${kid}["${esc(shortName)}"]`);
    }
    lines.push("  end");
  }

  for (const edge of graph.edges) {
    if (edge.type !== "imports") continue;
    const src = nodeId.get(edge.source);
    const tgt = nodeId.get(edge.target);
    if (!src || !tgt) continue;

    const srcFile = graph.nodes.find((n) => n.id === edge.source && n.type === "file");
    const tgtFile = graph.nodes.find((n) => n.id === edge.target && n.type === "file");
    if (!srcFile || !tgtFile) continue;
    if (srcFile.layer === tgtFile.layer) continue;

    const pair = `${src}->${tgt}`;
    if (seen.has(pair)) continue;
    seen.add(pair);
    lines.push(`  ${src} --> ${tgt}`);
  }

  if (seen.size === 0 && present.length > 1) {
    // Show layers without edges — just list them as disconnected subgraphs
    // so at least something renders
  }

  return lines.join("\n");
}

function buildFlowchart(graph: KnowledgeGraph): string {
  const fileNodes = graph.nodes.filter((n) => n.type === "file");
  if (fileNodes.length === 0) return "";

  const dirFiles = new Map<string, GraphNode[]>();
  for (const node of fileNodes) {
    const d = topDir(node.filePath);
    if (!dirFiles.has(d)) dirFiles.set(d, []);
    dirFiles.get(d)!.push(node);
  }

  const nodeId = new Map<string, string>();
  const lines: string[] = ["graph TD"];

  const solo: GraphNode[] = [];
  for (const [dir, files] of dirFiles) {
    if (files.length > 1) {
      const did = nodeKey("dir_" + dir);
      lines.push(`  subgraph ${did}["${esc(dir)}"]`);
      for (const f of files) {
        const kid = nodeKey(f.id);
        nodeId.set(f.id, kid);
        lines.push(`    ${kid}["${esc(f.filePath)}"]`);
      }
      lines.push("  end");
    } else if (files[0]) {
      solo.push(files[0]);
    }
  }

  for (const f of solo) {
    const kid = nodeKey(f.id);
    nodeId.set(f.id, kid);
    lines.push(`  ${kid}["${esc(f.filePath)}"]`);
  }

  for (const edge of graph.edges) {
    if (edge.type !== "imports") continue;
    const src = nodeId.get(edge.source);
    const tgt = nodeId.get(edge.target);
    if (src && tgt) {
      lines.push(`  ${src} --> ${tgt}`);
    }
  }

  return lines.join("\n");
}

function buildClassDiagram(graph: KnowledgeGraph): string {
  const named = graph.nodes.filter(
    (n) => n.type === "class" || n.type === "interface",
  );
  if (named.length === 0) return "";

  const lines: string[] = ["classDiagram"];
  const nodeByName = new Map<string, GraphNode>();

  for (const node of named) {
    nodeByName.set(node.name, node);
    const cid = clsKey(node.name);

    if (node.type === "interface") {
      lines.push(`  class ${cid}<<interface>> {`);
      const props = (node.metadata.properties as
        | Array<{ name: string; type: string }>
        | undefined) || [];
      for (const p of props) {
        lines.push(`    +${esc(p.name)}: ${simplifyType(p.type)}`);
      }
      lines.push("  }");
    } else {
      lines.push(`  class ${cid} {`);
      const props = (node.metadata.properties as
        | Array<{ name: string; isPrivate: boolean; isStatic: boolean; type: string }>
        | undefined) || [];
      for (const p of props) {
        const vis = p.isPrivate ? "-" : "+";
        const mod = p.isStatic ? "{static} " : "";
        lines.push(`    ${mod}${vis}${esc(p.name)}: ${simplifyType(p.type)}`);
      }
      const methods = (node.metadata.methods as
        | Array<{ name: string; isPrivate: boolean; isStatic: boolean; isAsync: boolean; returnType: string }>
        | undefined) || [];
      for (const m of methods) {
        const vis = m.isPrivate ? "-" : "+";
        const mod = m.isStatic ? "{static} " : "";
        const ret = m.returnType !== "void" ? `: ${simplifyType(m.returnType)}` : "";
        lines.push(`    ${mod}${vis}${esc(m.name)}()${ret}`);
      }
      lines.push("  }");
    }
  }

  for (const edge of graph.edges) {
    if (edge.type === "extends") {
      const srcName = edge.source.split("::").pop();
      const tgtName = edge.target;
      const src = srcName ? nodeByName.get(srcName) : undefined;
      const tgt = nodeByName.get(tgtName);
      if (src && tgt) {
        lines.push(`  ${clsKey(src.name)} --|> ${clsKey(tgt.name)}`);
      }
    }
    if (edge.type === "implements") {
      const srcName = edge.source.split("::").pop();
      const tgtName = edge.target;
      const src = srcName ? nodeByName.get(srcName) : undefined;
      const tgt = nodeByName.get(tgtName);
      if (src && tgt) {
        lines.push(`  ${clsKey(src.name)} ..|> ${clsKey(tgt.name)}`);
      }
    }
  }

  return lines.join("\n");
}