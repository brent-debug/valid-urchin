import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeftIcon, PlusIcon, TrashIcon } from '@heroicons/react/24/outline'
import { useConfiguration } from '../../hooks/useConfiguration'
import { useOrg } from '../../contexts/OrgContext'
import { saveConfiguration } from '../../lib/api'

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
  const [anchorParam, setAnchorParam] = useState('')
  const [anchorValue, setAnchorValue] = useState('')
  const [conditionals, setConditionals] = useState({})
  const [addingParam, setAddingParam] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!config || !ruleId) return
    const rule = (config.conditionalRules || []).find(r => r.id === ruleId)
    if (!rule) return
    setRuleName(rule.name || '')
    setAnchorParam(rule.anchor?.parameter || '')
    setAnchorValue(rule.anchor?.value || '')
    setConditionals(rule.conditionals || {})
  }, [config, ruleId])

  if (orgLoading || loading) return <Spinner />
  if (!currentOrg) return <div className="text-center py-16 text-sm text-zinc-400">No organization found.</div>

  const parameters = Object.keys(config?.monitoredParameters || {})
  const anchorAllowedValues = config?.allowedValues?.[anchorParam] || []

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

  const handleSave = async () => {
    if (!anchorParam || !anchorValue) { setError('Select an anchor parameter and value'); return }
    if (Object.keys(conditionals).length === 0) { setError('Add at least one conditional parameter'); return }
    setSaving(true)
    setError('')
    try {
      const existingRules = config?.conditionalRules || []
      const newRule = {
        id: ruleId || crypto.randomUUID(),
        name: ruleName || `When ${anchorParam} = ${anchorValue}`,
        active: true,
        anchor: { parameter: anchorParam, value: anchorValue },
        conditionals,
        createdAt: isEdit
          ? existingRules.find(r => r.id === ruleId)?.createdAt || new Date().toISOString()
          : new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
      const updatedRules = isEdit
        ? existingRules.map(r => r.id === ruleId ? newRule : r)
        : [...existingRules, newRule]
      await saveConfiguration(currentOrg.firestore_api_key, { ...config, conditionalRules: updatedRules })
      await reload()
      navigate('/monitor/rules')
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const liveSummary = anchorParam && anchorValue
    ? `When ${anchorParam} = "${anchorValue}"`
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
      <div className="bg-white rounded-lg border border-zinc-200 p-5 space-y-3">
        <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">Rule name</p>
        <input
          type="text"
          value={ruleName}
          onChange={e => setRuleName(e.target.value)}
          placeholder="e.g. Google paid traffic"
          className="w-full px-3 py-2 rounded-md border border-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-600"
        />
      </div>

      {/* Anchor condition */}
      <div className="bg-white rounded-lg border border-zinc-200 p-5 space-y-4">
        <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">Anchor condition</p>
        <div className="space-y-3">
          <div>
            <label className="block text-xs text-zinc-500 mb-1">When this parameter…</label>
            <select
              value={anchorParam}
              onChange={e => { setAnchorParam(e.target.value); setAnchorValue('') }}
              className="w-full px-3 py-2 rounded-md border border-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-600"
            >
              <option value="">Select parameter…</option>
              {parameters.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          {anchorParam && (
            <div>
              <label className="block text-xs text-zinc-500 mb-1">…has this value</label>
              {anchorAllowedValues.length > 0 ? (
                <select
                  value={anchorValue}
                  onChange={e => setAnchorValue(e.target.value)}
                  className="w-full px-3 py-2 rounded-md border border-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-600"
                >
                  <option value="">Select value…</option>
                  {anchorAllowedValues.map(v => <option key={v} value={v}>{v}</option>)}
                </select>
              ) : (
                <input
                  type="text"
                  value={anchorValue}
                  onChange={e => setAnchorValue(e.target.value)}
                  placeholder="Type anchor value…"
                  className="w-full px-3 py-2 rounded-md border border-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-600"
                />
              )}
            </div>
          )}
        </div>

        {/* Live summary pill */}
        {liveSummary && (
          <div className="inline-flex items-center bg-teal-50 text-teal-700 rounded-full px-3 py-1 text-sm">
            {liveSummary}
          </div>
        )}
      </div>

      {/* Conditional parameters */}
      <div className="bg-white rounded-lg border border-zinc-200 p-5 space-y-4">
        <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">Conditional parameters</p>
        <p className="text-xs text-zinc-400">These parameters must match their allowed values when the anchor condition is true.</p>

        <div className="flex gap-2">
          <select
            value={addingParam}
            onChange={e => setAddingParam(e.target.value)}
            className="flex-1 px-3 py-2 rounded-lg border border-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-600"
          >
            <option value="">Add a parameter…</option>
            {parameters
              .filter(p => p !== anchorParam && !conditionals[p])
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
          <div className="border-2 border-dashed border-zinc-200 rounded-lg py-8 text-center">
            <p className="text-sm text-zinc-400">No conditional parameters added yet</p>
          </div>
        ) : (
          <div className="space-y-3">
            {Object.entries(conditionals).map(([param, selectedValues]) => {
              const available = config?.allowedValues?.[param] || []
              return (
                <div key={param} className="border border-zinc-200 rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-mono font-medium text-zinc-900">{param}</span>
                    <button
                      onClick={() => handleRemoveConditional(param)}
                      className="p-1 rounded text-zinc-300 hover:text-red-500 hover:bg-red-50 transition-colors"
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
                            className="h-3.5 w-3.5 rounded border-zinc-300 text-teal-600 focus:ring-teal-600"
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
