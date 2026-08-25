import { useEffect, useState, useCallback } from 'react'
import { Boxes, Search, Users, MapPin, Car, RefreshCw, Filter } from 'lucide-react'
import { entitiesApi } from '../../api/entities'
import { PageLoader } from '../../components/shared/LoadingSpinner'
import { ErrorAlert } from '../../components/shared/ErrorAlert'
import { Pagination } from '../../components/shared/Pagination'
import { getErrorMessage } from '../../api/client'

interface Entity {
  id: string; type: string; name: string; alias?: string; sub_info: string
  contact: string; address: string; case_count: number; relationship_count: number; notes: string
}

interface Stats { persons: number; locations: number; vehicles: number; relationships: number; suspects: number; victims: number }

const ENTITY_ICONS: Record<string, React.ReactNode> = {
  PERSON:   <Users className="h-4 w-4" />,
  LOCATION: <MapPin className="h-4 w-4" />,
  VEHICLE:  <Car className="h-4 w-4" />,
}

const ENTITY_COLORS: Record<string, string> = {
  PERSON:   'bg-indigo-100 text-indigo-800 border-indigo-300 dark:bg-indigo-900/30 dark:text-indigo-400 dark:border-indigo-700/30',
  LOCATION: 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-700/30',
  VEHICLE:  'bg-orange-100 text-orange-800 border-orange-300 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-700/30',
};

export function EntitiesPage() {
  const [entities, setEntities] = useState<Entity[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [pages, setPages] = useState(1)
  const SIZE = 30

  const load = useCallback(async (p = 1, s = search, t = typeFilter) => {
    setLoading(true); setError('')
    try {
      const [entData, statsData] = await Promise.all([
        entitiesApi.list({ page: p, size: SIZE, search: s || undefined, entity_type: t || undefined }),
        entitiesApi.getStats(),
      ])
      setEntities(entData.items || [])
      setTotal(entData.total || 0)
      setPages(entData.pages || 1)
      setStats(statsData)
      setPage(p)
    } catch (e) { setError(getErrorMessage(e)) }
    finally { setLoading(false) }
  }, [search, typeFilter])

  useEffect(() => { load(1) }, [])

  const handleSearch = () => load(1, search, typeFilter)
  const handleTypeFilter = (t: string) => { setTypeFilter(t); load(1, search, t) }

  return (
    <div className="animate-fade-in">
      <div className="page-header flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-slate-100 flex items-center gap-2">
            <Boxes className="h-5 w-5 text-violet-400" /> Entities
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">All persons, locations, and vehicles in the investigation</p>
        </div>
        <button onClick={() => load(1)} className="btn-secondary text-xs py-1.5">
          <RefreshCw className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="page-content space-y-4">
        {error && <ErrorAlert message={error} onClose={() => setError('')} />}

        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-3 lg:grid-cols-6 gap-3">
            {[
              { label: 'Persons', value: stats.persons, color: 'text-indigo-400' },
              { label: 'Suspects', value: stats.suspects, color: 'text-orange-400' },
              { label: 'Victims', value: stats.victims, color: 'text-red-400' },
              { label: 'Locations', value: stats.locations, color: 'text-emerald-400' },
              { label: 'Vehicles', value: stats.vehicles, color: 'text-amber-400' },
              { label: 'Relationships', value: stats.relationships, color: 'text-violet-400' },
            ].map(({ label, value, color }) => (
              <div key={label} className="card p-3 text-center">
                <p className={`text-2xl font-bold ${color}`}>{value}</p>
                <p className="text-xs text-slate-500 mt-0.5">{label}</p>
              </div>
            ))}
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-wrap gap-3 items-center">
          <div className="flex items-center gap-2 flex-1 min-w-[200px]">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" />
              <input
                className="input pl-9 text-sm"
                placeholder="Search entities…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
              />
            </div>
            <button onClick={handleSearch} className="btn-primary text-xs py-2">
              <Search className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="flex items-center gap-1 p-1 bg-slate-900 rounded-lg border border-slate-800">
            <Filter className="h-3.5 w-3.5 text-slate-600 ml-2" />
            {['', 'PERSON', 'LOCATION', 'VEHICLE'].map(t => (
              <button key={t} onClick={() => handleTypeFilter(t)}
                className={`text-xs px-3 py-1.5 rounded-md transition-colors ${
                  typeFilter === t ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}>
                {t || 'All'}
              </button>
            ))}
          </div>
        </div>

        {/* Entity table */}
        <div className="card overflow-hidden">
          {loading ? (
            <PageLoader />
          ) : entities.length === 0 ? (
            <div className="p-12 text-center text-slate-600">
              <Boxes className="h-12 w-12 mx-auto mb-3 opacity-20" />
              <p>No entities found.</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-900/50">
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">Type</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">Name</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">Info</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">Cases</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">Relationships</th>
                </tr>
              </thead>
              <tbody>
                {entities.map(entity => (
                  <tr key={entity.id} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded border text-xs font-medium ${ENTITY_COLORS[entity.type] || 'bg-slate-800 text-slate-400 border-slate-700'}`}>
                        {ENTITY_ICONS[entity.type]}
                        {entity.type}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-200">{entity.name}</p>
                      {entity.alias && <p className="text-xs text-slate-500">aka {entity.alias}</p>}
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-xs text-slate-400">{entity.sub_info}</p>
                      {entity.contact && <p className="text-xs text-slate-600">{entity.contact}</p>}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-slate-300 font-mono text-xs">{entity.case_count}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-slate-300 font-mono text-xs">{entity.relationship_count}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <Pagination page={page} pages={pages} total={total} size={SIZE} onChange={p => load(p)} />
      </div>
    </div>
  )
}
