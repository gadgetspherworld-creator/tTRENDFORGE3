import type { FastifyPluginAsync } from 'fastify'
import { prisma } from '@trendforge/database'

export const orgRoutes: FastifyPluginAsync = async (app) => {
  app.addHook('preHandler', app.authenticate)
  app.get('/', async (req) => {
    const { orgId } = req.user as any
    return prisma.organization.findUnique({ where: { id: orgId } })
  })
  app.get('/members', async (req) => {
    const { orgId } = req.user as any
    return prisma.user.findMany({ where: { organizationId: orgId }, select: { id: true, email: true, name: true, role: true, createdAt: true } })
  })
}
