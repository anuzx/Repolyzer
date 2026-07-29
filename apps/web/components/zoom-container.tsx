"use client";

import {
  useEffect,
  useRef,
  useState,
  useCallback,
  type MutableRefObject,
  type ReactNode,
} from "react";

export type ZoomContainerHandle = {
  /** Returns true if it could measure content and fit it; false if content isn't laid out yet. */
  fit: () => boolean;
  reset: () => void;
};

export function ZoomContainer({
  children,
  apiRef,
}: {
  children: ReactNode;
  apiRef?: MutableRefObject<ZoomContainerHandle | null>;
}) {
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [interacting, setInteracting] = useState(false);
  const dragging = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const zoomRef = useRef(zoom);
  const panRef = useRef(pan);
  zoomRef.current = zoom;
  panRef.current = pan;

  const clamp = (z: number) => Math.max(1, z);

  const zoomAt = useCallback((factor: number, cx?: number, cy?: number) => {
    const z = zoomRef.current;
    const p = panRef.current;
    const next = clamp(z * factor);
    if (next === z) return;

    if (cx !== undefined && cy !== undefined && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const dx = cx - rect.left - p.x;
      const dy = cy - rect.top - p.y;
      const newPan = {
        x: p.x - dx * (next / z - 1),
        y: p.y - dy * (next / z - 1),
      };
      panRef.current = newPan;
      setPan(newPan);
    }

    zoomRef.current = next;
    setZoom(next);
  }, []);

  // Measures the *unscaled* natural size of the content (contentRef shrink-
  // wraps to it regardless of current zoom, since CSS transforms never
  // affect layout size) and scales/centers it to fill the viewport.
  // Returns false if the content isn't measurable yet, so the caller can
  // retry on the next frame instead of dividing by zero.
  const fit = useCallback((): boolean => {
    const container = containerRef.current;
    const content = contentRef.current;
    if (!container || !content) return false;

    const containerW = container.clientWidth;
    const containerH = container.clientHeight;
    const contentW = content.scrollWidth;
    const contentH = content.scrollHeight;
    if (!containerW || !containerH || !contentW || !contentH) return false;

    const fitW = (containerW - 64) / contentW;
    const fitH = (containerH - 64) / contentH;
    // Never auto-zoom in past 100% — "fit" should shrink oversized diagrams,
    // not blow up tiny ones.
    const next = clamp(Math.min(fitW, fitH, 1));

    zoomRef.current = next;
    panRef.current = { x: (containerW - contentW * next) / 2, y: 24 };
    setZoom(next);
    setPan(panRef.current);
    return true;
  }, []);

  const reset = useCallback(() => {
    zoomRef.current = 1;
    panRef.current = { x: 0, y: 0 };
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, []);

  useEffect(() => {
    if (apiRef) apiRef.current = { fit, reset };
    return () => {
      if (apiRef) apiRef.current = null;
    };
  }, [apiRef, fit, reset]);

  // Plain scroll zooms (centered on the cursor) — no modifier key needed.
  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();
      const factor = Math.exp(-e.deltaY * 0.0018);
      zoomAt(factor, e.clientX, e.clientY);
    },
    [zoomAt],
  );

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    dragging.current = true;
    lastPos.current = { x: e.clientX, y: e.clientY };
    setInteracting(true);
    e.preventDefault();
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragging.current) return;
    const dx = e.clientX - lastPos.current.x;
    const dy = e.clientY - lastPos.current.y;
    lastPos.current = { x: e.clientX, y: e.clientY };
    const next = { x: panRef.current.x + dx, y: panRef.current.y + dy };
    panRef.current = next;
    setPan(next);
  }, []);

  const endDrag = useCallback(() => {
    dragging.current = false;
    setInteracting(false);
  }, []);

  const pct = Math.round(zoom * 100);

  return (
    <div className="relative flex flex-col flex-1 min-h-0 bg-black">
      <div className="sticky top-0 z-10 flex items-center gap-1.5 px-3 py-2 bg-black/90 backdrop-blur-sm border-b border-neutral-900 shrink-0">
        <button
          onClick={() => zoomAt(0.8)}
          className="w-7 h-7 flex items-center justify-center text-sm text-white border border-neutral-700 rounded hover:bg-white hover:text-black transition-colors"
          title="Zoom out"
        >
          −
        </button>
        <span
          className="text-xs text-neutral-400 w-11 text-center tabular-nums"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          {pct}%
        </span>
        <button
          onClick={() => zoomAt(1.25)}
          className="w-7 h-7 flex items-center justify-center text-sm text-white border border-neutral-700 rounded hover:bg-white hover:text-black transition-colors"
          title="Zoom in"
        >
          +
        </button>
        <div className="w-px h-4 bg-neutral-800 mx-1" />
        <button
          onClick={fit}
          className="px-2.5 py-1 text-[11px] tracking-wide uppercase text-white border border-neutral-700 rounded hover:bg-white hover:text-black transition-colors"
          style={{ fontFamily: "var(--font-mono)" }}
          title="Fit to screen"
        >
          Fit
        </button>
        <button
          onClick={reset}
          className="px-2.5 py-1 text-[11px] tracking-wide uppercase text-white border border-neutral-700 rounded hover:bg-white hover:text-black transition-colors"
          style={{ fontFamily: "var(--font-mono)" }}
          title="Reset zoom and pan"
        >
          Reset
        </button>
        <span
          className="ml-auto text-[11px] text-neutral-600 hidden sm:inline"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          scroll to zoom · drag to pan
        </span>
      </div>

      <div
        ref={containerRef}
        className={`relative overflow-hidden flex-1 min-h-0 ${
          interacting ? "cursor-grabbing" : "cursor-grab"
        }`}
        style={{
          backgroundImage:
            "radial-gradient(circle, #1a1a1a 1px, transparent 1px)",
          backgroundSize: "24px 24px",
          backgroundPosition: `${pan.x % 24}px ${pan.y % 24}px`,
        }}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={endDrag}
        onMouseLeave={endDrag}
        onDoubleClick={reset}
      >
        {/* Shrink-wraps to its natural content size (inline-block), so
            scrollWidth/scrollHeight always reflect the true diagram size —
            transforms never distort layout measurements. */}
        <div
          ref={contentRef}
          style={{
            display: "inline-block",
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: "0 0",
            transition: interacting ? "none" : "transform 0.15s ease-out",
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}