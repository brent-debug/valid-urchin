import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeftIcon, PlusIcon, TrashIcon } from '@heroicons/react/24/outline'
import { useConfiguration } from '../../hooks/useConfiguration'
import { useOrg } from '../../contexts/OrgContext'
import { saveConfiguration } from '../../lib/api'
import { supabase } from '../../lib/supabase'
import { detectRuleConflicts } from '../../lib/ruleConflictDetector'
import { writeAuditLog } from '../../lib/auditLog'

function Spinner() {
  return (
    <div className="flex items-center justify-center py-16">
      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-teal-600" />
    </div>
  )
}

export default function ConditionalRuleEditor() {
  const { ruleId } = useParams()
  const navigate = useNavigate()
  const { config, loading, reload } = useConfiguration()
  const { currentOrg, loading: orgLoading } = useOrg()
  const isEdit = Boolean(ruleId)

  const [ruleName, setRuleName] = useState('')
  const [anchors, setAnchors] = useState([{ parameter: '', value: '' }])
  const [anchorLogic, setAnchorLogic] = useState('AND')
  const [conditionals, setConditionals] = useState({})
  const [addingParam, setAddingParam] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Applied domains
  const [availableDomains, setAvailableDomains] = useState([])
  const [selectedDomains, setSelectedDomains] = useState(['all'])
  const [domainInheritance, setDomainInheritance] = useState('inherit')

  useEffect(() => {
    if (!config || !ruleId) return
    const rule = (config.conditionalRules || []).find(r => r.id === ruleId)
    if (!rule) return
    setRuleName(rule.name || '')
    const ruleAnchors = rule.anchors || (rule.anchor ? [rule.anchor] : [{ parameter: '', value: '' }])
    setAnchors(ruleAnchors.length > 0 ? ruleAnchors : [{ parameter: '', value: '' }])
    setAnchorLogic(rule.anchorLogic || 'AND')
    setConditionals(rule.conditionals || {})
    const domains = rule.appliedDomains
    setSelectedDomains(domains && domains.length > 0 ? domains : ['all'])
    setDomainInheritance(rule.domainInheritance || 'inherit')
  }, [config, ruleId])

  useEffect(() => {
    if (currentOrg?.id) {
      fetchDomains()
    }
  }, [currentOrg?.id])

  async function fetchDomains() {
    try {
      const { data } = await supabase
        .from('allowed_domains')
        .select('domain')
        .eq('organization_id', currentOrg.id)
      setAvailableDomains((data || []).map(d => d.domain))
    } catch (e) {
      console.warn('Failed to fetch domains:', e)
    }
  }

  if (orgLoading || loading) return <Spinner />
  if (!currentOrg) return <div className="text-center py-16 text-sm text-zinc-400">No organization found.</div>

  const parameters = Object.keys(config?.monitoredParameters || {})

  const handleAddConditional = () => {
    if (!addingParam || conditionals[addingParam]) return
    setConditionals(prev => ({ ...prev, [addingParam]: [] }))
    setAddingParam('')
  }

  const handleToggleValue = (param, value) => {
    setConditionals(prev => {
      const current = prev[param] || []
      const updated = current.includes(value)
        ? current.filter(v => v !== value)
        : [...current, value]
      return { ...prev, [param]: updated }
    })
  }

  const handleRemoveConditional = (param) => {
    setConditionals(prev => {
      const next = { ...prev }
      delete next[param]
      return next
    })
  }

  // Anchor management
  const handleAddAnchor = () => {
    setAnchors(prev => [...prev, { parameter: '', value: '' }])
  }

  const handleRemoveAnchor = (idx) => {
    setAnchors(prev => prev.filter((_, i) => i !== idx))
  }

  const handleAnchorChange = (idx, field, value) => {
    setAnchors(prev => prev.map((a, i) => i === idx ? { ...a, [field]: value } : a))
  }

  // Domain toggle
  function toggleDomain(domain) {
    if (domain === 'all') {
      setSelectedDomains(['all'])
    } else {
      setSelectedDomains(prev => {
        const withoutAll = prev.filter(d => d !== 'all')
        if (withoutAll.includes(domain)) {
          const next = withoutAll.filter(d => d !== domain)
          return next.length === 0 ? ['all'] : next
        } else {
          return [...withoutAll, domain]
        }
      })
    }
  }

  const handleSave = async () => {
    const validAnchors = anchors.filter(a => a.parameter && a.value)
    if (validAnchors.length === 0) { setError('Add at least one anchor condition with parameter and value'); return }
    if (Object.keys(conditionals).length === 0) { setError('Add at least one conditional parameter'); return }
    setSaving(true)
    setError('')
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const existingRules = config?.conditionalRules || []
      const existingRule = isEdit ? existingRules.find(r => r.id === ruleId) : null

      const newRule = {
        id: ruleId || crypto.randomUUID(),
        name: ruleName || `When ${validAnchors[0].parameter} = ${validAnchors[0].value}`,
        active: existingRule?.active ?? true,
        anchor: validAnchors[0], // backward compat
        anchors: validAnchors,
        anchorLogic,
        conditionals,
        appliedDomains: selectedDomains,
        domainInheritance,
        lastModified: new Date().toISOString(),
        lastModifiedBy: { userId: user?.id, email: user?.email },
        createdAt: isEdit
          ? existingRule?.createdAt || new Date().toISOString()
          : new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }

      if (!isEdit) {
        newRule.created = new Date().toISOString()
        newRule.createdBy = { userId: user?.id, email: user?.email }
      } else if (existingRule?.created) {
        newRule.created = existingRule.created
        newRule.createdBy = existingRule.createdBy
      }

      const updatedRules = isEdit
        ? existingRules.map(r => r.id === ruleId ? newRule : r)
        : [...existingRules, newRule]

      const updatedConfig = { ...config, conditionalRules: updatedRules }
      await saveConfiguration(currentOrg.firestore_api_key, updatedConfig)
      await reload()

      // Detect and write conflicts
      try {
        const allRules = updatedConfig.conditionalRules || []
        const issues = detectRuleConflicts(allRules, updatedConfig.allowedValues || {})
        await supabase.from('rule_issues').delete().eq('organization_id', currentOrg.id).is('resolved_at', null)
        if (issues.length > 0) {
          await supabase.from('rule_issues').insert(issues.map(issue => ({
            organization_id: currentOrg.id,
            issue_type: issue.type,
            severity: issue.severity,
            description: issue.description,
            affected_rules: issue.affectedRules,
          })))
        }
      } catch (conflictErr) {
        console.warn('Conflict detection failed:', conflictErr)
      }

      await writeAuditLog({
        organizationId: currentOrg.id,
        userId: user?.id,
        userEmail: user?.email,
        action: isEdit ? 'rule_updated' : 'rule_created',
        entityType: 'rule',
        entityName: newRule.name,
        entityId: newRule.id,
        metadata: { source: 'rule_editor' },
      })

      navigate('/monitor/rules')
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const showDomainInheritance = !selectedDomains.includes('all')

  // Live summary
  const validAnchors = anchors.filter(a => a.parameter && a.value)
  const liveSummary = validAnchors.length > 0
    ? validAnchors.map(a => `${a.parameter} = "${a.value}"`).join(` ${anchorLogic} `)
    : null

  return (
    <div className="max-w-2xl space-y-6">
      {/* Header */}
      <button
        onClick={() => navigate('/monitor/rules')}
        className="flex items-center gap-1.5 text-sm text-zinc-400 hover:text-zinc-700 transition-colors"
      >
        <ArrowLeftIcon className="h-4 w-4" /> Conditional Rules
      </button>
      <h1 className="text-xl font-semibold text-zinc-900">{isEdit ? 'Edit rule' : 'Create rule'}</h1>

      {/* Rule name */}
      <div className="bg-white border border-zinc-200 p-5 space-y-3">
        <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">Rule name</p>
        <input
          type="text"
          value={ruleName}
          onChange={e => setRuleName(e.target.value)}
          placeholder="e.g. Google paid traffic"
          className="w-full px-3 py-2 border border-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-600"
        />
      </div>

      {/* Anchor conditions (multiple) */}
      <div className="bg-white border border-zinc-200 p-5 space-y-4">
        <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">Anchor conditions</p>
        <p className="text-xs text-zinc-400">Define one or more conditions. The rule triggers when these are matched.</p>

        <div className="space-y-3">
          {anchors.map((anchor, idx) => (
            <div key={idx}>
              {idx > 0 && (
                <div className="flex items-center gap-2 my-2">
                  <div className="flex-1 border-t border-zinc-100" />
                  <button
                    onClick={() => setAnchorLogic(prev => prev === 'AND' ? 'OR' : 'AND')}
                    className="text-xs font-semibold text-zinc-500 bg-zinc-100 border border-zinc-200 px-2 py-0.5 hover:bg-zinc-200 transition-colors"
                  >
                    {anchorLogic}
                  </button>
                  <div className="flex-1 border-t border-zinc-100" />
                </div>
              )}
              <div className="flex gap-2 items-start">
                <div className="flex-1 grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs text-zinc-500 mb-1">Parameter</label>
                    <select
                      value={anchor.parameter}
                      onChange={e => handleAnchorChange(idx, 'parameter', e.target.value)}
                      className="w-full px-3 py-2 border border-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-600"
                    >
                      <option value="">Select…</option>
                      {parameters.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-zinc-500 mb-1">Value</label>
                    {(config?.allowedValues?.[anchor.parameter] || []).length > 0 ? (
                      <select
                        value={anchor.value}
                        onChange={e => handleAnchorChange(idx, 'value', e.target.value)}
                        className="w-full px-3 py-2 border border-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-600"
                      >
                        <option value="">Select…</option>
                        {(config?.allowedValues?.[anchor.parameter] || []).map(v => <option key={v} value={v}>{v}</option>)}
                      </select>
                    ) : (
                      <input
                        type="text"
                        value={anchor.value}
                        onChange={e => handleAnchorChange(idx, 'value', e.target.value)}
                        placeholder="Type value…"
                        className="w-full px-3 py-2 border border-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-600"
                      />
                    )}
                  </div>
                </div>
                {anchors.length > 1 && (
                  <button
                    onClick={() => handleRemoveAnchor(idx)}
                    className="mt-5 p-1.5 text-zinc-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                  >
                    ×
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        <button
          onClick={handleAddAnchor}
          className="text-xs text-teal-600 hover:text-teal-700 transition-colors"
        >
          + Add condition
        </button>

        {/* Live summary pill */}
        {liveSummary && (
          <div className="inline-flex items-center bg-teal-50 text-teal-700 rounded-full px-3 py-1 text-sm">
            When {liveSummary}
          </div>
        )}
      </div>

      {/* Conditional parameters */}
      <div className="bg-white border border-zinc-200 p-5 space-y-4">
        <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">Conditional parameters</p>
        <p className="text-xs text-zinc-400">These parameters must match their allowed values when the anchor condition is true.</p>

        <div className="flex gap-2">
          <select
            value={addingParam}
            onChange={e => setAddingParam(e.target.value)}
            className="flex-1 px-3 py-2 border border-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-600"
          >
            <option value="">Add a parameter…</option>
            {parameters
              .filter(p => !anchors.some(a => a.parameter === p) && !conditionals[p])
              .map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          <button
            onClick={handleAddConditional}
            disabled={!addingParam}
            className="bg-teal-600 text-white rounded-full px-4 py-2 text-sm font-medium hover:bg-teal-700 disabled:opacity-40 transition-colors"
          >
            <PlusIcon className="h-4 w-4" />
          </button>
        </div>

        {Object.keys(conditionals).length === 0 ? (
          <div className="border-2 border-dashed border-zinc-200 py-8 text-center">
            <p className="text-sm text-zinc-400">No conditional parameters added yet</p>
          </div>
        ) : (
          <div className="space-y-3">
            {Object.entries(conditionals).map(([param, selectedValues]) => {
              const available = config?.allowedValues?.[param] || []
              return (
                <div key={param} className="border border-zinc-200 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-mono font-medium text-zinc-900">{param}</span>
                    <button
                      onClick={() => handleRemoveConditional(param)}
                      className="p-1 text-zinc-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                    >
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  </div>
                  {available.length === 0 ? (
                    <p className="text-xs text-amber-600">No allowed values configured for this parameter. Add them in the parameter editor first.</p>
                  ) : (
                    <div className="flex flex-wrap gap-x-4 gap-y-2">
                      {available.map(val => (
                        <label key={val} className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={selectedValues.includes(val)}
                            onChange={() => handleToggleValue(param, val)}
                            className="h-3.5 w-3.5 border-zinc-300 text-teal-600 focus:ring-teal-600"
                          />
                          <span className="text-xs font-mono text-zinc-700">{val}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Applied domains */}
      <div className="bg-white border border-zinc-200 p-5 space-y-4">
        <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">Applied domains</p>
        <p className="text-xs text-zinc-400">Apply this rule to all domains or restrict to specific ones.</p>
        <div className="space-y-2">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={selectedDomains.includes('all')}
              onChange={() => toggleDomain('all')}
              className="h-4 w-4 border-zinc-300 text-teal-600 focus:ring-teal-600"
            />
            <span className="text-sm text-zinc-700">All domains</span>
          </label>
          {availableDomains.map(domain => (
            <label key={domain} className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={selectedDomains.includes(domain)}
                onChange={() => toggleDomain(domain)}
                className="h-4 w-4 border-zinc-300 text-teal-600 focus:ring-teal-600"
              />
              <span className="text-sm text-zinc-700">{domain}</span>
            </label>
          ))}
        </div>

        {showDomainInheritance && (
          <div className="pt-2 space-y-2">
            <p className="text-xs text-zinc-500">Domain inheritance</p>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setDomainInheritance('override')}
                className={`text-xs px-3 py-1 border ${domainInheritance === 'override' ? 'bg-teal-600 text-white border-teal-600' : 'border-zinc-200 text-zinc-600'}`}
              >
                Override global rules
              </button>
              <button
                onClick={() => setDomainInheritance('inherit')}
                className={`text-xs px-3 py-1 border ${domainInheritance === 'inherit' ? 'bg-teal-600 text-white border-teal-600' : 'border-zinc-200 text-zinc-600'}`}
              >
                Inherit global rules
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Error + Save */}
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full bg-teal-600 text-white rounded-full px-6 py-2.5 text-sm font-medium hover:bg-teal-700 disabled:opacity-50 transition-colors"
      >
        {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Create rule'}
      </button>
    </div>
  )
}
