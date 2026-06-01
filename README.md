# ⚡ TrendForge

**Radar Product Intelligence pour le dropshipping** — détectez les produits gagnants avant tout le monde.

## Stack

| Couche | Tech |
|--------|------|
| Monorepo | TurboRepo + pnpm workspaces |
| Backend | Fastify, Prisma, PostgreSQL + pgvector |
| Queue | BullMQ + Redis |
| Scraping | Playwright (stealth) |
| AI | Claude (Anthropic), GPT-4o (OpenAI) |
| Frontend | Next.js 14 App Router, Tailwind CSS |
| Emails | Resend |
| Paiements | Stripe |

## Démarrage rapide

```bash
# 1. Installer les dépendances
pnpm install

# 2. Configurer l'environnement
cp .env.example .env
# → remplir les vraies valeurs dans .env

# 3. Lancer l'infrastructure (Postgres + Redis)
docker compose -f infrastructure/docker-compose.yml up -d postgres redis

# 4. Migrer la base de données
pnpm --filter @trendforge/database migrate:dev

# 5. Seed des pays
pnpm seed

# 6. Lancer tous les services
pnpm dev
```

## Structure

```
trendforge/
├── apps/
│   ├── api-gateway/        # API REST Fastify (port 3001)
│   ├── product-service/    # Scoring engine (port 3002)
│   ├── ai-service/         # Claude + GPT-4o (port 3003)
│   ├── scraping-service/   # 10 scrapers Playwright (port 3004)
│   └── web/                # Next.js 14 (port 3000)
├── workers/
│   └── notifications/      # Emails Resend via BullMQ
├── packages/
│   ├── database/           # Prisma client + migrations
│   ├── types/              # Types partagés
│   └── logger/             # Logger pino
├── scripts/
│   ├── seed-countries.ts   # Seed données pays
│   └── check-scraper-health.ts  # Health check scrapers
└── infrastructure/
    └── docker-compose.yml  # Dev local
```

## Déploiement Railway

Voir [RAILWAY_DEPLOY.md](./RAILWAY_DEPLOY.md) pour le guide complet.

## Variables d'environnement

Voir [.env.example](./.env.example) — toutes les variables requises sont documentées.

## Commandes utiles

```bash
pnpm dev              # Lancer tous les services
pnpm build            # Build de production
pnpm test             # Tests Vitest
pnpm seed             # Seed des pays
pnpm health           # Health check des scrapers
pnpm --filter @trendforge/database studio  # Prisma Studio
```
