import { useEffect, useState, useCallback } from 'react'
import ReactFlow, {
  Background, Controls, MiniMap, Node, Edge,
  BackgroundVariant, MarkerType, useNodesState, useEdgesState,
} from 'reactflow'
import 'reactflow/dist/style.css'
import {
  Network, RefreshCw, Filter, ZoomIn, User,
  GitBranch, MapPin, Car, Info, X,
} from 'lucide-react'
import { casesApi } from '../../api/cases'
import { networkApi } from '../../api/network'
import { PageLoader } from '../../components/shared/LoadingSpinner'
import { ErrorAlert } from '../../components/shared/ErrorAlert'
import { getErrorMessage } from '../../api/client'
import type { Case, GraphNode, GraphEdge } from '../../types'

const NODE_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  PERSON:       { bg: '#1e1b4b', border: '#6366f1', text: '#a5b4fc' },
  CASE:         { bg: '#052e16', border: '#16a34a', text: '#86efac' },
  EVIDENCE:     { bg: '#2e1065', border: '#9333ea', text: '#d8b4fe' },
  LOCATION:     { bg: '#0c1a2e', border: '#0ea5e9', text: '#7dd3fc' },
  VEHICLE:      { bg: '#271005', border: '#f97316', text: '#fdba74' },
  DEFAULT:      { bg: '#1e293b', border: '#475569', text: '#94a3b8' },
}

function buildFlowNodes(nodes: GraphNode[], communities?: Record<string, number>): Node[] {
  return nodes.map((n, i) => {
    const colors = NODE_COLORS[n.type] ?? NODE_COLORS.DEFAULT
    const communityId = communities?.[n.id]
    const communityColors = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4']
    const borderColor = communityId !== undefined
      ? communityColors[communityId % communityColors.length]
      : colors.border

    return {
      id: n.id,
      position: { x: (i % 6) * 220 + 60, y: Math.floor(i / 6) * 180 + 60 },
      data: { label: n.label, type: n.type, nodeData: n.data },
      style: {
        background: colors.bg,
        border: `2px solid ${borderColor}`,
        color: colors.text,
        borderRadius: 12,
        padding: '8px 14px',
        fontSize: 11,
        fontWeight: 600,
        minWidth: 110,
        cursor: 'pointer',
        boxShadow: `0 0 12px ${borderColor}20`,
      },
    }
  })
}

function buildFlowEdges(edges: GraphEdge[]): Edge[] {
  return edges.map(e => ({
    id: e.id,
    source: e.source,
    target: e.target,
    label: e.label,
    type: 'smoothstep',
    style: {
      stroke: e.strength === 'STRONG' ? '#6366f1' : e.strength === 'MEDIUM' ? '#f59e0b' : '#334155',
      strokeWidth: e.strength === 'STRONG' ? 2 : 1,
      opacity: 0.8,
    },
    markerEnd: { type: MarkerType.ArrowClosed, color: e.strength === 'STRONG' ? '#6366f1' : '#475569' },
    labelStyle: { fontSize: 9, fill: '#64748b' },
    labelBgStyle: { fill: '#0f172a', fillOpacity: 0.8 },
    labelBgPadding: [4, 2] as [number, number],
  }))
}

interface NodeDetail {
  id: string;
  label: string;
  type: string;
  data: Record<string, unknown>;
}

