import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import Button from '../../components/ui/Button'

export default function AcceptInvite() {
  const { token } = useParams()
  const navigate = useNavigate()
  const [invitation, setInvitation] = useState(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    async function loadInvite() {
      const { data, error } = await supabase
        .from('invitations')
        .select('*, organizations(name)')
        .eq('token', token)
        .is('accepted_at', null)
        .single()

      if (error || !data) {
        setError('Invitation not found or already used.')
      } else if (new Date(data.expires_at) < new Date()) {
        setError('This invitation has expired.')
      } else {
        setInvitation(data)
        setEmail(data.email)
      }
      setLoading(false)
    }
    loadInvite()
  }, [token])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      const { data: { user }, error: signUpError } = await supabase.auth.signUp({ email, password })
      if (signUpError && signUpError.message !== 'User already registered') throw signUpError

      let userId = user?.id
      if (!userId) {
        const { data: { user: existing } } = await supabase.auth.signInWithPassword({ email, password })
        userId = existing?.id
      }
      if (!userId) throw new Error('Could not get user ID')

      const { error: memberError } = await supabase
        .from('organization_members')
        .insert({
          organization_id: invitation.organization_id,
          user_id: userId,
          role: invitation.role,
          invited_by: invitation.invited_by,
          accepted_at: new Date().toISOString(),
        })
      if (memberError && !memberError.message.includes('unique')) throw memberError

      await supabase
        .from('invitations')
        .update({ accepted_at: new Date().toISOString() })
        .eq('id', invitation.id)

      navigate('/dashboard')
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" /></div>

  return (
    <div className="min-h-screen bg-zinc-100 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <img src="/validurchin.png" alt="ValidUrchin" className="h-12 mx-auto mb-3" />
          <h1 className="text-2xl font-semibold text-zinc-900">You're invited</h1>
          {invitation && <p className="text-sm text-zinc-500 mt-1">Join <strong>{invitation.organizations.name}</strong> on ValidUrchin</p>}
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-zinc-200 p-6">
          {error && !invitation ? (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">{error}</div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">{error}</div>}
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">Email</label>
                <input type="email" value={email} disabled className="w-full px-3 py-2 rounded-lg border border-zinc-200 text-sm bg-zinc-50 text-zinc-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">Password</label>
                <input
                  type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={6}
                  className="w-full px-3 py-2 rounded-lg border border-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-600"
                  placeholder="Choose a password"
                />
              </div>
              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? 'Joining…' : 'Accept invitation'}
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
