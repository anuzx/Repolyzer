"use client";

import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";

interface Message {
  id: string;
  role: "USER" | "ASSISTANT";
  content: string;
  createdAt: string;
}

const markdownComponents: Components = {
  p: ({ children, ...props }) => (
    <p
      className="text-sm text-neutral-200 leading-relaxed mb-2 last:mb-0"
      {...props}
    >
      {children}
    </p>
  ),
  code: ({ children, className, ...props }) => {
    const isInline = !className;
    if (isInline) {
      return (
        <code
          className="px-1 py-0.5 rounded bg-neutral-800 text-neutral-100 text-xs"
          style={{ fontFamily: "var(--font-mono)" }}
          {...props}
        >
          {children}
        </code>
      );
    }
    return (
      <pre className="mb-3 p-3 rounded-lg bg-neutral-950 border border-neutral-800 overflow-x-auto">
        <code
          className="text-xs text-neutral-200 leading-relaxed"
          style={{ fontFamily: "var(--font-mono)" }}
          {...props}
        >
          {children}
        </code>
      </pre>
    );
  },
  pre: ({ children }) => <>{children}</>,
  ul: ({ children, ...props }) => (
    <ul
      className="text-sm text-neutral-200 mb-2 space-y-1 list-disc list-inside"
      {...props}
    >
      {children}
    </ul>
  ),
  ol: ({ children, ...props }) => (
    <ol
      className="text-sm text-neutral-200 mb-2 space-y-1 list-decimal list-inside"
      {...props}
    >
      {children}
    </ol>
  ),
  li: ({ children, ...props }) => (
    <li className="text-sm text-neutral-200" {...props}>
      {children}
    </li>
  ),
  h1: ({ children, ...props }) => (
    <h1 className="text-base text-white font-medium mb-2" {...props}>
      {children}
    </h1>
  ),
  h2: ({ children, ...props }) => (
    <h2 className="text-sm text-white font-medium mb-1.5" {...props}>
      {children}
    </h2>
  ),
  h3: ({ children, ...props }) => (
    <h3 className="text-sm text-white font-medium mb-1" {...props}>
      {children}
    </h3>
  ),
  a: ({ children, href, ...props }) => (
    <a
      className="text-neutral-200 underline underline-offset-2 hover:text-white transition-colors"
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      {...props}
    >
      {children}
    </a>
  ),
  blockquote: ({ children, ...props }) => (
    <blockquote
      className="border-l-2 border-neutral-600 pl-3 mb-2 text-sm text-neutral-400 italic"
      {...props}
    >
      {children}
    </blockquote>
  ),
  table: ({ children, ...props }) => (
    <div className="overflow-x-auto mb-3">
      <table
        className="min-w-full text-sm text-neutral-200 border-collapse"
        {...props}
      >
        {children}
      </table>
    </div>
  ),
  th: ({ children, ...props }) => (
    <th
      className="border border-neutral-800 px-2 py-1 text-left text-white font-medium"
      {...props}
    >
      {children}
    </th>
  ),
  td: ({ children, ...props }) => (
    <td className="border border-neutral-800 px-2 py-1" {...props}>
      {children}
    </td>
  ),
  hr: (props) => <hr className="border-neutral-800 my-4" {...props} />,
};

