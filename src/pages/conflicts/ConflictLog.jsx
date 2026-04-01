import { useState, useEffect, useRef } from 'react'
import { collection, getDocs } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import { useOrg } from '../../contexts/OrgContext'
import { useConfiguration } from '../../hooks/useConfiguration'
import { supabase } from '../../lib/supabase'
import { writeAuditLog } from '../../lib/auditLog'
import { getAutoResolveRule } from '../../lib/conflictHelpers'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import EmptyState from '../../components/ui/EmptyState'
import Modal from '../../components/ui/Modal'
import { ChevronDownIcon, ChevronRightIcon } from '@heroicons/react/24/outline'

function FilterIcon() {
  return (
    <svg className="h-3.5 w-3.5 flex-shrink-0" viewBox="0 0 1200 1200" fill="currentColor">
      <path d="m528 604.31v235.69c-0.046875 3.1875 1.2656 6.2344 3.6094 8.3906l120 120c2.1562 2.3438 5.2031 3.6562 8.3906 3.6094 1.5938 0.046875 3.1406-0.28125 4.5469-0.9375 4.5-1.875 7.4531-6.2344 7.4531-11.062v-355.69l297.14-356.63c3.0938-3.5156 3.7969-8.5312 1.6406-12.75-1.875-4.2188-6.1406-6.9375-10.781-6.9375h-720c-4.6406 0-8.9062 2.7188-10.781 6.9375-2.1562 4.2188-1.4531 9.2344 1.6406 12.75z"/>
    </svg>
  )
}

