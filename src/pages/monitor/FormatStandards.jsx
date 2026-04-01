import { useState, useEffect } from 'react'
import { useOrg } from '../../contexts/OrgContext'
import { usePermissions } from '../../hooks/usePermissions'
import { supabase } from '../../lib/supabase'
import { writeAuditLog } from '../../lib/auditLog'
import { validateAgainstFormatStandards } from '../../lib/formatValidator'
import RuleTester from '../../components/RuleTester'

const STANDARDS_CONFIG = [
  {
    key: 'noSpaces',
    label: 'No spaces',
    description: 'Values must not contain spaces.',
    type: 'toggle',
  },
  {
    key: 'wordSeparator',
    label: 'Word separator',
    description: 'Enforce a consistent separator between words.',
    type: 'select',
    options: [
      { value: 'hyphen', label: 'Hyphen (-)' },
      { value: 'underscore', label: 'Underscore (_)' },
      { value: 'none', label: 'None' },
    ],
    defaultValue: 'hyphen',
  },
  {
    key: 'noConsecutiveSeparators',
    label: 'No consecutive separators',
    description: 'Values must not contain -- or __.',
    type: 'toggle',
  },
  {
    key: 'maxLength',
    label: 'Maximum length',
    description: 'Values must not exceed a character limit.',
    type: 'number',
    min: 10,
    max: 500,
    defaultValue: 100,
  },
  {
    key: 'noSpecialCharacters',
    label: 'No special characters',
    description: 'Only letters, numbers, and the configured separator are allowed.',
    type: 'toggle',
  },
  {
    key: 'prefixRequired',
    label: 'Required prefix',
    description: 'Values must start with this string.',
    type: 'text',
    placeholder: 'e.g. brand_',
    defaultValue: '',
  },
  {
    key: 'suffixRequired',
    label: 'Required suffix',
    description: 'Values must end with this string.',
    type: 'text',
    placeholder: 'e.g. _2024',
    defaultValue: '',
  },
  {
    key: 'regexPattern',
    label: 'Regex pattern',
    description: 'Values must match this regular expression.',
    type: 'text',
    placeholder: 'e.g. ^[a-z0-9-]+$',
    defaultValue: '',
  },
]

