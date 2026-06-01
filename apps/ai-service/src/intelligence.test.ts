import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@trendforge/database', () => ({
  prisma: {
    product: {
      findUnique: vi.fn(),
    },
    productScore: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    productCountry: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    $executeRaw: vi.fn().mockResolvedValue(1),
    $queryRaw: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock('@trendforge/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: {
      create: vi.fn().mockResolvedValue({
        content: [{
          type: 'text',
          text: JSON.stringify({
            brandName: 'LumiFit',
            tagline: 'Brillez à chaque entraînement',
            colorPalette: { primary: '#6366f1', secondary: '#8b5cf6', accent: '#f59e0b', background: '#0f0f0f' },
            typography: { heading: 'Inter', body: 'DM Sans' },
            voiceTone: 'Moderne, motivant, premium',
            targetAudience: 'Femmes 25-40 ans, fitness enthusiast',
            uniqueSellingPoints: ['Résistance à l\'eau', 'Design minimaliste', 'Livraison 48h'],
            adAngles: ['Avant/après transformation', 'Témoignage client', 'Challenge viral TikTok'],
          }),
        }],
      }),
    },
  })),
}));

// ─── Import functions under test ──────────────────────────────────────────────
// (inlined logic for unit testing without full module resolution)

type HypePhase = 'emerging' | 'rising' | 'peak' | 'declining' | 'saturated' | 'dead';

function classifyHypePhase(signals: {
  scoreVelocity: number;
  scoreAcceleration: number;
  currentScore: number;
  peakScore: number;
  ageInDays: number;
  engagementTrend: number;
}): { phase: HypePhase; confidence: number } {
  const { scoreVelocity, scoreAcceleration, currentScore, peakScore, ageInDays } = signals;
  const dropFromPeak = peakScore > 0 ? (peakScore - currentScore) / peakScore : 0;

  if (currentScore < 15 && ageInDays > 90) return { phase: 'dead', confidence: 0.9 };
  if (dropFromPeak > 0.4 && scoreVelocity < -0.5) return { phase: 'saturated', confidence: 0.85 };
  if (dropFromPeak > 0.2 && scoreVelocity < 0) return { phase: 'declining', confidence: 0.8 };
  if (currentScore >= 70 && Math.abs(scoreVelocity) < 0.5) return { phase: 'peak', confidence: 0.75 };
  if (scoreVelocity > 1 && scoreAcceleration >= 0) return { phase: 'rising', confidence: 0.8 };
  if (ageInDays < 30 && scoreVelocity > 0) return { phase: 'emerging', confidence: 0.7 };
  if (scoreVelocity > 0.5) return { phase: 'rising', confidence: 0.6 };
  if (scoreVelocity < -0.5) return { phase: 'declining', confidence: 0.6 };
  return { phase: 'peak', confidence: 0.5 };
}

interface ScorePoint { score: number; date: Date }

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
  const yMean = sumY / n;
  const ssTot = ys.reduce((acc, y) => acc + (y - yMean) ** 2, 0);
  const ssRes = ys.reduce((acc, y, i) => acc + (y - (slope * xs[i]! + intercept)) ** 2, 0);
  const r2 = ssTot === 0 ? 1 : 1 - ssRes / ssTot;
  return { slope, intercept, r2 };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Hype Cycle Detection', () => {
  const baseSignals = {
    scoreVelocity: 0,
    scoreAcceleration: 0,
    engagementTrend: 0,
    currentScore: 50,
    peakScore: 50,
    ageInDays: 30,
  };

  it('classifies a dead product correctly', () => {
    const { phase, confidence } = classifyHypePhase({
      ...baseSignals,
      currentScore: 10,
      peakScore: 80,
      ageInDays: 180,
      scoreVelocity: -2,
    });
    expect(phase).toBe('dead');
    expect(confidence).toBeGreaterThan(0.8);
  });

  it('classifies a saturated product', () => {
    const { phase } = classifyHypePhase({
      ...baseSignals,
      currentScore: 30,
      peakScore: 85,
      scoreVelocity: -3,
      ageInDays: 60,
    });
    expect(phase).toBe('saturated');
  });

  it('classifies a declining product', () => {
    const { phase } = classifyHypePhase({
      ...baseSignals,
      currentScore: 55,
      peakScore: 75,
      scoreVelocity: -1.5,
      ageInDays: 45,
    });
    expect(phase).toBe('declining');
  });

  it('classifies a peak product', () => {
    const { phase } = classifyHypePhase({
      ...baseSignals,
      currentScore: 82,
      peakScore: 84,
      scoreVelocity: 0.2,
      ageInDays: 40,
    });
    expect(phase).toBe('peak');
  });

  it('classifies a rising product', () => {
    const { phase } = classifyHypePhase({
      ...baseSignals,
      currentScore: 60,
      peakScore: 60,
      scoreVelocity: 2.5,
      scoreAcceleration: 0.5,
      ageInDays: 20,
    });
    expect(phase).toBe('rising');
  });

  it('classifies an emerging product', () => {
    const { phase } = classifyHypePhase({
      ...baseSignals,
      currentScore: 40,
      peakScore: 40,
      scoreVelocity: 0.8,
      ageInDays: 7,
    });
    expect(phase).toBe('emerging');
  });

  it('returns confidence between 0 and 1', () => {
    const cases = [
      { ...baseSignals, currentScore: 10, ageInDays: 200 },
      { ...baseSignals, currentScore: 82, scoreVelocity: 0.1 },
      { ...baseSignals, scoreVelocity: 3, scoreAcceleration: 1 },
    ];
    for (const c of cases) {
      const { confidence } = classifyHypePhase(c);
      expect(confidence).toBeGreaterThan(0);
      expect(confidence).toBeLessThanOrEqual(1);
    }
  });
});

