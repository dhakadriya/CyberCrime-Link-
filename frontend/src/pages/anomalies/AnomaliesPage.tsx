import { useEffect, useState } from 'react'
import { AlertTriangle, RefreshCw, ShieldAlert, Network, TrendingUp, GitBranch } from 'lucide-react'
import { networkApi } from '../../api/network'
import { casesApi } from '../../api/cases'
import { leadsApi } from '../../api/leads'
import { PageLoader } from '../../components/shared/LoadingSpinner'
import { ErrorAlert, SuccessAlert } from '../../components/shared/ErrorAlert'
import { StatusBadge } from '../../components/shared/StatusBadge'
import { getErrorMessage } from '../../api/client'
import type { Case } from '../../types'

interface Anomaly {
  type: string
  node_id: string
  label: string
  severity: string
  description: string
  confidence: number
}

const ANOMALY_TYPE_INFO: Record<string, { icon: React.ReactNode; label: string; color: string }> = {
  BRIDGE_NODE: {
    icon: <GitBranch className="h-4 w-4" />,
    label: 'Network Bridge',
    color: 'text-amber-400',
  },
  HIGH_DEGREE_NODE: {
    icon: <Network className="h-4 w-4" />,
    label: 'High Connectivity Node',
    color: 'text-orange-400',
  },
  COMMUNITY_BRIDGE: {
    icon: <TrendingUp className="h-4 w-4" />,
    label: 'Community Bridge',
    color: 'text-red-400',
  },
}

function AnomalyCard({ anomaly, onCreateLead }: { anomaly: Anomaly; onCreateLead: (a: Anomaly) => void }) {
  const typeInfo = ANOMALY_TYPE_INFO[anomaly.type] || {
    icon: <AlertTriangle className="h-4 w-4" />,
    label: anomaly.type,
    color: 'text-slate-400',
  }
  const confPct = Math.round(anomaly.confidence * 100)
  const barColor = anomaly.severity === 'HIGH' || anomaly.severity === 'CRITICAL'
    ? 'bg-red-500' : anomaly.severity === 'MEDIUM' ? 'bg-amber-500' : 'bg-blue-500'

  return (
    <div className="card p-5 space-y-4">
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          <div className={`mt-0.5 ${typeInfo.color}`}>{typeInfo.icon}</div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                {typeInfo.label}
              </span>
              <StatusBadge value={anomaly.severity} type="severity" />
            </div>
            <h3 className="font-semibold text-slate-100">{anomaly.label}</h3>
          </div>
        </div>
        <div className="text-right shrink-0">
          <p className="text-xl font-bold text-slate-200">{confPct}%</p>
          <p className="text-[10px] text-slate-600">confidence</p>
        </div>
      </div>

      {/* Confidence bar */}
      <div>
        <div className="h-1.5 w-full bg-slate-800 rounded-full">
          <div className={`h-1.5 rounded-full ${barColor}`} style={{ width: `${confPct}%` }} />
        </div>
      </div>

      {/* Description */}
      <p className="text-sm text-slate-400 leading-relaxed">{anomaly.description}</p>

      {/* Supporting facts */}
      <div className="rounded-lg bg-slate-800/50 border border-slate-800 p-3">
        <p className="text-xs font-semibold text-slate-500 mb-1.5">Why this was flagged:</p>
        <ul className="space-y-1 text-xs text-slate-400">
          {anomaly.type === 'BRIDGE_NODE' && (
            <>
              <li className="flex items-start gap-1.5"><span className="text-indigo-400 mt-0.5">•</span> Acts as articulation point — network would fragment without this node</li>
              <li className="flex items-start gap-1.5"><span className="text-indigo-400 mt-0.5">•</span> Critical path for information/resource flow</li>
            </>
          )}
          {anomaly.type === 'HIGH_DEGREE_NODE' && (
            <>
              <li className="flex items-start gap-1.5"><span className="text-orange-400 mt-0.5">•</span> Connection count significantly above network average</li>
              <li className="flex items-start gap-1.5"><span className="text-orange-400 mt-0.5">•</span> Statistical outlier — 2+ standard deviations above mean degree</li>
            </>
          )}
          {anomaly.type === 'COMMUNITY_BRIDGE' && (
            <>
              <li className="flex items-start gap-1.5"><span className="text-red-400 mt-0.5">•</span> Connects multiple otherwise separate network communities</li>
              <li className="flex items-start gap-1.5"><span className="text-red-400 mt-0.5">•</span> May facilitate coordination between distinct groups</li>
            </>
          )}
        </ul>
      </div>

      {/* Ethics notice */}
      <p className="text-[10px] text-slate-600 italic border-t border-slate-800 pt-3">
        This is an investigative signal derived from graph topology. It does not constitute evidence of
        criminal activity. Requires human investigator review and corroboration.
      </p>

      <button
        onClick={() => onCreateLead(anomaly)}
        className="btn-secondary text-xs py-1.5 w-full"
      >
        <ShieldAlert className="h-3.5 w-3.5" />
        Create Investigative Lead
      </button>
    </div>
  )
}

