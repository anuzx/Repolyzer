"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { MermaidView } from "../../components/mermaid-view";

interface RepoDetail {
  id: string;
  owner: string;
  name: string;
  description: string | null;
  language: string | null;
  stars: number;
  forks: number;
  defaultBranch: string | null;
  status: string;
  createdAt: string;
  files: { path: string; extension: string | null }[];
  artifacts: { type: string; content: string }[];
}

type TabId = "system-architecture" | "file-dependencies" | "class-diagram";

interface NavFolder {
  label: string;
  children: { id: TabId; label: string }[];
}

interface NavLink {
  id: string;
  label: string;
}

type NavItem = NavFolder | NavLink;

const STATUS_LABEL: Record<string, string> = {
  QUEUED: "Queued",
  CLONING: "Cloning",
  PARSING: "Parsing",
  CHUNKING: "Chunking",
  EMBEDDING: "Embedding",
  COMPLETED: "Ready",
  FAILED: "Failed",
};

const STATUS_DOT: Record<string, string> = {
  QUEUED: "bg-neutral-600",
  CLONING: "bg-neutral-400 animate-pulse",
  PARSING: "bg-neutral-400 animate-pulse",
  CHUNKING: "bg-neutral-400 animate-pulse",
  EMBEDDING: "bg-neutral-400 animate-pulse",
  COMPLETED: "bg-white",
  FAILED: "bg-neutral-700",
};

const TAB_LABEL: Record<TabId, string> = {
  "system-architecture": "System Architecture",
  "file-dependencies": "File Dependencies",
  "class-diagram": "Class Diagram",
};

const TAB_DATA_KEY: Record<TabId, string> = {
  "system-architecture": "architecture",
  "file-dependencies": "flowchart",
  "class-diagram": "classDiagram",
};

function isFolder(item: NavItem): item is NavFolder {
  return "children" in item;
}