export function ChatView({ repoId }: { repoId: string }) {
  const [chatId, setChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  // Set right before we assign a brand-new chatId we created ourselves in
  // handleSubmit. Lets the history-fetch effect below skip its GET for that
  // chat — otherwise that GET runs in parallel with the streaming response
  // and can resolve *after* the assistant message is appended locally,
  // overwriting the screen with a stale DB snapshot that doesn't have the
  // reply yet (it's only saved once the stream finishes on the backend).
  const skipNextHistoryFetchRef = useRef(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/repo/${repoId}/chats`);
        const body = await res.json();
        const chats = body.data;
        if (chats && chats.length > 0) {
          setChatId(chats[0].id);
        }
      } catch {
      } finally {
        setLoading(false);
      }
    })();
  }, [repoId]);

  useEffect(() => {
    if (!chatId) return;
    (async () => {
      try {
        const res = await fetch(`/api/chats/${chatId}/messages`);
        const body = await res.json();
        setMessages(body.data || []);
      } catch {}
    })();
  }, [chatId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingText]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || streaming) return;

    let currentChatId = chatId;

    if (!currentChatId) {
      try {
        const res = await fetch(`/api/repo/${repoId}/chats`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        });
        const body = await res.json();
        currentChatId = body.data.id;
        setChatId(currentChatId);
      } catch {
        return;
      }
    }

    const userMsg = input.trim();
    setInput("");
    setMessages((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        role: "USER",
        content: userMsg,
        createdAt: new Date().toISOString(),
      },
    ]);
    setStreaming(true);
    setStreamingText("");

    try {
      const res = await fetch(`/api/chats/${currentChatId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: userMsg }),
      });

      if (!res.ok) {
        setStreaming(false);
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) {
        setStreaming(false);
        return;
      }

      const decoder = new TextDecoder();
      let full = "";
      // Bytes from reader.read() rarely align with SSE event boundaries — a
      // single "data: ...\n\n" frame can easily be split across two reads.
      // Buffer everything and only process complete frames (delimited by the
      // blank line "\n\n"), carrying any trailing partial frame forward.
      let buffer = "";
      let done_ = false;

      while (!done_) {
        const { done, value } = await reader.read();
        if (done) {
          done_ = true;
          buffer += decoder.decode(); // flush any remaining decoder state
        } else {
          buffer += decoder.decode(value, { stream: true });
        }

        const frames = buffer.split("\n\n");
        // The last element may be an incomplete frame — keep it for next time.
        buffer = frames.pop() ?? "";

        for (const frame of frames) {
          const line = frame.split("\n").find((l) => l.startsWith("data: "));
          if (!line) continue;
          const payload = line.slice(6);

          if (payload === "[DONE]") {
            setMessages((prev) => [
              ...prev,
              {
                id: crypto.randomUUID(),
                role: "ASSISTANT",
                content: full,
                createdAt: new Date().toISOString(),
              },
            ]);
            setStreamingText("");
            full = "";
            continue;
          }

          try {
            const parsed = JSON.parse(payload);
            if (parsed.error) {
              setStreaming(false);
              return;
            }
            if (parsed.content) {
              full += parsed.content;
              setStreamingText(full);
            }
          } catch {}
        }
      }
    } catch {
    } finally {
      setStreaming(false);
    }
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center text-neutral-600 text-sm">
        <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse mr-2" />
        Loading chat…
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && !streaming && (
          <div className="flex items-center justify-center h-full text-neutral-500 text-sm">
            Ask a question about this codebase
          </div>
        )}
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === "USER" ? "justify-end" : "justify-start"}`}
          >
            {msg.role === "USER" ? (
              <div
                className="max-w-[75%] rounded-lg px-4 py-2.5 bg-white text-black text-sm leading-relaxed whitespace-pre-wrap break-words"
                style={{ fontFamily: "var(--font-sans)" }}
              >
                {msg.content}
              </div>
            ) : (
              <div
                className="max-w-[85%] rounded-lg px-4 py-2.5 bg-neutral-900 border border-neutral-800"
                style={{ fontFamily: "var(--font-sans)" }}
              >
                <ReactMarkdown
                  components={markdownComponents}
                  remarkPlugins={[remarkGfm]}
                >
                  {msg.content}
                </ReactMarkdown>
              </div>
            )}
          </div>
        ))}
        {streaming && streamingText && (
          <div className="flex justify-start">
            <div className="max-w-[85%] rounded-lg px-4 py-2.5 bg-neutral-900 border border-neutral-800">
              <div
                className="text-sm text-neutral-200 leading-relaxed whitespace-pre-wrap break-words"
                style={{ fontFamily: "var(--font-mono)" }}
              >
                {streamingText}
                <span className="inline-block w-2 h-4 bg-white ml-0.5 animate-pulse align-text-bottom" />
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
      <form
        onSubmit={handleSubmit}
        className="flex gap-2 p-4 border-t border-neutral-900 shrink-0"
      >
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about the codebase…"
          disabled={streaming}
          className="flex-1 px-3 py-2 rounded-md bg-neutral-950 border border-neutral-800 text-white placeholder-neutral-600 focus:outline-none focus:ring-1 focus:ring-white text-sm disabled:opacity-40"
          style={{ fontFamily: "var(--font-mono)" }}
        />
        <button
          type="submit"
          disabled={streaming || !input.trim()}
          className="px-4 py-2 rounded-md bg-white text-black text-sm font-medium hover:bg-neutral-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors shrink-0"
        >
          Send
        </button>
      </form>
    </div>
  );
}
