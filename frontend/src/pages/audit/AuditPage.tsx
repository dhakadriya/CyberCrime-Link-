import { useEffect, useState } from 'react'
import { Activity, Filter } from 'lucide-react'
import { auditApi } from '../../api/audit'
import { Pagination } from '../../components/shared/Pagination'
import { PageLoader } from '../../components/shared/LoadingSpinner'
import { ErrorAlert } from '../../components/shared/ErrorAlert'
import { StatusBadge } from '../../components/shared/StatusBadge'
import { getErrorMessage } from '../../api/client'
import type { AuditLog, PaginatedResponse } from '../../types'
import { format } from 'date-fns'

export function AuditPage() {
  const [data, setData] = useState<PaginatedResponse<AuditLog> | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [page, setPage] = useState(1)
  const [actionFilter, setActionFilter] = useState('')
  const [resultFilter, setResultFilter] = useState('')

  const load = async (p = 1) => {
    setLoading(true); setError('')
    try {
      const r = await auditApi.list({ page: p, size: 50, action: actionFilter || undefined, result: resultFilter || undefined })
      setData(r)
    } catch (e) { setError(getErrorMessage(e)) }
    finally { setLoading(false) }
  }

  useEffect(() => { load(1) }, [actionFilter, resultFilter])

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <h1 className="text-lg font-bold text-slate-100 flex items-center gap-2">
          <Activity className="h-5 w-5 text-indigo-400" /> Audit Logs
        </h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Immutable action trail — {data?.total ?? 0} entries
        </p>
      </div>

      <div className="page-content space-y-4">
        <div className="card p-4 flex flex-wrap gap-3 items-center">
          <Filter className="h-4 w-4 text-slate-600" />
          <input className="input w-52 text-sm" placeholder="Filter by action…" value={actionFilter}
            onChange={e => { setActionFilter(e.target.value); setPage(1) }} />
          <select className="input w-36 text-sm" value={resultFilter}
            onChange={e => { setResultFilter(e.target.value); setPage(1) }}>
            <option value="">All Results</option>
            <option value="SUCCESS">SUCCESS</option>
            <option value="FAILURE">FAILURE</option>
            <option value="DENIED">DENIED</option>
          </select>
        </div>

        {error && <ErrorAlert message={error} onClose={() => setError('')} />}

        {loading ? <PageLoader /> : (
          <div className="card overflow-hidden">
            {(!data || data.items.length === 0) ? (
              <p className="p-8 text-center text-slate-600">No audit logs found.</p>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="border-b border-slate-800 bg-slate-900/50">
                      <tr>
                        {['Timestamp', 'Action', 'User', 'Resource', 'Result', 'IP'].map(h => (
                          <th key={h} className="px-4 py-3 text-left font-medium text-slate-500">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {data.items.map(log => (
                        <tr key={log.id} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                          <td className="px-4 py-2.5 text-slate-500 whitespace-nowrap font-mono">
                            {format(new Date(log.created_at), 'MM/dd HH:mm:ss')}
                          </td>
                          <td className="px-4 py-2.5 font-mono font-medium text-slate-300">{log.action}</td>
                          <td className="px-4 py-2.5 text-slate-400">{log.username ?? '—'}</td>
                          <td className="px-4 py-2.5 text-slate-500">
                            {log.resource_type && (
                              <span className="rounded bg-slate-800 border border-slate-700 px-1.5 py-0.5 text-slate-400">
                                {log.resource_type}
                              </span>
                            )}
                            {log.resource_id && (
                              <span className="ml-1 font-mono text-slate-600">{log.resource_id.slice(0, 8)}…</span>
                            )}
                          </td>
                          <td className="px-4 py-2.5"><StatusBadge value={log.result} /></td>
                          <td className="px-4 py-2.5 text-slate-600 font-mono">{log.ip_address ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="px-4">
                  <Pagination page={data.page} pages={data.pages} total={data.total} size={data.size}
                    onChange={p => { setPage(p); load(p) }} />
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