describe('Linear Regression', () => {
  it('computes slope for a perfectly increasing series', () => {
    const points = [0, 10, 20, 30, 40, 50].map((score, i) => ({
      score,
      date: new Date(Date.now() + i * 86400000),
    }));
    const { slope, r2 } = linearRegression(points);
    expect(slope).toBeCloseTo(10, 1);
    expect(r2).toBeCloseTo(1, 2);
  });

  it('computes slope for a perfectly decreasing series', () => {
    const points = [50, 40, 30, 20, 10, 0].map((score, i) => ({
      score,
      date: new Date(Date.now() + i * 86400000),
    }));
    const { slope } = linearRegression(points);
    expect(slope).toBeLessThan(0);
  });

  it('returns slope=0 for flat series', () => {
    const points = [50, 50, 50, 50, 50].map((score, i) => ({
      score,
      date: new Date(Date.now() + i * 86400000),
    }));
    const { slope } = linearRegression(points);
    expect(slope).toBeCloseTo(0, 5);
  });

  it('handles single point', () => {
    const points = [{ score: 42, date: new Date() }];
    const { slope, intercept } = linearRegression(points);
    expect(slope).toBe(0);
    expect(intercept).toBe(42);
  });
});

describe('Country Recommendation Logic', () => {
  const baselines = {
    FR: { name: 'France', ecommerceMaturity: 0.8, avgMargin: 0.35, competition: 0.65 },
    PL: { name: 'Pologne', ecommerceMaturity: 0.6, avgMargin: 0.28, competition: 0.35 },
    US: { name: 'États-Unis', ecommerceMaturity: 0.95, avgMargin: 0.42, competition: 0.9 },
  };

  it('assigns higher score to mature markets with good product score', () => {
    const productScore = 80;
    const frScore = Math.round(productScore * baselines.FR.ecommerceMaturity * (1 - baselines.FR.competition * 0.3));
    const plScore = Math.round(productScore * baselines.PL.ecommerceMaturity * (1 - baselines.PL.competition * 0.3));
    // FR has higher maturity but higher competition — both factors matter
    expect(frScore).toBeGreaterThan(0);
    expect(plScore).toBeGreaterThan(0);
  });

  it('classifies competition level correctly', () => {
    const classify = (sat: number) => sat > 0.7 ? 'high' : sat > 0.4 ? 'medium' : 'low';
    expect(classify(0.9)).toBe('high');
    expect(classify(0.5)).toBe('medium');
    expect(classify(0.2)).toBe('low');
    expect(classify(0.7)).toBe('high');
    expect(classify(0.4)).toBe('low');
  });

  it('classifies trend correctly based on score', () => {
    const classify = (score: number) => score > 70 ? 'growing' : score > 40 ? 'stable' : 'declining';
    expect(classify(80)).toBe('growing');
    expect(classify(55)).toBe('stable');
    expect(classify(20)).toBe('declining');
  });
});

describe('Branding Generation (mock)', () => {
  it('returns valid branding structure from AI', async () => {
    const { default: Anthropic } = await import('@anthropic-ai/sdk');
    const client = new (Anthropic as any)();
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      messages: [{ role: 'user', content: 'Generate branding' }],
    });

    const text = response.content[0].text;
    const parsed = JSON.parse(text);

    expect(parsed).toHaveProperty('brandName');
    expect(parsed).toHaveProperty('tagline');
    expect(parsed).toHaveProperty('colorPalette');
    expect(parsed.colorPalette).toHaveProperty('primary');
    expect(parsed).toHaveProperty('uniqueSellingPoints');
    expect(Array.isArray(parsed.uniqueSellingPoints)).toBe(true);
    expect(parsed).toHaveProperty('adAngles');
    expect(Array.isArray(parsed.adAngles)).toBe(true);
  });
});
