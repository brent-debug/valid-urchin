import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { collection, query, orderBy, limit, getDocs } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import { useOrg } from '../../contexts/OrgContext'

function Spinner() {
  return (
    <div className="flex items-center justify-center py-12">
      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-teal-600" />
    </div>
  )
}

function groupByDay(conflicts) {
  const days = {}
  conflicts.forEach(c => {
    const ts = c.validationTimestamp?.toDate?.() || new Date()
    const key = ts.toISOString().slice(0, 10)
    days[key] = (days[key] || 0) + 1
  })
  const result = []
  for (let i = 11; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const key = d.toISOString().slice(0, 10)
    const label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    result.push({ key, label, count: days[key] || 0 })
  }
  return result
}

function BarChart({ data }) {
  const max = Math.max(...data.map(d => d.count), 1)
  const chartH = 80
  const barW = 28
  const gap = 8
  const totalW = data.length * (barW + gap) - gap

  return (
    <svg viewBox={`0 0 ${totalW} ${chartH + 24}`} className="w-full" style={{ height: 120 }}>
      {data.map((d, i) => {
        const barH = Math.max((d.count / max) * chartH, d.count > 0 ? 3 : 1)
        const x = i * (barW + gap)
        const y = chartH - barH
        return (
          <g key={d.key}>
            <rect x={x} y={y} width={barW} height={barH} rx={4} fill={d.count > 0 ? '#0D9488' : '#E4E4E7'} />
            {i % 3 === 0 && (
              <text x={x + barW / 2} y={chartH + 16} textAnchor="middle" fontSize="9" fill="#A1A1AA">
                {d.label}
              </text>
            )}
          </g>
        )
      })}
    </svg>
  )
}

export default function Dashboard() {
  const { currentOrg, loading: orgLoading } = useOrg()
  const apiKey = currentOrg?.firestore_api_key
  const navigate = useNavigate()
  const [tab, setTab] = useState('conflicts')
  const [conflicts, setConflicts] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!apiKey) return
    async function load() {
      try {
        const q = query(
          collection(db, `organizations/${apiKey}/conflicts`),
          orderBy('validationTimestamp', 'desc'),
          limit(100)
        )
        const snap = await getDocs(q)
        setConflicts(snap.docs.map(d => ({ id: d.id, ...d.data() })))
      } catch (err) {
        console.error('Dashboard load error:', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [apiKey])

  if (orgLoading) return <Spinner />
  if (!currentOrg) return null

  const chartData = groupByDay(conflicts)
  const recent = conflicts.slice(0, 8)

  return (
    <div className="space-y-5">
      {/* Tabs */}
      <div className="inline-flex bg-zinc-100 rounded-full p-1">
        {[['conflicts', 'Recent Conflicts'], ['usage', 'Event Usage']].map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
              tab === key ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'conflicts' ? (
        <>
          {/* Metric cards */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white rounded-xl border border-zinc-200 p-5">
              <p className="text-xs text-zinc-400 uppercase tracking-wide mb-1">Conflicts (30d)</p>
              <p className="text-4xl font-semibold text-zinc-900">{loading ? '—' : conflicts.length}</p>
            </div>
            <div className="bg-white rounded-xl border border-zinc-200 p-5">
              <p className="text-xs text-zinc-400 uppercase tracking-wide mb-1">Events monitored</p>
              <p className="text-4xl font-semibold text-zinc-900">0</p>
            </div>
          </div>

          {/* Bar chart */}
          <div className="bg-white rounded-xl border border-zinc-200 p-5">
            <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-4">Conflicts per day</p>
            {loading ? <Spinner /> : <BarChart data={chartData} />}
          </div>

          {/* Recent conflicts table */}
          <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-100">
              <p className="text-sm font-semibold text-zinc-900">Recent conflicts</p>
              <Link to="/conflicts" className="text-sm text-teal-600 hover:text-teal-700">View all →</Link>
            </div>
            {loading ? (
              <Spinner />
            ) : recent.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-3xl mb-2">✅</p>
                <p className="text-sm font-medium text-zinc-900">No recent conflicts</p>
                <p className="text-xs text-zinc-400 mt-1">Your UTM parameters are clean</p>
              </div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-zinc-100">
                    {['URL', 'Parameter', 'Violation', 'Time'].map(col => (
                      <th key={col} className="text-left px-5 py-3 text-xs font-semibold text-zinc-400 uppercase tracking-wide">{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {recent.map(c => {
                    const reason = c.conflictReasons?.[0]
                    const ts = c.validationTimestamp?.toDate?.()
                    return (
                      <tr
                        key={c.id}
                        onClick={() => navigate('/conflicts')}
                        className="border-b border-zinc-50 hover:bg-zinc-50 cursor-pointer"
                      >
                        <td className="px-5 py-3 text-sm text-zinc-900 max-w-[200px]">
                          <span className="block truncate">{c.originalEventData?.url || '—'}</span>
                        </td>
                        <td className="px-5 py-3 text-sm font-mono text-zinc-600">{reason?.parameter || '—'}</td>
                        <td className="px-5 py-3 text-sm font-mono text-red-600">{reason?.value || '—'}</td>
                        <td className="px-5 py-3 text-sm text-zinc-400">{ts ? ts.toLocaleDateString() : '—'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        </>
      ) : (
        <div className="bg-white rounded-xl border border-zinc-200 p-12 text-center">
          <p className="text-3xl mb-3">📊</p>
          <p className="text-sm font-medium text-zinc-900">Event usage tracking coming soon</p>
          <p className="text-xs text-zinc-400 mt-1">We're working on detailed event analytics.</p>
        </div>
      )}
    </div>
  )
}