export function AnomaliesPage() {
  const [cases, setCases] = useState<Case[]>([])
  const [selectedCase, setSelectedCase] = useState('')
  const [anomalies, setAnomalies] = useState<Anomaly[]>([])
  const [loading, setLoading] = useState(true)
  const [analyzing, setAnalyzing] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [severityFilter, setSeverityFilter] = useState('')

  useEffect(() => {
    casesApi.list({ size: 50 })
      .then(r => { setCases(r.items); if (r.items[0]) setSelectedCase(r.items[0].id) })
      .catch(e => setError(getErrorMessage(e)))
      .finally(() => setLoading(false))
  }, [])

  const loadAnomalies = async (caseId?: string) => {
    setAnalyzing(true); setError('')
    try {
      const data = await networkApi.getAnomalies(caseId || undefined)
      setAnomalies(data.anomalies || [])
    } catch (e) { setError(getErrorMessage(e)) }
    finally { setAnalyzing(false) }
  }

  useEffect(() => { loadAnomalies(selectedCase || undefined) }, [selectedCase])

  const handleCreateLead = async (anomaly: Anomaly) => {
    try {
      await leadsApi.generateFromNetwork(selectedCase || undefined)
      setSuccess(`Lead generated for ${anomaly.label}`)
    } catch (e) { setError(getErrorMessage(e)) }
  }

  const filtered = severityFilter ? anomalies.filter(a => a.severity === severityFilter) : anomalies

  if (loading) return <PageLoader />

  return (
    <div className="animate-fade-in">
      <div className="page-header flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-slate-100 flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-400" /> Anomaly Detection
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">Network patterns flagged for investigative attention</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => leadsApi.generateFromNetwork(selectedCase || undefined).then(() => setSuccess('Leads generated')).catch(e => setError(getErrorMessage(e)))} className="btn-secondary text-xs py-1.5">
            <ShieldAlert className="h-3.5 w-3.5" /> Generate All Leads
          </button>
          <button onClick={() => loadAnomalies(selectedCase || undefined)} disabled={analyzing} className="btn-secondary text-xs py-1.5">
            <RefreshCw className={`h-3.5 w-3.5 ${analyzing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      <div className="page-content space-y-5">
        <div className="rounded-lg border border-amber-800/30 bg-amber-900/10 px-4 py-3">
          <p className="text-xs font-semibold text-amber-400">⚠ ANALYTICAL FLAGS — NOT CONFIRMED CRIMINAL ACTIVITY</p>
          <p className="text-xs text-amber-500/70 mt-0.5">
            Anomalies are statistical patterns in network data that warrant investigative attention.
            They require human review, corroboration, and investigation before any action.
          </p>
        </div>

        {error && <ErrorAlert message={error} onClose={() => setError('')} />}
        {success && <SuccessAlert message={success} onClose={() => setSuccess('')} />}

        <div className="flex flex-wrap gap-3">
          <div className="card p-3 flex items-center gap-3">
            <label className="text-xs text-slate-400 shrink-0">Case:</label>
            <select className="input text-xs py-1 max-w-xs" value={selectedCase}
              onChange={e => setSelectedCase(e.target.value)}>
              <option value="">All Cases</option>
              {cases.map(c => <option key={c.id} value={c.id}>{c.case_number}</option>)}
            </select>
          </div>
          <div className="card p-3 flex items-center gap-2">
            <label className="text-xs text-slate-400">Severity:</label>
            <select className="input text-xs py-1 w-28" value={severityFilter}
              onChange={e => setSeverityFilter(e.target.value)}>
              <option value="">All</option>
              <option value="CRITICAL">Critical</option>
              <option value="HIGH">High</option>
              <option value="MEDIUM">Medium</option>
              <option value="LOW">Low</option>
            </select>
          </div>
        </div>

        {/* Summary */}
        {!analyzing && anomalies.length > 0 && (
          <div className="flex gap-3">
            {['CRITICAL','HIGH','MEDIUM','LOW'].map(sev => {
              const count = anomalies.filter(a => a.severity === sev).length
              if (!count) return null
              const colors: Record<string, string> = {
                CRITICAL: 'text-red-400 bg-red-900/20 border-red-800/30',
                HIGH: 'text-orange-400 bg-orange-900/20 border-orange-800/30',
                MEDIUM: 'text-amber-400 bg-amber-900/20 border-amber-800/30',
                LOW: 'text-blue-400 bg-blue-900/20 border-blue-800/30',
              }
              return (
                <div key={sev} className={`px-3 py-2 rounded-lg border text-center min-w-[70px] ${colors[sev]}`}>
                  <p className="text-lg font-bold">{count}</p>
                  <p className="text-[10px]">{sev}</p>
                </div>
              )
            })}
          </div>
        )}

        {analyzing && <PageLoader />}

        {!analyzing && filtered.length === 0 && (
          <div className="card p-12 text-center text-slate-600">
            <AlertTriangle className="h-12 w-12 mx-auto mb-3 opacity-20" />
            <p>{anomalies.length === 0 ? 'No anomalies detected in this network.' : 'No anomalies match the current filter.'}</p>
            <p className="text-xs mt-1">This may indicate a sparse network or insufficient data.</p>
          </div>
        )}

        {!analyzing && filtered.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {filtered.map((anomaly, i) => (
              <AnomalyCard key={`${anomaly.node_id}-${i}`} anomaly={anomaly} onCreateLead={handleCreateLead} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
