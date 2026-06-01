# Déploiement Railway — TrendForge

## Services à créer sur Railway

Créez un projet Railway et ajoutez ces services :

### 1. PostgreSQL + pgvector
- Ajouter un plugin PostgreSQL
- Activer l'extension pgvector via Railway ou en run : `CREATE EXTENSION vector;`

### 2. Redis
- Ajouter un plugin Redis

### 3. API Gateway
- Source : GitHub repo, dossier `apps/api-gateway`
- Build command : `pnpm install && pnpm --filter @trendforge/api-gateway build`
- Start command : `node apps/api-gateway/dist/index.js`
- Variables : voir `.env.example` section API Gateway

### 4. Web (Next.js)
- Source : GitHub repo, dossier `apps/web`
- Build command : `pnpm install && pnpm --filter @trendforge/web build`
- Start command : `node apps/web/.next/standalone/server.js`

### 5. Worker Notifications
- Source : GitHub repo, dossier `workers/notifications`
- Start command : `node workers/notifications/dist/main.js`

## Première migration DB

```bash
# Depuis votre machine locale avec DATABASE_URL pointant sur Railway
pnpm --filter @trendforge/database migrate:deploy

# Seed des pays
pnpm seed
```

## Variables d'environnement Railway

Copier le contenu de `.env.example` et remplir chaque valeur dans
Railway → Votre service → Variables.

La variable `DATABASE_URL` est auto-injectée par le plugin PostgreSQL Railway.
La variable `REDIS_URL` est auto-injectée par le plugin Redis Railway.
