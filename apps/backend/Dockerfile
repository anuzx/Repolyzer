# syntax=docker/dockerfile:1

# Repolyzer backend (Express API, run via Bun directly from TS source).
# Build context: repo root.  e.g.  docker build -f apps/backend/Dockerfile .

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
# Stage 2: minimal runtime image
# ----------
FROM oven/bun:1.3-debian AS runtime

ENV NODE_ENV=production

WORKDIR /app

COPY --from=builder /app /app

# Run as the image's non-root user (uid 1000).
USER bun

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD ["bun", "-e", "fetch('http://localhost:3000/api/repo').then(r=>process.exit(r.status>=200&&r.status<500?0:1)).catch(()=>process.exit(1))"]

CMD ["bun", "run", "apps/backend/src/index.ts"]
