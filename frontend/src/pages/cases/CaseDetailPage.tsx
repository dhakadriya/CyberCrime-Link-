import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { ArrowLeft, Edit2, UserPlus, Upload, Play, FileText } from 'lucide-react'
import { casesApi } from '../../api/cases'
import { evidenceApi } from '../../api/evidence'
import { personsApi } from '../../api/persons'
import { StatusBadge } from '../../components/shared/StatusBadge'
import { PageLoader } from '../../components/shared/LoadingSpinner'
import { ErrorAlert } from '../../components/shared/ErrorAlert'
import { CaseCompletionWidget } from '../../components/shared/CaseCompletion'
import { BulkEvidenceUpload } from '../../components/shared/BulkEvidenceUpload'
import { getErrorMessage } from '../../api/client'
import { useAuth } from '../../context/AuthContext'
import type { Case, Evidence, CasePersonResponse, InvestigationEvent, PrioritizationResult, Person } from '../../types'
import { formatDistanceToNow, format } from 'date-fns'

type Tab = 'overview' | 'persons' | 'evidence' | 'timeline' | 'prioritization' | 'audit'

const EVENT_COLORS: Record<string, string> = {
  CASE_CREATED: 'bg-blue-500',
  EVIDENCE_UPLOADED: 'bg-purple-500',
  PERSON_ADDED: 'bg-amber-500',
  STATUS_CHANGED: 'bg-green-500',
  OFFICER_ASSIGNED: 'bg-indigo-500',
  WITNESS_INTERVIEWED: 'bg-teal-500',
  EVIDENCE_TRANSFERRED: 'bg-orange-500',
  DEFAULT: 'bg-slate-400',
}

