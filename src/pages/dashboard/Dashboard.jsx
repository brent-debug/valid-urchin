import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { collection, query, orderBy, limit, getDocs } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import { useOrg } from '../../contexts/OrgContext'
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts'

function Spinner() {
  return (
    <div className="flex items-center justify-center py-12">
      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-teal-600" />
    </div>
  )
}

function formatTime(raw) {
  if (!raw) return '—'
  const date = raw?.toDate?.() ?? new Date(raw)
  if (isNaN(date)) return '—'
  const diffMs = Date.now() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function buildChartData(conflicts, events) {
  const conflictDays = {}
  conflicts.forEach(c => {
    const raw = c.validationTimestamp
    const ts = raw?.toDate?.() ?? (raw ? new Date(raw) : null)
    if (!ts || isNaN(ts)) return
    const key = ts.toISOString().slice(0, 10)
    conflictDays[key] = (conflictDays[key] || 0) + 1
  })

  const eventDays = {}
  events.forEach(e => {
    const raw = e.receivedAt
    if (!raw) return
    const ts = new Date(raw)
    if (isNaN(ts)) return
    const key = ts.toISOString().slice(0, 10)
    eventDays[key] = (eventDays[key] || 0) + 1
  })

  const result = []
  for (let i = 11; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const key = d.toISOString().slice(0, 10)
    const label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    const count = conflictDays[key] || 0
    const eventCount = eventDays[key] || 0
    const errorRate = eventCount > 0 ? parseFloat(((count / eventCount) * 100).toFixed(1)) : null
    result.push({ key, label, count, eventCount, errorRate })
  }
  return result
}

export default function Dashboard() {
  const { currentOrg, org, loading: orgLoading } = useOrg()
  const apiKey = currentOrg?.firestore_api_key
  const navigate = useNavigate()
  const [tab, setTab] = useState('conflicts')
  const [conflicts, setConflicts] = useState([])
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [chartMetric, setChartMetric] = useState(null) // null | 'events' | 'errorRate'

  useEffect(() => {
    if (!apiKey) return
    async function load() {
      try {
        // Fetch conflicts (last 12 days, ordered)
        const conflictsSnap = await getDocs(query(
          collection(db, `organizations/${apiKey}/conflicts`),
          orderBy('validationTimestamp', 'desc'),
          limit(100)
        ))
        setConflicts(conflictsSnap.docs.map(d => ({ id: d.id, ...d.data() })))

        // Fetch events for the last 12 days (no orderBy to avoid index requirement)
        const twelveDAgo = new Date()
        twelveDAgo.setDate(twelveDAgo.getDate() - 12)
        const eventsSnap = await getDocs(
          collection(db, `organizations/${apiKey}/utm_events`)
        )
        const recentEvents = eventsSnap.docs
          .map(d => d.data())
          .filter(e => e.receivedAt && new Date(e.receivedAt) >= twelveDAgo)
        setEvents(recentEvents)
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

  const chartData = buildChartData(conflicts, events)
  const recent = conflicts.slice(0, 3)

  // Use org-level counts from OrgContext
  const conflictCount = currentOrg?.conflictCount ?? conflicts.length
  const eventCount = currentOrg?.eventCount ?? 0
  const eventsWithConflicts = currentOrg?.eventsWithConflicts ?? 0
  const conflictRate = eventCount > 0
    ? ((eventsWithConflicts / eventCount) * 100).toFixed(1)
    : null

  const chartTitle = chartMetric === 'events' ? 'Conflicts & Events per day'
    : chartMetric === 'errorRate' ? 'Conflict Rate per day'
    : 'Conflicts per day'

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
          {/* Metric cards — 3 cards */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white border border-zinc-200 p-5">
              <p className="text-xs text-zinc-400 uppercase tracking-wide mb-1">Conflicts (30d)</p>
              <p className="text-4xl font-semibold text-zinc-900">{loading ? '—' : conflictCount}</p>
            </div>
            <div className="bg-white border border-zinc-200 p-5">
              <p className="text-xs text-zinc-400 uppercase tracking-wide mb-1">Events monitored</p>
              <p className="text-4xl font-semibold text-zinc-900">{eventCount}</p>
            </div>
            <div className="bg-white border border-zinc-200 p-5">
              <p className="text-xs text-zinc-400 uppercase tracking-wide mb-1">Events with conflicts</p>
              <p className="text-4xl font-semibold text-zinc-900">{conflictRate !== null ? `${conflictRate}%` : '—'}</p>
              <p className="text-xs text-zinc-400 mt-1">of events had violations</p>
            </div>
          </div>

          {/* Bar chart */}
          <div className="bg-white border border-zinc-200 p-5">
            <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-2">{chartTitle}</p>

            {/* Overlay toggle */}
            <div className="flex items-center gap-1 mb-4">
              <span className="text-xs text-zinc-400 mr-1">Overlay:</span>
              {[['events', 'Events'], ['errorRate', 'Error Rate %']].map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setChartMetric(prev => prev === key ? null : key)}
                  className={`px-3 py-1 text-xs border transition-colors rounded-full ${
                    chartMetric === key
                      ? 'bg-teal-600 text-white border-teal-600'
                      : 'border-zinc-200 text-zinc-500 hover:border-zinc-300'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {loading ? <Spinner /> : (
              <ResponsiveContainer width="100%" height={120}>
                <ComposedChart data={chartData} margin={{ top: 4, right: chartMetric ? 32 : 0, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f4f4f5" vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 9, fill: '#a1a1aa' }}
                    axisLine={false}
                    tickLine={false}
                    interval={2}
                  />
                  <YAxis
                    yAxisId="left"
                    tick={{ fontSize: 9, fill: '#a1a1aa' }}
                    axisLine={false}
                    tickLine={false}
                    width={20}
                    allowDecimals={false}
                  />
                  {chartMetric && (
                    <YAxis
                      yAxisId="right"
                      orientation="right"
                      tick={{ fontSize: 9, fill: '#a1a1aa' }}
                      axisLine={false}
                      tickLine={false}
                      width={chartMetric === 'errorRate' ? 30 : 20}
                      tickFormatter={v => chartMetric === 'errorRate' ? `${v}%` : v}
                    />
                  )}
                  <Tooltip
                    contentStyle={{ fontSize: 11, border: '1px solid #e4e4e7', borderRadius: 0 }}
                    formatter={(value, name) => [name === 'Error Rate' ? `${value}%` : value, name]}
                  />
                  <Bar yAxisId="left" dataKey="count" fill="#0D9488" radius={0} maxBarSize={24} name="Conflicts" />
                  {chartMetric === 'events' && (
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="eventCount"
                      stroke="#6366f1"
                      strokeWidth={1.5}
                      dot={false}
                      name="Events"
                    />
                  )}
                  {chartMetric === 'errorRate' && (
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="errorRate"
                      stroke="#f59e0b"
                      strokeWidth={1.5}
                      dot={false}
                      name="Error Rate"
                    />
                  )}
                </ComposedChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Recent conflicts table */}
          <div className="bg-white border border-zinc-200 overflow-hidden">
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
                        <td className="px-5 py-3 text-sm text-zinc-400">{formatTime(c.validationTimestamp)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        </>
      ) : (
        <div className="bg-white border border-zinc-200 p-12 text-center">
          <p className="text-3xl mb-3">📊</p>
          <p className="text-sm font-medium text-zinc-900">Event usage tracking coming soon</p>
          <p className="text-xs text-zinc-400 mt-1">We're working on detailed event analytics.</p>
        </div>
      )}
    </div>
  )
}
