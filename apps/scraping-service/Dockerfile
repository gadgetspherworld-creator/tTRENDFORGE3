FROM mcr.microsoft.com/playwright:v1.44.0-jammy AS base
RUN npm i -g pnpm@9

FROM base AS deps
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY packages/types/package.json     ./packages/types/
COPY packages/logger/package.json    ./packages/logger/
COPY packages/database/package.json  ./packages/database/
COPY apps/scraping-service/package.json ./apps/scraping-service/
RUN pnpm install --frozen-lockfile --filter @trendforge/scraping-service...

FROM base AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm --filter @trendforge/scraping-service build

FROM mcr.microsoft.com/playwright:v1.44.0-jammy AS production
WORKDIR /app
RUN npm i -g pnpm@9
COPY --from=build /app/apps/scraping-service/dist ./dist
COPY --from=build /app/node_modules ./node_modules
EXPOSE 3004
CMD ["node", "dist/index.js"]
