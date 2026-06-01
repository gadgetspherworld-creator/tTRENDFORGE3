'use client'
import { useState, FormEvent } from 'react'
import Link from 'next/link'
import { useAuth } from '../../../components/providers/auth-provider'

export default function LoginPage() {
  const { login }                  = useAuth()
  const [email, setEmail]          = useState('')
  const [password, setPassword]    = useState('')
  const [error, setError]          = useState<string | null>(null)
  const [loading, setLoading]      = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault(); setError(null); setLoading(true)
    try { await login(email, password) }
    catch (err: any) { setError(err.message) }
    finally { setLoading(false) }
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <span className="text-3xl font-bold text-white tracking-tight">⚡ TrendForge</span>
          <p className="text-white/40 mt-2 text-sm">Connectez-vous à votre espace</p>
        </div>
        <form onSubmit={onSubmit} className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-4">
          {error && <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 text-red-400 text-sm">{error}</div>}
          <div>
            <label className="block text-white/60 text-xs mb-1.5">Email</label>
            <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-violet-500/50 transition-colors" />
          </div>
          <div>
            <label className="block text-white/60 text-xs mb-1.5">Mot de passe</label>
            <input type="password" required value={password} onChange={e => setPassword(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-violet-500/50 transition-colors" />
          </div>
          <button type="submit" disabled={loading}
            className="w-full py-2.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white font-semibold text-sm transition-colors disabled:opacity-50">
            {loading ? 'Connexion…' : 'Se connecter'}
          </button>
        </form>
        <p className="text-center text-white/30 text-sm mt-4">
          Pas encore de compte ?{' '}<Link href="/register" className="text-violet-400 hover:text-violet-300">Créer un compte</Link>
        </p>
      </div>
    </div>
  )
}
