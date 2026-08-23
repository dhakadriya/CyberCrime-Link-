import { useEffect, useState } from 'react'
import { Clock, Filter, PlusCircle, Loader2 } from 'lucide-react'
import { casesApi } from '../../api/cases'
import { PageLoader } from '../../components/shared/LoadingSpinner'
import { ErrorAlert, SuccessAlert } from '../../components/shared/ErrorAlert'
import { getErrorMessage } from '../../api/client'
import type { Case, InvestigationEvent } from '../../types'
import { format } from 'date-fns'
import { Link } from 'react-router-dom'

const EVENT_COLORS: Record<string, string> = {
  CASE_CREATED:         'bg-indigo-500',
  EVIDENCE_UPLOADED:    'bg-violet-500',
  EVIDENCE_COLLECTED:   'bg-violet-500',
  PERSON_ADDED:         'bg-amber-500',
  PERSON_IDENTIFIED:    'bg-amber-500',
  STATUS_CHANGED:       'bg-emerald-500',
  OFFICER_ASSIGNED:     'bg-blue-500',
  WITNESS_INTERVIEWED:  'bg-teal-500',
  EVIDENCE_TRANSFERRED: 'bg-orange-500',
  CASE_IMPORTED:        'bg-slate-500',
  SURVEILLANCE_STARTED: 'bg-cyan-500',
  INVESTIGATION_NOTE:   'bg-slate-400',
  DEFAULT:              'bg-slate-600',
}

const EVENT_TYPE_OPTIONS = [
  'CASE_CREATED', 'EVIDENCE_UPLOADED', 'PERSON_ADDED', 'STATUS_CHANGED',
  'OFFICER_ASSIGNED', 'WITNESS_INTERVIEWED', 'EVIDENCE_TRANSFERRED',
  'SURVEILLANCE_STARTED', 'INVESTIGATION_NOTE', 'CUSTOM',
]

