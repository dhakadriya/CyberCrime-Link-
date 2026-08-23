import { useState, FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Zap } from 'lucide-react'
import { casesApi } from '../../api/cases'
import { getErrorMessage } from '../../api/client'
import { ErrorAlert, SuccessAlert } from '../../components/shared/ErrorAlert'

const TYPES = ['ROBBERY', 'BURGLARY', 'FRAUD', 'ASSAULT', 'MURDER', 'KIDNAPPING',
               'CYBERCRIME', 'DRUG_TRAFFICKING', 'MONEY_LAUNDERING', 'OTHER']
const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']

export function QuickCaseForm() {
  const navigate = useNavigate()
  const [form, setForm] = useState({
    title: '',
    case_type: 'ROBBERY',
    location: '',
    incident_date: '',
    priority: 'MEDIUM',
    description: '',
    status: 'OPEN',   // Can also be DRAFT
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const set = (k: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm(f => ({ ...f, [k]: e.target.value }))

  const handleSubmit = async (e: FormEvent, saveAsDraft = false) => {
    e.preventDefault()
    setLoading(true); setError('')
    try {
      const payload = {
        ...form,
        status: saveAsDraft ? 'DRAFT' : form.status,
        incident_date: form.incident_date || undefined,
        description: form.description || undefined,
        location: form.location || undefined,
      }
      const c = await casesApi.create(payload)
      navigate(`/cases/${c.id}`)
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <div className="page-header flex items-center gap-3">
        <button onClick={() => navigate('/cases')} className="btn-secondary p-2">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div>
          <div className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-amber-500" />
            <h1 className="text-xl font-bold text-slate-800">Quick Case</h1>
          </div>
          <p className="text-sm text-slate-500">Create a case quickly — add details later from Case Details</p>
        </div>
      </div>

      <div className="page-content">
        <div className="max-w-2xl">
          {/* Tip */}
          <div className="mb-5 rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
            <strong>Quick Case:</strong> Only Title and Crime Type are required.
            You can add persons, evidence, and investigation details from Case Details after creation.
          </div>

          {error && <div className="mb-4"><ErrorAlert message={error} onClose={() => setError('')} /></div>}

          <form onSubmit={(e) => handleSubmit(e, false)} className="card p-6 space-y-4">
            {/* Title */}
            <div>
              <label className="label">Case Title *</label>
              <input
                className="input"
                placeholder="e.g. Commerce Street Armed Robbery"
                value={form.title}
                onChange={set('title')}
                required
                minLength={3}
              />
            </div>

            {/* Type + Priority */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Crime Type *</label>
                <select className="input" value={form.case_type} onChange={set('case_type')}>
                  {TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Priority</label>
                <select className="input" value={form.priority} onChange={set('priority')}>
                  {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
            </div>

            {/* Location + Date */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Incident Location</label>
                <input
                  className="input"
                  placeholder="e.g. 88 Commerce Street"
                  value={form.location}
                  onChange={set('location')}
                />
              </div>
              <div>
                <label className="label">Incident Date / Time</label>
                <input
                  type="datetime-local"
                  className="input"
                  value={form.incident_date}
                  onChange={set('incident_date')}
                />
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="label">Description <span className="text-slate-400 font-normal">(optional)</span></label>
              <textarea
                className="input min-h-[80px] resize-none"
                placeholder="Brief description of the incident…"
                value={form.description}
                onChange={set('description')}
              />
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-2 border-t border-slate-100">
              <button type="submit" className="btn-primary" disabled={loading}>
                {loading ? 'Creating…' : 'Create Case'}
              </button>
              <button
                type="button"
                className="btn-secondary"
                disabled={loading}
                onClick={(e) => handleSubmit(e as any, true)}
              >
                Save as Draft
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => navigate('/cases')}
              >
                Cancel
              </button>
            </div>
          </form>

          <p className="text-xs text-slate-400 mt-3 text-center">
            Need to enter complete details? Use the{' '}
            <button
              className="text-primary-600 hover:underline"
              onClick={() => navigate('/cases/new?mode=wizard')}
            >
              Detailed Case Wizard
            </button>
            {' '}instead.
          </p>
        </div>
      </div>
    </div>
  )
}
