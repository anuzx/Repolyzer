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

const STATUS_BADGE: Record<string, string> = {
  QUEUED: "bg-gray-700",
  CLONING: "bg-gray-600",
  PARSING: "bg-gray-600",
  CHUNKING: "bg-gray-600",
  EMBEDDING: "bg-gray-600",
  COMPLETED: "bg-gray-500",
  FAILED: "bg-black border border-gray-600",
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
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="animate-pulse text-gray-500">
          Loading...
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
    <div className="min-h-screen bg-gray-950 flex flex-col">
      {/* Header */}
      <header className="flex items-center gap-3 px-5 py-3 border-b border-gray-800 shrink-0">
        <Link
          href="/"
          className="text-sm text-gray-500 hover:text-white transition-colors shrink-0"
        >
          {'\u2190'}
        </Link>

        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="text-gray-500 hover:text-white transition-colors shrink-0 text-sm"
          title={sidebarOpen ? "Hide sidebar" : "Show sidebar"}
        >
          {sidebarOpen ? "[-]" : "[+]"}
        </button>

        <div className="flex items-center gap-3 flex-wrap min-w-0">
          <h1 className="text-lg font-bold text-white truncate">
            {repo.owner}/{repo.name}
          </h1>
          <span
            className={`shrink-0 px-2 py-0.5 rounded text-xs font-medium text-white ${STATUS_BADGE[repo.status] || "bg-gray-600"}`}
          >
            {repo.status}
          </span>
        </div>
        <div className="ml-auto flex gap-3 text-xs text-gray-500 shrink-0">
          {repo.language && <span>{repo.language}</span>}
          <span>{repo.stars} stars</span>
          <span>{repo.forks} forks</span>
          {repo.defaultBranch && <span>{repo.defaultBranch}</span>}
        </div>
      </header>

      {/* Body */}
      <div className="flex flex-1 min-h-0">
        {/* Sidebar */}
        <nav
          className={`${
            sidebarOpen ? "w-56" : "w-0 overflow-hidden"
          } shrink-0 border-r border-gray-800 bg-gray-900/50 p-2 overflow-y-auto transition-all duration-200`}
        >
          {sidebarOpen && (
            <>
              {navItems.map((item) =>
                isFolder(item) ? (
                  <div key={item.label}>
                    <button
                      onClick={() => navClick(item)}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded text-sm text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
                    >
                      <span>{item.label}</span>
                      <span className="ml-auto text-xs text-gray-600">
                        {archOpen ? "[-]" : "[+]"}
                      </span>
                    </button>
                    {archOpen && (
                      <div className="ml-4 mt-0.5 mb-1 space-y-0.5">
                        {item.children.map((child) => (
                          <button
                            key={child.id}
                            onClick={() => subClick(child.id)}
                            className={`w-full flex items-center gap-2 px-3 py-1.5 rounded text-sm transition-colors ${
                              tab === child.id
                                ? "bg-gray-800 text-white"
                                : "text-gray-500 hover:text-gray-300 hover:bg-gray-800/50"
                            }`}
                          >
                            <span className="text-gray-400 ml-1">-</span>
                            <span>{child.label}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <button
                    key={item.id}
                    onClick={() => navClick(item)}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded text-sm text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
                  >
                    <span>{item.label}</span>
                    {item.id === "files" && (
                      <span className="ml-auto text-xs text-gray-600">
                        {filesOpen ? "[-]" : "[+]"}
                      </span>
                    )}
                  </button>
                ),
              )}

              {filesOpen && completed && (
                <div className="ml-6 mt-1 mb-2 max-h-64 overflow-y-auto space-y-0.5">
                  {repo.files.length === 0 ? (
                    <p className="text-xs text-gray-600 px-2">No files</p>
                  ) : (
                    repo.files.map((f) => (
                      <div
                        key={f.path}
                        className="px-2 py-1 text-xs text-gray-500 truncate rounded hover:bg-gray-800/50"
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
            <div className="flex items-center gap-3 p-4 text-gray-400">
              <span className="inline-block w-3 h-3 rounded-full bg-gray-500 animate-pulse" />
              Processing repository...
            </div>
          )}

          {completed && (() => {
            if (!mermaidData) {
              return (
                <div className="flex-1 flex items-center justify-center text-gray-500">
                  No architecture data available
                </div>
              );
            }
            const chart = mermaidData[TAB_DATA_KEY[tab]];
            if (!chart) {
              return (
                <div className="flex-1 flex items-center justify-center text-gray-500">
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