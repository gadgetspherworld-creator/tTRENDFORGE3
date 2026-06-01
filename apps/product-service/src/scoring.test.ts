import { describe, it, expect, beforeEach, vi } from 'vitest';

// ─── Scoring Engine types & implementation (inline for testability) ───────────

interface ProductSignals {
  tiktokViews?: number;
  amazonRank?: number;
  aliexpressOrders?: number;
  googleTrendsScore?: number;
  facebookAdCount?: number;
  engagementRate?: number;
  priceMargin?: number;
  reviewCount?: number;
  reviewScore?: number;
}

interface ScoreBreakdown {
  total: number;
  growth: number;
  saturation: number;
  engagement: number;
  margin: number;
  socialProof: number;
  demand: number;
  competition: number;
  recency: number;
  quality: number;
}

function clamp(val: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, val));
}

function scoreTiktokViews(views: number): number {
  if (views >= 10_000_000) return 100;
  if (views >= 1_000_000) return 80;
  if (views >= 100_000) return 60;
  if (views >= 10_000) return 40;
  if (views >= 1_000) return 20;
  return 0;
}

function scoreAmazonRank(rank: number): number {
  if (rank <= 100) return 100;
  if (rank <= 1_000) return 80;
  if (rank <= 10_000) return 60;
  if (rank <= 100_000) return 40;
  if (rank <= 1_000_000) return 20;
  return 0;
}

function scoreAliexpressOrders(orders: number): number {
  return clamp(Math.log10(orders + 1) * 20);
}

function scoreGoogleTrends(score: number): number {
  return clamp(score);
}

function scoreMargin(margin: number): number {
  if (margin >= 0.7) return 100;
  if (margin >= 0.5) return 80;
  if (margin >= 0.3) return 60;
  if (margin >= 0.15) return 40;
  return 10;
}

export function computeScore(signals: ProductSignals): ScoreBreakdown {
  const growth = scoreGoogleTrends(signals.googleTrendsScore ?? 0);
  const demand = scoreTiktokViews(signals.tiktokViews ?? 0);
  const competition = signals.amazonRank ? scoreAmazonRank(signals.amazonRank) : 50;
  const engagement = clamp((signals.engagementRate ?? 0) * 100 * 10);
  const margin = scoreMargin(signals.priceMargin ?? 0.3);
  const saturation = signals.facebookAdCount
    ? clamp(100 - signals.facebookAdCount / 10)
    : 70;
  const socialProof = signals.reviewCount
    ? clamp(Math.log10(signals.reviewCount + 1) * 30 + (signals.reviewScore ?? 3) * 5)
    : 30;
  const recency = 70; // default, would be computed from scrape timestamp delta
  const quality = signals.reviewScore ? clamp(signals.reviewScore * 20) : 60;

  const weights = {
    growth: 0.2,
    demand: 0.15,
    competition: 0.1,
    engagement: 0.15,
    margin: 0.15,
    saturation: 0.1,
    socialProof: 0.05,
    recency: 0.05,
    quality: 0.05,
  };

  const total = Math.round(
    growth * weights.growth +
    demand * weights.demand +
    competition * weights.competition +
    engagement * weights.engagement +
    margin * weights.margin +
    saturation * weights.saturation +
    socialProof * weights.socialProof +
    recency * weights.recency +
    quality * weights.quality
  );

  return {
    total: clamp(total),
    growth,
    saturation,
    engagement,
    margin,
    socialProof,
    demand,
    competition,
    recency,
    quality,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Scoring Engine', () => {
  describe('computeScore()', () => {
    it('returns a total between 0 and 100', () => {
      const result = computeScore({
        tiktokViews: 500_000,
        googleTrendsScore: 75,
        priceMargin: 0.4,
        engagementRate: 0.05,
      });
      expect(result.total).toBeGreaterThanOrEqual(0);
      expect(result.total).toBeLessThanOrEqual(100);
    });

    it('gives maximum score for perfect signals', () => {
      const result = computeScore({
        tiktokViews: 50_000_000,
        amazonRank: 1,
        aliexpressOrders: 100_000,
        googleTrendsScore: 100,
        facebookAdCount: 0,
        engagementRate: 1,
        priceMargin: 0.9,
        reviewCount: 50_000,
        reviewScore: 5,
      });
      expect(result.total).toBeGreaterThan(80);
    });

    it('gives low score for empty signals', () => {
      const result = computeScore({});
      expect(result.total).toBeLessThan(60);
    });

    it('penalizes high Facebook ad count (saturation)', () => {
      const lowSaturation = computeScore({ facebookAdCount: 0 });
      const highSaturation = computeScore({ facebookAdCount: 1000 });
      expect(lowSaturation.saturation).toBeGreaterThan(highSaturation.saturation);
    });

    it('rewards high TikTok views', () => {
      const low = computeScore({ tiktokViews: 100 });
      const high = computeScore({ tiktokViews: 10_000_000 });
      expect(high.demand).toBeGreaterThan(low.demand);
    });

    it('correctly maps Amazon rank to competition score', () => {
      expect(computeScore({ amazonRank: 50 }).competition).toBe(100);
      expect(computeScore({ amazonRank: 500 }).competition).toBe(80);
      expect(computeScore({ amazonRank: 5_000 }).competition).toBe(60);
      expect(computeScore({ amazonRank: 5_000_000 }).competition).toBe(0);
    });

    it('rewards margin above 70%', () => {
      const low = computeScore({ priceMargin: 0.1 });
      const high = computeScore({ priceMargin: 0.8 });
      expect(high.margin).toBeGreaterThan(low.margin);
      expect(high.margin).toBe(100);
    });

    it('clamps all sub-scores to [0, 100]', () => {
      const result = computeScore({
        tiktokViews: -1,
        googleTrendsScore: 999,
        engagementRate: 99,
        priceMargin: -0.5,
      });
      for (const [key, value] of Object.entries(result)) {
        expect(value, `${key} out of range`).toBeGreaterThanOrEqual(0);
        expect(value, `${key} out of range`).toBeLessThanOrEqual(100);
      }
    });
  });

  describe('scoreMargin()', () => {
    it('returns 100 for margin >= 70%', () => {
      expect(scoreMargin(0.7)).toBe(100);
      expect(scoreMargin(0.9)).toBe(100);
    });

    it('returns 10 for margin < 15%', () => {
      expect(scoreMargin(0.05)).toBe(10);
      expect(scoreMargin(0.0)).toBe(10);
    });

    it('returns correct tier values', () => {
      expect(scoreMargin(0.5)).toBe(80);
      expect(scoreMargin(0.3)).toBe(60);
      expect(scoreMargin(0.15)).toBe(40);
    });
  });

  describe('scoreTiktokViews()', () => {
    it('handles boundary values', () => {
      expect(scoreTiktokViews(0)).toBe(0);
      expect(scoreTiktokViews(999)).toBe(0);
      expect(scoreTiktokViews(1_000)).toBe(20);
      expect(scoreTiktokViews(10_000)).toBe(40);
      expect(scoreTiktokViews(100_000)).toBe(60);
      expect(scoreTiktokViews(1_000_000)).toBe(80);
      expect(scoreTiktokViews(10_000_000)).toBe(100);
    });
  });
});
