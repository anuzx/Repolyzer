import path from "node:path";
import { complete } from "@repo/ai";
import { nodeKey, esc } from "./graph.service";
import type { KnowledgeGraph } from "./types";
import type { SourceFile } from "./scan.service";

/**
 * Produces a "how do backend/frontend/workers/infra actually talk to each other"
 * system diagram — as opposed to graph.service.ts's buildArchitecture(), which
 * diagrams files grouped by folder-name layer and connected by import edges.
 *
 * That file-level diagram is fundamentally a different, smaller kind of graph:
 * its nodes can only ever be files that exist in the repo, and its edges can
 * only ever be `import` statements between them. A system diagram needs nodes
 * that often have zero AST footprint (Client, Kubernetes pod pool, "7 runner
 * pods") and edges that are runtime relationships (a BullMQ queue push), not
 * static imports. So instead of trying to force buildArchitecture() to produce
 * this, we:
 *
 *   1. Deterministically aggregate files into services (by package.json) and
 *      detect infra usage from each service's dependencies — this is real
 *      evidence, not a guess.
 *   2. Collapse file-level `imports` edges into service-to-service edges.
 *   3. Hand that compact, evidence-only summary to an LLM and ask it to draw
 *      the system diagram a human would draw — including standard external
 *      actors (a Client hitting an HTTP-facing service) that no AST node will
 *      ever represent.
 *   4. Fall back to a deterministic diagram (services + detected infra only,
 *      no invented actors) if the LLM call fails or returns something invalid.
 */

export interface ServiceNode {
  id: string;
  name: string;
  dir: string;
  fileCount: number;
  dependencies: string[];
  hasHttpServer: boolean;
}

interface InfraMatch {
  label: string;
  kind: "database" | "cache" | "queue" | "storage" | "messaging" | "search";
}

interface InfraSignature {
  pattern: RegExp;
  label: string;
  kind: InfraMatch["kind"];
}

// Dependency-name (npm package or Python top-level import) -> infra it implies.
// Deliberately conservative: only things we can point to concrete evidence for.
const INFRA_SIGNATURES: InfraSignature[] = [
  { pattern: /^(bullmq)$/, label: "Redis Queue (BullMQ)", kind: "queue" },
  { pattern: /^(ioredis|redis)$/, label: "Redis", kind: "cache" },
  { pattern: /^(@prisma\/client|prisma)$/, label: "Postgres (Prisma)", kind: "database" },
  { pattern: /^(pg|psycopg2|psycopg2-binary|asyncpg)$/, label: "Postgres", kind: "database" },
  { pattern: /^(mongoose|mongodb|pymongo)$/, label: "MongoDB", kind: "database" },
  { pattern: /^(mysql|mysql2|pymysql)$/, label: "MySQL", kind: "database" },
  { pattern: /^(kafkajs|confluent-kafka|kafka-python)$/, label: "Kafka", kind: "messaging" },
  { pattern: /^(amqplib|pika|celery)$/, label: "Message Queue (AMQP)", kind: "messaging" },
  { pattern: /^(@aws-sdk\/client-s3|aws-sdk|boto3)$/, label: "S3", kind: "storage" },
  { pattern: /^(@elastic\/elasticsearch|elasticsearch)$/, label: "Elasticsearch", kind: "search" },
  { pattern: /^(algoliasearch)$/, label: "Algolia", kind: "search" },
  { pattern: /^(@kubernetes\/client-node|kubernetes)$/, label: "Kubernetes API", kind: "messaging" },
];

const HTTP_SERVER_DEPS =
  /^(express|fastify|koa|@nestjs\/core|next|django|flask|fastapi|hapi)$/;

function detectInfra(dependencies: string[]): InfraMatch[] {
  const found = new Map<string, InfraMatch>();
  for (const dep of dependencies) {
    for (const sig of INFRA_SIGNATURES) {
      if (sig.pattern.test(dep)) found.set(sig.label, { label: sig.label, kind: sig.kind });
    }
  }
  return [...found.values()];
}

