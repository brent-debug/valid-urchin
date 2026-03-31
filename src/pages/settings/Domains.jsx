import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useOrg } from '../../contexts/OrgContext'
import { useAuth } from '../../contexts/AuthContext'
import { getDomainLimit } from '../../lib/plans'
import { db } from '../../lib/firebase'
import { doc, setDoc, deleteDoc } from 'firebase/firestore'

function normalizeDomain(input) {
  try {
    const withProtocol = input.startsWith('http') ? input : `https://${input}`
    const url = new URL(withProtocol)
    const parts = url.hostname.split('.')
    if (parts.length > 2) return parts.slice(-2).join('.')
    return url.hostname
  } catch { return null }
}

function Spinner() {
  return (
    <div className="flex items-center justify-center py-16">
      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-teal-600" />
    </div>
  )
}

export default function Domains() {
  const { currentOrg, loading: orgLoading } = useOrg()
  const { user } = useAuth()
  const [domains, setDomains] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [inputValue, setInputValue] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [deletingId, setDeletingId] = useState(null)

  useEffect(() => {
    if (currentOrg) loadDomains()
  }, [currentOrg])

  async function loadDomains() {
    setLoading(true)
    const { data } = await supabase
      .from('allowed_domains')
      .select('*')
      .eq('organization_id', currentOrg.id)
      .order('created_at', { ascending: false })
    setDomains(data || [])
    setLoading(false)
  }

  async function handleAdd() {
    setError('')
    const normalized = normalizeDomain(inputValue.trim())
    if (!normalized) {
      setError('Please enter a valid domain or URL.')
      return
    }

    setSaving(true)
    try {
      const { data, error: insertError } = await supabase
        .from('allowed_domains')
        .insert({
          organization_id: currentOrg.id,
          domain: normalized,
          created_by: user?.id,
        })
        .select()
        .single()

      if (insertError) {
        if (insertError.code === '23505') {
          throw new Error('This domain is already in your allowlist.')
        }
        throw insertError
      }

      // Write to Firestore so the Cloud Function can read it
      const apiKey = currentOrg.firestore_api_key
      if (apiKey) {
        await setDoc(
          doc(db, 'organizations', apiKey, 'allowed_domains', normalized),
          { domain: normalized, created_at: new Date().toISOString() }
        )
      }

      setInputValue('')
      setShowAdd(false)
      await loadDomains()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(domainRow) {
    if (!confirm(`Remove ${domainRow.domain} from your allowlist?`)) return
    setDeletingId(domainRow.id)
    try {
      await supabase.from('allowed_domains').delete().eq('id', domainRow.id)

      // Delete from Firestore
      const apiKey = currentOrg.firestore_api_key
      if (apiKey) {
        await deleteDoc(doc(db, 'organizations', apiKey, 'allowed_domains', domainRow.domain))
      }

      await loadDomains()
    } finally {
      setDeletingId(null)
    }
  }

  if (orgLoading) return <Spinner />
  if (!currentOrg) return <div className="text-center py-16 text-sm text-zinc-400">No organization found.</div>

  const domainLimit = getDomainLimit(currentOrg.plan || 'free')
  const atLimit = domainLimit !== null && domains.length >= domainLimit

  return (
    <div className="space-y-5 max-w-3xl">
      <div className="bg-white border border-zinc-200 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-100">
          <div>
            <p className="text-sm font-semibold text-zinc-900">Allowed domains</p>
            <p className="text-xs text-zinc-500 mt-0.5">
              Events are only collected from these domains. Requests from other domains are silently ignored.
            </p>
          </div>
          <button
            onClick={() => { setShowAdd(true); setError(''); setInputValue('') }}
            disabled={atLimit}
            className="bg-teal-600 text-white rounded-full px-4 py-1.5 text-sm font-medium hover:bg-teal-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Add domain
          </button>
        </div>

        {atLimit && (
          <div className="px-5 py-3 bg-amber-50 border-b border-amber-100 text-xs text-amber-700">
            Your plan allows {domainLimit} domain{domainLimit === 1 ? '' : 's'}.{' '}
            <a href="/settings/plan" className="text-teal-600 hover:text-teal-700 underline">Upgrade to add more.</a>
          </div>
        )}

        {showAdd && (
          <div className="px-5 py-4 border-b border-zinc-100 bg-zinc-50">
            {error && (
              <div className="mb-3 p-3 bg-red-50 border border-red-200 text-sm text-red-700">{error}</div>
            )}
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={inputValue}
                onChange={e => setInputValue(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAdd()}
                placeholder="example.com or https://example.com/page"
                className="flex-1 px-3 py-2 border border-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-600 bg-white"
                autoFocus
              />
              <button
                onClick={handleAdd}
                disabled={saving || !inputValue.trim()}
                className="bg-teal-600 text-white rounded-full px-4 py-2 text-sm font-medium hover:bg-teal-700 disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
              <button
                onClick={() => { setShowAdd(false); setError(''); setInputValue('') }}
                className="bg-white text-zinc-700 border border-zinc-200 rounded-full px-4 py-2 text-sm hover:bg-zinc-50"
              >
                Cancel
              </button>
            </div>
            <p className="text-xs text-zinc-400 mt-2">
              Subdomains are stripped — e.g. <code className="bg-zinc-100 px-1">https://lp.example.com/page</code> becomes <code className="bg-zinc-100 px-1">example.com</code>.
            </p>
          </div>
        )}

        {loading ? (
          <Spinner />
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-zinc-100">
                <th className="text-left px-5 py-3 text-xs font-semibold text-zinc-400 uppercase tracking-wide">Domain</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-zinc-400 uppercase tracking-wide">Added</th>
                <th className="text-right px-5 py-3 text-xs font-semibold text-zinc-400 uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody>
              {domains.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-5 py-12 text-center text-sm text-zinc-400">
                    No domains added yet. Add your first domain to start collecting events.
                  </td>
                </tr>
              ) : (
                domains.map(row => (
                  <tr key={row.id} className="border-b border-zinc-50 hover:bg-zinc-50">
                    <td className="px-5 py-3">
                      <span className="text-sm font-mono text-zinc-900">{row.domain}</span>
                    </td>
                    <td className="px-5 py-3 text-sm text-zinc-400">
                      {row.created_at ? new Date(row.created_at).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <button
                        onClick={() => handleDelete(row)}
                        disabled={deletingId === row.id}
                        className="text-xs text-red-500 hover:text-red-700 disabled:opacity-50"
                      >
                        {deletingId === row.id ? 'Removing…' : 'Remove'}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
