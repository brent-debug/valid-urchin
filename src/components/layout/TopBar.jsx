import { Fragment } from 'react'
import { Menu, Transition } from '@headlessui/react'
import { Bars3Icon, ChevronDownIcon, UserCircleIcon } from '@heroicons/react/24/outline'
import { useAuth } from '../../contexts/AuthContext'
import { useOrg } from '../../contexts/OrgContext'
import { useNavigate } from 'react-router-dom'

export default function TopBar({ onMenuClick }) {
  const { user, signOut } = useAuth()
  const { currentOrg } = useOrg()
  const navigate = useNavigate()

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  return (
    <header className="h-16 bg-white border-b border-zinc-200 flex items-center justify-between px-4 flex-shrink-0">
      <div className="flex items-center gap-4">
        <button onClick={onMenuClick} className="lg:hidden p-2 rounded-md text-zinc-400 hover:text-zinc-600">
          <Bars3Icon className="h-5 w-5" />
        </button>

        {/* Org name */}
        <span className="text-sm font-medium text-zinc-900">{currentOrg?.name}</span>
      </div>

      {/* User menu */}
      <Menu as="div" className="relative">
        <Menu.Button className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-zinc-100 transition-colors">
          <UserCircleIcon className="h-6 w-6 text-zinc-500" />
          <span className="text-sm text-zinc-700 hidden sm:block">{user?.email}</span>
          <ChevronDownIcon className="h-4 w-4 text-zinc-500" />
        </Menu.Button>
        <Transition
          as={Fragment}
          enter="transition ease-out duration-100"
          enterFrom="opacity-0 scale-95"
          enterTo="opacity-100 scale-100"
          leave="transition ease-in duration-75"
          leaveFrom="opacity-100 scale-100"
          leaveTo="opacity-0 scale-95"
        >
          <Menu.Items className="absolute right-0 mt-1 w-48 bg-white rounded-xl shadow-lg border border-zinc-200 py-1 z-50">
            <div className="px-4 py-2 border-b border-zinc-100">
              <p className="text-xs text-zinc-500 truncate">{user?.email}</p>
            </div>
            <Menu.Item>
              {({ active }) => (
                <button
                  onClick={handleSignOut}
                  className={`w-full text-left px-4 py-2 text-sm text-red-600 ${active ? 'bg-zinc-50' : ''}`}
                >
                  Sign out
                </button>
              )}
            </Menu.Item>
          </Menu.Items>
        </Transition>
      </Menu>
    </header>
  )
}
