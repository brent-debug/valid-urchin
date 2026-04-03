import { useState } from 'react'
import Modal from '../../../components/ui/Modal'

export default function ValueRequestModal({ parameter, onClose, onAddOneTime, onRequest }) {
  const [requestType, setRequestType] = useState(null)
  const [value, setValue] = useState('')
  const [reason, setReason] = useState('')

  const handleSubmit = () => {
    if (!value || !requestType) return
    if (requestType === 'one_time') onAddOneTime(value, reason)
    else onRequest(value, reason)
  }

  return (
    <Modal title={`Add value for ${parameter}`} onClose={onClose}>
      <div className="space-y-4">
        <p className="text-sm text-zinc-500">
          The value you need isn't in the approved list for <strong>{parameter}</strong>. Choose how to proceed:
        </p>

        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">Value</label>
          <input
            type="text"
            value={value}
            onChange={e => setValue(e.target.value)}
            placeholder={`Enter ${parameter} value`}
            className="w-full px-3 py-2 border border-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-600"
            autoFocus
          />
        </div>

        <div className="space-y-2">
          <button
            type="button"
            onClick={() => setRequestType('one_time')}
            className={`w-full p-3 border text-left transition-colors ${
              requestType === 'one_time'
                ? 'border-teal-400 bg-teal-50'
                : 'border-zinc-200 hover:bg-zinc-50'
            }`}
          >
            <div className="text-sm font-medium text-zinc-900">Use one-time</div>
            <div className="text-xs text-zinc-400 mt-0.5">
              Use this value for this URL only. A manager will be notified to review.
            </div>
          </button>

          <button
            type="button"
            onClick={() => setRequestType('add_permanently')}
            className={`w-full p-3 border text-left transition-colors ${
              requestType === 'add_permanently'
                ? 'border-teal-400 bg-teal-50'
                : 'border-zinc-200 hover:bg-zinc-50'
            }`}
          >
            <div className="text-sm font-medium text-zinc-900">Request to add permanently</div>
            <div className="text-xs text-zinc-400 mt-0.5">
              Ask a manager to add this to the approved values list for everyone.
            </div>
          </button>
        </div>

        {requestType && (
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">
              Reason <span className="text-zinc-400 font-normal">(optional)</span>
            </label>
            <input
              type="text"
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="Why is this value needed?"
              className="w-full px-3 py-2 border border-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-600"
            />
          </div>
        )}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="bg-white text-zinc-700 border border-zinc-200 rounded-full px-4 py-2 text-sm hover:bg-zinc-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!value || !requestType}
            className="bg-teal-600 text-white rounded-full px-4 py-2 text-sm font-medium hover:bg-teal-700 disabled:opacity-50"
          >
            {requestType === 'one_time' ? 'Use one-time' : 'Submit request'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
