import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useOrg } from '../../contexts/OrgContext'
import { useAuth } from '../../contexts/AuthContext'
import { usePermissions } from '../../hooks/usePermissions'
import { useConfiguration } from '../../hooks/useConfiguration'
import { writeAuditLog } from '../../lib/auditLog'
import Modal from '../../components/ui/Modal'

const DEFAULT_PARAMS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term']

function Spinner() {
  return (
    <div className="flex items-center justify-center py-16">
      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-teal-600" />
    </div>
  )
}

function formatDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function ParameterRow({ param, onChange, onRemove, globalAllowedValues }) {
  return (
    <div className="grid grid-cols-12 gap-2 items-start py-2 border-b border-zinc-100 last:border-0">
      <div className="col-span-3">
        <select
          value={param.name}
          onChange={e => onChange({ ...param, name: e.target.value })}
          className="w-full px-2 py-1.5 border border-zinc-200 text-sm focus:outline-none focus:ring-1 focus:ring-teal-600"
        >
          {DEFAULT_PARAMS.map(p => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
      </div>
      <div className="col-span-2 flex items-center gap-3 pt-2">
        <label className="flex items-center gap-1 text-xs text-zinc-600 cursor-pointer">
          <input
            type="checkbox"
            checked={param.required}
            onChange={e => onChange({ ...param, required: e.target.checked })}
            className="h-3.5 w-3.5"
          />
          Required
        </label>
      </div>
      <div className="col-span-2 flex items-center gap-3 pt-2">
        <label className="flex items-center gap-1 text-xs text-zinc-600 cursor-pointer">
          <input
            type="checkbox"
            checked={param.locked}
            onChange={e => onChange({ ...param, locked: e.target.checked })}
            className="h-3.5 w-3.5"
          />
          Locked
        </label>
      </div>
      <div className="col-span-4">
        <select
          multiple
          value={param.allowedValues || []}
          onChange={e => onChange({
            ...param,
            allowedValues: Array.from(e.target.selectedOptions, o => o.value)
          })}
          className="w-full px-2 py-1 border border-zinc-200 text-xs focus:outline-none focus:ring-1 focus:ring-teal-600"
          size={3}
        >
          {(globalAllowedValues || []).map(v => (
            <option key={v} value={v}>{v}</option>
          ))}
        </select>
        <p className="text-xs text-zinc-400 mt-0.5">Allowed values (subset of global)</p>
      </div>
      <div className="col-span-1 pt-1.5">
        <button
          type="button"
          onClick={onRemove}
          className="text-zinc-300 hover:text-red-400 text-lg leading-none"
        >
          ×
        </button>
      </div>
    </div>
  )
}

function TemplateEditor({ template, onSave, onCancel, globalConfig, orgParams }) {
  const [name, setName] = useState(template?.name || '')
  const [description, setDescription] = useState(template?.description || '')
  const [params, setParams] = useState(template?.parameters || [
    { name: 'utm_source', required: true, locked: false, allowedValues: [] },
    { name: 'utm_medium', required: true, locked: false, allowedValues: [] },
    { name: 'utm_campaign', required: true, locked: false, allowedValues: [] },
  ])
  const [saving, setSaving] = useState(false)

  function addParam() {
    const used = params.map(p => p.name)
    const next = orgParams.find(p => !used.includes(p)) || 'utm_source'
    setParams(prev => [...prev, { name: next, required: false, locked: false, allowedValues: [] }])
  }

  return (
    <div className="bg-zinc-50 border border-zinc-200 p-5 space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">Template name *</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            required
            placeholder="e.g. Paid Search"
            className="w-full px-3 py-2 border border-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-600 bg-white"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">Description</label>
          <input
            type="text"
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="What is this channel used for?"
            className="w-full px-3 py-2 border border-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-600 bg-white"
          />
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-medium text-zinc-700">Parameters</p>
          <button
            type="button"
            onClick={addParam}
            className="text-xs text-teal-600 hover:underline"
          >
            + Add parameter
          </button>
        </div>
        <div className="grid grid-cols-12 gap-2 mb-1">
          {['Parameter', 'Required', 'Locked', 'Allowed values (Ctrl+click)', ''].map(h => (
            <div key={h} className={`text-xs font-semibold text-zinc-400 uppercase tracking-wide ${
              h === 'Parameter' ? 'col-span-3'
              : h === 'Allowed values (Ctrl+click)' ? 'col-span-4'
              : h === '' ? 'col-span-1'
              : 'col-span-2'
            }`}>{h}</div>
          ))}
        </div>
        {params.map((param, i) => (
          <ParameterRow
            key={i}
            param={param}
            onChange={updated => setParams(prev => prev.map((p, idx) => idx === i ? updated : p))}
            onRemove={() => setParams(prev => prev.filter((_, idx) => idx !== i))}
            globalAllowedValues={globalConfig?.allowedValues?.[param.name] || []}
          />
        ))}
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={saving || !name}
          onClick={async () => {
            setSaving(true)
            await onSave({ name, description, parameters: params })
            setSaving(false)
          }}
          className="bg-teal-600 text-white rounded-full px-4 py-1.5 text-sm font-medium hover:bg-teal-700 disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save template'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="bg-white text-zinc-700 border border-zinc-200 rounded-full px-4 py-1.5 text-sm hover:bg-zinc-50"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

export default function ChannelTemplates() {
  const { currentOrg } = useOrg()
  const { user } = useAuth()
  const { isAdmin, isManager } = usePermissions()
  const { config } = useConfiguration()
  const canManage = isAdmin || isManager

  const [tab, setTab] = useState('active')
  const [templates, setTemplates] = useState([])
  const [suggestions, setSuggestions] = useState([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState(null)
  const [creating, setCreating] = useState(false)

  const orgParams = currentOrg?.triggerParameters || DEFAULT_PARAMS

  useEffect(() => {
    if (currentOrg?.id) { loadTemplates(); loadSuggestions() }
  }, [currentOrg?.id])

  async function loadTemplates() {
    setLoading(true)
    const { data } = await supabase
      .from('channel_templates')
      .select('*')
      .eq('organization_id', currentOrg.id)
      .order('name')
    setTemplates(data || [])
    setLoading(false)
  }

  async function loadSuggestions() {
    const { data } = await supabase
      .from('channel_template_suggestions')
      .select('*')
      .eq('organization_id', currentOrg.id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
    setSuggestions(data || [])
  }

  async function handleCreateTemplate({ name, description, parameters }) {
    const { error } = await supabase.from('channel_templates').insert({
      organization_id: currentOrg.id,
      name,
      description,
      parameters,
      created_by: user?.id,
      created_by_email: user?.email,
      status: 'active',
      suggestion_status: 'approved',
    })
    if (!error) {
      await writeAuditLog({
        organizationId: currentOrg.id,
        userId: user?.id,
        userEmail: user?.email,
        action: 'channel_template_approved',
        entityType: 'account',
        metadata: { templateName: name },
      })
      setCreating(false)
      loadTemplates()
    }
  }

  async function handleUpdateTemplate(id, data) {
    await supabase.from('channel_templates').update(data).eq('id', id)
    setEditingId(null)
    loadTemplates()
  }

  async function handleArchive(template) {
    if (!confirm(`Archive "${template.name}"?`)) return
    await supabase.from('channel_templates').update({ status: 'archived' }).eq('id', template.id)
    loadTemplates()
  }

  async function handleApproveSuggestion(suggestion) {
    const { error } = await supabase.from('channel_templates').insert({
      organization_id: currentOrg.id,
      name: suggestion.name,
      description: suggestion.description,
      parameters: suggestion.parameters,
      created_by: suggestion.suggested_by,
      created_by_email: suggestion.suggested_by_email,
      approved_by: user?.id,
      approved_at: new Date().toISOString(),
      status: 'active',
      suggestion_status: 'approved',
    })
    if (!error) {
      await supabase.from('channel_template_suggestions')
        .update({ status: 'approved', reviewed_by: user?.id, reviewed_at: new Date().toISOString() })
        .eq('id', suggestion.id)
      await writeAuditLog({
        organizationId: currentOrg.id,
        userId: user?.id,
        userEmail: user?.email,
        action: 'channel_template_approved',
        entityType: 'account',
        metadata: { templateName: suggestion.name },
      })
      loadTemplates()
      loadSuggestions()
    }
  }

  async function handleRejectSuggestion(suggestion) {
    await supabase.from('channel_template_suggestions')
      .update({ status: 'rejected', reviewed_by: user?.id, reviewed_at: new Date().toISOString() })
      .eq('id', suggestion.id)
    loadSuggestions()
  }

  const active = templates.filter(t => t.status === 'active')
  const archived = templates.filter(t => t.status === 'archived')

  return (
    <div className="space-y-5 max-w-5xl">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-zinc-900">Channel Templates</h1>
        {canManage && !creating && (
          <button
            onClick={() => setCreating(true)}
            className="bg-teal-600 text-white rounded-full px-4 py-1.5 text-sm font-medium hover:bg-teal-700"
          >
            + Create template
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-zinc-200">
        {[
          { key: 'active', label: `Active (${active.length})` },
          { key: 'suggestions', label: `Suggestions${suggestions.length > 0 ? ` (${suggestions.length})` : ''}` },
          { key: 'archived', label: `Archived (${archived.length})` },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${
              tab === t.key
                ? 'border-teal-600 text-teal-700'
                : 'border-transparent text-zinc-500 hover:text-zinc-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Create form */}
      {creating && tab === 'active' && (
        <TemplateEditor
          onSave={handleCreateTemplate}
          onCancel={() => setCreating(false)}
          globalConfig={config}
          orgParams={orgParams}
        />
      )}

      {loading ? <Spinner /> : (
        <>
          {tab === 'active' && (
            <div className="bg-white border border-zinc-200 overflow-hidden">
              {active.length === 0 && !creating ? (
                <div className="text-center py-12 text-sm text-zinc-400">
                  No templates yet.{' '}
                  {canManage && (
                    <button onClick={() => setCreating(true)} className="text-teal-600 hover:underline">
                      Create the first one
                    </button>
                  )}
                </div>
              ) : (
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-zinc-100">
                      {['Template', 'Parameters', 'Created', 'Actions'].map(col => (
                        <th key={col} className="text-left px-5 py-3 text-xs font-semibold text-zinc-400 uppercase tracking-wide">
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {active.map(tpl => (
                      <>
                        <tr key={tpl.id} className="border-b border-zinc-50 hover:bg-zinc-50">
                          <td className="px-5 py-3">
                            <p className="text-sm font-medium text-zinc-900">{tpl.name}</p>
                            {tpl.description && (
                              <p className="text-xs text-zinc-400 mt-0.5">{tpl.description}</p>
                            )}
                          </td>
                          <td className="px-5 py-3">
                            <div className="flex flex-wrap gap-1">
                              {(tpl.parameters || []).map(p => (
                                <span key={p.name} className={`text-xs px-2 py-0.5 rounded-full font-mono ${
                                  p.required ? 'bg-teal-50 text-teal-700' : 'bg-zinc-100 text-zinc-500'
                                }`}>
                                  {p.name}{p.locked ? ' 🔒' : ''}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="px-5 py-3 text-sm text-zinc-400">
                            {formatDate(tpl.created_at)}
                          </td>
                          <td className="px-5 py-3 text-right">
                            {canManage && (
                              <div className="flex items-center gap-3 justify-end">
                                <button
                                  onClick={() => setEditingId(editingId === tpl.id ? null : tpl.id)}
                                  className="text-xs text-zinc-500 hover:text-zinc-900"
                                >
                                  Edit
                                </button>
                                <button
                                  onClick={() => handleArchive(tpl)}
                                  className="text-xs text-red-400 hover:text-red-600"
                                >
                                  Archive
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                        {editingId === tpl.id && (
                          <tr key={`${tpl.id}-edit`}>
                            <td colSpan={4} className="px-5 py-3">
                              <TemplateEditor
                                template={tpl}
                                onSave={data => handleUpdateTemplate(tpl.id, data)}
                                onCancel={() => setEditingId(null)}
                                globalConfig={config}
                                orgParams={orgParams}
                              />
                            </td>
                          </tr>
                        )}
                      </>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {tab === 'suggestions' && (
            <div className="bg-white border border-zinc-200 overflow-hidden">
              {suggestions.length === 0 ? (
                <div className="text-center py-12 text-sm text-zinc-400">No pending suggestions.</div>
              ) : (
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-zinc-100">
                      {['Template', 'Suggested by', 'Date', 'Actions'].map(col => (
                        <th key={col} className="text-left px-5 py-3 text-xs font-semibold text-zinc-400 uppercase tracking-wide">
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {suggestions.map(s => (
                      <tr key={s.id} className="border-b border-zinc-50 hover:bg-zinc-50">
                        <td className="px-5 py-3">
                          <p className="text-sm font-medium text-zinc-900">{s.name}</p>
                          {s.description && <p className="text-xs text-zinc-400 mt-0.5">{s.description}</p>}
                        </td>
                        <td className="px-5 py-3 text-sm text-zinc-500">
                          {s.suggested_by_email || '—'}
                        </td>
                        <td className="px-5 py-3 text-sm text-zinc-400">
                          {formatDate(s.created_at)}
                        </td>
                        <td className="px-5 py-3 text-right">
                          {canManage && (
                            <div className="flex items-center gap-3 justify-end">
                              <button
                                onClick={() => handleApproveSuggestion(s)}
                                className="text-xs text-teal-600 hover:text-teal-700 font-medium"
                              >
                                Approve
                              </button>
                              <button
                                onClick={() => handleRejectSuggestion(s)}
                                className="text-xs text-red-400 hover:text-red-600"
                              >
                                Reject
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {tab === 'archived' && (
            <div className="bg-white border border-zinc-200 overflow-hidden">
              {archived.length === 0 ? (
                <div className="text-center py-12 text-sm text-zinc-400">No archived templates.</div>
              ) : (
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-zinc-100">
                      {['Template', 'Parameters', 'Archived'].map(col => (
                        <th key={col} className="text-left px-5 py-3 text-xs font-semibold text-zinc-400 uppercase tracking-wide">
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {archived.map(tpl => (
                      <tr key={tpl.id} className="border-b border-zinc-50 opacity-60">
                        <td className="px-5 py-3">
                          <p className="text-sm font-medium text-zinc-900">{tpl.name}</p>
                        </td>
                        <td className="px-5 py-3 text-xs text-zinc-400">
                          {(tpl.parameters || []).map(p => p.name).join(', ')}
                        </td>
                        <td className="px-5 py-3 text-sm text-zinc-400">
                          {formatDate(tpl.updated_at)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
