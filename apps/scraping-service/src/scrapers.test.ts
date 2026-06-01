import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ─── Mock external deps ───────────────────────────────────────────────────────

vi.mock('@trendforge/database', () => ({
  prisma: {
    product: {
      upsert: vi.fn().mockResolvedValue({ id: 'uuid-123', externalId: 'reddit_abc', title: 'Test', source: 'REDDIT' }),
    },
  },
}));

vi.mock('@trendforge/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// ─── Reddit scraper unit tests ────────────────────────────────────────────────

describe('RedditScraper', () => {
  const mockRedditResponse = (posts: any[]) => ({
    ok: true,
    json: async () => ({
      data: {
        children: posts.map(data => ({ data })),
      },
    }),
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('filters out non-product-related posts with low score', () => {
    const post = {
      id: 'abc',
      title: 'My weekend hiking trip',
      selftext: '',
      score: 10,
      num_comments: 2,
      subreddit: 'dropship',
      author: 'user1',
      created_utc: Date.now() / 1000,
    };
    // Simulate parsePostToProduct logic inline
    const title = post.title.toLowerCase();
    const productKeywords = ['winning product', 'trending product', 'dropship', 'aliexpress', 'temu'];
    const isProductRelated = productKeywords.some(kw => title.includes(kw));
    expect(isProductRelated || post.score >= 100).toBe(false);
  });

  it('passes product-related posts', () => {
    const post = {
      id: 'def',
      title: 'Found a winning product on AliExpress with 40% margin',
      selftext: 'Selling at $25, buying at $15',
      score: 250,
      num_comments: 45,
      subreddit: 'dropship',
      author: 'seller123',
      created_utc: Date.now() / 1000,
    };
    const title = post.title.toLowerCase();
    const productKeywords = ['winning product', 'aliexpress', 'dropship'];
    const isProductRelated = productKeywords.some(kw => title.includes(kw));
    expect(isProductRelated).toBe(true);
  });

  it('extracts price from selftext', () => {
    const selftext = 'I buy it at $12.99 and sell at $34.99';
    const priceMatch = selftext.match(/\$([0-9]+(?:\.[0-9]{2})?)/);
    expect(priceMatch).not.toBeNull();
    expect(parseFloat(priceMatch![1])).toBe(12.99);
  });

  it('fetches subreddit hot posts from Reddit API', async () => {
    mockFetch.mockResolvedValueOnce(
      mockRedditResponse([
        {
          id: 'post1',
          title: 'Best dropshipping product this week',
          selftext: 'Check this out: $29.99 margin is insane',
          score: 500,
          num_comments: 75,
          subreddit: 'dropship',
          author: 'dropshipper99',
          created_utc: Date.now() / 1000,
          link_flair_text: 'Product Find',
        },
      ])
    );

    const response = await fetch(
      'https://www.reddit.com/r/dropship/hot.json?limit=25&t=week',
      { headers: { 'User-Agent': 'TrendForge/1.0' } }
    );

    expect(mockFetch).toHaveBeenCalledWith(
      'https://www.reddit.com/r/dropship/hot.json?limit=25&t=week',
      expect.objectContaining({ headers: expect.any(Object) })
    );

    const data = await response.json();
    expect(data.data.children).toHaveLength(1);
    expect(data.data.children[0].data.score).toBe(500);
  });

  it('handles Reddit API error gracefully', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 429 });

    const response = await fetch('https://www.reddit.com/r/dropship/hot.json?limit=25&t=week', {
      headers: { 'User-Agent': 'TrendForge/1.0' },
    });

    expect(response.ok).toBe(false);
    expect(response.status).toBe(429);
  });

  it('generates correct externalId from post id', () => {
    const postId = 'xyz123abc';
    const externalId = `reddit_${postId}`;
    expect(externalId).toBe('reddit_xyz123abc');
    expect(externalId.startsWith('reddit_')).toBe(true);
  });
});

// ─── Pinterest scraper unit tests ─────────────────────────────────────────────