function discoverServices(
  files: SourceFile[],
  fileContents: Map<string, string>,
): ServiceNode[] {
  const pkgFiles = files.filter((f) => path.basename(f.relativePath) === "package.json");

  const services: ServiceNode[] = [];
  for (const pkg of pkgFiles) {
    const content = fileContents.get(pkg.relativePath);
    if (!content) continue;

    let parsed: { name?: string; workspaces?: unknown; dependencies?: Record<string, string>; devDependencies?: Record<string, string> };
    try {
      parsed = JSON.parse(content);
    } catch {
      continue;
    }

    // A workspace-root manifest ("workspaces": [...]) describes the monorepo,
    // not a deployable service — skip it so we don't get a phantom "root" node.
    if (parsed.workspaces) continue;

    const dir = path.dirname(pkg.relativePath);
    const deps = Object.keys({ ...(parsed.dependencies ?? {}), ...(parsed.devDependencies ?? {}) });

    services.push({
      id: dir === "." ? "root" : dir,
      name: parsed.name || (dir === "." ? "root" : dir.split("/").pop()!),
      dir: dir === "." ? "" : dir,
      fileCount: 0,
      dependencies: deps,
      hasHttpServer: deps.some((d) => HTTP_SERVER_DEPS.test(d)),
    });
  }

  if (services.length === 0) {
    // No package.json anywhere (e.g. a pure-Python repo, or a single package
    // with no manifest) — treat the whole repo as one service. Infra evidence
    // for it still comes from externalImports collected on file nodes below.
    return [{ id: "root", name: "root", dir: "", fileCount: 0, dependencies: [], hasHttpServer: false }];
  }

  return services;
}

function assignFileToService(filePath: string, services: ServiceNode[]): ServiceNode {
  let best: ServiceNode | null = null;
  for (const svc of services) {
    if (svc.dir === "" || filePath === svc.dir || filePath.startsWith(svc.dir + "/")) {
      if (!best || svc.dir.length > best.dir.length) best = svc;
    }
  }
  return best ?? services[0]!;
}

function populateServicesFromGraph(
  graph: KnowledgeGraph,
  services: ServiceNode[],
): void {
  for (const n of graph.nodes) {
    if (n.type !== "file") continue;
    const svc = assignFileToService(n.filePath, services);
    svc.fileCount++;

    const externalImports = (n.metadata.externalImports as string[] | undefined) ?? [];
    for (const imp of externalImports) {
      if (!svc.dependencies.includes(imp)) svc.dependencies.push(imp);
    }
  }
}

function buildServiceEdges(
  graph: KnowledgeGraph,
  services: ServiceNode[],
): { source: string; target: string }[] {
  const fileToService = new Map<string, string>();
  for (const n of graph.nodes) {
    if (n.type !== "file") continue;
    fileToService.set(n.filePath, assignFileToService(n.filePath, services).id);
  }

  const seen = new Set<string>();
  const edges: { source: string; target: string }[] = [];

  for (const e of graph.edges) {
    if (e.type !== "imports") continue;
    const s = fileToService.get(e.source);
    const t = fileToService.get(e.target);
    if (!s || !t || s === t) continue;

    const key = `${s}->${t}`;
    if (seen.has(key)) continue;
    seen.add(key);
    edges.push({ source: s, target: t });
  }

  return edges;
}

function safeId(raw: string): string {
  return nodeKey(raw);
}

