import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthContext'
import { db } from '../lib/firebase'
import { collection, query, where, getCountFromServer, getDocs, orderBy, limit } from 'firebase/firestore'

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
      // Events count — try getCountFromServer first, fall back to getDocs
      try {
        const periodStart = new Date()
        periodStart.setDate(1)
        periodStart.setHours(0, 0, 0, 0)
        const eventsQuery = query(
          collection(db, `organizations/${orgData.firestore_api_key}/utm_events`),
          where('receivedAt', '>=', periodStart.toISOString())
        )
        let eventCount = 0
        try {
          const countSnap = await getCountFromServer(eventsQuery)
          eventCount = countSnap.data().count
        } catch {
          const fallbackSnap = await getDocs(eventsQuery)
          eventCount = fallbackSnap.size
        }
        setOrg(prev => ({ ...prev, eventCount }))
      } catch (e) {
        console.warn('Events count query failed:', e)
      }

      // Conflicts count — separate try/catch
      try {
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
        const conflictDocs = await getDocs(
          query(
            collection(db, `organizations/${orgData.firestore_api_key}/conflicts`),
            where('validationTimestamp', '>=', thirtyDaysAgo.toISOString())
          )
        )
        const uniqueEventPaths = new Set()
        conflictDocs.forEach(doc => {
          const data = doc.data()
          if (data.documentPath) uniqueEventPaths.add(data.documentPath)
        })
        setOrg(prev => ({
          ...prev,
          conflictCount: conflictDocs.size,
          eventsWithConflicts: uniqueEventPaths.size,
        }))
      } catch (e) {
        console.warn('Conflicts count query failed:', e)
      }

      // Fetch additional org fields
      try {
        const { data: extraData } = await supabase
          .from('organizations')
          .select('format_standards, conflict_threshold, timezone, trigger_parameters')
          .eq('id', orgData.id)
          .single()

        setOrg(prev => ({
          ...prev,
          formatStandards: extraData?.format_standards || {},
          conflictThreshold: extraData?.conflict_threshold || 1,
          timezone: extraData?.timezone || 'America/New_York',
          triggerParameters: extraData?.trigger_parameters || ['utm_source','utm_medium','utm_campaign','utm_content','utm_term'],
        }))

        // Fetch conflict resolution rules
        const { data: resRules } = await supabase
          .from('conflict_resolution_rules')
          .select('*')
          .eq('organization_id', orgData.id)

        setOrg(prev => ({ ...prev, resolutionRules: resRules || [] }))
      } catch (e) {
        console.warn('Extra org fields fetch failed:', e)
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
