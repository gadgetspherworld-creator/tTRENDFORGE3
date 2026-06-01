import { chromium, Browser, Page } from 'playwright';
import { prisma } from '@trendforge/database';
import { logger } from '@trendforge/logger';
import { ProductSource } from '@trendforge/types';
import type { ScrapeResult, ScrapedProduct } from '../types/scraper.types';

interface RedditPost {
  id: string;
  title: string;
  url: string;
  thumbnail: string;
  score: number;
  num_comments: number;
  subreddit: string;
  author: string;
  created_utc: number;
  selftext: string;
  link_flair_text?: string;
}

const DROPSHIPPING_SUBREDDITS = [
  'dropship',
  'dropshipping',
  'entrepeneur',
  'ecommerce',
  'Flipping',
  'sidehustle',
  'AmazonFBA',
  'FulfillmentByAmazon',
];

export class RedditScraper {
  private browser: Browser | null = null;
  private rateLimit = 2000; // ms between requests

  async init(): Promise<void> {
    this.browser = await chromium.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-blink-features=AutomationControlled',
      ],
    });
  }

  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  private async sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Fetch trending posts via Reddit JSON API (no auth needed for public data)
   */
  private async fetchSubredditHot(subreddit: string, limit = 25): Promise<RedditPost[]> {
    try {
      const url = `https://www.reddit.com/r/${subreddit}/hot.json?limit=${limit}&t=week`;
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'TrendForge/1.0 (product intelligence bot; contact@trendforge.io)',
        },
      });

      if (!response.ok) {
        logger.warn(`Reddit API error for r/${subreddit}: ${response.status}`);
        return [];
      }

      const data = await response.json();
      const posts: RedditPost[] = data?.data?.children?.map((child: any) => child.data) ?? [];
      return posts;
    } catch (err) {
      logger.error(`Failed to fetch r/${subreddit}`, err);
      return [];
    }
  }

  /**
   * Playwright fallback: scrape Reddit search for trending products
   */
  private async scrapeWithPlaywright(keyword: string): Promise<Partial<ScrapedProduct>[]> {
    if (!this.browser) throw new Error('Browser not initialized');

    const page: Page = await this.browser.newPage();
    const products: Partial<ScrapedProduct>[] = [];

    try {
      await page.setExtraHTTPHeaders({
        'Accept-Language': 'en-US,en;q=0.9',
      });

      await page.goto(
        `https://www.reddit.com/search/?q=${encodeURIComponent(keyword)}&sort=hot&t=week`,
        { waitUntil: 'domcontentloaded', timeout: 30000 }
      );

      await page.waitForTimeout(2000);

      const posts = await page.$$eval('[data-testid="post-container"]', (els) =>
        els.slice(0, 20).map(el => ({
          title: el.querySelector('[data-click-id="text"]')?.textContent?.trim() ?? '',
          score: el.querySelector('[id^="vote-arrows"]')?.textContent?.trim() ?? '0',
          comments: el.querySelector('[data-click-id="comments"]')?.textContent?.trim() ?? '0',
          subreddit: el.querySelector('[data-click-id="subreddit"]')?.textContent?.trim() ?? '',
          url: (el.querySelector('a[data-click-id="timestamp"]') as HTMLAnchorElement)?.href ?? '',
        }))
      );

      for (const post of posts) {
        if (!post.title) continue;
        products.push({
          externalId: `reddit_${Buffer.from(post.url).toString('base64').slice(0, 16)}`,
          title: post.title,
          url: post.url,
          source: ProductSource.REDDIT,
          engagementScore: parseInt(post.score.replace(/[^0-9]/g, '')) || 0,
          metadata: {
            subreddit: post.subreddit,
            comments: post.comments,
            platform: 'reddit',
          },
        });
      }
    } catch (err) {
      logger.error('Reddit Playwright scrape failed', err);
    } finally {
      await page.close();
    }

    return products;
  }

  /**
   * Extract product signals from Reddit posts
   */
  private parsePostToProduct(post: RedditPost): Partial<ScrapedProduct> | null {
    const title = post.title.toLowerCase();

    // Filter for product-related posts
    const productKeywords = [
      'winning product', 'trending product', 'found a', 'selling well',
      'good product', 'dropship', 'amazon fba', 'aliexpress', 'temu',
      'side hustle', 'passive income', 'print on demand', 'etsy',
    ];
    const isProductRelated = productKeywords.some(kw => title.includes(kw));
    if (!isProductRelated && post.score < 100) return null;

    // Try to extract price mentions
    const priceMatch = post.selftext.match(/\$([0-9]+(?:\.[0-9]{2})?)/);
    const price = priceMatch ? parseFloat(priceMatch[1]) : undefined;

    return {
      externalId: `reddit_${post.id}`,
      title: post.title,
      url: `https://reddit.com${post.id}`,
      source: ProductSource.REDDIT,
      price,
      engagementScore: post.score,
      metadata: {
        subreddit: post.subreddit,
        author: post.author,
        numComments: post.num_comments,
        flairText: post.link_flair_text,
        createdAt: new Date(post.created_utc * 1000).toISOString(),
        platform: 'reddit',
      },
    };
  }

  async scrape(options?: { subreddits?: string[]; limit?: number }): Promise<ScrapeResult<ScrapedProduct>> {
    const subreddits = options?.subreddits ?? DROPSHIPPING_SUBREDDITS;
    const limit = options?.limit ?? 25;
    const results: ScrapedProduct[] = [];
    const errors: string[] = [];

    logger.info(`[RedditScraper] Starting scrape for ${subreddits.length} subreddits`);

    for (const subreddit of subreddits) {
      try {
        await this.sleep(this.rateLimit);
        const posts = await this.fetchSubredditHot(subreddit, limit);

        for (const post of posts) {
          try {
            const product = this.parsePostToProduct(post);
            if (!product) continue;

            const saved = await prisma.product.upsert({
              where: { externalId: product.externalId! },
              update: {
                engagementScore: product.engagementScore,
                metadata: product.metadata as any,
                updatedAt: new Date(),
              },
              create: {
                externalId: product.externalId!,
                title: product.title!,
                url: product.url,
                source: product.source!,
                price: product.price,
                engagementScore: product.engagementScore ?? 0,
                metadata: product.metadata as any,
              },
            });

            results.push(saved as unknown as ScrapedProduct);
          } catch (itemErr) {
            const msg = `Failed to save Reddit post ${post.id}: ${itemErr}`;
            logger.warn(msg);
            errors.push(msg);
          }
        }

        logger.info(`[RedditScraper] r/${subreddit}: ${posts.length} posts fetched`);
      } catch (err) {
        const msg = `Failed to scrape r/${subreddit}: ${err}`;
        logger.error(msg);
        errors.push(msg);
      }
    }

    // Playwright fallback for additional trending keywords
    try {
      await this.init();
      const playwrightResults = await this.scrapeWithPlaywright('trending dropshipping product 2026');

      for (const product of playwrightResults) {
        try {
          const saved = await prisma.product.upsert({
            where: { externalId: product.externalId! },
            update: { metadata: product.metadata as any, updatedAt: new Date() },
            create: {
              externalId: product.externalId!,
              title: product.title!,
              url: product.url,
              source: product.source!,
              engagementScore: product.engagementScore ?? 0,
              metadata: product.metadata as any,
            },
          });
          results.push(saved as unknown as ScrapedProduct);
        } catch (_) { /* skip duplicates */ }
      }
    } finally {
      await this.close();
    }

    logger.info(`[RedditScraper] Done. ${results.length} products saved, ${errors.length} errors`);

    return {
      success: errors.length === 0,
      count: results.length,
      data: results,
      errors,
      scrapedAt: new Date(),
      source: ProductSource.REDDIT,
    };
  }
}
