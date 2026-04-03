import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useOrg } from '../../contexts/OrgContext'
import { useAuth } from '../../contexts/AuthContext'
import { usePermissions } from '../../hooks/usePermissions'
import { writeAuditLog } from '../../lib/auditLog'
import Badge from '../../components/ui/Badge'
import Modal from '../../components/ui/Modal'
import { ChevronDownIcon, ChevronRightIcon } from '@heroicons/react/24/outline'

const ROLE_OPTIONS = ['admin', 'manager', 'user']

const ROLE_BADGE_VARIANT = {
  admin: 'owner',   // teal
  manager: 'admin', // blue
  user: 'member',   // gray
}

const ROLE_DEFINITIONS = [
  { role: 'Admin', desc: 'Full access including org settings, billing, and user management' },
  { role: 'Manager', desc: 'Can create and edit parameters, rules, and conflicts. Cannot access org settings' },
  { role: 'User', desc: 'Read-only access. Can use Campaign Manager' },
]

function Avatar({ email }) {
  const letter = (email || '?')[0].toUpperCase()
  return (
    <div className="h-8 w-8 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center text-sm font-semibold flex-shrink-0">
      {letter}
    </div>
  )
}

function Spinner() {
  return (
    <div className="flex items-center justify-center py-16">
      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-teal-600" />
    </div>
  )
}

