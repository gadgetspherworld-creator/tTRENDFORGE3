'use client'
import { useEffect, useState } from 'react'
import { useAuth }             from '../../../components/providers/auth-provider'
import { StatCard }            from '../../../components/ui/stat-card'
import { ProductCard }         from '../../../components/ui/product-card'
import { api }                 from '../../../src/lib/api'

interface DashboardStats { totalProducts: number; risingProducts: number; watchlistCount: number; avgScore: number }

export default function DashboardPage() {
  const { user }              = useAuth()
  const [stats, setStats]     = useState<DashboardStats | null>(null)
  const [top, setTop]         = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([api.get<DashboardStats>('products/stats'), api.get<any[]>('products?sort=score&limit=6')])
      .then(([s, p]) => { setStats(s); setTop(p) })
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="space-y-8 max-w-6xl">
      <div>
        <h1 className="text-2xl font-bold text-white">Bonjour{user?.name ? `, ${user.name}` : ''} 👋</h1>
        <p className="text-white/40 text-sm mt-1">Voici ce qui se passe sur votre radar aujourd'hui.</p>
      </div>
      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 animate-pulse">
          {[...Array(4)].map((_, i) => <div key={i} className="h-28 rounded-xl bg-white/5" />)}
        </div>
      ) : stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard icon="📦" label="Produits détectés"  value={stats.totalProducts}  delta="+12 hier" />
          <StatCard icon="📈" label="En hausse ce mois"  value={stats.risingProducts} delta="+5%" positive />
          <StatCard icon="⭐" label="Watchlist"           value={stats.watchlistCount} />
          <StatCard icon="⚡" label="Score moyen"         value={stats.avgScore?.toFixed(1) ?? '—'} />
        </div>
      )}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-white font-semibold">Meilleurs scores du moment</h2>
          <a href="/products" className="text-violet-400 text-sm hover:text-violet-300">Voir tout →</a>
        </div>
        {loading ? (
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 animate-pulse">
            {[...Array(6)].map((_, i) => <div key={i} className="h-56 rounded-xl bg-white/5" />)}
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            {top.map(p => <ProductCard key={p.id} product={p} />)}
          </div>
        )}
      </div>
    </div>
  )
}