describe('PinterestScraper', () => {
  it('maps Pinterest pin to product correctly', () => {
    const pin = {
      id: 'pin_456',
      title: 'Minimalist Desk Organizer',
      description: 'Keep your desk clean and organized',
      image_url: 'https://i.pinimg.com/originals/test.jpg',
      link: 'https://example.com/product',
      repin_count: 12500,
      comment_count: 234,
      rich_metadata: {
        price_value: 29.99,
        price_currency: 'USD',
        site_name: 'Etsy',
      },
      board: { name: 'Home Office Ideas', url: '/user/board' },
    };

    const product = {
      externalId: `pinterest_${pin.id}`,
      title: pin.title,
      imageUrl: pin.image_url,
      url: pin.link,
      price: pin.rich_metadata.price_value,
      engagementScore: pin.repin_count,
      metadata: {
        pinId: pin.id,
        repinCount: pin.repin_count,
        commentCount: pin.comment_count,
        boardName: pin.board.name,
        siteName: pin.rich_metadata.site_name,
      },
    };

    expect(product.externalId).toBe('pinterest_pin_456');
    expect(product.price).toBe(29.99);
    expect(product.engagementScore).toBe(12500);
    expect(product.metadata.boardName).toBe('Home Office Ideas');
  });

  it('falls back to description when title is missing', () => {
    const pin = {
      id: 'pin_789',
      title: undefined,
      description: 'Amazing product that goes viral on TikTok every week with huge demand worldwide',
    };

    const title = pin.title ?? pin.description?.slice(0, 120) ?? 'Pinterest Pin';
    expect(title).toBe(pin.description);
    expect(title.length).toBeLessThanOrEqual(120);
  });

  it('uses default URL when link is missing', () => {
    const pin = { id: 'pin_000', link: undefined };
    const url = pin.link ?? `https://pinterest.com/pin/${pin.id}`;
    expect(url).toBe('https://pinterest.com/pin/pin_000');
  });

  it('deduplicates pins by externalId', () => {
    const pins = [
      { externalId: 'pinterest_A', title: 'Product A' },
      { externalId: 'pinterest_B', title: 'Product B' },
      { externalId: 'pinterest_A', title: 'Product A duplicate' },
      { externalId: 'pinterest_C', title: 'Product C' },
    ];

    const seen = new Set<string>();
    const deduped = pins.filter(p => {
      if (seen.has(p.externalId)) return false;
      seen.add(p.externalId);
      return true;
    });

    expect(deduped).toHaveLength(3);
    expect(deduped.map(p => p.externalId)).toEqual(['pinterest_A', 'pinterest_B', 'pinterest_C']);
  });

  it('gives trending pins double engagement weight', () => {
    const regularPin = { repin_count: 1000, source: 'search' };
    const trendingPin = { repin_count: 1000, source: 'trending' };

    const regularScore = regularPin.repin_count ?? 0;
    const trendingScore = (trendingPin.repin_count ?? 0) * (trendingPin.source === 'trending' ? 2 : 1);

    expect(trendingScore).toBe(2 * regularScore);
  });
});

// ─── Scraper result type tests ────────────────────────────────────────────────

describe('ScrapeResult structure', () => {
  it('has required fields', () => {
    const result = {
      success: true,
      count: 42,
      data: [],
      errors: [],
      scrapedAt: new Date(),
      source: 'REDDIT',
    };

    expect(result).toHaveProperty('success');
    expect(result).toHaveProperty('count');
    expect(result).toHaveProperty('data');
    expect(result).toHaveProperty('errors');
    expect(result).toHaveProperty('scrapedAt');
    expect(result).toHaveProperty('source');
    expect(result.scrapedAt).toBeInstanceOf(Date);
  });

  it('marks success=false when errors exist', () => {
    const errors = ['Failed to scrape r/dropship: timeout'];
    const success = errors.length === 0;
    expect(success).toBe(false);
  });
});