function SortIcon() {
  return (
    <svg className="h-3.5 w-3.5 flex-shrink-0" viewBox="0 0 1200 1200" fill="currentColor">
      <path d="m150 912.5h400c22.328 0 42.961-11.914 54.125-31.25 11.168-19.336 11.168-43.164 0-62.5-11.164-19.336-31.797-31.25-54.125-31.25h-400c-22.328 0-42.961 11.914-54.125 31.25-11.168 19.336-11.168 43.164 0 62.5 11.164 19.336 31.797 31.25 54.125 31.25z"/>
      <path d="m150 562.5h500c22.328 0 42.961-11.914 54.125-31.25 11.168-19.336 11.168-43.164 0-62.5-11.164-19.336-31.797-31.25-54.125-31.25h-500c-22.328 0-42.961 11.914-54.125 31.25-11.168 19.336-11.168 43.164 0 62.5 11.164 19.336 31.797 31.25 54.125 31.25z"/>
      <path d="m1050 137.5h-900c-22.328 0-42.961 11.914-54.125 31.25-11.168 19.336-11.168 43.164 0 62.5 11.164 19.336 31.797 31.25 54.125 31.25h900c22.328 0 42.961-11.914 54.125-31.25 11.168-19.336 11.168-43.164 0-62.5-11.164-19.336-31.797-31.25-54.125-31.25z"/>
      <path d="m1050 787.5c-16.586-0.046875-32.5 6.5469-44.191 18.309l-43.309 43.309v-349.12c0-22.328-11.914-42.961-31.25-54.125-19.336-11.168-43.164-11.168-62.5 0-19.336 11.164-31.25 31.797-31.25 54.125v349.12l-43.309-43.309v-0.003906c-11.715-11.754-27.621-18.371-44.215-18.387s-32.516 6.5703-44.25 18.305c-11.734 11.734-18.32 27.656-18.305 44.25s6.6328 32.5 18.387 44.215l150 150c11.719 11.723 27.617 18.309 44.191 18.309s32.473-6.5859 44.191-18.309l150-150c11.715-11.723 18.301-27.617 18.301-44.191s-6.5859-32.473-18.305-44.191-27.613-18.305-44.188-18.309z"/>
    </svg>
  )
}

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

  const [viewTab, setViewTab] = useState('conflicts') // 'conflicts' | 'auto-rules'

  const [conflicts, setConflicts] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [timeRange, setTimeRange] = useState(TIME_RANGES[2])
  const [statusFilter, setStatusFilter] = useState('open')
  const [sortBy, setSortBy] = useState('recent')
  const [domainFilter, setDomainFilter] = useState('all')
  const [expanded, setExpanded] = useState({})

  // Rule issues
  const [ruleIssues, setRuleIssues] = useState([])

  // Resolutions map
  const [resolutions, setResolutions] = useState({}) // keyed by conflict_id

  // Modals
  const [resolveModalKey, setResolveModalKey] = useState(null)
  const [resolveNote, setResolveNote] = useState('')
  const [autoResolveDays, setAutoResolveDays] = useState('')
  const [flagModalKey, setFlagModalKey] = useState(null)
  const [flagDescription, setFlagDescription] = useState('')

  // Three-dot menu state
  const [openMenu, setOpenMenu] = useState(null) // stores the groupKey
  const [menuPos, setMenuPos] = useState({ top: 0, right: 0 })
  const menuRef = useRef(null)

  // Allow value animation state
  const [allowedKeys, setAllowedKeys] = useState({}) // groupKey → 'success' | 'fading' | 'gone'

  // Auto-resolve rules management
  const [autoRules, setAutoRules] = useState([])
  const [autoRulesLoading, setAutoRulesLoading] = useState(false)
  const [autoRuleCounts, setAutoRuleCounts] = useState({}) // ruleId → resolved count
  const [editRuleModal, setEditRuleModal] = useState(null) // rule object
  const [extendDays, setExtendDays] = useState('')

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
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        // Keep the most recent resolution per conflict_id
        const map = {}
        ;(data || []).forEach(r => {
          if (!map[r.conflict_id]) map[r.conflict_id] = r
        })
        setResolutions(map)
      })
  }, [currentOrg?.id])

  useEffect(() => {
    if (currentOrg?.id && viewTab === 'auto-rules') loadAutoRules()
  }, [currentOrg?.id, viewTab])

  async function loadAutoRules() {
    setAutoRulesLoading(true)
    try {
      const { data } = await supabase
        .from('conflict_resolution_rules')
        .select('*')
        .eq('organization_id', currentOrg.id)
        .order('created_at', { ascending: false })
      setAutoRules(data || [])

      // Load resolved counts per parameter:value key
      const { data: resData } = await supabase
        .from('conflict_resolutions')
        .select('conflict_id')
        .eq('organization_id', currentOrg.id)
        .eq('resolution_type', 'resolved')
      const counts = {}
      ;(resData || []).forEach(r => {
        counts[r.conflict_id] = (counts[r.conflict_id] || 0) + 1
      })
      setAutoRuleCounts(counts)
    } catch (e) {
      console.warn('Failed to load auto rules:', e)
    } finally {
      setAutoRulesLoading(false)
    }
  }

  async function handleDeleteAutoRule(ruleId) {
    if (!confirm('Delete this auto-resolve rule?')) return
    await supabase.from('conflict_resolution_rules').delete().eq('id', ruleId)
    setAutoRules(prev => prev.filter(r => r.id !== ruleId))
  }

  async function handleExtendAutoRule() {
    if (!editRuleModal || extendDays === '') return
    const newExpiry = extendDays === '0'
      ? null
      : new Date(Date.now() + parseInt(extendDays) * 86400000).toISOString()
    await supabase
      .from('conflict_resolution_rules')
      .update({ expires_at: newExpiry, auto_resolve_days: extendDays === '0' ? null : parseInt(extendDays) })
      .eq('id', editRuleModal.id)
    setAutoRules(prev => prev.map(r => r.id === editRuleModal.id ? { ...r, expires_at: newExpiry } : r))
    setEditRuleModal(null)
    setExtendDays('')
  }

  function timeRemaining(expiresAt) {
    if (!expiresAt) return 'Indefinite'
    const ms = new Date(expiresAt) - Date.now()
    if (ms <= 0) return 'Expired'
    const days = Math.floor(ms / 86400000)
    if (days >= 1) return `${days}d remaining`
    const hours = Math.floor(ms / 3600000)
    return `${hours}h remaining`
  }

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

  // Determine group status: resolved only if the most recent resolution is AFTER the most recent conflict,
  // or an active auto-resolve rule covers this group.
  function getGroupStatus(key, group) {
    const resolution = resolutions[key]
    const autoResolveRule = getAutoResolveRule(group.parameter, group.value, currentOrg?.resolutionRules || [])

    const mostRecentConflict = group.conflicts.reduce((latest, c) => {
      const ts = c.validationTimestamp
      const t = ts?.toDate?.() ?? (ts ? new Date(ts) : null)
      if (!t || isNaN(t)) return latest
      return !latest || t > latest ? t : latest
    }, null)

    // Active auto-resolve rule → treat as resolved (regardless of recurrence)
    if (autoResolveRule) return 'auto-resolved'

    if (!resolution) return 'open'
    const resolvedAt = resolution.created_at ? new Date(resolution.created_at) : null
    // If a new conflict occurred after the resolution, group is open again
    if (mostRecentConflict && resolvedAt && mostRecentConflict > resolvedAt) return 'open'
    return resolution.resolution_type === 'flagged' ? 'flagged' : 'resolved'
  }

  // Apply conflict threshold and status filter at group level
  const threshold = currentOrg?.conflictThreshold || 1
  const filteredGroupEntries = Object.entries(violationGroups).filter(([key, group]) => {
    if (group.conflicts.length < threshold) return false
    if (statusFilter !== 'all') {
      const status = getGroupStatus(key, group)
      if (statusFilter === 'open' && status !== 'open') return false
      if (statusFilter === 'resolved' && status === 'open') return false
      // auto-resolved counts as resolved
    }
    return true
  })

  // Sort entries
  const sortedGroupEntries = [...filteredGroupEntries].sort(([, a], [, b]) => {
    if (sortBy === 'volume') {
      return b.conflicts.length - a.conflicts.length
    }
    // Recent: sort by most recent validationTimestamp
    const getMostRecent = (group) => group.conflicts.reduce((latest, c) => {
      const ts = c.validationTimestamp
      const t = ts?.toDate?.() ?? (ts ? new Date(ts) : null)
      if (!t || isNaN(t)) return latest
      return !latest || t > latest ? t : latest
    }, null)
    const aRecent = getMostRecent(a)
    const bRecent = getMostRecent(b)
    if (!aRecent && !bRecent) return 0
    if (!aRecent) return 1
    if (!bRecent) return -1
    return bRecent - aRecent
  })

  const totalViolations = filtered.length
  const unresolved = filtered.filter(c => !c.resolved).length
  const groupCount = sortedGroupEntries.length

  const handleAllow = async (_conflict, reason) => {
    if (!config) return
    const { parameter, value } = reason
    const groupKey = `${parameter}:${value}`
    try {
      const { data: { user } } = await supabase.auth.getUser()
      // Fetch fresh config to avoid stale state
      const freshConfigResp = await fetch(
        `${import.meta.env.VITE_CONFIG_API_URL}?apiKey=${apiKey}`
      )
      if (!freshConfigResp.ok) throw new Error(`Config fetch failed: ${freshConfigResp.status}`)
      const freshConfig = await freshConfigResp.json()

      const currentValues = freshConfig.allowedValues?.[parameter] || []
      if (!currentValues.includes(value)) {
        const writeResp = await fetch(
          `${import.meta.env.VITE_CONFIG_API_URL}?apiKey=${apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              ...freshConfig,
              allowedValues: {
                ...freshConfig.allowedValues,
                [parameter]: [...currentValues, value]
              }
            })
          }
        )
        if (!writeResp.ok) throw new Error(`Config write failed: ${writeResp.status}`)
      }

      await supabase.from('conflict_resolutions').insert({
        organization_id: currentOrg.id,
        conflict_id: groupKey,
        resolution_type: 'allowed',
        resolved_by: user.id,
        resolved_by_email: user.email,
      })
      await writeAuditLog({
        organizationId: currentOrg.id,
        userId: user?.id,
        userEmail: user?.email,
        action: 'conflict_allowed',
        entityType: 'conflict',
        entityId: groupKey,
        metadata: { source: 'conflict_log', parameter, value },
      })
      await reloadConfig()
      // Show success then fade out
      setAllowedKeys(prev => ({ ...prev, [groupKey]: 'success' }))
      setTimeout(() => {
        setAllowedKeys(prev => ({ ...prev, [groupKey]: 'fading' }))
        setTimeout(() => setAllowedKeys(prev => ({ ...prev, [groupKey]: 'gone' })), 400)
      }, 1800)
    } catch (err) {
      console.error('Allow value failed:', err)
      alert(`Failed to allow value: ${err.message}`)
    }
  }

  const toggleExpand = (key) => setExpanded(p => ({ ...p, [key]: !p[key] }))

  function openResolveModal(groupKey) {
    setResolveModalKey(groupKey)
    setResolveNote('')
    setAutoResolveDays('')
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
      metadata: { note: resolveNote, autoResolveDays: autoResolveDays !== '' ? (autoResolveDays === '0' ? null : parseInt(autoResolveDays)) : undefined },
    })

    if (autoResolveDays !== '') {
      const expiresAt = autoResolveDays === '0'
        ? null
        : new Date(Date.now() + parseInt(autoResolveDays) * 86400000).toISOString()
      // Get parameter and value from the groupKey (format: "parameter:value")
      const [parameter, ...valueParts] = resolveModalKey.split(':')
      const value = valueParts.join(':')
      await supabase.from('conflict_resolution_rules').insert({
        organization_id: currentOrg.id,
        parameter,
        value,
        resolution_type: 'resolved',
        auto_resolve_days: autoResolveDays === '0' ? null : parseInt(autoResolveDays),
        created_by: user.id,
        created_by_email: user.email,
        expires_at: expiresAt
      })
    }

    setResolutions(prev => ({ ...prev, [resolveModalKey]: { resolution_type: 'resolved' } }))
    setResolveModalKey(null)
    setResolveNote('')
    setAutoResolveDays('')
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
      {/* View tab */}
      <div className="flex items-center justify-between">
        <div className="inline-flex bg-zinc-100 rounded-full p-1">
          {[['conflicts', 'Conflicts'], ['auto-rules', 'Auto-resolve rules']].map(([key, label]) => (
            <button
              key={key}
              onClick={() => setViewTab(key)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                viewTab === key ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'
              }`}
            >
              {label}
              {key === 'auto-rules' && autoRules.length > 0 && (
                <span className="ml-1.5 inline-flex items-center justify-center h-4 w-4 rounded-full bg-teal-600 text-white text-[10px] font-semibold">
                  {autoRules.length}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Auto-resolve rules view */}
      {viewTab === 'auto-rules' && (
        <div className="space-y-4">
          {autoRulesLoading ? (
            <div className="flex items-center justify-center py-16">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-teal-600" />
            </div>
          ) : autoRules.length === 0 ? (
            <EmptyState icon="⚙️" title="No auto-resolve rules" description="When you mark a conflict resolved with an auto-resolve duration, rules will appear here." />
          ) : (
            <div className="bg-white border border-zinc-200 overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-zinc-100">
                    <th className="text-left px-5 py-3 text-xs font-semibold text-zinc-400 uppercase tracking-wide">Parameter / Value</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-zinc-400 uppercase tracking-wide">Created by</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-zinc-400 uppercase tracking-wide">Created</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-zinc-400 uppercase tracking-wide">Expires</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-zinc-400 uppercase tracking-wide">Auto-resolved</th>
                    <th className="text-right px-5 py-3 text-xs font-semibold text-zinc-400 uppercase tracking-wide">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {autoRules.map(rule => {
                    const key = `${rule.parameter}:${rule.value}`
                    const count = autoRuleCounts[key] || 0
                    const isExpired = rule.expires_at && new Date(rule.expires_at) < new Date()
                    return (
                      <tr key={rule.id} className="border-b border-zinc-50 last:border-0">
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-mono text-zinc-700 bg-zinc-100 px-1.5 py-0.5">{rule.parameter}</span>
                            {rule.value && (
                              <>
                                <span className="text-xs text-zinc-400">=</span>
                                <span className="text-sm font-mono text-teal-700 bg-teal-50 px-1.5 py-0.5">{rule.value}</span>
                              </>
                            )}
                            {!rule.value && <span className="text-xs text-zinc-400 italic">any value</span>}
                          </div>
                        </td>
                        <td className="px-5 py-3 text-sm text-zinc-600">{rule.created_by_email || '—'}</td>
                        <td className="px-5 py-3 text-sm text-zinc-500">{rule.created_at ? new Date(rule.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}</td>
                        <td className="px-5 py-3">
                          <span className={`text-sm ${isExpired ? 'text-red-500' : 'text-zinc-600'}`}>
                            {timeRemaining(rule.expires_at)}
                          </span>
                          {rule.expires_at && !isExpired && (
                            <p className="text-xs text-zinc-400 mt-0.5">
                              {new Date(rule.expires_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                            </p>
                          )}
                        </td>
                        <td className="px-5 py-3">
                          <span className="text-sm font-semibold text-zinc-700">{count}</span>
                          <span className="text-xs text-zinc-400 ml-1">conflict{count !== 1 ? 's' : ''}</span>
                        </td>
                        <td className="px-5 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => { setEditRuleModal(rule); setExtendDays('') }}
                              className="text-xs text-teal-600 border border-teal-200 bg-teal-50 hover:bg-teal-100 px-3 py-1 transition-colors"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleDeleteAutoRule(rule.id)}
                              className="text-xs text-red-500 border border-red-200 bg-red-50 hover:bg-red-100 px-3 py-1 transition-colors"
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {viewTab === 'conflicts' && (<>
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
          value={domainFilter}
          onChange={e => setDomainFilter(e.target.value)}
          className="px-3 py-2 border border-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-600"
        >
          <option value="all">All domains</option>
          {uniqueDomains.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
        <Button variant="secondary" size="sm" onClick={loadConflicts}>Refresh</Button>
      </div>

      {/* Status + Sort pills */}
      <div className="flex items-center gap-3">
        <div className="inline-flex items-center bg-zinc-100 rounded-full p-1 gap-0.5">
          <span className="pl-2 pr-1 text-zinc-400"><FilterIcon /></span>
          {[
            { key: 'all', label: 'All' },
            { key: 'open', label: 'Open' },
            { key: 'resolved', label: 'Resolved' },
          ].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setStatusFilter(key)}
              className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                statusFilter === key ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="inline-flex items-center bg-zinc-100 rounded-full p-1 gap-0.5">
          <span className="pl-2 pr-1 text-zinc-400"><SortIcon /></span>
          {[
            { key: 'recent', label: 'Recent' },
            { key: 'volume', label: 'Volume' },
          ].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setSortBy(key)}
              className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                sortBy === key ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
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
      ) : sortedGroupEntries.length === 0 ? (
        <EmptyState icon="✅" title="No conflicts found" description="No UTM violations match your current filters." />
      ) : (
        <div className="space-y-2">
          {sortedGroupEntries.map(([key, group]) => {
            const isOpen = expanded[key]
            const occurrences = group.conflicts.length
            const groupStatus = getGroupStatus(key, group)
            const isResolved = groupStatus === 'resolved'
            const isFlagged = groupStatus === 'flagged'
            const isAutoResolved = groupStatus === 'auto-resolved'
            const allowState = allowedKeys[key]

            if (allowState === 'gone') return null

            // Most recent timestamp in group
            const mostRecent = group.conflicts.reduce((latest, c) => {
              const ts = c.validationTimestamp
              const t = ts?.toDate?.() ?? (ts ? new Date(ts) : null)
              if (!t || isNaN(t)) return latest
              return !latest || t > latest ? t : latest
            }, null)

            return (
              <div
                key={key}
                className="bg-white border border-zinc-200 overflow-hidden transition-opacity duration-400"
                style={{ opacity: allowState === 'fading' ? 0 : 1 }}
              >
                {allowState === 'success' && (
                  <div className="px-5 py-2 bg-teal-50 border-b border-teal-100 text-xs text-teal-700 font-medium">
                    ✓ Value added to allowed list — future events with this value will pass validation.
                  </div>
                )}
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
                    <p className="text-xs text-zinc-400 mt-1">
                      {occurrences} occurrence{occurrences !== 1 ? 's' : ''}
                      {mostRecent && <span className="ml-2">· Last: {formatTime(mostRecent.toISOString())}</span>}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0" onClick={e => e.stopPropagation()}>
                    <Badge variant="error">{occurrences}</Badge>

                    {isAutoResolved && (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-teal-50 text-teal-700">
                        Auto-resolved
                      </span>
                    )}
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

                    {!isResolved && !isFlagged && !isAutoResolved && (
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
                            onClick={e => {
                              const rect = e.currentTarget.getBoundingClientRect()
                              setMenuPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right })
                              setOpenMenu(prev => prev === key ? null : key)
                            }}
                            className="text-zinc-400 hover:text-zinc-600 px-2 py-1 border border-transparent hover:border-zinc-200 transition-colors text-base leading-none"
                            title="More options"
                          >
                            ⋯
                          </button>
                          {openMenu === key && (
                            <div
                              ref={menuRef}
                              style={{ top: menuPos.top, right: menuPos.right }}
                              className="fixed z-50 bg-white border border-zinc-200 shadow-sm min-w-[160px]"
                            >
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

      </>)}

      {/* Mark Resolved modal */}
      <Modal
        open={resolveModalKey !== null}
        onClose={() => { setResolveModalKey(null); setResolveNote(''); setAutoResolveDays('') }}
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
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">Auto-resolve future occurrences</label>
            <select value={autoResolveDays} onChange={e => setAutoResolveDays(e.target.value)}
              className="w-full px-3 py-2 border border-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-600">
              <option value="">Don't auto-resolve</option>
              <option value="7">7 days</option>
              <option value="14">14 days</option>
              <option value="30">30 days</option>
              <option value="60">60 days</option>
              <option value="90">90 days</option>
              <option value="0">Indefinitely</option>
            </select>
            <p className="text-xs text-zinc-400 mt-1">New occurrences within this window will be auto-resolved</p>
          </div>
          <div className="flex justify-end gap-2">
            <button
              onClick={() => { setResolveModalKey(null); setResolveNote(''); setAutoResolveDays('') }}
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

      {/* Edit auto-resolve rule modal */}
      <Modal
        open={editRuleModal !== null}
        onClose={() => { setEditRuleModal(null); setExtendDays('') }}
        title="Edit auto-resolve rule"
      >
        {editRuleModal && (
          <div className="space-y-4">
            <div className="bg-zinc-50 border border-zinc-200 p-3 text-sm">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono text-zinc-700 bg-zinc-100 px-1.5 py-0.5">{editRuleModal.parameter}</span>
                {editRuleModal.value && (
                  <>
                    <span className="text-zinc-400">=</span>
                    <span className="font-mono text-teal-700 bg-teal-50 px-1.5 py-0.5">{editRuleModal.value}</span>
                  </>
                )}
              </div>
              <p className="text-xs text-zinc-500 mt-1.5">
                Created by {editRuleModal.created_by_email || 'unknown'} on {editRuleModal.created_at ? new Date(editRuleModal.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
              </p>
              <p className="text-xs text-zinc-500 mt-0.5">
                Current expiry: <span className="font-medium">{timeRemaining(editRuleModal.expires_at)}</span>
                {editRuleModal.expires_at && ` (${new Date(editRuleModal.expires_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })})`}
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">Set new duration</label>
              <select value={extendDays} onChange={e => setExtendDays(e.target.value)}
                className="w-full px-3 py-2 border border-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-600">
                <option value="">Select duration…</option>
                <option value="7">7 days from now</option>
                <option value="14">14 days from now</option>
                <option value="30">30 days from now</option>
                <option value="60">60 days from now</option>
                <option value="90">90 days from now</option>
                <option value="0">Indefinitely</option>
              </select>
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => { setEditRuleModal(null); setExtendDays('') }}
                className="bg-white text-zinc-700 border border-zinc-200 rounded-full px-4 py-2 text-sm hover:bg-zinc-50"
              >
                Cancel
              </button>
              <button
                onClick={handleExtendAutoRule}
                disabled={extendDays === ''}
                className="bg-teal-600 text-white rounded-full px-4 py-2 text-sm font-medium hover:bg-teal-700 disabled:opacity-50"
              >
                Save
              </button>
            </div>
          </div>
        )}
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
