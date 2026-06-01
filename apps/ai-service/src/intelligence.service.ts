import { prisma } from '@trendforge/database';
import { logger } from '@trendforge/logger';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ─── Types ────────────────────────────────────────────────────────────────────

export type HypePhase = 'emerging' | 'rising' | 'peak' | 'declining' | 'saturated' | 'dead';

export interface HypeAnalysis {
  productId: string;
  phase: HypePhase;
  confidence: number;
  daysToSaturation?: number;
  recommendation: string;
  signals: {
    scoreVelocity: number;     // score change per day
    scoreAcceleration: number; // velocity change per day
    engagementTrend: number;   // engagement slope
    peakScore: number;
    currentScore: number;
    ageInDays: number;
  };
}

export interface SaturationPrediction {
  productId: string;
  currentSaturation: number;   // 0-1
  predictedSaturation30d: number;
  predictedSaturation90d: number;
  daysUntilSaturated: number | null;  // null = not saturating
  confidence: number;
  factors: string[];
}

// ─── Score history analysis ───────────────────────────────────────────────────

interface ScorePoint {
  score: number;
  date: Date;
}

function linearRegression(points: ScorePoint[]): { slope: number; intercept: number; r2: number } {
  const n = points.length;
  if (n < 2) return { slope: 0, intercept: points[0]?.score ?? 0, r2: 0 };

  const xs = points.map((_, i) => i);
  const ys = points.map(p => p.score);

  const sumX = xs.reduce((a, b) => a + b, 0);
  const sumY = ys.reduce((a, b) => a + b, 0);
  const sumXY = xs.reduce((acc, x, i) => acc + x * ys[i]!, 0);
  const sumX2 = xs.reduce((acc, x) => acc + x * x, 0);

  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;

  // R² coefficient
  const yMean = sumY / n;
  const ssTot = ys.reduce((acc, y) => acc + (y - yMean) ** 2, 0);
  const ssRes = ys.reduce((acc, y, i) => acc + (y - (slope * xs[i]! + intercept)) ** 2, 0);
  const r2 = ssTot === 0 ? 1 : 1 - ssRes / ssTot;

  return { slope, intercept, r2 };
}

function computeVelocityAndAcceleration(scores: ScorePoint[]): {
  velocity: number;
  acceleration: number;
} {
  if (scores.length < 3) return { velocity: 0, acceleration: 0 };

  const recent = scores.slice(-7);   // last 7 data points
  const older = scores.slice(-14, -7); // previous 7

  const recentSlope = linearRegression(recent).slope;
  const olderSlope = older.length >= 2 ? linearRegression(older).slope : 0;

  return {
    velocity: recentSlope,
    acceleration: recentSlope - olderSlope,
  };
}

// ─── Hype Phase Detection ─────────────────────────────────────────────────────

function classifyHypePhase(signals: HypeAnalysis['signals']): { phase: HypePhase; confidence: number } {
  const { scoreVelocity, scoreAcceleration, currentScore, peakScore, ageInDays } = signals;

  const dropFromPeak = peakScore > 0 ? (peakScore - currentScore) / peakScore : 0;

  // Dead: very low score, old product
  if (currentScore < 15 && ageInDays > 90) {
    return { phase: 'dead', confidence: 0.9 };
  }

  // Saturated: significant drop from peak, slow velocity
  if (dropFromPeak > 0.4 && scoreVelocity < -0.5) {
    return { phase: 'saturated', confidence: 0.85 };
  }

  // Declining: dropping but not yet saturated
  if (dropFromPeak > 0.2 && scoreVelocity < 0) {
    return { phase: 'declining', confidence: 0.8 };
  }

  // Peak: high score, velocity near zero or slightly negative
  if (currentScore >= 70 && Math.abs(scoreVelocity) < 0.5) {
    return { phase: 'peak', confidence: 0.75 };
  }

  // Rising: positive velocity, positive acceleration
  if (scoreVelocity > 1 && scoreAcceleration >= 0) {
    return { phase: 'rising', confidence: 0.8 };
  }

  // Emerging: early product, moderate velocity
  if (ageInDays < 30 && scoreVelocity > 0) {
    return { phase: 'emerging', confidence: 0.7 };
  }

  // Fallback based on velocity
  if (scoreVelocity > 0.5) return { phase: 'rising', confidence: 0.6 };
  if (scoreVelocity < -0.5) return { phase: 'declining', confidence: 0.6 };

  return { phase: 'peak', confidence: 0.5 };
}

// ─── Saturation Prediction (ML-lite linear extrapolation + heuristics) ────────

function predictSaturation(
  scoreHistory: ScorePoint[],
  currentFacebookAds: number,
  currentScore: number
): SaturationPrediction['predictedSaturation30d'] {
  // Saturation modeled as combination of:
  // 1. Score decline rate
  // 2. Competition (FB ad count proxy)
  // 3. Age

  const regression = linearRegression(scoreHistory);
  const projectedScore30d = Math.max(0, currentScore + regression.slope * 30);
  const scoreDropRatio = currentScore > 0 ? (currentScore - projectedScore30d) / currentScore : 0;

  // Competition saturation signal
  const competitionSaturation = Math.min(1, currentFacebookAds / 500);

  // Combined saturation estimate
  return Math.min(1, Math.max(0, scoreDropRatio * 0.6 + competitionSaturation * 0.4));
}

