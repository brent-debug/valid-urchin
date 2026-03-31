import { NavLink, useLocation } from 'react-router-dom'
import {
  HomeIcon,
  AdjustmentsHorizontalIcon,
  ExclamationTriangleIcon,
  MegaphoneIcon,
  BuildingOfficeIcon,
  UsersIcon,
  KeyIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline'

const mainNav = [
  { name: 'Dashboard', href: '/dashboard', icon: HomeIcon },
  { name: 'Monitor Settings', href: '/monitor/parameters', icon: AdjustmentsHorizontalIcon, matchPrefix: '/monitor' },
  { name: 'Conflict Log', href: '/conflicts', icon: ExclamationTriangleIcon },
  { name: 'Campaign Manager', href: '#', icon: MegaphoneIcon, soon: true },
]

const settingsNav = [
  { name: 'Organization', href: '/settings/organization', icon: BuildingOfficeIcon },
  { name: 'Team Members', href: '/settings/team', icon: UsersIcon },
  { name: 'Urchin Snippet', href: '/settings/api-keys', icon: KeyIcon },
]

export default function Sidebar({ onClose }) {
  const location = useLocation()

  const isActive = (item) => {
    if (item.matchPrefix) return location.pathname.startsWith(item.matchPrefix)
    return location.pathname === item.href
  }

  return (
    <div className="flex flex-col h-full bg-white border-r border-zinc-200">
      {/* Logo */}
      <div className="flex items-center justify-between h-16 px-4 border-b border-zinc-200 flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <img src="/validurchin.png" alt="ValidUrchin" className="h-7 w-auto" />
          <span className="font-semibold text-zinc-900 text-sm tracking-tight">ValidUrchin</span>
        </div>
        <button onClick={onClose} className="lg:hidden p-1 rounded-md text-zinc-400 hover:text-zinc-600">
          <XMarkIcon className="h-5 w-5" />
        </button>
      </div>

      {/* Main nav */}
      <nav className="flex-1 overflow-y-auto py-3 px-3 min-h-0">
        <ul className="space-y-0.5">
          {mainNav.map((item) => {
            const active = isActive(item)
            return (
              <li key={item.name}>
                <NavLink
                  to={item.href}
                  className={`
                    flex items-center gap-3 px-3 py-2 text-sm transition-colors
                    ${active
                      ? 'bg-teal-50 text-teal-700 font-medium'
                      : 'text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900'
                    }
                    ${item.soon ? 'opacity-40 pointer-events-none' : ''}
                  `}
                >
                  <item.icon className="h-4 w-4 flex-shrink-0" />
                  <span>{item.name}</span>
                  {item.soon && (
                    <span className="ml-auto text-xs bg-zinc-100 text-zinc-500 px-1.5 py-0.5 rounded-full">
                      Soon
                    </span>
                  )}
                </NavLink>
              </li>
            )
          })}
        </ul>

        {/* Divider + Settings section */}
        <div className="mt-4 pt-4 border-t border-zinc-100">
          <p className="px-3 mb-1 text-xs font-semibold text-zinc-400 uppercase tracking-wider">Settings</p>
          <ul className="space-y-0.5">
            {settingsNav.map((item) => {
              const active = location.pathname === item.href
              return (
                <li key={item.name}>
                  <NavLink
                    to={item.href}
                    className={`
                      flex items-center gap-3 px-3 py-2 text-sm transition-colors
                      ${active
                        ? 'bg-teal-50 text-teal-700 font-medium'
                        : 'text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900'
                      }
                    `}
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
      <div className="flex-shrink-0 border-t border-zinc-100 px-4 py-4">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs text-zinc-500">Events monitored</span>
          <span className="text-xs text-zinc-400">0 / 10,000</span>
        </div>
        <div className="w-full h-1.5 bg-zinc-100 rounded-full overflow-hidden">
          <div className="h-full bg-teal-600 rounded-full" style={{ width: '0%' }} />
        </div>
        <div className="flex items-center justify-between mt-1.5">
          <span className="text-xs text-zinc-400">Resets in 28 days</span>
          <a href="#" className="text-xs text-teal-600 hover:text-teal-700">Manage plan →</a>
        </div>
      </div>
    </div>
  )
}
