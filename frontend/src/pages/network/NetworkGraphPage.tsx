import { useEffect, useState, useCallback, useMemo } from 'react'
import ReactFlow, {
  Background, Controls, MiniMap, Node, Edge,
  BackgroundVariant, MarkerType, useNodesState, useEdgesState,
} from 'reactflow'
import 'reactflow/dist/style.css'
import {
  Network, RefreshCw, Filter, ZoomIn, User,
  GitBranch, MapPin, Car, Info, X, Compass, Route, HelpCircle
} from 'lucide-react'
import { casesApi } from '../../api/cases'
import { networkApi } from '../../api/network'
import { personsApi } from '../../api/persons'
import { PageLoader } from '../../components/shared/LoadingSpinner'
import { ErrorAlert } from '../../components/shared/ErrorAlert'
import { getErrorMessage } from '../../api/client'
import { useTheme } from '../../context/ThemeContext'
import type { Case, GraphNode, GraphEdge } from '../../types'
import clsx from 'clsx'

const NODE_COLORS_DARK: Record<string, { bg: string; border: string; text: string }> = {
  PERSON:       { bg: '#1e1b4b', border: '#6366f1', text: '#a5b4fc' },
  CASE:         { bg: '#052e16', border: '#16a34a', text: '#86efac' },
  EVIDENCE:     { bg: '#2e1065', border: '#9333ea', text: '#d8b4fe' },
  LOCATION:     { bg: '#0c1a2e', border: '#0ea5e9', text: '#7dd3fc' },
  VEHICLE:      { bg: '#271005', border: '#f97316', text: '#fdba74' },
  DEFAULT:      { bg: '#1e293b', border: '#475569', text: '#94a3b8' },
}

const NODE_COLORS_LIGHT: Record<string, { bg: string; border: string; text: string }> = {
  PERSON:       { bg: '#f4f3ff', border: '#5b4bdb', text: '#5b4bdb' },
  CASE:         { bg: '#fef2f2', border: '#f04438', text: '#f04438' },
  EVIDENCE:     { bg: '#fdf4ff', border: '#c084fc', text: '#701a75' },
  LOCATION:     { bg: '#f0fdfa', border: '#0ea5a4', text: '#0f766e' },
  VEHICLE:      { bg: '#fffbeb', border: '#f59e0b', text: '#b45309' },
  DEFAULT:      { bg: '#f8fafc', border: '#94a3b8', text: '#475569' },
}

// ── Force-Directed Layout Generator ──────────────────────────────────────────
function computeForceDirectedLayout(nodes: GraphNode[], edges: GraphEdge[], iterations = 75) {
  const layoutNodes = nodes.map((n, i) => {
    const angle = (i / nodes.length) * 2 * Math.PI
    const radius = 140 + Math.random() * 60
    return {
      id: n.id,
      x: 350 + Math.cos(angle) * radius,
      y: 280 + Math.sin(angle) * radius,
      vx: 0,
      vy: 0,
      label: n.label,
      type: n.type,
      data: n.data,
    }
  })

  const nodeMap = new Map(layoutNodes.map(n => [n.id, n]))
  const k = 130 // Optimal spring distance
  const forceAttract = 0.05
  const forceRepel = 22000
  const forceGravity = 0.02
  const centerX = 350
  const centerY = 280

  for (let step = 0; step < iterations; step++) {
    // 1. Repulsive forces
    for (let i = 0; i < layoutNodes.length; i++) {
      const u = layoutNodes[i]
      for (let j = i + 1; j < layoutNodes.length; j++) {
        const v = layoutNodes[j]
        const dx = u.x - v.x
        const dy = u.y - v.y
        const distSq = dx * dx + dy * dy + 0.01
        const dist = Math.sqrt(distSq)
        if (dist < 380) {
          const f = forceRepel / distSq
          const fx = (dx / dist) * f
          const fy = (dy / dist) * f
          u.vx += fx
          u.vy += fy
          v.vx -= fx
          v.vy -= fy
        }
      }
    }

    // 2. Attractive forces
    for (const edge of edges) {
      const u = nodeMap.get(edge.source)
      const v = nodeMap.get(edge.target)
      if (u && v) {
        const dx = v.x - u.x
        const dy = v.y - u.y
        const dist = Math.sqrt(dx * dx + dy * dy) + 0.01
        const f = forceAttract * (dist - k)
        const fx = (dx / dist) * f
        const fy = (dy / dist) * f
        u.vx += fx
        u.vy += fy
        v.vx -= fx
        v.vy -= fy
      }
    }

    // 3. Gravity & damping
    for (const node of layoutNodes) {
      node.vx += (centerX - node.x) * forceGravity
      node.vy += (centerY - node.y) * forceGravity

      const speedSq = node.vx * node.vx + node.vy * node.vy
      const maxSpeed = 30
      if (speedSq > maxSpeed * maxSpeed) {
        const speed = Math.sqrt(speedSq)
        node.vx = (node.vx / speed) * maxSpeed
        node.vy = (node.vy / speed) * maxSpeed
      }

      node.x += node.vx
      node.y += node.vy
      node.vx *= 0.8
      node.vy *= 0.8
    }
  }

  return layoutNodes.map(n => ({
    id: n.id,
    position: { x: Math.round(n.x), y: Math.round(n.y) },
    label: n.label,
    type: n.type,
    data: n.data,
  }))
}

