import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeftIcon, XMarkIcon } from '@heroicons/react/24/outline'
import { useConfiguration } from '../../hooks/useConfiguration'
import { useOrg } from '../../contexts/OrgContext'
import { saveConfiguration } from '../../lib/api'
import Badge from '../../components/ui/Badge'

function Spinner() {
  return (
    <div className="flex items-center justify-center py-16">
      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-teal-600" />
    </div>
  )
}

const STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'paused', label: 'Paused' },
  { value: 'draft', label: 'Draft' },
]

export default function ParameterEditor() {
  const { paramName } = useParams()
  const navigate = useNavigate()
  const { config, reload } = useConfiguration()
  const { currentOrg, loading: orgLoading } = useOrg()

  const [allowedValues, setAllowedValues] = useState([])
  const [newValue, setNewValue] = useState('')
  const [caseSensitive, setCaseSensitive] = useState(false)
  const [status, setStatus] = useState('draft')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!config) return
    const paramData = config.monitoredParameters?.[paramName]
    if (!paramData) return
    setAllowedValues(config.allowedValues?.[paramName] || [])
    setCaseSensitive(config.casingRules?.[paramName]?.caseSensitive || false)
    if (paramData.status === 'draft') setStatus('draft')
    else if (paramData.active) setStatus('active')
    else setStatus('paused')
  }, [config, paramName])

  const save = async (overrides = {}) => {
    if (!config || !currentOrg) return
    setSaving(true)
    try {
      const nextStatus = overrides.status ?? status
      const nextValues = overrides.allowedValues ?? allowedValues
      const nextCasing = overrides.caseSensitive ?? caseSensitive
      await saveConfiguration(currentOrg.firestore_api_key, {
        ...config,
        monitoredParameters: {
          ...config.monitoredParameters,
          [paramName]: {
            ...config.monitoredParameters?.[paramName],
            active: nextStatus === 'active',
            status: nextStatus === 'draft' ? 'draft' : undefined,
            updated: new Date().toISOString(),
          },
        },
        allowedValues: { ...config.allowedValues, [paramName]: nextValues },
        casingRules: { ...config.casingRules, [paramName]: { caseSensitive: nextCasing } },
      })
      await reload()
    } finally {
      setSaving(false)
    }
  }

  const handleAddValue = async () => {
    const v = newValue.trim()
    if (!v || allowedValues.includes(v)) return
    const updated = [...allowedValues, v]
    setAllowedValues(updated)
    setNewValue('')
    await save({ allowedValues: updated })
  }

  const handleRemoveValue = async (val) => {
    const updated = allowedValues.filter(v => v !== val)
    setAllowedValues(updated)
    await save({ allowedValues: updated })
  }

  const handleDelete = async () => {
    if (!confirm(`Delete parameter "${paramName}"? This cannot be undone.`)) return
    const { [paramName]: _, ...restParams } = config.monitoredParameters || {}
    const { [paramName]: __, ...restValues } = config.allowedValues || {}
    const { [paramName]: ___, ...restCasing } = config.casingRules || {}
    await saveConfiguration(currentOrg.firestore_api_key, {
      ...config,
      monitoredParameters: restParams,
      allowedValues: restValues,
      casingRules: restCasing,
    })
    navigate('/monitor/parameters')
  }

  if (orgLoading || !config) return <Spinner />
  const paramData = config.monitoredParameters?.[paramName]
  if (!paramData) return <div className="text-center py-16 text-sm text-zinc-400">Parameter not found.</div>

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/monitor/parameters')}
          className="flex items-center gap-1.5 text-sm text-zinc-400 hover:text-zinc-700 transition-colors"
        >
          <ArrowLeftIcon className="h-4 w-4" /> Parameters
        </button>
      </div>
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-semibold text-zinc-900 font-mono">{paramName}</h1>
        <Badge variant={status}>{status.charAt(0).toUpperCase() + status.slice(1)}</Badge>
        {saving && <span className="text-xs text-zinc-400 ml-1">Saving…</span>}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left column */}
        <div className="space-y-4">
          {/* Status card */}
          <div className="bg-white rounded-xl border border-zinc-200 p-5 space-y-3">
            <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">Status</p>
            <div className="space-y-2">
              {STATUS_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={async () => { setStatus(opt.value); await save({ status: opt.value }) }}
                  disabled={saving}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors border ${
                    status === opt.value
                      ? 'bg-teal-50 text-teal-700 border-teal-200'
                      : 'bg-white text-zinc-600 border-zinc-200 hover:bg-zinc-50'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Settings card */}
          <div className="bg-white rounded-xl border border-zinc-200 p-5 space-y-3">
            <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">Settings</p>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={caseSensitive}
                onChange={async (e) => {
                  setCaseSensitive(e.target.checked)
                  await save({ caseSensitive: e.target.checked })
                }}
                className="h-4 w-4 rounded border-zinc-300 text-teal-600 focus:ring-teal-600"
              />
              <span className="text-sm text-zinc-700">Case sensitive</span>
            </label>
          </div>

          {/* Change log */}
          <div className="bg-white rounded-xl border border-zinc-200 p-5 space-y-2">
            <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">Change log</p>
            <div className="text-xs text-zinc-400 space-y-1">
              {paramData.created && <p>Created {new Date(paramData.created).toLocaleDateString()}</p>}
              {paramData.updated && <p>Updated {new Date(paramData.updated).toLocaleDateString()}</p>}
            </div>
          </div>

          {/* Delete */}
          <button
            onClick={handleDelete}
            className="w-full bg-red-50 text-red-600 border border-red-200 rounded-lg px-3 py-2 text-sm font-medium hover:bg-red-100 transition-colors"
          >
            Delete parameter
          </button>
        </div>

        {/* Right column */}
        <div className="lg:col-span-2 space-y-4">
          {/* Allowed values */}
          <div className="bg-white rounded-xl border border-zinc-200 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-zinc-900">Allowed values</p>
              {allowedValues.length > 0 && (
                <span className="text-xs text-zinc-400">{allowedValues.length} value{allowedValues.length !== 1 ? 's' : ''}</span>
              )}
            </div>
            <p className="text-xs text-zinc-400">If empty, all values are accepted. If any values are listed, only these will pass validation.</p>

            {/* Add value input */}
            <div className="flex gap-2">
              <input
                type="text"
                value={newValue}
                onChange={e => setNewValue(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAddValue()}
                placeholder="Add a value…"
                className="flex-1 px-3 py-2 rounded-lg border border-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-600"
              />
              <button
                onClick={handleAddValue}
                disabled={!newValue.trim()}
                className="bg-teal-600 text-white rounded-full px-4 py-2 text-sm font-medium hover:bg-teal-700 disabled:opacity-40 transition-colors"
              >
                Add
              </button>
            </div>

            {/* Values list */}
            {allowedValues.length === 0 ? (
              <div className="border-2 border-dashed border-zinc-200 rounded-lg py-8 text-center">
                <p className="text-sm text-zinc-400">No allowed values — all values permitted</p>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {allowedValues.map(val => (
                  <span
                    key={val}
                    className="inline-flex items-center gap-1.5 bg-zinc-100 text-zinc-700 rounded-full px-3 py-1 text-sm font-mono"
                  >
                    {val}
                    <button
                      onClick={() => handleRemoveValue(val)}
                      className="text-zinc-400 hover:text-red-500 transition-colors"
                    >
                      <XMarkIcon className="h-3.5 w-3.5" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Conditional rules */}
          <div className="bg-white rounded-xl border border-zinc-200 p-5 space-y-3">
            <p className="text-sm font-semibold text-zinc-900">Conditional rules</p>
            <p className="text-xs text-zinc-400">Rules that enforce different allowed values based on another parameter's value.</p>
            {(() => {
              const related = (config?.conditionalRules || []).filter(
                r => r.anchor?.parameter === paramName || Object.keys(r.conditionals || {}).includes(paramName)
              )
              return related.length === 0 ? (
                <button
                  onClick={() => navigate('/monitor/rules/new')}
                  className="text-sm text-teal-600 hover:text-teal-700"
                >
                  + Create a conditional rule
                </button>
              ) : (
                <ul className="space-y-1.5">
                  {related.map(r => (
                    <li key={r.id} className="flex items-center justify-between text-sm">
                      <span className="text-zinc-700">{r.name || `Rule ${r.id?.slice(0, 6)}`}</span>
                      <button
                        onClick={() => navigate(`/monitor/rules/${r.id}/edit`)}
                        className="text-teal-600 hover:text-teal-700 text-xs"
                      >
                        Edit →
                      </button>
                    </li>
                  ))}
                </ul>
              )
            })()}
          </div>
        </div>
      </div>
    </div>
  )
}
