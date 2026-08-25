import { useEffect, useState, useCallback } from 'react'
import { Map, RefreshCw, Filter, MapPin, FolderOpen, Users, Layers } from 'lucide-react'
import { geospatialApi } from '../../api/geospatial'
import { casesApi } from '../../api/cases'
import { PageLoader } from '../../components/shared/LoadingSpinner'
import { ErrorAlert } from '../../components/shared/ErrorAlert'
import { StatusBadge } from '../../components/shared/StatusBadge'
import { getErrorMessage } from '../../api/client'
import { useTheme } from '../../context/ThemeContext'
import type { Case } from '../../types'

interface GeoFeature {
  type: 'Feature'
  geometry: { type: 'Point'; coordinates: [number, number] }
  properties: {
    id: string; feature_type: string; name: string; title: string
    location_text: string; marker_color: string
    status?: string; priority?: string; case_type?: string
    alias?: string; occupation?: string; phone?: string
  }
}

interface GeoData {
  geojson: { type: string; features: GeoFeature[] }
  stats: { total_features: number; case_locations: number; person_locations: number; stored_locations: number }
  disclaimer: string
}

// Lightweight SVG map renderer (no external map lib needed)
function SimpleMapView({ features, filter, theme }: { features: GeoFeature[]; filter: string; theme: string }) {
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [selected, setSelected] = useState<GeoFeature | null>(null)

  const filtered = filter ? features.filter(f => f.properties.feature_type === filter) : features

  if (filtered.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-slate-600">
        <Map className="h-12 w-12 mb-3 opacity-20" />
        <p className="text-sm">No location data for the selected filter.</p>
      </div>
    )
  }

  // Compute bounding box
  const lats = filtered.map(f => f.geometry.coordinates[1])
  const lngs = filtered.map(f => f.geometry.coordinates[0])
  const minLat = Math.min(...lats), maxLat = Math.max(...lats)
  const minLng = Math.min(...lngs), maxLng = Math.max(...lngs)
  const padLat = (maxLat - minLat) * 0.15 || 0.5
  const padLng = (maxLng - minLng) * 0.15 || 0.5

  const toX = (lng: number) => ((lng - minLng + padLng) / (maxLng - minLng + 2 * padLng)) * 100
  const toY = (lat: number) => (1 - (lat - minLat + padLat) / (maxLat - minLat + 2 * padLat)) * 100

  const TYPE_ICONS: Record<string, string> = { CASE: '⬛', PERSON: '●', LOCATION: '◆' }

  return (
    <div className="relative h-full">
      {/* SVG Map */}
      <svg
        viewBox="0 0 100 100"
        className="w-full h-full"
        style={{
          background: theme === 'dark'
            ? 'radial-gradient(ellipse at center, #0d1b2a 0%, #050d15 100%)'
            : 'radial-gradient(ellipse at center, #f8fafc 0%, #e2e8f0 100%)'
        }}
      >
        {/* Grid lines */}
        {[20, 40, 60, 80].map(v => (
          <g key={v} opacity={theme === 'dark' ? "0.06" : "0.2"}>
            <line x1={v} y1="0" x2={v} y2="100" stroke={theme === 'dark' ? "#64748b" : "#94a3b8"} strokeWidth="0.2" />
            <line x1="0" y1={v} x2="100" y2={v} stroke={theme === 'dark' ? "#64748b" : "#94a3b8"} strokeWidth="0.2" />
          </g>
        ))}

        {/* Connection lines between features */}
        {filtered.length > 1 && filtered.slice(0, -1).map((f, i) => {
          const next = filtered[i + 1]
          return (
            <line key={`line-${i}`}
              x1={toX(f.geometry.coordinates[0])}
              y1={toY(f.geometry.coordinates[1])}
              x2={toX(next.geometry.coordinates[0])}
              y2={toY(next.geometry.coordinates[1])}
              stroke={theme === 'dark' ? "#334155" : "#cbd5e1"} strokeWidth="0.3" strokeDasharray="1,1" opacity="0.5"
            />
          )
        })}

        {/* Markers */}
        {filtered.map(feature => {
          const cx = toX(feature.geometry.coordinates[0])
          const cy = toY(feature.geometry.coordinates[1])
          const isHovered = hoveredId === feature.properties.id
          const isSelected = selected?.properties.id === feature.properties.id
          const r = isHovered || isSelected ? 3.5 : 2.5

          return (
            <g key={feature.properties.id}
              onMouseEnter={() => setHoveredId(feature.properties.id)}
              onMouseLeave={() => setHoveredId(null)}
              onClick={() => setSelected(s => s?.properties.id === feature.properties.id ? null : feature)}
              style={{ cursor: 'pointer' }}>
              {/* Pulse ring */}
              {(isHovered || isSelected) && (
                <circle cx={cx} cy={cy} r={r + 2} fill="none"
                  stroke={feature.properties.marker_color} strokeWidth="0.5" opacity="0.4" />
              )}
              <circle cx={cx} cy={cy} r={r}
                fill={feature.properties.marker_color}
                stroke={theme === 'dark' ? "#0f172a" : "#ffffff"} strokeWidth="0.5"
                opacity="0.9"
              />
              {/* Label */}
              {(isHovered || isSelected) && (
                <text x={cx + r + 1} y={cy + 0.8} fontSize="2.5"
                  fill={theme === 'dark' ? "#e2e8f0" : "#172033"} fontWeight="600"
                  style={{ pointerEvents: 'none' }}>
                  {feature.properties.name}
                </text>
              )}
            </g>
          )
        })}
      </svg>

      {/* Detail panel */}
      {selected && (
        <div className="absolute top-3 right-3 w-56 card p-4 bg-slate-900/95 backdrop-blur-sm border-slate-700 shadow-xl">
          <div className="flex items-start justify-between mb-2">
            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${
              selected.properties.feature_type === 'CASE' ? 'bg-indigo-100 text-indigo-800 border-indigo-300 dark:bg-indigo-900/40 dark:text-indigo-300 dark:border-indigo-700/30'
              : selected.properties.feature_type === 'PERSON' ? 'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900/40 dark:text-blue-300 dark:border-blue-700/30'
              : 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-900/40 dark:text-emerald-300 dark:border-emerald-700/30'
            }`}>
              {selected.properties.feature_type}
            </span>
            <button onClick={() => setSelected(null)} className="text-slate-600 hover:text-slate-400 text-xs">✕</button>
          </div>
          <h4 className="font-semibold text-slate-200 text-sm mb-1">{selected.properties.title}</h4>
          <p className="text-xs text-slate-500 mb-2">{selected.properties.location_text}</p>
          {selected.properties.status && <StatusBadge value={selected.properties.status} />}
          {selected.properties.priority && (
            <div className="mt-1"><StatusBadge value={selected.properties.priority} type="priority" /></div>
          )}
          {selected.properties.occupation && (
            <p className="text-xs text-slate-500 mt-2">{selected.properties.occupation}</p>
          )}
          {selected.properties.phone && (
            <p className="text-xs text-slate-600">{selected.properties.phone}</p>
          )}
        </div>
      )}

      {/* Legend overlay */}
      <div className="absolute bottom-3 left-3 card p-3 bg-slate-900/90 backdrop-blur-sm border-slate-700 text-xs space-y-1.5">
        {[
          { color: '#ef4444', label: 'Critical case' },
          { color: '#f97316', label: 'High priority case' },
          { color: '#f59e0b', label: 'Medium priority case' },
          { color: '#6366f1', label: 'Person location' },
          { color: '#10b981', label: 'Stored location' },
        ].map(({ color, label }) => (
          <div key={label} className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full shrink-0" style={{ background: color }} />
            <span className="text-slate-500">{label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function GeospatialPage() {
  const { theme } = useTheme()
  const [cases, setCases] = useState<Case[]>([])
  const [selectedCase, setSelectedCase] = useState('')
  const [geoData, setGeoData] = useState<GeoData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [featureFilter, setFeatureFilter] = useState('')

  const loadData = useCallback(async (caseId?: string) => {
    setLoading(true); setError('')
    try {
      const data = await geospatialApi.getLocations(caseId || undefined)
      setGeoData(data)
    } catch (e) { setError(getErrorMessage(e)) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => {
    casesApi.list({ size: 50 })
      .then(r => { setCases(r.items); loadData() })
      .catch(e => setError(getErrorMessage(e)))
  }, [])

  useEffect(() => { loadData(selectedCase || undefined) }, [selectedCase])

  const features = geoData?.geojson?.features || []
  const stats = geoData?.stats

  return (
    <div className="animate-fade-in flex flex-col h-screen overflow-hidden">
      <div className="page-header flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-lg font-bold text-slate-100 flex items-center gap-2">
            <Map className="h-5 w-5 text-emerald-400" /> Geospatial Intelligence
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">Location mapping and movement analysis</p>
        </div>
        <button onClick={() => loadData(selectedCase || undefined)} className="btn-secondary text-xs py-1.5">
          <RefreshCw className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="px-6 pt-3 pb-2 flex flex-wrap gap-3 items-center shrink-0">
        {error && <ErrorAlert message={error} onClose={() => setError('')} />}

        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-slate-600" />
          <select className="input text-xs py-1.5 max-w-xs" value={selectedCase}
            onChange={e => setSelectedCase(e.target.value)}>
            <option value="">All Cases</option>
            {cases.map(c => <option key={c.id} value={c.id}>{c.case_number} — {c.title}</option>)}
          </select>
        </div>

        {/* Feature type filter */}
        <div className="flex items-center gap-1 p-1 bg-slate-900 rounded-lg border border-slate-800">
          {[
            { v: '', label: 'All', icon: <Layers className="h-3 w-3" /> },
            { v: 'CASE', label: 'Cases', icon: <FolderOpen className="h-3 w-3" /> },
            { v: 'PERSON', label: 'Persons', icon: <Users className="h-3 w-3" /> },
            { v: 'LOCATION', label: 'Locations', icon: <MapPin className="h-3 w-3" /> },
          ].map(({ v, label, icon }) => (
            <button key={v} onClick={() => setFeatureFilter(v)}
              className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md transition-colors ${
                featureFilter === v ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}>
              {icon} {label}
            </button>
          ))}
        </div>

        {/* Stats */}
        {stats && (
          <div className="flex items-center gap-3 text-xs text-slate-500 ml-2">
            <span>{stats.total_features} total</span>
            <span>·</span>
            <span className="flex items-center gap-1"><FolderOpen className="h-3 w-3" />{stats.case_locations} cases</span>
            <span>·</span>
            <span className="flex items-center gap-1"><Users className="h-3 w-3" />{stats.person_locations} persons</span>
          </div>
        )}
      </div>

      {/* Map area */}
      <div className="flex-1 mx-6 mb-6 rounded-xl border border-slate-800 overflow-hidden">
        {loading ? (
          <div className="h-full flex items-center justify-center">
            <PageLoader />
          </div>
        ) : (
          <SimpleMapView features={features} filter={featureFilter} theme={theme} />
        )}
      </div>

      {/* Disclaimer */}
      <div className="px-6 pb-4 shrink-0">
        <p className="text-xs text-slate-700 italic">
          {geoData?.disclaimer || 'Locations are derived from investigation records. Coordinates are approximate.'}
        </p>
      </div>
    </div>
  )
}
