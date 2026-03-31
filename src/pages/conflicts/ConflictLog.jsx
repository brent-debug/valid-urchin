import { useState, useEffect } from 'react'
import { collection, getDocs } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import { useOrg } from '../../contexts/OrgContext'
import { useConfiguration } from '../../hooks/useConfiguration'
import { saveConfiguration } from '../../lib/api'
import { supabase } from '../../lib/supabase'
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

function getRootDomain(url) {
  try {
    const parts = new URL(url).hostname.split('.')
    return parts.length > 2 ? parts.slice(-2).join('.') : parts.join('.')
  } catch { return url }
}

export default function ConflictLog() {
  const { currentOrg } = useOrg()
  const { config, reload: reloadConfig } = useConfiguration()
  const apiKey = currentOrg?.firestore_api_key

  const [conflicts, setConflicts] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [timeRange, setTimeRange] = useState(TIME_RANGES[2])
  const [statusFilter, setStatusFilter] = useState('all')
  const [domainFilter, setDomainFilter] = useState('all')
  const [expanded, setExpanded] = useState({})

  // Rule issues
  const [ruleIssues, setRuleIssues] = useState([])

  useEffect(() => {
    if (!apiKey) return
    loadConflicts()
  }, [apiKey])

  useEffect(() => {
    if (currentOrg?.id) {
      loadRuleIssues()
    }
  }, [currentOrg?.id])

  async function loadConflicts() {
    setLoading(true)
    const collPath = `organizations/${apiKey}/conflicts`
    try {
      const snap = await getDocs(collection(db, collPath))
      const all = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      all.sort((a, b) => {
        const getTs = v => v?.toDate?.()?.getTime?.() ?? (typeof v === 'string' ? new Date(v).getTime() : 0)
        return getTs(b.validationTimestamp) - getTs(a.validationTimestamp)
      })
      setConflicts(all.slice(0, 200))
    } catch (err) {
      console.error('[ConflictLog] error:', err)
    } finally {
      setLoading(false)
    }
  }

  async function loadRuleIssues() {
    try {
      const { data } = await supabase
        .from('rule_issues')
        .select('*')
        .eq('organization_id', currentOrg.id)
        .is('resolved_at', null)
      setRuleIssues(data || [])
    } catch (e) {
      console.warn('Failed to load rule issues:', e)
    }
  }

  async function dismissIssue(issueId) {
    await supabase.from('rule_issues').update({ resolved_at: new Date().toISOString() }).eq('id', issueId)
    setRuleIssues(prev => prev.filter(i => i.id !== issueId))
  }

  const now = Date.now()
  const filtered = conflicts.filter(c => {
    const raw = c.validationTimestamp
    const ts = raw?.toDate?.()?.getTime?.()
      ?? (typeof raw === 'string' ? new Date(raw).getTime() : null)
      ?? (typeof raw === 'number' ? raw : null)
      ?? null
    if (timeRange.ms !== Infinity && (ts === null || now - ts > timeRange.ms)) return false
    if (statusFilter === 'open' && c.resolved) return false
    if (statusFilter === 'resolved' && !c.resolved) return false
    const url = c.originalEventData?.url || ''
    if (search && !url.toLowerCase().includes(search.toLowerCase())) return false
    if (domainFilter !== 'all' && getRootDomain(url) !== domainFilter) return false
    return true
  })

  // Unique domains for dropdown
  const uniqueDomains = [...new Set(conflicts.map(c => getRootDomain(c.originalEventData?.url || '')).filter(Boolean))]

  // Group by parameter:value
  const violationGroups = {}
  filtered.forEach(c => {
    const reason = c.conflictReasons?.[0]
    if (!reason) return
    const key = `${reason.parameter}:${reason.value}`
    if (!violationGroups[key]) violationGroups[key] = { parameter: reason.parameter, value: reason.value, conflicts: [] }
    violationGroups[key].conflicts.push(c)
  })

  const totalViolations = filtered.length
  const unresolved = filtered.filter(c => !c.resolved).length
  const groupCount = Object.keys(violationGroups).length

  const handleAllow = async (_conflict, reason) => {
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

  const toggleExpand = (key) => setExpanded(p => ({ ...p, [key]: !p[key] }))

  return (
    <div className="space-y-4">
      {/* Stats bar */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white border border-zinc-200 p-4 text-center">
          <p className="text-2xl font-semibold text-zinc-900">{totalViolations}</p>
          <p className="text-xs text-zinc-500 mt-0.5">Total violations</p>
        </div>
        <div className="bg-white border border-zinc-200 p-4 text-center">
          <p className="text-2xl font-semibold text-red-600">{unresolved}</p>
          <p className="text-xs text-zinc-500 mt-0.5">Unresolved</p>
        </div>
        <div className="bg-white border border-zinc-200 p-4 text-center">
          <p className="text-2xl font-semibold text-amber-600">{groupCount}</p>
          <p className="text-xs text-zinc-500 mt-0.5">Violation types</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search URLs…"
          className="flex-1 min-w-0 px-3 py-2 border border-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-600"
        />
        <select
          value={timeRange.label}
          onChange={e => setTimeRange(TIME_RANGES.find(t => t.label === e.target.value))}
          className="px-3 py-2 border border-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-600"
        >
          {TIME_RANGES.map(t => <option key={t.label}>{t.label}</option>)}
        </select>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="px-3 py-2 border border-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-600"
        >
          <option value="all">All</option>
          <option value="open">Open</option>
          <option value="resolved">Resolved</option>
        </select>
        <select
          value={domainFilter}
          onChange={e => setDomainFilter(e.target.value)}
          className="px-3 py-2 border border-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-600"
        >
          <option value="all">All domains</option>
          {uniqueDomains.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
        <Button variant="secondary" size="sm" onClick={loadConflicts}>Refresh</Button>
      </div>

      {/* Rule Issues section */}
      {ruleIssues.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 overflow-hidden">
          <div className="px-5 py-3 border-b border-amber-200">
            <p className="text-sm font-semibold text-amber-800">Rule Issues</p>
          </div>
          <div className="divide-y divide-amber-100">
            {ruleIssues.map(issue => (
              <div key={issue.id} className="flex items-center justify-between gap-4 px-5 py-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-amber-800">{issue.description}</p>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <Badge variant="paused">{issue.severity || 'warning'}</Badge>
                  <button
                    onClick={() => dismissIssue(issue.id)}
                    className="text-xs text-amber-700 hover:text-amber-900 border border-amber-300 px-3 py-1 transition-colors"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Conflict groups (by parameter:value) */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600" />
        </div>
      ) : Object.keys(violationGroups).length === 0 ? (
        <EmptyState icon="✅" title="No conflicts found" description="No UTM violations match your current filters." />
      ) : (
        <div className="space-y-2">
          {Object.entries(violationGroups).map(([key, group]) => {
            const isOpen = expanded[key]
            const occurrences = group.conflicts.length
            return (
              <div key={key} className="bg-white border border-zinc-200 overflow-hidden">
                <button
                  onClick={() => toggleExpand(key)}
                  className="w-full flex items-center gap-3 px-5 py-4 hover:bg-zinc-50 text-left"
                >
                  {isOpen ? <ChevronDownIcon className="h-4 w-4 text-zinc-400 flex-shrink-0" /> : <ChevronRightIcon className="h-4 w-4 text-zinc-400 flex-shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-mono font-medium text-zinc-700 bg-zinc-100 px-1.5 py-0.5">{group.parameter}</span>
                      <span className="text-xs text-zinc-400">received</span>
                      <span className="text-sm font-mono font-medium text-red-600 bg-red-50 px-1.5 py-0.5">{group.value}</span>
                    </div>
                    <p className="text-xs text-zinc-400 mt-1">{occurrences} occurrence{occurrences !== 1 ? 's' : ''}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Badge variant="error">{occurrences}</Badge>
                    <button
                      onClick={e => { e.stopPropagation(); handleAllow(group.conflicts[0], { parameter: group.parameter, value: group.value }) }}
                      className="text-xs text-teal-600 hover:text-teal-700 border border-teal-200 px-3 py-1 transition-colors"
                    >
                      Allow value
                    </button>
                  </div>
                </button>

                {isOpen && (
                  <div className="border-t border-zinc-100 divide-y divide-zinc-50">
                    {group.conflicts.map(conflict => (
                      <div key={conflict.id} className="px-5 py-3">
                        <div className="flex items-start justify-between gap-4">
                          <div className="space-y-1 flex-1 min-w-0">
                            <p className="text-sm text-zinc-700 truncate">{conflict.originalEventData?.url || '—'}</p>
                            {conflict.conflictReasons?.length > 1 && (
                              <div className="space-y-1">
                                {conflict.conflictReasons.slice(1).map((reason, i) => (
                                  <div key={i} className="flex items-center gap-2 flex-wrap">
                                    <span className="text-xs font-mono text-zinc-700 bg-zinc-100 px-1.5 py-0.5">{reason.parameter}</span>
                                    <span className="text-xs text-zinc-500">received</span>
                                    <span className="text-xs font-mono text-red-600 bg-red-50 px-1.5 py-0.5">{reason.value}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                          <div className="flex-shrink-0 text-xs text-zinc-400">
                            {formatTime(conflict.validationTimestamp)}
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