// ─── Main analysis functions ──────────────────────────────────────────────────

export async function analyzeHypeCycle(productId: string): Promise<HypeAnalysis> {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: {
      id: true,
      title: true,
      score: true,
      createdAt: true,
      metadata: true,
    },
  });

  if (!product) throw new Error(`Product ${productId} not found`);

  const scoreHistory = await prisma.productScore.findMany({
    where: { productId },
    orderBy: { scoredAt: 'asc' },
    select: { score: true, scoredAt: true },
  });

  const points: ScorePoint[] = scoreHistory.map(s => ({ score: s.score, date: s.scoredAt }));
  const { velocity, acceleration } = computeVelocityAndAcceleration(points);

  const peakScore = points.length > 0 ? Math.max(...points.map(p => p.score)) : product.score ?? 0;
  const currentScore = product.score ?? 0;
  const ageInDays = (Date.now() - product.createdAt.getTime()) / (1000 * 60 * 60 * 24);

  const signals: HypeAnalysis['signals'] = {
    scoreVelocity: velocity,
    scoreAcceleration: acceleration,
    engagementTrend: velocity * 0.8, // simplified proxy
    peakScore,
    currentScore,
    ageInDays,
  };

  const { phase, confidence } = classifyHypePhase(signals);

  const recommendations: Record<HypePhase, string> = {
    emerging: 'Entrez maintenant — produit en phase de démarrage, opportunité élevée.',
    rising: 'Moment idéal pour lancer des campagnes pub et tester le marché.',
    peak: 'Maximisez vos revenus maintenant. La fenêtre commence à se fermer.',
    declining: 'Réduisez votre budget pub. Préparez votre sortie ou cherchez un renouveau.',
    saturated: 'Marché saturé. Évitez d\'investir davantage sur ce produit.',
    dead: 'Produit en fin de vie. Passez à autre chose.',
  };

  const analysis: HypeAnalysis = {
    productId,
    phase,
    confidence,
    recommendation: recommendations[phase],
    signals,
  };

  // Persist to DB
  await prisma.$executeRaw`
    INSERT INTO "HypeCycle" ("id", "productId", "phase", "confidence", "metadata")
    VALUES (
      gen_random_uuid(),
      ${productId}::uuid,
      ${phase},
      ${confidence},
      ${JSON.stringify(signals)}::jsonb
    )
  `;

  return analysis;
}

export async function predictProductSaturation(productId: string): Promise<SaturationPrediction> {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { id: true, score: true, metadata: true, createdAt: true },
  });

  if (!product) throw new Error(`Product ${productId} not found`);

  const scoreHistory = await prisma.productScore.findMany({
    where: { productId },
    orderBy: { scoredAt: 'asc' },
    select: { score: true, scoredAt: true },
  });

  const points: ScorePoint[] = scoreHistory.map(s => ({ score: s.score, date: s.scoredAt }));
  const currentScore = product.score ?? 0;
  const meta = product.metadata as any;
  const facebookAds = meta?.facebookAdCount ?? 0;

  const regression = linearRegression(points);
  const currentSaturation = Math.min(1, facebookAds / 500 + Math.max(0, -regression.slope / 10) * 0.5);
  const sat30d = predictSaturation(points, facebookAds, currentScore);
  const sat90d = Math.min(1, sat30d * 1.5 + currentSaturation * 0.2);

  // Days until saturation (score drops below 30)
  let daysUntilSaturated: number | null = null;
  if (regression.slope < 0) {
    const daysToThreshold = (currentScore - 30) / Math.abs(regression.slope);
    daysUntilSaturated = daysToThreshold > 0 ? Math.round(daysToThreshold) : 0;
  }

  const factors: string[] = [];
  if (facebookAds > 200) factors.push('Forte concurrence publicitaire Facebook');
  if (regression.slope < -1) factors.push('Score en baisse rapide');
  if (currentScore > 80) factors.push('Score élevé — proche du peak');
  if (sat30d > 0.7) factors.push('Saturation imminente prévue dans 30 jours');
  if (factors.length === 0) factors.push('Pas de signal majeur de saturation');

  return {
    productId,
    currentSaturation,
    predictedSaturation30d: sat30d,
    predictedSaturation90d: sat90d,
    daysUntilSaturated,
    confidence: Math.min(0.9, 0.4 + (points.length / 100) * 0.5),
    factors,
  };
}

// ─── AI Branding Generator ────────────────────────────────────────────────────

export interface BrandingResult {
  brandName: string;
  tagline: string;
  colorPalette: { primary: string; secondary: string; accent: string; background: string };
  typography: { heading: string; body: string };
  voiceTone: string;
  targetAudience: string;
  uniqueSellingPoints: string[];
  adAngles: string[];
}

