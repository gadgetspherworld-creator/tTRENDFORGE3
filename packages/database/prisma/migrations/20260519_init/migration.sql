-- TrendForge — Migration initiale
-- Générée le 19 mai 2026

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";  -- for fuzzy text search

-- ─────────────────────────────────────────────────────────────────
-- Enums
-- ─────────────────────────────────────────────────────────────────

CREATE TYPE "ProductSource" AS ENUM (
  'TIKTOK_SHOP',
  'AMAZON',
  'ALIEXPRESS',
  'TEMU',
  'ETSY',
  'FACEBOOK_ADS',
  'REDDIT',
  'PINTEREST',
  'GOOGLE_TRENDS',
  'SHOPIFY_SPY'
);

CREATE TYPE "SubscriptionPlan" AS ENUM (
  'FREE',
  'STARTER',
  'PRO',
  'AGENCY'
);

CREATE TYPE "SubscriptionStatus" AS ENUM (
  'ACTIVE',
  'TRIALING',
  'PAST_DUE',
  'CANCELED',
  'INCOMPLETE'
);

CREATE TYPE "AlertType" AS ENUM (
  'score_spike',
  'score_drop',
  'new_product',
  'saturation',
  'system'
);

CREATE TYPE "Role" AS ENUM (
  'OWNER',
  'ADMIN',
  'MEMBER',
  'VIEWER'
);

-- ─────────────────────────────────────────────────────────────────
-- Organizations
-- ─────────────────────────────────────────────────────────────────

