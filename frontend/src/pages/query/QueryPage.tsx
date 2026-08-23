import { useEffect, useState } from 'react'
import {
  Search, Sparkles, Clock, ArrowRight, User,
  Network, GitBranch, AlertTriangle, FolderOpen, Loader2,
} from 'lucide-react'
import { queryApi } from '../../api/query'
import { ErrorAlert } from '../../components/shared/ErrorAlert'
import { getErrorMessage } from '../../api/client'

interface QueryResult {
  query: string
  intent: string
  entities_detected: string[]
  disclaimer: string
  results: unknown
  result_type?: string
  summary?: string
}

const RESULT_TYPE_ICONS: Record<string, React.ReactNode> = {
  PATH:        <ArrowRight className="h-4 w-4 text-indigo-400" />,
  CONNECTION:  <Network className="h-4 w-4 text-indigo-400" />,
  NEIGHBORS:   <User className="h-4 w-4 text-blue-400" />,
  INFLUENCERS: <Network className="h-4 w-4 text-amber-400" />,
  COMMUNITIES: <GitBranch className="h-4 w-4 text-emerald-400" />,
  ANOMALIES:   <AlertTriangle className="h-4 w-4 text-red-400" />,
  PERSONS:     <User className="h-4 w-4 text-blue-400" />,
  CASE:        <FolderOpen className="h-4 w-4 text-indigo-400" />,
  GENERAL:     <Search className="h-4 w-4 text-slate-400" />,
}

function ResultView({ result }: { result: QueryResult }) {
  const icon = result.result_type ? RESULT_TYPE_ICONS[result.result_type] : <Search className="h-4 w-4 text-slate-400" />

  return (
    <div className="card p-5 space-y-4 animate-slide-up">
      {/* Summary */}
      <div className="flex items-start gap-3">
        <div className="mt-0.5">{icon}</div>
        <div>
          <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">
            Intent: {result.intent?.replace(/_/g, ' ')} · Type: {result.result_type || 'general'}
          </p>
          <p className="font-semibold text-slate-100">{result.summary || 'Query executed'}</p>
          {result.entities_detected?.length > 0 && (
            <p className="text-xs text-slate-500 mt-1">
              Entities detected: {result.entities_detected.join(', ')}
            </p>
          )}
        </div>
      </div>

      {/* Results */}
      <div className="border-t border-slate-800 pt-4">
        {/* PATH result */}
        {result.result_type === 'PATH' && Array.isArray(result.results) && result.results[0] && (
          <PathResult data={result.results[0] as Record<string, unknown>} />
        )}

        {/* CONNECTION result */}
        {result.result_type === 'CONNECTION' && Array.isArray(result.results) && result.results[0] && (
          <ConnectionResult data={result.results[0] as Record<string, unknown>} />
        )}

        {/* NEIGHBORS result */}
        {result.result_type === 'NEIGHBORS' && Array.isArray(result.results) && result.results[0] && (
          <NeighborsResult data={result.results[0] as Record<string, unknown>} />
        )}

        {/* INFLUENCERS result */}
        {result.result_type === 'INFLUENCERS' && Array.isArray(result.results) && (
          <InfluencersResult items={result.results as Record<string, unknown>[]} />
        )}

        {/* COMMUNITIES result */}
        {result.result_type === 'COMMUNITIES' && Array.isArray(result.results) && (
          <CommunitiesResult items={result.results as Record<string, unknown>[]} />
        )}

        {/* ANOMALIES result */}
        {result.result_type === 'ANOMALIES' && Array.isArray(result.results) && (
          <AnomaliesResult items={result.results as Record<string, unknown>[]} />
        )}

        {/* PERSONS result */}
        {result.result_type === 'PERSONS' && Array.isArray(result.results) && (
          <PersonsResult items={result.results as Record<string, unknown>[]} />
        )}

        {/* CASE result */}
        {result.result_type === 'CASE' && Array.isArray(result.results) && result.results[0] && (
          <CaseResult data={result.results[0] as Record<string, unknown>} />
        )}

        {/* GENERAL result */}
        {result.result_type === 'GENERAL' && (
          <GeneralResult data={result.results as Record<string, unknown>} />
        )}
      </div>

      <p className="text-xs text-slate-700 italic border-t border-slate-800 pt-3">{result.disclaimer}</p>
    </div>
  )
}

