import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useOrg } from '../../contexts/OrgContext'
import { useAuth } from '../../contexts/AuthContext'
import { usePermissions } from '../../hooks/usePermissions'
import Badge from '../../components/ui/Badge'
import Modal from '../../components/ui/Modal'

const ROLES = ['owner', 'admin', 'member', 'viewer']

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

export default function TeamMembers() {
  const { currentOrg, loading: orgLoading } = useOrg()
  const { user } = useAuth()
  const { can } = usePermissions()
  const [members, setMembers] = useState([])
  const [invitations, setInvitations] = useState([])
  const [showInvite, setShowInvite] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('member')
  const [inviteLink, setInviteLink] = useState('')
  const [inviting, setInviting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (currentOrg) { loadMembers(); loadInvitations() }
  }, [currentOrg])

  async function loadMembers() {
    const { data } = await supabase
      .from('organization_members')
      .select('*, users:user_id(email)')
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
      await loadInvitations()
    } catch (err) {
      setError(err.message)
    } finally {
      setInviting(false)
    }
  }

  async function handleRoleChange(memberId, newRole) {
    await supabase.from('organization_members').update({ role: newRole }).eq('id', memberId)
    await loadMembers()
  }

  async function handleRemove(memberId) {
    if (!confirm('Remove this member?')) return
    await supabase.from('organization_members').delete().eq('id', memberId)
    await loadMembers()
  }

  async function handleRevokeInvite(inviteId) {
    await supabase.from('invitations').delete().eq('id', inviteId)
    await loadInvitations()
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
      {/* Members table */}
      <div className="bg-white rounded-lg border border-zinc-200 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-100">
          <p className="text-sm font-semibold text-zinc-900">Team members</p>
          {can('invite_members') && (
            <button
              onClick={() => setShowInvite(true)}
              className="bg-teal-600 text-white rounded-full px-4 py-1.5 text-sm font-medium hover:bg-teal-700 transition-colors"
            >
              Invite member
            </button>
          )}
        </div>
        <table className="w-full">
          <thead>
            <tr className="border-b border-zinc-100">
              <th className="text-left px-5 py-3 text-xs font-semibold text-zinc-400 uppercase tracking-wide">Member</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-zinc-400 uppercase tracking-wide">Role</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-zinc-400 uppercase tracking-wide">Joined</th>
              <th className="text-right px-5 py-3 text-xs font-semibold text-zinc-400 uppercase tracking-wide">Actions</th>
            </tr>
          </thead>
          <tbody>
            {sortedMembers.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-5 py-12 text-center text-sm text-zinc-400">No members found.</td>
              </tr>
            ) : (
              sortedMembers.map(member => {
                const email = member.users?.email || member.user_id
                const isCurrentUser = member.user_id === user?.id
                return (
                  <tr key={member.id} className="border-b border-zinc-50 hover:bg-zinc-50">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar email={email} />
                        <div>
                          <p className="text-sm text-zinc-900">{email}</p>
                        </div>
                        {isCurrentUser && (
                          <span className="bg-zinc-100 text-zinc-500 text-xs rounded-full px-2 py-0.5">You</span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      {can('change_roles') && !isCurrentUser ? (
                        <select
                          value={member.role}
                          onChange={e => handleRoleChange(member.id, e.target.value)}
                          className="text-xs border border-zinc-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-teal-600"
                        >
                          {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                        </select>
                      ) : (
                        <Badge variant={member.role}>{member.role}</Badge>
                      )}
                    </td>
                    <td className="px-5 py-3 text-sm text-zinc-400">
                      {member.accepted_at ? new Date(member.accepted_at).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-5 py-3 text-right">
                      {can('change_roles') && !isCurrentUser && (
                        <button
                          onClick={() => handleRemove(member.id)}
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
        <div className="bg-white rounded-lg border border-zinc-200 overflow-hidden">
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
                    {can('invite_members') && (
                      <button
                        onClick={() => handleRevokeInvite(inv.id)}
                        className="text-xs text-red-500 hover:text-red-700"
                      >
                        Revoke
                      </button>
                    )}
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
                className="flex-1 px-3 py-2 rounded-md border border-zinc-200 text-xs font-mono bg-zinc-50"
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
            {error && <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">{error}</div>}
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">Email address</label>
              <input
                type="email"
                value={inviteEmail}
                onChange={e => setInviteEmail(e.target.value)}
                className="w-full px-3 py-2 rounded-md border border-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-600"
                placeholder="colleague@company.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">Role</label>
              <select
                value={inviteRole}
                onChange={e => setInviteRole(e.target.value)}
                className="w-full px-3 py-2 rounded-md border border-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-600"
              >
                <option value="viewer">Viewer</option>
                <option value="member">Member</option>
                <option value="admin">Admin</option>
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
