import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useOrg } from '../../contexts/OrgContext'
import { useAuth } from '../../contexts/AuthContext'
import { writeAuditLog } from '../../lib/auditLog'
import Modal from '../../components/ui/Modal'

function TagInput({ value, onChange }) {
  const [input, setInput] = useState('')

  function addTag() {
    const tag = input.trim().toLowerCase()
    if (tag && !value.includes(tag)) {
      onChange([...value, tag])
    }
    setInput('')
  }

  return (
    <div className="flex flex-wrap gap-1.5 p-2 border border-zinc-200 min-h-[42px] focus-within:ring-2 focus-within:ring-teal-600">
      {value.map(tag => (
        <span key={tag} className="flex items-center gap-1 bg-zinc-100 text-zinc-600 text-xs rounded-full px-2 py-1">
          {tag}
          <button
            type="button"
            onClick={() => onChange(value.filter(t => t !== tag))}
            className="text-zinc-400 hover:text-zinc-700 leading-none"
          >
            ×
          </button>
        </span>
      ))}
      <input
        type="text"
        value={input}
        onChange={e => setInput(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag() }
        }}
        placeholder={value.length === 0 ? 'Add tags (press Enter)' : ''}
        className="flex-1 min-w-[120px] text-sm focus:outline-none bg-transparent"
      />
    </div>
  )
}

