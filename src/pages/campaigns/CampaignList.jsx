import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useOrg } from '../../contexts/OrgContext'
import { useAuth } from '../../contexts/AuthContext'
import { writeAuditLog } from '../../lib/auditLog'

const STATUS_FILTERS = ['All', 'Draft', 'Active', 'Paused', 'Complete', 'Evergreen']

const STATUS_STYLE = {
  draft: 'bg-zinc-100 text-zinc-500',
  active: 'bg-teal-50 text-teal-700',
  paused: 'bg-amber-50 text-amber-700',
  complete: 'bg-zinc-200 text-zinc-600',
  evergreen: 'bg-blue-50 text-blue-700',
}

function StatusBadge({ status, isEvergreen }) {
  const key = isEvergreen ? 'evergreen' : (status || 'draft')
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLE[key] || STATUS_STYLE.draft}`}>
      {isEvergreen ? 'Evergreen' : (status?.charAt(0).toUpperCase() + status?.slice(1))}
    </span>
  )
}

function formatDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function Spinner() {
  return (
    <div className="flex items-center justify-center py-16">
      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-teal-600" />
    </div>
  )
}

export default function CampaignList() {
  const { currentOrg } = useOrg()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [campaigns, setCampaigns] = useState([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('All')

  useEffect(() => {
    if (currentOrg?.id) loadCampaigns()
  }, [currentOrg?.id])

  async function loadCampaigns() {
    setLoading(true)
    const { data } = await supabase
      .from('campaigns')
      .select(`
        *,
        campaign_channels(
          id,
          campaign_urls(id)
        )
      `)
      .eq('organization_id', currentOrg.id)
      .order('created_at', { ascending: false })
    setCampaigns(data || [])
    setLoading(false)
  }

  async function handleArchive(campaign) {
    if (!confirm(`Archive "${campaign.name}"?`)) return
    await supabase.from('campaigns').update({ status: 'complete' }).eq('id', campaign.id)
    await writeAuditLog({
      organizationId: currentOrg.id,
      userId: user?.id,
      userEmail: user?.email,
      action: 'campaign_deleted',
      entityType: 'campaign',
      entityName: campaign.name,
    })
    loadCampaigns()
  }

  async function handleDuplicate(campaign) {
    const { data: newCampaign } = await supabase
      .from('campaigns')
      .insert({
        organization_id: currentOrg.id,
        name: `${campaign.name} (copy)`,
        status: 'draft',
        owner_id: user?.id,
        owner_email: user?.email,
        tags: campaign.tags,
        default_base_url: campaign.default_base_url,
        is_evergreen: campaign.is_evergreen,
      })
      .select()
      .single()
    if (newCampaign) navigate(`/campaigns/${newCampaign.id}/edit`)
  }

  const filtered = campaigns.filter(c => {
    if (statusFilter === 'All') return true
    if (statusFilter === 'Evergreen') return c.is_evergreen
    return c.status === statusFilter.toLowerCase()
  })

  return (
    <div className="space-y-5 max-w-6xl">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-zinc-900">Campaigns</h1>
        <button
          onClick={() => navigate('/campaigns/new')}
          className="bg-teal-600 text-white rounded-full px-4 py-1.5 text-sm font-medium hover:bg-teal-700 transition-colors"
        >
          + New Campaign
        </button>
      </div>

      {/* Status filter pills */}
      <div className="flex items-center gap-2 flex-wrap">
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
          </button>
        ))}
      </div>

      {loading ? <Spinner /> : (
        <div className="bg-white border border-zinc-200 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-zinc-100">
                {['Campaign', 'Status', 'Owner', 'Channels', 'URLs', 'Dates', 'Tags', 'Actions'].map(col => (
                  <th key={col} className="text-left px-5 py-3 text-xs font-semibold text-zinc-400 uppercase tracking-wide">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-5 py-16 text-center">
                    <p className="text-sm font-medium text-zinc-900">
                      {statusFilter === 'All' ? 'No campaigns yet' : `No ${statusFilter.toLowerCase()} campaigns`}
                    </p>
                    {statusFilter === 'All' && (
                      <p className="text-xs text-zinc-400 mt-1">
                        Create your first campaign to start building UTM URLs.
                      </p>
                    )}
                  </td>
                </tr>
              ) : filtered.map(campaign => {
                const channelCount = campaign.campaign_channels?.length || 0
                const urlCount = campaign.campaign_channels?.reduce(
                  (sum, ch) => sum + (ch.campaign_urls?.length || 0), 0
                ) || 0
                return (
                  <tr key={campaign.id} className="border-b border-zinc-50 hover:bg-zinc-50">
                    <td className="px-5 py-3">
                      <button
                        onClick={() => navigate(`/campaigns/${campaign.id}`)}
                        className="text-sm font-medium text-zinc-900 hover:text-teal-700 text-left"
                      >
                        {campaign.name}
                      </button>
                    </td>
                    <td className="px-5 py-3">
                      <StatusBadge status={campaign.status} isEvergreen={campaign.is_evergreen} />
                    </td>
                    <td className="px-5 py-3 text-sm text-zinc-500">
                      {campaign.owner_email || '—'}
                    </td>
                    <td className="px-5 py-3 text-sm text-zinc-500">
                      {channelCount} channel{channelCount !== 1 ? 's' : ''}
                    </td>
                    <td className="px-5 py-3 text-sm text-zinc-500">{urlCount}</td>
                    <td className="px-5 py-3 text-sm text-zinc-400">
                      {campaign.is_evergreen ? (
                        <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">Evergreen</span>
                      ) : (
                        <span>{formatDate(campaign.start_date)} – {formatDate(campaign.end_date)}</span>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex flex-wrap gap-1">
                        {(campaign.tags || []).slice(0, 3).map(tag => (
                          <span key={tag} className="text-xs bg-zinc-100 text-zinc-500 px-2 py-0.5 rounded-full">{tag}</span>
                        ))}
                        {(campaign.tags || []).length > 3 && (
                          <span className="text-xs text-zinc-400">+{campaign.tags.length - 3}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3 justify-end">
                        <button
                          onClick={() => navigate(`/campaigns/${campaign.id}/edit`)}
                          className="text-xs text-zinc-500 hover:text-zinc-900"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDuplicate(campaign)}
                          className="text-xs text-zinc-500 hover:text-zinc-900"
                        >
                          Duplicate
                        </button>
                        <button
                          onClick={() => handleArchive(campaign)}
                          className="text-xs text-red-400 hover:text-red-600"
                        >
                          Archive
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
