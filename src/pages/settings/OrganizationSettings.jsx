import { useState } from 'react'
import { useOrg } from '../../contexts/OrgContext'
import { supabase } from '../../lib/supabase'
import Button from '../../components/ui/Button'

export default function OrganizationSettings() {
  const { currentOrg, refetch } = useOrg()
  const [name, setName] = useState(currentOrg?.name || '')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  const handleSave = async () => {
    setSaving(true)
    setMessage('')
    try {
      const { error } = await supabase
        .from('organizations')
        .update({ name })
        .eq('id', currentOrg.id)
      if (error) throw error
      await refetch()
      setMessage('Saved successfully.')
    } catch (err) {
      setMessage(`Error: ${err.message}`)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-lg space-y-6">
      <div className="bg-white rounded-2xl border border-zinc-200 p-6 space-y-4">
        <h2 className="text-sm font-semibold text-zinc-900">Organization details</h2>
        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">Organization name</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-600"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">Plan</label>
          <input value={currentOrg?.plan || 'free'} disabled className="w-full px-3 py-2 rounded-lg border border-zinc-200 text-sm bg-zinc-50 text-zinc-500 capitalize" />
        </div>
        {message && <p className={`text-sm ${message.startsWith('Error') ? 'text-red-600' : 'text-emerald-600'}`}>{message}</p>}
        <Button onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</Button>
      </div>
    </div>
  )
}
