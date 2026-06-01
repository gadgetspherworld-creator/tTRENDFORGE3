'use client'

import { useEffect, useState, useCallback } from 'react'
import { ProductCard }                       from '../../../components/ui/product-card'
import { CountryOpportunityGrid }            from '../../../components/country-opportunity-grid'
import { api }                               from '../../../src/lib/api'

const SOURCES  = ['Tous', 'REDDIT', 'PINTEREST', 'AMAZON', 'ALIEXPRESS', 'TEMU']
const SORT_OPT = [
  { value: 'score',           label: 'Meilleur score' },
  { value: 'engagementScore', label: 'Engagement'     },
  { value: 'createdAt',       label: 'Plus récent'    },
]

export default function ProductsPage() {
  const [products,  setProducts]  = useState<any[]>([])
  const [loading,   setLoading]   = useState(true)
  const [source,    setSource]    = useState('Tous')
  const [sort,      setSort]      = useState('score')
  const [minScore,  setMinScore]  = useState(0)
  const [selected,  setSelected]  = useState<string | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    const params = new URLSearchParams({ sort, limit: '24' })
    if (source !== 'Tous')  params.set('source',   source)
    if (minScore > 0)       params.set('minScore', String(minScore))

    api.get<any[]>(`products?${params}`)
      .then(setProducts)
      .finally(() => setLoading(false))
  }, [source, sort, minScore])

  useEffect(() => { load() }, [load])

  async function handleWatch(id: string) {
    await api.post('watchlist', { productId: id })
  }

  return (
    <div className="max-w-7xl space-y-6">

      {/* Header + Filtres */}
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold text-white mr-auto">Produits</h1>

        {/* Source filter */}
        <div className="flex gap-1">
          {SOURCES.map(s => (
            <button
              key={s}
              onClick={() => setSource(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors
                ${source === s
                  ? 'bg-violet-600 text-white'
                  : 'bg-white/5 text-white/40 hover:text-white hover:bg-white/10'
                }`}
            >
              {s}
            </button>
          ))}
        </div>

        {/* Sort */}
        <select
          value={sort} onChange={e => setSort(e.target.value)}
          className="bg-white/5 border border-white/10 text-white/60 text-xs rounded-lg px-3 py-1.5
                     focus:outline-none focus:border-violet-500/50"
        >
          {SORT_OPT.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>

        {/* Score min */}
        <div className="flex items-center gap-2 text-xs text-white/40">
          <span>Score min</span>
          <input
            type="range" min={0} max={90} step={10} value={minScore}
            onChange={e => setMinScore(Number(e.target.value))}
            className="accent-violet-500 w-24"
          />
          <span className="text-white font-medium w-6">{minScore}</span>
        </div>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 animate-pulse">
          {[...Array(12)].map((_, i) => <div key={i} className="h-56 rounded-xl bg-white/5" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {products.map(p => (
            <div key={p.id} onClick={() => setSelected(selected === p.id ? null : p.id)}>
              <ProductCard product={p} onWatch={handleWatch} />
            </div>
          ))}
        </div>
      )}

      {/* Panel opportunités pays */}
      {selected && (
        <div className="fixed inset-x-0 bottom-0 z-30 bg-[#111] border-t border-white/10 p-6
                        max-h-[50vh] overflow-auto">
          <div className="max-w-6xl mx-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-semibold">Opportunités géographiques</h3>
              <button onClick={() => setSelected(null)} className="text-white/40 hover:text-white text-xl">✕</button>
            </div>
            <CountryOpportunityGrid productId={selected} />
          </div>
        </div>
      )}

    </div>
  )
}
