import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
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

function StatPill({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className={`flex items-center gap-2 px-4 py-2 rounded-lg border ${color}`}>
      <span className="text-xl font-bold">{value}</span>
      <span className="text-xs font-medium opacity-80">{label}</span>
    </div>
  )
}

// ── New Case Menu ─────────────────────────────────────────────────────────────
function NewCaseMenu({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate()
  const options = [
    {
      icon: <Zap className="h-6 w-6 text-amber-500" />,
      title: 'Quick Case',
      desc: 'Create a case in under one minute. Fill in minimum details and add more later.',
      action: () => { onClose(); navigate('/cases/new?mode=quick') },
      bg: 'bg-amber-50 border-amber-200 hover:bg-amber-100',
    },
    {
      icon: <ClipboardList className="h-6 w-6 text-primary-600" />,
      title: 'Detailed Case Wizard',
      desc: 'Enter complete investigation data step-by-step: persons, evidence, relationships and events.',
      action: () => { onClose(); navigate('/cases/new?mode=wizard') },
      bg: 'bg-primary-50 border-primary-200 hover:bg-primary-100',
    },
    {
      icon: <Upload className="h-6 w-6 text-emerald-600" />,
      title: 'Import Cases',
      desc: 'Upload multiple cases at once using an Excel (.xlsx) or CSV file.',
      action: () => { onClose(); navigate('/cases/import') },
      bg: 'bg-emerald-50 border-emerald-200 hover:bg-emerald-100',
    },
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-24 bg-black/40"
         onClick={onClose}>
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-6"
           onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-slate-800">Create New Case</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
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
                  <p className="font-semibold text-slate-800">{opt.title}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{opt.desc}</p>
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
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [priority, setPriority] = useState('')
  const [caseType, setCaseType] = useState('')
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
      <div className="page-header">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-bold text-slate-800">Investigation Cases</h1>
            <p className="text-sm text-slate-500 mt-0.5">Manage and track all investigation cases</p>
          </div>
          {hasPermission('CASE_CREATE') && (
            <div className="flex gap-2">
              <button
                onClick={() => navigate('/cases/import')}
                className="btn-secondary gap-1.5 text-xs"
              >
                <Upload className="h-3.5 w-3.5" /> Import Cases
              </button>
              <button
                onClick={() => setShowNewMenu(true)}
                className="btn-primary gap-1.5"
              >
                <Plus className="h-4 w-4" /> New Case
                <ChevronDown className="h-3.5 w-3.5 opacity-70" />
              </button>
            </div>
          )}
        </div>

        {/* Stats Bar — real data from API */}
        <div className="flex flex-wrap gap-2">
          <StatPill label="Total" value={stats.total} color="bg-slate-50 border-slate-200 text-slate-700" />
          <StatPill label="Open" value={stats.open} color="bg-blue-50 border-blue-200 text-blue-700" />
          <StatPill label="Active" value={stats.underInvestigation} color="bg-amber-50 border-amber-200 text-amber-700" />
          <StatPill label="High Priority" value={stats.highPriority} color="bg-orange-50 border-orange-200 text-orange-700" />
          <StatPill label="Closed" value={stats.closed} color="bg-slate-50 border-slate-200 text-slate-500" />
          <StatPill label="Drafts" value={stats.draft} color="bg-purple-50 border-purple-200 text-purple-700" />
        </div>
      </div>

      <div className="page-content space-y-4">
        {/* Filters */}
        <div className="card p-4 flex flex-wrap gap-3">
          <form onSubmit={handleSearch} className="flex gap-2 flex-1 min-w-[200px]">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                className="input pl-9"
                placeholder="Search by title, case number…"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <button type="submit" className="btn-secondary px-3"><Search className="h-4 w-4" /></button>
          </form>
          <select className="input w-44" value={status} onChange={e => { setStatus(e.target.value); setPage(1) }}>
            <option value="">All Status</option>
            {STATUSES.slice(1).map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
          </select>
          <select className="input w-36" value={priority} onChange={e => { setPriority(e.target.value); setPage(1) }}>
            <option value="">All Priority</option>
            {PRIORITIES.slice(1).map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          <select className="input w-44" value={caseType} onChange={e => { setCaseType(e.target.value); setPage(1) }}>
            <option value="">All Types</option>
            {TYPES.slice(1).map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
          </select>
        </div>

        {error && <ErrorAlert message={error} onClose={() => setError('')} />}

        {loading ? <PageLoader /> : (
          <>
            {(!data || data.items.length === 0) ? (
              <div className="card p-12 text-center">
                <FolderOpen className="h-12 w-12 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-600 font-medium">No cases found</p>
                <p className="text-slate-400 text-sm mt-1">
                  {search || status || priority || caseType
                    ? 'Try adjusting your filters'
                    : 'Create your first investigation case'}
                </p>
                {hasPermission('CASE_CREATE') && !search && !status && (
                  <button onClick={() => setShowNewMenu(true)} className="btn-primary mt-4">
                    <Plus className="h-4 w-4" /> Create Case
                  </button>
                )}
              </div>
            ) : (
              <div className="card overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="border-b border-slate-100 bg-slate-50">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium text-slate-600">Case</th>
                      <th className="px-4 py-3 text-left font-medium text-slate-600">Title</th>
                      <th className="px-4 py-3 text-left font-medium text-slate-600">Type</th>
                      <th className="px-4 py-3 text-left font-medium text-slate-600">Status</th>
                      <th className="px-4 py-3 text-left font-medium text-slate-600">Priority</th>
                      <th className="px-4 py-3 text-left font-medium text-slate-600">Persons / Evidence</th>
                      <th className="px-4 py-3 text-left font-medium text-slate-600">Created</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {data.items.map(c => (
                      <tr
                        key={c.id}
                        onClick={() => navigate(`/cases/${c.id}`)}
                        className="hover:bg-slate-50 cursor-pointer transition-colors"
                      >
                        <td className="px-4 py-3">
                          <span className="font-mono text-xs font-bold text-primary-600">{c.case_number}</span>
                          {c.status === 'DRAFT' && (
                            <span className="ml-2 text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded">DRAFT</span>
                          )}
                        </td>
                        <td className="px-4 py-3 font-medium text-slate-800 max-w-[240px] truncate">{c.title}</td>
                        <td className="px-4 py-3 text-slate-500 text-xs">{c.case_type.replace(/_/g, ' ')}</td>
                        <td className="px-4 py-3"><StatusBadge value={c.status} /></td>
                        <td className="px-4 py-3"><StatusBadge value={c.priority} type="priority" /></td>
                        <td className="px-4 py-3 text-slate-500 text-xs">
                          {c.persons_count}P · {c.evidence_count}E
                        </td>
                        <td className="px-4 py-3 text-slate-400 text-xs">
                          {formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="px-4">
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
