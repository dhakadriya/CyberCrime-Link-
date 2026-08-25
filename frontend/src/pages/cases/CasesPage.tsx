import { useEffect, useState, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  Plus, Search, FolderOpen, Zap, ClipboardList,
  Upload, ChevronDown, X, FileText, TrendingUp,
  Clock, CheckCircle2, AlertTriangle,
} from 'lucide-react'
import { casesApi } from '../../api/cases'
import { StatusBadge } from '../../components/shared/StatusBadge'
import { Pagination } from '../../components/shared/Pagination'
import { PageLoader } from '../../components/shared/LoadingSpinner'
import { ErrorAlert } from '../../components/shared/ErrorAlert'
import { getErrorMessage } from '../../api/client'
import { useAuth } from '../../context/AuthContext'
import type { Case, PaginatedResponse } from '../../types'
import { formatDistanceToNow } from 'date-fns'

const STATUSES = ['', 'DRAFT', 'OPEN', 'UNDER_INVESTIGATION', 'ON_HOLD', 'SOLVED', 'CLOSED', 'ARCHIVED']
const PRIORITIES = ['', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL']
const TYPES = ['', 'ROBBERY', 'BURGLARY', 'FRAUD', 'ASSAULT', 'MURDER', 'KIDNAPPING', 'CYBERCRIME', 'DRUG_TRAFFICKING', 'OTHER']

interface CaseStats {
  total: number; open: number; underInvestigation: number;
  highPriority: number; closed: number; draft: number;
}

function StatPill({ label, value, icon, iconColor }: { label: string; value: number; icon: React.ReactNode; iconColor: string }) {
  return (
    <div className="bg-white border border-[#D9E0EA] rounded-xl p-3 flex items-center gap-3 shadow-sm min-w-[120px] flex-1">
      <div className={`p-2 rounded-lg ${iconColor} shrink-0`}>
        {icon}
      </div>
      <div>
        <p className="text-xl font-bold text-[#172033] font-mono leading-none">{value}</p>
        <p className="text-[10px] font-bold text-[#475467] uppercase tracking-wider mt-1">{label}</p>
      </div>
    </div>
  )
}

// ── New Case Menu ─────────────────────────────────────────────────────────────
function NewCaseMenu({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate()
  const options = [
    {
      icon: <Zap className="h-6 w-6 text-amber-600" />,
      title: 'Quick Case',
      desc: 'Create a case in under one minute. Fill in minimum details and add more later.',
      action: () => { onClose(); navigate('/cases/new?mode=quick') },
      bg: 'bg-amber-50 border-amber-200 hover:bg-amber-100/50',
    },
    {
      icon: <ClipboardList className="h-6 w-6 text-indigo-600" />,
      title: 'Detailed Case Wizard',
      desc: 'Enter complete investigation data step-by-step: persons, evidence, relationships and events.',
      action: () => { onClose(); navigate('/cases/new?mode=wizard') },
      bg: 'bg-indigo-50 border-indigo-200 hover:bg-indigo-100/50',
    },
    {
      icon: <Upload className="h-6 w-6 text-emerald-600" />,
      title: 'Import Cases',
      desc: 'Upload multiple cases at once using an Excel (.xlsx) or CSV file.',
      action: () => { onClose(); navigate('/cases/import') },
      bg: 'bg-emerald-50 border-emerald-200 hover:bg-emerald-100/50',
    },
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-24 bg-black/40"
         onClick={onClose}>
      <div className="w-full max-w-md bg-white border border-[#D9E0EA] rounded-2xl shadow-2xl p-6"
           onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-slate-100">Create New Case</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-200">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="space-y-3">
          {options.map(opt => (
            <button
              key={opt.title}
              onClick={opt.action}
              className={`w-full text-left rounded-xl border p-4 transition-colors ${opt.bg}`}
            >
              <div className="flex items-start gap-3">
                <div className="mt-0.5">{opt.icon}</div>
                <div>
                  <p className="font-bold text-slate-100">{opt.title}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{opt.desc}</p>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

export function CasesPage() {
  const [data, setData] = useState<PaginatedResponse<Case> | null>(null)
  const [stats, setStats] = useState<CaseStats>({ total: 0, open: 0, underInvestigation: 0, highPriority: 0, closed: 0, draft: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [searchParams] = useSearchParams()
  const [search, setSearch] = useState(searchParams.get('search') || '')
  const [status, setStatus] = useState(searchParams.get('status') || '')
  const [priority, setPriority] = useState(searchParams.get('priority') || '')
  const [caseType, setCaseType] = useState(searchParams.get('case_type') || '')
  const [page, setPage] = useState(1)
  const [showNewMenu, setShowNewMenu] = useState(false)
  const navigate = useNavigate()
  const { hasPermission } = useAuth()

  const loadStats = async () => {
    try {
      // Fetch from dashboard stats endpoint which queries real DB
      const [all, openR, activeR, highR, closedR, draftR] = await Promise.all([
        casesApi.list({ size: 1 }),
        casesApi.list({ size: 1, status: 'OPEN' }),
        casesApi.list({ size: 1, status: 'UNDER_INVESTIGATION' }),
        casesApi.list({ size: 1, priority: 'HIGH' }),
        casesApi.list({ size: 1, status: 'CLOSED' }),
        casesApi.list({ size: 1, status: 'DRAFT' }),
      ])
      setStats({
        total: all.total,
        open: openR.total,
        underInvestigation: activeR.total,
        highPriority: highR.total,
        closed: closedR.total,
        draft: draftR.total,
      })
    } catch { /* stats are secondary */ }
  }

  const load = async (p = 1) => {
    setLoading(true); setError('')
    try {
      const res = await casesApi.list({
        page: p, size: 20,
        search: search || undefined,
        status: status || undefined,
        priority: priority || undefined,
        case_type: caseType || undefined,
      })
      setData(res)
    } catch (e) { setError(getErrorMessage(e)) }
    finally { setLoading(false) }
  }

  useEffect(() => { load(1); loadStats() }, [status, priority, caseType])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault(); setPage(1); load(1)
  }

  return (
    <div>
      {/* New Case Menu overlay */}
      {showNewMenu && <NewCaseMenu onClose={() => setShowNewMenu(false)} />}

      {/* Header */}
      <div className="page-header border-b border-slate-700 bg-slate-900 px-6 py-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-100">Investigation Cases</h1>
            <p className="text-xs text-slate-400 mt-1">Manage and track all investigation cases</p>
          </div>
          {hasPermission('CASE_CREATE') && (
            <div className="flex gap-2 shrink-0">
              <button
                onClick={() => navigate('/cases/import')}
                className="btn-secondary gap-1.5 h-[44px] text-xs"
              >
                <Upload className="h-4 w-4 text-slate-300" /> Import Cases
              </button>
              <button
                onClick={() => setShowNewMenu(true)}
                className="btn-primary gap-1.5 h-[44px]"
              >
                <Plus className="h-4 w-4 text-white" /> New Case
                <ChevronDown className="h-4 w-4 opacity-70 text-white" />
              </button>
            </div>
          )}
        </div>

        {/* Stats Bar — real data from API */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <StatPill label="Total" value={stats.total} icon={<FolderOpen className="h-4 w-4 text-[#4F46E5]" />} iconColor="bg-[#4F46E5]/10" />
          <StatPill label="Open" value={stats.open} icon={<Clock className="h-4 w-4 text-[#2563EB]" />} iconColor="bg-[#2563EB]/10" />
          <StatPill label="Active" value={stats.underInvestigation} icon={<TrendingUp className="h-4 w-4 text-[#D97706]" />} iconColor="bg-[#D97706]/10" />
          <StatPill label="High Priority" value={stats.highPriority} icon={<AlertTriangle className="h-4 w-4 text-[#DC2626]" />} iconColor="bg-[#DC2626]/10" />
          <StatPill label="Closed" value={stats.closed} icon={<CheckCircle2 className="h-4 w-4 text-[#16A34A]" />} iconColor="bg-[#16A34A]/10" />
          <StatPill label="Drafts" value={stats.draft} icon={<FileText className="h-4 w-4 text-[#475467]" />} iconColor="bg-[#475467]/10" />
        </div>
      </div>

      <div className="page-content space-y-4">
        {/* Filters */}
        <div className="card p-4 flex flex-wrap gap-3">
          <form onSubmit={handleSearch} className="flex gap-2 flex-1 min-w-[280px]">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                className="input pl-9 h-[44px]"
                placeholder="Search by title, case number…"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <button type="submit" className="btn-primary px-4 h-[44px]"><Search className="h-4 w-4 text-white" /></button>
          </form>
          <select className="input w-44 h-[44px]" value={status} onChange={e => { setStatus(e.target.value); setPage(1) }}>
            <option value="">All Status</option>
            {STATUSES.slice(1).map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
          </select>
          <select className="input w-36 h-[44px]" value={priority} onChange={e => { setPriority(e.target.value); setPage(1) }}>
            <option value="">All Priority</option>
            {PRIORITIES.slice(1).map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          <select className="input w-44 h-[44px]" value={caseType} onChange={e => { setCaseType(e.target.value); setPage(1) }}>
            <option value="">All Types</option>
            {TYPES.slice(1).map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
          </select>
        </div>

        {error && <ErrorAlert message={error} onClose={() => setError('')} />}

        {loading ? <PageLoader /> : (
          <>
            {(!data || data.items.length === 0) ? (
              <div className="card p-12 text-center">
                <FolderOpen className="h-12 w-12 text-slate-400 mx-auto mb-3" />
                <p className="text-slate-200 font-bold">No cases found</p>
                <p className="text-slate-400 text-sm mt-1">
                  {search || status || priority || caseType
                    ? 'Try adjusting your filters'
                    : 'Create your first investigation case'}
                </p>
                {hasPermission('CASE_CREATE') && !search && !status && (
                  <button onClick={() => setShowNewMenu(true)} className="btn-primary mt-4">
                    <Plus className="h-4 w-4 text-white" /> Create Case
                  </button>
                )}
              </div>
            ) : (
              <div className="card overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="table-header">
                    <tr>
                      <th className="px-4 py-3 text-left font-bold text-slate-300 text-xs uppercase tracking-wider">Case</th>
                      <th className="px-4 py-3 text-left font-bold text-slate-300 text-xs uppercase tracking-wider">Title</th>
                      <th className="px-4 py-3 text-left font-bold text-slate-300 text-xs uppercase tracking-wider">Type</th>
                      <th className="px-4 py-3 text-left font-bold text-slate-300 text-xs uppercase tracking-wider">Status</th>
                      <th className="px-4 py-3 text-left font-bold text-slate-300 text-xs uppercase tracking-wider">Priority</th>
                      <th className="px-4 py-3 text-left font-bold text-slate-300 text-xs uppercase tracking-wider">Persons / Evidence</th>
                      <th className="px-4 py-3 text-left font-bold text-slate-300 text-xs uppercase tracking-wider">Created</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#EAECF0]">
                    {data.items.map(c => (
                      <tr
                        key={c.id}
                        onClick={() => navigate(`/cases/${c.id}`)}
                        className="table-row cursor-pointer"
                      >
                        <td className="table-cell">
                          <span className="font-mono text-xs font-bold text-[#4338CA]">{c.case_number}</span>
                          {c.status === 'DRAFT' && (
                            <span className="ml-2 text-xs bg-[#F2F4F7] text-[#344054] border border-[#D0D5DD] px-1.5 py-0.5 rounded-full font-semibold">DRAFT</span>
                          )}
                        </td>
                        <td className="table-cell font-bold text-slate-100 max-w-[240px] truncate">{c.title}</td>
                        <td className="table-cell text-slate-300 text-xs">{c.case_type.replace(/_/g, ' ')}</td>
                        <td className="table-cell"><StatusBadge value={c.status} /></td>
                        <td className="table-cell"><StatusBadge value={c.priority} type="priority" /></td>
                        <td className="table-cell text-slate-300 text-xs font-medium">
                          {c.persons_count}P · {c.evidence_count}E
                        </td>
                        <td className="table-cell text-slate-400 text-xs">
                          {formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="px-4 py-2 border-t border-[#EAECF0]">
                  <Pagination
                    page={data.page} pages={data.pages} total={data.total} size={data.size}
                    onChange={p => { setPage(p); load(p) }}
                  />
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
