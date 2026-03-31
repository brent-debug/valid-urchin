import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PlusIcon } from '@heroicons/react/24/outline'
import { useConfiguration } from '../../hooks/useConfiguration'
import { useOrg } from '../../contexts/OrgContext'
import { saveConfiguration } from '../../lib/api'
import Button from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'
import Modal from '../../components/ui/Modal'
import EmptyState from '../../components/ui/EmptyState'

export default function ParameterList() {
  const { config, loading, error, reload } = useConfiguration()
  const { currentOrg } = useOrg()
  const navigate = useNavigate()
  const [showAdd, setShowAdd] = useState(false)
  const [newParamName, setNewParamName] = useState('')
  const [adding, setAdding] = useState(false)
  const [addError, setAddError] = useState('')

  const parameters = config?.monitoredParameters || {}

  const getStatus = (paramData) => {
    if (paramData.status === 'draft') return 'draft'
    if (paramData.active) return 'active'
    return 'paused'
  }

  const handleAddParameter = async () => {
    const name = newParamName.trim().toLowerCase()
    if (!name) { setAddError('Name is required'); return }
    if (parameters[name]) { setAddError('Parameter already exists'); return }

    setAdding(true)
    setAddError('')
    try {
      const updated = {
        ...config,
        monitoredParameters: {
          ...parameters,
          [name]: { active: false, status: 'draft', created: new Date().toISOString() },
        },
      }
      await saveConfiguration(currentOrg.firestore_api_key, updated)
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

  if (loading) return <div className="flex items-center justify-center py-16"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600" /></div>

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-zinc-900">Parameters</h2>
          <p className="text-xs text-zinc-500 mt-0.5">UTM parameters your rules apply to</p>
        </div>
        <Button onClick={() => setShowAdd(true)} size="sm">
          <PlusIcon className="h-4 w-4 mr-1.5" /> Add parameter
        </Button>
      </div>

      {error && <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">{error}</div>}

      {Object.keys(parameters).length === 0 ? (
        <EmptyState
          icon="📊"
          title="No parameters yet"
          description="Add UTM parameters to start monitoring and validating values."
          action={<Button onClick={() => setShowAdd(true)} size="sm"><PlusIcon className="h-4 w-4 mr-1.5" />Add your first parameter</Button>}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {Object.entries(parameters).map(([name, data]) => {
            const status = getStatus(data)
            return (
              <button
                key={name}
                onClick={() => navigate(`/monitor/parameters/${name}`)}
                className="bg-white rounded-xl border border-zinc-200 p-4 text-left hover:border-primary-300 hover:shadow-sm transition-all group"
              >
                <div className="flex items-start justify-between">
                  <span className="text-sm font-medium text-zinc-900 group-hover:text-primary-700 font-mono">{name}</span>
                  <Badge variant={status}>{status.charAt(0).toUpperCase() + status.slice(1)}</Badge>
                </div>
                <p className="text-xs text-zinc-400 mt-2">
                  {(config?.allowedValues?.[name]?.length || 0)} allowed values
                </p>
              </button>
            )
          })}
        </div>
      )}

      <Modal open={showAdd} onClose={() => { setShowAdd(false); setNewParamName(''); setAddError('') }} title="Add parameter">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">Parameter name</label>
            <input
              type="text"
              value={newParamName}
              onChange={e => setNewParamName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAddParameter()}
              className="w-full px-3 py-2 rounded-lg border border-zinc-200 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary-600"
              placeholder="e.g. utm_source"
              autoFocus
            />
            {addError && <p className="text-xs text-red-600 mt-1">{addError}</p>}
            <p className="text-xs text-zinc-500 mt-1">Added as Draft — activate it once you've set allowed values.</p>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setShowAdd(false)}>Cancel</Button>
            <Button onClick={handleAddParameter} disabled={adding}>{adding ? 'Adding…' : 'Add parameter'}</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
