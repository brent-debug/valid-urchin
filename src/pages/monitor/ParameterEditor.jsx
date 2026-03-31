import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeftIcon, PlusIcon, TrashIcon } from '@heroicons/react/24/outline'
import { useConfiguration } from '../../hooks/useConfiguration'
import { useOrg } from '../../contexts/OrgContext'
import { saveConfiguration } from '../../lib/api'
import Button from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'

const STATUS_CYCLE = { draft: 'active', active: 'paused', paused: 'active' }
const STATUS_LABEL = { draft: 'Activate', active: 'Pause', paused: 'Resume' }

export default function ParameterEditor() {
  const { paramName } = useParams()
  const navigate = useNavigate()
  const { config, reload } = useConfiguration()
  const { currentOrg } = useOrg()

  const [allowedValues, setAllowedValues] = useState([])
  const [newValue, setNewValue] = useState('')
  const [caseSensitive, setCaseSensitive] = useState(false)
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState('draft')

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

  const save = async (updates = {}) => {
    if (!config || !currentOrg) return
    setSaving(true)
    try {
      const currentStatus = updates.status || status
      const merged = {
        ...config,
        monitoredParameters: {
          ...config.monitoredParameters,
          [paramName]: {
            ...config.monitoredParameters?.[paramName],
            active: currentStatus === 'active',
            status: currentStatus === 'draft' ? 'draft' : undefined,
            updated: new Date().toISOString(),
          },
        },
        allowedValues: {
          ...config.allowedValues,
          [paramName]: updates.allowedValues !== undefined ? updates.allowedValues : allowedValues,
        },
        casingRules: {
          ...config.casingRules,
          [paramName]: { caseSensitive: updates.caseSensitive !== undefined ? updates.caseSensitive : caseSensitive },
        },
      }
      await saveConfiguration(currentOrg.firestore_api_key, merged)
      await reload()
    } finally {
      setSaving(false)
    }
  }

  const handleStatusToggle = async () => {
    const next = STATUS_CYCLE[status]
    setStatus(next)
    await save({ status: next })
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

  const paramData = config?.monitoredParameters?.[paramName]
  if (!config) return <div className="flex items-center justify-center py-16"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600" /></div>
  if (!paramData) return <div className="text-center py-16 text-zinc-500">Parameter not found</div>

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/monitor/parameters')} className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100">
          <ArrowLeftIcon className="h-5 w-5" />
        </button>
        <h1 className="text-lg font-semibold text-zinc-900 font-mono">{paramName}</h1>
        <Badge variant={status}>{status.charAt(0).toUpperCase() + status.slice(1)}</Badge>
        {saving && <span className="text-xs text-zinc-400 ml-2">Saving…</span>}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left panel */}
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-zinc-200 p-5 space-y-4">
            <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">Status</h3>
            <Button variant="secondary" onClick={handleStatusToggle} disabled={saving} className="w-full">
              {STATUS_LABEL[status]}
            </Button>
          </div>

          <div className="bg-white rounded-2xl border border-zinc-200 p-5 space-y-3">
            <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">Settings</h3>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={caseSensitive}
                onChange={async (e) => {
                  setCaseSensitive(e.target.checked)
                  await save({ caseSensitive: e.target.checked })
                }}
                className="h-4 w-4 rounded border-zinc-300 text-primary-600 focus:ring-primary-600"
              />
              <span className="text-sm text-zinc-700">Case sensitive</span>
            </label>
          </div>

          <div className="bg-white rounded-2xl border border-zinc-200 p-5 space-y-3">
            <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">Change log</h3>
            <div className="text-xs text-zinc-500 space-y-1">
              <p>Created: {paramData.created ? new Date(paramData.created).toLocaleDateString() : 'Unknown'}</p>
              {paramData.updated && <p>Updated: {new Date(paramData.updated).toLocaleDateString()}</p>}
            </div>
          </div>

          <Button variant="danger" size="sm" onClick={handleDelete} className="w-full">
            <TrashIcon className="h-4 w-4 mr-1.5" /> Delete parameter
          </Button>
        </div>

        {/* Right panel */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-2xl border border-zinc-200 p-5 space-y-4">
            <h3 className="text-sm font-semibold text-zinc-900">Allowed values</h3>
            <p className="text-xs text-zinc-500">If any values are listed, only these will be accepted. Leave empty to allow all values.</p>

            <div className="flex gap-2">
              <input
                type="text"
                value={newValue}
                onChange={e => setNewValue(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAddValue()}
                className="flex-1 px-3 py-2 rounded-lg border border-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-600"
                placeholder="Add a value…"
              />
              <Button variant="secondary" size="sm" onClick={handleAddValue}>
                <PlusIcon className="h-4 w-4" />
              </Button>
            </div>

            {allowedValues.length === 0 ? (
              <p className="text-sm text-zinc-400 text-center py-4 border border-dashed border-zinc-200 rounded-lg">No allowed values — all values permitted</p>
            ) : (
              <ul className="space-y-1.5">
                {allowedValues.map(val => (
                  <li key={val} className="flex items-center justify-between px-3 py-2 bg-zinc-50 rounded-lg">
                    <span className="text-sm font-mono text-zinc-800">{val}</span>
                    <button onClick={() => handleRemoveValue(val)} className="p-1 rounded text-zinc-400 hover:text-red-500 hover:bg-red-50">
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="bg-white rounded-2xl border border-zinc-200 p-5">
            <h3 className="text-sm font-semibold text-zinc-900 mb-1">Conditional monitoring</h3>
            <p className="text-xs text-zinc-500 mb-3">Set rules that only apply when another parameter has a specific value.</p>
            <Button variant="secondary" size="sm" onClick={() => navigate('/monitor/rules')}>
              Manage conditional rules
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
