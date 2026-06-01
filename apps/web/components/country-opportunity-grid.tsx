'use client'

import { useEffect, useState } from 'react'
import { api } from '../src/lib/api'

interface CountryScore {
  countryCode:     string
  score:           number
  estimatedMargin: number
  saturation:      number
  competition:     string
}

const FLAG: Record<string, string> = {
  FR:'🇫🇷', DE:'🇩🇪', GB:'🇬🇧', US:'🇺🇸',
  ES:'🇪🇸', IT:'🇮🇹', NL:'🇳🇱', BE:'🇧🇪', PL:'🇵🇱', SE:'🇸🇪',
}

export function CountryOpportunityGrid({ productId }: { productId: string }) {
  const [countries, setCountries] = useState<CountryScore[]>([])
  const [loading,   setLoading]   = useState(true)

  useEffect(() => {
    api.get<CountryScore[]>(`products/${productId}/countries`)
      .then(setCountries)
      .finally(() => setLoading(false))
  }, [productId])

  if (loading) return (
    <div className="grid grid-cols-5 gap-3 animate-pulse">
      {[...Array(10)].map((_, i) => <div key={i} className="h-20 rounded-lg bg-white/5" />)}
    </div>
  )

  return (
    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
      {countries.sort((a, b) => b.score - a.score).map(c => (
        <div key={c.countryCode}
             className="bg-white/5 border border-white/10 rounded-lg p-3 text-center hover:border-violet-500/30 transition-colors">
          <div className="text-2xl mb-1">{FLAG[c.countryCode] ?? '🌍'}</div>
          <div className="text-white text-xs font-semibold">{c.countryCode}</div>
          <div className={`text-lg font-bold tabular-nums mt-1
            ${c.score >= 70 ? 'text-emerald-400' : c.score >= 45 ? 'text-amber-400' : 'text-red-400'}`}>
            {c.score}
          </div>
          <div className="text-white/30 text-[10px] mt-1">
            {Math.round((c.estimatedMargin ?? 0) * 100)}% marge
          </div>
        </div>
      ))}
    </div>
  )
}
