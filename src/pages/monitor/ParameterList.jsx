import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { PlusIcon, PencilIcon, TrashIcon, EyeIcon } from '@heroicons/react/24/outline'
import { useConfiguration } from '../../hooks/useConfiguration'
import { useOrg } from '../../contexts/OrgContext'
import { saveConfiguration } from '../../lib/api'
import { supabase } from '../../lib/supabase'
import Modal from '../../components/ui/Modal'
import Badge from '../../components/ui/Badge'

function Spinner() {
  return (
    <div className="flex items-center justify-center py-16">
      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-teal-600" />
    </div>
  )
}

function EmptyRow({ colSpan, message }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-5 py-16 text-center">
        <p className="text-sm text-zinc-400">{message}</p>
      </td>
    </tr>
  )
}

function getParamStatus(paramData) {
  if (paramData.status === 'draft') return 'draft'
  if (paramData.active) return 'active'
  return 'paused'
}

function fmtDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function Toggle({ checked, onChange, disabled }) {
  return (
    <button
      onClick={e => { e.stopPropagation(); onChange(!checked) }}
      disabled={disabled}
      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${checked ? 'bg-teal-600' : 'bg-zinc-300'} ${disabled ? 'opacity-50' : ''}`}
    >
      <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-4.5' : 'translate-x-0.5'}`} />
    </button>
  )
}

const iconBtn = 'p-1 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-colors'
const iconBtnDanger = 'p-1 text-zinc-400 hover:text-red-500 hover:bg-red-50 transition-colors'

