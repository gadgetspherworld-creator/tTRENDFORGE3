import { startNotificationsWorker } from './index.js'
import { logger } from '@trendforge/logger'

logger.info('[Notifications Worker] Starting...')
startNotificationsWorker()