function buildFlowNodes(
  nodes: any[],
  communities?: Record<string, number>,
  highlightedIds: string[] = [],
  theme: string = 'light'
): Node[] {
  const NODE_COLORS = theme === 'dark' ? NODE_COLORS_DARK : NODE_COLORS_LIGHT
  const communityColors = theme === 'dark'
    ? ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4']
    : ['#5B4BDB', '#12B76A', '#F79009', '#F04438', '#8B5CF6', '#2E90FA']

  return nodes.map((n) => {
    const colors = NODE_COLORS[n.type] ?? NODE_COLORS.DEFAULT
    const communityId = communities?.[n.id]
    const isHighlighted = highlightedIds.includes(n.id)

    const borderColor = isHighlighted
      ? '#eab308' // Gold
      : (communityId !== undefined
          ? communityColors[communityId % communityColors.length]
          : colors.border)

    return {
      id: n.id,
      position: n.position,
      data: { label: n.label, type: n.type, nodeData: n.data },
      style: {
        background: colors.bg,
        border: `2px solid ${borderColor}`,
        color: isHighlighted ? (theme === 'dark' ? '#fef08a' : '#854d0e') : colors.text,
        borderRadius: 12,
        padding: '8px 14px',
        fontSize: 11,
        fontWeight: 600,
        minWidth: 120,
        textAlign: 'center',
        cursor: 'pointer',
        boxShadow: isHighlighted 
          ? `0 0 20px rgba(234, 179, 8, 0.5)` 
          : (theme === 'dark' ? `0 0 12px ${borderColor}20` : `0 2px 6px ${borderColor}15`),
        transition: 'all 0.2s ease',
      },
    }
  })
}

function buildFlowEdges(edges: GraphEdge[], highlightedIds: string[] = [], theme: string = 'light'): Edge[] {
  const edgeColor = theme === 'dark' ? '#334155' : '#cbd5e1'
  return edges.map(e => {
    const isHighlighted = highlightedIds.includes(e.id)
    return {
      id: e.id,
      source: e.source,
      target: e.target,
      label: e.label,
      type: 'smoothstep',
      style: {
        stroke: isHighlighted
          ? '#eab308'
          : (e.strength === 'STRONG' ? (theme === 'dark' ? '#6366f1' : '#5B4BDB') : e.strength === 'MEDIUM' ? '#f59e0b' : edgeColor),
        strokeWidth: isHighlighted ? 3 : (e.strength === 'STRONG' ? 2.5 : 1.5),
        opacity: isHighlighted ? 1.0 : 0.75,
      },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: isHighlighted ? '#eab308' : (e.strength === 'STRONG' ? (theme === 'dark' ? '#6366f1' : '#5B4BDB') : (theme === 'dark' ? '#475569' : '#cbd5e1'))
      },
      labelStyle: { fontSize: 9, fill: theme === 'dark' ? '#64748b' : '#667085', fontWeight: 500 },
      labelBgStyle: { fill: theme === 'dark' ? '#0f172a' : '#ffffff', fillOpacity: 0.8 },
      labelBgPadding: [4, 2] as [number, number],
    }
  })
}

