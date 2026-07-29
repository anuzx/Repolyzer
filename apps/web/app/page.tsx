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

const STATUS_BADGE: Record<string, string> = {
  QUEUED: "bg-gray-700",
  CLONING: "bg-gray-600",
  PARSING: "bg-gray-600",
  CHUNKING: "bg-gray-600",
  EMBEDDING: "bg-gray-600",
  COMPLETED: "bg-gray-500",
  FAILED: "bg-black border border-gray-600",
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
    <div className="max-w-3xl mx-auto px-4 py-12">
      <header className="mb-10">
        <h1 className="text-3xl font-bold text-white tracking-tight">
          Repolyzer
        </h1>
        <p className="text-gray-400 mt-1">
          Paste a GitHub repo URL to analyze its architecture
        </p>
      </header>

      <form onSubmit={handleSubmit} className="flex gap-3 mb-8">
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://github.com/owner/repo"
          className="flex-1 px-4 py-2.5 rounded-lg bg-gray-800 border border-gray-700 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:border-transparent"
        />
        <button
          type="submit"
          disabled={submitting || !url.trim()}
          className="px-6 py-2.5 rounded-lg bg-white text-black font-medium hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {submitting ? "..." : "Analyze"}
        </button>
      </form>

      {error && (
        <div className="mb-6 p-3 rounded-lg bg-gray-900 border border-gray-700 text-gray-400 text-sm">
          {error}
        </div>
      )}

      <section>
        <h2 className="text-lg font-semibold text-white mb-4">
          Repositories
        </h2>
        {repos.length === 0 ? (
          <p className="text-gray-600 text-sm">No repos analyzed yet</p>
        ) : (
          <div className="space-y-2">
            {repos.map((r) => (
              <Link
                key={r.id}
                href={`/repo/${r.id}`}
                className="block p-4 rounded-lg bg-gray-900 border border-gray-800 hover:border-gray-700 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-white font-medium">
                      {r.owner}/{r.name}
                    </span>
                    {r.description && (
                      <p className="text-gray-500 text-sm mt-0.5 line-clamp-1">
                        {r.description}
                      </p>
                    )}
                  </div>
                  <span
                    className={`shrink-0 ml-4 px-2.5 py-0.5 rounded-full text-xs font-medium text-white ${STATUS_BADGE[r.status] || "bg-gray-600"}`}
                  >
                    {r.status}
                  </span>
                </div>
                <div className="flex gap-4 mt-2 text-xs text-gray-600">
                  {r.language && <span>{r.language}</span>}
                  <span>{r.stars} stars</span>
                  <span>{r.forks} forks</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