export async function generateBranding(
  productTitle: string,
  productDescription: string,
  targetCountry = 'FR'
): Promise<BrandingResult> {
  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1000,
    messages: [
      {
        role: 'user',
        content: `Tu es un expert en branding e-commerce. Génère un branding complet pour ce produit dropshipping.

Produit: ${productTitle}
Description: ${productDescription}
Marché cible: ${targetCountry}

Réponds UNIQUEMENT avec un objet JSON valide (pas de markdown) avec cette structure exacte:
{
  "brandName": "nom de marque accrocheur",
  "tagline": "slogan court et percutant",
  "colorPalette": {
    "primary": "#hexcode",
    "secondary": "#hexcode",
    "accent": "#hexcode",
    "background": "#hexcode"
  },
  "typography": {
    "heading": "nom de police Google",
    "body": "nom de police Google"
  },
  "voiceTone": "description du ton (ex: moderne, minimaliste, premium)",
  "targetAudience": "description de l'audience cible",
  "uniqueSellingPoints": ["USP1", "USP2", "USP3"],
  "adAngles": ["angle1", "angle2", "angle3"]
}`,
      },
    ],
  });

  const text = message.content[0]?.type === 'text' ? message.content[0].text : '{}';
  const clean = text.replace(/```json|```/g, '').trim();

  try {
    return JSON.parse(clean) as BrandingResult;
  } catch {
    logger.error('[Branding] Failed to parse AI response', clean);
    throw new Error('Branding generation failed: invalid JSON response');
  }
}

// ─── Country Recommendation ───────────────────────────────────────────────────

export interface CountryRecommendation {
  countryCode: string;
  countryName: string;
  score: number;
  reason: string;
  estimatedMargin: number;
  competition: 'low' | 'medium' | 'high';
  trend: 'growing' | 'stable' | 'declining';
}

const COUNTRY_BASELINES: Record<string, { name: string; ecommerceMaturity: number; avgMargin: number; competition: number }> = {
  FR: { name: 'France', ecommerceMaturity: 0.8, avgMargin: 0.35, competition: 0.65 },
  DE: { name: 'Allemagne', ecommerceMaturity: 0.85, avgMargin: 0.38, competition: 0.7 },
  GB: { name: 'Royaume-Uni', ecommerceMaturity: 0.9, avgMargin: 0.4, competition: 0.75 },
  US: { name: 'États-Unis', ecommerceMaturity: 0.95, avgMargin: 0.42, competition: 0.9 },
  ES: { name: 'Espagne', ecommerceMaturity: 0.7, avgMargin: 0.32, competition: 0.5 },
  IT: { name: 'Italie', ecommerceMaturity: 0.65, avgMargin: 0.3, competition: 0.45 },
  NL: { name: 'Pays-Bas', ecommerceMaturity: 0.88, avgMargin: 0.4, competition: 0.6 },
  BE: { name: 'Belgique', ecommerceMaturity: 0.75, avgMargin: 0.34, competition: 0.52 },
  PL: { name: 'Pologne', ecommerceMaturity: 0.6, avgMargin: 0.28, competition: 0.35 },
  SE: { name: 'Suède', ecommerceMaturity: 0.82, avgMargin: 0.37, competition: 0.55 },
};

export async function recommendCountries(
  productId: string,
  topN = 5
): Promise<CountryRecommendation[]> {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { id: true, title: true, score: true, metadata: true },
  });

  if (!product) throw new Error(`Product ${productId} not found`);

  const countryData = await prisma.productCountry.findMany({
    where: { productId },
  });

  const countryMap = new Map(countryData.map(c => [c.countryCode, c]));
  const recommendations: CountryRecommendation[] = [];

  for (const [code, baseline] of Object.entries(COUNTRY_BASELINES)) {
    const existing = countryMap.get(code);

    const countryScore = existing?.score ?? Math.round(
      (product.score ?? 50) * baseline.ecommerceMaturity * (1 - baseline.competition * 0.3)
    );

    const margin = existing?.estimatedMargin
      ? parseFloat(existing.estimatedMargin.toString())
      : baseline.avgMargin;

    const saturation = existing?.saturation
      ? parseFloat(existing.saturation.toString())
      : baseline.competition;

    const competition: CountryRecommendation['competition'] =
      saturation > 0.7 ? 'high' : saturation > 0.4 ? 'medium' : 'low';

    const trend: CountryRecommendation['trend'] =
      countryScore > 70 ? 'growing' : countryScore > 40 ? 'stable' : 'declining';

    const competitionLabels = { low: 'faible', medium: 'modérée', high: 'forte' };
    const trendLabels = { growing: 'croissant', stable: 'stable', declining: 'en baisse' };

    recommendations.push({
      countryCode: code,
      countryName: baseline.name,
      score: countryScore,
      reason: `Marché ${trendLabels[trend]}, concurrence ${competitionLabels[competition]}, marge estimée ${Math.round(margin * 100)}%`,
      estimatedMargin: margin,
      competition,
      trend,
    });
  }

  return recommendations
    .sort((a, b) => b.score - a.score)
    .slice(0, topN);
}
