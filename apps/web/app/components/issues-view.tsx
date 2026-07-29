"use client";

import { useEffect, useState } from "react";

interface GithubIssue {
  id: string;
  issueNumber: number;
  title: string;
  body: string | null;
  labels: string[];
  author: string;
  state: string;
  commentsCount: number;
  url: string;
  githubCreatedAt: string;
  githubUpdatedAt: string;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d`;
  return `${Math.floor(days / 30)}mo`;
}

export function IssuesView({
  repoId,
  onChatAboutIssue,
}: {
  repoId: string;
  onChatAboutIssue: (message: string) => void;
}) {
  const [issues, setIssues] = useState<GithubIssue[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/repo/${repoId}/issues`);
        const body = await res.json();
        setIssues(body.data || []);
      } catch {
      } finally {
        setLoading(false);
      }
    })();
  }, [repoId]);

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center text-neutral-600 text-sm">
        <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse mr-2" />
        Loading issues…
      </div>
    );
  }

  if (issues.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-neutral-600 text-sm">
        No open issues
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="p-4 space-y-2">
        {issues.map((issue) => {
          const isExpanded = expanded.has(issue.id);
          return (
            <div
              key={issue.id}
              className="rounded-lg border border-neutral-800 bg-neutral-950 overflow-hidden"
            >
              <button
                onClick={() => toggle(issue.id)}
                className="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-neutral-900 transition-colors"
              >
                <span className="text-neutral-500 shrink-0 mt-0.5">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 16 16"
                    fill="currentColor"
                    className="w-4 h-4"
                  >
                    <path d="M8 1a4 4 0 0 0-4 4v2.5a.5.5 0 0 0 .5.5h1a.5.5 0 0 0 .5-.5V5a2 2 0 1 1 4 0v2.5a.5.5 0 0 0 .5.5h1a.5.5 0 0 0 .5-.5V5a4 4 0 0 0-4-4Z" />
                    <path d="M4 7.5a.5.5 0 0 0-.5.5v.5A.5.5 0 0 0 4 9h.5l.75 4.5A1.5 1.5 0 0 0 6.72 14.5h2.56a1.5 1.5 0 0 0 1.47-1.18L11.5 9H12a.5.5 0 0 0 .5-.5V8a.5.5 0 0 0-.5-.5H4Z" />
                  </svg>
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm text-white font-medium">
                      {issue.title}
                    </span>
                    <span className="text-xs text-neutral-500 shrink-0">
                      #{issue.issueNumber}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-1.5 text-xs text-neutral-500">
                    <span>{issue.author}</span>
                    {issue.labels.length > 0 && (
                      <span className="flex gap-1">
                        {issue.labels.map((label) => (
                          <span
                            key={label}
                            className="px-1.5 py-0.5 rounded-full bg-neutral-800 text-neutral-400 text-[10px]"
                          >
                            {label}
                          </span>
                        ))}
                      </span>
                    )}
                    <span>{issue.commentsCount} comments</span>
                    <span>{timeAgo(issue.githubUpdatedAt)}</span>
                  </div>
                </div>
                <span className="text-neutral-600 shrink-0 text-xs mt-1">
                  {isExpanded ? "−" : "+"}
                </span>
              </button>
              {isExpanded && (
                <div className="px-4 pb-3 pt-0 border-t border-neutral-800">
                  {issue.body ? (
                    <pre className="text-sm text-neutral-400 whitespace-pre-wrap font-sans leading-relaxed mt-3">
                      {issue.body}
                    </pre>
                  ) : (
                    <p className="text-sm text-neutral-600 mt-3 italic">
                      No description
                    </p>
                  )}
                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={() =>
                        onChatAboutIssue(
                          `Help me understand and resolve issue #${issue.issueNumber}: ${issue.title}`,
                        )
                      }
                      className="px-3 py-1.5 rounded-md bg-white text-black text-xs font-medium hover:bg-neutral-200 transition-colors"
                    >
                      Chat about this issue
                    </button>
                    <a
                      href={issue.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1.5 rounded-md border border-neutral-700 text-neutral-400 text-xs hover:text-white hover:border-neutral-500 transition-colors"
                    >
                      Open on GitHub
                    </a>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
