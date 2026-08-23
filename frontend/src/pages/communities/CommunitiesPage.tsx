import { useEffect, useState } from 'react'
import { GitBranch, Users, RefreshCw, ChevronRight, Network } from 'lucide-react'
import { networkApi } from '../../api/network'
import { casesApi } from '../../api/cases'
import { PageLoader } from '../../components/shared/LoadingSpinner'
import { ErrorAlert } from '../../components/shared/ErrorAlert'
import { getErrorMessage } from '../../api/client'
import type { Case } from '../../types'

interface Community {
  id: number
  size: number
  internal_edges: number
  members: string[]
}

interface InfluencerNode {
  node_id: string
  label: string
  influence_score: number
  is_bridge_node: boolean
  communities: number[]
}

const COMMUNITY_COLORS = [
  { bg: 'bg-indigo-900/30', border: 'border-indigo-700/40', text: 'text-indigo-300', dot: 'bg-indigo-500', badge: 'bg-indigo-500/20 text-indigo-300' },
  { bg: 'bg-emerald-900/30', border: 'border-emerald-700/40', text: 'text-emerald-300', dot: 'bg-emerald-500', badge: 'bg-emerald-500/20 text-emerald-300' },
  { bg: 'bg-amber-900/30', border: 'border-amber-700/40', text: 'text-amber-300', dot: 'bg-amber-500', badge: 'bg-amber-500/20 text-amber-300' },
  { bg: 'bg-red-900/30', border: 'border-red-700/40', text: 'text-red-300', dot: 'bg-red-500', badge: 'bg-red-500/20 text-red-300' },
  { bg: 'bg-violet-900/30', border: 'border-violet-700/40', text: 'text-violet-300', dot: 'bg-violet-500', badge: 'bg-violet-500/20 text-violet-300' },
  { bg: 'bg-cyan-900/30', border: 'border-cyan-700/40', text: 'text-cyan-300', dot: 'bg-cyan-500', badge: 'bg-cyan-500/20 text-cyan-300' },
]

