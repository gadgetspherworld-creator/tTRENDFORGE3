import type { FastifyPluginAsync } from 'fastify'
import bcrypt from 'bcrypt'
import { prisma } from '@trendforge/database'

export const authRoutes: FastifyPluginAsync = async (app) => {
  app.post('/register', async (req, reply) => {
    const { email, password, name, orgName } = req.body as any
    if (!email || !password || !orgName) return reply.status(400).send({ error: 'Champs manquants' })
    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) return reply.status(409).send({ error: 'Email déjà utilisé' })
    const slug = orgName.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + Date.now()
    const org = await prisma.organization.create({ data: { name: orgName, slug } })
    const passwordHash = await bcrypt.hash(password, 12)
    const user = await prisma.user.create({ data: { email, name, passwordHash, organizationId: org.id, role: 'OWNER' } })
    const token = app.jwt.sign({ userId: user.id, orgId: org.id, role: user.role }, { expiresIn: '7d' })
    return { token, user: { id: user.id, email: user.email, name: user.name, role: user.role } }
  })

  app.post('/login', async (req, reply) => {
    const { email, password } = req.body as any
    const user = await prisma.user.findUnique({ where: { email } })
    if (!user) return reply.status(401).send({ error: 'Identifiants invalides' })
    const valid = await bcrypt.compare(password, user.passwordHash)
    if (!valid) return reply.status(401).send({ error: 'Identifiants invalides' })
    const token = app.jwt.sign({ userId: user.id, orgId: user.organizationId, role: user.role }, { expiresIn: '7d' })
    return { token, user: { id: user.id, email: user.email, name: user.name, role: user.role } }
  })

  app.get('/me', { preHandler: [app.authenticate] }, async (req) => {
    const { userId } = req.user as any
    return prisma.user.findUnique({ where: { id: userId }, select: { id: true, email: true, name: true, role: true, organizationId: true } })
  })
}
