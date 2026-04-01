import { useState, useEffect } from 'react'
import { useOrg } from '../../contexts/OrgContext'
import { usePermissions } from '../../hooks/usePermissions'
import { supabase } from '../../lib/supabase'
import { writeAuditLog } from '../../lib/auditLog'
import { validateAgainstFormatStandards } from '../../lib/formatValidator'

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
    placeholder: 'e.g. utm_',
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

const PREVIEW_VALUES = ['my-value', 'my value', 'my_value', 'MY_VALUE--test', 'example123']

function StandardRow({ config: stdConfig, value, onChange, canEdit }) {
  const enabled = value?.enabled || false
  const inputValue = value?.value !== undefined ? value.value : stdConfig.defaultValue

  return (
    <div className="flex items-start gap-4 py-4 border-b border-zinc-100 last:border-0">
      <div className="mt-0.5">
        <button
          type="button"
          onClick={() => canEdit && onChange({ ...value, enabled: !enabled })}
          disabled={!canEdit}
          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${enabled ? 'bg-teal-600' : 'bg-zinc-300'} ${!canEdit ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
        >
          <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${enabled ? 'translate-x-4.5' : 'translate-x-0.5'}`} />
        </button>
      </div>
      <div className="flex-1 min-w-0 space-y-1.5">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-zinc-900">{stdConfig.label}</p>
        </div>
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

function LivePreview({ standards }) {
  const previewVal = 'my-value example'
  const violations = validateAgainstFormatStandards(previewVal, standards)
  const passVal = 'my-value'
  const passViolations = validateAgainstFormatStandards(passVal, standards)

  return (
    <div className="border border-zinc-200 p-4 space-y-2 bg-zinc-50">
      <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">Live preview</p>
      <div className="space-y-1">
        <div className="flex items-center gap-2 text-sm">
          <span className="font-mono text-zinc-600 bg-white border border-zinc-200 px-2 py-0.5 text-xs">{passVal}</span>
          {passViolations.length === 0
            ? <span className="text-teal-600 text-xs">✓ passes</span>
            : <span className="text-red-500 text-xs">✗ {passViolations.join(', ')}</span>
          }
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className="font-mono text-zinc-600 bg-white border border-zinc-200 px-2 py-0.5 text-xs">{previewVal}</span>
          {violations.length === 0
            ? <span className="text-teal-600 text-xs">✓ passes</span>
            : <span className="text-red-500 text-xs">✗ {violations.join(', ')}</span>
          }
        </div>
      </div>
    </div>
  )
}

export default function FormatStandards() {
  const { currentOrg, refetch } = useOrg()
  const { isManager } = usePermissions()

  const [standards, setStandards] = useState(currentOrg?.formatStandards || {})
  const [saving, setSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState('')

  useEffect(() => {
    if (currentOrg?.formatStandards) {
      setStandards(currentOrg.formatStandards)
    }
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

  return (
    <div className="space-y-5 max-w-2xl">
      <div>
        <h2 className="text-lg font-semibold text-zinc-900">Format Standards</h2>
        <p className="text-sm text-zinc-500 mt-1">
          Define naming conventions that apply to all parameter values across your organization.
        </p>
      </div>

      {!isManager && (
        <div className="bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-700">
          You have read-only access to format standards. Contact an admin or manager to make changes.
        </div>
      )}

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

      <LivePreview standards={standards} />

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
  )
}
