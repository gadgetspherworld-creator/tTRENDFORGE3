import Fastify    from 'fastify'
import { logger } from '@trendforge/logger'

const app = Fastify({ logger: false })

app.get('/health', async () => ({ status: 'ok' }))

app.listen({ port: parseInt(process.env.PORT ?? '3004'), host: '0.0.0.0' }, () => {
  logger.info('Scraping service running on port 3004')
})
