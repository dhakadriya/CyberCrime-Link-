import { useEffect, useState } from 'react'
import { ShieldAlert, ShieldCheck, Filter } from 'lucide-react'
import { securityApi } from '../../api/audit'
import { Pagination } from '../../components/shared/Pagination'
import { PageLoader } from '../../components/shared/LoadingSpinner'
import { ErrorAlert } from '../../components/shared/ErrorAlert'
import { StatusBadge } from '../../components/shared/StatusBadge'
import { getErrorMessage } from '../../api/client'
import type { SecurityEvent, PaginatedResponse } from '../../types'
import { format } from 'date-fns'

export function SecurityPage() {
  const [data, setData] = useState<PaginatedResponse<SecurityEvent> | null>(null)
  const [dashboard, setDashboard] = useState<Record<string, unknown> | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [page, setPage] = useState(1)
  const [severity, setSeverity] = useState('')

  const load = async (p = 1) => {
    setLoading(true); setError('')
    try {
      const [events, dash] = await Promise.all([
        securityApi.listEvents({ page: p, size: 50, severity: severity || undefined }),
        securityApi.getDashboard(),
      ])
      setData(events)
      setDashboard(dash as Record<string, unknown>)
    } catch (e) { setError(getErrorMessage(e)) }
    finally { setLoading(false) }
  }

  useEffect(() => { load(1) }, [severity])

  const handleResolve = async (id: string) => {
    try { await securityApi.resolveEvent(id); load(page) }
    catch (e) { setError(getErrorMessage(e)) }
  }

  return (
    <div className="animate-fade-in">
      <div className="page-header border-b border-slate-700 bg-slate-900 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-red-650" /> Security Dashboard
          </h1>
          <p className="text-xs text-slate-400 mt-1">Real-time security event monitoring</p>
        </div>
      </div>

      <div className="page-content space-y-4">
        {error && <ErrorAlert message={error} onClose={() => setError('')} />}

        {/* Stats */}
        {dashboard && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Total Events',         value: dashboard.total_events,              color: 'text-slate-100' },
              { label: 'Critical',              value: dashboard.critical_events,           color: 'text-red-750 font-bold' },
              { label: 'High',                  value: dashboard.high_events,               color: 'text-orange-700 font-bold' },
              { label: 'Unresolved',            value: dashboard.unresolved_events,         color: 'text-amber-700 font-bold' },
              { label: 'Last 24h',              value: dashboard.events_last_24h,           color: 'text-indigo-650 font-bold' },
              { label: 'Failed Logins (7d)',    value: dashboard.failed_logins_7d,          color: 'text-slate-300' },
              { label: 'Account Lockouts (7d)', value: dashboard.account_lockouts_7d,       color: 'text-orange-700' },
              { label: 'Integrity Failures',   value: dashboard.evidence_integrity_failures, color: 'text-red-750 font-bold' },
            ].map(item => (
              <div key={item.label} className="card p-3">
                <p className={`text-2xl font-bold ${item.color}`}>{String(item.value ?? 0)}</p>
                <p className="text-xs text-slate-400 mt-1 font-bold uppercase tracking-wider">{item.label}</p>
              </div>
            ))}
          </div>
        )}

        {/* Recent critical */}
        {Array.isArray(dashboard?.recent_critical) && (dashboard.recent_critical as SecurityEvent[]).length > 0 && (
          <div className="card p-5 border-[#FEE4E2] bg-[#FEE4E2]/15">
            <h3 className="font-bold text-red-750 mb-3 flex items-center gap-2 text-sm uppercase tracking-wider">
              <ShieldAlert className="h-4 w-4 text-red-650" /> Recent Critical / High Events
            </h3>
            <div className="space-y-2">
              {(dashboard.recent_critical as SecurityEvent[]).map(e => (
                <div key={e.id} className="flex items-start gap-3 rounded-lg border border-[#FEE4E2] bg-[#FEE4E2]/40 px-3 py-2">
                  <StatusBadge value={e.severity} type="severity" />
                  <div className="flex-1">
                    <p className="text-xs font-bold text-slate-100">{e.event_type}</p>
                    <p className="text-xs text-slate-200 mt-0.5">{e.description}</p>
                  </div>
                  <p className="text-xs text-slate-400 shrink-0 font-mono font-medium">{format(new Date(e.created_at), 'MM/dd HH:mm')}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Filter */}
        <div className="card p-4 flex items-center gap-3">
          <Filter className="h-4 w-4 text-slate-400" />
          <select className="input w-36 h-[44px]" value={severity}
            onChange={e => { setSeverity(e.target.value); setPage(1) }}>
            <option value="">All Severity</option>
            <option value="LOW">LOW</option>
            <option value="MEDIUM">MEDIUM</option>
            <option value="HIGH">HIGH</option>
            <option value="CRITICAL">CRITICAL</option>
          </select>
        </div>

        {loading ? <PageLoader /> : (
          <div className="card overflow-hidden">
            {(!data || data.items.length === 0) ? (
              <p className="p-8 text-center text-slate-400 font-bold">No security events found.</p>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="table-header">
                      <tr>
                        {['Time', 'Event Type', 'Severity', 'User', 'IP', 'Description', 'Status'].map(h => (
                          <th key={h} className="px-4 py-3 text-left font-bold text-slate-300 text-xs uppercase tracking-wider">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#EAECF0]">
                      {data.items.map(e => (
                        <tr key={e.id} className="table-row">
                          <td className="table-cell text-slate-400 whitespace-nowrap font-mono">
                            {format(new Date(e.created_at), 'MM/dd HH:mm:ss')}
                          </td>
                          <td className="table-cell font-mono font-bold text-slate-100">{e.event_type}</td>
                          <td className="table-cell"><StatusBadge value={e.severity} type="severity" /></td>
                          <td className="table-cell text-slate-200 font-semibold">{e.username ?? '—'}</td>
                          <td className="table-cell text-slate-400 font-mono font-medium">{e.ip_address ?? '—'}</td>
                          <td className="table-cell text-slate-200 max-w-[200px] truncate">{e.description}</td>
                          <td className="table-cell font-semibold">
                            {e.resolved ? (
                              <span className="text-emerald-700 flex items-center gap-1">
                                <ShieldCheck className="h-3.5 w-3.5" /> Resolved
                              </span>
                            ) : (
                              <button onClick={() => handleResolve(e.id)}
                                className="text-xs font-bold text-[#4338CA] hover:underline">
                                Resolve
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="px-4 py-2 border-t border-[#EAECF0]">
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
