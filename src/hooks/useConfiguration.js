import { useState, useEffect, useCallback } from 'react'
import { getConfiguration, saveConfiguration } from '../lib/api'
import { useOrg } from '../contexts/OrgContext'

export function useConfiguration() {
  const { currentOrg } = useOrg()
  const apiKey = currentOrg?.firestore_api_key

  const [config, setConfig] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    if (!apiKey) return
    setLoading(true)
    setError(null)
    try {
      const data = await getConfiguration(apiKey)
      setConfig(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [apiKey])

  useEffect(() => { load() }, [load])

  const save = useCallback(async (updates) => {
    if (!apiKey) return
    const merged = { ...config, ...updates }
    await saveConfiguration(apiKey, merged)
    setConfig(merged)
  }, [apiKey, config])

  return { config, loading, error, reload: load, save }
}
