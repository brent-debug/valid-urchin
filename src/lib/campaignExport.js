export function exportCampaignCSV(campaign, channels) {
  const allParams = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term']

  // Collect all unique param keys across all URLs
  channels.forEach(ch => {
    (ch.urls || []).forEach(url => {
      Object.keys(url.parameters || {}).forEach(k => {
        if (!allParams.includes(k)) allParams.push(k)
      })
    })
  })

  const headers = ['Campaign', 'Channel', 'Label', 'Full URL', ...allParams, 'Notes', 'Created by']
  const rows = [headers]

  channels.forEach(channel => {
    (channel.urls || []).forEach(url => {
      rows.push([
        campaign.name,
        channel.name,
        url.label || '',
        url.full_url || '',
        ...allParams.map(p => url.parameters?.[p] || ''),
        url.notes || '',
        url.created_by_email || '',
      ])
    })
  })

  const csv = rows.map(r =>
    r.map(cell => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(',')
  ).join('\n')

  const blob = new Blob([csv], { type: 'text/csv' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = `${campaign.name.replace(/\s+/g, '-').toLowerCase()}-urls.csv`
  link.click()
}

export function exportChannelCSV(campaign, channel) {
  exportCampaignCSV(campaign, [channel])
}

export function copyUrlsToClipboard(urls) {
  const text = urls.map(u => u.full_url).filter(Boolean).join('\n')
  return navigator.clipboard.writeText(text)
}

export function buildUrl(baseUrl, params) {
  if (!baseUrl) return ''
  try {
    const url = new URL(baseUrl)
    Object.entries(params).forEach(([key, value]) => {
      if (value) url.searchParams.set(key, value)
    })
    return url.toString()
  } catch {
    return ''
  }
}
