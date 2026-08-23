import { useState, FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { personsApi } from '../../api/persons'
import { getErrorMessage } from '../../api/client'
import { ErrorAlert } from '../../components/shared/ErrorAlert'

export function CreatePersonPage() {
  const navigate = useNavigate()
  const [form, setForm] = useState({
    first_name: '', last_name: '', alias: '', date_of_birth: '',
    gender: '', nationality: 'Synthetic', national_id: '',
    address: '', phone: '', email: '', occupation: '',
    notes: 'SYNTHETIC DATA — Not a real person',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }))

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault(); setLoading(true); setError('')
    try {
      const p = await personsApi.create({
        ...form,
        alias: form.alias || undefined,
        date_of_birth: form.date_of_birth || undefined,
        gender: form.gender || undefined,
        notes: form.notes || undefined,
      })
      navigate(`/persons/${p.id}`)
    } catch (err) { setError(getErrorMessage(err)) }
    finally { setLoading(false) }
  }

  return (
    <div>
      <div className="page-header flex items-center gap-3">
        <button onClick={() => navigate('/persons')} className="btn-secondary p-2"><ArrowLeft className="h-4 w-4" /></button>
        <div>
          <h1 className="text-xl font-bold text-slate-800">Add Person Record</h1>
          <p className="text-sm text-slate-500">All data must be synthetic for demo environment</p>
        </div>
      </div>

      <div className="page-content">
        <div className="max-w-2xl card p-6">
          <div className="mb-4 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-700">
            ⚠ Use synthetic/fictional data only. Do not enter real personal information.
          </div>
          {error && <ErrorAlert message={error} onClose={() => setError('')} />}
          <form onSubmit={handleSubmit} className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <div><label className="label">First Name *</label><input className="input" value={form.first_name} onChange={set('first_name')} required /></div>
              <div><label className="label">Last Name *</label><input className="input" value={form.last_name} onChange={set('last_name')} required /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><label className="label">Alias / Nickname</label><input className="input" value={form.alias} onChange={set('alias')} /></div>
              <div><label className="label">Date of Birth</label><input type="date" className="input" value={form.date_of_birth} onChange={set('date_of_birth')} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Gender</label>
                <select className="input" value={form.gender} onChange={set('gender')}>
                  <option value="">Unknown</option>
                  <option>Male</option><option>Female</option><option>Other</option>
                </select>
              </div>
              <div><label className="label">Nationality</label><input className="input" value={form.nationality} onChange={set('nationality')} /></div>
            </div>
            <div><label className="label">Address</label><input className="input" value={form.address} onChange={set('address')} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><label className="label">Phone</label><input className="input" value={form.phone} onChange={set('phone')} /></div>
              <div><label className="label">Occupation</label><input className="input" value={form.occupation} onChange={set('occupation')} /></div>
            </div>
            <div><label className="label">Notes</label><textarea className="input min-h-[80px]" value={form.notes} onChange={set('notes')} /></div>
            <div className="flex gap-3 pt-2">
              <button type="submit" className="btn-primary" disabled={loading}>{loading ? 'Saving…' : 'Create Person'}</button>
              <button type="button" className="btn-secondary" onClick={() => navigate('/persons')}>Cancel</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