export function CommunitiesPage() {
  const [cases, setCases] = useState<Case[]>([])
  const [selectedCase, setSelectedCase] = useState('')
  const [communities, setCommunities] = useState<Community[]>([])
  const [influencers, setInfluencers] = useState<InfluencerNode[]>([])
  const [totalNodes, setTotalNodes] = useState(0)
  const [loading, setLoading] = useState(true)
  const [analyzing, setAnalyzing] = useState(false)
  const [error, setError] = useState('')
  const [selectedComm, setSelectedComm] = useState<number | null>(null)
  const [memberLabels, setMemberLabels] = useState<Record<string, string>>({})

  useEffect(() => {
    casesApi.list({ size: 50 })
      .then(r => { setCases(r.items); if (r.items[0]) setSelectedCase(r.items[0].id) })
      .catch(e => setError(getErrorMessage(e)))
      .finally(() => setLoading(false))
  }, [])

  const loadCommunities = async (caseId?: string) => {
    setAnalyzing(true); setError('')
    try {
      const [commData, netData] = await Promise.all([
        networkApi.getCommunities(caseId || undefined),
        networkApi.getOverview(caseId || undefined),
      ])
      setCommunities(commData.communities || [])
      setInfluencers(netData.influencers || [])
      setTotalNodes(netData.nodes || 0)
      // Build label map
      const lm: Record<string, string> = {}
      for (const inf of (netData.influencers || [])) {
        lm[inf.node_id] = inf.label
      }
      setMemberLabels(lm)
    } catch (e) { setError(getErrorMessage(e)) }
    finally { setAnalyzing(false) }
  }

  useEffect(() => {
    loadCommunities(selectedCase || undefined)
  }, [selectedCase])

  // Find bridge nodes between communities
  const bridgeNodes = influencers.filter(inf => inf.is_bridge_node && inf.communities.length >= 2)

  const selectedCommunity = communities.find(c => c.id === selectedComm)

  if (loading) return <PageLoader />

  return (
    <div className="animate-fade-in">
      <div className="page-header flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-slate-100 flex items-center gap-2">
            <GitBranch className="h-5 w-5 text-emerald-400" /> Community Detection
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">Detected subgroups within the criminal network</p>
        </div>
        <button onClick={() => loadCommunities(selectedCase || undefined)} disabled={analyzing} className="btn-secondary text-xs py-1.5">
          <RefreshCw className={`h-3.5 w-3.5 ${analyzing ? 'animate-spin' : ''}`} />
          Re-detect
        </button>
      </div>

      <div className="page-content space-y-5">
        <div className="rounded-lg border border-blue-800/30 bg-blue-900/10 px-4 py-3">
          <p className="text-xs font-semibold text-blue-400">Community Detection Algorithm</p>
          <p className="text-xs text-blue-500/70 mt-0.5">
            Using greedy modularity optimization to identify densely connected subgroups.
            Communities represent patterns of association — not confirmed criminal groupings.
          </p>
        </div>

        {error && <ErrorAlert message={error} onClose={() => setError('')} />}

        <div className="card p-4 flex items-center gap-3">
          <label className="text-xs font-medium text-slate-400 shrink-0">Scope:</label>
          <select className="input max-w-sm text-xs py-1.5" value={selectedCase}
            onChange={e => setSelectedCase(e.target.value)}>
            <option value="">All Cases (Global Network)</option>
            {cases.map(c => <option key={c.id} value={c.id}>{c.case_number} — {c.title}</option>)}
          </select>
        </div>

        {analyzing && <PageLoader />}

        {!analyzing && (
          <>
            {/* Summary */}
            <div className="grid grid-cols-3 gap-3">
              <div className="card p-4 text-center">
                <p className="text-3xl font-bold text-emerald-400">{communities.length}</p>
                <p className="text-xs text-slate-500 mt-1">Communities Detected</p>
              </div>
              <div className="card p-4 text-center">
                <p className="text-3xl font-bold text-slate-200">{totalNodes}</p>
                <p className="text-xs text-slate-500 mt-1">Total Nodes</p>
              </div>
              <div className="card p-4 text-center">
                <p className="text-3xl font-bold text-amber-400">{bridgeNodes.length}</p>
                <p className="text-xs text-slate-500 mt-1">Bridge Nodes</p>
              </div>
            </div>

            {communities.length === 0 ? (
              <div className="card p-12 text-center text-slate-600">
                <GitBranch className="h-12 w-12 mx-auto mb-3 opacity-20" />
                <p>No communities detected.</p>
                <p className="text-xs mt-1">Need at least 3 nodes with relationships to detect communities.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Community list */}
                <div className="lg:col-span-2 space-y-3">
                  <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Detected Communities</h2>
                  {communities.map((comm, i) => {
                    const c = COMMUNITY_COLORS[i % COMMUNITY_COLORS.length]
                    const isSelected = selectedComm === comm.id
                    const commBridges = bridgeNodes.filter(n => n.communities.includes(comm.id))

                    return (
                      <div
                        key={comm.id}
                        onClick={() => setSelectedComm(isSelected ? null : comm.id)}
                        className={`card p-4 cursor-pointer transition-colors hover:border-slate-700 ${isSelected ? `${c.bg} ${c.border}` : ''}`}
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <div className={`h-3 w-3 rounded-full ${c.dot} shrink-0`} />
                            <h3 className="font-semibold text-slate-100 text-sm">Community {comm.id}</h3>
                            {commBridges.length > 0 && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-900/40 text-amber-400 border border-amber-700/30">
                                Bridge nodes: {commBridges.length}
                              </span>
                            )}
                          </div>
                          <ChevronRight className={`h-4 w-4 text-slate-600 transition-transform ${isSelected ? 'rotate-90' : ''}`} />
                        </div>

                        <div className="grid grid-cols-3 gap-2 mb-3">
                          <div className="text-center">
                            <p className="text-lg font-bold text-slate-200">{comm.size}</p>
                            <p className="text-[10px] text-slate-500">Members</p>
                          </div>
                          <div className="text-center">
                            <p className="text-lg font-bold text-slate-200">{comm.internal_edges}</p>
                            <p className="text-[10px] text-slate-500">Internal Edges</p>
                          </div>
                          <div className="text-center">
                            <p className="text-lg font-bold text-slate-200">
                              {comm.size > 1 ? (comm.internal_edges / (comm.size * (comm.size - 1) / 2) * 100).toFixed(0) : 0}%
                            </p>
                            <p className="text-[10px] text-slate-500">Density</p>
                          </div>
                        </div>

                        {/* Members preview */}
                        <div className="flex flex-wrap gap-1.5">
                          {comm.members.slice(0, 6).map(memberId => (
                            <span key={memberId} className={`text-[10px] px-2 py-0.5 rounded-full ${c.badge}`}>
                              {memberLabels[memberId] || memberId.slice(0, 8) + '…'}
                            </span>
                          ))}
                          {comm.members.length > 6 && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-500">
                              +{comm.members.length - 6} more
                            </span>
                          )}
                        </div>

                        {/* Expanded member list */}
                        {isSelected && comm.members.length > 6 && (
                          <div className="mt-3 pt-3 border-t border-slate-800">
                            <p className="text-xs text-slate-500 mb-2">All members:</p>
                            <div className="flex flex-wrap gap-1.5">
                              {comm.members.map(memberId => (
                                <span key={memberId} className={`text-[10px] px-2 py-0.5 rounded-full ${c.badge}`}>
                                  {memberLabels[memberId] || memberId.slice(0, 8) + '…'}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>

                {/* Bridge nodes sidebar */}
                <div className="space-y-3">
                  <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Network Bridges</h2>
                  {bridgeNodes.length === 0 ? (
                    <div className="card p-4 text-center text-xs text-slate-600">
                      No bridge nodes detected
                    </div>
                  ) : (
                    bridgeNodes.map(node => (
                      <div key={node.node_id} className="card p-4 border-amber-800/30">
                        <div className="flex items-start justify-between mb-2">
                          <p className="font-semibold text-slate-100 text-sm">{node.label}</p>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-900/30 text-amber-400 border border-amber-700/30">
                            Bridge
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 mb-2">
                          Connects communities: {node.communities.map(c => `#${c}`).join(', ')}
                        </p>
                        <div className="h-1 w-full bg-slate-800 rounded-full">
                          <div className="h-1 rounded-full bg-amber-500"
                            style={{ width: `${Math.min(100, node.influence_score)}%` }} />
                        </div>
                        <p className="text-[10px] text-slate-600 mt-1">
                          Influence: {node.influence_score.toFixed(1)} / 100
                        </p>
                      </div>
                    ))
                  )}

                  <div className="card p-4 mt-4">
                    <p className="text-xs font-semibold text-slate-400 mb-2">What are bridge nodes?</p>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Nodes with high betweenness centrality that connect otherwise separate communities.
                      They may act as intermediaries between groups.
                      This is an investigative signal — not evidence of wrongdoing.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
