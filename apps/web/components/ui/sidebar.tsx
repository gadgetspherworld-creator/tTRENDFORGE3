'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from '../providers/auth-provider'

const NAV = [
  { href: '/dashboard', icon: '⚡', label: 'Dashboard' },
  { href: '/products',  icon: '🔍', label: 'Produits'  },
  { href: '/watchlist', icon: '⭐', label: 'Watchlist'  },
]

export function Sidebar() {
  const path = usePathname()
  const { user, logout } = useAuth()
  return (
    <aside className="w-60 h-screen bg-[#111] border-r border-white/10 flex flex-col fixed left-0 top-0 z-20">
      <div className="px-6 py-5 border-b border-white/10">
        <span className="text-white font-bold text-xl tracking-tight">⚡ TrendForge</span>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-1">
        {NAV.map(item => {
          const active = path.startsWith(item.href)
          return (
            <Link key={item.href} href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors
                ${active ? 'bg-violet-600/20 text-violet-300 border border-violet-500/30' : 'text-white/50 hover:text-white hover:bg-white/5'}`}>
              <span className="text-base">{item.icon}</span>{item.label}
            </Link>
          )
        })}
      </nav>
      <div className="px-4 py-4 border-t border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-violet-600/30 border border-violet-500/30 flex items-center justify-center text-violet-300 text-sm font-bold">
            {user?.name?.[0]?.toUpperCase() ?? user?.email?.[0]?.toUpperCase() ?? '?'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white text-xs font-medium truncate">{user?.name ?? user?.email}</p>
            <p className="text-white/30 text-xs">{user?.role}</p>
          </div>
          <button onClick={logout} className="text-white/30 hover:text-white text-xs transition-colors">↪</button>
        </div>
      </div>
    </aside>
  )
}
