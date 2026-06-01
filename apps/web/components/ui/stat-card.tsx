interface StatCardProps { icon: string; label: string; value: string | number; delta?: string; positive?: boolean }
export function StatCard({ icon, label, value, delta, positive }: StatCardProps) {
  return (
    <div className="bg-white/5 border border-white/10 rounded-xl p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xl">{icon}</span>
        {delta && <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${positive !== false ? 'bg-emerald-500/20 text-emerald-300' : 'bg-red-500/20 text-red-300'}`}>{delta}</span>}
      </div>
      <p className="text-white/50 text-xs mb-1">{label}</p>
      <p className="text-white text-2xl font-bold tabular-nums">{value}</p>
    </div>
  )
}
