import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthContext'
import { db } from '../lib/firebase'
import { collection, query, where, getCountFromServer } from 'firebase/firestore'

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
      try {
        const periodStart = new Date()
        periodStart.setDate(1)
        periodStart.setHours(0, 0, 0, 0)
        const eventsSnap = await getCountFromServer(
          query(collection(db, `organizations/${orgData.firestore_api_key}/utm_events`),
                where('receivedAt', '>=', periodStart.toISOString()))
        )
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
        const conflictsSnap = await getCountFromServer(
          query(collection(db, `organizations/${orgData.firestore_api_key}/conflicts`),
                where('validationTimestamp', '>=', thirtyDaysAgo.toISOString()))
        )
        setOrg(prev => ({ ...prev, eventCount: eventsSnap.data().count, conflictCount: conflictsSnap.data().count }))
      } catch (e) {
        console.warn('Count query failed:', e)
      }
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
