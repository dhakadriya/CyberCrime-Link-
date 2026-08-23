import { useEffect, useState } from 'react'
import { casesApi } from '../../api/cases'
import { PageLoader } from '../../components/shared/LoadingSpinner'
import { ErrorAlert } from '../../components/shared/ErrorAlert'
import { getErrorMessage } from '../../api/client'
import type { Case, PrioritizationResult } from '../../types'
import { format } from 'date-fns'
import { Play, Link as LinkIcon } from 'lucide-react'
import { Link } from 'react-router-dom'

export function PrioritizationPage() {
  const [cases, setCases] = useState<Case[]>([])
  const [selectedCase, setSelectedCase] = useState('')
  const [result, setResult] = useState<PrioritizationResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    casesApi.list({ size: 50 })
      .then(r => { setCases(r.items); if (r.items[0]) setSelectedCase(r.items[0].id) })
      .catch(e => setError(getErrorMessage(e)))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!selectedCase) return
    casesApi.getScores(selectedCase)
      .then(setResult)
      .catch(() => setResult(null))
  }, [selectedCase])

  const runPrioritization = async () => {
    if (!selectedCase) return
    setRunning(true); setError('')
    try {
      const r = await casesApi.prioritize(selectedCase)
      setResult(r)
    } catch (e) { setError(getErrorMessage(e)) }
    finally { setRunning(false) }
  }

  if (loading) return <PageLoader />

  return (
    <div>
      <div className="page-header">
        <h1 className="text-xl font-bold text-slate-800">Suspect Prioritization</h1>
        <p className="text-sm text-slate-500 mt-0.5">Rule-based investigation priority scoring — analytical aid only</p>
      </div>

      <div className="page-content space-y-4">
        {/* Disclaimer — always visible */}
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="text-xs font-semibold text-amber-800 mb-0.5">⚠ ANALYTICAL AID ONLY</p>
          <p className="text-xs text-amber-700">
            Investigation Priority Score is not proof of criminal responsibility. This system does not determine guilt.
            Final decisions must be made by authorized investigators based on verified evidence and applicable law.
          </p>
        </div>

        {error && <ErrorAlert message={error} onClose={() => setError('')} />}

        <div className="card p-4 flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[240px]">
            <label className="label">Select Case</label>
            <select className="input" value={selectedCase} onChange={e => { setSelectedCase(e.target.value); setResult(null) }}>
              {cases.map(c => <option key={c.id} value={c.id}>{c.case_number} — {c.title}</option>)}
            </select>
          </div>
          <button onClick={runPrioritization} disabled={!selectedCase || running} className="btn-primary">
            <Play className="h-4 w-4" /> {running ? 'Calculating Scores…' : 'Run Prioritization Engine'}
          </button>
          {selectedCase && <Link to={`/cases/${selectedCase}`} className="btn-secondary text-xs">View Case</Link>}
        </div>

        {result && (
          <>
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-semibold text-slate-700">Results for {result.case_number}</h2>
                <p className="text-xs text-slate-400">
                  {result.total_candidates} candidate{result.total_candidates !== 1 ? 's' : ''} · Engine: {result.engine_version} · {format(new Date(result.generated_at), 'PPp')}
                </p>
              </div>
            </div>

            {result.candidates.length === 0 ? (
              <div className="card p-8 text-center text-slate-400">
                No suspects found in this case. Add suspects first via Case Details → Persons tab.
              </div>
            ) : (
              <div className="space-y-4">
                {result.candidates.map((c, i) => (
                  <div key={c.id || i} className="card p-5">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-sm font-bold text-slate-600">
                          #{i + 1}
                        </div>
                        <div>
                          <Link to={`/persons/${c.person_id}`} className="font-semibold text-slate-800 hover:text-primary-600">
                            {c.person_name}
                          </Link>
                          <p className="text-xs text-slate-400 mt-0.5">Engine {c.engine_version}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className={`text-3xl font-bold ${c.score >= 70 ? 'text-red-600' : c.score >= 40 ? 'text-amber-600' : 'text-slate-600'}`}>
                          {c.score.toFixed(1)}
                        </div>
                        <div className="text-xs text-slate-400">/ 100 priority score</div>
                      </div>
                    </div>

                    <div className="h-2 w-full rounded-full bg-slate-100 mb-4">
                      <div
                        className={`h-2 rounded-full transition-all ${c.score >= 70 ? 'bg-red-500' : c.score >= 40 ? 'bg-amber-500' : 'bg-slate-400'}`}
                        style={{ width: `${Math.min(c.score, 100)}%` }}
                      />
                    </div>

                    {/* Score breakdown */}
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-4">
                      {[
                        ['Previous Cases', c.score_breakdown.previous_cases, 35],
                        ['Type Similarity', c.score_breakdown.case_type_similarity, 20],
                        ['Relationships', c.score_breakdown.relationship_strength, 20],
                        ['Evidence Links', c.score_breakdown.evidence_association, 15],
                        ['Geographic', c.score_breakdown.geographic_relevance, 10],
                      ].map(([label, val, max]) => (
                        <div key={String(label)} className="rounded-lg bg-slate-50 p-2 text-center">
                          <p className="text-sm font-bold text-slate-700">{(val as number).toFixed(0)} <span className="text-xs font-normal text-slate-400">/{max}</span></p>
                          <p className="text-xs text-slate-400 leading-tight mt-0.5">{label}</p>
                        </div>
                      ))}
                    </div>

                    {c.contributing_factors.length > 0 && (
                      <div className="border-t border-slate-100 pt-3">
                        <p className="text-xs font-semibold text-slate-500 mb-1.5">Contributing factors:</p>
                        <ul className="space-y-1">
                          {c.contributing_factors.map((f, fi) => (
                            <li key={fi} className="flex items-start gap-2 text-xs text-slate-600">
                              <span className="text-primary-400 shrink-0 mt-0.5">•</span>
                              <span>{f}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
