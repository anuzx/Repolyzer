"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { ZoomContainer, type ZoomContainerHandle } from "./zoom-container";

export function MermaidView({ chart, id }: { chart: string; id: string }) {
  const [svg, setSvg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const zoomApiRef = useRef<ZoomContainerHandle | null>(null);

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
        theme: "base",
        themeVariables: {
          // Clean, max-contrast blueprint look: white node fills with black
          // text, on a solid black canvas — this reads correctly regardless
          // of which mermaid diagram type is drawn.
          background: "transparent",
          primaryColor: "#f2f2ef",
          primaryTextColor: "#0a0a0a",
          primaryBorderColor: "#0a0a0a",
          secondaryColor: "#f2f2ef",
          secondaryTextColor: "#0a0a0a",
          secondaryBorderColor: "#0a0a0a",
          tertiaryColor: "#f2f2ef",
          tertiaryTextColor: "#0a0a0a",
          tertiaryBorderColor: "#0a0a0a",
          lineColor: "#d4d4d0",
          textColor: "#f2f2ef",
          nodeTextColor: "#0a0a0a",
          mainBkg: "#f2f2ef",
          edgeLabelBackground: "#000000",
          clusterBkg: "#141414",
          clusterBorder: "#f2f2ef",
          titleColor: "#f2f2ef",
          actorBkg: "#f2f2ef",
          actorTextColor: "#0a0a0a",
          actorBorder: "#0a0a0a",
          signalColor: "#d4d4d0",
          signalTextColor: "#f2f2ef",
          labelBoxBkgColor: "#f2f2ef",
          labelTextColor: "#0a0a0a",
          classText: "#0a0a0a",
          fontFamily: "JetBrains Mono, ui-monospace, monospace",
          fontSize: "14px",
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

  // Auto-fit once the diagram is actually laid out. fit() returns false if
  // the content isn't measurable yet (e.g. the first paint frame), so we
  // retry on the next frame instead of computing a bogus zoom level.
  useEffect(() => {
    if (!svg) return;
    let raf = 0;
    let attempts = 0;
    const tryFit = () => {
      const ok = zoomApiRef.current?.fit();
      if (!ok && attempts < 20) {
        attempts += 1;
        raf = requestAnimationFrame(tryFit);
      }
    };
    raf = requestAnimationFrame(tryFit);
    return () => cancelAnimationFrame(raf);
  }, [svg]);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(chart).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [chart]);

  if (!chart) {
    return (
      <div className="flex items-center justify-center h-64 text-neutral-600 text-sm">
        No diagram data
      </div>
    );
  }

  return (
    <ZoomContainer apiRef={zoomApiRef}>
      {error ? (
        <div className="p-6 max-w-2xl">
          <div className="flex items-center gap-2 mb-3 text-neutral-400">
            <span className="w-1.5 h-1.5 rounded-full bg-neutral-600 shrink-0" />
            <span className="font-medium text-sm">
              Failed to render diagram
            </span>
          </div>
          <p
            className="text-xs text-neutral-600 mb-4"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            {error}
          </p>

          <div className="flex gap-2 mb-3">
            <button
              onClick={handleCopy}
              className="px-3 py-1.5 text-xs bg-white text-black rounded hover:bg-neutral-200 transition-colors font-medium"
            >
              {copied ? "Copied" : "Copy raw source"}
            </button>
          </div>

          <pre
            className="text-xs text-neutral-400 bg-neutral-950 rounded-lg p-4 overflow-auto max-h-96 whitespace-pre-wrap border border-neutral-800"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            {chart}
          </pre>

          <p className="mt-3 text-xs text-neutral-600">
            Paste the source into{" "}
            <a
              href="https://mermaid.live"
              target="_blank"
              rel="noopener noreferrer"
              className="text-neutral-300 hover:text-white underline underline-offset-2"
            >
              mermaid.live
            </a>{" "}
            to debug syntax issues
          </p>
        </div>
      ) : svg ? (
        <div
          className="p-10"
          style={{ minHeight: 300, minWidth: 300 }}
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      ) : (
        <div className="flex items-center justify-center h-64 gap-2 text-neutral-600 text-sm">
          <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
          Rendering diagram…
        </div>
      )}
    </ZoomContainer>
  );
}