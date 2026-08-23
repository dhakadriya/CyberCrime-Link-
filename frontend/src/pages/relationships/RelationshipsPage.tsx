import { useEffect, useState, useCallback } from 'react'
import ReactFlow, {
  Background, Controls, MiniMap, Node, Edge,
  BackgroundVariant, MarkerType,
} from 'reactflow'
import 'reactflow/dist/style.css'
import { casesApi } from '../../api/cases'
import { apiClient } from '../../api/client'
import { PageLoader } from '../../components/shared/LoadingSpinner'
import { ErrorAlert } from '../../components/shared/ErrorAlert'
import { getErrorMessage } from '../../api/client'
import type { Case, GraphNode, GraphEdge } from '../../types'
import { Link } from 'react-router-dom'

const NODE_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  PERSON: { bg: '#eff6ff', border: '#3b82f6', text: '#1d4ed8' },
  CASE: { bg: '#f0fdf4', border: '#22c55e', text: '#15803d' },
  EVIDENCE: { bg: '#fdf4ff', border: '#a855f7', text: '#7e22ce' },
  DEFAULT: { bg: '#f8fafc', border: '#94a3b8', text: '#475569' },
}

function buildFlowNodes(nodes: GraphNode[]): Node[] {
  return nodes.map((n, i) => {
    const colors = NODE_COLORS[n.type] ?? NODE_COLORS.DEFAULT
    return {
      id: n.id,
      position: { x: (i % 5) * 200 + 50, y: Math.floor(i / 5) * 160 + 50 },
      data: { label: n.label, type: n.type, ...n.data },
      style: {
        background: colors.bg,
        border: `2px solid ${colors.border}`,
        color: colors.text,
        borderRadius: 10,
        padding: '8px 14px',
        fontSize: 12,
        fontWeight: 600,
        minWidth: 120,
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
    style: { stroke: e.strength === 'STRONG' ? '#6366f1' : e.strength === 'MEDIUM' ? '#f59e0b' : '#94a3b8' },
    markerEnd: { type: MarkerType.ArrowClosed },
    labelStyle: { fontSize: 10, fill: '#64748b' },
    labelBgStyle: { fill: '#f8fafc' },
  }))
}

export function RelationshipsPage() {
  const [cases, setCases] = useState<Case[]>([])
  const [selectedCase, setSelectedCase] = useState('')
  const [nodes, setNodes] = useState<Node[]>([])
  const [edges, setEdges] = useState<Edge[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingGraph, setLoadingGraph] = useState(false)
  const [error, setError] = useState('')
  const [addRel, setAddRel] = useState(false)
  const [relForm, setRelForm] = useState({ source_type: 'PERSON', source_id: '', target_type: 'PERSON', target_id: '', relationship_type: 'ASSOCIATED_WITH', strength: 'MEDIUM', notes: '' })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    casesApi.list({ size: 50 })
      .then(r => { setCases(r.items); if (r.items[0]) setSelectedCase(r.items[0].id) })
      .catch(e => setError(getErrorMessage(e)))
      .finally(() => setLoading(false))
  }, [])

  const loadGraph = useCallback(async (caseId: string) => {
    if (!caseId) return
    setLoadingGraph(true)
    try {
      const g = await casesApi.getGraph(caseId)
      setNodes(buildFlowNodes(g.nodes))
      setEdges(buildFlowEdges(g.edges))
    } catch (e) { setError(getErrorMessage(e)) }
    finally { setLoadingGraph(false) }
  }, [])

  useEffect(() => { if (selectedCase) loadGraph(selectedCase) }, [selectedCase, loadGraph])

  const handleAddRelationship = async () => {
    setSaving(true)
    try {
      await apiClient.post('/relationships', { ...relForm, case_id: selectedCase })
      setAddRel(false)
      loadGraph(selectedCase)
    } catch (e) { setError(getErrorMessage(e)) }
    finally { setSaving(false) }
  }

  if (loading) return <PageLoader />

  return (
    <div className="flex flex-col h-full">
      <div className="page-header flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Relationship Graph</h1>
          <p className="text-sm text-slate-500 mt-0.5">Visualise connections between persons, cases and evidence</p>
        </div>
        <button onClick={() => setAddRel(v => !v)} className="btn-secondary text-xs">+ Add Relationship</button>
      </div>

      <div className="px-6 pt-4 flex gap-3">
        {error && <ErrorAlert message={error} onClose={() => setError('')} />}
      </div>

      <div className="px-6 pb-3 flex gap-3 items-center">
        <label className="text-sm font-medium text-slate-600 shrink-0">Case:</label>
        <select className="input max-w-sm" value={selectedCase} onChange={e => setSelectedCase(e.target.value)}>
          {cases.map(c => <option key={c.id} value={c.id}>{c.case_number} — {c.title}</option>)}
        </select>
        <div className="flex gap-3 text-xs text-slate-400 items-center ml-4">
          <span className="flex items-center gap-1"><span className="h-3 w-6 rounded" style={{ background: '#6366f1' }} /> Strong</span>
          <span className="flex items-center gap-1"><span className="h-3 w-6 rounded" style={{ background: '#f59e0b' }} /> Medium</span>
          <span className="flex items-center gap-1"><span className="h-3 w-6 rounded" style={{ background: '#94a3b8' }} /> Weak</span>
        </div>
      </div>

      {/* Add relationship form */}
      {addRel && (
        <div className="mx-6 mb-3 card p-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Source Type', key: 'source_type', options: ['PERSON', 'CASE', 'EVIDENCE', 'LOCATION', 'VEHICLE'] },
            { label: 'Target Type', key: 'target_type', options: ['PERSON', 'CASE', 'EVIDENCE', 'LOCATION', 'VEHICLE'] },
            { label: 'Relationship', key: 'relationship_type', options: ['FRIEND_OF', 'ASSOCIATED_WITH', 'OWNER_OF', 'WITNESS_TO', 'RELATED_TO', 'LINKED_TO'] },
            { label: 'Strength', key: 'strength', options: ['WEAK', 'MEDIUM', 'STRONG'] },
          ].map(({ label, key, options }) => (
            <div key={key}>
              <label className="label">{label}</label>
              <select className="input" value={(relForm as any)[key]} onChange={e => setRelForm(f => ({ ...f, [key]: e.target.value }))}>
                {options.map(o => <option key={o}>{o}</option>)}
              </select>
            </div>
          ))}
          <div>
            <label className="label">Source ID (UUID)</label>
            <input className="input" placeholder="Paste UUID" value={relForm.source_id} onChange={e => setRelForm(f => ({ ...f, source_id: e.target.value }))} />
          </div>
          <div>
            <label className="label">Target ID (UUID)</label>
            <input className="input" placeholder="Paste UUID" value={relForm.target_id} onChange={e => setRelForm(f => ({ ...f, target_id: e.target.value }))} />
          </div>
          <div className="col-span-2">
            <label className="label">Notes</label>
            <input className="input" placeholder="Optional notes" value={relForm.notes} onChange={e => setRelForm(f => ({ ...f, notes: e.target.value }))} />
          </div>
          <div className="flex gap-2 items-end col-span-2">
            <button onClick={handleAddRelationship} disabled={saving || !relForm.source_id || !relForm.target_id} className="btn-primary">
              {saving ? 'Saving…' : 'Add Relationship'}
            </button>
            <button onClick={() => setAddRel(false)} className="btn-secondary">Cancel</button>
          </div>
        </div>
      )}

      {/* Graph */}
      <div className="flex-1 mx-6 mb-6 card overflow-hidden" style={{ minHeight: 480 }}>
        {loadingGraph ? (
          <div className="h-full flex items-center justify-center"><PageLoader /></div>
        ) : nodes.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-2">
            <p>No relationships found for this case.</p>
            <p className="text-xs">Add persons to the case or create relationships to see them here.</p>
          </div>
        ) : (
          <ReactFlow nodes={nodes} edges={edges} fitView>
            <Background variant={BackgroundVariant.Dots} gap={16} size={1} color="#e2e8f0" />
            <Controls />
            <MiniMap />
          </ReactFlow>
        )}
      </div>
    </div>
  )
}
