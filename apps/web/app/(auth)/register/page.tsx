'use client'
import { useState, FormEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { api } from '../../../src/lib/api'
import { setToken } from '../../../src/lib/auth'

export default function RegisterPage() {
  const router                     = useRouter()
  const [form, setForm]            = useState({ email: '', password: '', name: '', orgName: '' })
  const [error, setError]          = useState<string | null>(null)
  const [loading, setLoading]      = useState(false)
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => setForm(f => ({ ...f, [k]: e.target.value }))

  async function onSubmit(e: FormEvent) {
    e.preventDefault(); setError(null); setLoading(true)
    try { const { token } = await api.post<{ token: string }>('auth/register', form); setToken(token); router.push('/dashboard') }
    catch (err: any) { setError(err.message) }
    finally { setLoading(false) }
  }

  const fields = [
    { key: 'orgName', label: "Nom de votre organisation", type: 'text',     placeholder: 'Mon Shop' },
    { key: 'name',    label: 'Votre prénom',              type: 'text',     placeholder: 'Alex' },
    { key: 'email',   label: 'Email',                     type: 'email',    placeholder: 'vous@exemple.com' },
    { key: 'password',label: 'Mot de passe (min 8 car.)', type: 'password', placeholder: '••••••••' },
  ]

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <span className="text-3xl font-bold text-white tracking-tight">⚡ TrendForge</span>
          <p className="text-white/40 mt-2 text-sm">Créez votre espace gratuitement</p>
        </div>
        <form onSubmit={onSubmit} className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-4">
          {error && <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 text-red-400 text-sm">{error}</div>}
          {fields.map(f => (
            <div key={f.key}>
              <label className="block text-white/60 text-xs mb-1.5">{f.label}</label>
              <input type={f.type} required value={form[f.key as keyof typeof form]} onChange={set(f.key)} placeholder={f.placeholder}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-violet-500/50 transition-colors" />
            </div>
          ))}
          <button type="submit" disabled={loading}
            className="w-full py-2.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white font-semibold text-sm transition-colors disabled:opacity-50">
            {loading ? 'Création…' : 'Créer mon compte'}
          </button>
        </form>
        <p className="text-center text-white/30 text-sm mt-4">
          Déjà un compte ?{' '}<Link href="/login" className="text-violet-400 hover:text-violet-300">Se connecter</Link>
        </p>
      </div>
    </div>
  )
}