export default function RepoPage() {
  const { id } = useParams<{ id: string }>();
  const [repo, setRepo] = useState<RepoDetail | null>(null);
  const [tab, setTab] = useState<TabId>("system-architecture");
  const [archOpen, setArchOpen] = useState(true);
  const [filesOpen, setFilesOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;

    async function poll() {
      try {
        const res = await fetch(`/api/repo/${id}`);
        if (!res.ok) return;
        const body = await res.json();
        if (!cancelled) setRepo(body.data);
      } catch {}
    }

    poll();
    const interval = setInterval(poll, 3000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [id]);

  if (!repo) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="flex items-center gap-2 text-neutral-600 text-sm">
          <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
          Loading…
        </div>
      </div>
    );
  }

  const completed = repo.status === "COMPLETED";
  const archArtifact = repo.artifacts.find((a) => a.type === "ARCHITECTURE");
  let mermaidData: Record<string, string> | null = null;
  if (archArtifact) {
    try {
      mermaidData = JSON.parse(archArtifact.content);
    } catch {}
  }

  const navItems: NavItem[] = [
    {
      label: "Architecture",
      children: [
        { id: "system-architecture", label: "System Architecture" },
        { id: "file-dependencies", label: "File Dependencies" },
        { id: "class-diagram", label: "Class Diagram" },
      ],
    },
    { id: "chat", label: "Chat" },
    { id: "issues", label: "Issues" },
    { id: "files", label: "Files" },
  ];

  function navClick(item: NavItem) {
    if (isFolder(item)) {
      setArchOpen(!archOpen);
    } else if (item.id === "files") {
      setFilesOpen(!filesOpen);
    } else if (item.id === "chat" || item.id === "issues") {
    } else {
      setTab(item.id as TabId);
    }
  }

  function subClick(tabId: TabId) {
    setTab(tabId);
  }

  return (
    <div className="min-h-screen bg-black flex flex-col">
      {/* Header */}
      <header className="flex items-center gap-3 px-5 py-3 border-b border-neutral-900 shrink-0">
        <Link
          href="/"
          className="text-sm text-neutral-500 hover:text-white transition-colors shrink-0"
        >
          ←
        </Link>

        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="w-6 h-6 flex items-center justify-center text-neutral-500 hover:text-white transition-colors shrink-0 text-xs border border-neutral-800 rounded"
          title={sidebarOpen ? "Hide sidebar" : "Show sidebar"}
        >
          {sidebarOpen ? "−" : "+"}
        </button>

        <div className="flex items-center gap-3 flex-wrap min-w-0">
          <h1
            className="text-base text-white truncate"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            {repo.owner}
            <span className="text-neutral-600">/</span>
            <span className="font-medium">{repo.name}</span>
          </h1>
          <span
            className="shrink-0 flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border border-neutral-800 text-[11px] tracking-wide uppercase text-neutral-400"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                STATUS_DOT[repo.status] || "bg-neutral-600"
              }`}
            />
            {STATUS_LABEL[repo.status] || repo.status}
          </span>
        </div>
        <div
          className="ml-auto flex gap-4 text-xs text-neutral-500 shrink-0"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          {repo.language && <span>{repo.language}</span>}
          <span>★ {repo.stars}</span>
          <span>⑂ {repo.forks}</span>
          {repo.defaultBranch && <span>{repo.defaultBranch}</span>}
        </div>
      </header>

      {/* Body */}
      <div className="flex flex-1 min-h-0">
        {/* Sidebar */}
        <nav
          className={`${
            sidebarOpen ? "w-60" : "w-0 overflow-hidden"
          } shrink-0 border-r border-neutral-900 bg-neutral-950/40 p-2 overflow-y-auto transition-all duration-200`}
        >
          {sidebarOpen && (
            <>
              {navItems.map((item) =>
                isFolder(item) ? (
                  <div key={item.label}>
                    <button
                      onClick={() => navClick(item)}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded text-sm text-neutral-400 hover:text-white hover:bg-neutral-900 transition-colors"
                    >
                      <span>{item.label}</span>
                      <span className="ml-auto text-xs text-neutral-600">
                        {archOpen ? "−" : "+"}
                      </span>
                    </button>
                    {archOpen && (
                      <div className="ml-3 mt-0.5 mb-1 space-y-0.5 border-l border-neutral-900 pl-2">
                        {item.children.map((child) => (
                          <button
                            key={child.id}
                            onClick={() => subClick(child.id)}
                            className={`w-full text-left px-3 py-1.5 rounded text-sm transition-colors ${
                              tab === child.id
                                ? "bg-white text-black font-medium"
                                : "text-neutral-500 hover:text-neutral-200 hover:bg-neutral-900"
                            }`}
                          >
                            {child.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <button
                    key={item.id}
                    onClick={() => navClick(item)}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded text-sm text-neutral-400 hover:text-white hover:bg-neutral-900 transition-colors"
                  >
                    <span>{item.label}</span>
                    {item.id === "files" && (
                      <span className="ml-auto text-xs text-neutral-600">
                        {filesOpen ? "−" : "+"}
                      </span>
                    )}
                  </button>
                ),
              )}

              {filesOpen && completed && (
                <div className="ml-3 mt-1 mb-2 max-h-64 overflow-y-auto space-y-0.5 border-l border-neutral-900 pl-2">
                  {repo.files.length === 0 ? (
                    <p className="text-xs text-neutral-700 px-2">No files</p>
                  ) : (
                    repo.files.map((f) => (
                      <div
                        key={f.path}
                        className="px-2 py-1 text-xs text-neutral-500 truncate rounded hover:bg-neutral-900 hover:text-neutral-300"
                        style={{ fontFamily: "var(--font-mono)" }}
                        title={f.path}
                      >
                        {f.path}
                      </div>
                    ))
                  )}
                </div>
              )}
            </>
          )}
        </nav>

        {/* Content */}
        <main className="flex-1 flex flex-col min-h-0">
          {!completed && (
            <div className="flex items-center gap-3 p-4 text-neutral-400 text-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
              Processing repository…
            </div>
          )}

          {completed &&
            (() => {
              if (!mermaidData) {
                return (
                  <div className="flex-1 flex items-center justify-center text-neutral-600 text-sm">
                    No architecture data available
                  </div>
                );
              }
              const chart = mermaidData[TAB_DATA_KEY[tab]];
              if (!chart) {
                return (
                  <div className="flex-1 flex items-center justify-center text-neutral-600 text-sm">
                    No {TAB_LABEL[tab].toLowerCase()} diagram available
                  </div>
                );
              }
              return (
                <div className="flex-1 flex flex-col min-h-0">
                  <MermaidView chart={chart} id={`mermaid-${tab}`} />
                </div>
              );
            })()}
        </main>
      </div>
    </div>
  );
}
