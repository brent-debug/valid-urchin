import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useOrg } from '../../contexts/OrgContext'
import { useAuth } from '../../contexts/AuthContext'
import { usePermissions } from '../../hooks/usePermissions'
import { getDomainLimit } from '../../lib/plans'
import { db } from '../../lib/firebase'
import { doc, setDoc, deleteDoc } from 'firebase/firestore'
import { writeAuditLog } from '../../lib/auditLog'

const TRACKER_URL = import.meta.env.VITE_TRACKER_URL || 'https://utm-tracker-839290050638.us-central1.run.app'
const DEFAULT_PARAMS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term']

function normalizeDomain(input) {
  try {
    const withProtocol = input.startsWith('http') ? input : `https://${input}`
    const url = new URL(withProtocol)
    const parts = url.hostname.split('.')
    if (parts.length > 2) return parts.slice(-2).join('.')
    return url.hostname
  } catch { return null }
}

export default function DataCollection() {
  const { currentOrg, refetch } = useOrg()
  const { user } = useAuth()
  const { isAdmin, isManager } = usePermissions()
  const canManage = isAdmin || isManager

  // Snippet
  const [copiedKey, setCopiedKey] = useState(false)
  const [copiedSnippet, setCopiedSnippet] = useState(false)

  // Domains
  const [domains, setDomains] = useState([])
  const [domainsLoading, setDomainsLoading] = useState(true)
  const [showAddDomain, setShowAddDomain] = useState(false)
  const [domainInput, setDomainInput] = useState('')
  const [domainSaving, setDomainSaving] = useState(false)
  const [domainError, setDomainError] = useState('')
  const [deletingId, setDeletingId] = useState(null)

  // Trigger parameters
  const [triggerParams, setTriggerParams] = useState(DEFAULT_PARAMS)
  const [newParam, setNewParam] = useState('')
  const [paramSaving, setParamSaving] = useState(false)
  const [paramSaveMsg, setParamSaveMsg] = useState('')
  const [removeWarning, setRemoveWarning] = useState('')

  useEffect(() => {
    if (!currentOrg) return
    loadDomains()
    setTriggerParams(currentOrg.triggerParameters || DEFAULT_PARAMS)
  }, [currentOrg?.id])

  async function loadDomains() {
    setDomainsLoading(true)
    const { data } = await supabase
      .from('allowed_domains')
      .select('*')
      .eq('organization_id', currentOrg.id)
      .order('created_at', { ascending: false })
    setDomains(data || [])
    setDomainsLoading(false)
  }

  async function handleAddDomain() {
    setDomainError('')
    const normalized = normalizeDomain(domainInput.trim())
    if (!normalized) { setDomainError('Please enter a valid domain or URL.'); return }
    setDomainSaving(true)
    try {
      const { error: insertError } = await supabase
        .from('allowed_domains')
        .insert({ organization_id: currentOrg.id, domain: normalized, created_by: user?.id })
        .select().single()
      if (insertError) {
        if (insertError.code === '23505') throw new Error('This domain is already in your allowlist.')
        throw insertError
      }
      const apiKey = currentOrg.firestore_api_key
      if (apiKey) {
        await setDoc(doc(db, 'organizations', apiKey, 'allowed_domains', normalized), {
          domain: normalized, created_at: new Date().toISOString(),
        })
      }
      setDomainInput('')
      setShowAddDomain(false)
      await loadDomains()
    } catch (err) {
      setDomainError(err.message)
    } finally {
      setDomainSaving(false)
    }
  }

  async function handleDeleteDomain(row) {
    if (!confirm(`Remove ${row.domain} from your allowlist?`)) return
    setDeletingId(row.id)
    try {
      await supabase.from('allowed_domains').delete().eq('id', row.id)
      const apiKey = currentOrg.firestore_api_key
      if (apiKey) await deleteDoc(doc(db, 'organizations', apiKey, 'allowed_domains', row.domain))
      await loadDomains()
    } finally {
      setDeletingId(null)
    }
  }

  function addParam() {
    const p = newParam.trim().toLowerCase().replace(/[^a-z0-9_]/g, '')
    if (!p || triggerParams.includes(p)) return
    setTriggerParams(prev => [...prev, p])
    setNewParam('')
    setParamSaveMsg('')
  }

  function removeParam(param) {
    if (DEFAULT_PARAMS.includes(param)) {
      setRemoveWarning(`Removing "${param}" means events using this parameter won't be captured.`)
      setTimeout(() => setRemoveWarning(''), 5000)
    }
    setTriggerParams(prev => prev.filter(p => p !== param))
    setParamSaveMsg('')
  }

  async function saveTriggerParams() {
    setParamSaving(true)
    setParamSaveMsg('')
    try {
      const original = currentOrg.triggerParameters || DEFAULT_PARAMS
      const added = triggerParams.filter(p => !original.includes(p))
      const removed = original.filter(p => !triggerParams.includes(p))
      await supabase
        .from('organizations')
        .update({ trigger_parameters: triggerParams })
        .eq('id', currentOrg.id)
      await writeAuditLog({
        organizationId: currentOrg.id,
        userId: user?.id,
        userEmail: user?.email,
        action: 'trigger_parameters_updated',
        entityType: 'account',
        metadata: { added, removed, current: triggerParams },
      })
      await refetch()
      setParamSaveMsg('Saved.')
    } catch (err) {
      setParamSaveMsg('Error: ' + err.message)
    } finally {
      setParamSaving(false)
    }
  }

  const trackingId = currentOrg?.firestore_api_key || ''
  const snippet = `<script>
(function() {
  var trackingId = '${trackingId}';
  var endpoint = '${TRACKER_URL}';
  var trackedParams = ${JSON.stringify(triggerParams)};

  var params = new URLSearchParams(window.location.search);
  var captured = {};
  trackedParams.forEach(function(p) {
    if (params.get(p)) captured[p] = params.get(p);
  });

  if (Object.keys(captured).length > 0) {
    fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        apiKey: trackingId,
        url: window.location.href,
        timestamp: new Date().toISOString(),
        utmParameters: captured
      })
    });
  }
})();
</script>`

  const domainLimit = getDomainLimit(currentOrg?.plan || 'free')
  const atLimit = domainLimit !== null && domains.length >= domainLimit

  if (!currentOrg) return null

  return (
    <div className="space-y-10 max-w-3xl">
      <div>
        <h1 className="text-xl font-semibold text-zinc-900">Data Collection</h1>
        <p className="text-sm text-zinc-500 mt-1">Configure how ValidUrchin collects data from your website.</p>
      </div>

      {/* ── Section 1: Tracking Snippet ── */}
      <section className="space-y-4">
        <div>
          <h2 className="text-base font-semibold text-zinc-900">Tracking Snippet</h2>
          <p className="text-sm text-zinc-500 mt-0.5">
            Add this snippet to every page of your website to start tracking UTM parameters.
          </p>
        </div>

        {/* Tracking ID */}
        <div className="bg-white border border-zinc-200 p-5">
          <div className="flex items-start justify-between mb-3">
            <div>
              <p className="text-sm font-medium text-zinc-700">Tracking ID</p>
              <p className="text-xs text-zinc-400 mt-0.5">
                This ID identifies your organization. It is included in your public snippet —
                there is no need to keep it private.
              </p>
            </div>
            <button
              onClick={() => { navigator.clipboard.writeText(trackingId); setCopiedKey(true); setTimeout(() => setCopiedKey(false), 2000) }}
              className="flex-shrink-0 text-sm text-teal-600 hover:underline ml-4"
            >
              {copiedKey ? 'Copied!' : 'Copy'}
            </button>
          </div>
          <code className="font-mono text-sm text-zinc-800 break-all">{trackingId}</code>
        </div>

        {/* Snippet */}
        <div className="bg-white border border-zinc-200 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-zinc-100">
            <p className="text-sm font-medium text-zinc-700">Script snippet</p>
            <button
              onClick={() => { navigator.clipboard.writeText(snippet); setCopiedSnippet(true); setTimeout(() => setCopiedSnippet(false), 2000) }}
              className="text-sm text-teal-600 hover:underline"
            >
              {copiedSnippet ? 'Copied!' : 'Copy snippet'}
            </button>
          </div>
          <pre className="bg-zinc-950 text-zinc-100 px-5 py-4 text-xs overflow-x-auto leading-relaxed">{snippet}</pre>
          <div className="px-5 py-3 border-t border-zinc-100 bg-zinc-50">
            <p className="text-xs text-zinc-500">
              Place this snippet before the closing <code className="bg-zinc-100 px-1">&lt;/head&gt;</code> tag on every page.
              The tracked parameters update automatically to reflect your configuration below.
            </p>
          </div>
        </div>
      </section>

      <div className="border-t border-zinc-200" />

      {/* ── Section 2: Allowed Domains ── */}
      <section className="space-y-4">
        <div>
          <h2 className="text-base font-semibold text-zinc-900">Allowed Domains</h2>
          <p className="text-sm text-zinc-500 mt-0.5">
            Events are only collected from these domains. Requests from other domains are silently ignored.
          </p>
        </div>

        <div className="bg-white border border-zinc-200 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-100">
            <p className="text-sm text-zinc-600">
              {domains.length} domain{domains.length !== 1 ? 's' : ''} configured
            </p>
            {canManage && (
              <button
                onClick={() => { setShowAddDomain(true); setDomainError(''); setDomainInput('') }}
                disabled={atLimit}
                className="bg-teal-600 text-white rounded-full px-4 py-1.5 text-sm font-medium hover:bg-teal-700 transition-colors disabled:opacity-50"
              >
                Add domain
              </button>
            )}
          </div>

          {atLimit && (
            <div className="px-5 py-3 bg-amber-50 border-b border-amber-100 text-xs text-amber-700">
              Your plan allows {domainLimit} domain{domainLimit === 1 ? '' : 's'}.{' '}
              <a href="/settings/plan" className="text-teal-600 hover:text-teal-700 underline">Upgrade to add more.</a>
            </div>
          )}

          {showAddDomain && (
            <div className="px-5 py-4 border-b border-zinc-100 bg-zinc-50">
              {domainError && (
                <div className="mb-3 p-3 bg-red-50 border border-red-200 text-sm text-red-700">{domainError}</div>
              )}
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={domainInput}
                  onChange={e => setDomainInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAddDomain()}
                  placeholder="example.com or https://example.com"
                  className="flex-1 px-3 py-2 border border-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-600 bg-white"
                  autoFocus
                />
                <button
                  onClick={handleAddDomain}
                  disabled={domainSaving || !domainInput.trim()}
                  className="bg-teal-600 text-white rounded-full px-4 py-2 text-sm font-medium hover:bg-teal-700 disabled:opacity-50"
                >
                  {domainSaving ? 'Saving…' : 'Save'}
                </button>
                <button
                  onClick={() => { setShowAddDomain(false); setDomainError(''); setDomainInput('') }}
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

          {domainsLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-teal-600" />
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-zinc-100">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-zinc-400 uppercase tracking-wide">Domain</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-zinc-400 uppercase tracking-wide">Added</th>
                  {canManage && <th className="text-right px-5 py-3 text-xs font-semibold text-zinc-400 uppercase tracking-wide">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {domains.length === 0 ? (
                  <tr>
                    <td colSpan={canManage ? 3 : 2} className="px-5 py-12 text-center text-sm text-zinc-400">
                      No domains added yet. Add your first domain to start collecting events.
                    </td>
                  </tr>
                ) : (
                  domains.map(row => (
                    <tr key={row.id} className="border-b border-zinc-50 last:border-0 hover:bg-zinc-50">
                      <td className="px-5 py-3">
                        <span className="text-sm font-mono text-zinc-900">{row.domain}</span>
                      </td>
                      <td className="px-5 py-3 text-sm text-zinc-400">
                        {row.created_at ? new Date(row.created_at).toLocaleDateString() : '—'}
                      </td>
                      {canManage && (
                        <td className="px-5 py-3 text-right">
                          <button
                            onClick={() => handleDeleteDomain(row)}
                            disabled={deletingId === row.id}
                            className="text-xs text-red-500 hover:text-red-700 disabled:opacity-50"
                          >
                            {deletingId === row.id ? 'Removing…' : 'Remove'}
                          </button>
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>
      </section>

      <div className="border-t border-zinc-200" />

      {/* ── Section 3: Trigger Parameters ── */}
      <section className="space-y-4">
        <div>
          <h2 className="text-base font-semibold text-zinc-900">Trigger Parameters</h2>
          <p className="text-sm text-zinc-500 mt-0.5">
            These are the URL parameters that ValidUrchin watches for. When any of these appear in a URL,
            an event is captured and evaluated against your rules. You can track any parameter — rules are
            configured separately in Monitor Settings.
          </p>
        </div>

        {removeWarning && (
          <div className="px-4 py-3 bg-amber-50 border border-amber-200 text-sm text-amber-700">
            {removeWarning}
          </div>
        )}

        <div className="bg-white border border-zinc-200 p-5 space-y-4">
          {/* Current params as pills */}
          <div className="flex flex-wrap gap-2">
            {triggerParams.map(param => (
              <div key={param} className="flex items-center gap-1.5 bg-zinc-100 border border-zinc-200 rounded-full px-3 py-1.5">
                <span className="font-mono text-sm text-zinc-700">{param}</span>
                {canManage && (
                  <button
                    onClick={() => removeParam(param)}
                    className={`text-lg leading-none pb-0.5 transition-colors ${
                      DEFAULT_PARAMS.includes(param)
                        ? 'text-zinc-300 hover:text-red-400'
                        : 'text-zinc-400 hover:text-red-500'
                    }`}
                    title={DEFAULT_PARAMS.includes(param) ? 'Remove default parameter' : 'Remove'}
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Add new param */}
          {canManage && (
            <div>
              <div className="flex gap-2 items-center">
                <input
                  type="text"
                  value={newParam}
                  onChange={e => setNewParam(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                  placeholder="e.g. fbclid or ref"
                  className="flex-1 max-w-xs px-3 py-2 border border-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-600"
                  onKeyDown={e => e.key === 'Enter' && addParam()}
                />
                <button
                  onClick={addParam}
                  disabled={!newParam.trim() || triggerParams.includes(newParam.trim())}
                  className="bg-teal-600 text-white rounded-full px-4 py-2 text-sm font-medium hover:bg-teal-700 disabled:opacity-50"
                >
                  Add
                </button>
              </div>
              <p className="text-xs text-zinc-400 mt-2">
                Only lowercase letters, numbers, and underscores. Non-UTM parameters like{' '}
                <code className="bg-zinc-100 px-1">fbclid</code> or{' '}
                <code className="bg-zinc-100 px-1">gclid</code> can be tracked without any validation rules.
              </p>
            </div>
          )}

          {canManage && (
            <div className="flex items-center gap-3 pt-2 border-t border-zinc-100">
              <button
                onClick={saveTriggerParams}
                disabled={paramSaving}
                className="bg-teal-600 text-white rounded-full px-4 py-2 text-sm font-medium hover:bg-teal-700 disabled:opacity-50"
              >
                {paramSaving ? 'Saving…' : 'Save changes'}
              </button>
              {paramSaveMsg && (
                <p className={`text-sm ${paramSaveMsg.startsWith('Error') ? 'text-red-600' : 'text-emerald-600'}`}>
                  {paramSaveMsg}
                </p>
              )}
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