function PathResult({ data }: { data: Record<string, unknown> }) {
  if (!data.found) return <p className="text-sm text-slate-500">{String(data.message || 'No path found')}</p>
  const path = (data.path as Record<string, unknown>[]) || []
  return (
    <div>
      <p className="text-xs text-slate-500 mb-3">Path length: {String(data.length)} hop(s)</p>
      <div className="flex items-center flex-wrap gap-2">
        {path.map((node, i) => (
          <div key={String(node.node_id)} className="flex items-center gap-2">
            <div className="px-3 py-1.5 rounded-lg bg-indigo-900/30 border border-indigo-700/30 text-indigo-300 text-xs font-medium">
              {String(node.label)}
            </div>
            {i < path.length - 1 && <ArrowRight className="h-3.5 w-3.5 text-slate-600" />}
          </div>
        ))}
      </div>
    </div>
  )
}

function ConnectionResult({ data }: { data: Record<string, unknown> }) {
  const path = data.path as Record<string, unknown>
  return <PathResult data={path || {}} />
}

function NeighborsResult({ data }: { data: Record<string, unknown> }) {
  const byHop = (data.neighbors_by_hop as Record<string, Record<string, unknown>[]>) || {}
  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-500">Total: {String(data.total_neighbors)} entities within {String(data.k)} hops</p>
      {Object.entries(byHop).map(([hop, nodes]) => (
        <div key={hop}>
          <p className="text-xs font-semibold text-slate-500 mb-1.5">Hop {hop}</p>
          <div className="flex flex-wrap gap-1.5">
            {nodes.map(n => (
              <span key={String(n.node_id)} className="text-xs px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-slate-300">
                {String(n.label)}
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function InfluencersResult({ items }: { items: Record<string, unknown>[] }) {
  return (
    <div className="space-y-2">
      {items.slice(0, 5).map(inf => (
        <div key={String(inf.node_id)} className="flex items-center justify-between p-2 rounded-lg bg-slate-800/50">
          <div className="flex items-center gap-2">
            <User className="h-3.5 w-3.5 text-slate-500" />
            <span className="text-sm font-medium text-slate-200">{String(inf.label)}</span>
            {!!inf.is_bridge_node && <span className="text-[10px] text-amber-400 bg-amber-900/20 border border-amber-700/20 px-1.5 rounded">bridge</span>}
          </div>
          <div className="text-right">
            <span className="text-xs font-bold text-indigo-400">{Number(inf.influence_score).toFixed(1)}</span>
            <span className="text-[10px] text-slate-600">/100</span>
          </div>
        </div>
      ))}
    </div>
  )
}

function CommunitiesResult({ items }: { items: Record<string, unknown>[] }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {items.map(c => (
        <div key={String(c.id)} className="p-3 rounded-lg bg-slate-800/50 border border-slate-800">
          <p className="text-sm font-semibold text-slate-200">Community {String(c.id)}</p>
          <p className="text-xs text-slate-500">{String(c.size)} members · {String(c.internal_edges)} edges</p>
        </div>
      ))}
    </div>
  )
}

function AnomaliesResult({ items }: { items: Record<string, unknown>[] }) {
  return (
    <div className="space-y-2">
      {items.map((a, i) => (
        <div key={i} className="p-3 rounded-lg bg-amber-900/10 border border-amber-800/20">
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
            <span className="font-semibold text-slate-200 text-sm">{String(a.label)}</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-900/40 text-amber-300 border border-amber-700/30">
              {String(a.severity)}
            </span>
          </div>
          <p className="text-xs text-slate-400">{String(a.description)}</p>
        </div>
      ))}
    </div>
  )
}

function PersonsResult({ items }: { items: Record<string, unknown>[] }) {
  return (
    <div className="space-y-2">
      {items.map(p => (
        <div key={String(p.id || p.person_id)} className="flex items-center justify-between p-2 rounded-lg bg-slate-800/50">
          <div className="flex items-center gap-2">
            <User className="h-3.5 w-3.5 text-slate-500" />
            <div>
              <span className="text-sm font-medium text-slate-200">{String(p.full_name || p.name)}</span>
              {p.alias !== undefined && p.alias !== null && <span className="text-xs text-slate-500 ml-1">aka {String(p.alias)}</span>}
            </div>
          </div>
          <div className="flex gap-1.5">
            {(p.roles as string[] || [p.role as string]).filter(Boolean).map((role: string) => (
              <span key={role} className="text-[10px] px-1.5 py-0.5 rounded bg-slate-700 text-slate-400 border border-slate-600">{role}</span>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function CaseResult({ data }: { data: Record<string, unknown> }) {
  const c = data.case as Record<string, unknown>
  const persons = data.persons as Record<string, unknown>[]
  return (
    <div className="space-y-3">
      <div className="p-3 rounded-lg bg-slate-800/50">
        <p className="font-bold text-indigo-400 text-sm">{String(c?.case_number)}</p>
        <p className="text-slate-200 font-medium">{String(c?.title)}</p>
        <p className="text-xs text-slate-500 mt-1">{String(c?.status)} · {String(c?.priority)} · {String(c?.case_type)}</p>
      </div>
      {persons?.length > 0 && (
        <div>
          <p className="text-xs text-slate-500 mb-1.5">Linked persons:</p>
          <div className="flex flex-wrap gap-1.5">
            {persons.map((p, i) => (
              <span key={i} className="text-xs px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-slate-300">
                {String(p.name)} ({String(p.role)})
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function GeneralResult({ data }: { data: Record<string, unknown> }) {
  const persons = (data?.persons as Record<string, unknown>[]) || []
  const cases = (data?.cases as Record<string, unknown>[]) || []
  return (
    <div className="space-y-3">
      {persons.length > 0 && (
        <div>
          <p className="text-xs text-slate-500 mb-1.5">Persons ({persons.length})</p>
          <div className="flex flex-wrap gap-1.5">
            {persons.map(p => (
              <span key={String(p.id)} className="text-xs px-2 py-0.5 rounded-full bg-indigo-900/30 border border-indigo-700/30 text-indigo-300">
                {String(p.name)}
              </span>
            ))}
          </div>
        </div>
      )}
      {cases.length > 0 && (
        <div>
          <p className="text-xs text-slate-500 mb-1.5">Cases ({cases.length})</p>
          <div className="flex flex-wrap gap-1.5">
            {cases.map(c => (
              <span key={String(c.id)} className="text-xs px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-slate-300">
                {String(c.case_number)}: {String(c.title)}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export function QueryPage() {
  const [query, setQuery] = useState('')
  const [result, setResult] = useState<QueryResult | null>(null)
  const [history, setHistory] = useState<string[]>([])
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    queryApi.getSuggestions()
      .then(data => setSuggestions(data.suggestions || []))
      .catch(() => {})
  }, [])

  const execute = async (q?: string) => {
    const queryText = q || query
    if (!queryText.trim()) return
    setLoading(true); setError(''); setResult(null)
    try {
      const data = await queryApi.execute(queryText)
      setResult(data)
      setHistory(prev => [queryText, ...prev.filter(h => h !== queryText)].slice(0, 10))
      if (!q) setQuery('')
    } catch (e) { setError(getErrorMessage(e)) }
    finally { setLoading(false) }
  }

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <h1 className="text-lg font-bold text-slate-100 flex items-center gap-2">
          <Search className="h-5 w-5 text-indigo-400" /> Investigation Query Engine
        </h1>
        <p className="text-xs text-slate-500 mt-0.5">Ask questions about the network in natural language</p>
      </div>

      <div className="page-content space-y-5">
        <div className="rounded-lg border border-indigo-800/30 bg-indigo-900/10 px-4 py-3">
          <p className="text-xs font-semibold text-indigo-400">Safe Query Engine</p>
          <p className="text-xs text-indigo-500/70 mt-0.5">
            Queries are intent-detected and translated to validated templates. No raw input reaches the database.
            Results are analytical aids requiring investigator review.
          </p>
        </div>

        {error && <ErrorAlert message={error} onClose={() => setError('')} />}

        {/* Query input */}
        <div className="card p-5 space-y-4">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
              <input
                className="input pl-10 text-sm"
                placeholder='e.g. "Who connects Community A and Community B?" or "Find Felix Durand"'
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && execute()}
              />
            </div>
            <button onClick={() => execute()} disabled={loading || !query.trim()} className="btn-primary px-6">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {loading ? 'Querying…' : 'Query'}
            </button>
          </div>

          {/* Suggestions */}
          <div>
            <p className="text-xs text-slate-600 mb-2 flex items-center gap-1">
              <Sparkles className="h-3 w-3" /> Try these queries:
            </p>
            <div className="flex flex-wrap gap-2">
              {suggestions.map((s, i) => (
                <button key={i} onClick={() => execute(s)}
                  className="text-xs px-3 py-1.5 rounded-full border border-slate-700 text-slate-400
                    hover:border-indigo-600/50 hover:text-indigo-400 hover:bg-indigo-900/10 transition-colors">
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Result */}
        {loading && (
          <div className="card p-8 flex items-center justify-center gap-3 text-slate-400">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-sm">Analyzing query…</span>
          </div>
        )}
        {!loading && result && <ResultView result={result} />}

        {/* History */}
        {history.length > 0 && (
          <div className="card p-4">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" /> Recent Queries
            </p>
            <div className="space-y-1">
              {history.map((h, i) => (
                <button key={i} onClick={() => execute(h)}
                  className="w-full text-left text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-800/50
                    px-3 py-2 rounded-lg transition-colors flex items-center gap-2">
                  <Clock className="h-3 w-3 text-slate-600 shrink-0" />
                  {h}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
