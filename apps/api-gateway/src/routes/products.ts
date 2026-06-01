import type { FastifyPluginAsync } from 'fastify'
import { prisma } from '@trendforge/database'

export const productRoutes: FastifyPluginAsync = async (app) => {

  // ── GET /products/stats — AVANT /:id pour éviter le conflit de routing ──────
  app.get('/stats', { preHandler: [app.authenticate] }, async (req) => {
    const { userId } = req.user as any
    const [total, rising, avg, watchlistCount] = await Promise.all([
      prisma.product.count(),
      prisma.product.count({ where: { score: { gte: 70 } } }),
      prisma.product.aggregate({ _avg: { score: true } }),
      prisma.watchlist.count({ where: { userId } }),
    ])
    return {
      totalProducts:  total,
      risingProducts: rising,
      watchlistCount,
      avgScore:       Math.round((avg._avg.score ?? 0) * 10) / 10,
    }
  })

  // ── GET /products — liste paginée ────────────────────────────────────────────
  app.get('/', async (req) => {
    const { sort = 'score', limit = '20', offset = '0', source, minScore } = req.query as any
    const where: any = {}
    if (source && source !== 'Tous') where.source = source
    if (minScore) where.score = { gte: parseInt(minScore) }
    const orderField = ['score', 'engagementScore', 'createdAt'].includes(sort) ? sort : 'score'
    return prisma.product.findMany({
      where,
      orderBy: { [orderField]: 'desc' },
      take:    Math.min(parseInt(limit), 100),
      skip:    parseInt(offset),
    })
  })

  // ── GET /products/:id ─────────────────────────────────────────────────────────
  app.get('/:id', async (req, reply) => {
    const { id } = req.params as any
    const product = await prisma.product.findUnique({
      where:   { id },
      include: {
        countries: true,
        scores:    { orderBy: { scoredAt: 'desc' }, take: 30 },
      },
    })
    if (!product) return reply.status(404).send({ error: 'Produit non trouvé' })
    return product
  })

  // ── GET /products/:id/countries ───────────────────────────────────────────────
  app.get('/:id/countries', async (req, reply) => {
    const { id } = req.params as any
    const countries = await prisma.productCountry.findMany({
      where:   { productId: id },
      orderBy: { score: 'desc' },
    })
    return countries
  })
}
