const CONFIG_API_URL = import.meta.env.VITE_CONFIG_API_URL

export async function getConfiguration(apiKey) {
  const res = await fetch(`${CONFIG_API_URL}?apiKey=${encodeURIComponent(apiKey)}`)
  if (!res.ok) throw new Error(`Failed to load configuration: ${res.status}`)
  return res.json()
}

export async function saveConfiguration(apiKey, data) {
  const res = await fetch(`${CONFIG_API_URL}?apiKey=${encodeURIComponent(apiKey)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error(`Failed to save configuration: ${res.status}`)
  return res.json()
}
