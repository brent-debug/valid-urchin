import { useState, useEffect } from 'react'
import { useOrg } from '../../contexts/OrgContext'
import { useAuth } from '../../contexts/AuthContext'
import { usePermissions } from '../../hooks/usePermissions'
import { writeAuditLog } from '../../lib/auditLog'
import { PLANS, getDomainLimit, getEventLimit } from '../../lib/plans'
import { supabase } from '../../lib/supabase'
import Modal from '../../components/ui/Modal'
import Badge from '../../components/ui/Badge'

const TIMEZONES = [
  'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
  'America/Anchorage', 'Pacific/Honolulu', 'Europe/London', 'Europe/Paris',
  'Europe/Berlin', 'Europe/Amsterdam', 'Europe/Rome', 'Europe/Madrid',
  'Asia/Dubai', 'Asia/Kolkata', 'Asia/Singapore', 'Asia/Tokyo',
  'Asia/Shanghai', 'Australia/Sydney', 'Pacific/Auckland', 'UTC'
]

export default function OrganizationSettings() {
  const { currentOrg, refetch } = useOrg()
  const { user } = useAuth()
  const { isAdmin } = usePermissions()

  const [name, setName] = useState(currentOrg?.name || '')
  const [timezone, setTimezone] = useState(currentOrg?.timezone || 'UTC')
  const [saving, setSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState('')

  // Conflict settings
  const [conflictThreshold, setConflictThreshold] = useState(currentOrg?.conflictThreshold || 1)
  const [savingThreshold, setSavingThreshold] = useState(false)
  const [thresholdMessage, setThresholdMessage] = useState('')

  // Danger zone
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [confirmName, setConfirmName] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [deleteMessage, setDeleteMessage] = useState('')

  // Domain count for subscription display
  const [domainsUsed, setDomainsUsed] = useState(0)

  useEffect(() => {
    if (currentOrg?.name) setName(currentOrg.name)
    if (currentOrg?.timezone) setTimezone(currentOrg.timezone)
    if (currentOrg?.conflictThreshold !== undefined) setConflictThreshold(currentOrg.conflictThreshold)
  }, [currentOrg])

  useEffect(() => {
    if (!currentOrg?.id) return
    supabase
      .from('allowed_domains')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', currentOrg.id)
      .then(({ count }) => setDomainsUsed(count || 0))
  }, [currentOrg?.id])

  if (!isAdmin) {
    return (
      <div className="text-center py-16">
        <p className="text-sm font-medium text-zinc-900">Access restricted</p>
        <p className="text-xs text-zinc-500 mt-1">Only Admins can access organization settings.</p>
      </div>
    )
  }

  const plan = currentOrg?.plan || 'free'
  const planInfo = PLANS[plan]
  const eventsUsed = currentOrg?.events_this_period || 0
  const eventLimit = getEventLimit(plan)
  const domainLimit = getDomainLimit(plan)

  const handleSave = async () => {
    setSaving(true)
    setSaveMessage('')
    try {
      const { error } = await supabase
        .from('organizations')
        .update({ name, timezone })
        .eq('id', currentOrg.id)
      if (error) throw error
      await refetch()
      setSaveMessage('Saved successfully.')
    } catch (err) {
      setSaveMessage(`Error: ${err.message}`)
    } finally {
      setSaving(false)
    }
  }

  const saveConflictSettings = async () => {
    setSavingThreshold(true)
    setThresholdMessage('')
    try {
      const { error } = await supabase.from('organizations').update({ conflict_threshold: conflictThreshold }).eq('id', currentOrg.id)
      if (error) throw error
      const { data: { user: currentUser } } = await supabase.auth.getUser()
      await writeAuditLog({
        organizationId: currentOrg.id,
        userId: currentUser?.id,
        userEmail: currentUser?.email,
        action: 'org_settings_updated',
        entityType: 'account',
        metadata: { field: 'conflict_threshold', newValue: conflictThreshold }
      })
      setThresholdMessage('Saved.')
      await refetch()
    } catch (err) {
      setThresholdMessage(`Error: ${err.message}`)
    } finally {
      setSavingThreshold(false)
    }
  }

  const handleDeleteRequest = async () => {
    if (confirmName !== currentOrg?.name) return
    setDeleting(true)
    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser()
      const { error } = await supabase
        .from('organizations')
        .update({
          deletion_requested_at: new Date().toISOString(),
          deletion_requested_by: currentUser?.id,
        })
        .eq('id', currentOrg.id)
      if (error) throw error
      await writeAuditLog({
        organizationId: currentOrg.id,
        userId: currentUser?.id,
        userEmail: currentUser?.email,
        action: 'account_deletion_requested',
        entityType: 'account',
      })
      setShowDeleteModal(false)
      setConfirmName('')
      setDeleteMessage('Deletion request submitted. Our team will process this within 30 days.')
    } catch (err) {
      setDeleteMessage(`Error: ${err.message}`)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <h1 className="text-xl font-semibold text-zinc-900">Organization Settings</h1>

      {/* Company Details */}
      <div className="border border-zinc-200 p-6 space-y-4 bg-white">
        <h2 className="text-sm font-semibold text-zinc-900">Company Details</h2>
        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">Organization name</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            className="w-full px-3 py-2 border border-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-600"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">Timezone</label>
          <select
            value={timezone}
            onChange={e => setTimezone(e.target.value)}
            className="w-full px-3 py-2 border border-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-600"
          >
            {TIMEZONES.map(tz => (
              <option key={tz} value={tz}>{tz}</option>
            ))}
          </select>
        </div>
        {saveMessage && (
          <p className={`text-sm ${saveMessage.startsWith('Error') ? 'text-red-600' : 'text-emerald-600'}`}>
            {saveMessage}
          </p>
        )}
        <button
          onClick={handleSave}
          disabled={saving}
          className="bg-teal-600 text-white rounded-full px-4 py-2 text-sm font-medium hover:bg-teal-700 disabled:opacity-50 transition-colors"
        >
          {saving ? 'Saving…' : 'Save changes'}
        </button>
      </div>

      {/* Subscription Details */}
      <div className="border border-zinc-200 p-6 space-y-4 bg-white">
        <h2 className="text-sm font-semibold text-zinc-900">Subscription Details</h2>
        <div className="flex items-center gap-3">
          <span className="text-sm text-zinc-600">Current plan:</span>
          <Badge variant="active">{planInfo?.name || plan}</Badge>
        </div>
        <div className="space-y-1 text-sm text-zinc-600">
          <p>{eventsUsed.toLocaleString()} / {eventLimit ? eventLimit.toLocaleString() : '∞'} events this month</p>
          <p>{domainsUsed} / {domainLimit === null ? '∞' : domainLimit} domains</p>
          {currentOrg?.period_reset_at && (
            <p className="text-xs text-zinc-400">
              Resets: {new Date(currentOrg.period_reset_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
            </p>
          )}
        </div>
        <a href="/settings/plan" className="text-sm text-teal-600 hover:text-teal-700">Manage plan →</a>
      </div>

      {/* Export Data */}
      <div className="border border-zinc-200 p-6 space-y-4 bg-white">
        <h2 className="text-sm font-semibold text-zinc-900">Export Account Data</h2>
        <p className="text-sm text-zinc-500">Download all your configuration, conflicts, and event data as JSON.</p>
        <button
          disabled
          title="Coming soon"
          className="opacity-50 cursor-not-allowed bg-white text-zinc-700 border border-zinc-200 px-4 py-2 text-sm"
        >
          Request Export
        </button>
      </div>

      {/* Conflict Settings */}
      <div className="border border-zinc-200 p-6 space-y-4 bg-white">
        <h2 className="text-sm font-semibold text-zinc-900">Conflict Settings</h2>
        <p className="text-sm text-zinc-500">Control when conflicts are surfaced to reduce noise from bots and one-off errors.</p>
        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">
            Minimum occurrences to surface a conflict
          </label>
          <p className="text-xs text-zinc-400 mb-3">
            Conflicts must reach this threshold before appearing in your conflict log.
            Helps filter out bots and one-off errors.
          </p>
          <div className="flex items-center gap-4">
            <input
              type="range"
              min={1}
              max={100}
              value={conflictThreshold}
              onChange={e => setConflictThreshold(parseInt(e.target.value))}
              className="flex-1 accent-teal-600"
            />
            <input
              type="number"
              min={1}
              max={100}
              value={conflictThreshold}
              onChange={e => setConflictThreshold(Math.min(100, Math.max(1, parseInt(e.target.value) || 1)))}
              className="w-14 text-center px-2 py-1 border border-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-600"
            />
          </div>
          <div className="flex justify-between text-xs text-zinc-400 mt-1">
            <span>1 — show all</span>
            <span>50 — high traffic filter</span>
            <span>100 — strict</span>
          </div>
        </div>
        {thresholdMessage && <p className={`text-sm ${thresholdMessage.startsWith('Error') ? 'text-red-600' : 'text-emerald-600'}`}>{thresholdMessage}</p>}
        <button
          onClick={saveConflictSettings}
          disabled={savingThreshold}
          className="bg-teal-600 text-white rounded-full px-4 py-2 text-sm font-medium hover:bg-teal-700 disabled:opacity-50"
        >
          {savingThreshold ? 'Saving…' : 'Save'}
        </button>
      </div>

      {/* Danger Zone */}
      <div className="border border-red-200 p-6 space-y-4 bg-white">
        <h2 className="text-red-600 font-semibold text-sm">Danger Zone</h2>
        <p className="text-sm text-zinc-500">
          Permanently delete this organization and all associated data. This action cannot be undone.
        </p>
        {deleteMessage && (
          <p className={`text-sm ${deleteMessage.startsWith('Error') ? 'text-red-600' : 'text-emerald-600'}`}>
            {deleteMessage}
          </p>
        )}
        <button
          onClick={() => setShowDeleteModal(true)}
          className="bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 px-4 py-2 text-sm transition-colors"
        >
          Request Account Deletion
        </button>
      </div>

      {/* Delete confirmation modal */}
      <Modal
        open={showDeleteModal}
        onClose={() => { setShowDeleteModal(false); setConfirmName('') }}
        title="Request Account Deletion"
      >
        <div className="space-y-4">
          <p className="text-sm text-zinc-700">
            This will submit a deletion request for <strong>{currentOrg?.name}</strong> and all its data.
            This action cannot be undone.
          </p>
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">
              Type <span className="font-mono text-zinc-900">{currentOrg?.name}</span> to confirm
            </label>
            <input
              type="text"
              value={confirmName}
              onChange={e => setConfirmName(e.target.value)}
              placeholder={currentOrg?.name}
              className="w-full px-3 py-2 border border-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              onClick={() => { setShowDeleteModal(false); setConfirmName('') }}
              className="bg-white text-zinc-700 border border-zinc-200 rounded-full px-4 py-2 text-sm hover:bg-zinc-50"
            >
              Cancel
            </button>
            <button
              onClick={handleDeleteRequest}
              disabled={deleting || confirmName !== currentOrg?.name}
              className="bg-red-600 text-white px-4 py-2 text-sm font-medium hover:bg-red-700 disabled:opacity-50 transition-colors"
            >
              {deleting ? 'Processing…' : 'Confirm deletion'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
