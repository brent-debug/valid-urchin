import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeftIcon, XMarkIcon } from '@heroicons/react/24/outline'
import { useConfiguration } from '../../hooks/useConfiguration'
import { useOrg } from '../../contexts/OrgContext'
import { saveConfiguration } from '../../lib/api'
import { supabase } from '../../lib/supabase'
import Badge from '../../components/ui/Badge'
import { writeAuditLog } from '../../lib/auditLog'

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

  // Applied domains state
  const [availableDomains, setAvailableDomains] = useState([])
  const [selectedDomains, setSelectedDomains] = useState(['all'])

  useEffect(() => {
    if (!config) return
    const paramData = config.monitoredParameters?.[paramName]
    if (!paramData) return
    setAllowedValues(config.allowedValues?.[paramName] || [])
    setCaseSensitive(config.casingRules?.[paramName]?.caseSensitive || false)
    if (paramData.status === 'draft') setStatus('draft')
    else if (paramData.active) setStatus('active')
    else setStatus('paused')
    const domains = paramData.appliedDomains
    setSelectedDomains(domains && domains.length > 0 ? domains : ['all'])
  }, [config, paramName])

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

  const save = async (overrides = {}) => {
    if (!config || !currentOrg) return
    setSaving(true)
    try {
      const nextStatus = overrides.status ?? status
      const nextValues = overrides.allowedValues ?? allowedValues
      const nextCasing = overrides.caseSensitive ?? caseSensitive
      const nextDomains = overrides.appliedDomains ?? selectedDomains

      const { data: { user } } = await supabase.auth.getUser()
      const paramData = config.monitoredParameters?.[paramName]
      const isNew = !paramData?.created

      const updatedParam = {
        ...paramData,
        active: nextStatus === 'active',
        status: nextStatus === 'draft' ? 'draft' : undefined,
        updated: new Date().toISOString(),
        appliedDomains: nextDomains,
        lastModified: new Date().toISOString(),
        lastModifiedBy: { userId: user?.id, email: user?.email },
      }

      if (isNew) {
        updatedParam.created = new Date().toISOString()
        updatedParam.createdBy = { userId: user?.id, email: user?.email }
      }

      await saveConfiguration(currentOrg.firestore_api_key, {
        ...config,
        monitoredParameters: {
          ...config.monitoredParameters,
          [paramName]: updatedParam,
        },
        allowedValues: { ...config.allowedValues, [paramName]: nextValues },
        casingRules: { ...config.casingRules, [paramName]: { caseSensitive: nextCasing } },
      })
      await reload()
      await writeAuditLog({
        organizationId: currentOrg.id,
        userId: user?.id,
        userEmail: user?.email,
        action: 'parameter_updated',
        entityType: 'parameter',
        entityName: paramName,
        metadata: { source: 'parameter_editor' },
      })
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
    const { data: { user } } = await supabase.auth.getUser()
    await writeAuditLog({
      organizationId: currentOrg.id,
      userId: user?.id,
      userEmail: user?.email,
      action: 'parameter_deleted',
      entityType: 'parameter',
      entityName: paramName,
    })
    navigate('/monitor/parameters')
  }

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

  if (orgLoading || !config) return <Spinner />
  const paramData = config.monitoredParameters?.[paramName]
  if (!paramData) return <div className="text-center py-16 text-sm text-zinc-400">Parameter not found.</div>

  // Conditional rules: split into anchor vs conditional
  const allRules = config?.conditionalRules || []
  const asAnchor = allRules.filter(r =>
    r.anchors?.some(a => a.parameter === paramName) || r.anchor?.parameter === paramName
  )
  const asConditional = allRules.filter(r =>
    paramName in (r.conditionals || {}) &&
    !r.anchors?.some(a => a.parameter === paramName) &&
    r.anchor?.parameter !== paramName
  )

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
          <div className="bg-white border border-zinc-200 p-5 space-y-3">
            <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">Status</p>
            <div className="space-y-2">
              {STATUS_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={async () => { setStatus(opt.value); await save({ status: opt.value }) }}
                  disabled={saving}
                  className={`w-full text-left px-3 py-2 text-sm font-medium transition-colors border ${
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
          <div className="bg-white border border-zinc-200 p-5 space-y-3">
            <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">Settings</p>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={caseSensitive}
                onChange={async (e) => {
                  setCaseSensitive(e.target.checked)
                  await save({ caseSensitive: e.target.checked })
                }}
                className="h-4 w-4 border-zinc-300 text-teal-600 focus:ring-teal-600"
              />
              <span className="text-sm text-zinc-700">Case sensitive</span>
            </label>
          </div>

          {/* Change log */}
          <div className="bg-white border border-zinc-200 p-5 space-y-2">
            <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">Change log</p>
            <div className="text-xs text-zinc-400 space-y-1">
              {paramData.created && <p>Created {new Date(paramData.created).toLocaleDateString()}</p>}
              {paramData.updated && <p>Updated {new Date(paramData.updated).toLocaleDateString()}</p>}
            </div>
          </div>

          {/* History */}
          <div className="bg-white border border-zinc-200 p-5 space-y-1">
            <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">History</p>
            {paramData.created && (
              <p className="text-xs text-zinc-400">
                Created {new Date(paramData.created).toLocaleDateString()}{paramData.createdBy?.email ? ` by ${paramData.createdBy.email}` : ''}
              </p>
            )}
            {paramData.lastModified && (
              <p className="text-xs text-zinc-400">
                Modified {new Date(paramData.lastModified).toLocaleDateString()}{paramData.lastModifiedBy?.email ? ` by ${paramData.lastModifiedBy.email}` : ''}
              </p>
            )}
          </div>

          {/* Delete */}
          <button
            onClick={handleDelete}
            className="w-full bg-red-50 text-red-600 border border-red-200 px-3 py-2 text-sm font-medium hover:bg-red-100 transition-colors"
          >
            Delete parameter
          </button>
        </div>

        {/* Right column */}
        <div className="lg:col-span-2 space-y-4">
          {/* Allowed values */}
          <div className="bg-white border border-zinc-200 p-5 space-y-4">
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
                className="flex-1 px-3 py-2 border border-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-600"
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
              <div className="border-2 border-dashed border-zinc-200 py-8 text-center">
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

          {/* Applied domains */}
          <div className="bg-white border border-zinc-200 p-5 space-y-3">
            <p className="text-sm font-semibold text-zinc-900">Applied domains</p>
            <p className="text-xs text-zinc-400">Restrict this parameter to specific domains, or apply globally.</p>
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
            <button
              onClick={() => save({ appliedDomains: selectedDomains })}
              disabled={saving}
              className="bg-teal-600 text-white px-4 py-2 text-sm font-medium hover:bg-teal-700 disabled:opacity-50 transition-colors"
            >
              Save domains
            </button>
          </div>

          {/* Conditional rules */}
          <div className="bg-white border border-zinc-200 p-5 space-y-4">
            <p className="text-sm font-semibold text-zinc-900">Conditional rules</p>
            <p className="text-xs text-zinc-400">Rules that reference this parameter.</p>

            {/* Used as anchor */}
            <div className="space-y-2">
              <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">Used as anchor</p>
              {asAnchor.length === 0 ? (
                <p className="text-xs text-zinc-300">None</p>
              ) : (
                <div className="space-y-1">
                  {asAnchor.map(r => (
                    <div
                      key={r.id}
                      onClick={() => navigate(`/monitor/rules/${r.id}`)}
                      className="flex items-center justify-between text-sm px-3 py-2 border border-zinc-100 cursor-pointer hover:bg-teal-50 transition-colors"
                    >
                      <span className="text-zinc-700">{r.name || `Rule ${r.id?.slice(0, 6)}`}</span>
                      <span className="text-zinc-400">→</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Used as conditional */}
            <div className="space-y-2">
              <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">Used as conditional</p>
              {asConditional.length === 0 ? (
                <p className="text-xs text-zinc-300">None</p>
              ) : (
                <div className="space-y-1">
                  {asConditional.map(r => (
                    <div
                      key={r.id}
                      onClick={() => navigate(`/monitor/rules/${r.id}`)}
                      className="flex items-center justify-between text-sm px-3 py-2 border border-zinc-100 cursor-pointer hover:bg-teal-50 transition-colors"
                    >
                      <span className="text-zinc-700">{r.name || `Rule ${r.id?.slice(0, 6)}`}</span>
                      <span className="text-zinc-400">→</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {asAnchor.length === 0 && asConditional.length === 0 && (
              <button
                onClick={() => navigate('/monitor/rules/new')}
                className="text-sm text-teal-600 hover:text-teal-700"
              >
                + Create a conditional rule
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
