interface TemplateData {
  email:   string
  orgName: string
  [key: string]: string
}

interface EmailTemplate {
  subject: string
  html:    string
}

function layout(content: string): string {
  return `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>TrendForge</title>
</head>
<body style="margin:0;padding:0;background:#0f0f0f;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f0f0f;padding:40px 20px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#1a1a1a;border-radius:16px;border:1px solid #2a2a2a;overflow:hidden;">
        <tr>
          <td style="background:linear-gradient(135deg,#7c3aed,#4f46e5);padding:32px 40px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td><span style="font-size:24px;font-weight:700;color:#fff;letter-spacing:-0.5px;">⚡ TrendForge</span></td>
                <td align="right"><span style="font-size:12px;color:rgba(255,255,255,0.7);">Votre radar ecommerce</span></td>
              </tr>
            </table>
          </td>
        </tr>
        <tr><td style="padding:40px;">${content}</td></tr>
        <tr>
          <td style="padding:24px 40px;border-top:1px solid #2a2a2a;">
            <p style="margin:0;font-size:12px;color:#555;text-align:center;">
              TrendForge · Vous recevez cet email car vous êtes inscrit sur
              <a href="https://trendforge.io" style="color:#7c3aed;text-decoration:none;">trendforge.io</a><br/>
              <a href="https://trendforge.io/settings/notifications" style="color:#555;">Gérer mes préférences de notification</a>
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`.trim()
}

function btn(text: string, url: string): string {
  return `
    <table cellpadding="0" cellspacing="0" style="margin:24px 0;">
      <tr>
        <td style="background:linear-gradient(135deg,#7c3aed,#4f46e5);border-radius:8px;">
          <a href="${url}" style="display:inline-block;padding:14px 28px;color:#fff;font-weight:600;font-size:15px;text-decoration:none;letter-spacing:-0.2px;">${text}</a>
        </td>
      </tr>
    </table>`
}

function h1(text: string): string {
  return `<h1 style="margin:0 0 16px;font-size:26px;font-weight:700;color:#fff;letter-spacing:-0.5px;">${text}</h1>`
}

function p(text: string): string {
  return `<p style="margin:0 0 16px;font-size:15px;color:#aaa;line-height:1.6;">${text}</p>`
}

