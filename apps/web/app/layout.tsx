import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { AuthProvider } from '../components/providers/auth-provider'
import './globals.css'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })

export const metadata: Metadata = {
  title: 'TrendForge — Radar Produit eCommerce',
  description: 'Détectez les produits gagnants avant tout le monde.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className="dark">
      <body className={`${inter.variable} font-sans bg-[#0a0a0a] text-white antialiased`}>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  )
}
