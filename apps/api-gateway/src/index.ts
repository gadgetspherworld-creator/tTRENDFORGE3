import Fastify        from 'fastify'
import cors           from '@fastify/cors'
import jwt            from '@fastify/jwt'
import rateLimit      from '@fastify/rate-limit'
import fp             from 'fastify-plugin'
import { logger }     from '@trendforge/logger'

const app = Fastify({ logger: false })

// ── authenticate decorator ────────────────────────────────────────────────────
app.register(fp(async (instance) => {
  instance.decorate('authenticate', async (req: any, reply: any) => {
    try {
      await req.jwtVerify()
    } catch {
      reply.status(401).send({ error: 'Non authentifié' })
    }
  })
}))

async function bootstrap() {
  await app.register(cors, {
    origin:      process.env.CORS_ORIGINS?.split(',') ?? ['http://localhost:3000'],
    credentials: true,
  })

  await app.register(jwt, {
    secret: process.env.JWT_SECRET ?? 'change-me-in-production-min-32-chars',
  })

  await app.register(rateLimit, { max: 200, timeWindow: '1 minute' })

  // Health check
  app.get('/health', async () => ({ status: 'ok', ts: new Date().toISOString() }))

  // Routes
  const { authRoutes }       = await import('./routes/auth.js')
  const { productRoutes }    = await import('./routes/products.js')
  const { alertRoutes }      = await import('./routes/alerts.js')
  const { billingRoutes }    = await import('./routes/billing.js')
  const { orgRoutes }        = await import('./routes/org.js')
  const { analyticsRoutes }  = await import('./routes/analytics.js')
  const { competitorRoutes } = await import('./routes/competitors.js')
  const { watchlistRoutes }  = await import('./routes/watchlist.js')

  await app.register(authRoutes,       { prefix: '/api/v1/auth'        })
  await app.register(productRoutes,    { prefix: '/api/v1/products'     })
  await app.register(alertRoutes,      { prefix: '/api/v1/alerts'       })
  await app.register(billingRoutes,    { prefix: '/api/v1/billing'      })
  await app.register(orgRoutes,        { prefix: '/api/v1/org'          })
  await app.register(analyticsRoutes,  { prefix: '/api/v1/analytics'    })
  await app.register(competitorRoutes, { prefix: '/api/v1/competitors'  })
  await app.register(watchlistRoutes,  { prefix: '/api/v1/watchlist'    })

  const port = parseInt(process.env.PORT ?? '3001')
  await app.listen({ port, host: '0.0.0.0' })
  logger.info(`API Gateway listening on port ${port}`)
}

bootstrap().catch(err => {
  logger.error(err)
  process.exit(1)
})
