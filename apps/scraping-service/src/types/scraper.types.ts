export interface ScrapedProduct {
  id:              string
  externalId:      string
  title:           string
  url?:            string
  imageUrl?:       string
  source:          string
  price?:          number
  engagementScore: number
  metadata:        Record<string, unknown>
}

export interface ScrapeResult<T> {
  success:   boolean
  count:     number
  data:      T[]
  errors:    string[]
  scrapedAt: Date
  source:    string
}
