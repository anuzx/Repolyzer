"use client";

import { useState, useRef, useCallback, type ReactNode } from "react";

export function ZoomContainer({ children }: { children: ReactNode }) {
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const dragging = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  function doZoom(factor: number, cx?: number, cy?: number) {
    setZoom((z) => {
      const next = Math.max(0.1, Math.min(z * factor, 5));
      if (cx !== undefined && cy !== undefined && containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const dx = cx - rect.left - pan.x;
        const dy = cy - rect.top - pan.y;
        setPan((p) => ({
          x: p.x - dx * (next / z - 1),
          y: p.y - dy * (next / z - 1),
        }));
      }
      return next;
    });
  }

  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      doZoom(e.deltaY > 0 ? 0.9 : 1.1, e.clientX, e.clientY);
    }
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 0) {
      dragging.current = true;
      lastPos.current = { x: e.clientX, y: e.clientY };
      e.preventDefault();
    }
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragging.current) return;
    const dx = e.clientX - lastPos.current.x;
    const dy = e.clientY - lastPos.current.y;
    lastPos.current = { x: e.clientX, y: e.clientY };
    setPan((p) => ({ x: p.x + dx, y: p.y + dy }));
  }, []);

  const handleMouseUp = useCallback(() => {
    dragging.current = false;
  }, []);

  function fitToWidth() {
    if (!containerRef.current) return;
    const containerW = containerRef.current.clientWidth;
    const content = containerRef.current.firstElementChild?.firstElementChild;
    if (!content) return;
    const contentW = (content as HTMLElement).scrollWidth;
    if (contentW === 0) return;
    const fit = (containerW - 40) / contentW;
    setZoom(Math.max(0.1, Math.min(fit, 5)));
    setPan({ x: 0, y: 0 });
  }

  function reset() {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }

  const pct = Math.round(zoom * 100);

  return (
    <div className="relative flex flex-col flex-1 min-h-0">
      <div className="sticky top-0 z-10 flex items-center gap-1.5 p-2 bg-gray-900/90 backdrop-blur-sm border-b border-gray-800 shrink-0">
        <button
          onClick={() => doZoom(0.8)}
          className="px-2.5 py-1 text-sm text-white border border-white rounded hover:bg-white hover:text-black transition-colors"
          title="Zoom out"
        >
          -
        </button>
        <span className="text-sm text-gray-400 w-10 text-center tabular-nums">
          {pct}%
        </span>
        <button
          onClick={() => doZoom(1.25)}
          className="px-2.5 py-1 text-sm text-white border border-white rounded hover:bg-white hover:text-black transition-colors"
          title="Zoom in"
        >
          +
        </button>
        <div className="w-px h-5 bg-gray-700 mx-1" />
        <button
          onClick={fitToWidth}
          className="px-2.5 py-1 text-xs text-white border border-white rounded hover:bg-white hover:text-black transition-colors"
          title="Fit to width"
        >
          Fit
        </button>
        <button
          onClick={reset}
          className="px-2.5 py-1 text-xs text-white border border-white rounded hover:bg-white hover:text-black transition-colors"
          title="Reset zoom and pan"
        >
          Reset
        </button>
        <span className="ml-auto text-xs text-gray-600">
          {zoom !== 1 || pan.x !== 0 || pan.y !== 0 ? "drag to pan" : "scroll to zoom"}
        </span>
      </div>

      <div
        ref={containerRef}
        className="overflow-hidden flex-1 min-h-0 cursor-grab active:cursor-grabbing"
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <div
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: "0 0",
            width: `${100 / zoom}%`,
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}