export function InvestigationPage() {
  const [cases, setCases] = useState<Case[]>([])
  const [selectedCase, setSelectedCase] = useState<string>('')
  const [events, setEvents] = useState<InvestigationEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingEvents, setLoadingEvents] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [showAddEvent, setShowAddEvent] = useState(false)
  const [addingEvent, setAddingEvent] = useState(false)
  const [newEvent, setNewEvent] = useState({ event_type: 'INVESTIGATION_NOTE', title: '', description: '' })
  const [typeFilter, setTypeFilter] = useState('')

  useEffect(() => {
    casesApi.list({ size: 50 })
      .then(r => {
        setCases(r.items)
        if (r.items[0]) setSelectedCase(r.items[0].id)
      })
      .catch(e => setError(getErrorMessage(e)))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!selectedCase) return
    setLoadingEvents(true)
    casesApi.getTimeline(selectedCase)
      .then(t => setEvents(t.events))
      .catch(e => setError(getErrorMessage(e)))
      .finally(() => setLoadingEvents(false))
  }, [selectedCase])

  const handleAddEvent = async () => {
    if (!selectedCase || !newEvent.title.trim()) return
    setAddingEvent(true)
    try {
      await casesApi.addEvent(selectedCase, newEvent)
      setSuccess('Event added to timeline')
      setShowAddEvent(false)
      setNewEvent({ event_type: 'INVESTIGATION_NOTE', title: '', description: '' })
      // Reload events
      const t = await casesApi.getTimeline(selectedCase)
      setEvents(t.events)
    } catch (e) { setError(getErrorMessage(e)) }
    finally { setAddingEvent(false) }
  }

  const filtered = typeFilter ? events.filter(e => e.event_type === typeFilter) : events

  if (loading) return <PageLoader />

  return (
    <div className="animate-fade-in">
      <div className="page-header flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-slate-100 flex items-center gap-2">
            <Clock className="h-5 w-5 text-emerald-400" /> Investigation Timeline
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">Chronological record of investigation events</p>
        </div>
        <button onClick={() => setShowAddEvent(v => !v)} className="btn-secondary text-xs py-1.5">
          <PlusCircle className="h-3.5 w-3.5" /> Add Event
        </button>
      </div>

      <div className="page-content space-y-4">
        {error && <ErrorAlert message={error} onClose={() => setError('')} />}
        {success && <SuccessAlert message={success} onClose={() => setSuccess('')} />}

        <div className="flex flex-wrap gap-3 items-center">
          <div className="card p-3 flex items-center gap-3">
            <Filter className="h-4 w-4 text-slate-600" />
            <select className="input text-xs py-1 max-w-sm" value={selectedCase}
              onChange={e => setSelectedCase(e.target.value)}>
              {cases.map(c => <option key={c.id} value={c.id}>{c.case_number} — {c.title}</option>)}
            </select>
            {selectedCase && (
              <Link to={`/cases/${selectedCase}`} className="btn-secondary text-xs py-1">View Case</Link>
            )}
          </div>
          <select className="input text-xs py-2 w-48" value={typeFilter}
            onChange={e => setTypeFilter(e.target.value)}>
            <option value="">All Event Types</option>
            {EVENT_TYPE_OPTIONS.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
          </select>
        </div>

        {/* Add event form */}
        {showAddEvent && (
          <div className="card p-4 space-y-3">
            <h3 className="text-sm font-semibold text-slate-300">Add Timeline Event</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Event Type</label>
                <select className="input text-sm" value={newEvent.event_type}
                  onChange={e => setNewEvent(v => ({ ...v, event_type: e.target.value }))}>
                  {EVENT_TYPE_OPTIONS.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Title *</label>
                <input className="input text-sm" placeholder="Event title…"
                  value={newEvent.title}
                  onChange={e => setNewEvent(v => ({ ...v, title: e.target.value }))} />
              </div>
            </div>
            <div>
              <label className="label">Description</label>
              <textarea className="input text-sm" rows={2} placeholder="Optional description…"
                value={newEvent.description}
                onChange={e => setNewEvent(v => ({ ...v, description: e.target.value }))} />
            </div>
            <div className="flex gap-2">
              <button onClick={handleAddEvent} disabled={addingEvent || !newEvent.title.trim()}
                className="btn-primary text-xs py-1.5">
                {addingEvent ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Adding…</> : 'Add Event'}
              </button>
              <button onClick={() => setShowAddEvent(false)} className="btn-secondary text-xs py-1.5">Cancel</button>
            </div>
          </div>
        )}

        {loadingEvents ? <PageLoader /> : (
          <div className="card p-6">
            {filtered.length === 0 ? (
              <p className="text-center text-slate-600 py-8">No timeline events for this case.</p>
            ) : (
              <div className="relative">
                <div className="absolute left-5 top-0 bottom-0 w-px bg-slate-800" />
                <div className="space-y-5">
                  {filtered.map(ev => (
                    <div key={ev.id} className="relative flex gap-4 pl-12">
                      <div className={`timeline-dot ${EVENT_COLORS[ev.event_type] ?? EVENT_COLORS.DEFAULT}`} />
                      <div className="flex-1 pb-1">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="font-medium text-sm text-slate-200">{ev.title}</p>
                            <span className="text-[10px] text-slate-600 rounded bg-slate-800 border border-slate-700 px-1.5 py-0.5 mt-0.5 inline-block">
                              {ev.event_type.replace(/_/g, ' ')}
                            </span>
                          </div>
                          <p className="text-xs text-slate-600 shrink-0 font-mono">
                            {format(new Date(ev.occurred_at), 'MM/dd HH:mm')}
                          </p>
                        </div>
                        {ev.description && <p className="text-xs text-slate-500 mt-1 leading-relaxed">{ev.description}</p>}
                        <div className="flex gap-3 mt-1 text-xs text-slate-600">
                          {ev.created_by_name && <span>by {ev.created_by_name}</span>}
                          {ev.related_person_name && <span>· {ev.related_person_name}</span>}
                          {ev.related_evidence_number && <span>· EVD: {ev.related_evidence_number}</span>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
