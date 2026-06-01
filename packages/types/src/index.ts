export enum ProductSource {
  TIKTOK_SHOP  = 'TIKTOK_SHOP',
  AMAZON       = 'AMAZON',
  ALIEXPRESS   = 'ALIEXPRESS',
  TEMU         = 'TEMU',
  ETSY         = 'ETSY',
  FACEBOOK_ADS = 'FACEBOOK_ADS',
  REDDIT       = 'REDDIT',
  PINTEREST    = 'PINTEREST',
  GOOGLE_TRENDS = 'GOOGLE_TRENDS',
  SHOPIFY_SPY  = 'SHOPIFY_SPY',
}

export interface ScrapedProduct {
  id:              string
  externalId:      string
  title:           string
  description?:    string
  url?:            string
  imageUrl?:       string
  source:          ProductSource
  price?:          number
  currency?:       string
  score:           number
  engagementScore: number
  tags:            string[]
  categories:      string[]
  metadata:        Record<string, unknown>
  createdAt:       Date
  updatedAt:       Date
}

export interface ScrapeResult<T> {
  success:   boolean
  count:     number
  data:      T[]
  errors:    string[]
  scrapedAt: Date
  source:    ProductSource
}

export type SubscriptionPlan   = 'FREE' | 'STARTER' | 'PRO' | 'AGENCY'
export type SubscriptionStatus = 'ACTIVE' | 'TRIALING' | 'PAST_DUE' | 'CANCELED' | 'INCOMPLETE'
export type AlertType = 'score_spike' | 'score_drop' | 'new_product' | 'saturation' | 'system'
export type UserRole  = 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER'
