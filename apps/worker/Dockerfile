# syntax=docker/dockerfile:1

# Repolyzer worker (BullMQ background job processor, run via Bun from TS source).
# Build context: repo root.  e.g.  docker build -f apps/worker/Dockerfile .
#
# The worker clones GitHub repos (needs `git`) and parses Python ASTs via a
# spawned helper script (needs `python3`), neither of which ships in oven/bun.

# ----------
# Stage 1: install dependencies & generate the (gitignored) Prisma client
# ----------
FROM oven/bun:1.3-debian AS builder

WORKDIR /app

# Copy manifests first so `bun install` is cached unless a manifest changes.
COPY bun.lock package.json ./
COPY apps/backend/package.json ./apps/backend/package.json
COPY apps/worker/package.json ./apps/worker/package.json
COPY apps/web/package.json ./apps/web/package.json
COPY packages/ai/package.json ./packages/ai/package.json
COPY packages/common/package.json ./packages/common/package.json
COPY packages/db/package.json ./packages/db/package.json
COPY packages/eslint-config/package.json ./packages/eslint-config/package.json
COPY packages/github/package.json ./packages/github/package.json
COPY packages/queue/package.json ./packages/queue/package.json
COPY packages/typescript-config/package.json ./packages/typescript-config/package.json

RUN bun install --frozen-lockfile

# Copy the rest of the monorepo source.
COPY . .

# The Prisma client lives in packages/db/generated (gitignored), so it must be
# generated at build time. `prisma.config.ts` reads DATABASE_URL, but `generate`
# never connects to the DB — this is only a placeholder so the config loads.
ARG DATABASE_URL=postgresql://repolyzer:repolyzer@postgres:5432/repolyzer
ENV DATABASE_URL=$DATABASE_URL
RUN cd packages/db && bunx prisma generate

# ----------
# Stage 2: runtime image with git + python3
# ----------
FROM oven/bun:1.3-debian AS runtime

ENV NODE_ENV=production

# Install runtime system dependencies (as root; the image runs as root by default).
RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    git \
    python3 \
    ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY --from=builder /app /app

# Run as the image's non-root user (uid 1000).
USER bun

# Cloned repos are written to os.tmpdir()/repolyzer inside the container.
CMD ["bun", "run", "apps/worker/src/index.ts"]