function formatDate(val) {
  if (!val) return 'Never'
  const d = new Date(val)
  if (isNaN(d)) return 'Never'
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function UserManagement() {
  const { currentOrg, loading: orgLoading } = useOrg()
  const { user } = useAuth()
  const { isAdmin } = usePermissions()
  const [members, setMembers] = useState([])
  const [invitations, setInvitations] = useState([])
  const [showInvite, setShowInvite] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('user')
  const [inviteLink, setInviteLink] = useState('')
  const [inviting, setInviting] = useState(false)
  const [error, setError] = useState('')
  const [showRoleDefs, setShowRoleDefs] = useState(false)

  useEffect(() => {
    if (currentOrg) { loadMembers(); loadInvitations() }
  }, [currentOrg])

  async function loadMembers() {
    const { data } = await supabase
      .from('organization_members')
      .select('user_id, role, email, created_at, last_login_at, user_profiles(full_name)')
      .eq('organization_id', currentOrg.id)
    setMembers(data || [])
  }

  async function loadInvitations() {
    const { data } = await supabase
      .from('invitations')
      .select('*')
      .eq('organization_id', currentOrg.id)
      .is('accepted_at', null)
    setInvitations(data || [])
  }

  async function handleInvite() {
    setError('')
    setInviting(true)
    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser()
      const { data, error } = await supabase
        .from('invitations')
        .insert({
          organization_id: currentOrg.id,
          email: inviteEmail,
          role: inviteRole,
          invited_by: user.id,
          token: crypto.randomUUID(),
        })
        .select()
        .single()
      if (error) throw error
      setInviteLink(`${window.location.origin}/invite/${data.token}`)
      await writeAuditLog({
        organizationId: currentOrg.id,
        userId: currentUser?.id,
        userEmail: currentUser?.email,
        action: 'user_invited',
        entityType: 'user',
        metadata: { email: inviteEmail, role: inviteRole },
      })
      await loadInvitations()
    } catch (err) {
      setError(err.message)
    } finally {
      setInviting(false)
    }
  }

  async function handleRoleChange(member, newRole) {
    const { data: { user: currentUser } } = await supabase.auth.getUser()
    const email = member.invitations?.email || member.user_id
    const oldRole = member.role
    await supabase
      .from('organization_members')
      .update({ role: newRole })
      .eq('user_id', member.user_id)
      .eq('organization_id', currentOrg.id)
    await writeAuditLog({
      organizationId: currentOrg.id,
      userId: currentUser?.id,
      userEmail: currentUser?.email,
      action: 'user_role_changed',
      entityType: 'user',
      metadata: { email, old_role: oldRole, new_role: newRole },
    })
    await loadMembers()
  }

  async function handleRemove(member) {
    if (!confirm('Remove this member?')) return
    const { data: { user: currentUser } } = await supabase.auth.getUser()
    const email = member.invitations?.email || member.user_id
    await supabase
      .from('organization_members')
      .delete()
      .eq('user_id', member.user_id)
      .eq('organization_id', currentOrg.id)
    await writeAuditLog({
      organizationId: currentOrg.id,
      userId: currentUser?.id,
      userEmail: currentUser?.email,
      action: 'user_removed',
      entityType: 'user',
      metadata: { email, role: member.role },
    })
    await loadMembers()
  }

  async function handleRevokeInvite(inviteId) {
    await supabase.from('invitations').delete().eq('id', inviteId)
    await loadInvitations()
  }

  if (!isAdmin) {
    return (
      <div className="text-center py-16">
        <p className="text-sm font-medium text-zinc-900">Access restricted</p>
        <p className="text-xs text-zinc-500 mt-1">Only Admins can manage users.</p>
      </div>
    )
  }

  if (orgLoading) return <Spinner />
  if (!currentOrg) return <div className="text-center py-16 text-sm text-zinc-400">No organization found.</div>

  // Sort: current user first
  const sortedMembers = [...members].sort((a, b) => {
    if (a.user_id === user?.id) return -1
    if (b.user_id === user?.id) return 1
    return 0
  })

  return (
    <div className="space-y-5 max-w-3xl">
      <h1 className="text-xl font-semibold text-zinc-900">User Management</h1>

      {/* Role definitions collapsible */}
      <div className="border border-zinc-200 bg-white overflow-hidden">
        <button
          onClick={() => setShowRoleDefs(v => !v)}
          className="w-full flex items-center justify-between px-5 py-3 hover:bg-zinc-50 transition-colors"
        >
          <span className="text-sm font-medium text-zinc-700">Role definitions</span>
          {showRoleDefs
            ? <ChevronDownIcon className="h-4 w-4 text-zinc-400" />
            : <ChevronRightIcon className="h-4 w-4 text-zinc-400" />
          }
        </button>
        {showRoleDefs && (
          <div className="border-t border-zinc-100 px-5 py-4 space-y-2">
            {ROLE_DEFINITIONS.map(({ role, desc }) => (
              <div key={role} className="flex items-start gap-2">
                <span className="text-sm font-semibold text-zinc-700 w-20 flex-shrink-0">{role}</span>
                <span className="text-sm text-zinc-500">{desc}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Members table */}
      <div className="bg-white border border-zinc-200 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-100">
          <p className="text-sm font-semibold text-zinc-900">Team members</p>
          <button
            onClick={() => setShowInvite(true)}
            className="bg-teal-600 text-white rounded-full px-4 py-1.5 text-sm font-medium hover:bg-teal-700 transition-colors"
          >
            Invite member
          </button>
        </div>
        <table className="w-full">
          <thead>
            <tr className="border-b border-zinc-100">
              <th className="text-left px-5 py-3 text-xs font-semibold text-zinc-400 uppercase tracking-wide">Member</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-zinc-400 uppercase tracking-wide">Role</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-zinc-400 uppercase tracking-wide">Last Login</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-zinc-400 uppercase tracking-wide">Joined</th>
              <th className="text-right px-5 py-3 text-xs font-semibold text-zinc-400 uppercase tracking-wide">Actions</th>
            </tr>
          </thead>
          <tbody>
            {sortedMembers.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-5 py-12 text-center text-sm text-zinc-400">No members found.</td>
              </tr>
            ) : (
              sortedMembers.map(member => {
                const displayName = member.user_profiles?.full_name || member.email || member.user_id
                const email = member.email || member.user_id
                const isCurrentUser = member.user_id === user?.id
                const badgeVariant = ROLE_BADGE_VARIANT[member.role] || 'member'
                return (
                  <tr key={member.user_id} className="border-b border-zinc-50 hover:bg-zinc-50">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar email={email} />
                        <div>
                          {member.user_profiles?.full_name && (
                            <p className="text-sm font-medium text-zinc-900">{member.user_profiles.full_name}</p>
                          )}
                          <p className={`text-sm ${member.user_profiles?.full_name ? 'text-zinc-400 text-xs' : 'text-zinc-900'}`}>{email}</p>
                        </div>
                        {isCurrentUser && (
                          <span className="bg-zinc-100 text-zinc-500 text-xs rounded-full px-2 py-0.5">You</span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      {!isCurrentUser ? (
                        <select
                          value={member.role}
                          onChange={e => handleRoleChange(member, e.target.value)}
                          className="text-xs border border-zinc-200 px-2 py-1 focus:outline-none focus:ring-1 focus:ring-teal-600"
                        >
                          {ROLE_OPTIONS.map(r => (
                            <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>
                          ))}
                        </select>
                      ) : (
                        <Badge variant={badgeVariant}>{member.role}</Badge>
                      )}
                    </td>
                    <td className="px-5 py-3 text-sm text-zinc-400">
                      {formatDate(member.last_login_at)}
                    </td>
                    <td className="px-5 py-3 text-sm text-zinc-400">
                      {formatDate(member.created_at)}
                    </td>
                    <td className="px-5 py-3 text-right">
                      {!isCurrentUser && (
                        <button
                          onClick={() => handleRemove(member)}
                          className="text-xs text-red-500 hover:text-red-700"
                        >
                          Remove
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pending invitations */}
      {invitations.length > 0 && (
        <div className="bg-white border border-zinc-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-zinc-100">
            <p className="text-sm font-semibold text-zinc-900">Pending invitations</p>
          </div>
          <table className="w-full">
            <tbody>
              {invitations.map(inv => (
                <tr key={inv.id} className="border-b border-zinc-50 hover:bg-zinc-50">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <Avatar email={inv.email} />
                      <div>
                        <p className="text-sm text-zinc-900">{inv.email}</p>
                        <p className="text-xs text-zinc-400">Expires {new Date(inv.expires_at).toLocaleDateString()}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    <span className="inline-flex items-center bg-amber-50 text-amber-700 rounded-full px-2.5 py-0.5 text-xs font-medium">
                      Pending — {inv.role}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <button
                      onClick={() => handleRevokeInvite(inv.id)}
                      className="text-xs text-red-500 hover:text-red-700"
                    >
                      Revoke
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Invite modal */}
      <Modal
        open={showInvite}
        onClose={() => { setShowInvite(false); setInviteLink(''); setInviteEmail(''); setError('') }}
        title="Invite team member"
      >
        {inviteLink ? (
          <div className="space-y-4">
            <p className="text-sm text-zinc-700">Share this link with your teammate:</p>
            <div className="flex items-center gap-2">
              <input
                value={inviteLink}
                readOnly
                className="flex-1 px-3 py-2 border border-zinc-200 text-xs font-mono bg-zinc-50"
              />
              <button
                onClick={() => navigator.clipboard.writeText(inviteLink)}
                className="bg-white text-zinc-700 border border-zinc-200 rounded-full px-3 py-1.5 text-sm hover:bg-zinc-50"
              >
                Copy
              </button>
            </div>
            <button
              onClick={() => { setShowInvite(false); setInviteLink(''); setInviteEmail('') }}
              className="w-full bg-teal-600 text-white rounded-full px-4 py-2 text-sm font-medium hover:bg-teal-700"
            >
              Done
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {error && <div className="p-3 bg-red-50 border border-red-200 text-sm text-red-700">{error}</div>}
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">Email address</label>
              <input
                type="email"
                value={inviteEmail}
                onChange={e => setInviteEmail(e.target.value)}
                className="w-full px-3 py-2 border border-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-600"
                placeholder="colleague@company.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">Role</label>
              <select
                value={inviteRole}
                onChange={e => setInviteRole(e.target.value)}
                className="w-full px-3 py-2 border border-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-600"
              >
                <option value="admin">Admin</option>
                <option value="manager">Manager</option>
                <option value="user">User</option>
              </select>
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowInvite(false)}
                className="bg-white text-zinc-700 border border-zinc-200 rounded-full px-4 py-2 text-sm hover:bg-zinc-50"
              >
                Cancel
              </button>
              <button
                onClick={handleInvite}
                disabled={inviting || !inviteEmail}
                className="bg-teal-600 text-white rounded-full px-4 py-2 text-sm font-medium hover:bg-teal-700 disabled:opacity-50"
              >
                {inviting ? 'Sending…' : 'Create invite link'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
