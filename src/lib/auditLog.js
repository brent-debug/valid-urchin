import { supabase } from './supabase'

export async function writeAuditLog({
  organizationId,
  userId,
  userEmail,
  action,
  entityType,
  entityId,
  entityName,
  metadata = {}
}) {
  try {
    await supabase.from('audit_log').insert({
      organization_id: organizationId,
      user_id: userId,
      user_email: userEmail,
      action,
      entity_type: entityType,
      entity_id: entityId,
      entity_name: entityName,
      metadata
    })
  } catch (err) {
    console.error('Audit log write failed:', err)
  }
}
