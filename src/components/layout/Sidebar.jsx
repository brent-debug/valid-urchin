import { NavLink, useLocation } from 'react-router-dom'
import { useState, useEffect } from 'react'
import {
  HomeIcon,
  ExclamationTriangleIcon,
  MegaphoneIcon,
  BuildingOfficeIcon,
  UsersIcon,
  XMarkIcon,
  UserIcon,
  ClipboardDocumentListIcon,
  ServerStackIcon,
  AdjustmentsHorizontalIcon,
} from '@heroicons/react/24/outline'
import { useOrg } from '../../contexts/OrgContext'
import { usePermissions } from '../../hooks/usePermissions'
import { supabase } from '../../lib/supabase'
import { getDomainLimit, getEventLimit } from '../../lib/plans'

export default function Sidebar({ onClose }) {
  const location = useLocation()
  const { currentOrg } = useOrg()
  const { isAdmin, isManager } = usePermissions()
  const [domainsUsed, setDomainsUsed] = useState(0)

  useEffect(() => {
    if (!currentOrg?.id) return
    supabase
      .from('allowed_domains')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', currentOrg.id)
      .then(({ count }) => setDomainsUsed(count || 0))
  }, [currentOrg?.id])

  const plan = currentOrg?.plan || 'free'
  const eventsUsed = currentOrg?.events_this_period || 0
  const eventLimit = getEventLimit(plan)
  const domainLimit = getDomainLimit(plan)

  const monitorSubNav = [
    { name: 'Parameters', href: '/monitor/parameters' },
    { name: 'Conditional Rules', href: '/monitor/rules' },
    { name: 'Format Standards', href: '/monitor/format-standards' },
  ]

  const settingsNav = [
    { name: 'Profile', href: '/settings/profile', icon: UserIcon },
    ...(isAdmin ? [{ name: 'Organization', href: '/settings/organization', icon: BuildingOfficeIcon }] : []),
    ...(isAdmin ? [{ name: 'User Management', href: '/settings/user-management', icon: UsersIcon }] : []),
    { name: 'Data Collection', href: '/settings/data-collection', icon: ServerStackIcon },
    ...(isManager ? [{ name: 'Audit Log', href: '/settings/audit-log', icon: ClipboardDocumentListIcon }] : []),
  ]

  const topLinkClass = (href, matchPrefix) => {
    const active = matchPrefix
      ? location.pathname.startsWith(matchPrefix)
      : location.pathname === href
    return `flex items-center gap-3 px-3 py-2 text-sm transition-colors ${
      active ? 'bg-teal-50 text-teal-700 font-medium' : 'text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900'
    }`
  }

  const subLinkClass = (href) => {
    const active = location.pathname.startsWith(href)
    return `flex items-center pl-10 pr-3 py-1.5 text-sm transition-colors ${
      active ? 'bg-teal-50 text-teal-700 font-medium' : 'text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900'
    }`
  }

  const monitorActive = location.pathname.startsWith('/monitor')

  return (
    <div className="flex flex-col h-full bg-white border-r border-zinc-200">
      {/* Logo */}
      <div className="flex items-center justify-between h-16 px-4 border-b border-zinc-200 flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <img src="/validurchin.png" alt="ValidUrchin" className="h-7 w-auto" />
          <span className="font-semibold text-zinc-900 text-sm tracking-tight">ValidUrchin</span>
        </div>
        <button onClick={onClose} className="lg:hidden p-1 text-zinc-400 hover:text-zinc-600">
          <XMarkIcon className="h-5 w-5" />
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-3 px-3 min-h-0">
        <ul className="space-y-0.5">
          {/* Dashboard */}
          <li>
            <NavLink to="/dashboard" className={topLinkClass('/dashboard')}>
              <HomeIcon className="h-4 w-4 flex-shrink-0" />
              <span>Dashboard</span>
            </NavLink>
          </li>

          {/* Monitor Settings — label only, not a link */}
          <li className="pt-2">
            <div className={`flex items-center gap-2 px-3 py-1 text-xs font-semibold uppercase tracking-wider select-none cursor-default ${
              monitorActive ? 'text-teal-600' : 'text-zinc-400'
            }`}>
              <AdjustmentsHorizontalIcon className="h-3.5 w-3.5 flex-shrink-0" />
              Monitor Settings
            </div>
            <ul className="mt-0.5 space-y-0.5">
              {monitorSubNav.map(item => (
                <li key={item.name}>
                  <NavLink to={item.href} className={subLinkClass(item.href)}>
                    {item.name}
                  </NavLink>
                </li>
              ))}
            </ul>
          </li>

          {/* Conflict Log */}
          <li className="pt-1">
            <NavLink to="/conflicts" className={topLinkClass('/conflicts')}>
              <ExclamationTriangleIcon className="h-4 w-4 flex-shrink-0" />
              <span>Conflict Log</span>
            </NavLink>
          </li>

          {/* Campaign Manager — disabled */}
          <li>
            <div className="flex items-center gap-3 px-3 py-2 text-sm text-zinc-400 opacity-50 cursor-not-allowed select-none">
              <MegaphoneIcon className="h-4 w-4 flex-shrink-0" />
              <span>Campaign Manager</span>
              <span className="ml-auto text-xs bg-zinc-100 text-zinc-500 px-1.5 py-0.5 rounded-full">Soon</span>
            </div>
          </li>
        </ul>

        {/* Settings section */}
        <div className="mt-4 pt-4 border-t border-zinc-100">
          <p className="px-3 mb-1 text-xs font-semibold text-zinc-400 uppercase tracking-wider">Settings</p>
          <ul className="space-y-0.5">
            {settingsNav.map((item) => {
              const active = location.pathname === item.href
              return (
                <li key={item.name}>
                  <NavLink
                    to={item.href}
                    className={`flex items-center gap-3 px-3 py-2 text-sm transition-colors ${
                      active ? 'bg-teal-50 text-teal-700 font-medium' : 'text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900'
                    }`}
                  >
                    <item.icon className="h-4 w-4 flex-shrink-0" />
                    <span>{item.name}</span>
                  </NavLink>
                </li>
              )
            })}
          </ul>
        </div>
      </nav>

      {/* Usage block — pinned to bottom */}
      <div className="flex-shrink-0 border-t border-zinc-200 px-4 py-4 space-y-3">
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-zinc-500">Events monitored</span>
            <span className="text-xs text-zinc-400">{eventsUsed.toLocaleString()} / {eventLimit.toLocaleString()}</span>
          </div>
          <div className="w-full h-1.5 bg-zinc-100 rounded-full overflow-hidden">
            <div className="h-full bg-teal-600 rounded-full" style={{ width: `${Math.min((eventsUsed / eventLimit) * 100, 100)}%` }} />
          </div>
        </div>
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-zinc-500">Domains</span>
            <span className="text-xs text-zinc-400">{domainsUsed} / {domainLimit === null ? '∞' : domainLimit}</span>
          </div>
          <div className="w-full h-1.5 bg-zinc-100 rounded-full overflow-hidden">
            <div className="h-full bg-teal-600 rounded-full" style={{ width: domainLimit ? `${Math.min((domainsUsed / domainLimit) * 100, 100)}%` : '0%' }} />
          </div>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-zinc-400">Resets in 28 days</span>
          <a href="/settings/plan" className="text-xs text-teal-600 hover:text-teal-700">Manage plan →</a>
        </div>
      </div>
    </div>
  )
}
