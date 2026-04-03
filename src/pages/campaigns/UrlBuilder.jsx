import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useOrg } from '../../contexts/OrgContext'
import { useAuth } from '../../contexts/AuthContext'
import { useConfiguration } from '../../hooks/useConfiguration'
import { writeAuditLog } from '../../lib/auditLog'
import { buildUrl } from '../../lib/campaignExport'
import { validateAgainstFormatStandards } from '../../lib/formatValidator'
import ParameterField from './components/ParameterField'
import ValueRequestModal from './components/ValueRequestModal'

function Spinner() {
  return (
    <div className="flex items-center justify-center py-16">
      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-teal-600" />
    </div>
  )
}

export default function UrlBuilder() {
  const { campaignId, channelId, urlId } = useParams()
  const isEdit = !!urlId
  const { currentOrg } = useOrg()
  const { user } = useAuth()
  const { config } = useConfiguration()
  const navigate = useNavigate()

  const [campaign, setCampaign] = useState(null)
  const [channel, setChannel] = useState(null)
  const [templateParams, setTemplateParams] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [baseUrl, setBaseUrl] = useState('')
  const [label, setLabel] = useState('')
  const [notes, setNotes] = useState('')
  const [paramValues, setParamValues] = useState({})
  const [extraParams, setExtraParams] = useState([])
  const [showExtraParams, setShowExtraParams] = useState(false)
  const [copied, setCopied] = useState(false)

  // Value request modal
  const [vrParam, setVrParam] = useState(null)

  useEffect(() => {
    if (campaignId && channelId) loadData()
  }, [campaignId, channelId, urlId])

  async function loadData() {
    setLoading(true)
    const [{ data: c }, { data: ch }] = await Promise.all([
      supabase.from('campaigns').select('*').eq('id', campaignId).single(),
      supabase.from('campaign_channels')
        .select('*, channel_templates(name, description, parameters)')
        .eq('id', channelId).single(),
    ])
    setCampaign(c)
    setChannel(ch)

    const params = ch?.channel_templates?.parameters || []
    setTemplateParams(params)

    // Pre-fill defaults
    const defaults = {}
    params.forEach(p => { if (p.defaultValue) defaults[p.name] = p.defaultValue })
    setParamValues(defaults)

    if (c?.default_base_url) setBaseUrl(c.default_base_url)

    if (isEdit) {
      const { data: urlData } = await supabase
        .from('campaign_urls')
        .select('*')
        .eq('id', urlId)
        .single()
      if (urlData) {
        setBaseUrl(urlData.base_url || c?.default_base_url || '')
        setLabel(urlData.label || '')
        setNotes(urlData.notes || '')
        setParamValues(urlData.parameters || {})
      }
    }

    setLoading(false)
  }

  function updateParam(name, value) {
    setParamValues(prev => ({ ...prev, [name]: value }))
  }

  const formatStandards = currentOrg?.formatStandards || {}
  const triggerParams = currentOrg?.triggerParameters || ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term']
  const templateParamNames = templateParams.map(p => p.name)
  const availableExtraParams = triggerParams.filter(p => !templateParamNames.includes(p) && !extraParams.includes(p))

  function addExtraParam(name) {
    setExtraParams(prev => [...prev, name])
    setShowExtraParams(false)
  }

  // Compute validation state
  const allParams = [
    ...templateParams,
    ...extraParams.map(name => ({ name, required: false, locked: false, allowedValues: [] }))
  ]

  const builtUrl = buildUrl(baseUrl, paramValues)

  const validationErrors = []
  const validationWarnings = []

  allParams.forEach(param => {
    const value = paramValues[param.name]
    if (param.required && !value) {
      validationErrors.push(`${param.name} is required`)
      return
    }
    if (!value) return

    const globalAllowed = config?.allowedValues?.[param.name] || []
    const allowed = param.allowedValues?.length > 0 ? param.allowedValues : globalAllowed
    if (allowed.length > 0 && !allowed.includes(value)) {
      validationWarnings.push(`${param.name} "${value}" is not in the approved list`)
    }

    const violations = validateAgainstFormatStandards(value, formatStandards)
    violations.forEach(v => validationErrors.push(`${param.name}: ${v}`))
  })

  if (!baseUrl) validationErrors.push('Landing page URL is required')

  const allRequiredFilled = allParams
    .filter(p => p.required)
    .every(p => paramValues[p.name])

  // Conditional rule warnings
  const conditionalRuleWarnings = []
  const rules = config?.conditionalRules || []
  rules.forEach(rule => {
    const anchors = rule.anchors || (rule.anchor ? [rule.anchor] : [])
    const allAnchorsMatch = anchors.every(a => paramValues[a.parameter] === a.value)
    if (!allAnchorsMatch) return
    Object.entries(rule.conditionals || {}).forEach(([param, cond]) => {
      const value = paramValues[param]
      if (value && cond.values?.length > 0 && !cond.values.includes(value)) {
        conditionalRuleWarnings.push(
          `Rule "${rule.name}": ${param} should be one of: ${cond.values.join(', ')}`
        )
      }
    })
  })

  async function handleValueRequestOneTime(value, reason) {
    const param = vrParam
    setVrParam(null)
    updateParam(param, value)
    await supabase.from('value_requests').insert({
      organization_id: currentOrg.id,
      parameter: param,
      value,
      request_type: 'one_time',
      status: 'pending',
      requested_by: user?.id,
      requested_by_email: user?.email,
      context: { campaign_id: campaignId, channel_id: channelId },
    })
    await writeAuditLog({
      organizationId: currentOrg.id,
      userId: user?.id,
      userEmail: user?.email,
      action: 'value_requested',
      entityType: 'parameter',
      entityName: param,
      metadata: { value, requestType: 'one_time', campaignName: campaign?.name },
    })
  }

  async function handleValueRequestPermanent(value, reason) {
    const param = vrParam
    setVrParam(null)
    updateParam(param, value)
    await supabase.from('value_requests').insert({
      organization_id: currentOrg.id,
      parameter: param,
      value,
      request_type: 'add_permanently',
      status: 'pending',
      requested_by: user?.id,
      requested_by_email: user?.email,
      context: { campaign_id: campaignId, channel_id: channelId },
    })
    await writeAuditLog({
      organizationId: currentOrg.id,
      userId: user?.id,
      userEmail: user?.email,
      action: 'value_requested',
      entityType: 'parameter',
      entityName: param,
      metadata: { value, requestType: 'add_permanently', campaignName: campaign?.name },
    })
  }

  async function handleSave() {
    if (validationErrors.length > 0 || !allRequiredFilled) return
    setSaving(true)
    setError('')
    try {
      const payload = {
        campaign_id: campaignId,
        channel_id: channelId,
        base_url: baseUrl || null,
        parameters: paramValues,
        full_url: builtUrl,
        label: label || null,
        notes: notes || null,
        created_by: user?.id,
        created_by_email: user?.email,
      }

      if (isEdit) {
        const { error: err } = await supabase.from('campaign_urls').update(payload).eq('id', urlId)
        if (err) throw err
      } else {
        const { error: err } = await supabase.from('campaign_urls').insert(payload)
        if (err) throw err
      }

      await writeAuditLog({
        organizationId: currentOrg.id,
        userId: user?.id,
        userEmail: user?.email,
        action: 'url_created',
        entityType: 'campaign',
        entityName: campaign?.name,
        metadata: { url: builtUrl, channel: channel?.name },
      })

      navigate(`/campaigns/${campaignId}`)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleCopy() {
    if (!builtUrl) return
    await navigator.clipboard.writeText(builtUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (loading) return <Spinner />

  return (
    <div className="max-w-5xl">
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => navigate(`/campaigns/${campaignId}`)}
          className="text-sm text-zinc-400 hover:text-zinc-600"
        >
          ← {campaign?.name}
        </button>
        <span className="text-zinc-200">/</span>
        <span className="text-sm text-zinc-500">{channel?.name}</span>
        <span className="text-zinc-200">/</span>
        <h1 className="text-xl font-semibold text-zinc-900">{isEdit ? 'Edit URL' : 'Build URL'}</h1>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-sm text-red-700">{error}</div>
      )}

      <div className="grid grid-cols-5 gap-6">
        {/* Left: URL Configuration */}
        <div className="col-span-3 bg-white border border-zinc-200 p-6 space-y-4">
          <h2 className="text-sm font-semibold text-zinc-900">URL Configuration</h2>

          {/* Base URL */}
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">Landing page URL *</label>
            <input
              type="url"
              value={baseUrl}
              onChange={e => setBaseUrl(e.target.value)}
              placeholder={campaign?.default_base_url || 'https://example.com/page'}
              className="w-full px-3 py-2 border border-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-600"
            />
            {campaign?.default_base_url && baseUrl !== campaign.default_base_url && (
              <button
                type="button"
                onClick={() => setBaseUrl(campaign.default_base_url)}
                className="text-xs text-teal-600 mt-1 hover:underline"
              >
                Use campaign default ({campaign.default_base_url})
              </button>
            )}
          </div>

          {/* Label */}
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">
              Label <span className="text-zinc-400 font-normal">(optional)</span>
            </label>
            <input
              type="text"
              value={label}
              onChange={e => setLabel(e.target.value)}
              placeholder="e.g. Google Brand Desktop"
              className="w-full px-3 py-2 border border-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-600"
            />
          </div>

          {/* Template parameters */}
          <div>
            <h3 className="text-sm font-medium text-zinc-700 mb-3">Parameters</h3>
            {templateParams.map(param => (
              <ParameterField
                key={param.name}
                param={param}
                value={paramValues[param.name]}
                onChange={val => updateParam(param.name, val)}
                onRequestValue={setVrParam}
                globalAllowedValues={config?.allowedValues?.[param.name] || []}
                formatStandards={formatStandards}
              />
            ))}
          </div>

          {/* Extra params */}
          {extraParams.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-zinc-700 mb-3">Additional Parameters</h3>
              {extraParams.map(name => (
                <ParameterField
                  key={name}
                  param={{ name, required: false, locked: false, allowedValues: [] }}
                  value={paramValues[name]}
                  onChange={val => updateParam(name, val)}
                  onRequestValue={setVrParam}
                  globalAllowedValues={config?.allowedValues?.[name] || []}
                  formatStandards={formatStandards}
                />
              ))}
            </div>
          )}

          {availableExtraParams.length > 0 && (
            <div>
              <button
                type="button"
                onClick={() => setShowExtraParams(!showExtraParams)}
                className="text-sm text-zinc-500 hover:text-zinc-700"
              >
                + Add additional parameter
              </button>
              {showExtraParams && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {availableExtraParams.map(p => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => addExtraParam(p)}
                      className="text-xs bg-zinc-100 text-zinc-600 hover:bg-teal-50 hover:text-teal-700 px-3 py-1 rounded-full border border-zinc-200"
                    >
                      {p}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">
              Notes <span className="text-zinc-400 font-normal">(optional)</span>
            </label>
            <input
              type="text"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Internal notes about this URL"
              className="w-full px-3 py-2 border border-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-600"
            />
          </div>
        </div>

        {/* Right: Preview */}
        <div className="col-span-2">
          <div className="bg-white border border-zinc-200 p-5 sticky top-6 space-y-4">
            <h2 className="text-sm font-semibold text-zinc-700">URL Preview</h2>

            <div className="bg-zinc-50 border border-zinc-200 p-3">
              <code className="text-xs text-zinc-700 break-all leading-relaxed">
                {builtUrl || (
                  <span className="text-zinc-400">Fill in the fields to generate your URL</span>
                )}
              </code>
            </div>

            {/* Validation summary */}
            <div className="space-y-1">
              {validationErrors.map((e, i) => (
                <div key={i} className="flex items-start gap-1.5 text-sm text-red-500">
                  <span className="flex-shrink-0">✗</span> {e}
                </div>
              ))}
              {validationWarnings.map((w, i) => (
                <div key={i} className="flex items-start gap-1.5 text-sm text-amber-600">
                  <span className="flex-shrink-0">⚠</span> {w}
                </div>
              ))}
              {validationErrors.length === 0 && allRequiredFilled && builtUrl && (
                <div className="flex items-center gap-1.5 text-sm text-teal-600">
                  <span>✓</span> URL passes all validation rules
                </div>
              )}
            </div>

            {/* Conditional rule warnings */}
            {conditionalRuleWarnings.length > 0 && (
              <div className="p-3 bg-amber-50 border border-amber-200">
                <p className="text-xs font-medium text-amber-700 mb-1">Rule warnings</p>
                {conditionalRuleWarnings.map((w, i) => (
                  <p key={i} className="text-xs text-amber-600">{w}</p>
                ))}
              </div>
            )}

            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={handleCopy}
                disabled={!builtUrl || !allRequiredFilled}
                className="w-full bg-white text-zinc-700 border border-zinc-200 px-4 py-2 text-sm hover:bg-zinc-50 disabled:opacity-50 transition-colors"
              >
                {copied ? 'Copied!' : 'Copy URL'}
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving || validationErrors.length > 0 || !allRequiredFilled}
                className="w-full bg-teal-600 text-white rounded-full px-4 py-2 text-sm font-medium hover:bg-teal-700 disabled:opacity-50 transition-colors"
              >
                {saving ? 'Saving…' : 'Save URL'}
              </button>
            </div>

            <button
              type="button"
              onClick={() => navigate(`/campaigns/${campaignId}`)}
              className="w-full text-center text-sm text-zinc-400 hover:text-zinc-600"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>

      {/* Value request modal */}
      {vrParam && (
        <ValueRequestModal
          parameter={vrParam}
          onClose={() => setVrParam(null)}
          onAddOneTime={handleValueRequestOneTime}
          onRequest={handleValueRequestPermanent}
        />
      )}
    </div>
  )
}
