"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { MermaidView } from "../../../components/mermaid-view";
import { SummaryView } from "../../../components/summary-view";
import { ChatView } from "../../../components/chat-view";
import { IssuesView } from "../../../components/issues-view";
import { FilesView } from "../../../components/files-view";
import { BACKEND_URL } from "../../../lib/config";

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
  files: { path: string; extension: string | null; summary: string | null }[];
  artifacts: { type: string; content: string }[];
}

type TabId =
  | "system-architecture"
  | "code-layers"
  | "file-dependencies"
  | "class-diagram"
  | "summary"
  | "chat"
  | "issues"
  | "files";

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
  SUMMARY: "Generating Summary",
  CHUNKING: "Chunking",
  EMBEDDING: "Embedding",
  COMPLETED: "Ready",
  FAILED: "Failed",
};

const STATUS_DOT: Record<string, string> = {
  QUEUED: "bg-neutral-600",
  CLONING: "bg-neutral-400 animate-pulse",
  PARSING: "bg-neutral-400 animate-pulse",
  SUMMARY: "bg-neutral-400 animate-pulse",
  CHUNKING: "bg-neutral-400 animate-pulse",
  EMBEDDING: "bg-neutral-400 animate-pulse",
  COMPLETED: "bg-white",
  FAILED: "bg-neutral-700",
};

const TAB_LABEL: Record<TabId, string> = {
  "system-architecture": "System Architecture",
  "code-layers": "Code Layers",
  "file-dependencies": "File Dependencies",
  "class-diagram": "Class Diagram",
  summary: "Summary",
  chat: "Chat",
  issues: "Issues",
  files: "Files",
};

// Only the diagrams that live inside the ARCHITECTURE artifact's JSON blob
// (graph.service.ts's MermaidOutput) go through this lookup. The true
// system diagram (SYSTEM_ARCHITECTURE artifact) is a raw mermaid string on
// its own artifact row, not a key inside this object — handled separately
// below instead of through TAB_DATA_KEY.
const TAB_DATA_KEY: Record<string, string> = {
  "code-layers": "architecture",
  "file-dependencies": "flowchart",
  "class-diagram": "classDiagram",
};

function isFolder(item: NavItem): item is NavFolder {
  return "children" in item;
}