function StandardRow({ config: stdConfig, value, onChange, canEdit }) {
  const enabled = value?.enabled || false
  const inputValue = value?.value !== undefined ? value.value : stdConfig.defaultValue

  return (
    <div className="flex items-start gap-4 py-4 border-b border-zinc-100 last:border-0">
      <div className="mt-0.5 flex-shrink-0">
        <button
          type="button"
          onClick={() => canEdit && onChange({ ...value, enabled: !enabled })}
          disabled={!canEdit}
          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${enabled ? 'bg-teal-600' : 'bg-zinc-300'} ${!canEdit ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
        >
          <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${enabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
        </button>
      </div>
      <div className="flex-1 min-w-0 space-y-1.5">
        <p className="text-sm font-medium text-zinc-900">{stdConfig.label}</p>
        <p className="text-xs text-zinc-500">{stdConfig.description}</p>
        {enabled && stdConfig.type !== 'toggle' && (
          <div className="mt-2">
            {stdConfig.type === 'select' && (
              <select
                value={inputValue}
                onChange={e => canEdit && onChange({ ...value, enabled: true, value: e.target.value })}
                disabled={!canEdit}
                className="px-3 py-1.5 border border-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-600 disabled:opacity-50"
              >
                {stdConfig.options.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            )}
            {stdConfig.type === 'number' && (
              <input
                type="number"
                value={inputValue}
                min={stdConfig.min}
                max={stdConfig.max}
                onChange={e => canEdit && onChange({ ...value, enabled: true, value: e.target.value })}
                disabled={!canEdit}
                className="w-28 px-3 py-1.5 border border-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-600 disabled:opacity-50"
              />
            )}
            {stdConfig.type === 'text' && (
              <input
                type="text"
                value={inputValue}
                placeholder={stdConfig.placeholder}
                onChange={e => canEdit && onChange({ ...value, enabled: true, value: e.target.value })}
                disabled={!canEdit}
                className="w-48 px-3 py-1.5 border border-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-600 disabled:opacity-50"
              />
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function generateExamples(standards) {
  const examples = []
  const sep = standards.wordSeparator?.enabled
    ? (standards.wordSeparator?.value === 'underscore' ? '_' : '-')
    : '-'

  examples.push({ value: `my${sep}value`, passes: true })

  if (standards.noSpaces?.enabled)
    examples.push({ value: 'my value', passes: false, reason: 'No spaces allowed' })
  if (standards.wordSeparator?.enabled && standards.wordSeparator?.value === 'hyphen')
    examples.push({ value: 'my_value', passes: false, reason: 'Use hyphens, not underscores' })
  if (standards.wordSeparator?.enabled && standards.wordSeparator?.value === 'underscore')
    examples.push({ value: 'my-value', passes: false, reason: 'Use underscores, not hyphens' })
  if (standards.maxLength?.enabled && standards.maxLength?.value)
    examples.push({
      value: 'a'.repeat(parseInt(standards.maxLength.value) + 1),
      passes: false,
      reason: `Exceeds ${standards.maxLength.value} characters`,
    })
  if (standards.noSpecialCharacters?.enabled)
    examples.push({ value: 'my@value!', passes: false, reason: 'Special characters not allowed' })
  if (standards.prefixRequired?.enabled && standards.prefixRequired?.value)
    examples.push({
      value: 'no-prefix-here',
      passes: false,
      reason: `Must start with "${standards.prefixRequired.value}"`,
    })
  if (standards.noConsecutiveSeparators?.enabled)
    examples.push({ value: 'my--value', passes: false, reason: 'No consecutive separators' })

  return examples.slice(0, 6)
}

export default function FormatStandards() {
  const { currentOrg, refetch } = useOrg()
  const { isManager } = usePermissions()

  const [standards, setStandards] = useState(currentOrg?.formatStandards || {})
  const [saving, setSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState('')
  const [testValue, setTestValue] = useState('')

  useEffect(() => {
    if (currentOrg?.formatStandards) setStandards(currentOrg.formatStandards)
  }, [currentOrg?.formatStandards])

  const handleStandardChange = (key, value) => {
    setStandards(prev => ({ ...prev, [key]: value }))
  }

  const handleSave = async () => {
    setSaving(true)
    setSaveMessage('')
    try {
      const { error } = await supabase
        .from('organizations')
        .update({ format_standards: standards })
        .eq('id', currentOrg.id)
      if (error) throw error
      const { data: { user } } = await supabase.auth.getUser()
      await writeAuditLog({
        organizationId: currentOrg.id,
        userId: user?.id,
        userEmail: user?.email,
        action: 'format_standards_updated',
        entityType: 'account',
        metadata: { standards },
      })
      await refetch()
      setSaveMessage('Saved successfully.')
    } catch (err) {
      setSaveMessage(`Error: ${err.message}`)
    } finally {
      setSaving(false)
    }
  }

  const violations = testValue ? validateAgainstFormatStandards(testValue, standards) : []
  const examples = generateExamples(standards)

  return (
    <div className="space-y-4">
      {/* Page header with Rule Tester button */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-zinc-900">Format Standards</h2>
          <p className="text-sm text-zinc-500 mt-1">
            Define naming conventions that apply to all parameter values across your organization.
          </p>
        </div>
        <RuleTester />
      </div>

      {!isManager && (
        <div className="bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-700">
          You have read-only access. Contact an admin or manager to make changes.
        </div>
      )}

      {/* Two-column layout */}
      <div className="flex gap-6 items-start">
        {/* Left: toggles */}
        <div className="flex-1 min-w-0 space-y-4">
          <div className="bg-white border border-zinc-200 p-5">
            {STANDARDS_CONFIG.map(stdConfig => (
              <StandardRow
                key={stdConfig.key}
                config={stdConfig}
                value={standards[stdConfig.key] || {}}
                onChange={val => handleStandardChange(stdConfig.key, val)}
                canEdit={isManager}
              />
            ))}
          </div>

          {isManager && (
            <div className="flex items-center gap-3">
              <button
                onClick={handleSave}
                disabled={saving}
                className="bg-teal-600 text-white rounded-full px-4 py-2 text-sm font-medium hover:bg-teal-700 disabled:opacity-50 transition-colors"
              >
                {saving ? 'Saving…' : 'Save standards'}
              </button>
              {saveMessage && (
                <p className={`text-sm ${saveMessage.startsWith('Error') ? 'text-red-600' : 'text-emerald-600'}`}>
                  {saveMessage}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Right: inline rule tester panel */}
        <div className="w-72 flex-shrink-0 sticky top-6 space-y-4">
          <div className="bg-white border border-zinc-200 p-4 space-y-4">
            <h3 className="text-sm font-semibold text-zinc-700">Format Tester</h3>

            {/* Custom test input */}
            <div>
              <label className="text-xs text-zinc-500 mb-1 block">Test a value</label>
              <input
                type="text"
                value={testValue}
                onChange={e => setTestValue(e.target.value)}
                placeholder="Type any value…"
                className="w-full px-3 py-2 border border-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-600"
              />
              {testValue && (
                <div className="mt-2 space-y-1">
                  {violations.length === 0 ? (
                    <div className="flex items-center gap-1.5 text-teal-600 text-sm">
                      <span>✓</span>
                      <span>Passes all active rules</span>
                    </div>
                  ) : (
                    violations.map((v, i) => (
                      <div key={i} className="flex items-start gap-1.5 text-red-500 text-xs">
                        <span className="flex-shrink-0">✗</span>
                        <span>{v}</span>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* Auto-generated examples */}
            <div>
              <label className="text-xs text-zinc-500 mb-2 block">Examples</label>
              <div className="space-y-1.5">
                {examples.map((ex, i) => (
                  <div key={i} className="flex items-center justify-between p-2 bg-zinc-50 border border-zinc-100">
                    <code className="font-mono text-xs text-zinc-700 truncate max-w-[130px]">{ex.value}</code>
                    {ex.passes ? (
                      <span className="text-teal-600 text-xs font-medium flex-shrink-0">✓ passes</span>
                    ) : (
                      <span className="text-red-500 text-xs flex-shrink-0 ml-1">{ex.reason}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
