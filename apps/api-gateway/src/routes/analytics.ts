import type { FastifyPluginAsync } from 'fastify'
import { prisma } from '@trendforge/database'

export const analyticsRoutes: FastifyPluginAsync = async (app) => {
  app.addHook('preHandler', app.authenticate)
  app.get('/overview', async (req) => {
    const { period = '30' } = req.query as any
    const since = new Date(Date.now() - parseInt(period) * 86400000)
    const [products, avgScore, generations] = await Promise.all([
      prisma.product.count({ where: { createdAt: { gte: since } } }),
      prisma.product.aggregate({ _avg: { score: true } }),
      prisma.aiGeneration.count({ where: { createdAt: { gte: since } } }),
    ])
    return { productsDetected: products, avgScore: avgScore._avg.score ?? 0, aiGenerations: generations, countriesAnalyzed: 10 }
  })
  app.get('/sources', async () => {
    const sources = await prisma.product.groupBy({ by: ['source'], _count: { id: true } })
    return sources.map(s => ({ source: s.source, count: s._count.id }))
  })
}