export default function RepoPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [repo, setRepo] = useState<RepoDetail | null>(null);
  const [tab, setTab] = useState<TabId>("system-architecture");
  const [archOpen, setArchOpen] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [initialChatMessage, setInitialChatMessage] = useState<{
    text: string;
    issueNumber?: number;
  } | null>(null);
  const [retrying, setRetrying] = useState(false);

  // Bumped on retry to restart polling that had stopped after failure.
  const [pollGen, setPollGen] = useState(0);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    let interval: ReturnType<typeof setInterval> | undefined;

    async function poll() {
      try {
        const res = await fetch(`${BACKEND_URL}/api/repo/${id}`);
        if (!res.ok) return;
        const body = await res.json();
        if (cancelled) return;
        setRepo(body.data);
        // Stop polling once this repo has reached a terminal status — no
        // point hitting the API every 3s when nothing is still processing.
        const status = body.data?.status;
        if (status === "COMPLETED" && interval) {
          clearInterval(interval);
        }
      } catch {}
    }

    poll();
    interval = setInterval(poll, 3000);
    return () => {
      cancelled = true;
      if (interval) clearInterval(interval);
    };
  }, [id, pollGen]);

  const handleDelete = useCallback(async () => {
    if (!confirm("Delete this repository and all its data?")) return;
    try {
      const res = await fetch(`${BACKEND_URL}/api/repo/${id}`, { method: "DELETE" });
      if (res.ok) router.push("/");
    } catch {}
  }, [id, router]);

  const handleRetry = useCallback(async () => {
    setRetrying(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/repo/${id}/retry`, { method: "POST" });
      if (res.ok) {
        setRepo((prev) => prev ? { ...prev, status: "QUEUED" } : null);
        setPollGen((n) => n + 1);
      }
    } finally {
      setRetrying(false);
    }
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
  const processing = !completed && repo.status !== "FAILED";

  const archArtifact = repo.artifacts.find((a) => a.type === "ARCHITECTURE");
  const systemArchArtifact = repo.artifacts.find(
    (a) => a.type === "SYSTEM_ARCHITECTURE",
  );
  const summaryArtifact = repo.artifacts.find(
    (a) => a.type === "DOCUMENTATION",
  );
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
        { id: "code-layers", label: "Code Layers" },
        { id: "file-dependencies", label: "File Dependencies" },
        { id: "class-diagram", label: "Class Diagram" },
      ],
    },
    { id: "summary", label: "Summary" },
    { id: "chat", label: "Chat" },
    { id: "issues", label: "Issues" },
    { id: "files", label: "Files" },
  ];

  function navClick(item: NavItem) {
    if (isFolder(item)) {
      setArchOpen(!archOpen);
    } else {
      setTab(item.id as TabId);
    }
  }

  function subClick(tabId: TabId) {
    setTab(tabId);
  }

  return (
    <div className="h-screen bg-black flex flex-col">
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
          className="ml-auto flex items-center gap-4 text-xs text-neutral-500 shrink-0"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          {repo.language && <span>{repo.language}</span>}
          <span>★ {repo.stars}</span>
          <span>⑂ {repo.forks}</span>
          {repo.defaultBranch && <span>{repo.defaultBranch}</span>}
          {repo.status === "FAILED" && (
            <button
              onClick={handleRetry}
              disabled={retrying}
              className="w-6 h-6 flex items-center justify-center text-neutral-600 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors border border-neutral-800 rounded"
              title="Retry analysis"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
                <path fillRule="evenodd" d="M15.312 11.424a5.5 5.5 0 01-9.201 2.466l-.312-.311h2.433a.75.75 0 000-1.5H3.989a.75.75 0 00-.75.75v4.242a.75.75 0 001.5 0v-2.43l.31.31a7 7 0 0011.712-3.138.75.75 0 00-1.449-.39zm1.23-3.723a.75.75 0 00.219-.53V2.929a.75.75 0 00-1.5 0V5.36l-.31-.31A7 7 0 003.239 8.188a.75.75 0 101.448.389A5.5 5.5 0 0113.89 6.11l.311.31h-2.432a.75.75 0 000 1.5h4.243a.75.75 0 00.53-.219z" clipRule="evenodd" />
              </svg>
            </button>
          )}
          <button
            onClick={handleDelete}
            disabled={processing}
            className="ml-2 w-6 h-6 flex items-center justify-center text-neutral-600 hover:text-red-400 disabled:opacity-30 disabled:cursor-not-allowed transition-colors border border-neutral-800 rounded"
            title="Delete repository"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="w-3.5 h-3.5"
            >
              <path
                fillRule="evenodd"
                d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z"
                clipRule="evenodd"
              />
            </svg>
          </button>
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
                    className={`w-full flex items-center gap-2 px-3 py-2 rounded text-sm transition-colors ${
                      tab === item.id
                        ? "bg-white text-black font-medium"
                        : "text-neutral-400 hover:text-white hover:bg-neutral-900"
                    }`}
                  >
                    <span>{item.label}</span>
                  </button>
                ),
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
              if (tab === "summary") {
                return <SummaryView content={summaryArtifact?.content ?? ""} />;
              }
              if (tab === "chat") {
                return (
                  <ChatView
                    repoId={repo.id}
                    initialMessage={initialChatMessage?.text ?? null}
                    issueNumber={initialChatMessage?.issueNumber}
                    onMessageUsed={() => setInitialChatMessage(null)}
                  />
                );
              }
              if (tab === "issues") {
                return (
                  <IssuesView
                    repoId={repo.id}
                    onChatAboutIssue={(msg, issueNumber) => {
                      setInitialChatMessage({ text: msg, issueNumber });
                      setTab("chat");
                    }}
                  />
                );
              }
              if (tab === "files") {
                return <FilesView files={repo.files} />;
              }
              if (tab === "system-architecture") {
                // Own artifact row (a raw mermaid string), not part of the
                // mermaidData JSON blob the other three diagrams share —
                // this is the true "how do backend/frontend/workers/infra
                // talk to each other" diagram, synthesized from detected
                // services + infra, not a file/import graph.
                if (!systemArchArtifact?.content) {
                  return (
                    <div className="flex-1 flex items-center justify-center text-neutral-600 text-sm text-center px-6">
                      No system architecture diagram available yet — this repo
                      was likely analyzed before that feature was added.
                      Re-run analysis to generate one.
                    </div>
                  );
                }
                return (
                  <div className="flex-1 flex flex-col min-h-0">
                    <MermaidView
                      chart={systemArchArtifact.content}
                      id="mermaid-system-architecture"
                    />
                  </div>
                );
              }
              if (!mermaidData) {
                return (
                  <div className="flex-1 flex items-center justify-center text-neutral-600 text-sm">
                    No architecture data available
                  </div>
                );
              }
              const key = TAB_DATA_KEY[tab];
              if (!key) {
                return (
                  <div className="flex-1 flex items-center justify-center text-neutral-600 text-sm">
                    Diagram not available
                  </div>
                );
              }
              const chart = mermaidData[key];
              if (!chart) {
                return (
                  <div className="flex-1 flex items-center justify-center text-neutral-600 text-sm">
                    No {TAB_LABEL[tab]?.toLowerCase()} diagram available
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
      <style jsx>{`
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
      `}</style>
    </div>
  );
}