import { useState, useEffect, useRef } from 'react'
import { collection, getDocs } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import { useOrg } from '../../contexts/OrgContext'
import { useConfiguration } from '../../hooks/useConfiguration'
import { saveConfiguration } from '../../lib/api'
import { supabase } from '../../lib/supabase'
import { writeAuditLog } from '../../lib/auditLog'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import EmptyState from '../../components/ui/EmptyState'
import Modal from '../../components/ui/Modal'
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

  // Resolutions map
  const [resolutions, setResolutions] = useState({}) // keyed by conflict_id

  // Modals
  const [resolveModalKey, setResolveModalKey] = useState(null)
  const [resolveNote, setResolveNote] = useState('')
  const [flagModalKey, setFlagModalKey] = useState(null)
  const [flagDescription, setFlagDescription] = useState('')

  // Three-dot menu state
  const [openMenu, setOpenMenu] = useState(null) // stores the groupKey
  const menuRef = useRef(null)

  useEffect(() => {
    if (!apiKey) return
    loadConflicts()
  }, [apiKey])

  useEffect(() => {
    if (currentOrg?.id) {
      loadRuleIssues()
    }
  }, [currentOrg?.id])

  useEffect(() => {
    if (!currentOrg?.id) return
    supabase.from('conflict_resolutions')
      .select('*')
      .eq('organization_id', currentOrg.id)
      .then(({ data }) => {
        const map = {}
        ;(data || []).forEach(r => { map[r.conflict_id] = r })
        setResolutions(map)
      })
  }, [currentOrg?.id])

  // Close menu on outside click
  useEffect(() => {
    function handleMouseDown(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setOpenMenu(null)
      }
    }
    document.addEventListener('mousedown', handleMouseDown)
    return () => document.removeEventListener('mousedown', handleMouseDown)
  }, [])

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
    const { data: { user } } = await supabase.auth.getUser()
    await saveConfiguration(apiKey, {
      ...config,
      allowedValues: { ...config.allowedValues, [parameter]: [...current, value] },
    })
    await writeAuditLog({
      organizationId: currentOrg.id,
      userId: user?.id,
      userEmail: user?.email,
      action: 'conflict_allowed',
      entityType: 'conflict',
      entityId: `${parameter}:${value}`,
      metadata: { parameter, value },
    })
    await reloadConfig()
  }

  const toggleExpand = (key) => setExpanded(p => ({ ...p, [key]: !p[key] }))

  function openResolveModal(groupKey) {
    setResolveModalKey(groupKey)
    setResolveNote('')
  }

  async function handleResolveConfirm() {
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('conflict_resolutions').insert({
      organization_id: currentOrg.id,
      conflict_id: resolveModalKey,
      resolution_type: 'resolved',
      resolved_by: user.id,
      resolved_by_email: user.email,
      note: resolveNote,
    })
    await writeAuditLog({
      organizationId: currentOrg.id,
      userId: user.id,
      userEmail: user.email,
      action: 'conflict_resolved',
      entityType: 'conflict',
      entityId: resolveModalKey,
      metadata: { note: resolveNote },
    })
    setResolutions(prev => ({ ...prev, [resolveModalKey]: { resolution_type: 'resolved' } }))
    setResolveModalKey(null)
    setResolveNote('')
  }

  async function handleFlagConfirm() {
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('rule_issues').insert({
      organization_id: currentOrg.id,
      issue_type: 'manual_flag',
      severity: 'warning',
      description: flagDescription || `Flagged conflict: ${flagModalKey}`,
      affected_rules: [],
    })
    await supabase.from('conflict_resolutions').insert({
      organization_id: currentOrg.id,
      conflict_id: flagModalKey,
      resolution_type: 'flagged',
      resolved_by: user.id,
      resolved_by_email: user.email,
    })
    await writeAuditLog({
      organizationId: currentOrg.id,
      userId: user.id,
      userEmail: user.email,
      action: 'conflict_flagged',
      entityType: 'conflict',
      entityId: flagModalKey,
      metadata: { description: flagDescription },
    })
    setResolutions(prev => ({ ...prev, [flagModalKey]: { resolution_type: 'flagged' } }))
    setFlagModalKey(null)
    setFlagDescription('')
    // Reload rule issues to show the new flag
    await loadRuleIssues()
  }

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
        <div className="space-y-2" ref={menuRef}>
          {Object.entries(violationGroups).map(([key, group]) => {
            const isOpen = expanded[key]
            const occurrences = group.conflicts.length
            const resolution = resolutions[key]
            const isResolved = resolution?.resolution_type === 'resolved'
            const isFlagged = resolution?.resolution_type === 'flagged'

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
                  <div className="flex items-center gap-2 flex-shrink-0" onClick={e => e.stopPropagation()}>
                    <Badge variant="error">{occurrences}</Badge>

                    {isResolved && (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700">
                        Resolved
                      </span>
                    )}
                    {isFlagged && (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700">
                        Rule Issue
                      </span>
                    )}

                    {!isResolved && !isFlagged && (
                      <>
                        <button
                          onClick={() => openResolveModal(key)}
                          className="text-xs text-green-600 border border-green-200 bg-green-50 hover:bg-green-100 px-3 py-1 transition-colors"
                        >
                          Mark resolved
                        </button>

                        {/* Three-dot menu */}
                        <div className="relative">
                          <button
                            onClick={() => setOpenMenu(prev => prev === key ? null : key)}
                            className="text-zinc-400 hover:text-zinc-600 px-2 py-1 border border-transparent hover:border-zinc-200 transition-colors text-base leading-none"
                            title="More options"
                          >
                            ⋯
                          </button>
                          {openMenu === key && (
                            <div className="absolute right-0 top-full mt-1 z-20 bg-white border border-zinc-200 shadow-sm min-w-[160px]">
                              <button
                                onClick={() => {
                                  handleAllow(group.conflicts[0], { parameter: group.parameter, value: group.value })
                                  setOpenMenu(null)
                                }}
                                className="w-full text-left px-4 py-2 text-sm text-teal-600 hover:bg-zinc-50 transition-colors"
                              >
                                Allow value
                              </button>
                              <button
                                onClick={() => {
                                  setFlagModalKey(key)
                                  setFlagDescription('')
                                  setOpenMenu(null)
                                }}
                                className="w-full text-left px-4 py-2 text-sm text-amber-600 hover:bg-zinc-50 transition-colors"
                              >
                                Flag rule issue
                              </button>
                            </div>
                          )}
                        </div>
                      </>
                    )}
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

      {/* Mark Resolved modal */}
      <Modal
        open={resolveModalKey !== null}
        onClose={() => { setResolveModalKey(null); setResolveNote('') }}
        title="Mark as resolved"
      >
        <div className="space-y-4">
          <p className="text-sm text-zinc-600">
            Mark this conflict group as resolved. You can optionally add a note about what was fixed.
          </p>
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">Note (optional)</label>
            <input
              type="text"
              value={resolveNote}
              onChange={e => setResolveNote(e.target.value)}
              placeholder="What was fixed? (optional)"
              className="w-full px-3 py-2 border border-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-600"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              onClick={() => { setResolveModalKey(null); setResolveNote('') }}
              className="bg-white text-zinc-700 border border-zinc-200 rounded-full px-4 py-2 text-sm hover:bg-zinc-50"
            >
              Cancel
            </button>
            <button
              onClick={handleResolveConfirm}
              className="bg-green-600 text-white rounded-full px-4 py-2 text-sm font-medium hover:bg-green-700"
            >
              Confirm
            </button>
          </div>
        </div>
      </Modal>

      {/* Flag Rule Issue modal */}
      <Modal
        open={flagModalKey !== null}
        onClose={() => { setFlagModalKey(null); setFlagDescription('') }}
        title="Flag as rule issue"
      >
        <div className="space-y-4">
          <p className="text-sm text-zinc-600">
            Flag this conflict as a rule configuration issue. It will appear in the Rule Issues section.
          </p>
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">Description (optional)</label>
            <textarea
              value={flagDescription}
              onChange={e => setFlagDescription(e.target.value)}
              placeholder="Describe the issue (optional)"
              rows={3}
              className="w-full px-3 py-2 border border-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-600 resize-none"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              onClick={() => { setFlagModalKey(null); setFlagDescription('') }}
              className="bg-white text-zinc-700 border border-zinc-200 rounded-full px-4 py-2 text-sm hover:bg-zinc-50"
            >
              Cancel
            </button>
            <button
              onClick={handleFlagConfirm}
              className="bg-amber-600 text-white rounded-full px-4 py-2 text-sm font-medium hover:bg-amber-700"
            >
              Flag issue
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
