import { useState, useEffect, useRef } from 'react'
import { Bars3Icon } from '@heroicons/react/24/outline'
import { useAuth } from '../../contexts/AuthContext'
import { useOrg } from '../../contexts/OrgContext'
import { usePermissions } from '../../hooks/usePermissions'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

function getInitials(nameOrEmail) {
  if (!nameOrEmail) return '?'
  if (nameOrEmail.includes('@')) {
    return nameOrEmail.split('@')[0].slice(0, 2).toUpperCase()
  }
  const parts = nameOrEmail.trim().split(' ').filter(Boolean)
  return parts.slice(0, 2).map(p => p[0].toUpperCase()).join('')
}

export default function TopBar({ onMenuClick }) {
  const { user, signOut } = useAuth()
  const { currentOrg } = useOrg()
  const { isAdmin } = usePermissions()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [fullName, setFullName] = useState('')
  const menuRef = useRef(null)

  const plan = currentOrg?.plan || 'free'
  const showUpgrade = plan === 'free' || plan === 'starter'

  useEffect(() => {
    if (!user?.id) return
    supabase
      .from('user_profiles')
      .select('full_name')
      .eq('user_id', user.id)
      .single()
      .then(({ data }) => { if (data?.full_name) setFullName(data.full_name) })
  }, [user?.id])

  useEffect(() => {
    function handleClick(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  const initials = getInitials(fullName || user?.email)

  const handleSignOut = async () => {
    setOpen(false)
    await signOut()
    navigate('/login')
  }

  return (
    <header className="h-16 bg-white border-b border-zinc-200 flex items-center justify-between px-4 flex-shrink-0">
      <div className="flex items-center gap-3">
        <button onClick={onMenuClick} className="lg:hidden p-2 text-zinc-400 hover:text-zinc-600">
          <Bars3Icon className="h-5 w-5" />
        </button>
        {/* Logo — mobile only */}
        <div className="flex items-center gap-2 lg:hidden">
          <img src="/validurchin.png" alt="ValidUrchin" className="h-6 w-auto" />
          <span className="font-semibold text-zinc-900 text-sm tracking-tight">ValidUrchin</span>
        </div>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-1">
        <button
          onClick={() => navigate('/help')}
          className="px-3 py-1.5 text-sm text-zinc-500 hover:text-zinc-900 transition-colors"
        >
          Help
        </button>
        <a
          href="mailto:sales@validurchin.com"
          className="px-3 py-1.5 text-sm text-zinc-500 hover:text-zinc-900 transition-colors"
        >
          Contact Sales
        </a>
        {showUpgrade && (
          <button
            onClick={() => navigate('/settings/plan')}
            className="ml-1 px-3 py-1.5 text-sm font-medium text-teal-700 border border-teal-300 bg-teal-50 hover:bg-teal-100 transition-colors rounded-full"
          >
            Upgrade
          </button>
        )}

        {/* User circle with dropdown */}
        <div ref={menuRef} className="relative ml-2">
          <button
            onClick={() => setOpen(o => !o)}
            className="flex items-center justify-center h-8 w-8 rounded-full bg-teal-600 text-white text-xs font-semibold hover:bg-teal-700 transition-colors"
            aria-label="User menu"
          >
            {initials}
          </button>
          {open && (
            <div
              className="absolute right-0 mt-2 w-52 bg-white border border-zinc-200 shadow-lg z-50"
              style={{ top: '100%' }}
            >
              <div className="px-4 py-3 border-b border-zinc-100">
                {fullName && (
                  <p className="text-sm font-medium text-zinc-900 truncate">{fullName}</p>
                )}
                <p className="text-xs text-zinc-500 truncate">{user?.email}</p>
              </div>
              <button
                onClick={() => { setOpen(false); navigate('/settings/profile') }}
                className="w-full text-left px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-50"
              >
                Profile
              </button>
              {isAdmin && (
                <button
                  onClick={() => { setOpen(false); navigate('/settings/organization') }}
                  className="w-full text-left px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-50"
                >
                  Organization
                </button>
              )}
              <div className="border-t border-zinc-100" />
              <button
                onClick={handleSignOut}
                className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-zinc-50"
              >
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
