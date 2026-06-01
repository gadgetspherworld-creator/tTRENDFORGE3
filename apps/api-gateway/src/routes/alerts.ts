import type { FastifyPluginAsync } from 'fastify'
import { prisma } from '@trendforge/database'

export const alertRoutes: FastifyPluginAsync = async (app) => {
  app.addHook('preHandler', app.authenticate)
  app.get('/', async (req) => {
    const { userId } = req.user as any
    const { unread } = req.query as any
    const where: any = { userId }
    if (unread === 'true') where.read = false
    return prisma.alert.findMany({ where, orderBy: { createdAt: 'desc' }, take: 50 })
  })
  app.patch('/:id/read', async (req) => {
    const { id } = req.params as any
    return prisma.alert.update({ where: { id }, data: { read: true } })
  })
  app.post('/read-all', async (req) => {
    const { userId } = req.user as any
    await prisma.alert.updateMany({ where: { userId, read: false }, data: { read: true } })
    return { success: true }
  })
}
