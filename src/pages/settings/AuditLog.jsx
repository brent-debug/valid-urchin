import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useOrg } from '../../contexts/OrgContext'
import { usePermissions } from '../../hooks/usePermissions'

const ACTION_LABELS = {
  parameter_created: 'Created parameter',
  parameter_updated: 'Updated parameter',
  parameter_deleted: 'Deleted parameter',
  rule_created: 'Created conditional rule',
  rule_updated: 'Updated conditional rule',
  rule_deleted: 'Deleted conditional rule',
  conflict_allowed: 'Allowed conflict value',
  conflict_resolved: 'Marked conflict resolved',
  conflict_flagged: 'Flagged as rule issue',
  user_invited: 'Invited user',
  user_removed: 'Removed user',
  user_role_changed: 'Changed user role',
  account_data_downloaded: 'Downloaded account data',
  account_deletion_requested: 'Requested account deletion',
  campaign_created: 'Created campaign',
  campaign_updated: 'Updated campaign',
  campaign_deleted: 'Deleted campaign',
}

const PAGE_SIZE = 50

function Spinner() {
  return (
    <div className="flex items-center justify-center py-16">
      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-teal-600" />
    </div>
  )
}

export default function AuditLog() {
  const { currentOrg } = useOrg()
  const { isAdmin, isManager } = usePermissions()

  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [expandedRow, setExpandedRow] = useState(null)

  // Filters
  const [emailFilter, setEmailFilter] = useState('')
  const [actionFilter, setActionFilter] = useState('')

  useEffect(() => {
    if (!currentOrg?.id) return
    loadEntries(0)
  }, [currentOrg?.id])

  async function loadEntries(pageNum) {
    setLoading(true)
    try {
      const offset = pageNum * PAGE_SIZE
      let query = supabase
        .from('audit_log')
        .select('*')
        .eq('organization_id', currentOrg.id)
        .order('created_at', { ascending: false })
        .range(offset, offset + PAGE_SIZE - 1)

      // Managers can't see user management actions
      if (!isAdmin && isManager) {
        query = query.not('action', 'in', '("user_invited","user_removed","user_role_changed","account_deletion_requested","account_data_downloaded")')
      }

      const { data, error } = await query
      if (error) throw error
      setRows(data || [])
      setHasMore((data || []).length === PAGE_SIZE)
      setPage(pageNum)
    } catch (err) {
      console.error('Failed to load audit log:', err)
    } finally {
      setLoading(false)
    }
  }

  if (!isManager) {
    return (
      <div className="text-center py-16">
        <p className="text-sm font-medium text-zinc-900">Access restricted</p>
        <p className="text-xs text-zinc-500 mt-1">Only Admins and Managers can view the audit log.</p>
      </div>
    )
  }

  // Client-side filters
  const filtered = rows.filter(row => {
    if (emailFilter && !row.user_email?.toLowerCase().includes(emailFilter.toLowerCase())) return false
    if (actionFilter && row.action !== actionFilter) return false
    return true
  })

  const uniqueActions = [...new Set(rows.map(r => r.action).filter(Boolean))]

  return (
    <div className="space-y-4 max-w-5xl">
      <h1 className="text-xl font-semibold text-zinc-900">Audit Log</h1>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <input
          type="text"
          value={emailFilter}
          onChange={e => setEmailFilter(e.target.value)}
          placeholder="Filter by user email…"
          className="flex-1 min-w-0 px-3 py-2 border border-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-600"
        />
        <select
          value={actionFilter}
          onChange={e => setActionFilter(e.target.value)}
          className="px-3 py-2 border border-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-600"
        >
          <option value="">All actions</option>
          {uniqueActions.map(a => (
            <option key={a} value={a}>{ACTION_LABELS[a] || a}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="border border-zinc-200 bg-white overflow-hidden">
        {loading ? (
          <Spinner />
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-sm text-zinc-400">No audit log entries yet.</div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-zinc-100">
                <th className="text-left px-5 py-3 text-xs font-semibold text-zinc-400 uppercase tracking-wide">Date/Time</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-zinc-400 uppercase tracking-wide">User</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-zinc-400 uppercase tracking-wide">Action</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-zinc-400 uppercase tracking-wide">Details</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(log => (
                <>
                  <tr
                    key={log.id}
                    className={`border-b border-zinc-50 hover:bg-zinc-50 ${log.metadata?.note ? 'cursor-pointer' : ''}`}
                    onClick={() => log.metadata?.note ? setExpandedRow(expandedRow === log.id ? null : log.id) : null}
                  >
                    <td className="px-5 py-3 text-sm text-zinc-500 whitespace-nowrap">
                      {new Date(log.created_at).toLocaleString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="px-5 py-3 text-sm text-zinc-700">{log.user_email || '—'}</td>
                    <td className="px-5 py-3 text-sm text-zinc-900">
                      {ACTION_LABELS[log.action] || log.action}
                    </td>
                    <td className="px-5 py-3 text-sm text-zinc-500 max-w-xs truncate">
                      {log.entity_name || log.entity_id || JSON.stringify(log.metadata || {}).slice(0, 60)}
                      {log.metadata?.note && <span className="ml-1 text-zinc-400" title={log.metadata.note}>💬</span>}
                    </td>
                  </tr>
                  {expandedRow === log.id && log.metadata?.note && (
                    <tr key={`${log.id}-detail`}>
                      <td colSpan={4} className="px-4 pb-3 bg-zinc-50">
                        <div className="p-3 text-sm text-zinc-700 border border-zinc-200">
                          <span className="font-medium text-zinc-500 text-xs uppercase tracking-wide block mb-1">Note</span>
                          <p>{log.metadata.note}</p>
                          {log.metadata.autoResolveDays !== undefined && log.metadata.autoResolveDays !== null && (
                            <p className="mt-2 text-zinc-400 text-xs">
                              Auto-resolve: {log.metadata.autoResolveDays === null ? 'indefinitely' : `${log.metadata.autoResolveDays} days`}
                            </p>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => loadEntries(page - 1)}
          disabled={page === 0 || loading}
          className="px-4 py-2 text-sm border border-zinc-200 text-zinc-600 hover:bg-zinc-50 disabled:opacity-40 transition-colors"
        >
          ← Previous
        </button>
        <span className="text-sm text-zinc-400">Page {page + 1}</span>
        <button
          onClick={() => loadEntries(page + 1)}
          disabled={!hasMore || loading}
          className="px-4 py-2 text-sm border border-zinc-200 text-zinc-600 hover:bg-zinc-50 disabled:opacity-40 transition-colors"
        >
          Next →
        </button>
      </div>
    </div>
  )
}
