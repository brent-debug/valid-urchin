import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthContext'

const OrgContext = createContext(null)

export function OrgProvider({ children }) {
  const { user } = useAuth()
  const [org, setOrg] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) {
      setOrg(null)
      setLoading(false)
      return
    }
    fetchOrg()
  }, [user])

  async function fetchOrg() {
    setLoading(true)
    try {
      const { data: membership, error: memberError } = await supabase
        .from('organization_members')
        .select('organization_id, role')
        .eq('user_id', user.id)
        .single()

      if (memberError) throw memberError

      const { data: orgData, error: orgError } = await supabase
        .from('organizations')
        .select('*')
        .eq('id', membership.organization_id)
        .single()

      if (orgError) throw orgError

      setOrg({ ...orgData, role: membership.role })
    } catch (err) {
      console.error('Error fetching org:', err)
      setOrg(null)
    } finally {
      setLoading(false)
    }
  }

  return (
    <OrgContext.Provider value={{ org, currentOrg: org, loading, refetch: fetchOrg }}>
      {children}
    </OrgContext.Provider>
  )
}

export const useOrg = () => useContext(OrgContext)
