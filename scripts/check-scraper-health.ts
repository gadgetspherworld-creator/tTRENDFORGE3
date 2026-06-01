import { Redis }        from 'ioredis'
import { PrismaClient } from '@trendforge/database'

const redis  = new Redis(process.env.REDIS_URL || 'redis://localhost:6379')
const prisma = new PrismaClient()

const SCRAPERS  = ['REDDIT', 'PINTEREST', 'TIKTOK_SHOP', 'AMAZON', 'ALIEXPRESS']
const THRESHOLD = 0.5

interface ScraperHealth {
  source:      string
  success:     number
  fail:        number
  ratio:       number
  status:      'healthy' | 'degraded' | 'down' | 'idle'
  lastProduct: Date | null
}

async function getLastProductDate(source: string): Promise<Date | null> {
  const p = await prisma.product.findFirst({
    where:   { source: source as any },
    orderBy: { createdAt: 'desc' },
    select:  { createdAt: true },
  })
  return p?.createdAt ?? null
}

async function checkScraper(source: string): Promise<ScraperHealth> {
  const [successRaw, failRaw] = await Promise.all([
    redis.get(`scraper:${source}:success`),
    redis.get(`scraper:${source}:fail`),
  ])

  const success = parseInt(successRaw || '0', 10)
  const fail    = parseInt(failRaw    || '0', 10)
  const total   = success + fail

  let status: ScraperHealth['status']
  if (total === 0)          status = 'idle'
  else if (fail === total)  status = 'down'
  else if (success / total < THRESHOLD) status = 'degraded'
  else                      status = 'healthy'

  return { source, success, fail, ratio: total > 0 ? Math.round((success / total) * 100) : 0, status, lastProduct: await getLastProductDate(source) }
}

function formatAge(date: Date | null): string {
  if (!date) return 'jamais'
  const mins = Math.round((Date.now() - date.getTime()) / 60_000)
  if (mins < 60)   return `${mins}m`
  if (mins < 1440) return `${Math.round(mins / 60)}h`
  return `${Math.round(mins / 1440)}j`
}

const STATUS_ICON: Record<string, string> = { healthy: '✅', degraded: '⚠️ ', down: '❌', idle: '😴' }

async function main() {
  console.log('\n📊 TrendForge — Scraper Health Check')
  console.log('─'.repeat(60))

  const results = await Promise.all(SCRAPERS.map(checkScraper))

  console.log('Source'.padEnd(16) + 'Status'.padEnd(12) + 'Succès'.padEnd(9) + 'Échecs'.padEnd(9) + 'Ratio'.padEnd(8) + 'Dernier produit')
  console.log('─'.repeat(60))

  let hasIssue = false
  for (const h of results) {
    if (h.status !== 'healthy' && h.status !== 'idle') hasIssue = true
    console.log(
      h.source.padEnd(16) +
      `${STATUS_ICON[h.status]} ${h.status}`.padEnd(14) +
      String(h.success).padEnd(9) +
      String(h.fail).padEnd(9) +
      `${h.ratio}%`.padEnd(8) +
      formatAge(h.lastProduct)
    )
  }

  console.log('─'.repeat(60))
  const down     = results.filter(r => r.status === 'down')
  const degraded = results.filter(r => r.status === 'degraded')
  const idle     = results.filter(r => r.status === 'idle')

  if (down.length)     console.log(`\n❌ SCRAPERS DOWN     : ${down.map(r => r.source).join(', ')}`)
  if (degraded.length) console.log(`⚠️  SCRAPERS DÉGRADÉS : ${degraded.map(r => r.source).join(', ')}`)
  if (idle.length)     console.log(`😴 SCRAPERS INACTIFS  : ${idle.map(r => r.source).join(', ')}`)
  if (!hasIssue)       console.log('\n✅ Tous les scrapers actifs sont en bonne santé.')

  process.exit(hasIssue ? 1 : 0)
}

main()
  .catch(e => { console.error('Erreur health check :', e); process.exit(1) })
  .finally(() => { redis.quit(); prisma.$disconnect() })
