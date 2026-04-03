import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useOrg } from '../../contexts/OrgContext'
import { useAuth } from '../../contexts/AuthContext'
import { usePermissions } from '../../hooks/usePermissions'
import { useConfiguration } from '../../hooks/useConfiguration'
import { writeAuditLog } from '../../lib/auditLog'

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

const STATUS_FILTERS = ['Pending', 'Approved', 'Rejected', 'All']

export default function ValueRequests() {
  const { currentOrg } = useOrg()
  const { user } = useAuth()
  const { isAdmin, isManager } = usePermissions()
  const { config, save: saveConfig } = useConfiguration()
  const canManage = isAdmin || isManager

  const [requests, setRequests] = useState([])
  const [campaigns, setCampaigns] = useState({})
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('Pending')
  const [rejectingId, setRejectingId] = useState(null)
  const [rejectNote, setRejectNote] = useState('')

  useEffect(() => {
    if (currentOrg?.id) loadRequests()
  }, [currentOrg?.id])

  async function loadRequests() {
    setLoading(true)
    const { data } = await supabase
      .from('value_requests')
      .select('*')
      .eq('organization_id', currentOrg.id)
      .order('created_at', { ascending: false })
    setRequests(data || [])

    // Load campaign names for context
    const campaignIds = [...new Set(
      (data || [])
        .map(r => r.context?.campaign_id)
        .filter(Boolean)
    )]
    if (campaignIds.length > 0) {
      const { data: camps } = await supabase
        .from('campaigns')
        .select('id, name')
        .in('id', campaignIds)
      const map = {}
      ;(camps || []).forEach(c => { map[c.id] = c.name })
      setCampaigns(map)
    }

    setLoading(false)
  }

  async function handleApprove(req) {
    const updates = { status: 'approved', reviewed_by: user?.id, reviewed_by_email: user?.email, reviewed_at: new Date().toISOString() }
    await supabase.from('value_requests').update(updates).eq('id', req.id)

    // For add_permanently, write to config
    if (req.request_type === 'add_permanently' && config) {
      const current = config.allowedValues?.[req.parameter] || []
      if (!current.includes(req.value)) {
        const updatedAllowedValues = {
          ...config.allowedValues,
          [req.parameter]: [...current, req.value],
        }
        await saveConfig({ allowedValues: updatedAllowedValues })
      }
    }

    await writeAuditLog({
      organizationId: currentOrg.id,
      userId: user?.id,
      userEmail: user?.email,
      action: 'value_request_approved',
      entityType: 'parameter',
      entityName: req.parameter,
      metadata: { value: req.value, requestedBy: req.requested_by_email, requestType: req.request_type },
    })

    loadRequests()
  }

  async function handleReject(req) {
    await supabase.from('value_requests').update({
      status: 'rejected',
      reviewed_by: user?.id,
      reviewed_by_email: user?.email,
      reviewed_at: new Date().toISOString(),
      reviewer_note: rejectNote || null,
    }).eq('id', req.id)
    setRejectingId(null)
    setRejectNote('')
    loadRequests()
  }

  const filtered = requests.filter(r => {
    if (statusFilter === 'All') return true
    return r.status === statusFilter.toLowerCase()
  })

  const pendingCount = requests.filter(r => r.status === 'pending').length

  return (
    <div className="space-y-5 max-w-5xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold text-zinc-900">Value Requests</h1>
          {pendingCount > 0 && (
            <span className="bg-amber-100 text-amber-700 text-xs font-semibold px-2 py-0.5 rounded-full">
              {pendingCount} pending
            </span>
          )}
        </div>
      </div>

      <p className="text-sm text-zinc-500">
        When users need to use a value not in the approved list, they can request it here.
        Approving an "add permanently" request adds the value to your allowed values list.
      </p>

      {/* Status filter */}
      <div className="flex items-center gap-2">
        {STATUS_FILTERS.map(s => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-1 rounded-full text-sm font-medium transition-colors border ${
              statusFilter === s
                ? 'bg-teal-600 text-white border-teal-600'
                : 'bg-white text-zinc-500 border-zinc-200 hover:border-zinc-300 hover:text-zinc-700'
            }`}
          >
            {s}
            {s === 'Pending' && pendingCount > 0 && (
              <span className="ml-1.5 bg-amber-200 text-amber-800 text-xs px-1.5 py-0.5 rounded-full">
                {pendingCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {loading ? <Spinner /> : (
        <div className="bg-white border border-zinc-200 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-zinc-100">
                {['Parameter', 'Value', 'Type', 'Requested by', 'Context', 'Reason', 'Status', 'Actions'].map(col => (
                  <th key={col} className="text-left px-5 py-3 text-xs font-semibold text-zinc-400 uppercase tracking-wide">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-5 py-12 text-center text-sm text-zinc-400">
                    No {statusFilter.toLowerCase()} requests.
                  </td>
                </tr>
              ) : filtered.map(req => (
                <>
                  <tr key={req.id} className="border-b border-zinc-50 hover:bg-zinc-50">
                    <td className="px-5 py-3 font-mono text-sm text-zinc-900">{req.parameter}</td>
                    <td className="px-5 py-3 font-mono text-sm text-zinc-700">{req.value}</td>
                    <td className="px-5 py-3">
                      {req.request_type === 'one_time' ? (
                        <span className="text-xs bg-amber-50 text-amber-700 border border-amber-100 px-2 py-0.5 rounded-full">
                          One-time
                        </span>
                      ) : (
                        <span className="text-xs bg-blue-50 text-blue-700 border border-blue-100 px-2 py-0.5 rounded-full">
                          Add permanently
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-sm text-zinc-500">
                      <div>{req.requested_by_email || '—'}</div>
                      <div className="text-xs text-zinc-400">{formatDate(req.created_at)}</div>
                    </td>
                    <td className="px-5 py-3 text-sm text-zinc-500">
                      {req.context?.campaign_id ? (
                        <a
                          href={`/campaigns/${req.context.campaign_id}`}
                          className="text-teal-600 hover:underline text-xs"
                        >
                          {campaigns[req.context.campaign_id] || 'Campaign'}
                        </a>
                      ) : '—'}
                    </td>
                    <td className="px-5 py-3 text-sm text-zinc-500 max-w-[160px]">
                      <span className="block truncate">{req.reason || '—'}</span>
                    </td>
                    <td className="px-5 py-3">
                      {req.status === 'pending' && (
                        <span className="text-xs bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full">Pending</span>
                      )}
                      {req.status === 'approved' && (
                        <span className="text-xs bg-teal-50 text-teal-700 px-2 py-0.5 rounded-full">Approved</span>
                      )}
                      {req.status === 'rejected' && (
                        <span className="text-xs bg-red-50 text-red-600 px-2 py-0.5 rounded-full">Rejected</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-right">
                      {canManage && req.status === 'pending' && (
                        <div className="flex items-center gap-3 justify-end">
                          <button
                            onClick={() => handleApprove(req)}
                            className="text-xs text-teal-600 hover:text-teal-700 font-medium"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => setRejectingId(req.id)}
                            className="text-xs text-red-400 hover:text-red-600"
                          >
                            Reject
                          </button>
                        </div>
                      )}
                      {req.status !== 'pending' && req.reviewer_note && (
                        <span className="text-xs text-zinc-400">Note: {req.reviewer_note}</span>
                      )}
                    </td>
                  </tr>
                  {rejectingId === req.id && (
                    <tr key={`${req.id}-reject`} className="bg-zinc-50">
                      <td colSpan={8} className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <input
                            type="text"
                            value={rejectNote}
                            onChange={e => setRejectNote(e.target.value)}
                            placeholder="Optional rejection note"
                            className="flex-1 px-3 py-1.5 border border-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-600"
                            autoFocus
                          />
                          <button
                            onClick={() => handleReject(req)}
                            className="bg-red-600 text-white rounded-full px-3 py-1.5 text-sm font-medium hover:bg-red-700"
                          >
                            Confirm reject
                          </button>
                          <button
                            onClick={() => { setRejectingId(null); setRejectNote('') }}
                            className="text-sm text-zinc-500 hover:text-zinc-700"
                          >
                            Cancel
                          </button>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
