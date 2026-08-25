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
    color: 'text-amber-700',
  },
  HIGH_DEGREE_NODE: {
    icon: <Network className="h-4 w-4" />,
    label: 'High Connectivity Node',
    color: 'text-orange-700',
  },
  COMMUNITY_BRIDGE: {
    icon: <TrendingUp className="h-4 w-4" />,
    label: 'Community Bridge',
    color: 'text-red-750',
  },
}

function AnomalyCard({ anomaly, onCreateLead }: { anomaly: Anomaly; onCreateLead: (a: Anomaly) => void }) {
  const typeInfo = ANOMALY_TYPE_INFO[anomaly.type] || {
    icon: <AlertTriangle className="h-4 w-4" />,
    label: anomaly.type,
    color: 'text-slate-500',
  }
  const confPct = Math.round(anomaly.confidence * 100)
  const barColor = anomaly.severity === 'HIGH' || anomaly.severity === 'CRITICAL'
    ? 'bg-red-600' : anomaly.severity === 'MEDIUM' ? 'bg-amber-600' : 'bg-blue-600'

  return (
    <div className="card p-5 space-y-4 bg-white border border-[#D9E0EA]">
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          <div className={`mt-0.5 ${typeInfo.color}`}>{typeInfo.icon}</div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-bold text-[#475467] uppercase tracking-wide">
                {typeInfo.label}
              </span>
              <StatusBadge value={anomaly.severity} type="severity" />
            </div>
            <h3 className="font-bold text-slate-100">{anomaly.label}</h3>
          </div>
        </div>
        <div className="text-right shrink-0">
          <p className="text-xl font-bold text-slate-100">{confPct}%</p>
          <p className="text-[10px] text-slate-400 font-semibold uppercase">confidence</p>
        </div>
      </div>

      {/* Confidence bar */}
      <div>
        <div className="h-1.5 w-full bg-slate-800 rounded-full">
          <div className={`h-1.5 rounded-full ${barColor}`} style={{ width: `${confPct}%` }} />
        </div>
      </div>

      {/* Description */}
      <p className="text-sm text-slate-200 leading-relaxed">{anomaly.description}</p>

      {/* Supporting facts */}
      <div className="rounded-lg bg-[#F8FAFC] border border-[#D9E0EA] p-3">
        <p className="text-xs font-bold text-[#475467] mb-1.5">Why this was flagged:</p>
        <ul className="space-y-1 text-xs text-slate-200 font-medium">
          {anomaly.type === 'BRIDGE_NODE' && (
            <>
              <li className="flex items-start gap-1.5"><span className="text-indigo-650 mt-0.5">•</span> Acts as articulation point — network would fragment without this node</li>
              <li className="flex items-start gap-1.5"><span className="text-indigo-650 mt-0.5">•</span> Critical path for information/resource flow</li>
            </>
          )}
          {anomaly.type === 'HIGH_DEGREE_NODE' && (
            <>
              <li className="flex items-start gap-1.5"><span className="text-orange-700 mt-0.5">•</span> Connection count significantly above network average</li>
              <li className="flex items-start gap-1.5"><span className="text-orange-700 mt-0.5">•</span> Statistical outlier — 2+ standard deviations above mean degree</li>
            </>
          )}
          {anomaly.type === 'COMMUNITY_BRIDGE' && (
            <>
              <li className="flex items-start gap-1.5"><span className="text-red-750 mt-0.5">•</span> Connects multiple otherwise separate network communities</li>
              <li className="flex items-start gap-1.5"><span className="text-red-750 mt-0.5">•</span> May facilitate coordination between distinct groups</li>
            </>
          )}
        </ul>
      </div>

      {/* Ethics notice */}
      <p className="text-[10px] text-slate-400 italic border-t border-[#D9E0EA] pt-3">
        This is an investigative signal derived from graph topology. It does not constitute evidence of
        criminal activity. Requires human investigator review and corroboration.
      </p>

      <button
        onClick={() => onCreateLead(anomaly)}
        className="btn-secondary text-xs py-2 w-full flex items-center justify-center gap-1.5"
      >
        <ShieldAlert className="h-4 w-4 text-[#475467]" />
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
      <div className="page-header border-b border-slate-700 bg-slate-900 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" /> Anomaly Detection
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">Network patterns flagged for investigative attention</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => leadsApi.generateFromNetwork(selectedCase || undefined).then(() => setSuccess('Leads generated')).catch(e => setError(getErrorMessage(e)))} className="btn-secondary text-xs h-[36px] flex items-center gap-1">
            <ShieldAlert className="h-4 w-4 text-[#475467]" /> Generate All Leads
          </button>
          <button onClick={() => loadAnomalies(selectedCase || undefined)} disabled={analyzing} className="btn-secondary text-xs h-[36px] flex items-center justify-center">
            <RefreshCw className={`h-4 w-4 text-[#475467] ${analyzing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      <div className="page-content space-y-5">
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="text-xs font-bold text-amber-800">⚠ ANALYTICAL FLAGS — NOT CONFIRMED CRIMINAL ACTIVITY</p>
          <p className="text-xs text-amber-700 mt-0.5">
            Anomalies are statistical patterns in network data that warrant investigative attention.
            They require human review, corroboration, and investigation before any action.
          </p>
        </div>

        {error && <ErrorAlert message={error} onClose={() => setError('')} />}
        {success && <SuccessAlert message={success} onClose={() => setSuccess('')} />}

        <div className="flex flex-wrap gap-3">
          <div className="card p-3 flex items-center gap-3">
            <label className="text-xs text-slate-400 shrink-0 font-bold uppercase tracking-wider">Case:</label>
            <select className="input text-xs h-9 max-w-xs" value={selectedCase}
              onChange={e => setSelectedCase(e.target.value)}>
              <option value="">All Cases</option>
              {cases.map(c => <option key={c.id} value={c.id}>{c.case_number}</option>)}
            </select>
          </div>
          <div className="card p-3 flex items-center gap-2">
            <label className="text-xs text-slate-400 font-bold uppercase tracking-wider">Severity:</label>
            <select className="input text-xs h-9 w-28" value={severityFilter}
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
                CRITICAL: 'text-red-800 bg-red-100 border-red-300',
                HIGH: 'text-orange-800 bg-orange-100 border-orange-300',
                MEDIUM: 'text-amber-800 bg-amber-100 border-amber-300',
                LOW: 'text-blue-800 bg-blue-100 border-blue-300',
              }
              return (
                <div key={sev} className={`px-3 py-2 rounded-lg border text-center min-w-[70px] ${colors[sev]}`}>
                  <p className="text-lg font-bold">{count}</p>
                  <p className="text-[10px] font-bold uppercase tracking-wider">{sev}</p>
                </div>
              )
            })}
          </div>
        )}

        {analyzing && <PageLoader />}

        {!analyzing && filtered.length === 0 && (
          <div className="card p-12 text-center text-slate-400">
            <AlertTriangle className="h-12 w-12 mx-auto mb-3 opacity-20 text-[#667085]" />
            <p className="font-bold text-[#172033]">{anomalies.length === 0 ? 'No anomalies detected in this network.' : 'No anomalies match the current filter.'}</p>
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
