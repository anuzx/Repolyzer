"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

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

export default function Home() {
  const [url, setUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [repos, setRepos] = useState<Repo[]>([]);
  const [error, setError] = useState("");

  async function fetchRepos() {
    try {
      const res = await fetch("/api/repo");
      if (res.ok) {
        const body = await res.json();
        setRepos(body.data || []);
      }
    } catch {}
  }

  useEffect(() => {
    fetchRepos();
    const id = setInterval(fetchRepos, 3000);
    return () => clearInterval(id);
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/repo", {
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
        className="pointer-events-none absolute inset-0 opacity-[0.15]"
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

      <div className="relative max-w-2xl mx-auto px-6 py-20">
        <header className="mb-14">
          <p
            className="text-[11px] tracking-[0.25em] text-neutral-500 uppercase mb-3"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            GitHub architecture, mapped
          </p>
          <h1
            className="text-5xl text-white tracking-tight"
            style={{ fontFamily: "var(--font-display)", fontWeight: 500 }}
          >
            Repolyzer
          </h1>
          <p className="text-neutral-500 mt-3 text-[15px] leading-relaxed max-w-md">
            Paste a repository URL. Get its system architecture, file
            dependencies, and class diagrams back.
          </p>
        </header>

        <form onSubmit={handleSubmit} className="flex gap-2.5 mb-3">
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://github.com/owner/repo"
            className="flex-1 px-4 py-3 rounded-md bg-neutral-950 border border-neutral-800 text-white placeholder-neutral-600 focus:outline-none focus:ring-1 focus:ring-white focus:border-white transition-colors text-sm"
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
            className="mb-8 px-4 py-3 rounded-md bg-neutral-950 border border-neutral-800 text-neutral-400 text-sm"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            {error}
          </div>
        )}

        <section className={error ? "" : "mt-10"}>
          <h2
            className="text-xs tracking-[0.2em] uppercase text-neutral-600 mb-4"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            Repositories
          </h2>

          {repos.length === 0 ? (
            <p className="text-neutral-700 text-sm">
              Nothing analyzed yet — paste a URL above to get started.
            </p>
          ) : (
            <div className="space-y-2">
              {repos.map((r) => (
                <Link
                  key={r.id}
                  href={`/repo/${r.id}`}
                  className="group block p-4 rounded-lg bg-neutral-950/60 border border-neutral-800/80 hover:border-white/40 hover:bg-neutral-950 transition-colors"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <span className="text-white font-medium truncate block">
                        {r.owner}
                        <span className="text-neutral-600">/</span>
                        {r.name}
                      </span>
                      {r.description && (
                        <p className="text-neutral-500 text-sm mt-0.5 line-clamp-1">
                          {r.description}
                        </p>
                      )}
                    </div>
                    <span
                      className="shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-neutral-800 text-[11px] tracking-wide uppercase text-neutral-400 group-hover:border-neutral-600 transition-colors"
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
                    className="flex gap-4 mt-2.5 text-xs text-neutral-600"
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
