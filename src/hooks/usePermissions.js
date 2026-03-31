import { useOrg } from '../contexts/OrgContext'

const ROLE_HIERARCHY = { viewer: 0, member: 1, admin: 2, owner: 3 }

export function usePermissions() {
  const { currentOrg } = useOrg()
  const role = currentOrg?.role || 'viewer'

  const can = (action) => {
    const required = {
      resolve_conflicts: 'member',
      manage_parameters: 'member',
      invite_members: 'admin',
      change_roles: 'admin',
      view_billing: 'admin',
      delete_org: 'owner',
    }
    const requiredLevel = ROLE_HIERARCHY[required[action]] ?? 99
    return ROLE_HIERARCHY[role] >= requiredLevel
  }

  return { role, can }
}