export default function MonitorSettings() {
  const location = useLocation()
  const navigate = useNavigate()
  const { config, loading, reload } = useConfiguration()
  const { currentOrg, loading: orgLoading } = useOrg()

  const tab = location.pathname.startsWith('/monitor/rules') ? 'rules' : 'params'
  // Check if we should show issues tab
  const isIssuesTab = location.search?.includes('tab=issues') || location.hash === '#issues'

  const [activeTab, setActiveTab] = useState(tab === 'rules' && location.search?.includes('tab=issues') ? 'issues' : tab)

  const [showAdd, setShowAdd] = useState(false)
  const [newParamName, setNewParamName] = useState('')
  const [adding, setAdding] = useState(false)
  const [addError, setAddError] = useState('')

  // Rule issues state
  const [ruleIssues, setRuleIssues] = useState([])
  const [issuesLoading, setIssuesLoading] = useState(false)

  useEffect(() => {
    setActiveTab(tab === 'rules' && location.search?.includes('tab=issues') ? 'issues' : tab)
  }, [tab, location.search])

  useEffect(() => {
    if (currentOrg?.id) {
      loadRuleIssues()
    }
  }, [currentOrg?.id])

  async function loadRuleIssues() {
    setIssuesLoading(true)
    try {
      const { data } = await supabase
        .from('rule_issues')
        .select('*')
        .eq('organization_id', currentOrg.id)
        .is('resolved_at', null)
      setRuleIssues(data || [])
    } catch (e) {
      console.warn('Failed to load rule issues:', e)
    } finally {
      setIssuesLoading(false)
    }
  }

  async function dismissIssue(issueId) {
    await supabase.from('rule_issues').update({ resolved_at: new Date().toISOString() }).eq('id', issueId)
    setRuleIssues(prev => prev.filter(i => i.id !== issueId))
  }

  if (orgLoading || loading) return <Spinner />
  if (!currentOrg) return <div className="text-center py-16 text-sm text-zinc-500">No organization found.</div>

  const parameters = config?.monitoredParameters || {}
  const rules = config?.conditionalRules || []

  // Helper: find rules that use a param as anchor or conditional
  function getRulesForParam(paramName) {
    return rules.filter(rule =>
      rule.anchors?.some(a => a.parameter === paramName) ||
      rule.anchor?.parameter === paramName ||
      paramName in (rule.conditionals || {})
    )
  }

  async function handleAddParameter() {
    const name = newParamName.trim().toLowerCase()
    if (!name) { setAddError('Name is required'); return }
    if (parameters[name]) { setAddError('Parameter already exists'); return }
    setAdding(true)
    setAddError('')
    try {
      await saveConfiguration(currentOrg.firestore_api_key, {
        ...config,
        monitoredParameters: {
          ...parameters,
          [name]: { active: false, status: 'draft', created: new Date().toISOString() },
        },
      })
      await reload()
      setShowAdd(false)
      setNewParamName('')
      navigate(`/monitor/parameters/${name}`)
    } catch (err) {
      setAddError(err.message)
    } finally {
      setAdding(false)
    }
  }

  async function handleToggleParam(name, data) {
    const isActive = getParamStatus(data) === 'active'
    await saveConfiguration(currentOrg.firestore_api_key, {
      ...config,
      monitoredParameters: {
        ...parameters,
        [name]: { ...data, active: !isActive, status: undefined, updated: new Date().toISOString() },
      },
    })
    await reload()
  }

  async function handleDeleteParam(name) {
    if (!confirm(`Delete parameter "${name}"?`)) return
    const { [name]: _, ...restParams } = parameters
    const { [name]: __, ...restValues } = config?.allowedValues || {}
    const { [name]: ___, ...restCasing } = config?.casingRules || {}
    await saveConfiguration(currentOrg.firestore_api_key, {
      ...config,
      monitoredParameters: restParams,
      allowedValues: restValues,
      casingRules: restCasing,
    })
    await reload()
  }

  async function handleDeleteRule(ruleId) {
    if (!confirm('Delete this rule?')) return
    await saveConfiguration(currentOrg.firestore_api_key, {
      ...config,
      conditionalRules: rules.filter(r => r.id !== ruleId),
    })
    await reload()
  }

  async function handleToggleRule(ruleId, currentActive) {
    await saveConfiguration(currentOrg.firestore_api_key, {
      ...config,
      conditionalRules: rules.map(r => r.id === ruleId ? { ...r, active: !currentActive } : r),
    })
    await reload()
  }

  // Anchor summary text for a rule
  function anchorSummary(rule) {
    const anchors = rule.anchors || (rule.anchor ? [rule.anchor] : [])
    if (anchors.length === 0) return '—'
    const logic = rule.anchorLogic || 'AND'
    return anchors.map(a => `${a.parameter} = ${a.value}`).join(` ${logic} `)
  }

  const tabs = [
    { key: 'params', label: 'Parameters', href: '/monitor/parameters' },
    { key: 'rules', label: 'Conditional Rules', href: '/monitor/rules' },
    { key: 'issues', label: 'Rule Issues', href: '/monitor/rules' },
  ]

  return (
    <div className="space-y-4">
      {/* Pill toggle + action button */}
      <div className="flex items-center justify-between">
        <div className="inline-flex bg-zinc-100 rounded-full p-1">
          {tabs.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => {
                setActiveTab(key)
                if (key === 'params') navigate('/monitor/parameters')
                else navigate('/monitor/rules')
              }}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors relative ${
                activeTab === key ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'
              }`}
            >
              {label}
              {key === 'issues' && ruleIssues.length > 0 && (
                <span className="ml-1.5 inline-flex items-center justify-center h-4 w-4 rounded-full bg-amber-500 text-white text-[10px] font-semibold">
                  {ruleIssues.length}
                </span>
              )}
            </button>
          ))}
        </div>
        {activeTab === 'params' ? (
          <button
            onClick={() => setShowAdd(true)}
            className="inline-flex items-center gap-1.5 bg-teal-600 text-white rounded-full px-4 py-2 text-sm font-medium hover:bg-teal-700 transition-colors"
          >
            <PlusIcon className="h-4 w-4" /> Add parameter
          </button>
        ) : activeTab === 'rules' ? (
          <button
            onClick={() => navigate('/monitor/rules/new')}
            className="inline-flex items-center gap-1.5 bg-teal-600 text-white rounded-full px-4 py-2 text-sm font-medium hover:bg-teal-700 transition-colors"
          >
            <PlusIcon className="h-4 w-4" /> Create rule
          </button>
        ) : null}
      </div>

      {/* Parameters tab */}
      {activeTab === 'params' && (
        <div className="bg-white border border-zinc-200 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-zinc-100">
                <th className="text-left px-5 py-3 text-xs font-semibold text-zinc-400 uppercase tracking-wide w-10">Toggle</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-zinc-400 uppercase tracking-wide">Parameter</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-zinc-400 uppercase tracking-wide">Allowed values</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-zinc-400 uppercase tracking-wide">In rules</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-zinc-400 uppercase tracking-wide">Applied domains</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-zinc-400 uppercase tracking-wide">Last modified</th>
                <th className="text-right px-5 py-3 text-xs font-semibold text-zinc-400 uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody>
              {Object.keys(parameters).length === 0 ? (
                <EmptyRow colSpan={7} message="No parameters yet. Add your first UTM parameter to get started." />
              ) : (
                Object.entries(parameters).map(([name, data]) => {
                  const status = getParamStatus(data)
                  const isActive = status === 'active'
                  const valueCount = config?.allowedValues?.[name]?.length || 0
                  const relatedRules = getRulesForParam(name)
                  const domains = data.appliedDomains
                  const showAllDomains = !domains || domains.includes('all') || domains.length === 0
                  return (
                    <tr
                      key={name}
                      onClick={() => navigate(`/monitor/parameters/${name}`)}
                      className="border-b border-zinc-50 hover:bg-zinc-50 cursor-pointer"
                    >
                      <td className="px-5 py-3" onClick={e => e.stopPropagation()}>
                        <Toggle
                          checked={isActive}
                          onChange={() => handleToggleParam(name, data)}
                        />
                      </td>
                      <td className="px-5 py-3">
                        <span className="font-mono font-medium text-zinc-900 text-sm">{name}</span>
                      </td>
                      <td className="px-5 py-3 text-sm text-zinc-400">
                        {valueCount === 0 ? 'All values' : `${valueCount} value${valueCount !== 1 ? 's' : ''}`}
                      </td>
                      <td className="px-5 py-3" onClick={e => e.stopPropagation()}>
                        <div className="flex flex-wrap gap-1">
                          {relatedRules.length === 0 ? (
                            <span className="text-xs text-zinc-300">—</span>
                          ) : (
                            relatedRules.map(rule => (
                              <span
                                key={rule.id}
                                className="inline-flex items-center text-xs border border-teal-200 text-teal-700 bg-teal-50 rounded-full px-2 py-0.5 cursor-pointer"
                                onClick={e => { e.stopPropagation(); navigate(`/monitor/rules/${rule.id}`) }}
                              >
                                {(rule.name || `Rule ${rule.id?.slice(0, 6)}`).slice(0, 20)}
                              </span>
                            ))
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-3 text-sm text-zinc-400">
                        {showAllDomains ? (
                          <span className="text-zinc-300 text-xs">All domains</span>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {domains.map(d => (
                              <span key={d} className="inline-flex items-center text-xs bg-zinc-100 text-zinc-600 rounded-full px-2 py-0.5">{d}</span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        <p className="text-sm text-zinc-400">{fmtDate(data.lastModified || data.updated || data.created)}</p>
                        {data.lastModifiedBy?.email && (
                          <p className="text-xs text-zinc-300">{data.lastModifiedBy.email}</p>
                        )}
                      </td>
                      <td className="px-5 py-3" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => navigate(`/monitor/parameters/${name}`)}
                            className={iconBtn}
                            title="Edit"
                          >
                            <PencilIcon className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteParam(name)}
                            className={iconBtnDanger}
                            title="Delete"
                          >
                            <TrashIcon className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Conditional Rules tab */}
      {activeTab === 'rules' && (
        <div className="bg-white border border-zinc-200 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-zinc-100">
                <th className="text-left px-5 py-3 text-xs font-semibold text-zinc-400 uppercase tracking-wide w-10">Toggle</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-zinc-400 uppercase tracking-wide">Rule name</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-zinc-400 uppercase tracking-wide">Anchor(s)</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-zinc-400 uppercase tracking-wide">Conditionals</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-zinc-400 uppercase tracking-wide">Applied domains</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-zinc-400 uppercase tracking-wide">Last modified</th>
                <th className="text-right px-5 py-3 text-xs font-semibold text-zinc-400 uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rules.length === 0 ? (
                <EmptyRow colSpan={7} message="No conditional rules yet. Create one to get started." />
              ) : (
                rules.map(rule => {
                  const domains = rule.appliedDomains
                  const showAllDomains = !domains || domains.includes('all') || domains.length === 0
                  return (
                    <tr
                      key={rule.id}
                      onClick={() => navigate(`/monitor/rules/${rule.id}`)}
                      className="border-b border-zinc-50 hover:bg-zinc-50 cursor-pointer"
                    >
                      <td className="px-5 py-3" onClick={e => e.stopPropagation()}>
                        <Toggle
                          checked={!!rule.active}
                          onChange={() => handleToggleRule(rule.id, rule.active)}
                        />
                      </td>
                      <td className="px-5 py-3 text-sm font-medium text-zinc-900">
                        {rule.name || `Rule ${rule.id?.slice(0, 6)}`}
                      </td>
                      <td className="px-5 py-3 text-sm text-zinc-500 font-mono">
                        {anchorSummary(rule)}
                      </td>
                      <td className="px-5 py-3 text-sm text-zinc-400">
                        {Object.keys(rule.conditionals || {}).join(', ') || '—'}
                      </td>
                      <td className="px-5 py-3 text-sm text-zinc-400">
                        {showAllDomains ? (
                          <span className="text-zinc-300 text-xs">All domains</span>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {domains.map(d => (
                              <span key={d} className="inline-flex items-center text-xs bg-zinc-100 text-zinc-600 rounded-full px-2 py-0.5">{d}</span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        <p className="text-sm text-zinc-400">{fmtDate(rule.lastModified || rule.updatedAt)}</p>
                        {rule.lastModifiedBy?.email && (
                          <p className="text-xs text-zinc-300">{rule.lastModifiedBy.email}</p>
                        )}
                      </td>
                      <td className="px-5 py-3" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={e => { e.stopPropagation(); navigate(`/monitor/rules/${rule.id}`) }}
                            className={iconBtn}
                            title="View"
                          >
                            <EyeIcon className="h-4 w-4" />
                          </button>
                          <button
                            onClick={e => { e.stopPropagation(); navigate(`/monitor/rules/${rule.id}/edit`) }}
                            className={iconBtn}
                            title="Edit"
                          >
                            <PencilIcon className="h-4 w-4" />
                          </button>
                          <button
                            onClick={e => { e.stopPropagation(); handleDeleteRule(rule.id) }}
                            className={iconBtnDanger}
                            title="Delete"
                          >
                            <TrashIcon className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Rule Issues tab */}
      {activeTab === 'issues' && (
        <div className="space-y-4">
          {issuesLoading ? (
            <Spinner />
          ) : ruleIssues.length === 0 ? (
            <div className="bg-white border border-zinc-200 p-12 text-center">
              <p className="text-3xl mb-2">✅</p>
              <p className="text-sm font-medium text-zinc-900">No rule conflicts detected</p>
              <p className="text-xs text-zinc-400 mt-1">Your conditional rules are consistent.</p>
            </div>
          ) : (
            <div className="bg-white border border-zinc-200 overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-zinc-100">
                    <th className="text-left px-5 py-3 text-xs font-semibold text-zinc-400 uppercase tracking-wide">Description</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-zinc-400 uppercase tracking-wide">Severity</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-zinc-400 uppercase tracking-wide">Detected</th>
                    <th className="text-right px-5 py-3 text-xs font-semibold text-zinc-400 uppercase tracking-wide">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {ruleIssues.map(issue => (
                    <tr key={issue.id} className="border-b border-zinc-50">
                      <td className="px-5 py-3 text-sm text-zinc-700">{issue.description}</td>
                      <td className="px-5 py-3">
                        <Badge variant="paused">{issue.severity || 'warning'}</Badge>
                      </td>
                      <td className="px-5 py-3 text-sm text-zinc-400">
                        {issue.created_at ? new Date(issue.created_at).toLocaleDateString() : '—'}
                      </td>
                      <td className="px-5 py-3 text-right">
                        <button
                          onClick={() => dismissIssue(issue.id)}
                          className="text-xs text-zinc-500 hover:text-zinc-800 border border-zinc-200 px-3 py-1 transition-colors"
                        >
                          Dismiss
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Add parameter modal */}
      <Modal open={showAdd} onClose={() => { setShowAdd(false); setNewParamName(''); setAddError('') }} title="Add parameter">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">Parameter name</label>
            <input
              type="text"
              value={newParamName}
              onChange={e => setNewParamName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAddParameter()}
              className="w-full px-3 py-2 border border-zinc-200 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-teal-600"
              placeholder="e.g. utm_source"
              autoFocus
            />
            {addError && <p className="text-xs text-red-600 mt-1">{addError}</p>}
            <p className="text-xs text-zinc-400 mt-1">Added as Draft — activate once you've set allowed values.</p>
          </div>
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setShowAdd(false)}
              className="bg-white text-zinc-700 border border-zinc-200 rounded-full px-4 py-2 text-sm font-medium hover:bg-zinc-50"
            >
              Cancel
            </button>
            <button
              onClick={handleAddParameter}
              disabled={adding}
              className="bg-teal-600 text-white rounded-full px-4 py-2 text-sm font-medium hover:bg-teal-700 disabled:opacity-50"
            >
              {adding ? 'Adding…' : 'Add parameter'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
