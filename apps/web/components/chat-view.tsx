"use client";

import { useEffect, useRef, useState, useCallback, memo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";
import {
  FiChevronDown,
  FiPlus,
  FiSend,
  FiAlertCircle,
  FiMessageSquare,
  FiCopy,
  FiCheck,
} from "react-icons/fi";
import { PiRobotBold, PiUserBold } from "react-icons/pi";
import { BACKEND_URL } from "../lib/config";

interface Message {
  id: string;
  role: "USER" | "ASSISTANT";
  content: string;
  createdAt: string;
}

interface ChatSummary {
  id: string;
  title: string | null;
  createdAt: string;
  _count?: { messages: number };
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

function Avatar({ role }: { role: "USER" | "ASSISTANT" }) {
  if (role === "USER") {
    return (
      <div className="w-7 h-7 rounded-full bg-white flex items-center justify-center shrink-0">
        <PiUserBold className="w-3.5 h-3.5 text-black" />
      </div>
    );
  }
  return (
    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-neutral-700 to-neutral-900 border border-neutral-700 flex items-center justify-center shrink-0">
      <PiRobotBold className="w-3.5 h-3.5 text-neutral-200" />
    </div>
  );
}

function CopyButton({
  text,
  className = "",
}: {
  text: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }, [text]);

  return (
    <button
      onClick={handleCopy}
      title={copied ? "Copied" : "Copy"}
      className={`flex items-center justify-center w-6 h-6 rounded text-neutral-500 hover:text-white hover:bg-neutral-800 transition-colors ${className}`}
    >
      {copied ? (
        <FiCheck className="w-3.5 h-3.5" />
      ) : (
        <FiCopy className="w-3.5 h-3.5" />
      )}
    </button>
  );
}

function TypingDots() {
  return (
    <span className="inline-flex items-center gap-1">
      <span className="w-1.5 h-1.5 rounded-full bg-neutral-400 animate-bounce [animation-delay:-0.3s]" />
      <span className="w-1.5 h-1.5 rounded-full bg-neutral-400 animate-bounce [animation-delay:-0.15s]" />
      <span className="w-1.5 h-1.5 rounded-full bg-neutral-400 animate-bounce" />
    </span>
  );
}

// Pulled out and memoized so that typing in the input (which only touches a
// ref + a debounced boolean) never re-renders the (potentially long)
// message history. Only re-renders when messages/streaming actually change.
const MessageList = memo(function MessageList({
  messages,
  streaming,
  streamError,
}: {
  messages: Message[];
  streaming: boolean;
  streamError: string | null;
}) {
  if (messages.length === 0 && !streaming) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-neutral-600 gap-2">
        <FiMessageSquare className="w-6 h-6" />
        <p className="text-sm text-neutral-500">
          Ask a question about this codebase
        </p>
      </div>
    );
  }

  return (
    <>
      {messages.map((msg, i) => {
        // The assistant reply being streamed lives directly in `messages`
        // now (its content is mutated in place as chunks arrive), so the
        // "is this the one currently streaming" check is just "is it the
        // last item while streaming is true" — no separate shadow state to
        // keep in sync with it.
        const isStreamingLast =
          streaming && i === messages.length - 1 && msg.role === "ASSISTANT";
        return (
          <div
            key={msg.id}
            className={`flex items-end gap-2 ${
              msg.role === "USER" ? "justify-end" : "justify-start"
            }`}
          >
            {msg.role === "ASSISTANT" && <Avatar role={msg.role} />}
            {msg.role === "USER" ? (
              <div
                className="max-w-[75%] rounded-2xl rounded-br-sm px-4 py-2.5 bg-white text-black text-sm leading-relaxed whitespace-pre-wrap break-words shadow-sm"
                style={{ fontFamily: "var(--font-sans)" }}
              >
                {msg.content}
              </div>
            ) : isStreamingLast && !msg.content ? (
              <div className="rounded-2xl rounded-bl-sm px-4 py-3 bg-neutral-900/70 border border-neutral-800">
                <TypingDots />
              </div>
            ) : (
              <div className="flex flex-col items-start max-w-[85%] group">
                <div
                  className="rounded-2xl rounded-bl-sm px-4 py-2.5 bg-neutral-900/70 border border-neutral-800 shadow-sm"
                  style={{ fontFamily: "var(--font-sans)" }}
                >
                  <ReactMarkdown
                    components={markdownComponents}
                    remarkPlugins={[remarkGfm]}
                  >
                    {msg.content}
                  </ReactMarkdown>
                  {isStreamingLast && (
                    <span className="inline-block w-1.5 h-4 bg-white ml-0.5 animate-pulse align-text-bottom rounded-sm" />
                  )}
                </div>
                {!isStreamingLast && msg.content && (
                  <CopyButton
                    text={msg.content}
                    className="mt-1 opacity-0 group-hover:opacity-100"
                  />
                )}
              </div>
            )}
            {msg.role === "USER" && <Avatar role={msg.role} />}
          </div>
        );
      })}
      {!streaming && streamError && (
        <div className="flex items-start gap-2 justify-start">
          <div className="w-7 h-7 rounded-full bg-red-950/60 border border-red-900/60 flex items-center justify-center shrink-0">
            <FiAlertCircle className="w-3.5 h-3.5 text-red-400" />
          </div>
          <div className="max-w-[85%] rounded-2xl rounded-bl-sm px-4 py-2.5 bg-red-950/30 border border-red-900/50">
            <p className="text-sm text-red-300">{streamError}</p>
          </div>
        </div>
      )}
    </>
  );
});

