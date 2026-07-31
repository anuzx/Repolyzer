"use client";

import Link from "next/link";

const FEATURES = [
  {
    title: "System Architecture",
    body: "A layered map of the codebase presentation, API, service, and data generated the moment analysis finishes.",
  },
  {
    title: "File Dependencies",
    body: "Every import traced into a dependency graph, so you can see what breaks before you touch it.",
  },
  {
    title: "Class Diagrams",
    body: "Properties, methods, and inheritance chains pulled straight out of the source.",
  },
  {
    title: "Chat With The Repo",
    body: "Ask a question, get an answer grounded in the actual files not a guess.",
  },
  {
    title: "Resolve Issues Faster",
    body: "Pull an open GitHub issue straight into the chat it already knows the codebase, so it can point to the exact files and functions involved and talk you through a fix.",
  },
];

const PIPELINE = [
  {
    n: "01",
    title: "Clone",
    body: "The repository is pulled down and indexed file by file.",
    tag: "CLONING",
  },
  {
    n: "02",
    title: "Parse & summarize",
    body: "Every file is parsed into its real structure, then distilled into a plain-language summary.",
    tag: "PARSING → SUMMARY",
  },
  {
    n: "03",
    title: "Chunk & embed",
    body: "Code is split into retrievable chunks and embedded for grounded, cited answers.",
    tag: "CHUNKING → EMBEDDING",
  },
  {
    n: "04",
    title: "Ready",
    body: "Architecture, diagrams, chat, and issues all queryable in one place.",
    tag: "COMPLETED",
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-black relative overflow-x-hidden">
      {/* blueprint dot-grid backdrop */}
      <div
        className="pointer-events-none fixed inset-0 opacity-[0.15]"
        style={{
          backgroundImage:
            "radial-gradient(circle, #ffffff 1px, transparent 1px)",
          backgroundSize: "28px 28px",
          maskImage:
            "radial-gradient(ellipse 70% 50% at 50% 0%, black 0%, transparent 70%)",
          WebkitMaskImage:
            "radial-gradient(ellipse 70% 50% at 50% 0%, black 0%, transparent 70%)",
        }}
      />

      {/* Nav */}
      <nav className="relative border-b border-neutral-900/80 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <circle cx="3" cy="3" r="2.2" fill="#5eead4" />
              <circle cx="15" cy="3" r="2.2" fill="#5eead4" opacity="0.5" />
              <circle cx="9" cy="15" r="2.2" fill="#5eead4" opacity="0.5" />
              <path
                d="M4.5 4.5L8 13.5M13.5 4.5L10 13.5M5 3H13"
                stroke="#5eead4"
                strokeWidth="1"
                opacity="0.6"
              />
            </svg>
            <span
              className="text-white text-sm tracking-tight"
              style={{ fontFamily: "var(--font-display)", fontWeight: 500 }}
            >
              Repolyzer
            </span>
          </div>
          <div className="flex items-center gap-6">
            <a
              href="#pipeline"
              className="hidden sm:inline text-xs tracking-wide text-neutral-300 hover:text-neutral-200 transition-colors"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              HOW IT WORKS
            </a>
            <a
              href="https://github.com/anuzx/Repolyzer"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 pl-3 pr-2.5 py-1.5 rounded-md border border-neutral-500 text-neutral-200 text-sm hover:border-neutral-300 hover:text-white transition-colors"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
              </svg>
              <span className="hidden sm:inline">Star</span>
              <span className="flex items-center gap-1 pl-2 border-l border-neutral-600">
                <svg width="12" height="12" viewBox="0 0 20 20" fill="currentColor" className="text-[#5eead4]">
                  <path d="M9.049 2.927c.3-.921 1.602-.921 1.902 0l1.286 3.958a1 1 0 00.95.69h4.163c.969 0 1.371 1.24.588 1.81l-3.368 2.447a1 1 0 00-.363 1.118l1.287 3.957c.3.922-.755 1.688-1.539 1.118l-3.367-2.447a1 1 0 00-1.176 0l-3.367 2.447c-.784.57-1.838-.196-1.539-1.118l1.287-3.957a1 1 0 00-.363-1.118L2.062 9.385c-.783-.57-.38-1.81.588-1.81h4.163a1 1 0 00.95-.69l1.286-3.958z" />
                </svg>
              </span>
            </a>
            <Link
              href="/dashboard"
              className="px-4 py-2 rounded-md bg-white text-black text-sm font-medium hover:bg-neutral-200 transition-colors"
            >
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative max-w-6xl mx-auto px-6 pt-20 pb-24 grid lg:grid-cols-2 gap-16 items-center">
        <div>
          <p
            className="text-[11px] tracking-[0.25em] text-neutral-300 uppercase mb-4"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            GitHub architecture, mapped
          </p>
          <h1
            className="text-5xl sm:text-6xl text-white tracking-tight leading-[1.05]"
            style={{ fontFamily: "var(--font-display)", fontWeight: 500 }}
          >
            See the architecture
            <br />
            before you touch the code.
          </h1>
          <p className="text-neutral-200 mt-6 text-[16px] leading-relaxed max-w-md">
            Paste a repository URL. Repolyzer clones it, reads it, and hands
            back its system architecture, file dependencies, class diagrams
            plus a chat window grounded in the actual source that can walk
            you through open issues, not just answer questions about them.
          </p>
          <div className="flex items-center gap-4 mt-9">
            <Link
              href="/dashboard"
              className="px-6 py-3 rounded-md bg-white text-black text-sm font-medium hover:bg-neutral-200 transition-colors"
            >
              Get Started
            </Link>
            <a
              href="#pipeline"
              className="px-6 py-3 rounded-md border border-neutral-800 text-neutral-200 text-sm font-medium hover:border-neutral-600 hover:text-white transition-colors"
            >
              How it works
            </a>
          </div>
        </div>

        {/* Signature: the real layer taxonomy, drawn as a live diagram */}
        <div className="relative">
          <div className="rounded-xl border border-neutral-800/80 bg-neutral-950/60 p-6">
            <ArchitectureGraphic />
          </div>
          <p
            className="mt-3 text-[11px] tracking-[0.2em] text-neutral-400 uppercase text-center"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            generated architecture map
          </p>
        </div>
      </section>

      {/* Features */}
      <section className="relative max-w-6xl mx-auto px-6 py-16 border-t border-neutral-900">
        <h2
          className="text-xs tracking-[0.2em] uppercase text-neutral-400 mb-8"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          What you get back
        </h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="group p-5 rounded-lg bg-neutral-950/60 border border-neutral-800/80 hover:border-[#5eead4]/40 hover:-translate-y-0.5 transition-all duration-200"
            >
              <h3 className="text-white text-[15px] font-medium mb-2">
                {f.title}
              </h3>
              <p className="text-neutral-300 text-sm leading-relaxed">
                {f.body}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Pipeline — a real, ordered sequence, so numbering carries meaning */}
      <section
        id="pipeline"
        className="relative max-w-6xl mx-auto px-6 py-16 border-t border-neutral-900"
      >
        <h2
          className="text-xs tracking-[0.2em] uppercase text-neutral-400 mb-8"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          How it works
        </h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-px bg-neutral-900 rounded-lg overflow-hidden">
          {PIPELINE.map((step) => (
            <div key={step.n} className="bg-black p-6">
              <span
                className="text-[#5eead4]/70 text-xs"
                style={{ fontFamily: "var(--font-mono)" }}
              >
                {step.n}
              </span>
              <h3 className="text-white text-[15px] font-medium mt-2 mb-2">
                {step.title}
              </h3>
              <p className="text-neutral-300 text-sm leading-relaxed mb-3">
                {step.body}
              </p>
              <span
                className="text-[10px] tracking-[0.15em] text-neutral-400 uppercase"
                style={{ fontFamily: "var(--font-mono)" }}
              >
                {step.tag}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* Footer CTA */}
      <section className="relative max-w-6xl mx-auto px-6 py-20 border-t border-neutral-900 text-center">
        <h2
          className="text-3xl text-white tracking-tight"
          style={{ fontFamily: "var(--font-display)", fontWeight: 500 }}
        >
          Paste a URL. Get the map.
        </h2>
        <Link
          href="/dashboard"
          className="inline-block mt-7 px-7 py-3 rounded-md bg-white text-black text-sm font-medium hover:bg-neutral-200 transition-colors"
        >
          Get Started
        </Link>
      </section>

      <footer className="relative border-t border-neutral-900 py-8">
        <p
          className="text-center text-xs text-neutral-400"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          Repolyzer
        </p>
      </footer>
    </div>
  );
}

function ArchitectureGraphic() {
  const nodes = [
    { id: "presentation", label: "Presentation", x: 105, y: 10, w: 130 },
    { id: "api", label: "API", x: 105, y: 80, w: 130 },
    { id: "controller", label: "Controller", x: 105, y: 150, w: 130 },
    { id: "service", label: "Service", x: 105, y: 220, w: 130 },
    { id: "data", label: "Data Access", x: 15, y: 300, w: 130 },
    { id: "infra", label: "Infrastructure", x: 195, y: 300, w: 130 },
  ];

  const edges = [
    { d: "M170,50 L170,80", delay: 150 },
    { d: "M170,120 L170,150", delay: 300 },
    { d: "M170,190 L170,220", delay: 450 },
    { d: "M170,260 Q170,290 80,300", delay: 600 },
    { d: "M170,260 Q170,290 260,300", delay: 600 },
  ];

  return (
    <>
      <style>{`
        @keyframes rp-draw { to { stroke-dashoffset: 0; } }
        @keyframes rp-fade { to { opacity: 1; } }
        @keyframes rp-flow { to { stroke-dashoffset: -48; } }
        @keyframes rp-pulse { 0%, 100% { stroke-opacity: 0.35; } 50% { stroke-opacity: 1; } }

        /* One-time reveal on load */
        .rp-edge {
          stroke-dasharray: 220;
          stroke-dashoffset: 220;
          animation: rp-draw 900ms ease-out forwards;
        }
        .rp-node {
          opacity: 0;
          animation: rp-fade 400ms ease-out forwards;
        }

        /* Continuous, always-visible motion — this is the part that keeps
           running for as long as the page is open, so it reads as "animated"
           no matter when you look at it, not just in the first second. */
        .rp-flow {
          stroke-dasharray: 6 14;
          animation: rp-flow 1.6s linear infinite;
        }
        .rp-pulse {
          animation: rp-pulse 2.4s ease-in-out infinite;
        }

        @media (prefers-reduced-motion: reduce) {
          .rp-edge, .rp-node { animation: none; opacity: 1; stroke-dashoffset: 0; }
          .rp-flow, .rp-pulse { animation: none; }
        }
      `}</style>
      <svg viewBox="0 0 340 360" className="w-full h-auto">
        {edges.map((e, i) => (
          <g key={i}>
            {/* static line, revealed once on load */}
            <path
              d={e.d}
              stroke="#5eead4"
              strokeOpacity="0.35"
              strokeWidth="1.5"
              fill="none"
              className="rp-edge"
              style={{ animationDelay: `${e.delay}ms` }}
            />
            {/* traveling dash on top — runs forever, this is what makes the
                motion obvious regardless of timing */}
            <path
              d={e.d}
              stroke="#5eead4"
              strokeWidth="1.5"
              fill="none"
              className="rp-flow"
              style={{ animationDelay: `${e.delay + 900}ms` }}
            />
          </g>
        ))}

        {nodes.map((n, i) => (
          <g
            key={n.id}
            className="rp-node"
            style={{ animationDelay: `${i * 130}ms` }}
          >
            <rect
              x={n.x}
              y={n.y}
              width={n.w}
              height={40}
              rx={6}
              fill="#0a0a0a"
              stroke={i === 3 ? "#5eead4" : "#404040"}
              strokeWidth="1"
              className={i === 3 ? "rp-pulse" : undefined}
            />
            <text
              x={n.x + n.w / 2}
              y={n.y + 24}
              textAnchor="middle"
              fill="#e5e5e5"
              fontSize="11"
              fontFamily="var(--font-mono)"
            >
              {n.label}
            </text>
          </g>
        ))}
      </svg>
    </>
  );
}