import { useNavigate } from 'react-router-dom'
import { PlusIcon, PencilIcon, TrashIcon } from '@heroicons/react/24/outline'
import { useConfiguration } from '../../hooks/useConfiguration'
import { useOrg } from '../../contexts/OrgContext'
import { saveConfiguration } from '../../lib/api'
import Button from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'
import EmptyState from '../../components/ui/EmptyState'

export default function ConditionalRules() {
  const { config, loading, reload } = useConfiguration()
  const { currentOrg } = useOrg()
  const navigate = useNavigate()

  const rules = config?.conditionalRules || []

  const handleDelete = async (ruleId) => {
    if (!confirm('Delete this rule?')) return
    const updated = rules.filter(r => r.id !== ruleId)
    await saveConfiguration(currentOrg.firestore_api_key, { ...config, conditionalRules: updated })
    await reload()
  }

  const handleToggle = async (ruleId) => {
    const updated = rules.map(r => r.id === ruleId ? { ...r, active: !r.active } : r)
    await saveConfiguration(currentOrg.firestore_api_key, { ...config, conditionalRules: updated })
    await reload()
  }

  if (loading) return <div className="flex items-center justify-center py-16"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600" /></div>

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-zinc-900">Conditional rules</h2>
          <p className="text-xs text-zinc-500 mt-0.5">Rules that trigger based on anchor parameter values</p>
        </div>
        <Button onClick={() => navigate('/monitor/rules/new')} size="sm">
          <PlusIcon className="h-4 w-4 mr-1.5" /> Create rule
        </Button>
      </div>

      {rules.length === 0 ? (
        <EmptyState
          icon="⚙️"
          title="No conditional rules"
          description="Create rules that apply only when a specific parameter has a particular value."
          action={<Button onClick={() => navigate('/monitor/rules/new')} size="sm"><PlusIcon className="h-4 w-4 mr-1.5" />Create your first rule</Button>}
        />
      ) : (
        <div className="bg-white rounded-2xl border border-zinc-200 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-zinc-100">
                <th className="text-left px-6 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wide">Rule</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wide">Anchor</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wide">Conditionals</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wide">Status</th>
                <th className="text-right px-6 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-50">
              {rules.map(rule => (
                <tr key={rule.id} className="hover:bg-zinc-50">
                  <td className="px-6 py-4">
                    <span className="text-sm font-medium text-zinc-900">{rule.name || `Rule ${rule.id?.slice(0, 6)}`}</span>
                    <p className="text-xs text-zinc-400 mt-0.5">{rule.createdAt ? new Date(rule.createdAt).toLocaleDateString() : ''}</p>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm font-mono text-zinc-700">{rule.anchor?.parameter}</span>
                    {rule.anchor?.value && <span className="text-xs text-zinc-500 ml-1">= {rule.anchor.value}</span>}
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-zinc-600">{Object.keys(rule.conditionals || {}).join(', ') || '—'}</span>
                  </td>
                  <td className="px-6 py-4">
                    <Badge variant={rule.active ? 'active' : 'paused'}>{rule.active ? 'Active' : 'Paused'}</Badge>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => handleToggle(rule.id)} className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 text-xs">
                        {rule.active ? 'Pause' : 'Resume'}
                      </button>
                      <button onClick={() => navigate(`/monitor/rules/${rule.id}/edit`)} className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100">
                        <PencilIcon className="h-4 w-4" />
                      </button>
                      <button onClick={() => handleDelete(rule.id)} className="p-1.5 rounded-lg text-zinc-400 hover:text-red-500 hover:bg-red-50">
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
