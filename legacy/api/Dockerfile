# ---- builder stage ----
FROM node:22-alpine@sha256:16e22a550f3863206a3f701448c45f7912c6896a62de43add43bb9c86130c3e2 AS builder

WORKDIR /workspace

# Install pnpm
RUN corepack enable && corepack prepare pnpm@11.7.0 --activate

# Copy workspace manifests first (layer-cache friendly).
# .npmrc + pnpm-workspace.yaml carry install settings and the build-scripts
# allowlist (prisma engine download, argon2 native build).
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml .npmrc ./
COPY packages/tsconfig/package.json packages/tsconfig/
COPY legacy/contracts/package.json legacy/contracts/
COPY legacy/api/package.json legacy/api/

# Install all deps (including devDeps needed for build + prisma CLI)
RUN pnpm install --frozen-lockfile

# Copy source
COPY packages/tsconfig/ packages/tsconfig/
COPY legacy/contracts/ legacy/contracts/
COPY legacy/api/ legacy/api/

# Generate Prisma client before compiling (nest build needs the generated types)
RUN pnpm --filter @savia-os/legacy-api exec prisma generate

# Build contracts, then api
RUN pnpm --filter @savia-os/contracts build
RUN pnpm --filter @savia-os/legacy-api exec nest build

# Produce a self-contained production bundle: flattened node_modules with
# prod-only deps + the built dist + the contracts workspace package.
# Roughly halves the dependency footprint vs copying the full workspace.
RUN pnpm --filter @savia-os/legacy-api deploy --prod --legacy /prod

# pnpm deploy re-runs @prisma/client's postinstall, which resets the generated
# client to a stub (no schema in scope). Regenerate it into the deployed
# node_modules — Prisma resolves @prisma/client from the bundled schema's dir.
# Invoke the prisma bin directly: `pnpm exec` would trigger a deps-status check
# that tries to reinstall and fails.
RUN /workspace/legacy/api/node_modules/.bin/prisma generate --schema=/prod/prisma/schema.prisma

# ---- runtime stage ----
FROM node:22-alpine@sha256:16e22a550f3863206a3f701448c45f7912c6896a62de43add43bb9c86130c3e2 AS api

# dumb-init = proper PID 1 (signal forwarding + zombie reaping)
RUN apk add --no-cache dumb-init

ENV NODE_ENV=production
WORKDIR /app

# Copy only the self-contained prod bundle. Same base image (node:22-alpine)
# → the Prisma query-engine + argon2 native binaries are compatible.
# --chown lets the non-root `node` user write runtime artifacts (mem0 SQLite).
COPY --from=builder --chown=node:node /prod /app

# Documents the ports the three processes listen on (main=4400, mcp=4401)
EXPOSE 4400 4401

# Drop root — run as the unprivileged `node` user baked into the base image
USER node

ENTRYPOINT ["dumb-init", "--"]
# Three entrypoints share this image; command is overridden per service in compose
CMD ["node", "dist/main.js"]
