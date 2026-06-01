import { Worker, Queue, Job } from 'bullmq';
import { Resend } from 'resend';
import { prisma } from '@trendforge/database';
import { logger } from '@trendforge/logger';

const redis = {
  host: process.env.REDIS_HOST ?? 'localhost',
  port: parseInt(process.env.REDIS_PORT ?? '6379'),
  password: process.env.REDIS_PASSWORD,
};

const resend = new Resend(process.env.RESEND_API_KEY!);
const FROM_EMAIL = process.env.FROM_EMAIL ?? 'TrendForge <alerts@trendforge.io>';

export type NotificationJobData =
  | { type: 'score_spike'; userId: string; productId: string; oldScore: number; newScore: number }
  | { type: 'score_drop'; userId: string; productId: string; oldScore: number; newScore: number }
  | { type: 'new_product'; userId: string; productId: string }
  | { type: 'saturation'; userId: string; productId: string; saturationLevel: number }
  | { type: 'weekly_digest'; userId: string }
  | { type: 'welcome'; userId: string }
  | { type: 'billing'; userId: string; event: 'trial_ending' | 'payment_failed' | 'subscription_renewed'; daysLeft?: number };

export const notificationQueue = new Queue<NotificationJobData>('notifications', {
  connection: redis,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: 100,
    removeOnFail: 200,
  },
});

// ─── Email Templates ──────────────────────────────────────────────────────────

function templateScoreSpike(productName: string, oldScore: number, newScore: number, productUrl: string): string {
  const delta = newScore - oldScore;
  return `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8" /></head>
<body style="font-family:Inter,sans-serif;background:#0f0f0f;color:#e5e5e5;margin:0;padding:32px;">
  <div style="max-width:600px;margin:0 auto;background:#1a1a1a;border-radius:12px;overflow:hidden;border:1px solid #2a2a2a;">
    <div style="background:linear-gradient(135deg,#6366f1,#8b5cf6);padding:24px 32px;">
      <h1 style="margin:0;color:#fff;font-size:22px;">🚀 Score en hausse détecté</h1>
    </div>
    <div style="padding:32px;">
      <p style="color:#a3a3a3;margin:0 0 8px 0;font-size:14px;">PRODUIT SURVEILLÉ</p>
      <h2 style="margin:0 0 24px 0;color:#f5f5f5;font-size:20px;">${productName}</h2>
      <div style="display:flex;gap:16px;margin-bottom:24px;">
        <div style="flex:1;background:#262626;border-radius:8px;padding:16px;text-align:center;">
          <div style="color:#a3a3a3;font-size:12px;margin-bottom:4px;">Avant</div>
          <div style="font-size:28px;font-weight:700;color:#f5f5f5;">${oldScore}</div>
        </div>
        <div style="flex:1;background:#16a34a22;border:1px solid #16a34a44;border-radius:8px;padding:16px;text-align:center;">
          <div style="color:#a3a3a3;font-size:12px;margin-bottom:4px;">Maintenant</div>
          <div style="font-size:28px;font-weight:700;color:#4ade80;">${newScore}</div>
        </div>
        <div style="flex:1;background:#262626;border-radius:8px;padding:16px;text-align:center;">
          <div style="color:#a3a3a3;font-size:12px;margin-bottom:4px;">Variation</div>
          <div style="font-size:28px;font-weight:700;color:#4ade80;">+${delta}</div>
        </div>
      </div>
      <a href="${productUrl}" style="display:inline-block;background:#6366f1;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;font-size:15px;">
        Voir le produit →
      </a>
    </div>
    <div style="padding:16px 32px;border-top:1px solid #2a2a2a;">
      <p style="margin:0;color:#525252;font-size:12px;">
        TrendForge · <a href="{{unsubscribeUrl}}" style="color:#525252;">Se désabonner</a>
      </p>
    </div>
  </div>
</body>
</html>`;
}

