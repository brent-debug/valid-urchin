export function detectRuleConflicts(conditionalRules, allowedValues) {
  const issues = []
  conditionalRules.forEach(rule => {
    if (rule.appliedDomains && !rule.appliedDomains.includes('all')) {
      const globalRule = conditionalRules.find(r =>
        r.id !== rule.id &&
        r.appliedDomains?.includes('all') &&
        r.anchors?.some(a => rule.anchors?.some(ra => ra.parameter === a.parameter && ra.value === a.value))
      )
      if (globalRule && rule.domainInheritance === 'override') {
        issues.push({
          type: 'domain_conflict', severity: 'warning',
          description: `"${rule.name}" overrides global rule "${globalRule.name}" for: ${rule.appliedDomains.join(', ')}`,
          affectedRules: [rule.id, globalRule.id]
        })
      }
    }
    const anchors = rule.anchors || (rule.anchor ? [rule.anchor] : [])
    anchors.forEach(anchor => {
      Object.entries(rule.conditionals || {}).forEach(([param, data]) => {
        const globalValues = allowedValues[param] || []
        if (globalValues.length > 0) {
          const notInGlobal = (data.values || []).filter(v => !globalValues.includes(v))
          if (notInGlobal.length > 0 && !rule.appliedDomains?.includes('all')) {
            issues.push({
              type: 'value_conflict', severity: 'warning',
              description: `"${rule.name}" allows [${notInGlobal.join(', ')}] for "${param}" which are not in the global allowed list`,
              affectedRules: [rule.id]
            })
          }
        }
      })
    })
  })
  return issues
}