export function NetworkGraphPage() {
  const [cases, setCases] = useState<Case[]>([])
  const [selectedCase, setSelectedCase] = useState('')
  const [nodes, setNodes, onNodesChange] = useNodesState([])
  const [edges, setEdges, onEdgesChange] = useEdgesState([])
  const [loading, setLoading] = useState(true)
  const [loadingGraph, setLoadingGraph] = useState(false)
  const [error, setError] = useState('')
  const [selectedNode, setSelectedNode] = useState<NodeDetail | null>(null)
  const [nodeMetrics, setNodeMetrics] = useState<Record<string, unknown> | null>(null)
  const [networkStats, setNetworkStats] = useState<Record<string, unknown> | null>(null)
  const [showLegend, setShowLegend] = useState(true)

  useEffect(() => {
    casesApi.list({ size: 50 })
      .then(r => {
        setCases(r.items)
        if (r.items[0]) setSelectedCase(r.items[0].id)
      })
      .catch(e => setError(getErrorMessage(e)))
      .finally(() => setLoading(false))
  }, [])

  const loadGraph = useCallback(async (caseId: string) => {
    if (!caseId) return
    setLoadingGraph(true)
    try {
      const [graphData, netStats] = await Promise.all([
        casesApi.getGraph(caseId),
        networkApi.getOverview(caseId),
      ])
      // Build community color map
      const communityMap: Record<string, number> = {}
      if (netStats.communities) {
        netStats.communities.forEach((comm: { id: number; members: string[] }) => {
          comm.members.forEach((m: string) => { communityMap[m] = comm.id - 1 })
        })
      }
      setNodes(buildFlowNodes(graphData.nodes, communityMap))
      setEdges(buildFlowEdges(graphData.edges))
      setNetworkStats(netStats)
    } catch (e) {
      setError(getErrorMessage(e))
    } finally {
      setLoadingGraph(false)
    }
  }, [setNodes, setEdges])

  useEffect(() => {
    if (selectedCase) loadGraph(selectedCase)
  }, [selectedCase, loadGraph])

  const handleNodeClick = useCallback(async (_: React.MouseEvent, node: Node) => {
    const detail: NodeDetail = {
      id: node.id,
      label: node.data.label,
      type: node.data.type,
      data: node.data.nodeData || {},
    }
    setSelectedNode(detail)
    // Load metrics for this node
    try {
      const neighbors = await networkApi.getNeighbors(node.id, 2)
      setNodeMetrics(neighbors)
    } catch {
      setNodeMetrics(null)
    }
  }, [])

  if (loading) return <PageLoader />

  const stats = networkStats as Record<string, unknown> | null
  const influencers = (stats?.influencers as unknown[]) || []
  const thisInfluencer = influencers.find((inf: unknown) => (inf as Record<string, unknown>).node_id === selectedNode?.id) as Record<string, unknown> | undefined

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <div className="page-header flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-lg font-bold text-slate-100 flex items-center gap-2">
            <Network className="h-5 w-5 text-indigo-400" /> Network Graph
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">Interactive relationship visualization</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowLegend(v => !v)} className="btn-secondary text-xs py-1.5">
            <Info className="h-3.5 w-3.5" /> Legend
          </button>
          <button onClick={() => loadGraph(selectedCase)} disabled={loadingGraph} className="btn-secondary text-xs py-1.5">
            <RefreshCw className={`h-3.5 w-3.5 ${loadingGraph ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {error && <div className="px-6 pt-3 shrink-0"><ErrorAlert message={error} onClose={() => setError('')} /></div>}

      {/* Controls bar */}
      <div className="px-6 pt-3 pb-2 flex items-center gap-3 shrink-0">
        <Filter className="h-4 w-4 text-slate-500 shrink-0" />
        <select
          className="input max-w-sm text-xs py-1.5"
          value={selectedCase}
          onChange={e => setSelectedCase(e.target.value)}
        >
          {cases.map(c => (
            <option key={c.id} value={c.id}>{c.case_number} — {c.title}</option>
          ))}
        </select>

        {stats && (
          <div className="flex items-center gap-4 text-xs text-slate-500 ml-2">
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-indigo-500" />
              {String(stats.nodes || 0)} nodes
            </span>
            <span className="flex items-center gap-1">
              <span className="h-px w-4 bg-slate-500" />
              {String(stats.edges || 0)} edges
            </span>
            <span className="flex items-center gap-1">
              <GitBranch className="h-3 w-3" />
              {((stats.communities as unknown[]) || []).length} communities
            </span>
          </div>
        )}
      </div>

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden px-6 pb-6 gap-4">
        {/* Graph */}
        <div className="flex-1 rounded-xl border border-slate-800 overflow-hidden bg-slate-950" style={{ minHeight: 400 }}>
          {loadingGraph ? (
            <div className="h-full flex items-center justify-center">
              <PageLoader />
            </div>
          ) : nodes.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-600 gap-3">
              <Network className="h-12 w-12 opacity-30" />
              <p className="text-sm">No relationships found for this case.</p>
              <p className="text-xs">Add persons and create relationships to visualise the network.</p>
            </div>
          ) : (
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onNodeClick={handleNodeClick}
              fitView
              fitViewOptions={{ padding: 0.2 }}
              minZoom={0.1}
              maxZoom={2}
            >
              <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#1e293b" />
              <Controls showInteractive={false} />
              <MiniMap
                nodeColor={(n) => {
                  const t = n.data?.type as string
                  const c = NODE_COLORS[t] ?? NODE_COLORS.DEFAULT
                  return c.border
                }}
                maskColor="rgba(15,23,42,0.8)"
                style={{ background: '#1e293b' }}
              />
            </ReactFlow>
          )}
        </div>

        {/* Legend panel */}
        {showLegend && !selectedNode && (
          <div className="w-56 shrink-0 space-y-3">
            <div className="card p-4">
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Entity Types</h3>
              <div className="space-y-2">
                {[
                  { type: 'PERSON', icon: <User className="h-3.5 w-3.5" />, label: 'Person' },
                  { type: 'LOCATION', icon: <MapPin className="h-3.5 w-3.5" />, label: 'Location' },
                  { type: 'VEHICLE', icon: <Car className="h-3.5 w-3.5" />, label: 'Vehicle' },
                  { type: 'CASE', icon: <Network className="h-3.5 w-3.5" />, label: 'Case' },
                ].map(({ type, icon, label }) => {
                  const c = NODE_COLORS[type]
                  return (
                    <div key={type} className="flex items-center gap-2">
                      <div className="h-5 w-5 rounded flex items-center justify-center"
                        style={{ background: c.bg, border: `1px solid ${c.border}`, color: c.text }}>
                        {icon}
                      </div>
                      <span className="text-xs text-slate-400">{label}</span>
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="card p-4">
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Edge Strength</h3>
              <div className="space-y-2">
                {[
                  { color: '#6366f1', label: 'Strong' },
                  { color: '#f59e0b', label: 'Medium' },
                  { color: '#334155', label: 'Weak' },
                ].map(({ color, label }) => (
                  <div key={label} className="flex items-center gap-2">
                    <div className="h-px w-8 rounded" style={{ background: color, height: 2 }} />
                    <span className="text-xs text-slate-400">{label}</span>
                  </div>
                ))}
              </div>
            </div>

            {stats && (stats.communities as unknown[]).length > 0 && (
              <div className="card p-4">
                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Communities</h3>
                {(stats.communities as Array<{ id: number; size: number }>).map((c, i) => {
                  const comColors = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6']
                  return (
                    <div key={c.id} className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-1.5">
                        <div className="h-2.5 w-2.5 rounded-full" style={{ background: comColors[i % comColors.length] }} />
                        <span className="text-xs text-slate-400">Community {c.id}</span>
                      </div>
                      <span className="text-xs text-slate-500">{c.size} nodes</span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* Node detail panel */}
        {selectedNode && (
          <div className="w-64 shrink-0">
            <div className="card p-4 space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-slate-500 uppercase tracking-wider">{selectedNode.type}</p>
                  <h3 className="font-semibold text-slate-100 mt-0.5">{selectedNode.label}</h3>
                </div>
                <button onClick={() => setSelectedNode(null)} className="text-slate-600 hover:text-slate-400">
                  <X className="h-4 w-4" />
                </button>
              </div>

              {thisInfluencer && (
                <>
                  <div className="border-t border-slate-800 pt-3">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Network Metrics</p>
                    <div className="space-y-2">
                      {[
                        { label: 'Connections', value: String(thisInfluencer.degree) },
                        { label: 'Degree Centrality', value: Number(thisInfluencer.degree_centrality).toFixed(3) },
                        { label: 'Betweenness', value: Number(thisInfluencer.betweenness_centrality).toFixed(3) },
                        { label: 'PageRank', value: Number(thisInfluencer.pagerank).toFixed(3) },
                        { label: 'Influence Score', value: `${Number(thisInfluencer.influence_score).toFixed(1)} / 100` },
                      ].map(({ label, value }) => (
                        <div key={label} className="flex items-center justify-between">
                          <span className="text-xs text-slate-500">{label}</span>
                          <span className="text-xs font-mono font-medium text-slate-300">{value}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {thisInfluencer.is_bridge_node && (
                    <div className="rounded-lg bg-amber-900/20 border border-amber-700/30 p-3">
                      <p className="text-xs font-semibold text-amber-400">⚠ Potential Network Bridge</p>
                      <p className="text-xs text-amber-500/80 mt-1">
                        This node connects {(thisInfluencer.communities as unknown[]).length} communities.
                        High betweenness centrality indicates bridging role.
                      </p>
                    </div>
                  )}
                </>
              )}

              {nodeMetrics && (
                <div className="border-t border-slate-800 pt-3">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                    2-Hop Neighborhood
                  </p>
                  <p className="text-xs text-slate-400">
                    {(nodeMetrics as Record<string, unknown>).total_neighbors as number ?? 0} entity(ies) within 2 degrees
                  </p>
                </div>
              )}

              <div className="border-t border-slate-800 pt-3">
                <p className="text-xs text-slate-600 italic">
                  Network metrics are analytical aids only. High centrality does not indicate criminal responsibility.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