function templateScoreDrop(productName: string, oldScore: number, newScore: number, productUrl: string): string {
  const delta = oldScore - newScore;
  return `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8" /></head>
<body style="font-family:Inter,sans-serif;background:#0f0f0f;color:#e5e5e5;margin:0;padding:32px;">
  <div style="max-width:600px;margin:0 auto;background:#1a1a1a;border-radius:12px;overflow:hidden;border:1px solid #2a2a2a;">
    <div style="background:linear-gradient(135deg,#ef4444,#dc2626);padding:24px 32px;">
      <h1 style="margin:0;color:#fff;font-size:22px;">⚠️ Baisse de score détectée</h1>
    </div>
    <div style="padding:32px;">
      <p style="color:#a3a3a3;margin:0 0 8px 0;font-size:14px;">PRODUIT SURVEILLÉ</p>
      <h2 style="margin:0 0 24px 0;color:#f5f5f5;font-size:20px;">${productName}</h2>
      <div style="display:flex;gap:16px;margin-bottom:24px;">
        <div style="flex:1;background:#262626;border-radius:8px;padding:16px;text-align:center;">
          <div style="color:#a3a3a3;font-size:12px;margin-bottom:4px;">Avant</div>
          <div style="font-size:28px;font-weight:700;color:#f5f5f5;">${oldScore}</div>
        </div>
        <div style="flex:1;background:#ef444422;border:1px solid #ef444444;border-radius:8px;padding:16px;text-align:center;">
          <div style="color:#a3a3a3;font-size:12px;margin-bottom:4px;">Maintenant</div>
          <div style="font-size:28px;font-weight:700;color:#f87171;">${newScore}</div>
        </div>
        <div style="flex:1;background:#262626;border-radius:8px;padding:16px;text-align:center;">
          <div style="color:#a3a3a3;font-size:12px;margin-bottom:4px;">Variation</div>
          <div style="font-size:28px;font-weight:700;color:#f87171;">-${delta}</div>
        </div>
      </div>
      <a href="${productUrl}" style="display:inline-block;background:#ef4444;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;font-size:15px;">
        Voir le produit →
      </a>
    </div>
    <div style="padding:16px 32px;border-top:1px solid #2a2a2a;">
      <p style="margin:0;color:#525252;font-size:12px;">TrendForge · <a href="{{unsubscribeUrl}}" style="color:#525252;">Se désabonner</a></p>
    </div>
  </div>
</body>
</html>`;
}

function templateNewProduct(productName: string, score: number, source: string, productUrl: string): string {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8" /></head>
<body style="font-family:Inter,sans-serif;background:#0f0f0f;color:#e5e5e5;margin:0;padding:32px;">
  <div style="max-width:600px;margin:0 auto;background:#1a1a1a;border-radius:12px;overflow:hidden;border:1px solid #2a2a2a;">
    <div style="background:linear-gradient(135deg,#0ea5e9,#6366f1);padding:24px 32px;">
      <h1 style="margin:0;color:#fff;font-size:22px;">✨ Nouveau produit tendance</h1>
    </div>
    <div style="padding:32px;">
      <h2 style="margin:0 0 16px 0;color:#f5f5f5;font-size:20px;">${productName}</h2>
      <div style="margin-bottom:24px;">
        <span style="background:#6366f122;border:1px solid #6366f144;color:#818cf8;padding:4px 12px;border-radius:20px;font-size:13px;margin-right:8px;">Score: ${score}/100</span>
        <span style="background:#0ea5e922;border:1px solid #0ea5e944;color:#38bdf8;padding:4px 12px;border-radius:20px;font-size:13px;">${source}</span>
      </div>
      <a href="${productUrl}" style="display:inline-block;background:#6366f1;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;font-size:15px;">
        Analyser ce produit →
      </a>
    </div>
    <div style="padding:16px 32px;border-top:1px solid #2a2a2a;">
      <p style="margin:0;color:#525252;font-size:12px;">TrendForge · <a href="{{unsubscribeUrl}}" style="color:#525252;">Se désabonner</a></p>
    </div>
  </div>
</body>
</html>`;
}

function templateWelcome(userName: string): string {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8" /></head>
<body style="font-family:Inter,sans-serif;background:#0f0f0f;color:#e5e5e5;margin:0;padding:32px;">
  <div style="max-width:600px;margin:0 auto;background:#1a1a1a;border-radius:12px;overflow:hidden;border:1px solid #2a2a2a;">
    <div style="background:linear-gradient(135deg,#6366f1,#8b5cf6,#ec4899);padding:32px;">
      <h1 style="margin:0;color:#fff;font-size:28px;">Bienvenue sur TrendForge 🔥</h1>
    </div>
    <div style="padding:32px;">
      <p style="color:#d4d4d4;font-size:16px;margin:0 0 24px 0;">Bonjour ${userName},</p>
      <p style="color:#a3a3a3;font-size:15px;line-height:1.6;margin:0 0 24px 0;">
        Votre compte est prêt. Vous avez maintenant accès à l'intelligence produit la plus avancée pour le dropshipping.
      </p>
      <div style="display:grid;gap:12px;margin-bottom:28px;">
        ${['Détectez les produits tendance avant tout le monde', 'Analysez 10 sources en simultané', 'Générez vos publicités avec l\'IA', 'Comparez les opportunités par pays'].map(f => `
        <div style="display:flex;align-items:center;gap:12px;background:#262626;padding:12px 16px;border-radius:8px;">
          <span style="color:#4ade80;font-size:18px;">✓</span>
          <span style="color:#d4d4d4;font-size:14px;">${f}</span>
        </div>`).join('')}
      </div>
      <a href="${process.env.APP_URL ?? 'https://app.trendforge.io'}/dashboard" style="display:inline-block;background:#6366f1;color:#fff;text-decoration:none;padding:14px 28px;border-radius:8px;font-weight:600;font-size:16px;">
        Accéder au dashboard →
      </a>
    </div>
    <div style="padding:16px 32px;border-top:1px solid #2a2a2a;">
      <p style="margin:0;color:#525252;font-size:12px;">TrendForge · Des questions ? <a href="mailto:support@trendforge.io" style="color:#6366f1;">support@trendforge.io</a></p>
    </div>
  </div>
</body>
</html>`;
}

