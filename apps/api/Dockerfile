# ---- builder stage ----
FROM node:22-alpine AS builder

WORKDIR /workspace

# Install pnpm
RUN corepack enable && corepack prepare pnpm@11.7.0 --activate

# Copy workspace manifests first (layer-cache friendly)
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/tsconfig/package.json packages/tsconfig/
COPY packages/contracts/package.json packages/contracts/
COPY apps/api/package.json apps/api/

# Install all deps (including devDeps needed for build)
RUN pnpm install --frozen-lockfile

# Copy source
COPY packages/tsconfig/ packages/tsconfig/
COPY packages/contracts/ packages/contracts/
COPY apps/api/ apps/api/

# Build contracts, then api
RUN pnpm --filter @savia-os/contracts build
RUN pnpm --filter @savia-os/api exec nest build

# Generate Prisma client into dist
RUN pnpm --filter @savia-os/api exec prisma generate

# ---- runtime stage ----
FROM node:22-alpine AS api

RUN apk add --no-cache dumb-init

WORKDIR /app

ENV NODE_ENV=production

# Only production deps
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/tsconfig/package.json packages/tsconfig/
COPY packages/contracts/package.json packages/contracts/
COPY apps/api/package.json apps/api/

RUN corepack enable && corepack prepare pnpm@11.7.0 --activate && \
    pnpm install --frozen-lockfile --prod

# Copy built output and prisma artifacts
COPY --from=builder /workspace/apps/api/dist /app/apps/api/dist
COPY --from=builder /workspace/apps/api/prisma /app/apps/api/prisma
COPY --from=builder /workspace/apps/api/node_modules/.prisma /app/apps/api/node_modules/.prisma

WORKDIR /app/apps/api

# Three entrypoints share this image; CMD is overridden per service in compose
CMD ["dumb-init", "node", "dist/main.js"]
