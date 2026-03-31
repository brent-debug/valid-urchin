import { NavLink, useLocation } from 'react-router-dom'
import {
  HomeIcon,
  AdjustmentsHorizontalIcon,
  ExclamationTriangleIcon,
  MegaphoneIcon,
  Cog6ToothIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline'

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: HomeIcon },
  {
    name: 'Monitor Settings',
    icon: AdjustmentsHorizontalIcon,
    children: [
      { name: 'Parameters', href: '/monitor/parameters' },
      { name: 'Conditional Rules', href: '/monitor/rules' },
    ],
  },
  { name: 'Conflict Log', href: '/conflicts', icon: ExclamationTriangleIcon },
  { name: 'Campaign Manager', href: '#', icon: MegaphoneIcon, soon: true },
  {
    name: 'Settings',
    icon: Cog6ToothIcon,
    children: [
      { name: 'Organization', href: '/settings/organization' },
      { name: 'Team Members', href: '/settings/team' },
      { name: 'API Keys', href: '/settings/api-keys' },
    ],
  },
]

export default function Sidebar({ onClose }) {
  const location = useLocation()

  const isActiveParent = (item) => {
    if (item.href) return location.pathname === item.href
    return item.children?.some(c => location.pathname.startsWith(c.href))
  }

  return (
    <div className="flex flex-col h-full bg-white border-r border-zinc-200">
      {/* Logo */}
      <div className="flex items-center justify-between h-16 px-4 border-b border-zinc-200 flex-shrink-0">
        <div className="flex items-center gap-2">
          <img src="/validurchin.png" alt="ValidUrchin" className="h-7 w-auto" />
          <span className="font-semibold text-zinc-900 text-sm">ValidUrchin</span>
        </div>
        <button onClick={onClose} className="lg:hidden p-1 rounded-md text-zinc-400 hover:text-zinc-600">
          <XMarkIcon className="h-5 w-5" />
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-4 px-3">
        <ul className="space-y-1">
          {navigation.map((item) => (
            <NavItem key={item.name} item={item} isActiveParent={isActiveParent(item)} />
          ))}
        </ul>
      </nav>
    </div>
  )
}

function NavItem({ item, isActiveParent }) {
  if (item.children) {
    return (
      <li>
        <div className={`
          flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium
          ${isActiveParent ? 'text-primary-700' : 'text-zinc-500'}
        `}>
          <item.icon className="h-4 w-4 flex-shrink-0" />
          <span className="uppercase tracking-wide text-xs font-semibold">{item.name}</span>
        </div>
        <ul className="ml-6 mt-1 space-y-1">
          {item.children.map(child => (
            <li key={child.name}>
              <NavLink
                to={child.href}
                className={({ isActive }) => `
                  block px-3 py-1.5 rounded-lg text-sm transition-colors
                  ${isActive
                    ? 'bg-primary-100 text-primary-700 font-medium'
                    : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900'
                  }
                `}
              >
                {child.name}
              </NavLink>
            </li>
          ))}
        </ul>
      </li>
    )
  }

  return (
    <li>
      <NavLink
        to={item.href}
        className={({ isActive }) => `
          flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors
          ${isActive
            ? 'bg-primary-100 text-primary-700 font-medium'
            : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900'
          }
          ${item.soon ? 'opacity-50 pointer-events-none' : ''}
        `}
      >
        <item.icon className="h-4 w-4 flex-shrink-0" />
        <span>{item.name}</span>
        {item.soon && <span className="ml-auto text-xs bg-zinc-100 text-zinc-500 px-1.5 py-0.5 rounded">Soon</span>}
      </NavLink>
    </li>
  )
}
