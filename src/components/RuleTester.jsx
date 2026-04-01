import { useState } from 'react'
import { useConfiguration } from '../hooks/useConfiguration'
import { useOrg } from '../contexts/OrgContext'
import { validateAgainstFormatStandards } from '../lib/formatValidator'
import { XMarkIcon } from '@heroicons/react/24/outline'

const DEFAULT_TRIGGER_PARAMS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term']

function runTest(paramsToTest, config, formatStandards) {
  const results = {}
  Object.entries(paramsToTest).forEach(([param, value]) => {
    if (!value && value !== 0) return
    const checks = []

    // Allowed values
    const allowedValues = config?.allowedValues?.[param]
    if (allowedValues?.length > 0) {
      const passes = allowedValues.includes(value)
      checks.push({
        rule: 'Allowed values',
        passes,
        detail: passes
          ? `"${value}" is in the allowed list`
          : `"${value}" is not in the allowed list — [${allowedValues.join(', ')}]`,
      })
    }

    // Casing rules
    const casingRule = config?.casingRules?.[param]
    if (casingRule) {
      const passes = casingRule === 'lowercase'
        ? value === value.toLowerCase()
        : value === value.toUpperCase()
      checks.push({
        rule: `Casing (${casingRule})`,
        passes,
        detail: passes ? `Value is ${casingRule}` : `Must be ${casingRule}`,
      })
    }

    // Format standards
    const hasStandards = formatStandards && Object.values(formatStandards).some(s => s?.enabled)
    if (hasStandards) {
      const violations = validateAgainstFormatStandards(value, formatStandards)
      checks.push({
        rule: 'Format standards',
        passes: violations.length === 0,
        detail: violations.length === 0 ? 'Passes all format rules' : violations.join(', '),
      })
    }

    results[param] = {
      value,
      checks,
      passes: checks.length === 0 ? true : checks.every(c => c.passes),
    }
  })
  return results
}

