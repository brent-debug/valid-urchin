import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { collection, query, orderBy, limit, getDocs, Timestamp } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import { useOrg } from '../../contexts/OrgContext'
import Button from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'

export default function Dashboard() {
  const { currentOrg } = useOrg()
  const apiKey = currentOrg?.firestore_api_key
  const [stats, setStats] = useState({ total: 0, unresolved: 0, urlsAffected: 0 })
  const [recent, setRecent] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!apiKey) return
    async function load() {
      try {
        const q = query(
          collection(db, `organizations/${apiKey}/conflicts`),
          orderBy('validationTimestamp', 'desc'),
          limit(50)
        )
        const snap = await getDocs(q)
        const conflicts = snap.docs.map(d => ({ id: d.id, ...d.data() }))

        const unresolved = conflicts.filter(c => !c.resolved)
        const urls = new Set(conflicts.map(c => c.originalEventData?.url).filter(Boolean))

        setStats({ total: conflicts.length, unresolved: unresolved.length, urlsAffected: urls.size })
        setRecent(conflicts.slice(0, 5))
      } catch (err) {
        console.error('Dashboard load error:', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [apiKey])

  if (!currentOrg) return null

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard label="Total conflicts (30d)" value={stats.total} color="text-zinc-900" />
        <StatCard label="Unresolved" value={stats.unresolved} color="text-red-600" />
        <StatCard label="URLs affected" value={stats.urlsAffected} color="text-amber-600" />
      </div>

      {/* Recent conflicts */}
      <div className="bg-white rounded-2xl border border-zinc-200 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100">
          <h2 className="text-sm font-semibold text-zinc-900">Recent conflicts</h2>
          <Link to="/conflicts">
            <Button variant="ghost" size="sm">View all</Button>
          </Link>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600" />
          </div>
        ) : recent.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-3xl mb-2">✅</p>
            <p className="text-sm font-medium text-zinc-900">No recent conflicts</p>
            <p className="text-xs text-zinc-500 mt-1">Your UTM parameters are clean</p>
          </div>
        ) : (
          <ul className="divide-y divide-zinc-100">
            {recent.map(c => (
              <li key={c.id} className="px-6 py-3 hover:bg-zinc-50">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-zinc-900 truncate">{c.originalEventData?.url || 'Unknown URL'}</p>
                    <p className="text-xs text-zinc-500 mt-0.5">
                      {c.conflictReasons?.map(r => `${r.parameter}: ${r.value}`).join(' · ')}
                    </p>
                  </div>
                  <div className="flex-shrink-0 flex items-center gap-2">
                    <Badge variant={c.resolved ? 'active' : 'error'}>{c.resolved ? 'Resolved' : 'Open'}</Badge>
                    <span className="text-xs text-zinc-400">{formatTime(c.validationTimestamp)}</span>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

function StatCard({ label, value, color }) {
  return (
    <div className="bg-white rounded-2xl border border-zinc-200 p-5">
      <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide">{label}</p>
      <p className={`text-3xl font-semibold mt-1 ${color}`}>{value}</p>
    </div>
  )
}

function formatTime(ts) {
  if (!ts) return ''
  const d = ts.toDate ? ts.toDate() : new Date(ts)
  return d.toLocaleDateString()
}
