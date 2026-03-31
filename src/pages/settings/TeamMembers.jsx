import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useOrg } from '../../contexts/OrgContext'
import { useAuth } from '../../contexts/AuthContext'
import { usePermissions } from '../../hooks/usePermissions'
import Button from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'
import Modal from '../../components/ui/Modal'

const ROLES = ['owner', 'admin', 'member', 'viewer']

export default function TeamMembers() {
  const { currentOrg } = useOrg()
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
      const link = `${window.location.origin}/invite/${data.token}`
      setInviteLink(link)
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

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Members */}
      <div className="bg-white rounded-2xl border border-zinc-200 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100">
          <h2 className="text-sm font-semibold text-zinc-900">Team members</h2>
          {can('invite_members') && (
            <Button size="sm" onClick={() => setShowInvite(true)}>Invite member</Button>
          )}
        </div>
        <ul className="divide-y divide-zinc-50">
          {members.map(member => (
            <li key={member.id} className="flex items-center justify-between px-6 py-3">
              <div>
                <p className="text-sm text-zinc-900">{member.users?.email || member.user_id}</p>
              </div>
              <div className="flex items-center gap-2">
                {can('change_roles') && member.user_id !== user.id ? (
                  <select
                    value={member.role}
                    onChange={e => handleRoleChange(member.id, e.target.value)}
                    className="text-xs border border-zinc-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-primary-600"
                  >
                    {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                ) : (
                  <Badge variant={member.role}>{member.role}</Badge>
                )}
                {can('change_roles') && member.user_id !== user.id && (
                  <button onClick={() => handleRemove(member.id)} className="text-xs text-red-500 hover:text-red-700">Remove</button>
                )}
              </div>
            </li>
          ))}
        </ul>
      </div>

      {/* Pending invitations */}
      {invitations.length > 0 && (
        <div className="bg-white rounded-2xl border border-zinc-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-zinc-100">
            <h2 className="text-sm font-semibold text-zinc-900">Pending invitations</h2>
          </div>
          <ul className="divide-y divide-zinc-50">
            {invitations.map(inv => (
              <li key={inv.id} className="flex items-center justify-between px-6 py-3">
                <div>
                  <p className="text-sm text-zinc-900">{inv.email}</p>
                  <p className="text-xs text-zinc-500">Invited as {inv.role} · expires {new Date(inv.expires_at).toLocaleDateString()}</p>
                </div>
                {can('invite_members') && (
                  <button onClick={() => handleRevokeInvite(inv.id)} className="text-xs text-red-500 hover:text-red-700">Revoke</button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Invite modal */}
      <Modal open={showInvite} onClose={() => { setShowInvite(false); setInviteLink(''); setInviteEmail(''); setError('') }} title="Invite team member">
        {inviteLink ? (
          <div className="space-y-4">
            <p className="text-sm text-zinc-700">Share this link with your teammate:</p>
            <div className="flex items-center gap-2">
              <input value={inviteLink} readOnly className="flex-1 px-3 py-2 rounded-lg border border-zinc-200 text-sm bg-zinc-50 font-mono text-xs" />
              <Button variant="secondary" size="sm" onClick={() => navigator.clipboard.writeText(inviteLink)}>Copy</Button>
            </div>
            <Button onClick={() => { setShowInvite(false); setInviteLink(''); setInviteEmail('') }} className="w-full">Done</Button>
          </div>
        ) : (
          <div className="space-y-4">
            {error && <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">{error}</div>}
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">Email address</label>
              <input type="email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-600" placeholder="colleague@company.com" />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">Role</label>
              <select value={inviteRole} onChange={e => setInviteRole(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-600">
                <option value="viewer">Viewer</option>
                <option value="member">Member</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setShowInvite(false)}>Cancel</Button>
              <Button onClick={handleInvite} disabled={inviting || !inviteEmail}>{inviting ? 'Sending…' : 'Create invite link'}</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
