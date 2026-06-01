import type { FastifyPluginAsync } from 'fastify'
import Stripe from 'stripe'
import { prisma } from '@trendforge/database'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? '', { apiVersion: '2024-04-10' })
const PLAN_PRICES: Record<string, string> = {
  STARTER: process.env.STRIPE_STARTER_PRICE_ID ?? '',
  PRO:     process.env.STRIPE_PRO_PRICE_ID ?? '',
  AGENCY:  process.env.STRIPE_AGENCY_PRICE_ID ?? '',
}

export const billingRoutes: FastifyPluginAsync = async (app) => {
  app.post('/checkout', { preHandler: [app.authenticate] }, async (req, reply) => {
    const { plan } = req.body as any
    const { orgId } = req.user as any
    const priceId = PLAN_PRICES[plan]
    if (!priceId) return reply.status(400).send({ error: 'Plan invalide' })
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription', payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${process.env.APP_URL}/settings/billing?success=1`,
      cancel_url:  `${process.env.APP_URL}/settings/billing`,
      metadata: { organizationId: orgId },
    })
    return { url: session.url }
  })
  app.get('/subscription', { preHandler: [app.authenticate] }, async (req) => {
    const { orgId } = req.user as any
    return prisma.subscription.findUnique({ where: { organizationId: orgId } })
  })
}