CREATE TABLE "Organization" (
  "id"        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "name"      TEXT NOT NULL,
  "slug"      TEXT NOT NULL UNIQUE,
  "plan"      "SubscriptionPlan" NOT NULL DEFAULT 'FREE',
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX "Organization_slug_idx" ON "Organization"("slug");

-- ─────────────────────────────────────────────────────────────────
-- Users
-- ─────────────────────────────────────────────────────────────────

CREATE TABLE "User" (
  "id"                        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "organizationId"            UUID NOT NULL REFERENCES "Organization"("id") ON DELETE CASCADE,
  "email"                     TEXT NOT NULL UNIQUE,
  "name"                      TEXT,
  "passwordHash"              TEXT NOT NULL,
  "role"                      "Role" NOT NULL DEFAULT 'MEMBER',
  "emailVerified"             BOOLEAN NOT NULL DEFAULT FALSE,
  "notificationPreferences"   JSONB NOT NULL DEFAULT '{"emailScoreAlerts":true,"emailNewProducts":true,"emailBilling":true}',
  "createdAt"                 TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt"                 TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX "User_email_idx" ON "User"("email");
CREATE INDEX "User_organizationId_idx" ON "User"("organizationId");

-- ─────────────────────────────────────────────────────────────────
-- Refresh Tokens
-- ─────────────────────────────────────────────────────────────────

CREATE TABLE "RefreshToken" (
  "id"        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "userId"    UUID NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "token"     TEXT NOT NULL UNIQUE,
  "expiresAt" TIMESTAMPTZ NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX "RefreshToken_userId_idx" ON "RefreshToken"("userId");
CREATE INDEX "RefreshToken_token_idx" ON "RefreshToken"("token");

-- ─────────────────────────────────────────────────────────────────
-- API Keys
-- ─────────────────────────────────────────────────────────────────

CREATE TABLE "ApiKey" (
  "id"             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "organizationId" UUID NOT NULL REFERENCES "Organization"("id") ON DELETE CASCADE,
  "userId"         UUID NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "name"           TEXT NOT NULL,
  "keyHash"        TEXT NOT NULL UNIQUE,
  "keyPrefix"      TEXT NOT NULL,         -- e.g. "tf_sk_live_AbCd"
  "lastUsedAt"     TIMESTAMPTZ,
  "revokedAt"      TIMESTAMPTZ,
  "createdAt"      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX "ApiKey_organizationId_idx" ON "ApiKey"("organizationId");
CREATE INDEX "ApiKey_keyHash_idx" ON "ApiKey"("keyHash");

-- ─────────────────────────────────────────────────────────────────
-- Subscriptions
-- ─────────────────────────────────────────────────────────────────

CREATE TABLE "Subscription" (
  "id"                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "organizationId"       UUID NOT NULL UNIQUE REFERENCES "Organization"("id") ON DELETE CASCADE,
  "stripeCustomerId"     TEXT UNIQUE,
  "stripeSubscriptionId" TEXT UNIQUE,
  "plan"                 "SubscriptionPlan" NOT NULL DEFAULT 'FREE',
  "status"               "SubscriptionStatus" NOT NULL DEFAULT 'TRIALING',
  "currentPeriodStart"   TIMESTAMPTZ,
  "currentPeriodEnd"     TIMESTAMPTZ,
  "trialEndsAt"          TIMESTAMPTZ,
  "canceledAt"           TIMESTAMPTZ,
  "createdAt"            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt"            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────────
-- Products
-- ─────────────────────────────────────────────────────────────────

CREATE TABLE "Product" (
  "id"              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "externalId"      TEXT NOT NULL UNIQUE,
  "title"           TEXT NOT NULL,
  "description"     TEXT,
  "url"             TEXT,
  "imageUrl"        TEXT,
  "source"          "ProductSource" NOT NULL,
  "price"           DECIMAL(10, 2),
  "currency"        TEXT NOT NULL DEFAULT 'USD',
  "score"           INTEGER NOT NULL DEFAULT 0,
  "engagementScore" INTEGER NOT NULL DEFAULT 0,
  "tags"            TEXT[] NOT NULL DEFAULT '{}',
  "categories"      TEXT[] NOT NULL DEFAULT '{}',
  "metadata"        JSONB NOT NULL DEFAULT '{}',
  -- pgvector embedding for clustering
  "embedding"       vector(1536),
  "createdAt"       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt"       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX "Product_source_idx" ON "Product"("source");
CREATE INDEX "Product_score_idx" ON "Product"("score" DESC);
CREATE INDEX "Product_createdAt_idx" ON "Product"("createdAt" DESC);
CREATE INDEX "Product_title_trgm_idx" ON "Product" USING gin("title" gin_trgm_ops);
-- IVFFlat index for approximate nearest neighbor search
CREATE INDEX "Product_embedding_idx" ON "Product" USING ivfflat ("embedding" vector_cosine_ops) WITH (lists = 100);

-- ─────────────────────────────────────────────────────────────────
-- Product Scores (time-series history)
-- ─────────────────────────────────────────────────────────────────

CREATE TABLE "ProductScore" (
  "id"          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "productId"   UUID NOT NULL REFERENCES "Product"("id") ON DELETE CASCADE,
  "score"       INTEGER NOT NULL,
  "subScores"   JSONB NOT NULL DEFAULT '{}',   -- { growth, saturation, engagement, margin, … }
  "scoredAt"    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX "ProductScore_productId_idx" ON "ProductScore"("productId");
CREATE INDEX "ProductScore_scoredAt_idx" ON "ProductScore"("scoredAt" DESC);

-- ─────────────────────────────────────────────────────────────────
-- Country Data (per-product per-country metrics)
-- ─────────────────────────────────────────────────────────────────

CREATE TABLE "ProductCountry" (
  "id"               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "productId"        UUID NOT NULL REFERENCES "Product"("id") ON DELETE CASCADE,
  "countryCode"      CHAR(2) NOT NULL,
  "score"            INTEGER NOT NULL DEFAULT 0,
  "searchVolume"     INTEGER,
  "competitionLevel" DECIMAL(3, 2),
  "estimatedMargin"  DECIMAL(5, 2),
  "saturation"       DECIMAL(3, 2),
  "metadata"         JSONB NOT NULL DEFAULT '{}',
  "updatedAt"        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE("productId", "countryCode")
);

CREATE INDEX "ProductCountry_productId_idx" ON "ProductCountry"("productId");
CREATE INDEX "ProductCountry_countryCode_idx" ON "ProductCountry"("countryCode");

-- ─────────────────────────────────────────────────────────────────
-- Watchlist (user saves product)
-- ─────────────────────────────────────────────────────────────────

CREATE TABLE "Watchlist" (
  "id"        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "userId"    UUID NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "productId" UUID NOT NULL REFERENCES "Product"("id") ON DELETE CASCADE,
  "notes"     TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE("userId", "productId")
);

CREATE INDEX "Watchlist_userId_idx" ON "Watchlist"("userId");

-- ─────────────────────────────────────────────────────────────────
-- Alerts
-- ─────────────────────────────────────────────────────────────────

CREATE TABLE "Alert" (
  "id"        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "userId"    UUID NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "productId" UUID REFERENCES "Product"("id") ON DELETE SET NULL,
  "type"      "AlertType" NOT NULL,
  "title"     TEXT NOT NULL,
  "message"   TEXT,
  "read"      BOOLEAN NOT NULL DEFAULT FALSE,
  "metadata"  JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX "Alert_userId_read_idx" ON "Alert"("userId", "read");
CREATE INDEX "Alert_createdAt_idx" ON "Alert"("createdAt" DESC);

-- ─────────────────────────────────────────────────────────────────
-- Notifications (email log)
-- ─────────────────────────────────────────────────────────────────

CREATE TABLE "Notification" (
  "id"        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "userId"    UUID NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "type"      TEXT NOT NULL,
  "title"     TEXT NOT NULL,
  "read"      BOOLEAN NOT NULL DEFAULT FALSE,
  "metadata"  JSONB NOT NULL DEFAULT '{}',
  "sentAt"    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX "Notification_userId_idx" ON "Notification"("userId");

-- ─────────────────────────────────────────────────────────────────
-- AI Generations (log of creatives generated)
-- ─────────────────────────────────────────────────────────────────

CREATE TABLE "AiGeneration" (
  "id"             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "userId"         UUID NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "organizationId" UUID NOT NULL REFERENCES "Organization"("id") ON DELETE CASCADE,
  "productId"      UUID REFERENCES "Product"("id") ON DELETE SET NULL,
  "type"           TEXT NOT NULL,           -- 'ad_copy', 'store_html', 'product_description', …
  "model"          TEXT NOT NULL,           -- 'claude-sonnet-4-20250514', 'gpt-4o', …
  "prompt"         TEXT,
  "result"         TEXT NOT NULL,
  "tokens"         INTEGER,
  "createdAt"      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX "AiGeneration_userId_idx" ON "AiGeneration"("userId");
CREATE INDEX "AiGeneration_organizationId_idx" ON "AiGeneration"("organizationId");
CREATE INDEX "AiGeneration_createdAt_idx" ON "AiGeneration"("createdAt" DESC);

-- ─────────────────────────────────────────────────────────────────
-- Competitors (Shopify spy)
-- ─────────────────────────────────────────────────────────────────

CREATE TABLE "Competitor" (
  "id"              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "organizationId"  UUID NOT NULL REFERENCES "Organization"("id") ON DELETE CASCADE,
  "url"             TEXT NOT NULL,
  "name"            TEXT,
  "estimatedRevenue" BIGINT,
  "productCount"    INTEGER,
  "theme"           TEXT,
  "appsInstalled"   TEXT[] NOT NULL DEFAULT '{}',
  "adsActive"       BOOLEAN NOT NULL DEFAULT FALSE,
  "trendScore"      INTEGER NOT NULL DEFAULT 0,
  "scoreDelta"      INTEGER NOT NULL DEFAULT 0,
  "metadata"        JSONB NOT NULL DEFAULT '{}',
  "lastScrapedAt"   TIMESTAMPTZ,
  "createdAt"       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt"       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE("organizationId", "url")
);

CREATE INDEX "Competitor_organizationId_idx" ON "Competitor"("organizationId");

-- ─────────────────────────────────────────────────────────────────
-- Product Clusters (pgvector clustering results)
-- ─────────────────────────────────────────────────────────────────

CREATE TABLE "ProductCluster" (
  "id"          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "label"       TEXT NOT NULL,
  "description" TEXT,
  "centroid"    vector(1536),
  "productIds"  UUID[] NOT NULL DEFAULT '{}',
  "metadata"    JSONB NOT NULL DEFAULT '{}',
  "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────────
-- Hype Cycles (trend lifecycle detection)
-- ─────────────────────────────────────────────────────────────────

CREATE TABLE "HypeCycle" (
  "id"          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "productId"   UUID NOT NULL REFERENCES "Product"("id") ON DELETE CASCADE,
  "phase"       TEXT NOT NULL,   -- 'emerging' | 'peak' | 'declining' | 'saturated'
  "confidence"  DECIMAL(3, 2) NOT NULL DEFAULT 0,
  "predictedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "metadata"    JSONB NOT NULL DEFAULT '{}'
);

CREATE INDEX "HypeCycle_productId_idx" ON "HypeCycle"("productId");

-- ─────────────────────────────────────────────────────────────────
-- Update triggers (auto updatedAt)
-- ─────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW."updatedAt" = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "Organization_updatedAt"
  BEFORE UPDATE ON "Organization"
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER "User_updatedAt"
  BEFORE UPDATE ON "User"
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER "Product_updatedAt"
  BEFORE UPDATE ON "Product"
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER "Subscription_updatedAt"
  BEFORE UPDATE ON "Subscription"
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER "Competitor_updatedAt"
  BEFORE UPDATE ON "Competitor"
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER "ProductCluster_updatedAt"
  BEFORE UPDATE ON "ProductCluster"
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
