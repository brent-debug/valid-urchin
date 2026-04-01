export function calculateConflictRate(conflictCount, eventCount) {
  if (!eventCount || eventCount === 0) return null
  return ((conflictCount / eventCount) * 100).toFixed(1)
}

export function isRuleActive(rule) {
  if (!rule) return false
  if (rule.expires_at && new Date(rule.expires_at) < new Date()) return false
  return true
}

export function getAutoResolveRule(parameter, value, resolutionRules = []) {
  return resolutionRules.find(r =>
    (r.parameter === parameter || r.parameter === null) &&
    (r.value === value || r.value === null) &&
    isRuleActive(r)
  ) || null
}
