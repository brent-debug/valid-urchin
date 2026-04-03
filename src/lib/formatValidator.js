export function validateAgainstFormatStandards(value, standards) {
  const violations = []
  if (!standards || Object.keys(standards).length === 0) return violations

  if (standards.noSpaces?.enabled) {
    if (value.includes(' ') || value.includes('%20') || value.includes('+'))
      violations.push('No spaces allowed (found space or %20)')
  }

  if (standards.noUrlEncoding?.enabled) {
    if (/%[0-9A-Fa-f]{2}/.test(value))
      violations.push('URL-encoded characters not allowed (e.g. %20, %2B)')
  }

  if (standards.wordSeparator?.enabled) {
    const sep = standards.wordSeparator.value
    if (sep === 'hyphen' && value.includes('_')) violations.push('Use hyphens, not underscores')
    if (sep === 'underscore' && value.includes('-')) violations.push('Use underscores, not hyphens')
  }

  if (standards.noConsecutiveSeparators?.enabled && /(--|__)/.test(value))
    violations.push('No consecutive separators')

  if (standards.maxLength?.enabled && value.length > parseInt(standards.maxLength.value))
    violations.push(`Maximum ${standards.maxLength.value} characters`)

  if (standards.noSpecialCharacters?.enabled) {
    const sep = standards.wordSeparator?.value === 'hyphen' ? '-'
      : standards.wordSeparator?.value === 'underscore' ? '_' : ''
    if (!new RegExp(`^[a-zA-Z0-9${sep}]+$`).test(value))
      violations.push('Special characters not allowed')
  }

  if (standards.prefixRequired?.enabled && standards.prefixRequired.value &&
      !value.startsWith(standards.prefixRequired.value))
    violations.push(`Must start with "${standards.prefixRequired.value}"`)

  if (standards.suffixRequired?.enabled && standards.suffixRequired.value &&
      !value.endsWith(standards.suffixRequired.value))
    violations.push(`Must end with "${standards.suffixRequired.value}"`)

  if (standards.regexPattern?.enabled && standards.regexPattern.value) {
    try {
      if (!new RegExp(standards.regexPattern.value).test(value))
        violations.push(`Must match pattern: ${standards.regexPattern.value}`)
    } catch {}
  }

  return violations
}