function buildFallbackDiagram(
  services: ServiceNode[],
  infraByService: Map<string, InfraMatch[]>,
  serviceEdges: { source: string; target: string }[],
): string {
  const lines = ["flowchart LR"];

  for (const svc of services) {
    const sid = safeId(svc.id);
    lines.push(`  ${sid}["${esc(svc.name)}"]`);
    if (svc.hasHttpServer) {
      lines.push(`  Client["Client"] --> ${sid}`);
    }
    for (const infra of infraByService.get(svc.id) ?? []) {
      const iid = safeId(svc.id + "::" + infra.label);
      lines.push(`  ${iid}[("${esc(infra.label)}")]`);
      lines.push(`  ${sid} --> ${iid}`);
    }
  }

  for (const e of serviceEdges) {
    lines.push(`  ${safeId(e.source)} --> ${safeId(e.target)}`);
  }

  return lines.join("\n");
}

function sanitizeMermaid(raw: string): string {
  return raw
    .replace(/```mermaid/gi, "")
    .replace(/```/g, "")
    .trim();
}

function isValidFlowchart(mermaid: string): boolean {
  if (!mermaid) return false;
  const first = mermaid.trim().split("\n")[0]?.trim().toLowerCase() ?? "";
  if (!first.startsWith("flowchart") && !first.startsWith("graph")) return false;
  return mermaid.includes("-->");
}

interface RepoMeta {
  owner: string;
  name: string;
  description: string | null;
}

export async function generateSystemArchitecture(
  graph: KnowledgeGraph,
  files: SourceFile[],
  fileContents: Map<string, string>,
  repo: RepoMeta,
): Promise<string> {
  const services = discoverServices(files, fileContents);
  populateServicesFromGraph(graph, services);

  const infraByService = new Map<string, InfraMatch[]>();
  for (const svc of services) {
    infraByService.set(svc.id, detectInfra(svc.dependencies));
  }

  const serviceEdges = buildServiceEdges(graph, services);
  const fallback = buildFallbackDiagram(services, infraByService, serviceEdges);

  // Nothing to reason about beyond one bare service with no infra/edges —
  // don't bother calling the LLM, the fallback already is the whole picture.
  const hasSignal =
    services.length > 1 ||
    serviceEdges.length > 0 ||
    [...infraByService.values()].some((v) => v.length > 0);
  if (!hasSignal) return fallback;

  const payload = {
    repository: `${repo.owner}/${repo.name}`,
    description: repo.description,
    services: services.map((s) => ({
      name: s.name,
      fileCount: s.fileCount,
      exposesHttp: s.hasHttpServer,
      detectedInfrastructure: (infraByService.get(s.id) ?? []).map((i) => i.label),
    })),
    interServiceDependencies: serviceEdges.map((e) => {
      const from = services.find((s) => s.id === e.source)?.name ?? e.source;
      const to = services.find((s) => s.id === e.target)?.name ?? e.target;
      return `${from} -> ${to}`;
    }),
  };

  const system = [
    "You are a system-architecture diagrammer.",
    "You are given evidence extracted from static analysis of a repository:",
    "which deployable services it contains, which infrastructure each service's",
    "dependencies indicate it talks to, whether a service exposes an HTTP API,",
    "and which services import from which other services.",
    "",
    "Produce ONE mermaid flowchart (start with `flowchart LR`) showing how the",
    "system fits together at runtime — the way an engineer would draw it on a",
    "whiteboard for a system-design discussion, not a file/folder diagram.",
    "",
    "Rules:",
    "- Only add a Client/Browser node pointing at a service if exposesHttp is true for it.",
    "- Only add infrastructure nodes that appear in detectedInfrastructure — never invent",
    "  a database, queue, or third-party system that isn't evidenced.",
    "- Use interServiceDependencies for the edges between services.",
    "- Keep node labels short (2-4 words). Use subgraphs only if it clarifies grouping.",
    "- Output ONLY the mermaid code, no explanation, no markdown fences.",
  ].join("\n");

  const prompt = `Evidence:\n${JSON.stringify(payload, null, 2)}\n\nGenerate the flowchart.`;

  let mermaid = "";
  try {
    const raw = await complete(prompt, system);
    mermaid = sanitizeMermaid(raw);
  } catch {
    mermaid = "";
  }

  return isValidFlowchart(mermaid) ? mermaid : fallback;
}