function templateBilling(event: string, daysLeft?: number): string {
  const configs: Record<string, { title: string; color: string; message: string }> = {
    trial_ending: {
      title: '⏳ Votre essai se termine bientôt',
      color: '#f59e0b',
      message: `Il vous reste <strong>${daysLeft} jours</strong> d'essai gratuit. Passez à un plan payant pour continuer à accéder à TrendForge.`,
    },
    payment_failed: {
      title: '❌ Échec du paiement',
      color: '#ef4444',
      message: 'Votre dernier paiement a échoué. Mettez à jour votre moyen de paiement pour éviter l\'interruption de service.',
    },
    subscription_renewed: {
      title: '✅ Abonnement renouvelé',
      color: '#16a34a',
      message: 'Votre abonnement TrendForge a été renouvelé avec succès. Merci de votre confiance !',
    },
  };

  const cfg = configs[event] ?? configs.payment_failed;

  return `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8" /></head>
<body style="font-family:Inter,sans-serif;background:#0f0f0f;color:#e5e5e5;margin:0;padding:32px;">
  <div style="max-width:600px;margin:0 auto;background:#1a1a1a;border-radius:12px;overflow:hidden;border:1px solid #2a2a2a;">
    <div style="background:${cfg.color};padding:24px 32px;">
      <h1 style="margin:0;color:#fff;font-size:22px;">${cfg.title}</h1>
    </div>
    <div style="padding:32px;">
      <p style="color:#d4d4d4;font-size:15px;line-height:1.6;margin:0 0 24px 0;">${cfg.message}</p>
      <a href="${process.env.APP_URL ?? 'https://app.trendforge.io'}/settings/billing" style="display:inline-block;background:#6366f1;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;font-size:15px;">
        Gérer la facturation →
      </a>
    </div>
    <div style="padding:16px 32px;border-top:1px solid #2a2a2a;">
      <p style="margin:0;color:#525252;font-size:12px;">TrendForge · <a href="mailto:support@trendforge.io" style="color:#6366f1;">support@trendforge.io</a></p>
    </div>
  </div>
</body>
</html>`;
}

// ─── Job Processor ────────────────────────────────────────────────────────────

