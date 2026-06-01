'use client'

import { useEffect, useState } from 'react'
import { ProductCard }          from '../../../components/ui/product-card'
import { api }                  from '../../../src/lib/api'

export default function WatchlistPage() {
  const [items,   setItems]   = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get<any[]>('watchlist')
      .then(data => setItems(data))
      .finally(() => setLoading(false))
  }, [])

  async function remove(productId: string) {
    await api.delete(`watchlist/${productId}`)
    setItems(prev => prev.filter(i => i.product.id !== productId))
  }

  if (loading) return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 animate-pulse">
      {[...Array(8)].map((_, i) => <div key={i} className="h-56 rounded-xl bg-white/5" />)}
    </div>
  )

  if (!items.length) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
      <div className="text-5xl mb-4">⭐</div>
      <h2 className="text-white font-semibold text-lg mb-2">Votre watchlist est vide</h2>
      <p className="text-white/40 text-sm mb-6">Ajoutez des produits depuis la page Produits pour les suivre ici.</p>
      <a href="/products"
         className="px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium transition-colors">
        Explorer les produits
      </a>
    </div>
  )

  return (
    <div className="max-w-7xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Watchlist</h1>
        <span className="text-white/30 text-sm">{items.length} produit{items.length > 1 ? 's' : ''}</span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {items.map(i => (
          <div key={i.id} className="relative group">
            <ProductCard product={i.product} />
            <button
              onClick={() => remove(i.product.id)}
              className="absolute top-2 right-2 opacity-0 group-hover:opacity-100
                         bg-red-500/80 hover:bg-red-500 text-white text-xs px-2 py-1
                         rounded-md transition-all z-10"
            >
              Retirer
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