export default function RuleTester() {
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState('url') // 'url' | 'individual'
  const [urlInput, setUrlInput] = useState('')
  const [individualParams, setIndividualParams] = useState([{ param: '', value: '' }])
  const [results, setResults] = useState(null)
  const [inputError, setInputError] = useState('')

  const { config } = useConfiguration()
  const { currentOrg } = useOrg()
  const formatStandards = currentOrg?.formatStandards || {}
  const triggerParameters = currentOrg?.triggerParameters || DEFAULT_TRIGGER_PARAMS

  function handleRunTest() {
    setInputError('')
    let paramsToTest = {}

    if (mode === 'url') {
      try {
        const url = new URL(urlInput)
        triggerParameters.forEach(p => {
          const v = url.searchParams.get(p)
          if (v) paramsToTest[p] = v
        })
        if (Object.keys(paramsToTest).length === 0) {
          setInputError('No tracked parameters found in this URL.')
          return
        }
      } catch {
        setInputError('Invalid URL. Include https:// and at least one tracked parameter.')
        return
      }
    } else {
      individualParams.forEach(({ param, value }) => {
        if (param.trim() && value.trim()) paramsToTest[param.trim()] = value.trim()
      })
      if (Object.keys(paramsToTest).length === 0) {
        setInputError('Add at least one parameter and value.')
        return
      }
    }

    setResults(runTest(paramsToTest, config, formatStandards))
  }

  const totalParams = results ? Object.keys(results).length : 0
  const totalViolations = results
    ? Object.values(results).reduce((sum, r) => sum + r.checks.filter(c => !c.passes).length, 0)
    : 0

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-3 py-1.5 text-sm border border-zinc-300 text-zinc-600 hover:border-teal-400 hover:text-teal-600 transition-colors"
      >
        <span>⚡</span>
        Rule Tester
      </button>

      {/* Backdrop (mobile) */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/20 lg:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Slide-out panel */}
      <div
        className={`fixed top-0 right-0 h-full w-full max-w-[480px] bg-white border-l border-zinc-200 shadow-xl z-50 flex flex-col transition-transform duration-300 ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Panel header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-200 flex-shrink-0">
          <div>
            <h2 className="text-sm font-semibold text-zinc-900">Rule Tester</h2>
            <p className="text-xs text-zinc-400 mt-0.5">Test values against your active rules</p>
          </div>
          <button onClick={() => setOpen(false)} className="p-1 text-zinc-400 hover:text-zinc-600">
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        {/* Panel body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Mode toggle */}
          <div className="inline-flex bg-zinc-100 rounded-full p-1">
            {[['url', 'Test URL'], ['individual', 'Individual values']].map(([key, label]) => (
              <button
                key={key}
                onClick={() => { setMode(key); setResults(null); setInputError('') }}
                className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                  mode === key ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* URL input */}
          {mode === 'url' ? (
            <div>
              <label className="block text-xs text-zinc-500 mb-1.5">Enter a full URL to test</label>
              <input
                type="text"
                value={urlInput}
                onChange={e => { setUrlInput(e.target.value); setInputError('') }}
                placeholder="https://example.com?utm_source=google&utm_medium=cpc"
                className="w-full px-3 py-2 border border-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-600"
              />
              <p className="text-xs text-zinc-400 mt-1">
                Tracked: {triggerParameters.join(', ')}
              </p>
            </div>
          ) : (
            /* Individual values */
            <div className="space-y-2">
              <label className="block text-xs text-zinc-500">Parameter values to test</label>
              {individualParams.map((row, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={row.param}
                    onChange={e => {
                      const updated = [...individualParams]
                      updated[i] = { ...row, param: e.target.value }
                      setIndividualParams(updated)
                    }}
                    placeholder="utm_source"
                    className="w-36 px-3 py-2 border border-zinc-200 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-teal-600"
                  />
                  <span className="text-zinc-400 text-sm">=</span>
                  <input
                    type="text"
                    value={row.value}
                    onChange={e => {
                      const updated = [...individualParams]
                      updated[i] = { ...row, value: e.target.value }
                      setIndividualParams(updated)
                    }}
                    placeholder="google"
                    className="flex-1 px-3 py-2 border border-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-600"
                  />
                  {individualParams.length > 1 && (
                    <button
                      onClick={() => setIndividualParams(prev => prev.filter((_, j) => j !== i))}
                      className="text-zinc-400 hover:text-red-500 text-xl leading-none"
                    >×</button>
                  )}
                </div>
              ))}
              <button
                onClick={() => setIndividualParams(prev => [...prev, { param: '', value: '' }])}
                className="text-sm text-teal-600 hover:text-teal-700"
              >
                + Add parameter
              </button>
            </div>
          )}

          {inputError && <p className="text-sm text-red-600">{inputError}</p>}

          <button
            onClick={handleRunTest}
            className="w-full bg-teal-600 text-white py-2.5 text-sm font-medium hover:bg-teal-700 transition-colors"
          >
            Run Test
          </button>

          {/* Results */}
          {results && (
            <div className="space-y-4 border-t border-zinc-200 pt-4">
              <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">Results</p>

              {Object.entries(results).map(([param, result]) => (
                <div key={param} className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-semibold ${result.passes ? 'text-teal-600' : 'text-red-500'}`}>
                      {result.passes ? '✓' : '✗'}
                    </span>
                    <span className="font-mono text-sm font-medium text-zinc-800">{param}</span>
                    <span className="text-zinc-400 text-xs">"{result.value}"</span>
                  </div>
                  <div className="pl-5 space-y-1">
                    {result.checks.length === 0 ? (
                      <p className="text-xs text-zinc-400 italic">No rules configured for this parameter</p>
                    ) : (
                      result.checks.map((check, i) => (
                        <div key={i} className="flex items-start gap-1.5 text-xs">
                          <span className={`flex-shrink-0 ${check.passes ? 'text-teal-600' : 'text-red-500'}`}>
                            {check.passes ? '✓' : '✗'}
                          </span>
                          <div>
                            <span className="text-zinc-600 font-medium">{check.rule}</span>
                            <span className="text-zinc-400"> — {check.detail}</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              ))}

              {/* Summary */}
              <div className={`border-t border-zinc-200 pt-3 ${totalViolations === 0 ? 'text-teal-600' : 'text-red-600'}`}>
                {totalViolations === 0 ? (
                  <p className="text-sm font-medium">✓ All parameters pass your rules</p>
                ) : (
                  <p className="text-sm font-medium">
                    {totalParams} parameter{totalParams !== 1 ? 's' : ''} tested · {totalViolations} violation{totalViolations !== 1 ? 's' : ''} found
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
