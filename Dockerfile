# --- Build stage ---
FROM node:20-slim AS build

RUN corepack enable && corepack prepare pnpm@9.15.4 --activate

WORKDIR /app

# Copy workspace config + lockfile first (cache layer)
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/server/package.json apps/server/

RUN pnpm install --frozen-lockfile

# Copy source
COPY packages/shared/ packages/shared/
COPY apps/server/ apps/server/
COPY tsconfig.base.json ./

# Build shared first, then server
RUN pnpm --filter @playfrens/shared build && pnpm --filter @playfrens/server build

# --- Production stage ---
FROM node:20-slim

RUN corepack enable && corepack prepare pnpm@9.15.4 --activate

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/shared/package.json packages/shared/
COPY apps/server/package.json apps/server/

RUN pnpm install --frozen-lockfile --prod

# Copy built artifacts
COPY --from=build /app/packages/shared/dist packages/shared/dist
COPY --from=build /app/apps/server/dist apps/server/dist

EXPOSE 3001

CMD ["node", "apps/server/dist/index.js"]
