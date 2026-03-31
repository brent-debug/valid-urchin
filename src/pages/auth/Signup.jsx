import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import Button from '../../components/ui/Button'

const DEFAULT_CONFIG = {
  monitoredParameters: {
    utm_source: { active: true, status: 'active', created: new Date().toISOString() },
    utm_medium: { active: true, status: 'active', created: new Date().toISOString() },
    utm_campaign: { active: true, status: 'active', created: new Date().toISOString() },
    utm_content: { active: false, status: 'draft', created: new Date().toISOString() },
    utm_term: { active: false, status: 'draft', created: new Date().toISOString() },
  },
  allowedValues: {
    utm_medium: ['cpc', 'email', 'organic', 'social', 'referral', 'display', 'video'],
    utm_source: ['google', 'facebook', 'instagram', 'linkedin', 'twitter', 'bing', 'newsletter'],
  },
  casingRules: {
    utm_source: 'lowercase',
    utm_medium: 'lowercase',
    utm_campaign: 'lowercase',
  },
  conditionalRules: [
    {
      id: 'rule_default_1',
      name: 'utm_source = "google"',
      anchor: { parameter: 'utm_source', value: 'google' },
      conditionals: { utm_medium: ['cpc', 'organic'] },
      createdAt: new Date().toISOString(),
      active: true,
    },
  ],
}

export default function Signup() {
  const { signUp } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [orgName, setOrgName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      // 1. Create Supabase auth user
      const { data, error: signUpError } = await signUp(email, password)
      if (signUpError) throw signUpError

      const userId = data.user?.id
      if (!userId) throw new Error('Signup succeeded but no user ID returned')

      // 2. Create organization
      const slug = orgName.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/(^-|-$)/g, '')
      const { data: org, error: orgError } = await supabase
        .from('organizations')
        .insert({ name: orgName, slug })
        .select()
        .single()
      if (orgError) throw orgError

      // 3. Add user as owner
      const { error: memberError } = await supabase
        .from('organization_members')
        .insert({
          organization_id: org.id,
          user_id: userId,
          role: 'owner',
          accepted_at: new Date().toISOString(),
        })
      if (memberError) throw memberError

      // 4. Populate default UTM configuration
      await fetch(`${import.meta.env.VITE_CONFIG_API_URL}?apiKey=${org.firestore_api_key}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(DEFAULT_CONFIG),
      })

      // 5. Navigate to app
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
          <form onSubmit={handleSubmit} className="space-y-4">
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