async function processNotification(job: Job<NotificationJobData>): Promise<void> {
  const data = job.data;
  logger.info(`[NotificationsWorker] Processing ${data.type} for user ${data.userId}`);

  const user = await prisma.user.findUnique({
    where: { id: data.userId },
    select: { id: true, email: true, name: true, notificationPreferences: true },
  });

  if (!user) {
    logger.warn(`User ${data.userId} not found, skipping notification`);
    return;
  }

  const prefs = (user.notificationPreferences as any) ?? {};

  let subject = '';
  let html = '';

  switch (data.type) {
    case 'score_spike': {
      if (prefs.emailScoreAlerts === false) return;
      const product = await prisma.product.findUnique({ where: { id: data.productId } });
      if (!product) return;
      const productUrl = `${process.env.APP_URL}/products/${product.id}`;
      subject = `🚀 ${product.title} : score en hausse (+${data.newScore - data.oldScore})`;
      html = templateScoreSpike(product.title, data.oldScore, data.newScore, productUrl);
      break;
    }

    case 'score_drop': {
      if (prefs.emailScoreAlerts === false) return;
      const product = await prisma.product.findUnique({ where: { id: data.productId } });
      if (!product) return;
      const productUrl = `${process.env.APP_URL}/products/${product.id}`;
      subject = `⚠️ ${product.title} : baisse de score (-${data.oldScore - data.newScore})`;
      html = templateScoreDrop(product.title, data.oldScore, data.newScore, productUrl);
      break;
    }

    case 'new_product': {
      if (prefs.emailNewProducts === false) return;
      const product = await prisma.product.findUnique({ where: { id: data.productId } });
      if (!product) return;
      const productUrl = `${process.env.APP_URL}/products/${product.id}`;
      subject = `✨ Nouveau produit tendance : ${product.title}`;
      html = templateNewProduct(product.title, product.score ?? 0, product.source, productUrl);
      break;
    }

    case 'welcome': {
      subject = `Bienvenue sur TrendForge, ${user.name?.split(' ')[0] ?? 'chez vous'} 🔥`;
      html = templateWelcome(user.name ?? 'là');
      break;
    }

    case 'billing': {
      if (prefs.emailBilling === false) return;
      subject = data.event === 'trial_ending'
        ? `⏳ Plus que ${data.daysLeft} jours d'essai`
        : data.event === 'payment_failed'
          ? '❌ Échec du paiement TrendForge'
          : '✅ Abonnement TrendForge renouvelé';
      html = templateBilling(data.event, data.daysLeft);
      break;
    }

    default:
      logger.warn(`[NotificationsWorker] Unknown notification type: ${(data as any).type}`);
      return;
  }

  // Send email via Resend
  const { error } = await resend.emails.send({
    from: FROM_EMAIL,
    to: user.email,
    subject,
    html,
  });

  if (error) {
    throw new Error(`Resend error: ${JSON.stringify(error)}`);
  }

  // Mark in-app notification as sent
  await prisma.notification.create({
    data: {
      userId: data.userId,
      type: data.type,
      title: subject,
      read: false,
      metadata: data as any,
    },
  }).catch(() => { /* table may not exist yet, non-blocking */ });

  logger.info(`[NotificationsWorker] Email sent to ${user.email} (${data.type})`);
}

// ─── Worker Bootstrap ─────────────────────────────────────────────────────────

export function startNotificationsWorker(): Worker {
  const worker = new Worker<NotificationJobData>(
    'notifications',
    processNotification,
    {
      connection: redis,
      concurrency: 5,
    }
  );

  worker.on('completed', (job) => {
    logger.info(`[NotificationsWorker] Job ${job.id} completed (${job.data.type})`);
  });

  worker.on('failed', (job, err) => {
    logger.error(`[NotificationsWorker] Job ${job?.id} failed:`, err);
  });

  worker.on('error', (err) => {
    logger.error('[NotificationsWorker] Worker error:', err);
  });

  logger.info('[NotificationsWorker] Started and listening for jobs');
  return worker;
}

// ─── Helper: enqueue notifications ───────────────────────────────────────────

export async function notifyScoreSpike(userId: string, productId: string, oldScore: number, newScore: number) {
  await notificationQueue.add('score_spike', { type: 'score_spike', userId, productId, oldScore, newScore });
}

export async function notifyScoreDrop(userId: string, productId: string, oldScore: number, newScore: number) {
  await notificationQueue.add('score_drop', { type: 'score_drop', userId, productId, oldScore, newScore });
}

export async function notifyNewProduct(userId: string, productId: string) {
  await notificationQueue.add('new_product', { type: 'new_product', userId, productId });
}

export async function notifyWelcome(userId: string) {
  await notificationQueue.add('welcome', { type: 'welcome', userId }, { delay: 5000 });
}

export async function notifyBilling(userId: string, event: 'trial_ending' | 'payment_failed' | 'subscription_renewed', daysLeft?: number) {
  await notificationQueue.add('billing', { type: 'billing', userId, event, daysLeft });
}
