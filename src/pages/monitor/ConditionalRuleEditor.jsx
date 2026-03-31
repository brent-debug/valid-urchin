import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeftIcon, PlusIcon, TrashIcon } from '@heroicons/react/24/outline'
import { useConfiguration } from '../../hooks/useConfiguration'
import { useOrg } from '../../contexts/OrgContext'
import { saveConfiguration } from '../../lib/api'
import Button from '../../components/ui/Button'

export default function ConditionalRuleEditor() {
  const { ruleId } = useParams()
  const navigate = useNavigate()
  const { config, loading, reload } = useConfiguration()
  const { currentOrg } = useOrg()
  const isEdit = Boolean(ruleId)

  const [ruleName, setRuleName] = useState('')
  const [anchorParam, setAnchorParam] = useState('')
  const [anchorValue, setAnchorValue] = useState('')
  const [conditionals, setConditionals] = useState({})
  const [addingParam, setAddingParam] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Load existing rule once config is available
  useEffect(() => {
    if (!config || !ruleId) return
    const rule = (config.conditionalRules || []).find(r => r.id === ruleId)
    if (!rule) return
    setRuleName(rule.name || '')
    setAnchorParam(rule.anchor?.parameter || '')
    setAnchorValue(rule.anchor?.value || '')
    setConditionals(rule.conditionals || {})
  }, [config, ruleId])

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

  if (loading) return <div className="flex items-center justify-center py-16"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600" /></div>

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/monitor/rules')} className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100">
          <ArrowLeftIcon className="h-5 w-5" />
        </button>
        <h1 className="text-lg font-semibold text-zinc-900">{isEdit ? 'Edit rule' : 'Create rule'}</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left panel: Anchor */}
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-zinc-200 p-5 space-y-4">
            <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">Rule name</h3>
            <input
              type="text"
              value={ruleName}
              onChange={e => setRuleName(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-600"
              placeholder="e.g. Email campaigns"
            />
          </div>

          <div className="bg-white rounded-2xl border border-zinc-200 p-5 space-y-4">
            <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">Anchor condition</h3>
            <div>
              <label className="block text-xs text-zinc-500 mb-1">When parameter</label>
              <select
                value={anchorParam}
                onChange={e => { setAnchorParam(e.target.value); setAnchorValue('') }}
                className="w-full px-3 py-2 rounded-lg border border-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-600"
              >
                <option value="">Select parameter…</option>
                {parameters.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            {anchorParam && (
              <div>
                <label className="block text-xs text-zinc-500 mb-1">Has value</label>
                {anchorAllowedValues.length > 0 ? (
                  <select
                    value={anchorValue}
                    onChange={e => setAnchorValue(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-600"
                  >
                    <option value="">Select value…</option>
                    {anchorAllowedValues.map(v => <option key={v} value={v}>{v}</option>)}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={anchorValue}
                    onChange={e => setAnchorValue(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-600"
                    placeholder="Enter anchor value…"
                  />
                )}
              </div>
            )}

            {anchorParam && anchorValue && (
              <div className="p-3 rounded-lg bg-primary-50 border border-primary-100">
                <p className="text-xs font-medium text-primary-700">Rule summary</p>
                <p className="text-xs text-primary-600 mt-1">
                  When <strong className="font-mono">{anchorParam}</strong> = <strong className="font-mono">{anchorValue}</strong>, enforce conditional parameter rules.
                </p>
              </div>
            )}

            {error && <p className="text-xs text-red-600">{error}</p>}
            <Button onClick={handleSave} disabled={saving} className="w-full">
              {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Create rule'}
            </Button>
          </div>
        </div>

        {/* Right panel: Conditionals */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-2xl border border-zinc-200 p-5 space-y-4">
            <h3 className="text-sm font-semibold text-zinc-900">Conditional parameters</h3>
            <p className="text-xs text-zinc-500">These parameters must match the allowed values when the anchor condition is met.</p>

            <div className="flex gap-2">
              <select
                value={addingParam}
                onChange={e => setAddingParam(e.target.value)}
                className="flex-1 px-3 py-2 rounded-lg border border-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-600"
              >
                <option value="">Add parameter…</option>
                {parameters
                  .filter(p => p !== anchorParam && !conditionals[p])
                  .map(p => <option key={p} value={p}>{p}</option>)}
              </select>
              <Button variant="secondary" size="sm" onClick={handleAddConditional} disabled={!addingParam}>
                <PlusIcon className="h-4 w-4" />
              </Button>
            </div>

            {Object.keys(conditionals).length === 0 ? (
              <p className="text-sm text-zinc-400 text-center py-6 border border-dashed border-zinc-200 rounded-lg">
                No conditional parameters added yet
              </p>
            ) : (
              <div className="space-y-4">
                {Object.entries(conditionals).map(([param, selectedValues]) => {
                  const availableValues = config?.allowedValues?.[param] || []
                  return (
                    <div key={param} className="border border-zinc-200 rounded-xl p-4">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-sm font-medium font-mono text-zinc-900">{param}</span>
                        <button onClick={() => handleRemoveConditional(param)} className="p-1 rounded text-zinc-400 hover:text-red-500 hover:bg-red-50">
                          <TrashIcon className="h-4 w-4" />
                        </button>
                      </div>
                      {availableValues.length === 0 ? (
                        <p className="text-xs text-amber-600">No allowed values configured for this parameter. Add them in the parameter editor first.</p>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {availableValues.map(val => (
                            <label key={val} className="flex items-center gap-1.5 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={selectedValues.includes(val)}
                                onChange={() => handleToggleValue(param, val)}
                                className="h-3.5 w-3.5 rounded border-zinc-300 text-primary-600 focus:ring-primary-600"
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
        </div>
      </div>
    </div>
  )
}
