"use client";

import { useEffect, useState, useCallback } from "react";
import { ZoomContainer } from "./zoom-container";

export function MermaidView({ chart, id }: { chart: string; id: string }) {
  const [svg, setSvg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!chart) return;
    let cancelled = false;
    setSvg(null);
    setError(null);

    async function render() {
      const mermaidModule = await import("mermaid");
      const mermaid = mermaidModule.default;

      mermaid.initialize({
        startOnLoad: false,
        theme: "dark",
        themeVariables: {
          primaryColor: "#1e293b",
          primaryTextColor: "#e2e8f0",
          primaryBorderColor: "#475569",
          lineColor: "#64748b",
          secondaryColor: "#0f172a",
          tertiaryColor: "#1e293b",
        },
      });

      if (cancelled) return;

      try {
        const { svg: result } = await mermaid.render(id, chart);
        if (!cancelled) setSvg(result);
      } catch (err) {
        if (!cancelled) {
          const msg = err instanceof Error ? err.message : String(err);
          console.error("[MermaidView] render error for", id, ":", msg);
          console.error("[MermaidView] chart:", chart);
          setError(msg);
        }
      }
    }

    render();
    return () => {
      cancelled = true;
    };
  }, [chart, id]);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(chart).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [chart]);

  if (!chart) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        No diagram data
      </div>
    );
  }

  return (
    <ZoomContainer>
      {error ? (
        <div className="p-6">
          <div className="flex items-center gap-2 mb-3 text-gray-400">
            <span className="font-medium">Failed to render diagram</span>
            <span className="text-xs text-gray-500">({error})</span>
          </div>

          <div className="flex gap-2 mb-3">
            <button
              onClick={handleCopy}
              className="px-3 py-1.5 text-xs bg-gray-800 rounded hover:bg-gray-700 text-gray-300 transition-colors"
            >
              {copied ? "Copied!" : "Copy raw source"}
            </button>
          </div>

          <pre className="text-xs text-gray-400 bg-gray-950 rounded-lg p-4 overflow-auto max-h-96 whitespace-pre-wrap border border-gray-800">
            {chart}
          </pre>

          <p className="mt-3 text-xs text-gray-600">
            Paste the source into{" "}
            <a
              href="https://mermaid.live"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-400 hover:underline"
            >
              mermaid.live
            </a>{" "}
            to debug syntax issues
          </p>
        </div>
      ) : svg ? (
        <div
          className="flex justify-center p-4"
          style={{ minHeight: 300 }}
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      ) : (
        <div className="flex items-center justify-center h-64 text-gray-500">
          Rendering diagram...
        </div>
      )}
    </ZoomContainer>
  );
}
