FROM node:20-alpine AS base
RUN npm i -g pnpm@9

FROM base AS deps
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY packages/types/package.json                   ./packages/types/
COPY packages/logger/package.json                  ./packages/logger/
COPY packages/database/package.json                ./packages/database/
COPY workers/notifications/package.json            ./workers/notifications/
RUN pnpm install --frozen-lockfile --filter @trendforge/worker-notifications...

FROM base AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm --filter @trendforge/worker-notifications build

FROM node:20-alpine AS production
WORKDIR /app
COPY --from=build /app/workers/notifications/dist ./dist
COPY --from=build /app/node_modules ./node_modules
CMD ["node", "dist/index.js"]
