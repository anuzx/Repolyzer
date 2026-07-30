# Repolyzer 

---

## 1. Project Overview

**Repolyzer** is an AI-powered GitHub repository analyzer that builds system architecture diagrams, repository knowledge graphs, and intelligent summaries. It enables context-aware conversations to help developers understand and resolve repository issues.

**Problem it solves**: Understanding large, unfamiliar codebases is time-consuming. Repolyzer automates the analysis of repository structure, code relationships, and architecture — then exposes this knowledge via a chat interface for interactive exploration.

---

## 2. What's Implemented

### Core Features (Inferred from Structure)

| Area | Implementation |
|------|----------------|
| **Repository Analysis** | Worker service clones repos, parses AST (TypeScript & Python), extracts chunks, generates embeddings, builds knowledge graphs |
| **AI Chat** | Backend exposes `/chat` endpoints; `packages/ai` provides completion, embedding, and chat utilities |
| **GitHub Integration** | `packages/github` handles API calls, cloning, metadata extraction, and parsing |
| **Background Processing** | Worker uses BullMQ/Redis queues (`packages/queue`) for async repository processing jobs |
| **Data Persistence** | Prisma ORM (`packages/db`) with PostgreSQL for repos, issues, chunks, embeddings, graph nodes/edges |
| **Web UI** | Next.js app (`apps/web`) with views for: chat, file tree, issues, Mermaid diagrams, summaries |
| **REST API** | Backend (`apps/backend`) with controllers/routes for repos, issues, chat |
| **Shared Types** | `packages/common/schema.ts` defines shared Zod/TypeScript schemas |

### Key Services (Worker)

- **scan.service.ts** — Repository scanning & file discovery
- **chunk.service.ts** — Code chunking for embedding
- **embedding.service.ts** — Vector embeddings generation
- **graph.service.ts** — Knowledge graph construction
- **summary.service.ts** — AI-generated repository summaries
- **AST Parsers** — `ts_ast.service.ts`, `py_ast.service.ts` (with Python helper `py_ast.py`)

---

## 3. Tech Stack

| Category | Technologies |
|----------|--------------|
| **Language** | TypeScript (primary), Python (AST parsing helper) |
| **Monorepo** | Turborepo (`turbo.json`) |
| **Backend** | Node.js, Express (inferred from controllers/routes/middlewares) |
| **Frontend** | Next.js 13+ (App Router), React, Tailwind CSS (PostCSS config present) |
| **Worker/Queue** | BullMQ, Redis (`packages/queue`) |
| **Database** | PostgreSQL + Prisma ORM (`packages/db`) |
| **AI/ML** | OpenAI-compatible API (chat, completions, embeddings via `packages/ai`) |
| **GitHub** | Octokit (inferred from `packages/github`) |
| **AST Parsing** | TypeScript Compiler API, Python `ast` module |
| **Diagrams** | Mermaid (rendered in `mermaid-view.tsx`) |
| **Linting/Config** | Shared ESLint config (`packages/eslint-config`), TypeScript configs (`packages/typescript-config`) |

---

## 4. Project Structure

```
repolyzer/
├── apps/
│   ├── backend/          # Express REST API
│   │   ├── src/
│   │   │   ├── controllers/   # chat, issues, repos
│   │   │   ├── routes/        # route definitions
│   │   │   ├── middlewares/   # global error handling
│   │   │   └── utils/         # ApiError, ApiResponse
│   ├── web/              # Next.js frontend
│   │   ├── app/          # App Router pages (layout, repo/[id])
│   │   ├── components/   # chat-view, files-view, issues-view, mermaid-view, summary-view, zoom-container
│   │   └── lib/          # config
│   └── worker/           # Background job processor
│       ├── src/
│       │   ├── processors/   # repository.processor.ts (BullMQ job handler)
│       │   ├── services/     # scan, chunk, embedding, graph, summary, AST parsers
│       │   └── utils/        # cleanup, temp file handling
├── packages/
│   ├── ai/               # AI client (chat, complete, embed)
│   ├── common/           # Shared schemas (Zod)
│   ├── db/               # Prisma schema & client
│   ├── eslint-config/    # Shared ESLint configs
│   ├── github/           # GitHub API, clone, parser, metadata
│   ├── queue/            # Redis + BullMQ queue setup
│   └── typescript-config/# Shared tsconfig bases
├── package.json          # Root workspace scripts
└── turbo.json            # Turborepo pipeline config
```

---

## 5. Architecture Overview

### Layer Distribution (from Knowledge Graph)

| Layer | Files | Responsibility |
|-------|-------|----------------|
| **shared** | 23 | Cross-cutting utilities, types, configs (`packages/*`) |
| **data-access** | 11 | Prisma models, database queries |
| **infrastructure** | 11 | Redis, queue, GitHub API, AI client, file system |
| **presentation** | 9 | React components, Next.js pages |
| **service** | 8 | Business logic (scan, chunk, embed, graph, summary) |
| **api** | 3 | Express controllers/routes |
| **unknown** | 20 | Unclassified (likely config, entry points, tests) |

