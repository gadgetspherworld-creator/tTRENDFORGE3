import type { FastifyPluginAsync } from 'fastify'
import { prisma } from '@trendforge/database'

export const competitorRoutes: FastifyPluginAsync = async (app) => {
  app.addHook('preHandler', app.authenticate)
  app.get('/', async (req) => {
    const { orgId } = req.user as any
    return prisma.competitor.findMany({ where: { organizationId: orgId }, orderBy: { trendScore: 'desc' } })
  })
  app.post('/', async (req) => {
    const { orgId } = req.user as any
    const { url } = req.body as any
    return prisma.competitor.create({ data: { organizationId: orgId, url, trendScore: 0 } })
  })
  app.delete('/:id', async (req) => {
    const { id } = req.params as any
    await prisma.competitor.delete({ where: { id } })
    return { success: true }
  })
}
