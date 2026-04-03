import { validateAgainstFormatStandards } from '../../../lib/formatValidator'

export default function ParameterField({
  param,
  value,
  onChange,
  onRequestValue,
  globalAllowedValues,
  formatStandards,
}) {
  const allowedValues = param.allowedValues?.length > 0
    ? param.allowedValues
    : (globalAllowedValues || [])

  const isLocked = param.locked && value
  const isRequired = param.required
  const formatViolations = value ? validateAgainstFormatStandards(value, formatStandards || {}) : []
  const isInAllowedList = !allowedValues.length || allowedValues.includes(value)
  const isValid = isInAllowedList && formatViolations.length === 0

  const inputClass = `w-full px-3 py-2 border text-sm focus:outline-none focus:ring-2 focus:ring-teal-600 ${
    value && !isValid ? 'border-red-300 bg-red-50' : 'border-zinc-200'
  } ${isLocked ? 'bg-zinc-50 text-zinc-500' : ''}`

  return (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-1">
        <label className="text-sm font-medium text-zinc-700">
          {param.name}
          {isRequired && <span className="text-red-400 ml-1">*</span>}
          {param.locked && <span className="text-zinc-400 text-xs ml-2">(locked)</span>}
        </label>
        {value && (
          isValid
            ? <span className="text-teal-600 text-xs">✓ valid</span>
            : <span className="text-red-500 text-xs">✗ invalid</span>
        )}
      </div>

      {allowedValues.length > 0 ? (
        <div>
          <select
            value={value || ''}
            onChange={e => onChange(e.target.value)}
            disabled={!!isLocked}
            className={inputClass}
          >
            <option value="">— Select —</option>
            {allowedValues.map(v => (
              <option key={v} value={v}>{v}</option>
            ))}
          </select>
          {onRequestValue && (
            <button
              type="button"
              onClick={() => onRequestValue(param.name)}
              className="text-xs text-teal-600 mt-1 hover:underline"
            >
              Value not listed? Request or use one-time
            </button>
          )}
        </div>
      ) : (
        <input
          type="text"
          value={value || ''}
          onChange={e => onChange(e.target.value)}
          disabled={!!isLocked}
          placeholder={param.defaultValue || `Enter ${param.name}`}
          className={inputClass}
        />
      )}

      {formatViolations.map((v, i) => (
        <p key={i} className="text-xs text-red-500 mt-1">{v}</p>
      ))}
      {value && !isInAllowedList && allowedValues.length > 0 && (
        <p className="text-xs text-red-500 mt-1">"{value}" is not in the approved list</p>
      )}
    </div>
  )
}
