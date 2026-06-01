import { chromium, Browser, Page, Route } from 'playwright';
import { prisma } from '@trendforge/database';
import { logger } from '@trendforge/logger';
import { ProductSource } from '@trendforge/types';
import type { ScrapeResult, ScrapedProduct } from '../types/scraper.types';

interface PinterestPin {
  id: string;
  title?: string;
  description?: string;
  image_url?: string;
  link?: string;
  dominant_color?: string;
  repin_count?: number;
  comment_count?: number;
  board?: { name: string; url: string };
  rich_metadata?: {
    price_value?: number;
    price_currency?: string;
    site_name?: string;
    products?: Array<{ price: number; currency: string; name: string }>;
  };
}

const TRENDING_KEYWORDS = [
  'dropshipping products 2026',
  'trending products to sell',
  'winning products ecommerce',
  'best selling products online',
  'viral products tiktok',
  'print on demand ideas',
  'unique gifts to sell',
];

const SHOPPING_CATEGORIES = [
  'home decor',
  'beauty products',
  'fitness gadgets',
  'pet accessories',
  'kitchen gadgets',
  'tech accessories',
];

export class PinterestScraper {
  private browser: Browser | null = null;
  private interceptedPins: PinterestPin[] = [];

  async init(): Promise<void> {
    this.browser = await chromium.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-blink-features=AutomationControlled',
        '--disable-web-security',
      ],
    });
  }

  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  private async sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Set up API interception to capture Pinterest's internal resource API
   */
  private setupInterception(page: Page): void {
    page.route('**/resource/BaseSearchResource/get/**', async (route: Route) => {
      const response = await route.fetch();
      try {
        const json = await response.json();
        const pins: PinterestPin[] = json?.resource_response?.data?.results ?? [];
        this.interceptedPins.push(...pins.filter(p => p.id));
      } catch (_) { /* non-JSON response */ }
      await route.fulfill({ response });
    });

    page.route('**/resource/SearchResource/get/**', async (route: Route) => {
      const response = await route.fetch();
      try {
        const json = await response.json();
        const pins: PinterestPin[] = json?.resource_response?.data?.results ?? [];
        this.interceptedPins.push(...pins.filter(p => p.id));
      } catch (_) { /* skip */ }
      await route.fulfill({ response });
    });

    // Catch v3 API calls
    page.route('**/v3/search/pins/**', async (route: Route) => {
      const response = await route.fetch();
      try {
        const json = await response.json();
        const pins: PinterestPin[] = json?.data ?? [];
        this.interceptedPins.push(...pins.filter(p => p.id));
      } catch (_) { /* skip */ }
      await route.fulfill({ response });
    });
  }

  /**
   * DOM fallback: parse pins directly from the page HTML
   */
  private async parsePinsFromDOM(page: Page): Promise<Partial<ScrapedProduct>[]> {
    return page.$$eval('[data-test-id="pin"]', (els) =>
      els.slice(0, 30).map(el => {
        const img = el.querySelector('img') as HTMLImageElement;
        const link = el.querySelector('a') as HTMLAnchorElement;
        const title = el.querySelector('[data-test-id="pin-title"]')?.textContent?.trim()
          ?? img?.alt?.trim()
          ?? '';
        const priceEl = el.querySelector('[data-test-id="price"]');
        const priceText = priceEl?.textContent?.replace(/[^0-9.]/g, '') ?? '';

        return {
          title,
          imageUrl: img?.src ?? '',
          url: link?.href ?? '',
          price: priceText ? parseFloat(priceText) : undefined,
        };
      }).filter(p => p.title)
    );
  }

  /**
   * Scrape Pinterest search for a given keyword
   */
  private async scrapeKeyword(keyword: string): Promise<Partial<ScrapedProduct>[]> {
    if (!this.browser) throw new Error('Browser not initialized');

    const page = await this.browser.newPage();
    this.interceptedPins = [];

    try {
      await page.setExtraHTTPHeaders({
        'Accept-Language': 'en-US,en;q=0.9',
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      });

      this.setupInterception(page);

      const searchUrl = `https://www.pinterest.com/search/pins/?q=${encodeURIComponent(keyword)}&rs=typed`;
      await page.goto(searchUrl, { waitUntil: 'networkidle', timeout: 30000 });
      await this.sleep(2000);

      // Scroll to load more pins
      for (let i = 0; i < 3; i++) {
        await page.evaluate(() => window.scrollBy(0, window.innerHeight * 2));
        await this.sleep(1500);
      }

      const products: Partial<ScrapedProduct>[] = [];

      // Use intercepted API data first
      const seenIds = new Set<string>();
      for (const pin of this.interceptedPins) {
        if (seenIds.has(pin.id)) continue;
        seenIds.add(pin.id);

        const price = pin.rich_metadata?.price_value
          ?? pin.rich_metadata?.products?.[0]?.price;

        products.push({
          externalId: `pinterest_${pin.id}`,
          title: pin.title ?? pin.description?.slice(0, 120) ?? 'Pinterest Pin',
          imageUrl: pin.image_url,
          url: pin.link ?? `https://pinterest.com/pin/${pin.id}`,
          price,
          source: ProductSource.PINTEREST,
          engagementScore: pin.repin_count ?? 0,
          metadata: {
            pinId: pin.id,
            repinCount: pin.repin_count,
            commentCount: pin.comment_count,
            boardName: pin.board?.name,
            siteName: pin.rich_metadata?.site_name,
            dominantColor: pin.dominant_color,
            keyword,
            platform: 'pinterest',
          },
        });
      }

      // DOM fallback if API interception missed everything
      if (products.length < 5) {
        logger.warn(`[PinterestScraper] API interception yielded only ${products.length} for "${keyword}", using DOM fallback`);
        const domPins = await this.parsePinsFromDOM(page);
        for (const pin of domPins) {
          const id = Buffer.from(pin.url ?? pin.title ?? Math.random().toString()).toString('base64').slice(0, 16);
          if (seenIds.has(id)) continue;
          seenIds.add(id);
          products.push({
            ...pin,
            externalId: `pinterest_dom_${id}`,
            source: ProductSource.PINTEREST,
            engagementScore: 0,
            metadata: { keyword, platform: 'pinterest', source: 'dom' },
          });
        }
      }

      return products;
    } catch (err) {
      logger.error(`[PinterestScraper] Error scraping "${keyword}":`, err);
      return [];
    } finally {
      await page.close();
    }
  }

  /**
   * Scrape Pinterest trending/explore page
   */
  private async scrapeTrending(): Promise<Partial<ScrapedProduct>[]> {
    if (!this.browser) throw new Error('Browser not initialized');
    const page = await this.browser.newPage();
    this.interceptedPins = [];

    try {
      this.setupInterception(page);
      await page.goto('https://www.pinterest.com/today/', {
        waitUntil: 'networkidle',
        timeout: 30000,
      });
      await this.sleep(2000);
      await page.evaluate(() => window.scrollBy(0, window.innerHeight * 3));
      await this.sleep(2000);

      return this.interceptedPins.map(pin => ({
        externalId: `pinterest_trending_${pin.id}`,
        title: pin.title ?? pin.description?.slice(0, 120) ?? 'Trending Pin',
        imageUrl: pin.image_url,
        url: pin.link ?? `https://pinterest.com/pin/${pin.id}`,
        price: pin.rich_metadata?.price_value,
        source: ProductSource.PINTEREST,
        engagementScore: (pin.repin_count ?? 0) * 2, // trending gets bonus weight
        metadata: {
          pinId: pin.id,
          repinCount: pin.repin_count,
          boardName: pin.board?.name,
          platform: 'pinterest',
          source: 'trending',
        },
      }));
    } catch (err) {
      logger.error('[PinterestScraper] Error scraping trending:', err);
      return [];
    } finally {
      await page.close();
    }
  }

  async scrape(options?: { keywords?: string[]; includeTrending?: boolean }): Promise<ScrapeResult<ScrapedProduct>> {
    const keywords = options?.keywords ?? [...TRENDING_KEYWORDS, ...SHOPPING_CATEGORIES];
    const includeTrending = options?.includeTrending ?? true;

    const allProducts: Partial<ScrapedProduct>[] = [];
    const errors: string[] = [];
    const results: ScrapedProduct[] = [];

    await this.init();

    try {
      // Trending page
      if (includeTrending) {
        try {
          const trending = await this.scrapeTrending();
          allProducts.push(...trending);
          logger.info(`[PinterestScraper] Trending: ${trending.length} pins`);
        } catch (err) {
          errors.push(`Trending scrape failed: ${err}`);
        }
        await this.sleep(3000);
      }

      // Keyword searches
      for (const keyword of keywords) {
        try {
          await this.sleep(2500 + Math.random() * 1000);
          const pinProducts = await this.scrapeKeyword(keyword);
          allProducts.push(...pinProducts);
          logger.info(`[PinterestScraper] "${keyword}": ${pinProducts.length} pins`);
        } catch (err) {
          const msg = `Keyword "${keyword}" failed: ${err}`;
          logger.error(msg);
          errors.push(msg);
        }
      }

      // Deduplicate by externalId
      const seen = new Set<string>();
      const deduped = allProducts.filter(p => {
        if (!p.externalId || seen.has(p.externalId)) return false;
        seen.add(p.externalId);
        return true;
      });

      // Persist to DB
      for (const product of deduped) {
        try {
          const saved = await prisma.product.upsert({
            where: { externalId: product.externalId! },
            update: {
              engagementScore: product.engagementScore,
              price: product.price,
              imageUrl: product.imageUrl,
              metadata: product.metadata as any,
              updatedAt: new Date(),
            },
            create: {
              externalId: product.externalId!,
              title: product.title!,
              url: product.url,
              imageUrl: product.imageUrl,
              source: product.source!,
              price: product.price,
              engagementScore: product.engagementScore ?? 0,
              metadata: product.metadata as any,
            },
          });
          results.push(saved as unknown as ScrapedProduct);
        } catch (err) {
          errors.push(`Failed to save ${product.externalId}: ${err}`);
        }
      }
    } finally {
      await this.close();
    }

    logger.info(`[PinterestScraper] Done. ${results.length} saved, ${errors.length} errors`);

    return {
      success: errors.length === 0,
      count: results.length,
      data: results,
      errors,
      scrapedAt: new Date(),
      source: ProductSource.PINTEREST,
    };
  }
}
