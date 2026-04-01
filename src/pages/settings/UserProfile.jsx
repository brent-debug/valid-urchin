import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { useOrg } from '../../contexts/OrgContext'
import { usePermissions } from '../../hooks/usePermissions'

function Spinner() {
  return (
    <div className="flex items-center justify-center py-16">
      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-teal-600" />
    </div>
  )
}

export default function UserProfile() {
  const { user } = useAuth()
  const { currentOrg } = useOrg()
  const { isAdmin, isManager } = usePermissions()

  const [fullName, setFullName] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState('')
  const [loadingProfile, setLoadingProfile] = useState(true)

  // Notification prefs state (disabled UI — saved for future)
  const [notifConflictsEmail, setNotifConflictsEmail] = useState(false)
  const [notifConflictsFreq, setNotifConflictsFreq] = useState('daily')
  const [notifUsageAlert, setNotifUsageAlert] = useState(false)
  const [notifUsageThresholds, setNotifUsageThresholds] = useState([])
  const [savingNotif, setSavingNotif] = useState(false)
  const [notifMessage, setNotifMessage] = useState('')

  useEffect(() => {
    if (!user?.id) return
    async function loadProfile() {
      setLoadingProfile(true)
      const { data } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle()
      if (data) {
        setFullName(data.full_name || '')
        if (data.notification_preferences) {
          const prefs = data.notification_preferences
          setNotifConflictsEmail(prefs.conflicts_email ?? false)
          setNotifConflictsFreq(prefs.conflicts_frequency ?? 'daily')
          setNotifUsageAlert(prefs.usage_alert ?? false)
          setNotifUsageThresholds(prefs.usage_thresholds ?? [])
        }
      }
      setLoadingProfile(false)
    }
    loadProfile()
  }, [user?.id])

  async function handleSaveDetails() {
    if (!user?.id || !currentOrg?.id) return
    setSaving(true)
    setSaveMessage('')
    try {
      const { error } = await supabase
        .from('user_profiles')
        .upsert({
          id: user.id,
          organization_id: currentOrg.id,
          full_name: fullName,
          updated_at: new Date().toISOString(),
        })
      if (error) throw error
      setSaveMessage('Saved successfully.')
    } catch (err) {
      setSaveMessage(`Error: ${err.message}`)
    } finally {
      setSaving(false)
    }
  }

  async function handleSaveNotifications() {
    if (!user?.id || !currentOrg?.id) return
    setSavingNotif(true)
    setNotifMessage('')
    try {
      const notification_preferences = {
        conflicts_email: notifConflictsEmail,
        conflicts_frequency: notifConflictsFreq,
        usage_alert: notifUsageAlert,
        usage_thresholds: notifUsageThresholds,
      }
      const { error } = await supabase
        .from('user_profiles')
        .upsert({
          id: user.id,
          organization_id: currentOrg.id,
          full_name: fullName,
          notification_preferences,
          updated_at: new Date().toISOString(),
        })
      if (error) throw error
      setNotifMessage('Preferences saved.')
    } catch (err) {
      setNotifMessage(`Error: ${err.message}`)
    } finally {
      setSavingNotif(false)
    }
  }

  function toggleThreshold(val) {
    setNotifUsageThresholds(prev =>
      prev.includes(val) ? prev.filter(v => v !== val) : [...prev, val]
    )
  }

  if (loadingProfile) return <Spinner />

  return (
    <div className="space-y-6 max-w-3xl">
      <h1 className="text-xl font-semibold text-zinc-900">Profile</h1>

      {/* Personal Details */}
      <div className="border border-zinc-200 p-6 space-y-4 bg-white">
        <h2 className="text-sm font-semibold text-zinc-900">Personal Details</h2>
        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">Full name</label>
          <input
            type="text"
            value={fullName}
            onChange={e => setFullName(e.target.value)}
            placeholder="Your full name"
            className="w-full px-3 py-2 border border-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-600"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">Email address</label>
          <input
            type="email"
            value={user?.email || ''}
            disabled
            className="w-full px-3 py-2 border border-zinc-200 text-sm bg-zinc-50 text-zinc-500"
          />
          <p className="text-xs text-zinc-400 mt-1">Email cannot be changed here.</p>
        </div>
        {saveMessage && (
          <p className={`text-sm ${saveMessage.startsWith('Error') ? 'text-red-600' : 'text-emerald-600'}`}>
            {saveMessage}
          </p>
        )}
        <button
          onClick={handleSaveDetails}
          disabled={saving}
          className="bg-teal-600 text-white rounded-full px-4 py-2 text-sm font-medium hover:bg-teal-700 disabled:opacity-50 transition-colors"
        >
          {saving ? 'Saving…' : 'Save changes'}
        </button>
      </div>

      {/* Notification Preferences */}
      <div className="border border-zinc-200 p-6 space-y-4 bg-white">
        <h2 className="text-sm font-semibold text-zinc-900">Notification Preferences</h2>

        <div className="mb-4 p-3 bg-amber-50 border border-amber-200 text-xs text-amber-700">
          Notification settings are coming soon. Your preferences will be saved when this feature launches.
        </div>

        {/* New Conflicts — visible to managers and admins */}
        {isManager && (
          <div className="opacity-40 pointer-events-none space-y-3">
            <p className="text-sm font-medium text-zinc-700">New Conflicts</p>
            <label className="flex items-center gap-3 cursor-pointer">
              <div className="relative inline-flex h-5 w-9 flex-shrink-0">
                <div className={`absolute inset-0 rounded-full transition-colors ${notifConflictsEmail ? 'bg-teal-600' : 'bg-zinc-200'}`} />
                <div className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${notifConflictsEmail ? 'translate-x-4' : 'translate-x-0.5'}`} />
              </div>
              <span className="text-sm text-zinc-700">Email me about new conflicts</span>
            </label>
            <div className="space-y-1 ml-1">
              <p className="text-xs text-zinc-500 mb-1">Frequency</p>
              {['daily', 'weekly', 'monthly'].map(f => (
                <label key={f} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="conflict_freq"
                    value={f}
                    checked={notifConflictsFreq === f}
                    onChange={() => setNotifConflictsFreq(f)}
                    className="h-3.5 w-3.5 border-zinc-300 text-teal-600"
                  />
                  <span className="text-sm text-zinc-700 capitalize">{f}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Account Usage Alerts — admins only */}
        {isAdmin && (
          <div className="opacity-40 pointer-events-none space-y-3">
            <p className="text-sm font-medium text-zinc-700">Account Usage Alerts</p>
            <label className="flex items-center gap-3 cursor-pointer">
              <div className="relative inline-flex h-5 w-9 flex-shrink-0">
                <div className={`absolute inset-0 rounded-full transition-colors ${notifUsageAlert ? 'bg-teal-600' : 'bg-zinc-200'}`} />
                <div className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${notifUsageAlert ? 'translate-x-4' : 'translate-x-0.5'}`} />
              </div>
              <span className="text-sm text-zinc-700">Alert me when event usage reaches:</span>
            </label>
            <div className="flex flex-wrap gap-x-4 gap-y-2 ml-1">
              {[50, 75, 90, 95, 99, 100].map(pct => (
                <label key={pct} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={notifUsageThresholds.includes(pct)}
                    onChange={() => toggleThreshold(pct)}
                    className="h-3.5 w-3.5 border-zinc-300 text-teal-600"
                  />
                  <span className="text-sm text-zinc-700">{pct}%</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {notifMessage && (
          <p className={`text-sm ${notifMessage.startsWith('Error') ? 'text-red-600' : 'text-emerald-600'}`}>
            {notifMessage}
          </p>
        )}
        <button
          onClick={handleSaveNotifications}
          disabled={savingNotif}
          className="bg-teal-600 text-white rounded-full px-4 py-2 text-sm font-medium hover:bg-teal-700 disabled:opacity-50 transition-colors"
        >
          {savingNotif ? 'Saving…' : 'Save preferences'}
        </button>
      </div>
    </div>
  )
}