function chatLabel(chat: ChatSummary, index: number, total: number) {
  if (chat.title && chat.title.trim()) return chat.title;
  const count = chat._count?.messages ?? 0;
  if (count === 0) return "New chat";
  return `Chat ${total - index}`;
}

export function ChatView({
  repoId,
  initialMessage,
  issueNumber,
  onMessageUsed,
}: {
  repoId: string;
  initialMessage?: string | null;
  issueNumber?: number;
  onMessageUsed?: () => void;
}) {
  const [chats, setChats] = useState<ChatSummary[]>([]);
  const [chatId, setChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [streamError, setStreamError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  // Debounced only for the Send button's enabled/disabled state — the
  // actual text lives in inputRef so typing never triggers a re-render.
  const [canSend, setCanSend] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  // Tracks whether the user is scrolled near the bottom of the message
  // list. Auto-scroll should only kick in while that's true — otherwise a
  // deliberate scroll-up to reread earlier messages gets yanked back to the
  // bottom on every streamed chunk.
  const isNearBottomRef = useRef(true);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipNextHistoryFetchRef = useRef(false);
  const pendingMessageRef = useRef<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  // `streaming` (state) is what the UI renders off of, but state updates are
  // batched/async — checking `if (streaming) return` at the top of
  // handleSubmit can't stop a second call that fires before the first
  // re-render commits (Enter + click, or the initialMessage auto-submit
  // effect racing a manual send). This ref updates synchronously and is the
  // actual guard against two concurrent submissions.
  const streamingRef = useRef(false);

  const loadChats = useCallback(async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/repo/${repoId}/chats`);
      const body = await res.json();
      const list: ChatSummary[] = body.data || [];
      setChats(list);
      return list;
    } catch {
      return [];
    }
  }, [repoId]);

  // Shared with the post-stream refresh below: the DB is the source of
  // truth for message content, so both "load history" and "sync after a
  // reply finishes" go through the same fetch instead of each constructing
  // their own local Message objects.
  const fetchMessages = useCallback(async (id: string) => {
    const res = await fetch(`${BACKEND_URL}/api/chats/${id}/messages`);
    const body = await res.json();
    setMessages(body.data || []);
  }, []);

  useEffect(() => {
    (async () => {
      const list = await loadChats();
      if (list.length > 0) {
        setChatId(list[0]!.id);
      }
      setLoading(false);
    })();
  }, [loadChats]);

  useEffect(() => {
    if (!chatId) {
      setMessages([]);
      return;
    }
    if (skipNextHistoryFetchRef.current) {
      skipNextHistoryFetchRef.current = false;
      return;
    }
    fetchMessages(chatId).catch(() => {});
  }, [chatId, fetchMessages]);

  useEffect(() => {
    // "smooth" here was the second half of the flicker: every streamed
    // chunk changes `messages`, re-running this effect and restarting a new
    // smooth-scroll animation on top of one that hadn't finished yet.
    // Combined with the container height also shifting as content grew,
    // that's what showed up as the input bar jittering up and down.
    // Snapping directly to position avoids stacking animations.
    // Only do this while the user is already near the bottom — otherwise a
    // deliberate scroll-up to reread history gets fought on every chunk.
    if (isNearBottomRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: "auto" });
    }
  }, [messages]);

  function handleMessagesScroll() {
    const el = messagesContainerRef.current;
    if (!el) return;
    const distanceFromBottom =
      el.scrollHeight - el.scrollTop - el.clientHeight;
    // Small threshold so it still counts as "at the bottom" even with a
    // pixel or two of rounding slack.
    isNearBottomRef.current = distanceFromBottom < 80;
  }

  useEffect(() => {
    if (!initialMessage || loading || streamingRef.current) return;
    pendingMessageRef.current = initialMessage;
    onMessageUsed?.();
    const form = document.querySelector("#chat-form") as HTMLFormElement;
    form?.requestSubmit();
  }, [initialMessage, loading, streaming, onMessageUsed]);

  // Close the chat-picker dropdown on outside click.
  useEffect(() => {
    if (!dropdownOpen) return;
    function handleClick(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [dropdownOpen]);

  function handleInputChange() {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setCanSend(!!inputRef.current?.value.trim());
    }, 150);
  }

  function startNewChat() {
    if (streaming) return;
    setChatId(null);
    setMessages([]);
    setStreamError(null);
    setDropdownOpen(false);
    isNearBottomRef.current = true;
    if (inputRef.current) {
      inputRef.current.value = "";
      inputRef.current.focus();
    }
    setCanSend(false);
  }

  function switchChat(id: string) {
    setDropdownOpen(false);
    if (streaming || id === chatId) return;
    setStreamError(null);
    isNearBottomRef.current = true;
    setChatId(id);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    // Guard first, synchronously, before reading anything else. `streaming`
    // (state) can't do this job — two calls fired close together (Enter +
    // click, or the initialMessage effect racing a manual submit) can both
    // observe `streaming === false` before either one's setStreaming(true)
    // has actually committed a re-render. streamingRef flips instantly, so
    // the second call is turned away immediately instead of racing the
    // first one's fetch/DB writes.
    if (streamingRef.current) return;

    const userMsg = (
      inputRef.current?.value.trim() ||
      pendingMessageRef.current ||
      ""
    ).trim();
    pendingMessageRef.current = null;
    if (!userMsg) return;

    streamingRef.current = true;

    let currentChatId = chatId;
    let isNewChat = false;

    if (!currentChatId) {
      try {
        const res = await fetch(`${BACKEND_URL}/api/repo/${repoId}/chats`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: userMsg.slice(0, 60) }),
        });
        const body = await res.json();
        currentChatId = body.data.id;
        isNewChat = true;
        skipNextHistoryFetchRef.current = true;
        setChatId(currentChatId);
      } catch {
        setStreamError("Failed to start a new chat. Please try again.");
        streamingRef.current = false;
        return;
      }
    }

    if (inputRef.current) inputRef.current.value = "";
    setCanSend(false);
    // Sending is a deliberate action — always land on the new message even
    // if the user had scrolled up to reread earlier history beforehand.
    isNearBottomRef.current = true;
    // Push the user message AND an empty assistant placeholder together.
    // Chunks mutate this placeholder's `content` directly as they arrive —
    // there's no separate shadow variable/state to reconcile at the end,
    // which is what kept going wrong before.
    const assistantId = crypto.randomUUID();
    setMessages((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        role: "USER",
        content: userMsg,
        createdAt: new Date().toISOString(),
      },
      {
        id: assistantId,
        role: "ASSISTANT",
        content: "",
        createdAt: new Date().toISOString(),
      },
    ]);
    setStreaming(true);
    setStreamError(null);

    if (isNewChat) {
      // Refresh the dropdown list in the background so the new chat shows
      // up with its title without blocking the send.
      loadChats();
    }

    // Declared outside the try so it's visible from the catch block too —
    // used to decide whether to leave the (possibly partial) placeholder in
    // place or remove it entirely when something goes wrong.
    let gotContent = false;

    try {
      const body: Record<string, unknown> = { content: userMsg };
      if (issueNumber) body.issueNumber = issueNumber;
      const res = await fetch(
        `${BACKEND_URL}/api/chats/${currentChatId}/messages`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );

      if (!res.ok) {
        setMessages((prev) => prev.filter((m) => m.id !== assistantId));
        setStreamError("Failed to send message. Please try again.");
        setStreaming(false);
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) {
        setMessages((prev) => prev.filter((m) => m.id !== assistantId));
        setStreamError("Failed to connect to the chat stream.");
        setStreaming(false);
        return;
      }

      const decoder = new TextDecoder();
      // Bytes from reader.read() rarely align with SSE event boundaries — a
      // single "data: ...\n\n" frame can easily be split across two reads.
      // Buffer everything and only process complete frames (delimited by the
      // blank line "\n\n"), carrying any trailing partial frame forward.
      let buffer = "";
      let done_ = false;
      // Tracks whether we actually saw a "[DONE]" frame, as opposed to the
      // stream just being empty at loop-exit time.
      let receivedDone = false;

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
          // Heartbeat/keep-alive lines look like ": ping" — SSE comments,
          // not data frames. They exist purely to keep proxies from
          // deciding the connection is idle/dead; nothing to parse here.
          if (frame.startsWith(":")) continue;

          const line = frame.split("\n").find((l) => l.startsWith("data: "));
          if (!line) continue;
          const payload = line.slice(6);

          if (payload === "[DONE]") {
            receivedDone = true;
            // A stream can legitimately finish having produced no content
            // (empty/aborted generation). Leaving that as a permanent blank
            // bubble is confusing — remove the placeholder and surface an
            // error instead.
            if (!gotContent) {
              setMessages((prev) => prev.filter((m) => m.id !== assistantId));
              setStreamError("No response was generated. Please try again.");
            }
            continue;
          }

          try {
            const parsed = JSON.parse(payload);
            if (parsed.error) {
              setMessages((prev) => prev.filter((m) => m.id !== assistantId));
              setStreamError(
                typeof parsed.error === "string"
                  ? parsed.error
                  : "Something went wrong generating a response.",
              );
              setStreaming(false);
              return;
            }
            if (parsed.content) {
              gotContent = true;
              // Mutate the placeholder in place — matched by id, not by
              // array position, so it stays correct regardless of anything
              // else touching `messages` in between.
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId
                    ? { ...m, content: m.content + parsed.content }
                    : m,
                ),
              );
            }
          } catch {}
        }
      }

      // If we exhausted the stream without ever seeing a "[DONE]" frame, the
      // connection was almost certainly dropped somewhere between the server
      // and the browser.
      if (!receivedDone && !streamError) {
        if (!gotContent) {
          setMessages((prev) => prev.filter((m) => m.id !== assistantId));
        }
        setStreamError(
          "The response didn't stream through. This usually means something between the server and browser is buffering the connection — refresh to see if the reply saved.",
        );
      }
    } catch {
      if (!gotContent) {
        setMessages((prev) => prev.filter((m) => m.id !== assistantId));
      }
      setStreamError("Connection lost while streaming. Please try again.");
    } finally {
      streamingRef.current = false;
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

  const currentLabel = chatId
    ? chatLabel(
        chats.find((c) => c.id === chatId) ?? {
          id: chatId,
          title: null,
          createdAt: "",
        },
        chats.findIndex((c) => c.id === chatId),
        chats.length,
      )
    : "New chat";

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Top bar: chat picker dropdown + new chat */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-neutral-900 shrink-0">
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setDropdownOpen((v) => !v)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-neutral-800 text-sm text-neutral-200 hover:border-neutral-600 transition-colors"
          >
            <FiMessageSquare className="w-3.5 h-3.5 text-neutral-500" />
            <span className="max-w-[180px] truncate">{currentLabel}</span>
            <FiChevronDown
              className={`w-3.5 h-3.5 text-neutral-500 transition-transform ${
                dropdownOpen ? "rotate-180" : ""
              }`}
            />
          </button>

          {dropdownOpen && (
            <div className="absolute left-0 top-full mt-1.5 w-64 rounded-lg border border-neutral-800 bg-neutral-950 shadow-xl z-20 overflow-hidden">
              <button
                onClick={startNewChat}
                disabled={streaming}
                className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-neutral-200 hover:bg-neutral-900 disabled:opacity-30 disabled:cursor-not-allowed transition-colors border-b border-neutral-900"
              >
                <FiPlus className="w-3.5 h-3.5" />
                New chat
              </button>
              <div className="max-h-64 overflow-y-auto py-1">
                {chats.length === 0 && (
                  <p className="text-xs text-neutral-700 px-3 py-2">
                    No chats yet
                  </p>
                )}
                {chats.map((c, i) => (
                  <button
                    key={c.id}
                    onClick={() => switchChat(c.id)}
                    disabled={streaming}
                    className={`w-full text-left px-3 py-2 text-sm truncate transition-colors disabled:cursor-not-allowed ${
                      c.id === chatId
                        ? "bg-neutral-900 text-white"
                        : "text-neutral-400 hover:text-neutral-100 hover:bg-neutral-900/60"
                    }`}
                    title={chatLabel(c, i, chats.length)}
                  >
                    {chatLabel(c, i, chats.length)}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Conversation */}
      <div
        ref={messagesContainerRef}
        onScroll={handleMessagesScroll}
        className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4 no-scrollbar"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none", scrollBehavior: "smooth" }}
      >
        <MessageList
          messages={messages}
          streaming={streaming}
          streamError={streamError}
        />
        <div ref={messagesEndRef} />
      </div>
      <style jsx>{`
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
      `}</style>

      <form
        id="chat-form"
        onSubmit={handleSubmit}
        className="flex items-center gap-2 p-3 border-t border-neutral-900 shrink-0"
      >
        <input
          ref={inputRef}
          defaultValue=""
          onChange={handleInputChange}
          placeholder="Ask about the codebase…"
          disabled={streaming}
          className="flex-1 px-4 py-2.5 rounded-full bg-neutral-900/60 border border-neutral-800 text-white placeholder-neutral-600 focus:outline-none focus:ring-1 focus:ring-neutral-500 focus:border-neutral-600 text-sm disabled:opacity-40 transition-colors"
          style={{ fontFamily: "var(--font-sans)" }}
        />
        <button
          type="submit"
          disabled={streaming || !canSend}
          className="w-10 h-10 shrink-0 flex items-center justify-center rounded-full bg-white text-black hover:bg-neutral-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          aria-label="Send message"
        >
          <FiSend className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
}