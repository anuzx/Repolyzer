"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";
import { FiCopy, FiCheck, FiMaximize, FiMinimize } from "react-icons/fi";

const components: Components = {
  h1: ({ children, ...props }) => (
    <h1 className="text-xl text-white font-medium mb-4 mt-6 first:mt-0 break-words" {...props}>
      {children}
    </h1>
  ),
  h2: ({ children, ...props }) => (
    <h2 className="text-lg text-white font-medium mb-3 mt-5 break-words" {...props}>
      {children}
    </h2>
  ),
  h3: ({ children, ...props }) => (
    <h3 className="text-base text-white font-medium mb-2 mt-4 break-words" {...props}>
      {children}
    </h3>
  ),
  p: ({ children, ...props }) => (
    <p className="text-sm text-neutral-300 leading-relaxed mb-3 break-words" {...props}>
      {children}
    </p>
  ),
  ul: ({ children, ...props }) => (
    <ul className="text-sm text-neutral-300 mb-3 space-y-1 list-disc list-inside break-words" {...props}>
      {children}
    </ul>
  ),
  ol: ({ children, ...props }) => (
    <ol className="text-sm text-neutral-300 mb-3 space-y-1 list-decimal list-inside break-words" {...props}>
      {children}
    </ol>
  ),
  li: ({ children, ...props }) => (
    <li className="text-sm text-neutral-300 break-words" {...props}>
      {children}
    </li>
  ),
  code: ({ children, className, ...props }) => {
    const isInline = !className;
    if (isInline) {
      return (
        <code
          className="px-1.5 py-0.5 rounded bg-neutral-900 text-neutral-200 text-xs break-words"
          style={{ fontFamily: "var(--font-mono)" }}
          {...props}
        >
          {children}
        </code>
      );
    }
    return (
      <pre className="mb-4 p-4 rounded-lg bg-neutral-950 border border-neutral-800 overflow-x-auto max-w-full">
        <code
          className="text-xs text-neutral-200 leading-relaxed whitespace-pre-wrap break-words"
          style={{ fontFamily: "var(--font-mono)" }}
          {...props}
        >
          {children}
        </code>
      </pre>
    );
  },
  pre: ({ children }) => <>{children}</>,
  a: ({ children, href, ...props }) => (
    <a
      className="text-neutral-300 underline underline-offset-2 hover:text-white transition-colors break-words"
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      {...props}
    >
      {children}
    </a>
  ),
  blockquote: ({ children, ...props }) => (
    <blockquote className="border-l-2 border-neutral-700 pl-4 mb-3 text-sm text-neutral-400 italic break-words" {...props}>
      {children}
    </blockquote>
  ),
  hr: (props) => <hr className="border-neutral-800 my-6" {...props} />,
  table: ({ children, ...props }) => (
    <div className="overflow-x-auto mb-4 max-w-full">
      <table className="min-w-full text-sm text-neutral-300 border-collapse" {...props}>
        {children}
      </table>
    </div>
  ),
  th: ({ children, ...props }) => (
    <th className="border border-neutral-800 px-3 py-2 text-left text-white font-medium break-words" {...props}>
      {children}
    </th>
  ),
  td: ({ children, ...props }) => (
    <td className="border border-neutral-800 px-3 py-2 break-words" {...props}>
      {children}
    </td>
  ),
};

export function SummaryView({ content }: { content: string }) {
  const [copied, setCopied] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onChange() {
      setIsFullscreen(document.fullscreenElement === containerRef.current);
    }
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(content).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }, [content]);

  const toggleFullscreen = useCallback(() => {
    if (!containerRef.current) return;
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      containerRef.current.requestFullscreen();
    }
  }, []);

  if (!content) {
    return (
      <div className="flex-1 flex items-center justify-center text-neutral-600 text-sm">
        No summary available
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`flex-1 flex flex-col min-h-0 min-w-0 ${
        isFullscreen ? "bg-black" : ""
      }`}
    >
      {/* Toolbar */}
      <div className="sticky top-0 z-10 flex items-center gap-1.5 px-4 py-2 bg-black/90 backdrop-blur-sm border-b border-neutral-900 shrink-0">
        <span
          className="text-xs text-neutral-500 uppercase tracking-wide"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          Summary
        </span>
        <div className="ml-auto flex items-center gap-1.5">
          <button
            onClick={handleCopy}
            title={copied ? "Copied" : "Copy summary"}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-neutral-800 text-xs text-neutral-400 hover:text-white hover:border-neutral-600 transition-colors"
          >
            {copied ? (
              <FiCheck className="w-3.5 h-3.5" />
            ) : (
              <FiCopy className="w-3.5 h-3.5" />
            )}
            {copied ? "Copied" : "Copy"}
          </button>
          <button
            onClick={toggleFullscreen}
            title={isFullscreen ? "Exit full screen" : "Full screen"}
            className="flex items-center justify-center w-7 h-7 rounded-md border border-neutral-800 text-neutral-400 hover:text-white hover:border-neutral-600 transition-colors"
          >
            {isFullscreen ? (
              <FiMinimize className="w-3.5 h-3.5" />
            ) : (
              <FiMaximize className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
      </div>

      {/* Content */}
      <div
        className="overflow-y-auto overflow-x-hidden flex-1 min-h-0 min-w-0 p-6 no-scrollbar"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none", scrollBehavior: "smooth" }}
      >
        <div className="min-w-0 max-w-full">
          <ReactMarkdown components={components} remarkPlugins={[remarkGfm]}>
            {content}
          </ReactMarkdown>
        </div>
      </div>
      <style jsx>{`
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
      `}</style>
    </div>
  );
}