export function CaseDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { hasPermission } = useAuth()

  const [caseData, setCaseData] = useState<Case | null>(null)
  const [tab, setTab] = useState<Tab>('overview')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [completionRefresh, setCompletionRefresh] = useState(0)

  // Tab data
  const [persons, setPersons] = useState<CasePersonResponse[]>([])
  const [evidence, setEvidence] = useState<Evidence[]>([])
  const [timeline, setTimeline] = useState<InvestigationEvent[]>([])
  const [scores, setScores] = useState<PrioritizationResult | null>(null)
  const [prioritizing, setPrioritizing] = useState(false)

  // Status change
  const [editStatus, setEditStatus] = useState(false)
  const [newStatus, setNewStatus] = useState('')

  // Add person to case
  const [allPersons, setAllPersons] = useState<Person[]>([])
  const [selectedPerson, setSelectedPerson] = useState('')
  const [selectedRole, setSelectedRole] = useState('SUSPECT')
  const [addingPerson, setAddingPerson] = useState(false)

  // Evidence upload
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploadDesc, setUploadDesc] = useState('')
  const [uploading, setUploading] = useState(false)

  const loadCase = useCallback(async () => {
    if (!id) return
    try {
      const c = await casesApi.get(id)
      setCaseData(c)
      setNewStatus(c.status)
    } catch (e) {
      setError(getErrorMessage(e))
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { loadCase() }, [loadCase])

  const loadTab = useCallback(async (t: Tab) => {
    if (!id) return
    try {
      if (t === 'persons') {
        const p = await casesApi.getPersons(id)
        setPersons(Array.isArray(p) ? p : [])
        const all = await personsApi.list({ size: 100 })
        setAllPersons(all.items)
      }
      if (t === 'evidence') {
        const e = await evidenceApi.list({ case_id: id })
        setEvidence(e.items)
      }
      if (t === 'timeline') {
        const tl = await casesApi.getTimeline(id)
        setTimeline(tl.events)
      }
      if (t === 'prioritization') {
        const sc = await casesApi.getScores(id)
        setScores(sc)
      }
    } catch (e) {
      setError(getErrorMessage(e))
    }
  }, [id])

  useEffect(() => { loadTab(tab) }, [tab, loadTab])

  const handleStatusChange = async () => {
    if (!id || !newStatus) return
    try {
      await casesApi.updateStatus(id, newStatus)
      setEditStatus(false)
      loadCase()
    } catch (e) { setError(getErrorMessage(e)) }
  }

  const handleAddPerson = async () => {
    if (!id || !selectedPerson) return
    setAddingPerson(true)
    try {
      await casesApi.addPerson(id, selectedPerson, selectedRole)
      loadTab('persons')
      setSelectedPerson('')
    } catch (e) { setError(getErrorMessage(e)) }
    finally { setAddingPerson(false) }
  }

  const handleUpload = async () => {
    if (!id || !uploadFile) return
    setUploading(true)
    try {
      await evidenceApi.upload(id, uploadFile, uploadDesc || undefined)
      setUploadFile(null); setUploadDesc('')
      loadTab('evidence')
      loadCase()
      setCompletionRefresh(r => r + 1)
    } catch (e) { setError(getErrorMessage(e)) }
    finally { setUploading(false) }
  }

  const handlePrioritize = async () => {
    if (!id) return
    setPrioritizing(true)
    try {
      const result = await casesApi.prioritize(id)
      setScores(result)
    } catch (e) { setError(getErrorMessage(e)) }
    finally { setPrioritizing(false) }
  }

  const handleReport = async () => {
    if (!id) return
    try {
      const report = await casesApi.generateReport(id)
      const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `report_${caseData?.case_number}.json`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) { setError(getErrorMessage(e)) }
  }

  if (loading) return <PageLoader />
  if (!caseData) return <div className="p-8 text-slate-500">Case not found.</div>

  const tabs: { key: Tab; label: string }[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'persons', label: `Persons (${caseData.persons_count})` },
    { key: 'evidence', label: `Evidence (${caseData.evidence_count})` },
    { key: 'timeline', label: 'Timeline' },
    { key: 'prioritization', label: 'Prioritization' },
    { key: 'audit', label: 'Audit' },
  ]

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div className="flex items-center gap-3 mb-3">
          <button onClick={() => navigate('/cases')} className="btn-secondary p-2"><ArrowLeft className="h-4 w-4" /></button>
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-sm font-bold text-primary-600">{caseData.case_number}</span>
              <StatusBadge value={caseData.status} />
              <StatusBadge value={caseData.priority} type="priority" />
            </div>
            <h1 className="text-xl font-bold text-slate-800 mt-0.5">{caseData.title}</h1>
          </div>
          <div className="flex gap-2">
            {hasPermission('REPORT_GENERATE') && (
              <button onClick={handleReport} className="btn-secondary gap-1.5 text-xs">
                <FileText className="h-3.5 w-3.5" /> Report
              </button>
            )}
          </div>
        </div>

        {/* Tab bar */}
        <div className="flex gap-1 -mb-4">
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                tab === t.key
                  ? 'border-primary-600 text-primary-700'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="page-content space-y-4">
        {error && <ErrorAlert message={error} onClose={() => setError('')} />}

        {/* OVERVIEW TAB */}
        {tab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <div className="lg:col-span-2 space-y-4">
              <div className="card p-5">
                <h3 className="font-semibold text-slate-700 mb-3">Case Details</h3>
                <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                  <div><dt className="text-slate-400">Case Type</dt><dd className="font-medium text-slate-700">{caseData.case_type}</dd></div>
                  <div><dt className="text-slate-400">Location</dt><dd className="font-medium text-slate-700">{caseData.location ?? '—'}</dd></div>
                  <div><dt className="text-slate-400">Incident Date</dt><dd className="font-medium text-slate-700">{caseData.incident_date ? format(new Date(caseData.incident_date), 'PPp') : '—'}</dd></div>
                  <div><dt className="text-slate-400">Opened</dt><dd className="font-medium text-slate-700">{formatDistanceToNow(new Date(caseData.created_at), { addSuffix: true })}</dd></div>
                  {caseData.closed_at && <div><dt className="text-slate-400">Closed</dt><dd className="font-medium text-slate-700">{format(new Date(caseData.closed_at), 'PP')}</dd></div>}
                </dl>
                {caseData.description && (
                  <div className="mt-4 pt-4 border-t border-slate-100">
                    <p className="text-xs text-slate-400 mb-1">Description</p>
                    <p className="text-sm text-slate-700">{caseData.description}</p>
                  </div>
                )}
              </div>

              {/* Status change */}
              {hasPermission('CASE_UPDATE') && (
                <div className="card p-5">
                  <h3 className="font-semibold text-slate-700 mb-3">Update Status</h3>
                  <div className="flex gap-2">
                    <select className="input w-56" value={newStatus} onChange={e => setNewStatus(e.target.value)}>
                      {['DRAFT', 'OPEN', 'UNDER_INVESTIGATION', 'ON_HOLD', 'SOLVED', 'CLOSED', 'ARCHIVED'].map(s => (
                        <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
                      ))}
                    </select>
                    <button onClick={handleStatusChange} className="btn-primary" disabled={newStatus === caseData.status}>
                      Update Status
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Sidebar */}
            <div className="space-y-4">
              <CaseCompletionWidget caseId={id!} refresh={completionRefresh} />
              <div className="card p-5">
                <h3 className="font-semibold text-slate-700 mb-3">Assigned Officers</h3>
                {caseData.assigned_officers.length === 0
                  ? <p className="text-sm text-slate-400">No officers assigned</p>
                  : caseData.assigned_officers.map(o => (
                    <div key={o.user_id} className="flex items-center gap-2.5 py-1.5">
                      <div className="h-7 w-7 rounded-full bg-primary-100 flex items-center justify-center text-xs font-bold text-primary-700">
                        {o.full_name.charAt(0)}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-700">{o.full_name}</p>
                        <p className="text-xs text-slate-400">{o.role.replace(/_/g, ' ')}</p>
                      </div>
                    </div>
                  ))
                }
              </div>
            </div>
          </div>
        )}

        {/* PERSONS TAB */}
        {tab === 'persons' && (
          <div className="space-y-4">
            {hasPermission('PERSON_CREATE') && (
              <div className="card p-4 flex flex-wrap gap-3 items-end">
                <div className="flex-1 min-w-[200px]">
                  <label className="label">Add Person to Case</label>
                  <select className="input" value={selectedPerson} onChange={e => setSelectedPerson(e.target.value)}>
                    <option value="">Select person…</option>
                    {allPersons.map(p => <option key={p.id} value={p.id}>{p.full_name} {p.alias ? `(${p.alias})` : ''}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Role</label>
                  <select className="input w-36" value={selectedRole} onChange={e => setSelectedRole(e.target.value)}>
                    {['SUSPECT', 'VICTIM', 'WITNESS', 'COMPLAINANT', 'OFFICER', 'OTHER'].map(r =>
                      <option key={r} value={r}>{r}</option>
                    )}
                  </select>
                </div>
                <button onClick={handleAddPerson} disabled={!selectedPerson || addingPerson} className="btn-primary">
                  <UserPlus className="h-4 w-4" /> Add
                </button>
              </div>
            )}

            <div className="card overflow-hidden">
              {persons.length === 0
                ? <p className="p-8 text-center text-slate-400">No persons linked to this case.</p>
                : (
                  <table className="w-full text-sm">
                    <thead className="border-b border-slate-100 bg-slate-50">
                      <tr>
                        <th className="px-4 py-3 text-left font-medium text-slate-600">Name</th>
                        <th className="px-4 py-3 text-left font-medium text-slate-600">Role</th>
                        <th className="px-4 py-3 text-left font-medium text-slate-600">Added</th>
                        <th className="px-4 py-3 text-left font-medium text-slate-600">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {persons.map(p => (
                        <tr key={p.id} className="hover:bg-slate-50">
                          <td className="px-4 py-3 font-medium text-slate-800">{p.person_name}</td>
                          <td className="px-4 py-3"><StatusBadge value={p.role} /></td>
                          <td className="px-4 py-3 text-slate-400 text-xs">{formatDistanceToNow(new Date(p.added_at), { addSuffix: true })}</td>
                          <td className="px-4 py-3">
                            <Link to={`/persons/${p.person_id}`} className="text-xs text-primary-600 hover:underline">View Profile</Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )
              }
            </div>
          </div>
        )}

        {/* EVIDENCE TAB */}
        {tab === 'evidence' && (
          <div className="space-y-4">
            {hasPermission('EVIDENCE_UPLOAD') && (
              <div className="card p-5 space-y-4">
                {/* Single file upload */}
                <div>
                  <h3 className="font-semibold text-slate-700 mb-3">Single File Upload</h3>
                  <div className="flex flex-wrap gap-3 items-end">
                    <div>
                      <label className="label">File *</label>
                      <input
                        type="file"
                        className="block text-sm text-slate-600 file:mr-3 file:rounded file:border-0 file:bg-primary-50 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-primary-700 hover:file:bg-primary-100"
                        onChange={e => setUploadFile(e.target.files?.[0] ?? null)}
                      />
                    </div>
                    <div className="flex-1 min-w-[180px]">
                      <label className="label">Description</label>
                      <input className="input" placeholder="Brief description of evidence" value={uploadDesc} onChange={e => setUploadDesc(e.target.value)} />
                    </div>
                    <button onClick={handleUpload} disabled={!uploadFile || uploading} className="btn-primary">
                      <Upload className="h-4 w-4" /> {uploading ? 'Uploading…' : 'Upload'}
                    </button>
                  </div>
                </div>

                {/* Bulk upload */}
                <div className="border-t border-slate-100 pt-4">
                  <h3 className="font-semibold text-slate-700 mb-3">Bulk Upload Multiple Files</h3>
                  <BulkEvidenceUpload
                    caseId={id!}
                    onComplete={(count) => {
                      if (count > 0) {
                        loadTab('evidence')
                        loadCase()
                        setCompletionRefresh(r => r + 1)
                      }
                    }}
                  />
                </div>
              </div>
            )}

            <div className="card overflow-hidden">
              {evidence.length === 0
                ? <p className="p-8 text-center text-slate-400">No evidence uploaded yet.</p>
                : (
                  <table className="w-full text-sm">
                    <thead className="border-b border-slate-100 bg-slate-50">
                      <tr>
                        <th className="px-4 py-3 text-left font-medium text-slate-600">Number</th>
                        <th className="px-4 py-3 text-left font-medium text-slate-600">Type</th>
                        <th className="px-4 py-3 text-left font-medium text-slate-600">Filename</th>
                        <th className="px-4 py-3 text-left font-medium text-slate-600">Hash (SHA-256)</th>
                        <th className="px-4 py-3 text-left font-medium text-slate-600">Status</th>
                        <th className="px-4 py-3 text-left font-medium text-slate-600">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {evidence.map(e => (
                        <tr key={e.id} className="hover:bg-slate-50">
                          <td className="px-4 py-3 font-mono text-xs text-primary-600">{e.evidence_number}</td>
                          <td className="px-4 py-3"><StatusBadge value={e.evidence_type} /></td>
                          <td className="px-4 py-3 text-slate-600 max-w-[160px] truncate text-xs">{e.original_filename}</td>
                          <td className="px-4 py-3 font-mono text-xs text-slate-400 max-w-[120px] truncate">{e.sha256_hash.slice(0, 16)}…</td>
                          <td className="px-4 py-3"><StatusBadge value={e.status} /></td>
                          <td className="px-4 py-3">
                            <Link to={`/evidence/${e.id}`} className="text-xs text-primary-600 hover:underline">Details</Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )
              }
            </div>
          </div>
        )}

        {/* TIMELINE TAB */}
        {tab === 'timeline' && (
          <div className="card p-6">
            {timeline.length === 0
              ? <p className="text-center text-slate-400 py-8">No timeline events.</p>
              : (
                <div className="relative">
                  <div className="absolute left-5 top-0 bottom-0 w-px bg-slate-200" />
                  <div className="space-y-4">
                    {timeline.map(ev => (
                      <div key={ev.id} className="relative flex gap-4 pl-12">
                        <div className={`absolute left-3 top-1.5 h-4 w-4 rounded-full border-2 border-white shadow-sm ${EVENT_COLORS[ev.event_type] ?? EVENT_COLORS.DEFAULT}`} />
                        <div className="flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <p className="font-medium text-sm text-slate-800">{ev.title}</p>
                            <p className="text-xs text-slate-400 shrink-0">{format(new Date(ev.occurred_at), 'PPp')}</p>
                          </div>
                          {ev.description && <p className="text-xs text-slate-500 mt-0.5">{ev.description}</p>}
                          {ev.created_by_name && <p className="text-xs text-slate-400 mt-0.5">by {ev.created_by_name}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            }
          </div>
        )}

        {/* PRIORITIZATION TAB */}
        {tab === 'prioritization' && (
          <div className="space-y-4">
            {/* Disclaimer */}
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
              <strong>⚠ Analytical Aid Only:</strong> Investigation Priority Score is not proof of criminal responsibility.
              Final decisions must be made by authorized investigators based on verified evidence and applicable law.
            </div>

            {hasPermission('CASE_READ') && (
              <button onClick={handlePrioritize} disabled={prioritizing} className="btn-primary">
                <Play className="h-4 w-4" /> {prioritizing ? 'Calculating…' : 'Run Prioritization'}
              </button>
            )}

            {scores && scores.candidates.length === 0 && (
              <div className="card p-8 text-center text-slate-400">
                No suspects in this case yet. Add suspects first.
              </div>
            )}

            {scores && scores.candidates.map((c, i) => (
              <div key={c.id || i} className="card p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-400">#{i + 1}</span>
                      <h3 className="font-semibold text-slate-800">{c.person_name}</h3>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">Engine: {c.engine_version}</p>
                  </div>
                  <div className="text-right">
                    <div className="text-3xl font-bold text-primary-600">{c.score.toFixed(1)}</div>
                    <div className="text-xs text-slate-400">/ 100 score</div>
                  </div>
                </div>

                {/* Score bar */}
                <div className="mt-3 h-2 w-full rounded-full bg-slate-100">
                  <div className="h-2 rounded-full bg-primary-500 transition-all" style={{ width: `${Math.min(c.score, 100)}%` }} />
                </div>

                {/* Breakdown */}
                <div className="mt-4 grid grid-cols-2 sm:grid-cols-5 gap-3">
                  {Object.entries(c.score_breakdown).map(([k, v]) => (
                    <div key={k} className="rounded-lg bg-slate-50 p-2 text-center">
                      <p className="text-sm font-bold text-slate-800">{(v as number).toFixed(0)}</p>
                      <p className="text-xs text-slate-400 leading-tight mt-0.5">{k.replace(/_/g, ' ')}</p>
                    </div>
                  ))}
                </div>

                {/* Factors */}
                {c.contributing_factors.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-slate-100">
                    <p className="text-xs font-medium text-slate-500 mb-1">Contributing factors:</p>
                    <ul className="space-y-0.5">
                      {c.contributing_factors.map((f, fi) => (
                        <li key={fi} className="text-xs text-slate-600 flex items-start gap-1.5">
                          <span className="text-primary-400 shrink-0 mt-0.5">•</span>{f}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* AUDIT TAB */}
        {tab === 'audit' && (
          <AuditTab caseId={id!} />
        )}
      </div>
    </div>
  )
}

function AuditTab({ caseId }: { caseId: string }) {
  const [logs, setLogs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    import('../../api/audit').then(({ auditApi }) =>
      auditApi.getResourceAudit('CASE', caseId)
        .then(setLogs)
        .finally(() => setLoading(false))
    )
  }, [caseId])

  if (loading) return <PageLoader />

  return (
    <div className="card overflow-hidden">
      {logs.length === 0
        ? <p className="p-8 text-center text-slate-400">No audit history for this case.</p>
        : (
          <table className="w-full text-sm">
            <thead className="border-b border-slate-100 bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-slate-600">Action</th>
                <th className="px-4 py-3 text-left font-medium text-slate-600">User</th>
                <th className="px-4 py-3 text-left font-medium text-slate-600">Result</th>
                <th className="px-4 py-3 text-left font-medium text-slate-600">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {logs.map((log: any) => (
                <tr key={log.id}>
                  <td className="px-4 py-3 font-mono text-xs">{log.action}</td>
                  <td className="px-4 py-3 text-slate-600">{log.username ?? '—'}</td>
                  <td className="px-4 py-3"><StatusBadge value={log.result} /></td>
                  <td className="px-4 py-3 text-slate-400 text-xs">{format(new Date(log.created_at), 'PPp')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )
      }
    </div>
  )
}
