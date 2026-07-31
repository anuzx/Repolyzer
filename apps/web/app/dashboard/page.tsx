"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { BACKEND_URL } from "../../lib/config";

interface Repo {
  id: string;
  owner: string;
  name: string;
  description: string | null;
  language: string | null;
  stars: number;
  forks: number;
  status: string;
  createdAt: string;
}

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
  COMPLETED: "bg-[#5eead4]",
  FAILED: "bg-neutral-700",
};

export default function DashboardPage() {
  const [url, setUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [repos, setRepos] = useState<Repo[]>([]);
  const [error, setError] = useState("");
  const [loaded, setLoaded] = useState(false);
  // Bumped whenever a repo is submitted, to restart polling if it had
  // stopped after everything previously reached a terminal status.
  const [pollGeneration, setPollGeneration] = useState(0);

  const fetchRepos = useCallback(async (): Promise<Repo[]> => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/repo`);
      if (res.ok) {
        const body = await res.json();
        const data: Repo[] = body.data || [];
        setRepos(data);
        return data;
      }
    } catch {
    } finally {
      setLoaded(true);
    }
    return [];
  }, []);

  useEffect(() => {
    let cancelled = false;
    let intervalId: ReturnType<typeof setInterval> | undefined;

    const poll = async () => {
      const data = await fetchRepos();
      if (cancelled) return;
      // Stop polling once every repo has reached a terminal status — no
      // point hitting the API every 3s when nothing is still processing.
      const stillProcessing = data.some(
        (r) => r.status !== "COMPLETED" && r.status !== "FAILED",
      );
      if (data.length > 0 && !stillProcessing && intervalId) {
        clearInterval(intervalId);
      }
    };

    poll();
    intervalId = setInterval(poll, 3000);
    return () => {
      cancelled = true;
      if (intervalId) clearInterval(intervalId);
    };
  }, [fetchRepos, pollGeneration]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch(`${BACKEND_URL}/api/repo`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ githubUrl: url }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || "Failed to submit repo");
      }
      setUrl("");
      await fetchRepos();
      setPollGeneration((n) => n + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-black relative">
      {/* blueprint dot-grid backdrop */}
      <div
        className="pointer-events-none fixed inset-0 opacity-[0.15]"
        style={{
          backgroundImage:
            "radial-gradient(circle, #ffffff 1px, transparent 1px)",
          backgroundSize: "28px 28px",
          maskImage:
            "radial-gradient(ellipse 60% 40% at 50% 0%, black 0%, transparent 70%)",
          WebkitMaskImage:
            "radial-gradient(ellipse 60% 40% at 50% 0%, black 0%, transparent 70%)",
        }}
      />

      {/* Nav */}
      <nav className="relative border-b border-neutral-900/80">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 group">
            <svg width="16" height="16" viewBox="0 0 18 18" fill="none">
              <circle cx="3" cy="3" r="2.2" fill="#5eead4" />
              <circle cx="15" cy="3" r="2.2" fill="#5eead4" opacity="0.5" />
              <circle cx="9" cy="15" r="2.2" fill="#5eead4" opacity="0.5" />
              <path
                d="M4.5 4.5L8 13.5M13.5 4.5L10 13.5M5 3H13"
                stroke="#5eead4"
                strokeWidth="1"
                opacity="0.6"
              />
            </svg>
            <span
              className="text-sm text-neutral-200 group-hover:text-white transition-colors"
              style={{ fontFamily: "var(--font-display)", fontWeight: 500 }}
            >
              Repolyzer
            </span>
          </Link>
          <span
            className="text-[11px] tracking-[0.2em] text-neutral-400 uppercase"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            Dashboard
          </span>
        </div>
      </nav>

      <div className="relative max-w-2xl mx-auto px-6 py-16">
        <header className="mb-10">
          <p
            className="text-[11px] tracking-[0.25em] text-neutral-300 uppercase mb-3"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            New analysis
          </p>
          <h1
            className="text-3xl text-white tracking-tight"
            style={{ fontFamily: "var(--font-display)", fontWeight: 500 }}
          >
            Paste a repository URL
          </h1>
          <p className="text-neutral-300 mt-2 text-[15px] leading-relaxed max-w-md">
            We'll clone it, read it, and hand back its architecture, file
            dependencies, and class diagrams.
          </p>
        </header>

        <form onSubmit={handleSubmit} className="flex gap-2.5 mb-3">
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://github.com/owner/repo"
            className="flex-1 px-4 py-3 rounded-md bg-neutral-950 border border-neutral-800 text-white placeholder-neutral-600 focus:outline-none focus:ring-1 focus:ring-[#5eead4] focus:border-[#5eead4] transition-colors text-sm"
            style={{ fontFamily: "var(--font-mono)" }}
          />
          <button
            type="submit"
            disabled={submitting || !url.trim()}
            className="px-6 py-3 rounded-md bg-white text-black text-sm font-medium hover:bg-neutral-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors shrink-0"
          >
            {submitting ? "Analyzing…" : "Analyze"}
          </button>
        </form>

        {error && (
          <div
            className="mb-8 px-4 py-3 rounded-md bg-neutral-950 border border-neutral-800 text-neutral-200 text-sm"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            {error}
          </div>
        )}

        <section className={error ? "" : "mt-10"}>
          <h2
            className="text-xs tracking-[0.2em] uppercase text-neutral-400 mb-4"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            Repositories
          </h2>

          {loaded && repos.length === 0 ? (
            <div className="rounded-lg border border-dashed border-neutral-800 py-12 flex flex-col items-center text-center px-6">
              <svg width="28" height="28" viewBox="0 0 18 18" fill="none" className="mb-3">
                <circle cx="3" cy="3" r="2" fill="#525252" />
                <circle cx="15" cy="3" r="2" fill="#525252" />
                <circle cx="9" cy="15" r="2" fill="#525252" />
                <path
                  d="M4.5 4.5L8 13.5M13.5 4.5L10 13.5M5 3H13"
                  stroke="#525252"
                  strokeWidth="1"
                />
              </svg>
              <p className="text-neutral-300 text-sm">
                Nothing analyzed yet — paste a URL above to get started.
              </p>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 gap-2.5">
              {repos.map((r) => (
                <Link
                  key={r.id}
                  href={`/repo/${r.id}`}
                  className="group block p-4 rounded-lg bg-neutral-950/60 border border-neutral-800/80 hover:border-[#5eead4]/40 hover:bg-neutral-950 hover:-translate-y-0.5 transition-all duration-200"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <span className="text-white font-medium truncate block">
                        {r.owner}
                        <span className="text-neutral-400">/</span>
                        {r.name}
                      </span>
                      {r.description && (
                        <p className="text-neutral-300 text-sm mt-0.5 line-clamp-1">
                          {r.description}
                        </p>
                      )}
                    </div>
                    <span
                      className="shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-neutral-800 text-[11px] tracking-wide uppercase text-neutral-200 group-hover:border-neutral-600 transition-colors"
                      style={{ fontFamily: "var(--font-mono)" }}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          STATUS_DOT[r.status] || "bg-neutral-600"
                        }`}
                      />
                      {STATUS_LABEL[r.status] || r.status}
                    </span>
                  </div>
                  <div
                    className="flex gap-4 mt-2.5 text-xs text-neutral-400"
                    style={{ fontFamily: "var(--font-mono)" }}
                  >
                    {r.language && <span>{r.language}</span>}
                    <span>★ {r.stars}</span>
                    <span>⑂ {r.forks}</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}