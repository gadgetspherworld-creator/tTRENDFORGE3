import type { FastifyPluginAsync } from 'fastify'
import { prisma } from '@trendforge/database'

export const watchlistRoutes: FastifyPluginAsync = async (app) => {
  app.addHook('preHandler', app.authenticate)

  // GET /api/v1/watchlist — liste des items
  app.get('/', async (req) => {
    const { userId } = req.user as any
    return prisma.watchlist.findMany({
      where:   { userId },
      include: { product: true },
      orderBy: { createdAt: 'desc' },
    })
  })

  // POST /api/v1/watchlist — ajouter un produit
  app.post('/', async (req, reply) => {
    const { userId } = req.user as any
    const { productId } = req.body as any
    if (!productId) return reply.status(400).send({ error: 'productId requis' })
    return prisma.watchlist.upsert({
      where:  { userId_productId: { userId, productId } },
      update: {},
      create: { userId, productId },
      include: { product: true },
    })
  })

  // DELETE /api/v1/watchlist/:productId — retirer un produit
  app.delete('/:productId', async (req, reply) => {
    const { userId }    = req.user as any
    const { productId } = req.params as any
    await prisma.watchlist.delete({
      where: { userId_productId: { userId, productId } },
    }).catch(() => null) // ignore si déjà supprimé
    return { success: true }
  })
}
