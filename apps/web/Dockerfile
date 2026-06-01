FROM node:20-alpine AS base
RUN npm i -g pnpm@9

FROM base AS deps
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY packages/types/package.json   ./packages/types/
COPY apps/web/package.json         ./apps/web/
RUN pnpm install --frozen-lockfile --filter @trendforge/web...

FROM base AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm --filter @trendforge/web build

FROM node:20-alpine AS production
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/apps/web/.next/standalone ./
COPY --from=build /app/apps/web/.next/static     ./apps/web/.next/static
COPY --from=build /app/apps/web/public           ./apps/web/public
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
