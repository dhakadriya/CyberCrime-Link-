import { useEffect, useState } from 'react'
import { casesApi } from '../../api/cases'
import { PageLoader } from '../../components/shared/LoadingSpinner'
import { ErrorAlert, SuccessAlert } from '../../components/shared/ErrorAlert'
import { getErrorMessage } from '../../api/client'
import type { Case } from '../../types'
import { FileText, BarChart3, Download, Printer, Check, Eye } from 'lucide-react'
import { StatusBadge } from '../../components/shared/StatusBadge'
import clsx from 'clsx'

export function ReportsPage() {
  const [cases, setCases] = useState<Case[]>([])
  const [selectedCaseId, setSelectedCaseId] = useState('')
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // Report sections configuration
  const [sections, setSections] = useState({
    summary: true,
    officers: true,
    persons: true,
    evidence: true,
    timeline: true,
    prioritization: true,
    audit: true,
    disclaimer: true,
  })

  const [reportData, setReportData] = useState<any>(null)

  useEffect(() => {
    casesApi.list({ size: 100 })
      .then(r => {
        setCases(r.items)
        if (r.items[0]) setSelectedCaseId(r.items[0].id)
      })
      .catch(e => setError(getErrorMessage(e)))
      .finally(() => setLoading(false))
  }, [])

  const handleGenerateReport = async () => {
    if (!selectedCaseId) return
    setGenerating(true)
    setError('')
    setSuccess('')
    try {
      const data = await casesApi.generateReport(selectedCaseId)
      setReportData(data)
      setSuccess(`Report compiled successfully for case ${data.case.case_number}.`)
    } catch (e) {
      setError(getErrorMessage(e))
      setReportData(null)
    } finally {
      setGenerating(false)
    }
  }

  const handleDownloadJson = () => {
    if (!reportData) return
    const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `CrimeLink_Report_${reportData.case.case_number}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handlePrint = () => {
    window.print()
  }

  if (loading) return <PageLoader />

  return (
    <div className="animate-fade-in pb-12">
      {/* Header (hidden during print) */}
      <div className="page-header flex items-center justify-between no-print shrink-0">
        <div>
          <h1 className="text-lg font-bold text-slate-100 flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-indigo-400" /> Investigation Report Builder
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">Generate, preview, and print comprehensive dossiers</p>
        </div>
      </div>

      <div className="page-content space-y-4 no-print">
        {error && <ErrorAlert message={error} onClose={() => setError('')} />}
        {success && <SuccessAlert message={success} onClose={() => setSuccess('')} />}

        {/* Configuration Board */}
        <div className="card p-5 border-slate-800 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Case selector */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">
                Select Investigation Case
              </label>
              <select
                className="input w-full bg-slate-950 border-slate-800 text-xs py-2 h-9"
                value={selectedCaseId}
                onChange={e => { setSelectedCaseId(e.target.value); setReportData(null) }}
              >
                {cases.map(c => (
                  <option key={c.id} value={c.id}>{c.case_number} — {c.title}</option>
                ))}
              </select>
            </div>

            {/* Sections configuration */}
            <div className="md:col-span-2 space-y-2">
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                Dossier Sections to Include
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {Object.keys(sections).map(sec => (
                  <label
                    key={sec}
                    className={clsx(
                      "flex items-center gap-2 p-2 rounded-lg border text-xs font-semibold cursor-pointer select-none transition-all",
                      (sections as any)[sec]
                        ? 'bg-indigo-650/10 border-indigo-500/30 text-indigo-400'
                        : 'bg-slate-900/40 border-slate-800 text-slate-500'
                    )}
                  >
                    <input
                      type="checkbox"
                      className="hidden"
                      checked={(sections as any)[sec]}
                      onChange={e => setSections(prev => ({ ...prev, [sec]: e.target.checked }))}
                    />
                    <Check className={clsx("h-3.5 w-3.5", (sections as any)[sec] ? "opacity-100" : "opacity-0")} />
                    <span className="capitalize">{sec.replace(/_/g, ' ')}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div className="border-t border-slate-850 pt-4 flex gap-2 justify-end">
            <button
              onClick={handleGenerateReport}
              disabled={generating}
              className="btn-primary bg-indigo-600 hover:bg-indigo-500 text-xs py-2 px-4"
            >
              {generating ? 'Compiling Dossier…' : 'Generate & Preview'}
            </button>
            {reportData && (
              <>
                <button
                  onClick={handlePrint}
                  className="btn-secondary text-xs py-2 px-4 flex items-center gap-1.5"
                >
                  <Printer className="h-3.5 w-3.5" /> Print / Save PDF
                </button>
                <button
                  onClick={handleDownloadJson}
                  className="btn-secondary text-xs py-2 px-4 flex items-center gap-1.5"
                >
                  <Download className="h-3.5 w-3.5" /> Download JSON
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Live Print Preview Sheet */}
      {reportData && (
        <div className="mt-6 flex justify-center px-4">
          <div className="w-[794px] min-h-[1123px] bg-white text-slate-900 shadow-2xl p-12 border border-slate-300 print:border-none print:shadow-none print:p-0 flex flex-col justify-between font-sans">
            <div className="space-y-8">
              {/* Report Header */}
              <div className="border-b-4 border-slate-900 pb-4 flex justify-between items-start">
                <div>
                  <h1 className="text-xl font-extrabold tracking-widest text-slate-900 font-mono">
                    CRIMELINK INTELLIGENCE SYSTEM
                  </h1>
                  <p className="text-xs font-bold text-slate-500 tracking-wider uppercase mt-1">
                    Official Criminal Network Analysis Dossier
                  </p>
                </div>
                <div className="text-right">
                  <span className="bg-red-100 border border-red-300 text-red-700 text-[10px] font-bold px-2.5 py-0.5 rounded tracking-widest">
                    CONFIDENTIAL
                  </span>
                  <p className="text-[10px] text-slate-500 font-mono mt-2">ID: {reportData.case.case_number}</p>
                </div>
              </div>

              {/* General metadata */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs bg-slate-100 p-4 rounded border border-slate-200">
                <div>
                  <p className="text-slate-500 font-semibold uppercase text-[9px]">Case Number</p>
                  <p className="font-bold text-slate-800 mt-0.5">{reportData.case.case_number}</p>
                </div>
                <div>
                  <p className="text-slate-500 font-semibold uppercase text-[9px]">Investigation Type</p>
                  <p className="font-bold text-slate-800 mt-0.5">{reportData.case.case_type}</p>
                </div>
                <div>
                  <p className="text-slate-500 font-semibold uppercase text-[9px]">Date Generated</p>
                  <p className="font-bold text-slate-800 mt-0.5">
                    {new Date(reportData.generated_at).toLocaleDateString()}
                  </p>
                </div>
                <div>
                  <p className="text-slate-500 font-semibold uppercase text-[9px]">Generated By</p>
                  <p className="font-bold text-slate-800 mt-0.5">{reportData.generated_by}</p>
                </div>
              </div>

              {/* Case Summary */}
              {sections.summary && (
                <div className="space-y-2">
                  <h2 className="text-xs font-extrabold text-slate-900 border-b border-slate-300 pb-1.5 uppercase tracking-widest">
                    1. Case Description & Background
                  </h2>
                  <p className="text-xs leading-relaxed text-slate-700 whitespace-pre-line">
                    {reportData.case.description || 'No summary description provided.'}
                  </p>
                  <div className="grid grid-cols-2 gap-4 text-xs pt-2">
                    <p><span className="font-semibold text-slate-500">Incident Location:</span> <span className="text-slate-800">{reportData.case.location || 'N/A'}</span></p>
                    <p><span className="font-semibold text-slate-500">Classification Level:</span> <span className="text-slate-800">{reportData.case.priority}</span></p>
                  </div>
                </div>
              )}

              {/* Assigned Officers */}
              {sections.officers && reportData.assigned_officers?.length > 0 && (
                <div className="space-y-2">
                  <h2 className="text-xs font-extrabold text-slate-900 border-b border-slate-300 pb-1.5 uppercase tracking-widest">
                    2. Assigned Officers & Investigating Agents
                  </h2>
                  <table className="w-full text-xs text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-300 text-slate-500 uppercase text-[9px] font-bold">
                        <th className="py-1">Name</th>
                        <th className="py-1">Username</th>
                        <th className="py-1">Role / Duty</th>
                        <th className="py-1">Assigned Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {reportData.assigned_officers.map((off: any, idx: number) => (
                        <tr key={idx}>
                          <td className="py-1.5 font-semibold text-slate-900">{off.full_name}</td>
                          <td className="py-1.5 font-mono text-slate-500">{off.username}</td>
                          <td className="py-1.5">{off.role?.replace(/_/g, ' ')}</td>
                          <td className="py-1.5">{new Date(off.assigned_at).toLocaleDateString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Persons Catalog */}
              {sections.persons && reportData.persons?.length > 0 && (
                <div className="space-y-2">
                  <h2 className="text-xs font-extrabold text-slate-900 border-b border-slate-300 pb-1.5 uppercase tracking-widest">
                    3. Involved Persons & Suspect Records
                  </h2>
                  <table className="w-full text-xs text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-300 text-slate-500 uppercase text-[9px] font-bold">
                        <th className="py-1">Full Name</th>
                        <th className="py-1">Aliases</th>
                        <th className="py-1">Role Type</th>
                        <th className="py-1">Case Notes</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {reportData.persons.map((p: any) => (
                        <tr key={p.person_id}>
                          <td className="py-1.5 font-semibold text-slate-900">{p.full_name}</td>
                          <td className="py-1.5 font-semibold text-slate-500 italic">"{p.alias || 'None'}"</td>
                          <td className="py-1.5 text-slate-800 font-medium">{p.role}</td>
                          <td className="py-1.5 text-slate-500 truncate max-w-[200px]" title={p.notes}>{p.notes || 'No remarks'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Evidence inventory */}
              {sections.evidence && reportData.evidence_summary?.items?.length > 0 && (
                <div className="space-y-2">
                  <h2 className="text-xs font-extrabold text-slate-900 border-b border-slate-300 pb-1.5 uppercase tracking-widest">
                    4. Evidence Registry & Chain of Custody
                  </h2>
                  <table className="w-full text-xs text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-300 text-slate-500 uppercase text-[9px] font-bold">
                        <th className="py-1">ID</th>
                        <th className="py-1">Classification</th>
                        <th className="py-1">Description</th>
                        <th className="py-1">SHA-256 Hash Integrity</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700 font-mono">
                      {reportData.evidence_summary.items.map((e: any) => (
                        <tr key={e.evidence_number}>
                          <td className="py-1.5 font-bold text-slate-950">{e.evidence_number}</td>
                          <td className="py-1.5 font-sans font-medium text-slate-800">{e.evidence_type}</td>
                          <td className="py-1.5 font-sans text-slate-500 max-w-[200px] truncate">{e.description}</td>
                          <td className="py-1.5 text-[10px] text-slate-500 truncate max-w-[180px]" title={e.sha256_hash}>
                            {e.sha256_hash}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Timeline */}
              {sections.timeline && reportData.investigation_timeline?.length > 0 && (
                <div className="space-y-2">
                  <h2 className="text-xs font-extrabold text-slate-900 border-b border-slate-300 pb-1.5 uppercase tracking-widest">
                    5. Chronological Investigation Timeline
                  </h2>
                  <div className="space-y-2 text-xs">
                    {reportData.investigation_timeline.map((ev: any, idx: number) => (
                      <div key={idx} className="flex gap-4">
                        <div className="w-24 shrink-0 font-mono text-slate-500 text-[10px] py-0.5">
                          {new Date(ev.occurred_at).toLocaleDateString()}
                        </div>
                        <div>
                          <p className="font-semibold text-slate-900">{ev.title}</p>
                          <p className="text-slate-600 mt-0.5 leading-normal">{ev.description}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Prioritization Score */}
              {sections.prioritization && reportData.prioritization_analysis?.candidates?.length > 0 && (
                <div className="space-y-2">
                  <h2 className="text-xs font-extrabold text-slate-900 border-b border-slate-300 pb-1.5 uppercase tracking-widest">
                    6. Suspicion Modularity mod-scores
                  </h2>
                  <table className="w-full text-xs text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-300 text-slate-500 uppercase text-[9px] font-bold">
                        <th className="py-1">Subject</th>
                        <th className="py-1">PageRank Score</th>
                        <th className="py-1">Reasoning Analysis</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {reportData.prioritization_analysis.candidates.map((cand: any, idx: number) => (
                        <tr key={idx}>
                          <td className="py-1.5 font-semibold text-slate-900">{cand.person_name}</td>
                          <td className="py-1.5 font-bold font-mono text-indigo-700">{cand.score.toFixed(1)}%</td>
                          <td className="py-1.5 text-slate-500 text-[11px] leading-relaxed">
                            {cand.contributing_factors?.slice(0, 2).join(', ') || 'N/A'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Recent Audit events */}
              {sections.audit && reportData.recent_audit_events?.length > 0 && (
                <div className="space-y-2">
                  <h2 className="text-xs font-extrabold text-slate-900 border-b border-slate-300 pb-1.5 uppercase tracking-widest">
                    7. System Access & Modification Log
                  </h2>
                  <table className="w-full text-xs text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-300 text-slate-500 uppercase text-[9px] font-bold">
                        <th className="py-1">Action Event</th>
                        <th className="py-1">Officer</th>
                        <th className="py-1">Result Status</th>
                        <th className="py-1">Date Time</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700 font-mono text-[10px]">
                      {reportData.recent_audit_events.map((log: any, idx: number) => (
                        <tr key={idx}>
                          <td className="py-1.5 font-bold text-slate-800">{log.action}</td>
                          <td className="py-1.5 font-sans">{log.username}</td>
                          <td className="py-1.5 font-sans font-bold text-emerald-700">{log.result}</td>
                          <td className="py-1.5 text-slate-400">
                            {new Date(log.created_at).toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Disclaimers & Signatures */}
              {sections.disclaimer && (
                <div className="space-y-6 pt-6 border-t border-slate-300">
                  <div className="text-[10px] text-slate-500 leading-relaxed bg-slate-100 p-3 rounded">
                    <p className="font-bold uppercase tracking-wider text-[8px] text-slate-600 mb-1">
                      AUTHORIZED USE ONLY — LAW ENFORCEMENT SENSITIVE
                    </p>
                    {reportData.disclaimer}
                  </div>

                  <div className="flex justify-between items-end pt-12">
                    <div className="text-xs">
                      <p className="text-[9px] text-slate-500 uppercase font-bold tracking-wider">Report Compiler</p>
                      <p className="border-b border-slate-400 w-48 mt-8"></p>
                      <p className="mt-1 text-slate-700 font-medium">{reportData.generated_by}</p>
                    </div>
                    <div className="text-xs">
                      <p className="text-[9px] text-slate-500 uppercase font-bold tracking-wider">Supervising Official Signature</p>
                      <p className="border-b border-slate-400 w-48 mt-8"></p>
                      <p className="mt-1 text-slate-400">Date: ____/____/________</p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="border-t border-slate-300 pt-3 text-center text-[9px] font-mono text-slate-400 flex justify-between mt-12">
              <span>CRIMELINK PLATFORM</span>
              <span>CONFIDENTIAL CASE FILE DOSSIER</span>
              <span>Generated on {new Date(reportData.generated_at).toLocaleDateString()}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
