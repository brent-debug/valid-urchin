import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import Button from '../../components/ui/Button'

export default function AcceptInvite() {
  const { token } = useParams()
  const navigate = useNavigate()
  const [invitation, setInvitation] = useState(null)
  const [fullName, setFullName] = useState('')
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
      // 1. Create auth user
      const { data: authData, error: signUpError } = await supabase.auth.signUp({ email, password })
      if (signUpError && signUpError.message !== 'User already registered') throw signUpError

      let userId = authData?.user?.id
      if (!userId) {
        const { data: { user: existing } } = await supabase.auth.signInWithPassword({ email, password })
        userId = existing?.id
      }
      if (!userId) throw new Error('Could not get user ID')

      // 2. Create user profile
      await supabase.from('user_profiles').insert({
        id: userId,
        organization_id: invitation.organization_id,
        full_name: fullName,
      })

      // 3. Add to organization_members (with email)
      const { error: memberError } = await supabase
        .from('organization_members')
        .insert({
          organization_id: invitation.organization_id,
          user_id: userId,
          email: invitation.email,
          role: invitation.role,
          invited_by: invitation.invited_by,
          accepted_at: new Date().toISOString(),
        })
      if (memberError && !memberError.message.includes('unique')) throw memberError

      // 4. Mark invitation as accepted
      await supabase
        .from('invitations')
        .update({ accepted_at: new Date().toISOString() })
        .eq('id', invitation.id)

      // 5. Set session
      if (authData?.session) {
        await supabase.auth.setSession({
          access_token: authData.session.access_token,
          refresh_token: authData.session.refresh_token,
        })
      }

      navigate('/')
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600" />
    </div>
  )

  return (
    <div className="min-h-screen bg-zinc-100 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <img src="/validurchin.png" alt="ValidUrchin" className="h-12 mx-auto mb-3" />
          <h1 className="text-2xl font-semibold text-zinc-900">You're invited</h1>
          {invitation && (
            <p className="text-sm text-zinc-500 mt-1">
              Join <strong>{invitation.organizations.name}</strong> on ValidUrchin
            </p>
          )}
        </div>

        <div className="bg-white shadow-sm border border-zinc-200 p-6">
          {error && !invitation ? (
            <div className="p-3 bg-red-50 border border-red-200 text-sm text-red-700">{error}</div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 text-sm text-red-700">{error}</div>
              )}
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">Your name</label>
                <input
                  type="text"
                  value={fullName}
                  onChange={e => setFullName(e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-600"
                  placeholder="Jane Smith"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">Email address</label>
                <input
                  type="email"
                  value={email}
                  disabled
                  className="w-full px-3 py-2 border border-zinc-200 text-sm bg-zinc-50 text-zinc-400"
                />
                <p className="text-xs text-zinc-400 mt-1">This is the email your invitation was sent to.</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">Create a password</label>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  minLength={8}
                  className="w-full px-3 py-2 border border-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-600"
                  placeholder="Min. 8 characters"
                />
              </div>
              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? 'Joining…' : 'Join organization'}
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
