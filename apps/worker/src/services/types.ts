export type ArchitectureLayer =
  | 'presentation'
  | 'api'
  | 'controller'
  | 'service'
  | 'data-access'
  | 'infrastructure'
  | 'shared'
  | 'unknown';

export interface GraphNode {
  id: string;
  type: 'file' | 'class' | 'function' | 'interface' | 'type' | 'enum' | 'variable';
  name: string;
  filePath: string;
  layer: ArchitectureLayer;
  metadata: Record<string, unknown>;
}

export interface GraphEdge {
  source: string;
  target: string;
  type: 'imports' | 'exports' | 'extends' | 'implements' | 'contains' | 'calls';
}

export interface KnowledgeGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface MermaidOutput {
  architecture: string;
  flowchart: string;
  classDiagram: string;
}
