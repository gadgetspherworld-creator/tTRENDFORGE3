FROM node:20-alpine AS base
RUN npm i -g pnpm@9

FROM base AS deps
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY packages/types/package.json      ./packages/types/
COPY packages/logger/package.json     ./packages/logger/
COPY packages/database/package.json   ./packages/database/
COPY apps/product-service/package.json ./apps/product-service/
RUN pnpm install --frozen-lockfile --filter @trendforge/product-service...

FROM base AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm --filter @trendforge/product-service build

FROM node:20-alpine AS production
WORKDIR /app
COPY --from=build /app/apps/product-service/dist ./dist
COPY --from=build /app/node_modules ./node_modules
EXPOSE 3002
CMD ["node", "dist/index.js"]