### Data Flow

```
GitHub Repo URL
      │
      ▼
┌─────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│  Backend API    │────▶│  Queue (Redis)   │────▶│  Worker          │
│  (POST /repos)  │     │  (BullMQ)        │     │  (Processor)     │
└─────────────────┘     └──────────────────┘     └────────┬─────────┘
                                                          │
                        ┌─────────────────────────────────┼─────────────────────────────────┐
                        ▼                                 ▼                                 ▼
               ┌─────────────────┐              ┌─────────────────┐              ┌─────────────────┐
               │ Clone & Scan    │              │ AST Parse       │              │ Chunk & Embed   │
               │ (scan.service)  │              │ (ts/py_ast)     │              │ (chunk/embed)   │
               └────────┬────────┘              └────────┬────────┘              └────────┬────────┘
                        │                                │                                │
                        └────────────────────────────────┼────────────────────────────────┘
                                                         ▼
                                              ┌─────────────────────┐
                                              │ Build Knowledge     │
                                              │ Graph + Summary     │
                                              │ (graph/summary svc) │
                                              └──────────┬──────────┘
                                                         │
                                                         ▼
                                              ┌─────────────────────┐
                                              │ Persist to Postgres │
                                              │ (Prisma)            │
                                              └──────────┬──────────┘
                                                         │
                        ┌────────────────────────────────┼────────────────────────────────┐
                        ▼                                ▼                                ▼
               ┌─────────────────┐              ┌─────────────────┐              ┌─────────────────┐
               │ Web UI          │              │ Chat API        │              │ Mermaid/Views   │
               │ (Next.js)       │              │ (Backend)       │              │ (Components)    │
               └─────────────────┘              └─────────────────┘              └─────────────────┘
```

### Key Relationships

- **53 imports** — Heavy modularization across packages
- **1 inheritance** — Minimal class hierarchy (2 classes total)
- **24 interfaces** — Strong typing for API contracts, database models, service boundaries

---

## 6. Getting Started

### Prerequisites

- Node.js 18+
- pnpm (or npm/yarn — workspace uses `package.json` at root)
- PostgreSQL database
- Redis server
- GitHub Personal Access Token (for API access)
- OpenAI-compatible API key (for embeddings/chat)

### Installation

```bash
# Clone
git clone https://github.com/anuzx/Repolyzer.git
cd Repolyzer

# Install dependencies (Turborepo workspaces)
pnpm install

# Generate Prisma client
pnpm --filter=db db:generate  # or: cd packages/db && pnpm prisma generate

# Set up environment variables
# Create .env files in each app/package as needed:
# - apps/backend/.env     (DATABASE_URL, REDIS_URL, GITHUB_TOKEN, AI_API_KEY, PORT)
# - apps/web/.env.local   (NEXT_PUBLIC_API_URL)
# - apps/worker/.env      (DATABASE_URL, REDIS_URL, AI_API_KEY)
# - packages/db/.env      (DATABASE_URL)
```

### Development Commands (from `turbo.json` / `package.json`)

```bash
# Run all apps in dev mode
pnpm dev

# Run individual apps
pnpm --filter=backend dev
pnpm --filter=web dev
pnpm --filter=worker dev

# Build all
pnpm build

# Lint
pnpm lint

# Type check
pnpm typecheck

# Database migrations
pnpm --filter=db db:migrate
pnpm --filter=db db:push
pnpm --filter=db db:studio
```

### Production

```bash
# Build
pnpm build

# Start backend
pnpm --filter=backend start

# Start web (Next.js)
pnpm --filter=web start

# Start worker
pnpm --filter=worker start
```

### Environment Variables (Expected)

| Package | Variables |
|---------|-----------|
| `apps/backend` | `DATABASE_URL`, `REDIS_URL`, `GITHUB_TOKEN`, `AI_API_KEY`, `AI_BASE_URL`, `PORT` |
| `apps/web` | `NEXT_PUBLIC_API_URL` |
| `apps/worker` | `DATABASE_URL`, `REDIS_URL`, `AI_API_KEY`, `AI_BASE_URL` |
| `packages/db` | `DATABASE_URL` |

---

## Summary

Repolyzer is a **monorepo** (Turborepo) with three apps (`85-file TypeScript codebase organized into **7 shared packages** and **3 applications**. It implements a complete pipeline: **GitHub repo → clone → AST parse → chunk → embed → knowledge graph → summary → chat UI**. The architecture cleanly separates API, frontend, and background worker, with shared infrastructure (queue, DB, AI, GitHub) in packages. All core pieces are present — the project appears to be in a **working, structured state** ready for development or deployment.
