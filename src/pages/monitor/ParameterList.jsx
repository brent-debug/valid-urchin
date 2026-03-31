import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { PlusIcon, PencilIcon, TrashIcon, PauseIcon, PlayIcon } from '@heroicons/react/24/outline'
import { useConfiguration } from '../../hooks/useConfiguration'
import { useOrg } from '../../contexts/OrgContext'
import { saveConfiguration } from '../../lib/api'
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

const iconBtn = 'p-1 rounded text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-colors'
const iconBtnDanger = 'p-1 rounded text-zinc-400 hover:text-red-500 hover:bg-red-50 transition-colors'

export default function MonitorSettings() {
  const location = useLocation()
  const navigate = useNavigate()
  const { config, loading, reload } = useConfiguration()
  const { currentOrg, loading: orgLoading } = useOrg()

  const tab = location.pathname.startsWith('/monitor/rules') ? 'rules' : 'params'

  const [showAdd, setShowAdd] = useState(false)
  const [newParamName, setNewParamName] = useState('')
  const [adding, setAdding] = useState(false)
  const [addError, setAddError] = useState('')

  if (orgLoading || loading) return <Spinner />
  if (!currentOrg) return <div className="text-center py-16 text-sm text-zinc-500">No organization found.</div>

  const parameters = config?.monitoredParameters || {}
  const rules = config?.conditionalRules || []

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

  async function handleToggleRule(ruleId) {
    await saveConfiguration(currentOrg.firestore_api_key, {
      ...config,
      conditionalRules: rules.map(r => r.id === ruleId ? { ...r, active: !r.active } : r),
    })
    await reload()
  }

  return (
    <div className="space-y-4">
      {/* Pill toggle + action button */}
      <div className="flex items-center justify-between">
        <div className="inline-flex bg-zinc-100 rounded-full p-1">
          {[['params', 'Parameters', '/monitor/parameters'], ['rules', 'Conditional Rules', '/monitor/rules']].map(([key, label, href]) => (
            <button
              key={key}
              onClick={() => navigate(href)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                tab === key ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        {tab === 'params' ? (
          <button
            onClick={() => setShowAdd(true)}
            className="inline-flex items-center gap-1.5 bg-teal-600 text-white rounded-full px-4 py-2 text-sm font-medium hover:bg-teal-700 transition-colors"
          >
            <PlusIcon className="h-4 w-4" /> Add parameter
          </button>
        ) : (
          <button
            onClick={() => navigate('/monitor/rules/new')}
            className="inline-flex items-center gap-1.5 bg-teal-600 text-white rounded-full px-4 py-2 text-sm font-medium hover:bg-teal-700 transition-colors"
          >
            <PlusIcon className="h-4 w-4" /> Create rule
          </button>
        )}
      </div>

      {/* Table */}
      <div className="bg-white border border-zinc-200 overflow-hidden">
        {tab === 'params' ? (
          <table className="w-full">
            <thead>
              <tr className="border-b border-zinc-100">
                <th className="text-left px-5 py-3 text-xs font-semibold text-zinc-400 uppercase tracking-wide">Parameter</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-zinc-400 uppercase tracking-wide">Allowed values</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-zinc-400 uppercase tracking-wide">Status</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-zinc-400 uppercase tracking-wide">Last modified</th>
                <th className="text-right px-5 py-3 text-xs font-semibold text-zinc-400 uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody>
              {Object.keys(parameters).length === 0 ? (
                <EmptyRow colSpan={5} message="No parameters yet. Add your first UTM parameter to get started." />
              ) : (
                Object.entries(parameters).map(([name, data]) => {
                  const status = getParamStatus(data)
                  const valueCount = config?.allowedValues?.[name]?.length || 0
                  const isActive = status === 'active'
                  return (
                    <tr
                      key={name}
                      onClick={() => navigate(`/monitor/parameters/${name}`)}
                      className="border-b border-zinc-50 hover:bg-zinc-50 cursor-pointer"
                    >
                      <td className="px-5 py-3">
                        <span className="font-mono font-medium text-zinc-900 text-sm">{name}</span>
                      </td>
                      <td className="px-5 py-3 text-sm text-zinc-400">
                        {valueCount === 0 ? 'All values allowed' : `${valueCount} value${valueCount !== 1 ? 's' : ''}`}
                      </td>
                      <td className="px-5 py-3">
                        <Badge variant={status}>{status.charAt(0).toUpperCase() + status.slice(1)}</Badge>
                      </td>
                      <td className="px-5 py-3 text-sm text-zinc-400">{fmtDate(data.updated || data.created)}</td>
                      <td className="px-5 py-3" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-3">
                          <button
                            onClick={() => navigate(`/monitor/parameters/${name}`)}
                            className={iconBtn}
                            title="Edit"
                          >
                            <PencilIcon className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleToggleParam(name, data)}
                            className={iconBtn}
                            title={isActive ? 'Pause' : 'Activate'}
                          >
                            {isActive ? <PauseIcon className="h-4 w-4" /> : <PlayIcon className="h-4 w-4" />}
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
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-zinc-100">
                <th className="text-left px-5 py-3 text-xs font-semibold text-zinc-400 uppercase tracking-wide">Rule name</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-zinc-400 uppercase tracking-wide">Anchor</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-zinc-400 uppercase tracking-wide">Conditionals</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-zinc-400 uppercase tracking-wide">Status</th>
                <th className="text-right px-5 py-3 text-xs font-semibold text-zinc-400 uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rules.length === 0 ? (
                <EmptyRow colSpan={5} message="No conditional rules yet. Create one to get started." />
              ) : (
                rules.map(rule => (
                  <tr
                    key={rule.id}
                    onClick={() => navigate(`/monitor/rules/${rule.id}/edit`)}
                    className="border-b border-zinc-50 hover:bg-zinc-50 cursor-pointer"
                  >
                    <td className="px-5 py-3 text-sm font-medium text-zinc-900">{rule.name || `Rule ${rule.id?.slice(0, 6)}`}</td>
                    <td className="px-5 py-3 text-sm text-zinc-500 font-mono">
                      {rule.anchor?.parameter} = {rule.anchor?.value}
                    </td>
                    <td className="px-5 py-3 text-sm text-zinc-400">
                      {Object.keys(rule.conditionals || {}).join(', ') || '—'}
                    </td>
                    <td className="px-5 py-3">
                      <Badge variant={rule.active ? 'active' : 'paused'}>{rule.active ? 'Active' : 'Paused'}</Badge>
                    </td>
                    <td className="px-5 py-3" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-3">
                        <button
                          onClick={() => navigate(`/monitor/rules/${rule.id}/edit`)}
                          className={iconBtn}
                          title="Edit"
                        >
                          <PencilIcon className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleToggleRule(rule.id)}
                          className={iconBtn}
                          title={rule.active ? 'Pause' : 'Activate'}
                        >
                          {rule.active ? <PauseIcon className="h-4 w-4" /> : <PlayIcon className="h-4 w-4" />}
                        </button>
                        <button
                          onClick={() => handleDeleteRule(rule.id)}
                          className={iconBtnDanger}
                          title="Delete"
                        >
                          <TrashIcon className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>

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
