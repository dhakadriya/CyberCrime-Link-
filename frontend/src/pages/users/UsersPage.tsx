import { useEffect, useState } from 'react'
import { usersApi } from '../../api/users'
import { Pagination } from '../../components/shared/Pagination'
import { PageLoader } from '../../components/shared/LoadingSpinner'
import { ErrorAlert, SuccessAlert } from '../../components/shared/ErrorAlert'
import { StatusBadge } from '../../components/shared/StatusBadge'
import { getErrorMessage } from '../../api/client'
import type { User, PaginatedResponse } from '../../types'
import { Plus, Unlock, UserCog } from 'lucide-react'
import { format } from 'date-fns'

const ROLES = ['SUPER_ADMIN', 'CASE_SUPERVISOR', 'INVESTIGATION_OFFICER', 'EVIDENCE_OFFICER', 'VIEWER_AUDITOR']

export function UsersPage() {
  const [data, setData] = useState<PaginatedResponse<User> | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [page, setPage] = useState(1)
  const [showCreate, setShowCreate] = useState(false)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({ username: '', email: '', password: '', full_name: '', badge_number: '', department: '', role: 'INVESTIGATION_OFFICER' })

  const load = async (p = 1) => {
    setLoading(true); setError('')
    try {
      setData(await usersApi.list({ page: p, size: 20 }))
    } catch (e) { setError(getErrorMessage(e)) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const handleUnlock = async (id: string, username: string) => {
    try {
      await usersApi.unlock(id)
      setSuccess(`${username} account unlocked.`)
      load(page)
    } catch (e) { setError(getErrorMessage(e)) }
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault(); setCreating(true); setError('')
    try {
      await usersApi.create({ ...form, role_names: [form.role], badge_number: form.badge_number || undefined, department: form.department || undefined })
      setSuccess(`User ${form.username} created.`)
      setShowCreate(false)
      setForm({ username: '', email: '', password: '', full_name: '', badge_number: '', department: '', role: 'INVESTIGATION_OFFICER' })
      load(1)
    } catch (e) { setError(getErrorMessage(e)) }
    finally { setCreating(false) }
  }

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }))

  return (
    <div>
      <div className="page-header flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2"><UserCog className="h-5 w-5" /> User Management</h1>
          <p className="text-sm text-slate-500 mt-0.5">{data?.total ?? 0} users</p>
        </div>
        <button onClick={() => setShowCreate(v => !v)} className="btn-primary"><Plus className="h-4 w-4" /> New User</button>
      </div>

      <div className="page-content space-y-4">
        {error && <ErrorAlert message={error} onClose={() => setError('')} />}
        {success && <SuccessAlert message={success} onClose={() => setSuccess('')} />}

        {showCreate && (
          <div className="card p-5">
            <h3 className="font-semibold text-slate-700 mb-4">Create New User</h3>
            <form onSubmit={handleCreate} className="grid grid-cols-2 gap-4">
              <div><label className="label">Username *</label><input className="input" required value={form.username} onChange={set('username')} /></div>
              <div><label className="label">Full Name *</label><input className="input" required value={form.full_name} onChange={set('full_name')} /></div>
              <div><label className="label">Email *</label><input type="email" className="input" required value={form.email} onChange={set('email')} /></div>
              <div><label className="label">Password * (min 12 chars)</label><input type="password" className="input" required minLength={12} value={form.password} onChange={set('password')} /></div>
              <div><label className="label">Badge Number</label><input className="input" value={form.badge_number} onChange={set('badge_number')} /></div>
              <div><label className="label">Department</label><input className="input" value={form.department} onChange={set('department')} /></div>
              <div>
                <label className="label">Role</label>
                <select className="input" value={form.role} onChange={set('role')}>
                  {ROLES.map(r => <option key={r} value={r}>{r.replace(/_/g, ' ')}</option>)}
                </select>
              </div>
              <div className="flex items-end gap-2">
                <button type="submit" disabled={creating} className="btn-primary">{creating ? 'Creating…' : 'Create User'}</button>
                <button type="button" onClick={() => setShowCreate(false)} className="btn-secondary">Cancel</button>
              </div>
            </form>
          </div>
        )}

        {loading ? <PageLoader /> : (
          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-100 bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-slate-600">User</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-600">Username</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-600">Role</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-600">Status</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-600">Last Login</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {data?.items.map(u => (
                  <tr key={u.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="h-7 w-7 rounded-full bg-primary-100 flex items-center justify-center text-xs font-bold text-primary-700">
                          {u.full_name.charAt(0)}
                        </div>
                        <div>
                          <p className="font-medium text-slate-800">{u.full_name}</p>
                          <p className="text-xs text-slate-400">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-600">{u.username}</td>
                    <td className="px-4 py-3 text-xs text-slate-500">{u.roles.join(', ') || '—'}</td>
                    <td className="px-4 py-3">
                      {u.is_locked
                        ? <span className="text-xs font-medium text-red-600">🔒 Locked</span>
                        : u.is_active
                          ? <span className="text-xs font-medium text-green-600">Active</span>
                          : <span className="text-xs font-medium text-slate-400">Inactive</span>
                      }
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-400">
                      {u.last_login ? format(new Date(u.last_login), 'PP HH:mm') : 'Never'}
                    </td>
                    <td className="px-4 py-3">
                      {u.is_locked && (
                        <button onClick={() => handleUnlock(u.id, u.username)} className="text-xs text-primary-600 hover:underline flex items-center gap-1">
                          <Unlock className="h-3 w-3" /> Unlock
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {data && <div className="px-4"><Pagination page={data.page} pages={data.pages} total={data.total} size={data.size} onChange={p => { setPage(p); load(p) }} /></div>}
          </div>
        )}
      </div>
    </div>
  )
}
