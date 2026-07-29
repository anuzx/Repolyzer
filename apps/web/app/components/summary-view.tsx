"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";

const components: Components = {
  h1: ({ children, ...props }) => (
    <h1 className="text-xl text-white font-medium mb-4 mt-6 first:mt-0" {...props}>
      {children}
    </h1>
  ),
  h2: ({ children, ...props }) => (
    <h2 className="text-lg text-white font-medium mb-3 mt-5" {...props}>
      {children}
    </h2>
  ),
  h3: ({ children, ...props }) => (
    <h3 className="text-base text-white font-medium mb-2 mt-4" {...props}>
      {children}
    </h3>
  ),
  p: ({ children, ...props }) => (
    <p className="text-sm text-neutral-300 leading-relaxed mb-3" {...props}>
      {children}
    </p>
  ),
  ul: ({ children, ...props }) => (
    <ul className="text-sm text-neutral-300 mb-3 space-y-1 list-disc list-inside" {...props}>
      {children}
    </ul>
  ),
  ol: ({ children, ...props }) => (
    <ol className="text-sm text-neutral-300 mb-3 space-y-1 list-decimal list-inside" {...props}>
      {children}
    </ol>
  ),
  li: ({ children, ...props }) => (
    <li className="text-sm text-neutral-300" {...props}>
      {children}
    </li>
  ),
  code: ({ children, className, ...props }) => {
    const isInline = !className;
    if (isInline) {
      return (
        <code
          className="px-1.5 py-0.5 rounded bg-neutral-900 text-neutral-200 text-xs"
          style={{ fontFamily: "var(--font-mono)" }}
          {...props}
        >
          {children}
        </code>
      );
    }
    return (
      <pre className="mb-4 p-4 rounded-lg bg-neutral-950 border border-neutral-800 overflow-x-auto">
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
  a: ({ children, href, ...props }) => (
    <a
      className="text-neutral-300 underline underline-offset-2 hover:text-white transition-colors"
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      {...props}
    >
      {children}
    </a>
  ),
  blockquote: ({ children, ...props }) => (
    <blockquote className="border-l-2 border-neutral-700 pl-4 mb-3 text-sm text-neutral-400 italic" {...props}>
      {children}
    </blockquote>
  ),
  hr: (props) => <hr className="border-neutral-800 my-6" {...props} />,
  table: ({ children, ...props }) => (
    <div className="overflow-x-auto mb-4">
      <table className="min-w-full text-sm text-neutral-300 border-collapse" {...props}>
        {children}
      </table>
    </div>
  ),
  th: ({ children, ...props }) => (
    <th className="border border-neutral-800 px-3 py-2 text-left text-white font-medium" {...props}>
      {children}
    </th>
  ),
  td: ({ children, ...props }) => (
    <td className="border border-neutral-800 px-3 py-2" {...props}>
      {children}
    </td>
  ),
};

export function SummaryView({ content }: { content: string }) {
  if (!content) {
    return (
      <div className="flex-1 flex items-center justify-center text-neutral-600 text-sm">
        No summary available
      </div>
    );
  }

  return (
    <div className="overflow-y-auto flex-1 p-6">
      <div className="max-w-3xl mx-auto">
        <ReactMarkdown components={components} remarkPlugins={[remarkGfm]}>
          {content}
        </ReactMarkdown>
      </div>
    </div>
  );
}
