import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useOrg } from '../../contexts/OrgContext'
import { useAuth } from '../../contexts/AuthContext'
import { writeAuditLog } from '../../lib/auditLog'
import { exportCampaignCSV, exportChannelCSV, copyUrlsToClipboard } from '../../lib/campaignExport'

const STATUS_STYLE = {
  draft: 'bg-zinc-100 text-zinc-500',
  active: 'bg-teal-50 text-teal-700',
  paused: 'bg-amber-50 text-amber-700',
  complete: 'bg-zinc-200 text-zinc-600',
}

function Spinner() {
  return (
    <div className="flex items-center justify-center py-16">
      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-teal-600" />
    </div>
  )
}

function formatDate(d) {
  if (!d) return null
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function CampaignDetail() {
  const { campaignId } = useParams()
  const { currentOrg } = useOrg()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [campaign, setCampaign] = useState(null)
  const [channels, setChannels] = useState([])
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState({})

  useEffect(() => {
    if (campaignId) loadData()
  }, [campaignId])

  async function loadData() {
    setLoading(true)
    const { data: c } = await supabase
      .from('campaigns')
      .select('*')
      .eq('id', campaignId)
      .single()
    if (!c) { setLoading(false); return }
    setCampaign(c)

    const { data: chs } = await supabase
      .from('campaign_channels')
      .select('*, channel_templates(name, description)')
      .eq('campaign_id', campaignId)
      .order('created_at')

    const channelsWithUrls = await Promise.all(
      (chs || []).map(async ch => {
        const { data: urls } = await supabase
          .from('campaign_urls')
          .select('*')
          .eq('channel_id', ch.id)
          .order('created_at', { ascending: false })
        return { ...ch, urls: urls || [] }
      })
    )
    setChannels(channelsWithUrls)
    setLoading(false)
  }

  async function deleteUrl(urlId, channelId) {
    if (!confirm('Delete this URL?')) return
    await supabase.from('campaign_urls').delete().eq('id', urlId)
    setChannels(prev => prev.map(ch =>
      ch.id === channelId
        ? { ...ch, urls: ch.urls.filter(u => u.id !== urlId) }
        : ch
    ))
  }

  async function handleCopyUrl(url) {
    await navigator.clipboard.writeText(url.full_url)
    setCopied(prev => ({ ...prev, [url.id]: true }))
    setTimeout(() => setCopied(prev => ({ ...prev, [url.id]: false })), 2000)
  }

  async function handleCopyAll(channel) {
    await copyUrlsToClipboard(channel.urls)
    setCopied(prev => ({ ...prev, [`ch_${channel.id}`]: true }))
    setTimeout(() => setCopied(prev => ({ ...prev, [`ch_${channel.id}`]: false })), 2000)
  }

  if (loading) return <Spinner />
  if (!campaign) return <div className="text-center py-16 text-sm text-zinc-400">Campaign not found.</div>

  const statusStyle = campaign.is_evergreen
    ? 'bg-blue-50 text-blue-700'
    : (STATUS_STYLE[campaign.status] || STATUS_STYLE.draft)
  const statusLabel = campaign.is_evergreen ? 'Evergreen' : (campaign.status?.charAt(0).toUpperCase() + campaign.status?.slice(1))

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Header */}
      <div>
        <button
          onClick={() => navigate('/campaigns')}
          className="text-sm text-zinc-400 hover:text-zinc-600 mb-3 block"
        >
          ← Campaigns
        </button>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold text-zinc-900">{campaign.name}</h1>
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusStyle}`}>
              {statusLabel}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => exportCampaignCSV(campaign, channels)}
              className="bg-white text-zinc-700 border border-zinc-200 px-3 py-1.5 text-sm hover:bg-zinc-50 transition-colors"
            >
              Export CSV
            </button>
            <button
              onClick={() => navigate(`/campaigns/${campaignId}/edit`)}
              className="bg-teal-600 text-white rounded-full px-4 py-1.5 text-sm font-medium hover:bg-teal-700 transition-colors"
            >
              Edit
            </button>
          </div>
        </div>

        {/* Metadata bar */}
        <div className="flex items-center gap-4 mt-3 text-sm text-zinc-500 flex-wrap">
          {campaign.owner_email && (
            <span>Owner: <span className="text-zinc-700">{campaign.owner_email}</span></span>
          )}
          {(campaign.start_date || campaign.end_date) && !campaign.is_evergreen && (
            <span>
              {formatDate(campaign.start_date) || '?'} – {formatDate(campaign.end_date) || 'ongoing'}
            </span>
          )}
          {(campaign.tags || []).length > 0 && (
            <div className="flex items-center gap-1.5">
              <span className="text-zinc-400">Tags:</span>
              {campaign.tags.map(t => (
                <span key={t} className="text-xs bg-zinc-100 text-zinc-600 px-2 py-0.5 rounded-full">{t}</span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Channels */}
      {channels.length === 0 ? (
        <div className="bg-white border border-zinc-200 p-12 text-center">
          <p className="text-sm font-medium text-zinc-900">No channels yet</p>
          <p className="text-xs text-zinc-400 mt-1">
            <button
              onClick={() => navigate(`/campaigns/${campaignId}/edit`)}
              className="text-teal-600 hover:underline"
            >
              Edit this campaign
            </button>{' '}to add channels.
          </p>
        </div>
      ) : channels.map(channel => (
        <div key={channel.id} className="bg-white border border-zinc-200 overflow-hidden">
          <div className="flex items-start justify-between px-5 py-4 border-b border-zinc-100">
            <div>
              <h2 className="text-sm font-semibold text-zinc-900">{channel.name}</h2>
              {channel.channel_templates?.description && (
                <p className="text-xs text-zinc-400 mt-0.5">{channel.channel_templates.description}</p>
              )}
            </div>
            <div className="flex items-center gap-2 flex-shrink-0 ml-4">
              <button
                onClick={() => exportChannelCSV(campaign, channel)}
                className="text-xs text-zinc-500 border border-zinc-200 px-2.5 py-1 hover:bg-zinc-50"
              >
                Export CSV
              </button>
              <button
                onClick={() => handleCopyAll(channel)}
                className="text-xs text-zinc-500 border border-zinc-200 px-2.5 py-1 hover:bg-zinc-50"
              >
                {copied[`ch_${channel.id}`] ? 'Copied!' : 'Copy all URLs'}
              </button>
              <button
                onClick={() => navigate(`/campaigns/${campaignId}/channels/${channel.id}/urls/new`)}
                className="bg-teal-600 text-white rounded-full px-3 py-1 text-xs font-medium hover:bg-teal-700"
              >
                + Add URL
              </button>
            </div>
          </div>

          {channel.urls.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-zinc-400">
              No URLs yet.{' '}
              <button
                onClick={() => navigate(`/campaigns/${campaignId}/channels/${channel.id}/urls/new`)}
                className="text-teal-600 hover:underline"
              >
                Build the first one
              </button>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-zinc-100">
                  {['Label', 'URL', 'Parameters', 'Created by', 'Actions'].map(col => (
                    <th key={col} className="text-left px-5 py-3 text-xs font-semibold text-zinc-400 uppercase tracking-wide">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {channel.urls.map(url => (
                  <tr key={url.id} className="border-b border-zinc-50 hover:bg-zinc-50">
                    <td className="px-5 py-3 text-sm text-zinc-700 max-w-[140px]">
                      <span className="block truncate">{url.label || '—'}</span>
                    </td>
                    <td className="px-5 py-3 max-w-[240px]">
                      <code className="text-xs text-zinc-600 break-all block truncate">{url.full_url}</code>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex flex-wrap gap-1">
                        {Object.entries(url.parameters || {}).map(([k, v]) => (
                          <span key={k} className="text-xs bg-zinc-100 text-zinc-600 px-2 py-0.5 rounded-full font-mono">
                            {k}={v}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-5 py-3 text-xs text-zinc-400">
                      {url.created_by_email || '—'}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3 justify-end">
                        <button
                          onClick={() => handleCopyUrl(url)}
                          className="text-xs text-zinc-500 hover:text-zinc-900"
                        >
                          {copied[url.id] ? 'Copied!' : 'Copy'}
                        </button>
                        <button
                          onClick={() => navigate(`/campaigns/${campaignId}/channels/${channel.id}/urls/${url.id}/edit`)}
                          className="text-xs text-zinc-500 hover:text-zinc-900"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => deleteUrl(url.id, channel.id)}
                          className="text-xs text-red-400 hover:text-red-600"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ))}
    </div>
  )
}