interface NodeDetail {
  id: string;
  label: string;
  type: string;
  data: Record<string, any>;
}

export function NetworkGraphPage() {
  const { theme } = useTheme()
  const [cases, setCases] = useState<Case[]>([])
  const [selectedCase, setSelectedCase] = useState('')
  const [nodes, setNodes, onNodesChange] = useNodesState([])
  const [edges, setEdges, onEdgesChange] = useEdgesState([])
  const [rawNodes, setRawNodes] = useState<GraphNode[]>([])
  const [rawEdges, setRawEdges] = useState<GraphEdge[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingGraph, setLoadingGraph] = useState(false)
  const [error, setError] = useState('')
  const [selectedNode, setSelectedNode] = useState<NodeDetail | null>(null)
  const [personDetails, setPersonDetails] = useState<any>(null)
  const [nodeMetrics, setNodeMetrics] = useState<any>(null)
  const [networkStats, setNetworkStats] = useState<any>(null)
  const [showLegend, setShowLegend] = useState(true)

  // Spacing layout variables
  const [communityMap, setCommunityMap] = useState<Record<string, number>>({})

  // Pathfinder and Filters
  const [pathSource, setPathSource] = useState('')
  const [pathTarget, setPathTarget] = useState('')
  const [pathError, setPathError] = useState('')
  const [highlightedNodes, setHighlightedNodes] = useState<string[]>([])
  const [highlightedEdges, setHighlightedEdges] = useState<string[]>([])

  const [nodeTypeFilter, setNodeTypeFilter] = useState('')
  const [edgeStrengthFilter, setEdgeStrengthFilter] = useState('')

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
    setError('')
    setHighlightedNodes([])
    setHighlightedEdges([])
    setPathSource('')
    setPathTarget('')
    setPathError('')
    try {
      const [graphData, netStats] = await Promise.all([
        casesApi.getGraph(caseId),
        networkApi.getOverview(caseId),
      ])
      
      const commMap: Record<string, number> = {}
      if (netStats.communities) {
        netStats.communities.forEach((comm: { id: number; members: string[] }) => {
          comm.members.forEach((m: string) => { commMap[m] = comm.id - 1 })
        })
      }
      setCommunityMap(commMap)
      setRawNodes(graphData.nodes)
      setRawEdges(graphData.edges)

      // Initial layout
      const positioned = computeForceDirectedLayout(graphData.nodes, graphData.edges)
      setNodes(buildFlowNodes(positioned, commMap, [], theme))
      setEdges(buildFlowEdges(graphData.edges, [], theme))
      setNetworkStats(netStats)
    } catch (e) {
      setError(getErrorMessage(e))
    } finally {
      setLoadingGraph(false)
    }
  }, [setNodes, setEdges, theme])

  useEffect(() => {
    if (selectedCase) loadGraph(selectedCase)
  }, [selectedCase, loadGraph])

  // Filter application
  useEffect(() => {
    if (rawNodes.length === 0) return

    // Filter nodes
    const filteredNodes = nodeTypeFilter
      ? rawNodes.filter(n => n.type === nodeTypeFilter)
      : rawNodes

    const filteredNodeIds = new Set(filteredNodes.map(n => n.id))

    // Filter edges
    const filteredEdges = rawEdges.filter(e => {
      const hasNodes = filteredNodeIds.has(e.source) && filteredNodeIds.has(e.target)
      const matchesStrength = !edgeStrengthFilter || e.strength === edgeStrengthFilter
      return hasNodes && matchesStrength
    })

    const positioned = computeForceDirectedLayout(filteredNodes, filteredEdges)
    setNodes(buildFlowNodes(positioned, communityMap, highlightedNodes, theme))
    setEdges(buildFlowEdges(filteredEdges, highlightedEdges, theme))
  }, [nodeTypeFilter, edgeStrengthFilter, rawNodes, rawEdges, communityMap, highlightedNodes, highlightedEdges, theme])

  // Shortest Path execution
  const executePathfinder = async () => {
    if (!pathSource || !pathTarget) return
    setPathError('')
    try {
      const res = await networkApi.getShortestPath(pathSource, pathTarget)
      if (res.found && Array.isArray(res.path)) {
        const pNodes = res.path.map((p: any) => p.node_id)
        setHighlightedNodes(pNodes)

        // Map edges on the path
        const edgeIds: string[] = []
        for (let i = 0; i < pNodes.length - 1; i++) {
          const fromNode = pNodes[i]
          const toNode = pNodes[i + 1]
          const match = rawEdges.find(e => 
            (e.source === fromNode && e.target === toNode) ||
            (e.source === toNode && e.target === fromNode)
          )
          if (match) edgeIds.push(match.id)
        }
        setHighlightedEdges(edgeIds)
      } else {
        setPathError(res.message || 'No connection path exists between these entities.')
        setHighlightedNodes([])
        setHighlightedEdges([])
      }
    } catch {
      setPathError('Could not compute path.')
    }
  }

  const clearPathfinder = () => {
    setHighlightedNodes([])
    setHighlightedEdges([])
    setPathSource('')
    setPathTarget('')
    setPathError('')
  }

  const handleNodeClick = useCallback(async (_: React.MouseEvent, node: Node) => {
    const detail: NodeDetail = {
      id: node.id,
      label: node.data.label,
      type: node.data.type,
      data: node.data.nodeData || {},
    }
    setSelectedNode(detail)
    setPersonDetails(null)
    setNodeMetrics(null)

    // Load detailed person record if type matches
    if (detail.type === 'PERSON') {
      personsApi.get(detail.id)
        .then(res => setPersonDetails(res))
        .catch(() => {})
    }

    // Load neighborhood metrics
    try {
      const neighbors = await networkApi.getNeighbors(node.id, 2)
      setNodeMetrics(neighbors)
    } catch {
      setNodeMetrics(null)
    }
  }, [])

  if (loading) return <PageLoader />

  const stats = networkStats
  const influencers = stats?.influencers || []
  const thisInfluencer = influencers.find((inf: any) => inf.node_id === selectedNode?.id)

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* Header */}
      <div className="page-header border-b border-slate-700 bg-slate-900 px-6 py-4 flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
            <Network className="h-5 w-5 text-indigo-600" /> Network Graph
          </h1>
          <p className="text-xs text-slate-400 mt-1">Interactive criminal relationship and bridge nodes visualizer</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowLegend(v => !v)} className="btn-secondary text-xs h-[36px] flex items-center gap-1.5">
            <Info className="h-4 w-4 text-[#475467]" /> Legend
          </button>
          <button onClick={() => loadGraph(selectedCase)} disabled={loadingGraph} className="btn-secondary text-xs h-[36px] flex items-center gap-1.5">
            <RefreshCw className={clsx("h-4 w-4 text-[#475467]", loadingGraph && "animate-spin")} />
            Refresh
          </button>
        </div>
      </div>

      {error && <div className="px-6 pt-3 shrink-0"><ErrorAlert message={error} onClose={() => setError('')} /></div>}

      {/* Controls panel */}
      <div className="px-6 py-3 flex flex-wrap gap-4 items-center shrink-0 border-b border-slate-700 bg-slate-950">
        {/* Case selector */}
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-slate-400" />
          <select
            className="input w-64 text-xs h-9"
            value={selectedCase}
            onChange={e => setSelectedCase(e.target.value)}
          >
            {cases.map(c => (
              <option key={c.id} value={c.id}>{c.case_number} — {c.title}</option>
            ))}
          </select>
        </div>

        {/* Node & Edge filters */}
        <div className="flex gap-2">
          <select
            className="input w-36 text-xs h-9"
            value={nodeTypeFilter}
            onChange={e => setNodeTypeFilter(e.target.value)}
          >
            <option value="">All Entities</option>
            <option value="PERSON">Persons</option>
            <option value="LOCATION">Locations</option>
            <option value="VEHICLE">Vehicles</option>
          </select>

          <select
            className="input w-36 text-xs h-9"
            value={edgeStrengthFilter}
            onChange={e => setEdgeStrengthFilter(e.target.value)}
          >
            <option value="">All Strengths</option>
            <option value="STRONG">Strong</option>
            <option value="MEDIUM">Medium</option>
            <option value="WEAK">Weak</option>
          </select>
        </div>

        {/* Pathfinder */}
        <div className="flex items-center gap-2 border-l border-slate-700 pl-4">
          <Route className="h-4 w-4 text-indigo-600" />
          <select
            className="input w-36 text-xs h-9"
            value={pathSource}
            onChange={e => setPathSource(e.target.value)}
          >
            <option value="">Source Node</option>
            {rawNodes.map(n => <option key={n.id} value={n.id}>{n.label}</option>)}
          </select>
          <span className="text-slate-400 text-xs font-bold">→</span>
          <select
            className="input w-36 text-xs h-9"
            value={pathTarget}
            onChange={e => setPathTarget(e.target.value)}
          >
            <option value="">Target Node</option>
            {rawNodes.map(n => <option key={n.id} value={n.id}>{n.label}</option>)}
          </select>
          <button
            onClick={executePathfinder}
            disabled={!pathSource || !pathTarget}
            className="btn-primary text-xs px-3 h-9 disabled:opacity-40"
          >
            Find Path
          </button>
          {(highlightedNodes.length > 0) && (
            <button onClick={clearPathfinder} className="text-xs text-slate-400 hover:text-slate-100 font-bold ml-2">
              Clear Path
            </button>
          )}
        </div>
      </div>

      {pathError && (
        <div className="px-6 py-1.5 shrink-0 bg-red-950/20 text-red-400 text-xs border-b border-red-900/30">
          ⚠️ {pathError}
        </div>
      )}

      {/* Main workspace */}
      <div className="flex flex-1 overflow-hidden px-6 pb-6 pt-4 gap-4">
        {/* ReactFlow graph container */}
        <div className="flex-1 rounded-xl border border-slate-850 bg-slate-950 relative overflow-hidden">
          {loadingGraph ? (
            <div className="h-full flex items-center justify-center">
              <PageLoader />
            </div>
          ) : nodes.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-600 gap-3">
              <Network className="h-12 w-12 opacity-30 animate-pulse-glow" />
              <p className="text-sm font-semibold">No active relationships found.</p>
              <p className="text-xs text-slate-500">Ensure the database is seeded or import files to see the graph.</p>
            </div>
          ) : (
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onNodeClick={handleNodeClick}
              fitView
              fitViewOptions={{ padding: 0.15 }}
              minZoom={0.05}
              maxZoom={2.5}
            >
              <Background variant={BackgroundVariant.Dots} gap={24} size={1} color={theme === 'dark' ? '#334155' : '#cbd5e1'} />
              <Controls showInteractive={false} />
              <MiniMap
                nodeColor={(n) => {
                  const t = n.data?.type as string
                  const c = theme === 'dark' ? NODE_COLORS_DARK[t] : NODE_COLORS_LIGHT[t]
                  return c?.border ?? (theme === 'dark' ? NODE_COLORS_DARK.DEFAULT.border : NODE_COLORS_LIGHT.DEFAULT.border)
                }}
                maskColor={theme === 'dark' ? "rgba(15,23,42,0.85)" : "rgba(255,255,255,0.85)"}
                style={{ background: theme === 'dark' ? '#111827' : '#ffffff', border: theme === 'dark' ? '1px solid #1f2937' : '1px solid #e2e8f0' }}
              />
            </ReactFlow>
          )}
        </div>

        {/* Legend panel */}
        {showLegend && !selectedNode && (
          <div className="w-60 shrink-0 space-y-3 animate-fade-in">
            <div className="card p-4 bg-slate-900/80 border-slate-800">
              <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                <Compass className="h-3.5 w-3.5 text-indigo-400" /> Entity Types
              </h3>
              <div className="space-y-2">
                {[
                  { type: 'PERSON', icon: <User className="h-3.5 w-3.5" />, label: 'Person / Subject' },
                  { type: 'LOCATION', icon: <MapPin className="h-3.5 w-3.5" />, label: 'Address / Location' },
                  { type: 'VEHICLE', icon: <Car className="h-3.5 w-3.5" />, label: 'Vehicle registration' },
                  { type: 'CASE', icon: <Network className="h-3.5 w-3.5" />, label: 'Active Investigation' },
                ].map(({ type, icon, label }) => {
                  const c = theme === 'dark' ? NODE_COLORS_DARK[type] : NODE_COLORS_LIGHT[type]
                  return (
                    <div key={type} className="flex items-center gap-2.5">
                      <div className="h-6 w-6 rounded-lg flex items-center justify-center shrink-0"
                        style={{ background: c.bg, border: `1px solid ${c.border}`, color: c.text }}>
                        {icon}
                      </div>
                      <span className="text-xs text-slate-400 font-medium">{label}</span>
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="card p-4 bg-slate-900/80 border-slate-800">
              <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Relationship Strengths</h3>
              <div className="space-y-2.5">
                {[
                  { color: '#6366f1', label: 'Strong (Direct/Frequent)' },
                  { color: '#f59e0b', label: 'Medium (Intermittent)' },
                  { color: '#334155', label: 'Weak (Transient/Indirect)' },
                  { color: '#eab308', label: 'Pathfinder Route Hops' },
                ].map(({ color, label }) => (
                  <div key={label} className="flex items-center gap-3">
                    <div className="h-0.5 w-8 rounded shrink-0" style={{ background: color, height: label.includes('Pathfinder') ? 3 : 2 }} />
                    <span className="text-xs text-slate-500 font-medium">{label}</span>
                  </div>
                ))}
              </div>
            </div>

            {stats?.communities?.length > 0 && (
              <div className="card p-4 bg-slate-900/80 border-slate-800">
                <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Communities detected</h3>
                <div className="max-h-36 overflow-y-auto space-y-2">
                  {(stats.communities as Array<{ id: number; size: number }>).map((c, i) => {
                    const comColors = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4']
                    return (
                      <div key={c.id} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="h-2.5 w-2.5 rounded-full" style={{ background: comColors[i % comColors.length] }} />
                          <span className="text-xs text-slate-400 font-medium">Community {String(c.id).padStart(2, '0')}</span>
                        </div>
                        <span className="text-[10px] font-semibold text-slate-500">{c.size} nodes</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Selected Node Details Drawer */}
        {selectedNode && (
          <div className="w-72 shrink-0 animate-slide-up">
            <div className="card p-4 bg-slate-900/90 border-slate-800 h-full overflow-y-auto space-y-4 shadow-2xl flex flex-col justify-between">
              <div className="space-y-4">
                <div className="flex items-start justify-between">
                  <div>
                    <span className={clsx(
                      "text-[9px] font-bold px-1.5 py-0.5 rounded border tracking-widest uppercase",
                      selectedNode.type === 'PERSON' ? 'bg-indigo-950 text-indigo-300 border-indigo-800/30' :
                      selectedNode.type === 'VEHICLE' ? 'bg-orange-950 text-orange-300 border-orange-800/30' :
                      selectedNode.type === 'LOCATION' ? 'bg-emerald-950 text-emerald-300 border-emerald-800/30' :
                      'bg-slate-800 text-slate-400'
                    )}>
                      {selectedNode.type}
                    </span>
                    <h3 className="font-bold text-slate-100 text-sm mt-2">{selectedNode.label}</h3>
                    {personDetails?.alias && (
                      <p className="text-xs text-slate-500">aka "{personDetails.alias}"</p>
                    )}
                  </div>
                  <button onClick={() => { setSelectedNode(null); setPersonDetails(null) }} className="text-slate-500 hover:text-slate-300">
                    <X className="h-4 w-4" />
                  </button>
                </div>

                {/* Person Profile parameters */}
                {selectedNode.type === 'PERSON' && personDetails && (
                  <div className="border-t border-slate-800/60 pt-3 space-y-2">
                    <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Subject Profile</p>
                    <div className="text-xs space-y-1.5">
                      <p className="flex justify-between"><span className="text-slate-500">Occupation:</span> <span className="text-slate-300">{personDetails.occupation || 'N/A'}</span></p>
                      <p className="flex justify-between"><span className="text-slate-500">Phone:</span> <span className="text-slate-300 font-mono">{personDetails.phone || 'N/A'}</span></p>
                      <p className="flex justify-between"><span className="text-slate-500">Nationality:</span> <span className="text-slate-300">{personDetails.nationality || 'N/A'}</span></p>
                      <p className="flex justify-between"><span className="text-slate-500">Address:</span> <span className="text-slate-300 text-right truncate max-w-[150px]" title={personDetails.address}>{personDetails.address || 'N/A'}</span></p>
                    </div>
                  </div>
                )}

                {/* Centrality Metrics */}
                {thisInfluencer && (
                  <div className="border-t border-slate-800/60 pt-3 space-y-2">
                    <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Network Metrics</p>
                    <div className="space-y-1.5 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500">Influence Score</span>
                        <span className="font-mono font-bold text-indigo-400">{Number(thisInfluencer.influence_score).toFixed(1)} / 100</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500">PageRank</span>
                        <span className="font-mono text-slate-300">{Number(thisInfluencer.pagerank).toFixed(4)}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500">Betweenness</span>
                        <span className="font-mono text-slate-300">{Number(thisInfluencer.betweenness_centrality).toFixed(4)}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500">Connections (Degree)</span>
                        <span className="font-mono text-slate-300">{thisInfluencer.degree}</span>
                      </div>
                    </div>

                    {thisInfluencer.is_bridge_node && (
                      <div className="rounded-lg bg-amber-900/15 border border-amber-700/20 p-2.5 mt-2 animate-pulse-glow">
                        <p className="text-[10px] font-bold text-amber-500 flex items-center gap-1">
                          ⚠️ POTENTIAL COMMUNITY BRIDGE
                        </p>
                        <p className="text-[10px] text-amber-600 mt-1 leading-normal">
                          This node bridges multiple distinct clusters. May serve as coordinate bridge.
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Case History links */}
                {selectedNode.type === 'PERSON' && personDetails?.case_history?.length > 0 && (
                  <div className="border-t border-slate-800/60 pt-3 space-y-1.5">
                    <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Linked Cases</p>
                    <div className="space-y-1">
                      {personDetails.case_history.map((c: any) => (
                        <div key={c.case_id} className="text-xs bg-slate-950/40 border border-slate-850 p-2 rounded flex justify-between items-center">
                          <span className="font-mono text-[10px] font-bold text-indigo-400">{c.case_number}</span>
                          <span className="text-[10px] text-slate-500">{c.role}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="border-t border-slate-850 pt-3 mt-4">
                <p className="text-[10px] text-slate-600 leading-normal italic">
                  Metrics derived from NetworkX degree centralities. High scores indicate connectivity and not legal culpability.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
