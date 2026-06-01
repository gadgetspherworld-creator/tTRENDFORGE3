'use client'
import Image from 'next/image'

interface Product { id: string; title: string; imageUrl?: string; source: string; score: number; engagementScore?: number; price?: number; currency?: string; tags: string[] }

const SOURCE_COLOR: Record<string, string> = {
  REDDIT: 'bg-orange-500/20 text-orange-300', PINTEREST: 'bg-red-500/20 text-red-300',
  AMAZON: 'bg-yellow-500/20 text-yellow-300', ALIEXPRESS: 'bg-orange-600/20 text-orange-300', TEMU: 'bg-blue-500/20 text-blue-300',
}

function ScoreBadge({ score }: { score: number }) {
  const color = score >= 70 ? 'bg-emerald-500' : score >= 45 ? 'bg-amber-500' : 'bg-red-500'
  return <div className={`${color} text-white text-xs font-bold px-2 py-1 rounded-md tabular-nums`}>{score}</div>
}

export function ProductCard({ product, onWatch }: { product: Product; onWatch?: (id: string) => void }) {
  return (
    <div className="group bg-white/5 hover:bg-white/8 border border-white/10 hover:border-white/20 rounded-xl overflow-hidden transition-all duration-200">
      <div className="relative h-40 bg-white/5">
        {product.imageUrl ? <Image src={product.imageUrl} alt={product.title} fill className="object-cover" /> : <div className="absolute inset-0 flex items-center justify-center text-white/20 text-4xl">📦</div>}
        <div className="absolute top-2 right-2"><ScoreBadge score={product.score} /></div>
        <div className="absolute top-2 left-2">
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${SOURCE_COLOR[product.source] ?? 'bg-white/10 text-white/50'}`}>{product.source}</span>
        </div>
      </div>
      <div className="p-4">
        <h3 className="text-white text-sm font-medium leading-snug line-clamp-2 mb-3">{product.title}</h3>
        <div className="flex items-center justify-between text-xs text-white/40">
          {product.price != null && <span className="text-white/70 font-semibold">{product.price.toFixed(2)} {product.currency ?? 'USD'}</span>}
          {product.engagementScore != null && <span>📈 {product.engagementScore}</span>}
        </div>
        {product.tags.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1">
            {product.tags.slice(0, 3).map(tag => <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-white/40">{tag}</span>)}
          </div>
        )}
        {onWatch && <button onClick={() => onWatch(product.id)} className="mt-3 w-full text-xs py-1.5 rounded-lg border border-white/10 text-white/40 hover:text-white hover:border-violet-500/50 hover:bg-violet-600/10 transition-all">⭐ Ajouter à la watchlist</button>}
      </div>
    </div>
  )
}
