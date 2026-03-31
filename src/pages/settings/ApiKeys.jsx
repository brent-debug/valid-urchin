import { useState } from 'react'
import { useOrg } from '../../contexts/OrgContext'
import { usePermissions } from '../../hooks/usePermissions'
import { supabase } from '../../lib/supabase'
import Button from '../../components/ui/Button'

const TRACKER_URL = import.meta.env.VITE_TRACKER_URL || 'https://utm-tracker-839290050638.us-central1.run.app'

export default function UrchinSnippet() {
  const { currentOrg, loading: orgLoading, refetch } = useOrg()
  const { can } = usePermissions()
  const [copied, setCopied] = useState(false)
  const [copiedSnippet, setCopiedSnippet] = useState(false)
  const [regenerating, setRegenerating] = useState(false)
  const [showKey, setShowKey] = useState(false)

  if (orgLoading) return <div className="flex items-center justify-center py-16"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600" /></div>
  if (!currentOrg) return <div className="text-center py-16 text-sm text-zinc-500">No organization found.</div>

  const urchinKey = currentOrg.firestore_api_key || ''

  const snippet = `<script>
(function() {
  var apiKey = '${urchinKey}';
  var params = new URLSearchParams(window.location.search);
  var utmParams = {};
  ['utm_source','utm_medium','utm_campaign','utm_content','utm_term'].forEach(function(p) {
    if (params.get(p)) utmParams[p] = params.get(p);
  });
  if (Object.keys(utmParams).length > 0) {
    fetch('${TRACKER_URL}', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiKey: apiKey, url: window.location.href, timestamp: new Date().toISOString(), utmParameters: utmParams })
    });
  }
})();
</script>`

  const handleCopy = () => {
    navigator.clipboard.writeText(urchinKey)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleCopySnippet = () => {
    navigator.clipboard.writeText(snippet)
    setCopiedSnippet(true)
    setTimeout(() => setCopiedSnippet(false), 2000)
  }

  const handleRegenerate = async () => {
    if (!confirm('Regenerating the Urchin Key will break any existing website snippets. Proceed?')) return
    setRegenerating(true)
    try {
      const newKey = crypto.randomUUID()
      const { error } = await supabase
        .from('organizations')
        .update({ firestore_api_key: newKey })
        .eq('id', currentOrg.id)
      if (error) throw error
      await refetch()
    } catch (err) {
      alert('Failed to regenerate: ' + err.message)
    } finally {
      setRegenerating(false)
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Urchin Key */}
      <div className="bg-white rounded-2xl border border-zinc-200 p-6 space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-zinc-900">Urchin Key</h2>
          <p className="text-xs text-zinc-500 mt-0.5">This key identifies your organization. Keep it private — it's embedded in your website snippet.</p>
        </div>
        <div className="flex items-center gap-2">
          <input
            type={showKey ? 'text' : 'password'}
            value={urchinKey}
            readOnly
            className="flex-1 px-3 py-2 rounded-lg border border-zinc-200 text-sm font-mono bg-zinc-50"
          />
          <Button variant="secondary" size="sm" onClick={() => setShowKey(v => !v)}>
            {showKey ? 'Hide' : 'Show'}
          </Button>
          <Button variant="secondary" size="sm" onClick={handleCopy}>
            {copied ? 'Copied!' : 'Copy'}
          </Button>
        </div>
        {can('delete_org') && (
          <div className="pt-2 border-t border-zinc-100">
            <Button variant="secondary" size="sm" onClick={handleRegenerate} disabled={regenerating} className="text-red-600 border-red-200 hover:bg-red-50">
              {regenerating ? 'Regenerating…' : 'Regenerate key'}
            </Button>
            <p className="text-xs text-zinc-400 mt-1">Warning: this will break your existing website snippet.</p>
          </div>
        )}
      </div>

      {/* Urchin Snippet */}
      <div className="bg-white rounded-2xl border border-zinc-200 p-6 space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-zinc-900">Urchin Snippet</h2>
          <p className="text-xs text-zinc-500 mt-0.5">Paste this in the <code className="bg-zinc-100 px-1 rounded">&lt;head&gt;</code> of every page you want to track.</p>
        </div>
        <div className="relative">
          <pre className="bg-zinc-950 text-zinc-100 rounded-xl p-4 text-xs overflow-x-auto leading-relaxed">{snippet}</pre>
          <div className="absolute top-2 right-2">
            <Button size="sm" onClick={handleCopySnippet} className="text-xs">
              {copiedSnippet ? 'Copied!' : 'Copy'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
