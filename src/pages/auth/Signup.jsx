import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import Button from '../../components/ui/Button'

export default function Signup() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [orgName, setOrgName] = useState('')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  const handleSignup = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
      })
      if (authError) throw authError

      const { data, error } = await supabase.functions.invoke('create-organization', {
        body: {
          userId: authData.user.id,
          orgName,
        }
      })

      if (error) throw error

      navigate('/')

    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-zinc-100 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <img src="/validurchin.png" alt="ValidUrchin" className="h-12 mx-auto mb-3" />
          <h1 className="text-2xl font-semibold text-zinc-900">Create your account</h1>
          <p className="text-sm text-zinc-500 mt-1">Start validating UTM parameters</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-zinc-200 p-6">
          <form onSubmit={handleSignup} className="space-y-4">
            {error && (
              <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">{error}</div>
            )}
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">Organization name</label>
              <input
                type="text"
                value={orgName}
                onChange={e => setOrgName(e.target.value)}
                required
                className="w-full px-3 py-2 rounded-lg border border-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-600 focus:border-transparent"
                placeholder="Acme Corp"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">Work email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                className="w-full px-3 py-2 rounded-lg border border-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-600 focus:border-transparent"
                placeholder="you@company.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                minLength={6}
                className="w-full px-3 py-2 rounded-lg border border-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-600 focus:border-transparent"
                placeholder="Min. 6 characters"
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Creating account…' : 'Create account'}
            </Button>
          </form>
        </div>

        <p className="text-center text-sm text-zinc-500 mt-4">
          Already have an account?{' '}
          <Link to="/login" className="text-primary-600 font-medium hover:text-primary-700">Sign in</Link>
        </p>
      </div>
    </div>
  )
}
