import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Search, Users } from 'lucide-react'
import { personsApi } from '../../api/persons'
import { StatusBadge } from '../../components/shared/StatusBadge'
import { Pagination } from '../../components/shared/Pagination'
import { PageLoader } from '../../components/shared/LoadingSpinner'
import { ErrorAlert } from '../../components/shared/ErrorAlert'
import { getErrorMessage } from '../../api/client'
import { useAuth } from '../../context/AuthContext'
import type { Person, PaginatedResponse } from '../../types'

export function PersonsPage() {
  const [data, setData] = useState<PaginatedResponse<Person> | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const navigate = useNavigate()
  const { hasPermission } = useAuth()

  const load = async (p = 1, s = search) => {
    setLoading(true); setError('')
    try {
      const res = await personsApi.list({ page: p, size: 20, search: s || undefined })
      setData(res)
    } catch (e) { setError(getErrorMessage(e)) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const handleSearch = (e: React.FormEvent) => { e.preventDefault(); setPage(1); load(1) }

  return (
    <div>
      <div className="page-header border-b border-slate-700 bg-slate-900 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Persons</h1>
          <p className="text-xs text-slate-400 mt-1">{data?.total ?? 0} active subject records</p>
        </div>
        {hasPermission('PERSON_CREATE') && (
          <button onClick={() => navigate('/persons/new')} className="btn-primary gap-1.5 h-[44px]">
            <Plus className="h-4 w-4" /> New Person
          </button>
        )}
      </div>

      <div className="page-content space-y-4">
        <div className="card p-4 flex gap-3">
          <form onSubmit={handleSearch} className="flex gap-2 flex-1">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input className="input pl-9 h-[44px]" placeholder="Search by name or alias…" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <button type="submit" className="btn-primary px-4 h-[44px]"><Search className="h-4 w-4 text-white" /></button>
          </form>
        </div>

        {error && <ErrorAlert message={error} onClose={() => setError('')} />}

        {loading ? <PageLoader /> : (
          <>
            {(!data || data.items.length === 0) ? (
              <div className="card p-12 text-center">
                <Users className="h-12 w-12 text-slate-400 mx-auto mb-3" />
                <p className="text-slate-200 font-bold">No persons found</p>
              </div>
            ) : (
              <div className="card overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="table-header">
                    <tr>
                      <th className="px-4 py-3 text-left font-bold text-slate-300 text-xs uppercase tracking-wider">Name</th>
                      <th className="px-4 py-3 text-left font-bold text-slate-300 text-xs uppercase tracking-wider">Alias</th>
                      <th className="px-4 py-3 text-left font-bold text-slate-300 text-xs uppercase tracking-wider">Nationality</th>
                      <th className="px-4 py-3 text-left font-bold text-slate-300 text-xs uppercase tracking-wider">Occupation</th>
                      <th className="px-4 py-3 text-left font-bold text-slate-300 text-xs uppercase tracking-wider">Cases</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#EAECF0]">
                    {data.items.map(p => (
                      <tr key={p.id} onClick={() => navigate(`/persons/${p.id}`)} className="table-row cursor-pointer">
                        <td className="table-cell font-bold text-slate-100">{p.full_name}</td>
                        <td className="table-cell text-slate-300 text-xs">{p.alias ?? '—'}</td>
                        <td className="table-cell text-slate-300">{p.nationality ?? '—'}</td>
                        <td className="table-cell text-slate-300">{p.occupation ?? '—'}</td>
                        <td className="table-cell text-slate-400 font-bold font-mono">{p.case_history?.length ?? 0}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="px-4 py-2 border-t border-[#EAECF0]">
                  <Pagination page={data.page} pages={data.pages} total={data.total} size={data.size}
                    onChange={p => { setPage(p); load(p) }} />
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
