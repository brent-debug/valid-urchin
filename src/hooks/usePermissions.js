import { useOrg } from '../contexts/OrgContext'

const ROLE_RANK = { admin: 3, manager: 2, user: 1 }

function normalizeRole(role) {
  if (role === 'owner') return 'admin'
  if (role === 'viewer') return 'user'
  if (role === 'member') return 'manager'
  return role || 'user'
}

export function usePermissions() {
  const { currentOrg } = useOrg()
  const role = normalizeRole(currentOrg?.role)
  const rank = ROLE_RANK[role] || 1

  return {
    role,
    isAdmin: role === 'admin',
    isManager: role === 'manager' || role === 'admin',
    isUser: true,
    can: (action) => {
      switch (action) {
        case 'manage_org': return role === 'admin'
        case 'manage_users': return role === 'admin'
        case 'manage_billing': return role === 'admin'
        case 'view_audit_log': return rank >= 2
        case 'edit_parameters': return rank >= 2
        case 'edit_rules': return rank >= 2
        case 'manage_conflicts': return rank >= 2
        case 'delete_org': return role === 'admin'
        // Legacy actions used by TeamMembers.jsx
        case 'invite_members': return role === 'admin'
        case 'change_roles': return role === 'admin'
        default: return rank >= 1
      }
    }
  }
}
