import { useState, useEffect } from 'react'
import { collection, query, orderBy, getDocs, limit } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import { useOrg } from '../../contexts/OrgContext'
import { useConfiguration } from '../../hooks/useConfiguration'
import { saveConfiguration } from '../../lib/api'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import EmptyState from '../../components/ui/EmptyState'
import { ChevronDownIcon, ChevronRightIcon } from '@heroicons/react/24/outline'

const TIME_RANGES = [
  { label: 'Last 24h', ms: 86400000 },
  { label: 'Last 7d', ms: 7 * 86400000 },
  { label: 'Last 30d', ms: 30 * 86400000 },
  { label: 'All time', ms: Infinity },
]

export default function ConflictLog() {
  const { currentOrg } = useOrg()
  const { config, reload: reloadConfig } = useConfiguration()
  const apiKey = currentOrg?.firestore_api_key

  const [conflicts, setConflicts] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [timeRange, setTimeRange] = useState(TIME_RANGES[2])
  const [statusFilter, setStatusFilter] = useState('all')
  const [expanded, setExpanded] = useState({})

  useEffect(() => {
    if (!apiKey) return
    loadConflicts()
  }, [apiKey])

  async function loadConflicts() {
    setLoading(true)
    try {
      const q = query(
        collection(db, `organizations/${apiKey}/conflicts`),
        orderBy('validationTimestamp', 'desc'),
        limit(200)
      )
      const snap = await getDocs(q)
      setConflicts(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const now = Date.now()
  const filtered = conflicts.filter(c => {
    const ts = c.validationTimestamp?.toDate?.()?.getTime?.() || 0
    if (timeRange.ms !== Infinity && now - ts > timeRange.ms) return false
    if (statusFilter === 'open' && c.resolved) return false
    if (statusFilter === 'resolved' && !c.resolved) return false
    const url = c.originalEventData?.url || ''
    if (search && !url.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  // Group by URL
  const groups = {}
  filtered.forEach(c => {
    const url = c.originalEventData?.url || 'Unknown'
    if (!groups[url]) groups[url] = []
    groups[url].push(c)
  })

  const totalViolations = filtered.length
  const unresolved = filtered.filter(c => !c.resolved).length
  const urlsAffected = Object.keys(groups).length

  const handleAllow = async (conflict, reason) => {
    if (!config) return
    const { parameter, value } = reason
    const current = config.allowedValues?.[parameter] || []
    if (current.includes(value)) return
    await saveConfiguration(apiKey, {
      ...config,
      allowedValues: { ...config.allowedValues, [parameter]: [...current, value] },
    })
    await reloadConfig()
  }

  const toggleExpand = (url) => setExpanded(p => ({ ...p, [url]: !p[url] }))

  return (
    <div className="space-y-4">
      {/* Stats bar */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white rounded-lg border border-zinc-200 p-4 text-center">
          <p className="text-2xl font-semibold text-zinc-900">{totalViolations}</p>
          <p className="text-xs text-zinc-500 mt-0.5">Total violations</p>
        </div>
        <div className="bg-white rounded-lg border border-zinc-200 p-4 text-center">
          <p className="text-2xl font-semibold text-red-600">{unresolved}</p>
          <p className="text-xs text-zinc-500 mt-0.5">Unresolved</p>
        </div>
        <div className="bg-white rounded-lg border border-zinc-200 p-4 text-center">
          <p className="text-2xl font-semibold text-amber-600">{urlsAffected}</p>
          <p className="text-xs text-zinc-500 mt-0.5">URLs affected</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search URLs…"
          className="flex-1 min-w-0 px-3 py-2 rounded-md border border-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-600"
        />
        <select
          value={timeRange.label}
          onChange={e => setTimeRange(TIME_RANGES.find(t => t.label === e.target.value))}
          className="px-3 py-2 rounded-md border border-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-600"
        >
          {TIME_RANGES.map(t => <option key={t.label}>{t.label}</option>)}
        </select>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="px-3 py-2 rounded-md border border-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-600"
        >
          <option value="all">All</option>
          <option value="open">Open</option>
          <option value="resolved">Resolved</option>
        </select>
        <Button variant="secondary" size="sm" onClick={loadConflicts}>Refresh</Button>
      </div>

      {/* Conflict groups */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600" />
        </div>
      ) : Object.keys(groups).length === 0 ? (
        <EmptyState icon="✅" title="No conflicts found" description="No UTM violations match your current filters." />
      ) : (
        <div className="space-y-2">
          {Object.entries(groups).map(([url, items]) => {
            const isOpen = expanded[url]
            const openCount = items.filter(c => !c.resolved).length
            return (
              <div key={url} className="bg-white rounded-lg border border-zinc-200 overflow-hidden">
                <button
                  onClick={() => toggleExpand(url)}
                  className="w-full flex items-center gap-3 px-5 py-4 hover:bg-zinc-50 text-left"
                >
                  {isOpen ? <ChevronDownIcon className="h-4 w-4 text-zinc-400 flex-shrink-0" /> : <ChevronRightIcon className="h-4 w-4 text-zinc-400 flex-shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-zinc-900 truncate">{url}</p>
                    <p className="text-xs text-zinc-500 mt-0.5">{items.length} violations · {openCount} open</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Badge variant={openCount > 0 ? 'error' : 'active'}>{openCount > 0 ? `${openCount} open` : 'All resolved'}</Badge>
                  </div>
                </button>

                {isOpen && (
                  <div className="border-t border-zinc-100 divide-y divide-zinc-50">
                    {items.map(conflict => (
                      <div key={conflict.id} className="px-5 py-3">
                        <div className="flex items-start justify-between gap-4">
                          <div className="space-y-1 flex-1">
                            {conflict.conflictReasons?.map((reason, i) => (
                              <div key={i} className="flex items-center gap-2 flex-wrap">
                                <span className="text-xs font-mono text-zinc-700 bg-zinc-100 px-1.5 py-0.5 rounded">{reason.parameter}</span>
                                <span className="text-xs text-zinc-500">received</span>
                                <span className="text-xs font-mono text-red-600 bg-red-50 px-1.5 py-0.5 rounded">{reason.value}</span>
                                <span className="text-xs text-zinc-400">({reason.rule} violation)</span>
                                <button
                                  onClick={() => handleAllow(conflict, reason)}
                                  className="text-xs text-primary-600 hover:text-primary-700 underline"
                                >
                                  Allow value
                                </button>
                              </div>
                            ))}
                          </div>
                          <div className="flex-shrink-0 text-xs text-zinc-400">
                            {conflict.validationTimestamp?.toDate?.()?.toLocaleString?.() || ''}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