const templates: Record<string, (d: TemplateData) => EmailTemplate> = {

  email_sequence_welcome: (d) => ({
    subject: '🚀 Bienvenue sur TrendForge, votre radar produit est prêt',
    html: layout(`
      ${h1('Bienvenue sur TrendForge, ' + (d.orgName || 'explorer') + ' !')}
      ${p('Votre espace est configuré et prêt. TrendForge scanne en ce moment Reddit, Pinterest, TikTok Shop et Amazon pour repérer les produits qui montent avant tout le monde.')}
      ${p('Voici par où commencer :')}
      <table width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0;">
        ${['🔍 Explorer les produits tendance du jour', '🌍 Analyser les opportunités par pays', '🔔 Créer vos premières alertes de score'].map(step => `
          <tr><td style="padding:10px 0;border-bottom:1px solid #2a2a2a;"><span style="color:#fff;font-size:14px;">${step}</span></td></tr>
        `).join('')}
      </table>
      ${btn('Accéder à mon dashboard', 'https://trendforge.io/dashboard')}
      ${p('Si vous avez la moindre question, répondez directement à cet email.')}
    `),
  }),

  email_sequence_day1_scoring: (d) => ({
    subject: '📊 Comment TrendForge calcule le score de vos produits',
    html: layout(`
      ${h1('Le score TrendForge, comment ça marche ?')}
      ${p('Chaque produit reçoit un score de 0 à 100 calculé en temps réel à partir de 4 dimensions :')}
      <table width="100%" cellpadding="12" cellspacing="0" style="border-radius:12px;border:1px solid #2a2a2a;margin:20px 0;border-collapse:collapse;">
        <tr style="border-bottom:1px solid #2a2a2a;">
          <td style="color:#7c3aed;font-size:18px;width:40px;">📈</td>
          <td><strong style="color:#fff;font-size:14px;">Engagement (25%)</strong><p style="margin:4px 0 0;font-size:13px;color:#888;">Upvotes, saves, partages cross-plateformes</p></td>
        </tr>
        <tr style="border-bottom:1px solid #2a2a2a;">
          <td style="color:#10b981;font-size:18px;">🌍</td>
          <td><strong style="color:#fff;font-size:14px;">Opportunité géographique (30%)</strong><p style="margin:4px 0 0;font-size:13px;color:#888;">Concurrence locale, marge estimée, maturité ecom</p></td>
        </tr>
        <tr style="border-bottom:1px solid #2a2a2a;">
          <td style="color:#f59e0b;font-size:18px;">💰</td>
          <td><strong style="color:#fff;font-size:14px;">Marge estimée (25%)</strong><p style="margin:4px 0 0;font-size:13px;color:#888;">Prix, CPA moyen, coût logistique</p></td>
        </tr>
        <tr>
          <td style="color:#ec4899;font-size:18px;">🚚</td>
          <td><strong style="color:#fff;font-size:14px;">Logistique (20%)</strong><p style="margin:4px 0 0;font-size:13px;color:#888;">Score logistique du pays cible</p></td>
        </tr>
      </table>
      ${p('Un produit avec un score > 70 est considéré comme une opportunité sérieuse. Activez une alerte pour être notifié dès qu\'un produit passe ce seuil.')}
      ${btn('Voir les produits > 70 maintenant', 'https://trendforge.io/products?score=70')}
    `),
  }),

  email_sequence_score_spike: (d) => ({
    subject: `🔥 Score en hausse : ${d.productTitle || 'un produit de votre watchlist'} décolle`,
    html: layout(`
      ${h1('🔥 Alerte score — ' + (d.productTitle || 'Produit'))}
      ${p(`Le score de <strong style="color:#fff;">${d.productTitle || 'ce produit'}</strong> vient de passer de <strong style="color:#aaa;">${d.scoreBefore || '—'}</strong> à <strong style="color:#7c3aed;font-size:18px;">${d.scoreAfter || '—'}</strong>.`)}
      <table width="100%" cellpadding="16" cellspacing="0" style="background:#0f0f0f;border-radius:12px;border:1px solid #2a2a2a;margin:20px 0;">
        <tr>
          <td align="center">
            <div style="font-size:48px;font-weight:800;color:#7c3aed;letter-spacing:-2px;">${d.scoreAfter || '—'}</div>
            <div style="font-size:13px;color:#666;margin-top:4px;">Score actuel / 100</div>
          </td>
          <td align="center">
            <div style="font-size:20px;color:#10b981;font-weight:700;">+${d.scoreDelta || '—'} pts</div>
            <div style="font-size:13px;color:#666;margin-top:4px;">Variation 24h</div>
          </td>
          <td align="center">
            <div style="font-size:20px;color:#fff;font-weight:600;">${d.topCountry || '—'}</div>
            <div style="font-size:13px;color:#666;margin-top:4px;">Meilleur marché</div>
          </td>
        </tr>
      </table>
      ${p('Agissez vite — les produits qui décollent vite saturent rapidement les marchés les plus accessibles.')}
      ${btn('Analyser ce produit', `https://trendforge.io/products/${d.productId || ''}`)}
    `),
  }),

  email_sequence_weekly_digest: (d) => ({
    subject: '📬 Votre récap TrendForge de la semaine',
    html: layout(`
      ${h1('Récapitulatif de la semaine')}
      ${p(`Semaine du <strong style="color:#fff;">${d.weekRange || 'cette semaine'}</strong> — voici ce qui s'est passé sur votre radar.`)}
      <table width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0;">
        <tr>
          <td width="33%" align="center" style="padding:16px;background:#0f0f0f;border-radius:12px;border:1px solid #2a2a2a;">
            <div style="font-size:32px;font-weight:800;color:#7c3aed;">${d.newProductsCount || '0'}</div>
            <div style="font-size:12px;color:#666;margin-top:4px;">Nouveaux produits détectés</div>
          </td>
          <td width="4%"></td>
          <td width="33%" align="center" style="padding:16px;background:#0f0f0f;border-radius:12px;border:1px solid #2a2a2a;">
            <div style="font-size:32px;font-weight:800;color:#10b981;">${d.risingCount || '0'}</div>
            <div style="font-size:12px;color:#666;margin-top:4px;">Produits en hausse</div>
          </td>
          <td width="4%"></td>
          <td width="26%" align="center" style="padding:16px;background:#0f0f0f;border-radius:12px;border:1px solid #2a2a2a;">
            <div style="font-size:32px;font-weight:800;color:#f59e0b;">${d.watchlistCount || '0'}</div>
            <div style="font-size:12px;color:#666;margin-top:4px;">Dans votre watchlist</div>
          </td>
        </tr>
      </table>
      ${p('Consultez votre dashboard pour voir le détail complet et les opportunités géographiques de la semaine.')}
      ${btn('Voir le récap complet', 'https://trendforge.io/dashboard')}
    `),
  }),
}

export function getSequenceTemplate(type: string, data: TemplateData): EmailTemplate {
  const tpl = templates[type]
  if (!tpl) return { subject: `TrendForge — ${type}`, html: layout(`${h1('Notification TrendForge')}${p(JSON.stringify(data))}`) }
  return tpl(data)
}

export type { EmailTemplate, TemplateData }
