import { useEffect, useState, useCallback } from 'react'
import {
  Lightbulb, RefreshCw, Sparkles, Filter, Check,
  X, MessageSquare, User, TrendingUp, AlertTriangle, GitBranch,
} from 'lucide-react'
import { leadsApi, type Lead } from '../../api/leads'
import { casesApi } from '../../api/cases'
import { PageLoader } from '../../components/shared/LoadingSpinner'
import { ErrorAlert, SuccessAlert } from '../../components/shared/ErrorAlert'
import { StatusBadge } from '../../components/shared/StatusBadge'
import { Pagination } from '../../components/shared/Pagination'
import { getErrorMessage } from '../../api/client'
import type { Case } from '../../types'

const LEAD_TYPE_ICONS: Record<string, React.ReactNode> = {
  BRIDGE_NODE:     <GitBranch className="h-4 w-4 text-amber-400" />,
  HIGH_DEGREE_NODE: <TrendingUp className="h-4 w-4 text-orange-400" />,
  COMMUNITY_BRIDGE: <AlertTriangle className="h-4 w-4 text-red-400" />,
  MANUAL:           <User className="h-4 w-4 text-blue-400" />,
}

function LeadCard({ lead, onUpdate }: { lead: Lead; onUpdate: () => void }) {
  const [updating, setUpdating] = useState(false)
  const [showNotes, setShowNotes] = useState(false)
  const [noteText, setNoteText] = useState(lead.notes || '')
  const confPct = Math.round(lead.confidence * 100)
  const barColor = lead.severity === 'CRITICAL' || lead.severity === 'HIGH'
    ? 'bg-red-500' : lead.severity === 'MEDIUM' ? 'bg-amber-500' : 'bg-blue-500'

  const handleStatus = async (status: string) => {
    setUpdating(true)
    try {
      await leadsApi.update(lead.id, { status })
      onUpdate()
    } catch { /* handled in parent */ }
    finally { setUpdating(false) }
  }

  const handleSaveNote = async () => {
    setUpdating(true)
    try {
      await leadsApi.update(lead.id, { notes: noteText })
      setShowNotes(false); onUpdate()
    } catch { /* ignore */ }
    finally { setUpdating(false) }
  }

  const icon = LEAD_TYPE_ICONS[lead.lead_type] || <Lightbulb className="h-4 w-4 text-indigo-400" />
  const supporting = lead.supporting_data

  return (
    <div className="card p-5 space-y-4 hover:border-slate-700 transition-colors">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="mt-0.5">{icon}</div>
          <div>
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <StatusBadge value={lead.severity} type="severity" />
              <StatusBadge value={lead.status} />
              {lead.auto_generated && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-violet-900/30 text-violet-400 border border-violet-700/30">
                  Auto-detected
                </span>
              )}
            </div>
            <h3 className="font-semibold text-slate-100 text-sm leading-tight">{lead.title}</h3>
            {lead.subject_name && (
              <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
                <User className="h-3 w-3" /> {lead.subject_name}
              </p>
            )}
          </div>
        </div>
        <div className="text-right shrink-0">
          <p className="text-xl font-bold text-slate-200">{confPct}%</p>
          <p className="text-[10px] text-slate-600">confidence</p>
        </div>
      </div>

      {/* Confidence bar */}
      <div className="h-1.5 w-full bg-slate-800 rounded-full">
        <div className={`h-1.5 rounded-full ${barColor} transition-all`} style={{ width: `${confPct}%` }} />
      </div>

      {/* Description */}
      <p className="text-sm text-slate-400 leading-relaxed">{lead.description}</p>

      {/* Supporting data */}
      {supporting && (
        <div className="rounded-lg bg-slate-800/50 border border-slate-800 p-3 text-xs">
          <p className="font-semibold text-slate-500 mb-2 uppercase tracking-wider">Supporting Data</p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1">
            {Object.entries(supporting)
              .filter(([k]) => !['explanation', 'anomaly_type'].includes(k))
              .map(([k, v]) => (
                <div key={k} className="flex justify-between">
                  <span className="text-slate-600">{k.replace(/_/g, ' ')}</span>
                  <span className="text-slate-300 font-mono">{String(v)}</span>
                </div>
              ))}
          </div>
          {supporting.explanation !== undefined && (
            <p className="mt-2 text-slate-400 italic">{String(supporting.explanation)}</p>
          )}
        </div>
      )}

      {/* Notes */}
      {lead.notes && !showNotes && (
        <div className="rounded-lg bg-blue-900/10 border border-blue-800/20 p-3">
          <p className="text-xs text-slate-500 mb-1">Notes:</p>
          <p className="text-xs text-slate-400">{lead.notes}</p>
        </div>
      )}

      {showNotes && (
        <div className="space-y-2">
          <textarea
            value={noteText}
            onChange={e => setNoteText(e.target.value)}
            className="input text-xs min-h-[60px] resize-none"
            placeholder="Add investigative notes…"
          />
          <div className="flex gap-2">
            <button onClick={handleSaveNote} disabled={updating} className="btn-primary text-xs py-1.5">
              Save Note
            </button>
            <button onClick={() => setShowNotes(false)} className="btn-secondary text-xs py-1.5">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Actions */}
      {lead.status === 'OPEN' && (
        <div className="flex gap-2 flex-wrap pt-1 border-t border-slate-800">
          <button onClick={() => handleStatus('REVIEWED')} disabled={updating}
            className="btn-secondary text-xs py-1.5 flex-1">
            <Check className="h-3.5 w-3.5" /> Review
          </button>
          <button onClick={() => handleStatus('ASSIGNED')} disabled={updating}
            className="btn-secondary text-xs py-1.5 flex-1">
            <User className="h-3.5 w-3.5" /> Assign
          </button>
          <button onClick={() => setShowNotes(v => !v)}
            className="btn-ghost text-xs py-1.5">
            <MessageSquare className="h-3.5 w-3.5" />
          </button>
          <button onClick={() => handleStatus('DISMISSED')} disabled={updating}
            className="btn-ghost text-xs py-1.5 text-slate-600">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
      {lead.status !== 'OPEN' && (
        <div className="flex gap-2 pt-1 border-t border-slate-800">
          <button onClick={() => handleStatus('OPEN')} disabled={updating}
            className="btn-ghost text-xs py-1.5">
            Re-open
          </button>
          <button onClick={() => setShowNotes(v => !v)} className="btn-ghost text-xs py-1.5">
            <MessageSquare className="h-3.5 w-3.5" /> Note
          </button>
        </div>
      )}

      <p className="text-[10px] text-slate-700 italic">
        Source: {lead.source_module || 'manual'} · {new Date(lead.created_at).toLocaleDateString()}
      </p>
    </div>
  )
}

export function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [stats, setStats] = useState<Record<string, unknown> | null>(null)
  const [cases, setCases] = useState<Case[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [severityFilter, setSeverityFilter] = useState('')
  const [caseFilter, setCaseFilter] = useState('')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [pages, setPages] = useState(1)
  const SIZE = 12

  const load = useCallback(async (p = 1) => {
    setLoading(true)
    try {
      const [leadsData, statsData] = await Promise.all([
        leadsApi.list({
          page: p, size: SIZE,
          status: statusFilter || undefined,
          severity: severityFilter || undefined,
          case_id: caseFilter || undefined,
        }),
        leadsApi.getStats(),
      ])
      setLeads(leadsData.items || [])
      setTotal(leadsData.total || 0)
      setPages(leadsData.pages || 1)
      setStats(statsData)
      setPage(p)
    } catch (e) { setError(getErrorMessage(e)) }
    finally { setLoading(false) }
  }, [statusFilter, severityFilter, caseFilter])

  useEffect(() => {
    Promise.all([load(1), casesApi.list({ size: 50 })
      .then(r => setCases(r.items))
      .catch(() => {})])
  }, [statusFilter, severityFilter, caseFilter])

  const handleGenerate = async () => {
    setGenerating(true); setError('')
    try {
      const result = await leadsApi.generateFromNetwork(caseFilter || undefined)
      const count = (result as Record<string, unknown>).leads_created as number || 0
      setSuccess(`${count} new lead${count !== 1 ? 's' : ''} generated from network analysis`)
      load(1)
    } catch (e) { setError(getErrorMessage(e)) }
    finally { setGenerating(false) }
  }

  return (
    <div className="animate-fade-in">
      <div className="page-header flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-slate-100 flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-amber-400" /> Investigative Leads
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">AI-detected patterns and investigative priorities</p>
        </div>
        <div className="flex gap-2">
          <button onClick={handleGenerate} disabled={generating} className="btn-primary text-xs py-1.5">
            {generating
              ? <><RefreshCw className="h-3.5 w-3.5 animate-spin" /> Generating…</>
              : <><Sparkles className="h-3.5 w-3.5" /> Generate from Network</>}
          </button>
          <button onClick={() => load(1)} className="btn-secondary text-xs py-1.5">
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="page-content space-y-5">
        <div className="rounded-lg border border-amber-800/30 bg-amber-900/10 px-4 py-3">
          <p className="text-xs font-semibold text-amber-400">⚠ INVESTIGATIVE AIDS — NOT DETERMINATIONS OF GUILT</p>
          <p className="text-xs text-amber-500/70 mt-0.5">
            Every lead must be reviewed by an authorized investigator. Algorithmic signals require human
            corroboration and verification before any investigative action.
          </p>
        </div>

        {error && <ErrorAlert message={error} onClose={() => setError('')} />}
        {success && <SuccessAlert message={success} onClose={() => setSuccess('')} />}

        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-3 lg:grid-cols-6 gap-3">
            {[
              { label: 'Total Leads', value: stats.total, color: 'text-slate-200' },
              { label: 'Open', value: stats.open, color: 'text-indigo-400' },
              { label: 'Reviewed', value: stats.reviewed, color: 'text-blue-400' },
              { label: 'Critical', value: stats.critical, color: 'text-red-400' },
              { label: 'High', value: stats.high, color: 'text-orange-400' },
              { label: 'Auto-detected', value: stats.auto_generated, color: 'text-violet-400' },
            ].map(({ label, value, color }) => (
              <div key={label} className="card p-3 text-center">
                <p className={`text-xl font-bold ${color}`}>{String(value ?? 0)}</p>
                <p className="text-xs text-slate-500 mt-0.5">{label}</p>
              </div>
            ))}
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-wrap gap-2 items-center">
          <Filter className="h-4 w-4 text-slate-600" />
          <select className="input text-xs py-1.5 w-32" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="">All Status</option>
            <option value="OPEN">Open</option>
            <option value="REVIEWED">Reviewed</option>
            <option value="ASSIGNED">Assigned</option>
            <option value="DISMISSED">Dismissed</option>
            <option value="ACTIONED">Actioned</option>
          </select>
          <select className="input text-xs py-1.5 w-32" value={severityFilter} onChange={e => setSeverityFilter(e.target.value)}>
            <option value="">All Severity</option>
            <option value="CRITICAL">Critical</option>
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
            <option value="LOW">Low</option>
          </select>
          <select className="input text-xs py-1.5 w-48" value={caseFilter} onChange={e => setCaseFilter(e.target.value)}>
            <option value="">All Cases</option>
            {cases.map(c => <option key={c.id} value={c.id}>{c.case_number}</option>)}
          </select>
        </div>

        {loading && <PageLoader />}

        {!loading && leads.length === 0 && (
          <div className="card p-12 text-center text-slate-600">
            <Lightbulb className="h-12 w-12 mx-auto mb-3 opacity-20" />
            <p>No investigative leads found.</p>
            <p className="text-xs mt-1">Click "Generate from Network" to auto-detect patterns.</p>
          </div>
        )}

        {!loading && leads.length > 0 && (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
              {leads.map(lead => (
                <LeadCard key={lead.id} lead={lead} onUpdate={() => load(page)} />
              ))}
            </div>
            <Pagination page={page} pages={pages} total={total} size={SIZE} onChange={p => load(p)} />
          </>
        )}
      </div>
    </div>
  )
}
