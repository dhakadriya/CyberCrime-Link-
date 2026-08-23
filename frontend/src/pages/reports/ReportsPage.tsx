import { useEffect, useState } from 'react'
import { casesApi } from '../../api/cases'
import { PageLoader } from '../../components/shared/LoadingSpinner'
import { ErrorAlert, SuccessAlert } from '../../components/shared/ErrorAlert'
import { getErrorMessage } from '../../api/client'
import type { Case } from '../../types'
import { FileDown, BarChart3, Download } from 'lucide-react'
import { StatusBadge } from '../../components/shared/StatusBadge'

export function ReportsPage() {
  const [cases, setCases] = useState<Case[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    casesApi.list({ size: 100 })
      .then(r => setCases(r.items))
      .catch(e => setError(getErrorMessage(e)))
      .finally(() => setLoading(false))
  }, [])

  const handleReport = async (caseId: string, caseNumber: string) => {
    setGenerating(caseId); setError(''); setSuccess('')
    try {
      const report = await casesApi.generateReport(caseId)
      const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = `CrimeLink_Report_${caseNumber}.json`; a.click()
      URL.revokeObjectURL(url)
      setSuccess(`Report generated for ${caseNumber}`)
    } catch (e) { setError(getErrorMessage(e)) }
    finally { setGenerating(null) }
  }

  if (loading) return <PageLoader />

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <h1 className="text-lg font-bold text-slate-100 flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-indigo-400" /> Investigation Reports
        </h1>
        <p className="text-xs text-slate-500 mt-0.5">Generate comprehensive case reports from live data</p>
      </div>

      <div className="page-content space-y-4">
        <div className="rounded-lg border border-blue-800/30 bg-blue-900/10 px-4 py-3 text-xs text-blue-300">
          Reports are generated from live database records and exported as JSON.
          They include case details, persons, evidence, timeline, prioritization scores and audit events.
        </div>

        {error && <ErrorAlert message={error} onClose={() => setError('')} />}
        {success && <SuccessAlert message={success} onClose={() => setSuccess('')} />}

        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-800 bg-slate-900/50">
              <tr>
                {['Case', 'Title', 'Status', 'Priority', 'Generate'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-slate-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {cases.map(c => (
                <tr key={c.id} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs font-bold text-indigo-400">{c.case_number}</td>
                  <td className="px-4 py-3 font-medium text-slate-200 max-w-[260px] truncate">{c.title}</td>
                  <td className="px-4 py-3"><StatusBadge value={c.status} /></td>
                  <td className="px-4 py-3"><StatusBadge value={c.priority} type="priority" /></td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => handleReport(c.id, c.case_number)}
                      disabled={generating === c.id}
                      className="btn-secondary text-xs py-1.5 gap-1.5"
                    >
                      {generating === c.id
                        ? <><FileDown className="h-3.5 w-3.5 animate-bounce" /> Generating…</>
                        : <><Download className="h-3.5 w-3.5" /> Download JSON</>}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {cases.length === 0 && (
            <p className="p-8 text-center text-slate-600">No cases available.</p>
          )}
        </div>
      </div>
    </div>
  )
}
