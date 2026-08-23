import { useEffect, useState } from 'react'
import { Brain, TrendingUp, Users, GitBranch, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react'
import { networkApi } from '../../api/network'
import { casesApi } from '../../api/cases'
import { PageLoader } from '../../components/shared/LoadingSpinner'
import { ErrorAlert } from '../../components/shared/ErrorAlert'
import { getErrorMessage } from '../../api/client'
import type { Case } from '../../types'

interface Influencer {
  node_id: string
  label: string
  node_type: string
  influence_score: number
  degree_centrality: number
  betweenness_centrality: number
  pagerank: number
  degree: number
  in_degree: number
  out_degree: number
  is_bridge_node: boolean
  communities: number[]
}

interface NetworkOverview {
  nodes: number
  edges: number
  components: number
  density: number
  influencers: Influencer[]
  communities: { id: number; size: number; internal_edges: number; members: string[] }[]
  anomalies: { type: string; node_id: string; label: string; severity: string; description: string; confidence: number }[]
  disclaimer: string
}

function MetricBar({ value, max = 1, color = 'bg-indigo-500' }: { value: number; max?: number; color?: string }) {
  const pct = Math.min(100, (value / max) * 100)
  return (
    <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
      <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${pct}%` }} />
    </div>
  )
}

function InfluencerCard({ inf, rank }: { inf: Influencer; rank: number }) {
  const [expanded, setExpanded] = useState(false)
  const scoreColor = inf.influence_score > 70 ? 'text-red-400' : inf.influence_score > 40 ? 'text-amber-400' : 'text-slate-400'
  const barColor = inf.influence_score > 70 ? 'bg-red-500' : inf.influence_score > 40 ? 'bg-amber-500' : 'bg-slate-500'

  return (
    <div className="card p-4">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-800 border border-slate-700 text-sm font-bold text-slate-400">
            #{rank}
          </div>
          <div>
            <p className="font-semibold text-slate-100 text-sm">{inf.label}</p>
            <p className="text-xs text-slate-500">{inf.node_type}</p>
          </div>
        </div>
        <div className="text-right">
          <p className={`text-2xl font-bold ${scoreColor}`}>{inf.influence_score.toFixed(1)}</p>
          <p className="text-xs text-slate-600">/ 100</p>
        </div>
      </div>

      <div className="mb-3">
        <MetricBar value={inf.influence_score} max={100} color={barColor} />
      </div>

      <div className="grid grid-cols-3 gap-2 mb-3">
        {[
          { label: 'Degree', value: inf.degree_centrality.toFixed(3) },
          { label: 'Betweenness', value: inf.betweenness_centrality.toFixed(3) },
          { label: 'PageRank', value: inf.pagerank.toFixed(4) },
        ].map(({ label, value }) => (
          <div key={label} className="rounded-lg bg-slate-800/60 p-2 text-center">
            <p className="text-xs font-mono font-medium text-slate-300">{value}</p>
            <p className="text-[10px] text-slate-600 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {inf.is_bridge_node && (
        <div className="rounded-lg bg-amber-900/20 border border-amber-700/30 px-3 py-2 mb-3">
          <p className="text-xs font-semibold text-amber-400">⚠ Potential Network Bridge</p>
          <p className="text-xs text-amber-500/70 mt-0.5">
            Connects {inf.communities.length} communities · High betweenness centrality
          </p>
        </div>
      )}

      <button
        onClick={() => setExpanded(v => !v)}
        className="text-xs text-slate-600 hover:text-slate-400 flex items-center gap-1 transition-colors"
      >
        {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        {expanded ? 'Less' : 'More'} detail
      </button>

      {expanded && (
        <div className="mt-3 pt-3 border-t border-slate-800 space-y-1.5">
          <div className="flex justify-between text-xs">
            <span className="text-slate-500">Total connections</span>
            <span className="text-slate-300 font-mono">{inf.degree}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-slate-500">In-degree</span>
            <span className="text-slate-300 font-mono">{inf.in_degree}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-slate-500">Out-degree</span>
            <span className="text-slate-300 font-mono">{inf.out_degree}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-slate-500">Communities</span>
            <span className="text-slate-300 font-mono">{inf.communities.join(', ') || 'None'}</span>
          </div>
          <p className="text-[10px] text-slate-600 italic pt-1">
            High centrality is an analytical signal, not evidence of wrongdoing.
          </p>
        </div>
      )}
    </div>
  )
}

export function NetworkAnalysisPage() {
  const [cases, setCases] = useState<Case[]>([])
  const [selectedCase, setSelectedCase] = useState('')
  const [overview, setOverview] = useState<NetworkOverview | null>(null)
  const [loading, setLoading] = useState(true)
  const [analyzing, setAnalyzing] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    casesApi.list({ size: 50 })
      .then(r => { setCases(r.items); if (r.items[0]) setSelectedCase(r.items[0].id) })
      .catch(e => setError(getErrorMessage(e)))
      .finally(() => setLoading(false))
  }, [])

  const runAnalysis = async (caseId?: string) => {
    setAnalyzing(true); setError('')
    try {
      const data = await networkApi.getOverview(caseId || undefined)
      setOverview(data)
    } catch (e) { setError(getErrorMessage(e)) }
    finally { setAnalyzing(false) }
  }

  useEffect(() => {
    if (selectedCase) runAnalysis(selectedCase)
  }, [selectedCase])

  if (loading) return <PageLoader />

  return (
    <div className="animate-fade-in">
      <div className="page-header flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-slate-100 flex items-center gap-2">
            <Brain className="h-5 w-5 text-indigo-400" /> Network Analysis
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">Centrality metrics, influencer detection, and graph intelligence</p>
        </div>
        <button onClick={() => runAnalysis(selectedCase || undefined)} disabled={analyzing} className="btn-secondary text-xs py-1.5">
          <RefreshCw className={`h-3.5 w-3.5 ${analyzing ? 'animate-spin' : ''}`} />
          Re-analyze
        </button>
      </div>

      <div className="page-content space-y-5">
        {/* Disclaimer */}
        <div className="rounded-lg border border-amber-800/30 bg-amber-900/10 px-4 py-3">
          <p className="text-xs font-semibold text-amber-400">⚠ ANALYTICAL AID ONLY</p>
          <p className="text-xs text-amber-500/70 mt-0.5">
            Network analysis scores indicate data patterns only. High centrality does not establish criminal responsibility.
            All findings require human investigator review.
          </p>
        </div>

        {error && <ErrorAlert message={error} onClose={() => setError('')} />}

        {/* Case selector */}
        <div className="card p-4 flex items-center gap-3">
          <label className="text-xs font-medium text-slate-400 shrink-0">Scope:</label>
          <select className="input max-w-sm text-xs py-1.5" value={selectedCase}
            onChange={e => setSelectedCase(e.target.value)}>
            <option value="">All Cases (Global Network)</option>
            {cases.map(c => <option key={c.id} value={c.id}>{c.case_number} — {c.title}</option>)}
          </select>
        </div>

        {analyzing && <div className="flex items-center gap-2 text-sm text-slate-400 px-1"><PageLoader /><span>Running analysis…</span></div>}

        {overview && !analyzing && (
          <>
            {/* Summary stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                { icon: <Users className="h-5 w-5 text-indigo-400" />, label: 'Network Nodes', value: overview.nodes, color: 'bg-indigo-500/10' },
                { icon: <GitBranch className="h-5 w-5 text-blue-400" />, label: 'Relationships', value: overview.edges, color: 'bg-blue-500/10' },
                { icon: <Brain className="h-5 w-5 text-violet-400" />, label: 'Communities', value: overview.communities.length, color: 'bg-violet-500/10' },
                { icon: <TrendingUp className="h-5 w-5 text-emerald-400" />, label: 'Components', value: overview.components, color: 'bg-emerald-500/10' },
              ].map(({ icon, label, value, color }) => (
                <div key={label} className="card p-4 flex items-start gap-3">
                  <div className={`rounded-lg p-2 ${color}`}>{icon}</div>
                  <div>
                    <p className="text-xl font-bold text-slate-100">{value}</p>
                    <p className="text-xs text-slate-500">{label}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Network density */}
            {overview.density > 0 && (
              <div className="card p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-slate-400">Network Density</span>
                  <span className="text-xs font-mono text-slate-300">{overview.density.toFixed(4)}</span>
                </div>
                <MetricBar value={overview.density} max={1} color="bg-indigo-500" />
                <p className="text-xs text-slate-600 mt-1">
                  {overview.density > 0.3 ? 'Dense network — many interconnections' :
                   overview.density > 0.1 ? 'Moderately connected network' :
                   'Sparse network — few interconnections'}
                </p>
              </div>
            )}

            {/* Top influencers */}
            {overview.influencers.length > 0 && (
              <div>
                <h2 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-amber-400" />
                  Top Network Influencers
                  <span className="text-xs text-slate-600 font-normal">— composite centrality score</span>
                </h2>
                <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3">
                  {overview.influencers.slice(0, 9).map((inf, i) => (
                    <InfluencerCard key={inf.node_id} inf={inf} rank={i + 1} />
                  ))}
                </div>
              </div>
            )}

            {overview.nodes === 0 && (
              <div className="card p-12 text-center text-slate-600">
                <Brain className="h-12 w-12 mx-auto mb-3 opacity-20" />
                <p>No network data available for this scope.</p>
                <p className="text-xs mt-1">Add persons and relationships to build the network.</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
