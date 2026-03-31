import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeftIcon, PencilIcon } from '@heroicons/react/24/outline'
import { useConfiguration } from '../../hooks/useConfiguration'
import { useOrg } from '../../contexts/OrgContext'
import Badge from '../../components/ui/Badge'

function Spinner() {
  return (
    <div className="flex items-center justify-center py-16">
      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-teal-600" />
    </div>
  )
}

function fmtDate(iso) {
  if (!iso) return null
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function ConditionalRuleView() {
  const { ruleId } = useParams()
  const navigate = useNavigate()
  const { config, loading } = useConfiguration()
  const { currentOrg, loading: orgLoading } = useOrg()

  if (orgLoading || loading) return <Spinner />
  if (!currentOrg) return <div className="text-center py-16 text-sm text-zinc-400">No organization found.</div>

  const rule = (config?.conditionalRules || []).find(r => r.id === ruleId)
  if (!rule) return <div className="text-center py-16 text-sm text-zinc-400">Rule not found.</div>

  // Handle both anchor (legacy single) and anchors (new array)
  const anchors = rule.anchors || (rule.anchor ? [rule.anchor] : [])
  const anchorLogic = rule.anchorLogic || 'AND'

  // Build anchor description
  const anchorParts = anchors.map(a => `When ${a.parameter} = ${a.value}`)
  const anchorSummary = anchorParts.join(` ${anchorLogic} `)

  const appliedDomains = rule.appliedDomains
  const showAllDomains = !appliedDomains || appliedDomains.includes('all') || appliedDomains.length === 0

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <button
        onClick={() => navigate('/monitor/rules')}
        className="flex items-center gap-1.5 text-sm text-zinc-400 hover:text-zinc-700 transition-colors"
      >
        <ArrowLeftIcon className="h-4 w-4" /> Conditional Rules
      </button>

      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <h1 className="text-xl font-semibold text-zinc-900">{rule.name || `Rule ${rule.id?.slice(0, 6)}`}</h1>
          <div className="flex items-center gap-3 flex-wrap">
            <Badge variant={rule.active ? 'active' : 'paused'}>{rule.active ? 'Active' : 'Paused'}</Badge>
            <span className="text-xs text-zinc-400">
              {rule.created && <>Created {fmtDate(rule.created)}{rule.createdBy?.email ? ` by ${rule.createdBy.email}` : ''}</>}
              {rule.lastModified && (
                <> · Last modified {fmtDate(rule.lastModified)}{rule.lastModifiedBy?.email ? ` by ${rule.lastModifiedBy.email}` : ''}</>
              )}
              {/* Fallback to legacy fields */}
              {!rule.created && rule.createdAt && <>Created {fmtDate(rule.createdAt)}</>}
              {!rule.lastModified && rule.updatedAt && <> · Updated {fmtDate(rule.updatedAt)}</>}
            </span>
          </div>
        </div>
        <button
          onClick={() => navigate(`/monitor/rules/${ruleId}/edit`)}
          className="inline-flex items-center gap-1.5 border border-zinc-200 bg-white text-zinc-700 px-4 py-2 text-sm font-medium hover:bg-zinc-50 transition-colors flex-shrink-0"
        >
          <PencilIcon className="h-4 w-4" /> Edit rule
        </button>
      </div>

      {/* Anchor condition */}
      <div className="bg-white border border-zinc-200 p-5 space-y-3">
        <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">Anchor condition</p>
        {anchors.length === 0 ? (
          <p className="text-sm text-zinc-400">No anchor condition defined.</p>
        ) : (
          <div className="space-y-2">
            {anchors.map((anchor, idx) => (
              <div key={idx} className="flex items-center gap-2 flex-wrap">
                {idx > 0 && (
                  <span className="text-xs font-semibold text-zinc-500 uppercase bg-zinc-100 px-2 py-0.5">{anchorLogic}</span>
                )}
                <span className="text-sm text-zinc-600">When</span>
                <span className="text-sm font-mono font-medium text-zinc-900 bg-zinc-100 px-2 py-0.5">{anchor.parameter}</span>
                <span className="text-sm text-zinc-600">=</span>
                <span className="text-sm font-mono font-medium text-teal-700 bg-teal-50 px-2 py-0.5">{anchor.value}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Conditionals table */}
      <div className="bg-white border border-zinc-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-zinc-100">
          <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">Conditional parameters</p>
        </div>
        {Object.keys(rule.conditionals || {}).length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-zinc-400">No conditional parameters defined.</div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-zinc-100">
                <th className="text-left px-5 py-3 text-xs font-semibold text-zinc-400 uppercase tracking-wide">Parameter</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-zinc-400 uppercase tracking-wide">Allowed Values</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(rule.conditionals || {}).map(([param, data]) => {
                // data can be an array (legacy) or an object with .values
                const values = Array.isArray(data) ? data : (data?.values || data || [])
                return (
                  <tr key={param} className="border-b border-zinc-50">
                    <td className="px-5 py-3 text-sm font-mono font-medium text-zinc-900">{param}</td>
                    <td className="px-5 py-3">
                      <div className="flex flex-wrap gap-1.5">
                        {values.length === 0 ? (
                          <span className="text-xs text-zinc-400">All values allowed</span>
                        ) : (
                          values.map(v => (
                            <span
                              key={v}
                              className="inline-flex items-center text-xs font-mono bg-zinc-100 text-zinc-700 rounded-full px-2.5 py-0.5"
                            >
                              {v}
                            </span>
                          ))
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Applied domains */}
      <div className="bg-white border border-zinc-200 p-5 space-y-3">
        <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">Applied domains</p>
        {showAllDomains ? (
          <p className="text-sm text-zinc-500">All domains</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {appliedDomains.map(d => (
              <span
                key={d}
                className="inline-flex items-center text-xs bg-zinc-100 text-zinc-700 rounded-full px-2.5 py-0.5"
              >
                {d}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
