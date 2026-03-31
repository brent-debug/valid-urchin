import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthContext'

const OrgContext = createContext(null)

export function OrgProvider({ children }) {
  const { user } = useAuth()
  const [orgs, setOrgs] = useState([])
  const [currentOrg, setCurrentOrg] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) {
      setOrgs([])
      setCurrentOrg(null)
      setLoading(false)
      return
    }
    fetchOrgs()
  }, [user])

  async function fetchOrgs() {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('organization_members')
        .select('role, organizations(*)')
        .eq('user_id', user.id)

      if (error) throw error

      const orgList = data.map(row => ({ ...row.organizations, role: row.role }))
      setOrgs(orgList)

      const saved = localStorage.getItem('currentOrgId')
      const found = orgList.find(o => o.id === saved)
      setCurrentOrg(found || orgList[0] || null)
    } catch (err) {
      console.error('Failed to fetch orgs:', err)
    } finally {
      setLoading(false)
    }
  }

  function switchOrg(orgId) {
    const org = orgs.find(o => o.id === orgId)
    if (org) {
      setCurrentOrg(org)
      localStorage.setItem('currentOrgId', orgId)
    }
  }

  async function createOrg(name, userId) {
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')

    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .insert({ name, slug })
      .select()
      .single()

    if (orgError) throw orgError

    const { error: memberError } = await supabase
      .from('organization_members')
      .insert({ organization_id: org.id, user_id: userId, role: 'owner' })

    if (memberError) throw memberError

    await fetchOrgs()
    return org
  }

  return (
    <OrgContext.Provider value={{ orgs, currentOrg, loading, switchOrg, createOrg, refetch: fetchOrgs }}>
      {children}
    </OrgContext.Provider>
  )
}

export const useOrg = () => useContext(OrgContext)
