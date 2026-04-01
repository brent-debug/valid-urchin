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

function buildChartData(conflicts, events, days = 11) {
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
  for (let i = days; i >= 0; i--) {
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

function getDomain(url) {
  if (!url) return 'unknown'
  try { return new URL(url).hostname } catch { return url }
}

function buildDomainBreakdown(events) {
  const counts = {}
  events.forEach(e => {
    const d = getDomain(e.url)
    counts[d] = (counts[d] || 0) + 1
  })
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([domain, count]) => ({ domain, count }))
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

        // Fetch events for the last 30 days (no orderBy to avoid index requirement)
        const thirtyDAgo = new Date()
        thirtyDAgo.setDate(thirtyDAgo.getDate() - 30)
        const eventsSnap = await getDocs(
          collection(db, `organizations/${apiKey}/utm_events`)
        )
        const recentEvents = eventsSnap.docs
          .map(d => ({ id: d.id, path: d.ref.path, ...d.data() }))
          .filter(e => e.receivedAt && new Date(e.receivedAt) >= thirtyDAgo)
          .sort((a, b) => new Date(b.receivedAt) - new Date(a.receivedAt))
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

  const chartData = buildChartData(conflicts, events, 11)
  const eventChartData = buildChartData(conflicts, events, 29)
  const recent = conflicts.slice(0, 3)

  // Event Usage tab data
  const conflictedPaths = new Set(conflicts.map(c => c.documentPath).filter(Boolean))
  const recentEvents = events.slice(0, 15)
  const domainBreakdown = buildDomainBreakdown(events)
  const avgPerDay = events.length > 0 ? (events.length / 30).toFixed(1) : '—'
  const eventsThisWeek = events.filter(e => {
    const ts = new Date(e.receivedAt)
    return !isNaN(ts) && ts >= new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  }).length

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
        <>
          {/* Event stats */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white border border-zinc-200 p-5">
              <p className="text-xs text-zinc-400 uppercase tracking-wide mb-1">Events (MTD)</p>
              <p className="text-4xl font-semibold text-zinc-900">{loading ? '—' : eventCount}</p>
            </div>
            <div className="bg-white border border-zinc-200 p-5">
              <p className="text-xs text-zinc-400 uppercase tracking-wide mb-1">Events (7d)</p>
              <p className="text-4xl font-semibold text-zinc-900">{loading ? '—' : eventsThisWeek}</p>
            </div>
            <div className="bg-white border border-zinc-200 p-5">
              <p className="text-xs text-zinc-400 uppercase tracking-wide mb-1">Avg per day (30d)</p>
              <p className="text-4xl font-semibold text-zinc-900">{loading ? '—' : avgPerDay}</p>
            </div>
          </div>

          {/* Events per day chart */}
          <div className="bg-white border border-zinc-200 p-5">
            <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-4">Events per day (30d)</p>
            {loading ? <Spinner /> : (
              <ResponsiveContainer width="100%" height={120}>
                <ComposedChart data={eventChartData} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f4f4f5" vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 9, fill: '#a1a1aa' }}
                    axisLine={false}
                    tickLine={false}
                    interval={4}
                  />
                  <YAxis
                    yAxisId="left"
                    tick={{ fontSize: 9, fill: '#a1a1aa' }}
                    axisLine={false}
                    tickLine={false}
                    width={20}
                    allowDecimals={false}
                  />
                  <Tooltip
                    contentStyle={{ fontSize: 11, border: '1px solid #e4e4e7', borderRadius: 0 }}
                    formatter={(value, name) => [value, name]}
                  />
                  <Bar yAxisId="left" dataKey="eventCount" fill="#6366f1" radius={0} maxBarSize={20} name="Events" />
                </ComposedChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Recent events + domain breakdown */}
          <div className="grid grid-cols-3 gap-4">
            {/* Recent events table */}
            <div className="col-span-2 bg-white border border-zinc-200 overflow-hidden">
              <div className="px-5 py-4 border-b border-zinc-100">
                <p className="text-sm font-semibold text-zinc-900">Recent events</p>
              </div>
              {loading ? <Spinner /> : recentEvents.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-sm text-zinc-400">No events in the last 30 days</p>
                </div>
              ) : (
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-zinc-100">
                      {['URL', 'Parameters', 'Status', 'Time'].map(col => (
                        <th key={col} className="text-left px-5 py-3 text-xs font-semibold text-zinc-400 uppercase tracking-wide">{col}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {recentEvents.map(e => {
                      const hasConflict = conflictedPaths.has(e.path)
                      const params = e.utmParameters ? Object.keys(e.utmParameters).join(', ') : '—'
                      return (
                        <tr key={e.id} className="border-b border-zinc-50 hover:bg-zinc-50">
                          <td className="px-5 py-3 text-sm text-zinc-900 max-w-[180px]">
                            <span className="block truncate">{e.url || '—'}</span>
                          </td>
                          <td className="px-5 py-3 text-xs font-mono text-zinc-500 max-w-[140px]">
                            <span className="block truncate">{params}</span>
                          </td>
                          <td className="px-5 py-3">
                            {hasConflict ? (
                              <span className="text-xs font-medium text-red-600 bg-red-50 border border-red-100 px-2 py-0.5">conflict</span>
                            ) : (
                              <span className="text-xs font-medium text-teal-700 bg-teal-50 border border-teal-100 px-2 py-0.5">clean</span>
                            )}
                          </td>
                          <td className="px-5 py-3 text-sm text-zinc-400">{formatTime(e.receivedAt)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
            </div>

            {/* Domain breakdown */}
            <div className="bg-white border border-zinc-200 overflow-hidden">
              <div className="px-5 py-4 border-b border-zinc-100">
                <p className="text-sm font-semibold text-zinc-900">By domain</p>
              </div>
              {loading ? <Spinner /> : domainBreakdown.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-sm text-zinc-400">No data</p>
                </div>
              ) : (
                <div className="px-5 py-4 space-y-3">
                  {domainBreakdown.map(({ domain, count }) => {
                    const pct = events.length > 0 ? (count / events.length) * 100 : 0
                    return (
                      <div key={domain}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-mono text-zinc-700 truncate max-w-[130px]">{domain}</span>
                          <span className="text-xs text-zinc-400 ml-2 flex-shrink-0">{count}</span>
                        </div>
                        <div className="w-full h-1 bg-zinc-100">
                          <div className="h-full bg-indigo-400" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