export default function CampaignEditor() {
  const { campaignId } = useParams()
  const isEdit = !!campaignId
  const { currentOrg } = useOrg()
  const { user } = useAuth()
  const navigate = useNavigate()

  const [name, setName] = useState('')
  const [defaultBaseUrl, setDefaultBaseUrl] = useState('')
  const [status, setStatus] = useState('draft')
  const [ownerId, setOwnerId] = useState('')
  const [ownerEmail, setOwnerEmail] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [isEvergreen, setIsEvergreen] = useState(false)
  const [tags, setTags] = useState([])
  const [channels, setChannels] = useState([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(isEdit)

  // Add channel modal
  const [addChannelOpen, setAddChannelOpen] = useState(false)
  const [templates, setTemplates] = useState([])
  const [suggestOpen, setSuggestOpen] = useState(false)
  const [suggestName, setSuggestName] = useState('')
  const [suggestDesc, setSuggestDesc] = useState('')
  const [suggesting, setSuggesting] = useState(false)

  // Org members for owner dropdown
  const [members, setMembers] = useState([])

  useEffect(() => {
    if (!currentOrg?.id) return
    loadTemplates()
    loadMembers()
    if (isEdit) loadCampaign()
  }, [currentOrg?.id, campaignId])

  async function loadTemplates() {
    const { data } = await supabase
      .from('channel_templates')
      .select('*')
      .eq('organization_id', currentOrg.id)
      .eq('status', 'active')
      .order('name')
    setTemplates(data || [])
  }

  async function loadMembers() {
    const { data } = await supabase
      .from('organization_members')
      .select('user_id, email, user_profiles(full_name)')
      .eq('organization_id', currentOrg.id)
    setMembers(data || [])
    // Default owner to current user
    if (!isEdit) {
      const me = (data || []).find(m => m.user_id === user?.id)
      if (me) { setOwnerId(me.user_id); setOwnerEmail(me.email) }
    }
  }

  async function loadCampaign() {
    setLoading(true)
    const { data: campaign } = await supabase
      .from('campaigns')
      .select('*, campaign_channels(*)')
      .eq('id', campaignId)
      .single()
    if (campaign) {
      setName(campaign.name)
      setDefaultBaseUrl(campaign.default_base_url || '')
      setStatus(campaign.status)
      setOwnerId(campaign.owner_id || '')
      setOwnerEmail(campaign.owner_email || '')
      setStartDate(campaign.start_date || '')
      setEndDate(campaign.end_date || '')
      setIsEvergreen(campaign.is_evergreen || false)
      setTags(campaign.tags || [])
      // Load channels with URL counts
      const channelsWithCounts = await Promise.all(
        (campaign.campaign_channels || []).map(async ch => {
          const { count } = await supabase
            .from('campaign_urls')
            .select('id', { count: 'exact', head: true })
            .eq('channel_id', ch.id)
          return { ...ch, urlCount: count || 0 }
        })
      )
      setChannels(channelsWithCounts)
    }
    setLoading(false)
  }

  async function handleAddChannel(template) {
    // If editing, insert immediately; if new, queue for later save
    if (isEdit) {
      const { data: ch } = await supabase
        .from('campaign_channels')
        .insert({
          campaign_id: campaignId,
          channel_template_id: template.id,
          name: template.name,
        })
        .select()
        .single()
      if (ch) setChannels(prev => [...prev, { ...ch, urlCount: 0, template }])
    } else {
      setChannels(prev => [...prev, {
        id: `temp_${Date.now()}`,
        channel_template_id: template.id,
        name: template.name,
        urlCount: 0,
        template,
      }])
    }
    setAddChannelOpen(false)
  }

  async function removeChannel(channelId) {
    if (channelId.startsWith('temp_')) {
      setChannels(prev => prev.filter(c => c.id !== channelId))
      return
    }
    if (!confirm('Remove this channel and all its URLs?')) return
    await supabase.from('campaign_channels').delete().eq('id', channelId)
    setChannels(prev => prev.filter(c => c.id !== channelId))
  }

  async function handleSuggestTemplate(e) {
    e.preventDefault()
    setSuggesting(true)
    await supabase.from('channel_template_suggestions').insert({
      organization_id: currentOrg.id,
      suggested_by: user?.id,
      suggested_by_email: user?.email,
      name: suggestName,
      description: suggestDesc,
      parameters: [],
    })
    await writeAuditLog({
      organizationId: currentOrg.id,
      userId: user?.id,
      userEmail: user?.email,
      action: 'channel_template_suggested',
      entityType: 'account',
      metadata: { templateName: suggestName },
    })
    setSuggestOpen(false)
    setSuggestName('')
    setSuggestDesc('')
    setSuggesting(false)
  }

  async function handleSave(e) {
    e.preventDefault()
    setError('')
    setSaving(true)
    try {
      const selectedMember = members.find(m => m.user_id === ownerId)
      const payload = {
        organization_id: currentOrg.id,
        name,
        status,
        owner_id: ownerId || null,
        owner_email: selectedMember?.email || ownerEmail || null,
        default_base_url: defaultBaseUrl || null,
        start_date: startDate || null,
        end_date: isEvergreen ? null : (endDate || null),
        is_evergreen: isEvergreen,
        tags,
      }

      let savedId = campaignId
      if (isEdit) {
        const { error: err } = await supabase.from('campaigns').update(payload).eq('id', campaignId)
        if (err) throw err
        await writeAuditLog({
          organizationId: currentOrg.id,
          userId: user?.id,
          userEmail: user?.email,
          action: 'campaign_updated',
          entityType: 'campaign',
          entityName: name,
        })
      } else {
        const { data: newCampaign, error: err } = await supabase
          .from('campaigns')
          .insert(payload)
          .select()
          .single()
        if (err) throw err
        savedId = newCampaign.id

        // Insert queued channels
        for (const ch of channels) {
          await supabase.from('campaign_channels').insert({
            campaign_id: savedId,
            channel_template_id: ch.channel_template_id,
            name: ch.name,
          })
        }

        await writeAuditLog({
          organizationId: currentOrg.id,
          userId: user?.id,
          userEmail: user?.email,
          action: 'campaign_created',
          entityType: 'campaign',
          entityName: name,
        })
      }

      navigate(`/campaigns/${savedId}`)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center py-16">
      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-teal-600" />
    </div>
  )

  return (
    <div className="max-w-5xl">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate('/campaigns')} className="text-sm text-zinc-400 hover:text-zinc-600">
          ← Campaigns
        </button>
        <span className="text-zinc-200">/</span>
        <h1 className="text-xl font-semibold text-zinc-900">
          {isEdit ? 'Edit Campaign' : 'New Campaign'}
        </h1>
      </div>

      <form onSubmit={handleSave}>
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-sm text-red-700">{error}</div>
        )}

        <div className="grid grid-cols-5 gap-6">
          {/* Left: Campaign Details */}
          <div className="col-span-3 bg-white border border-zinc-200 p-6 space-y-4">
            <h2 className="text-sm font-semibold text-zinc-900">Campaign Details</h2>

            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">Campaign name *</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                required
                placeholder="e.g. Spring Sale 2026"
                className="w-full px-3 py-2 border border-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-600"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">Default landing page</label>
              <input
                type="url"
                value={defaultBaseUrl}
                onChange={e => setDefaultBaseUrl(e.target.value)}
                placeholder="https://example.com/landing"
                className="w-full px-3 py-2 border border-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-600"
              />
              <p className="text-xs text-zinc-400 mt-1">Individual URLs can override this.</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">Status</label>
              <select
                value={status}
                onChange={e => setStatus(e.target.value)}
                className="w-full px-3 py-2 border border-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-600"
              >
                <option value="draft">Draft</option>
                <option value="active">Active</option>
                <option value="paused">Paused</option>
                <option value="complete">Complete</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">Campaign owner</label>
              <select
                value={ownerId}
                onChange={e => {
                  setOwnerId(e.target.value)
                  const m = members.find(m => m.user_id === e.target.value)
                  setOwnerEmail(m?.email || '')
                }}
                className="w-full px-3 py-2 border border-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-600"
              >
                <option value="">— Select owner —</option>
                {members.map(m => (
                  <option key={m.user_id} value={m.user_id}>
                    {m.user_profiles?.full_name || m.email}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-zinc-700 mb-1">Start date</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={e => setStartDate(e.target.value)}
                    className="w-full px-3 py-2 border border-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-600"
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-sm font-medium text-zinc-700 mb-1">End date</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={e => setEndDate(e.target.value)}
                    disabled={isEvergreen}
                    className="w-full px-3 py-2 border border-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-600 disabled:bg-zinc-50 disabled:text-zinc-400"
                  />
                </div>
              </div>
              <label className="flex items-center gap-2 mt-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isEvergreen}
                  onChange={e => setIsEvergreen(e.target.checked)}
                  className="h-4 w-4 border-zinc-300 text-teal-600"
                />
                <span className="text-sm text-zinc-600">Evergreen campaign (no end date)</span>
              </label>
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">Tags</label>
              <TagInput value={tags} onChange={setTags} />
            </div>
          </div>

          {/* Right: Channels */}
          <div className="col-span-2 bg-white border border-zinc-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-zinc-900">Channels</h2>
              <button
                type="button"
                onClick={() => setAddChannelOpen(true)}
                className="text-sm text-teal-600 hover:text-teal-700 font-medium"
              >
                + Add Channel
              </button>
            </div>

            {channels.length === 0 ? (
              <div className="text-center py-8 text-sm text-zinc-400">
                No channels added yet.
                <br />
                <button
                  type="button"
                  onClick={() => setAddChannelOpen(true)}
                  className="text-teal-600 hover:underline mt-1"
                >
                  Add your first channel
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {channels.map(ch => (
                  <div key={ch.id} className="flex items-center justify-between py-2 border-b border-zinc-100 last:border-0">
                    <div>
                      <p className="text-sm font-medium text-zinc-900">{ch.name}</p>
                      <p className="text-xs text-zinc-400">{ch.urlCount} URL{ch.urlCount !== 1 ? 's' : ''}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeChannel(ch.id)}
                      className="text-zinc-300 hover:text-red-400 text-lg leading-none"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 mt-6">
          <button
            type="submit"
            disabled={saving || !name}
            className="bg-teal-600 text-white rounded-full px-5 py-2 text-sm font-medium hover:bg-teal-700 disabled:opacity-50"
          >
            {saving ? 'Saving…' : (isEdit ? 'Save changes' : 'Create campaign')}
          </button>
          <button
            type="button"
            onClick={() => navigate('/campaigns')}
            className="bg-white text-zinc-700 border border-zinc-200 rounded-full px-5 py-2 text-sm hover:bg-zinc-50"
          >
            Cancel
          </button>
        </div>
      </form>

      {/* Add Channel Modal */}
      <Modal
        open={addChannelOpen}
        onClose={() => setAddChannelOpen(false)}
        title="Add Channel"
      >
        <div className="space-y-3">
          {templates.length === 0 ? (
            <p className="text-sm text-zinc-500 text-center py-4">No channel templates found.</p>
          ) : (
            templates.map(tpl => (
              <button
                key={tpl.id}
                type="button"
                onClick={() => handleAddChannel(tpl)}
                className="w-full p-4 border border-zinc-200 hover:border-teal-300 hover:bg-teal-50 text-left transition-colors"
              >
                <p className="text-sm font-medium text-zinc-900">{tpl.name}</p>
                {tpl.description && (
                  <p className="text-xs text-zinc-400 mt-0.5">{tpl.description}</p>
                )}
                <p className="text-xs text-zinc-400 mt-1">
                  {(tpl.parameters || []).map(p => p.name).join(', ')}
                </p>
              </button>
            ))
          )}
          <div className="pt-3 border-t border-zinc-100">
            <button
              type="button"
              onClick={() => { setAddChannelOpen(false); setSuggestOpen(true) }}
              className="text-sm text-teal-600 hover:underline"
            >
              Don't see what you need? Suggest a new channel type →
            </button>
          </div>
        </div>
      </Modal>

      {/* Suggest Template Modal */}
      <Modal
        open={suggestOpen}
        onClose={() => setSuggestOpen(false)}
        title="Suggest a Channel Template"
      >
        <form onSubmit={handleSuggestTemplate} className="space-y-4">
          <p className="text-sm text-zinc-500">
            Describe the channel type you need. A manager will review and add it.
          </p>
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">Template name *</label>
            <input
              type="text"
              value={suggestName}
              onChange={e => setSuggestName(e.target.value)}
              required
              placeholder="e.g. Podcast Ads"
              className="w-full px-3 py-2 border border-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-600"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">Description</label>
            <input
              type="text"
              value={suggestDesc}
              onChange={e => setSuggestDesc(e.target.value)}
              placeholder="What is this channel used for?"
              className="w-full px-3 py-2 border border-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-600"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setSuggestOpen(false)}
              className="bg-white text-zinc-700 border border-zinc-200 rounded-full px-4 py-2 text-sm hover:bg-zinc-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={suggesting || !suggestName}
              className="bg-teal-600 text-white rounded-full px-4 py-2 text-sm font-medium hover:bg-teal-700 disabled:opacity-50"
            >
              {suggesting ? 'Submitting…' : 'Submit suggestion'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
