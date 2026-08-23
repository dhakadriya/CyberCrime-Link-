import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Check, ClipboardList, UserPlus, Upload, GitBranch, Activity, Eye } from 'lucide-react'
import { casesApi } from '../../api/cases'
import { personsApi } from '../../api/persons'
import { getErrorMessage } from '../../api/client'
import { ErrorAlert } from '../../components/shared/ErrorAlert'
import { PageLoader } from '../../components/shared/LoadingSpinner'
import type { CaseWizardPayload, WizardPersonEntry, WizardRelationshipEntry, WizardEventEntry, Person } from '../../types'

const TYPES = ['ROBBERY', 'BURGLARY', 'FRAUD', 'ASSAULT', 'MURDER', 'KIDNAPPING',
               'CYBERCRIME', 'DRUG_TRAFFICKING', 'MONEY_LAUNDERING', 'OTHER']
const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']
const PERSON_ROLES = ['SUSPECT', 'VICTIM', 'WITNESS', 'COMPLAINANT', 'OFFICER', 'OTHER']
const REL_TYPES = ['ASSOCIATED_WITH', 'FRIEND_OF', 'RELATED_TO', 'OWNER_OF', 'WITNESS_TO', 'LINKED_TO']
const EVENT_TYPES = ['CASE_CREATED', 'WITNESS_INTERVIEWED', 'EVIDENCE_COLLECTED', 'INVESTIGATION_NOTE',
                     'PERSON_IDENTIFIED', 'SUPERVISOR_REVIEW', 'STATUS_CHANGED', 'OTHER']

const STEPS = [
  { key: 'info', label: 'Case Info', icon: <ClipboardList className="h-4 w-4" /> },
  { key: 'persons', label: 'Persons', icon: <UserPlus className="h-4 w-4" /> },
  { key: 'evidence', label: 'Evidence', icon: <Upload className="h-4 w-4" /> },
  { key: 'relationships', label: 'Relationships', icon: <GitBranch className="h-4 w-4" /> },
  { key: 'events', label: 'Events', icon: <Activity className="h-4 w-4" /> },
  { key: 'review', label: 'Review', icon: <Eye className="h-4 w-4" /> },
]

type StepKey = 'info' | 'persons' | 'evidence' | 'relationships' | 'events' | 'review'

const DEFAULT_CASE_INFO = {
  title: '', case_type: 'ROBBERY', description: '', location: '',
  incident_date: '', priority: 'MEDIUM', status: 'OPEN',
}

export function CaseWizard() {
  const navigate = useNavigate()
  const [currentStep, setCurrentStep] = useState(0)
  const [caseInfo, setCaseInfo] = useState(DEFAULT_CASE_INFO)
  const [persons, setPersons] = useState<WizardPersonEntry[]>([])
  const [evidenceNote, setEvidenceNote] = useState('') // evidence uploaded post-creation
  const [relationships, setRelationships] = useState<WizardRelationshipEntry[]>([])
  const [events, setEvents] = useState<WizardEventEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [existingPersons, setExistingPersons] = useState<Person[]>([])
  const [searchingPersons, setSearchingPersons] = useState(false)
  const [personSearch, setPersonSearch] = useState('')

  const stepKey = STEPS[currentStep].key as StepKey

  const set = (k: keyof typeof caseInfo) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setCaseInfo(f => ({ ...f, [k]: e.target.value }))

  const validateStep = (): string | null => {
    if (stepKey === 'info') {
      if (!caseInfo.title.trim() || caseInfo.title.length < 3) return 'Case title must be at least 3 characters'
      if (!caseInfo.case_type) return 'Crime type is required'
    }
    return null
  }

  const next = () => {
    const err = validateStep()
    if (err) { setError(err); return }
    setError('')
    setCurrentStep(s => Math.min(s + 1, STEPS.length - 1))
  }

  const back = () => { setError(''); setCurrentStep(s => Math.max(s - 1, 0)) }

  const searchPersons = async () => {
    setSearchingPersons(true)
    try {
      const res = await personsApi.list({ search: personSearch || undefined, size: 20 })
      setExistingPersons(res.items)
    } catch { /* ignore */ }
    finally { setSearchingPersons(false) }
  }

  const addNewPerson = () => {
    setPersons(prev => [...prev, {
      first_name: '', last_name: '', role: 'SUSPECT',
      alias: '', nationality: '', address: '', phone: '', occupation: '', notes: '',
    }])
  }

  const addExistingPerson = (p: Person, role: string) => {
    setPersons(prev => [...prev, {
      first_name: p.first_name, last_name: p.last_name,
      role, existing_person_id: p.id,
    }])
  }

  const removePerson = (i: number) => setPersons(prev => prev.filter((_, idx) => idx !== i))

  const updatePerson = (i: number, k: keyof WizardPersonEntry, v: string) =>
    setPersons(prev => prev.map((p, idx) => idx === i ? { ...p, [k]: v } : p))

  const addRelationship = () => setRelationships(prev => [...prev, {
    source_type: 'PERSON', source_id: '', target_type: 'PERSON', target_id: '',
    relationship_type: 'ASSOCIATED_WITH', strength: 'MEDIUM',
  }])

  const updateRel = (i: number, k: keyof WizardRelationshipEntry, v: string) =>
    setRelationships(prev => prev.map((r, idx) => idx === i ? { ...r, [k]: v } : r))

  const addEvent = () => setEvents(prev => [...prev, {
    event_type: 'INVESTIGATION_NOTE', title: '', description: '',
  }])

  const updateEvent = (i: number, k: keyof WizardEventEntry, v: string) =>
    setEvents(prev => prev.map((ev, idx) => idx === i ? { ...ev, [k]: v } : ev))

  const handleSubmit = async (saveAsDraft = false) => {
    setLoading(true); setError('')
    try {
      const payload: CaseWizardPayload = {
        title: caseInfo.title,
        case_type: caseInfo.case_type.toUpperCase(),
        description: caseInfo.description || undefined,
        location: caseInfo.location || undefined,
        incident_date: caseInfo.incident_date || undefined,
        priority: caseInfo.priority.toUpperCase(),
        status: saveAsDraft ? 'DRAFT' : caseInfo.status.toUpperCase(),
        persons: persons.filter(p => p.first_name),
        relationships: relationships.filter(r => r.source_id && r.target_id),
        events: events.filter(ev => ev.title),
      }
      const c = await casesApi.createWizard(payload)
      navigate(`/cases/${c.id}`)
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <div className="page-header">
        <div className="flex items-center gap-3 mb-4">
          <button onClick={() => navigate('/cases')} className="btn-secondary p-2">
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <ClipboardList className="h-5 w-5 text-primary-600" />
              <h1 className="text-xl font-bold text-slate-800">Detailed Case Wizard</h1>
            </div>
            <p className="text-sm text-slate-500">Step {currentStep + 1} of {STEPS.length} — {STEPS[currentStep].label}</p>
          </div>
        </div>

        {/* Step progress */}
        <div className="flex items-center gap-1">
          {STEPS.map((step, i) => (
            <div key={step.key} className="flex items-center">
              <button
                onClick={() => i < currentStep && setCurrentStep(i)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors
                  ${i === currentStep ? 'bg-primary-600 text-white' :
                    i < currentStep ? 'bg-primary-100 text-primary-700 cursor-pointer hover:bg-primary-200' :
                    'bg-slate-100 text-slate-400 cursor-default'}`}
              >
                {i < currentStep ? <Check className="h-3.5 w-3.5" /> : step.icon}
                <span className="hidden sm:inline">{step.label}</span>
              </button>
              {i < STEPS.length - 1 && (
                <div className={`h-px w-4 ${i < currentStep ? 'bg-primary-400' : 'bg-slate-200'}`} />
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="page-content max-w-3xl">
        {error && <div className="mb-4"><ErrorAlert message={error} onClose={() => setError('')} /></div>}

        {/* STEP 1: Case Information */}
        {stepKey === 'info' && (
          <div className="card p-6 space-y-4">
            <h2 className="font-semibold text-slate-700">Step 1 — Case Information</h2>
            <div>
              <label className="label">Case Title *</label>
              <input className="input" placeholder="e.g. Commerce Street Armed Robbery"
                value={caseInfo.title} onChange={set('title')} required minLength={3} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Crime Type *</label>
                <select className="input" value={caseInfo.case_type} onChange={set('case_type')}>
                  {TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Priority</label>
                <select className="input" value={caseInfo.priority} onChange={set('priority')}>
                  {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Location</label>
                <input className="input" placeholder="Incident location"
                  value={caseInfo.location} onChange={set('location')} />
              </div>
              <div>
                <label className="label">Incident Date/Time</label>
                <input type="datetime-local" className="input"
                  value={caseInfo.incident_date} onChange={set('incident_date')} />
              </div>
            </div>
            <div>
              <label className="label">Description</label>
              <textarea className="input min-h-[100px] resize-none"
                placeholder="Describe the incident…"
                value={caseInfo.description} onChange={set('description')} />
            </div>
          </div>
        )}

        {/* STEP 2: Persons */}
        {stepKey === 'persons' && (
          <div className="space-y-4">
            <div className="card p-5">
              <h2 className="font-semibold text-slate-700 mb-3">Step 2 — Add Persons</h2>
              <p className="text-sm text-slate-500 mb-4">
                Search for existing persons to avoid duplicates, or create new ones.
              </p>

              {/* Search existing */}
              <div className="flex gap-2 mb-4">
                <input className="input flex-1" placeholder="Search existing persons by name…"
                  value={personSearch} onChange={e => setPersonSearch(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && searchPersons()} />
                <button onClick={searchPersons} className="btn-secondary text-xs px-3">Search</button>
                <button onClick={addNewPerson} className="btn-primary text-xs px-3">
                  + New Person
                </button>
              </div>

              {searchingPersons && <PageLoader />}

              {existingPersons.length > 0 && (
                <div className="border border-slate-200 rounded-lg divide-y mb-4">
                  {existingPersons.map(p => (
                    <div key={p.id} className="flex items-center justify-between p-3">
                      <div>
                        <p className="font-medium text-sm text-slate-800">{p.full_name}</p>
                        <p className="text-xs text-slate-400">{p.alias ? `aka ${p.alias} · ` : ''}{p.occupation || ''}</p>
                        <p className="text-xs text-slate-400">{p.case_history.length} case(s)</p>
                      </div>
                      <div className="flex gap-2">
                        {PERSON_ROLES.map(r => (
                          <button key={r} onClick={() => addExistingPerson(p, r)}
                            className="text-xs bg-slate-100 hover:bg-primary-100 text-slate-600 hover:text-primary-700 px-2 py-1 rounded transition-colors">
                            +{r}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Person entries */}
            {persons.length > 0 && (
              <div className="space-y-3">
                {persons.map((p, i) => (
                  <div key={i} className="card p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        {p.existing_person_id
                          ? <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">Existing Person</span>
                          : <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">New Person</span>
                        }
                        <span className="text-sm font-medium text-slate-700">
                          {p.first_name} {p.last_name}
                        </span>
                      </div>
                      <button onClick={() => removePerson(i)} className="text-red-400 hover:text-red-600 text-xs">Remove</button>
                    </div>
                    {!p.existing_person_id && (
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="label">First Name *</label>
                          <input className="input" value={p.first_name} onChange={e => updatePerson(i, 'first_name', e.target.value)} />
                        </div>
                        <div>
                          <label className="label">Last Name</label>
                          <input className="input" value={p.last_name || ''} onChange={e => updatePerson(i, 'last_name', e.target.value)} />
                        </div>
                        <div>
                          <label className="label">Alias</label>
                          <input className="input" value={p.alias || ''} onChange={e => updatePerson(i, 'alias', e.target.value)} />
                        </div>
                        <div>
                          <label className="label">Phone</label>
                          <input className="input" value={p.phone || ''} onChange={e => updatePerson(i, 'phone', e.target.value)} />
                        </div>
                        <div>
                          <label className="label">Address</label>
                          <input className="input" value={p.address || ''} onChange={e => updatePerson(i, 'address', e.target.value)} />
                        </div>
                        <div>
                          <label className="label">Occupation</label>
                          <input className="input" value={p.occupation || ''} onChange={e => updatePerson(i, 'occupation', e.target.value)} />
                        </div>
                      </div>
                    )}
                    <div className="mt-3">
                      <label className="label">Role in this Case *</label>
                      <select className="input w-48" value={p.role}
                        onChange={e => updatePerson(i, 'role', e.target.value)}>
                        {PERSON_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                      </select>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {persons.length === 0 && (
              <div className="card p-6 text-center text-slate-400 border-dashed">
                No persons added yet. Search for existing or create new.
              </div>
            )}
          </div>
        )}

        {/* STEP 3: Evidence (note only — files uploaded after case created) */}
        {stepKey === 'evidence' && (
          <div className="card p-6">
            <h2 className="font-semibold text-slate-700 mb-2">Step 3 — Evidence</h2>
            <div className="rounded-lg bg-blue-50 border border-blue-200 px-4 py-3 text-sm text-blue-800 mb-4">
              <strong>Evidence Upload:</strong> Files must be uploaded after the case is created,
              using the Evidence tab in Case Details. This ensures proper SHA-256 hashing,
              file validation, and chain of custody creation.
            </div>
            <div>
              <label className="label">Evidence Notes <span className="text-slate-400">(optional)</span></label>
              <textarea className="input min-h-[100px] resize-none"
                placeholder="Describe known evidence to be collected (CCTV footage, documents, photos…)"
                value={evidenceNote} onChange={e => setEvidenceNote(e.target.value)} />
            </div>
            <p className="text-xs text-slate-400 mt-2">
              After case creation you can bulk-upload multiple files at once from the Evidence tab.
            </p>
          </div>
        )}

        {/* STEP 4: Relationships */}
        {stepKey === 'relationships' && (
          <div className="space-y-4">
            <div className="card p-5">
              <h2 className="font-semibold text-slate-700 mb-3">Step 4 — Relationships</h2>
              <p className="text-sm text-slate-500 mb-4">
                Add connections between persons, cases, or evidence. Use Person IDs from above or UUIDs.
              </p>
              <button onClick={addRelationship} className="btn-secondary text-xs">+ Add Relationship</button>
            </div>
            {relationships.map((r, i) => (
              <div key={i} className="card p-4 grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Source (Person ID or name)</label>
                  <input className="input" placeholder="Source UUID or name"
                    value={r.source_id} onChange={e => updateRel(i, 'source_id', e.target.value)} />
                </div>
                <div>
                  <label className="label">Target (Person ID or name)</label>
                  <input className="input" placeholder="Target UUID or name"
                    value={r.target_id} onChange={e => updateRel(i, 'target_id', e.target.value)} />
                </div>
                <div>
                  <label className="label">Relationship Type</label>
                  <select className="input" value={r.relationship_type}
                    onChange={e => updateRel(i, 'relationship_type', e.target.value)}>
                    {REL_TYPES.map(rt => <option key={rt} value={rt}>{rt.replace(/_/g, ' ')}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Strength</label>
                  <select className="input" value={r.strength}
                    onChange={e => updateRel(i, 'strength', e.target.value)}>
                    {['WEAK', 'MEDIUM', 'STRONG'].map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="label">Notes</label>
                  <input className="input" placeholder="Optional context"
                    value={r.notes || ''} onChange={e => updateRel(i, 'notes', e.target.value)} />
                </div>
                <div className="col-span-2 text-right">
                  <button onClick={() => setRelationships(prev => prev.filter((_, idx) => idx !== i))}
                    className="text-xs text-red-500 hover:text-red-700">Remove</button>
                </div>
              </div>
            ))}
            {relationships.length === 0 && (
              <div className="card p-6 text-center text-slate-400 border-dashed">
                No relationships added. This step is optional.
              </div>
            )}
          </div>
        )}

        {/* STEP 5: Investigation Events */}
        {stepKey === 'events' && (
          <div className="space-y-4">
            <div className="card p-5">
              <h2 className="font-semibold text-slate-700 mb-3">Step 5 — Investigation Events</h2>
              <p className="text-sm text-slate-500 mb-4">Record known events that have already occurred.</p>
              <button onClick={addEvent} className="btn-secondary text-xs">+ Add Event</button>
            </div>
            {events.map((ev, i) => (
              <div key={i} className="card p-4 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">Event Type</label>
                    <select className="input" value={ev.event_type}
                      onChange={e => updateEvent(i, 'event_type', e.target.value)}>
                      {EVENT_TYPES.map(et => <option key={et} value={et}>{et.replace(/_/g, ' ')}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="label">Date/Time</label>
                    <input type="datetime-local" className="input"
                      value={ev.occurred_at || ''}
                      onChange={e => updateEvent(i, 'occurred_at', e.target.value)} />
                  </div>
                </div>
                <div>
                  <label className="label">Title *</label>
                  <input className="input" placeholder="Brief event title"
                    value={ev.title} onChange={e => updateEvent(i, 'title', e.target.value)} />
                </div>
                <div>
                  <label className="label">Description</label>
                  <textarea className="input min-h-[60px] resize-none"
                    placeholder="Event details…"
                    value={ev.description || ''}
                    onChange={e => updateEvent(i, 'description', e.target.value)} />
                </div>
                <div className="text-right">
                  <button onClick={() => setEvents(prev => prev.filter((_, idx) => idx !== i))}
                    className="text-xs text-red-500 hover:text-red-700">Remove</button>
                </div>
              </div>
            ))}
            {events.length === 0 && (
              <div className="card p-6 text-center text-slate-400 border-dashed">
                No events added. This step is optional.
              </div>
            )}
          </div>
        )}

        {/* STEP 6: Review */}
        {stepKey === 'review' && (
          <div className="card p-6 space-y-4">
            <h2 className="font-semibold text-slate-700">Step 6 — Review & Create</h2>
            <div className="space-y-3">
              {[
                { label: 'Case Title', value: caseInfo.title },
                { label: 'Crime Type', value: caseInfo.case_type },
                { label: 'Priority', value: caseInfo.priority },
                { label: 'Status', value: caseInfo.status },
                { label: 'Location', value: caseInfo.location || '—' },
                { label: 'Incident Date', value: caseInfo.incident_date || '—' },
              ].map(({ label, value }) => (
                <div key={label} className="flex gap-3 text-sm">
                  <dt className="w-32 shrink-0 text-slate-400">{label}</dt>
                  <dd className="font-medium text-slate-800">{value}</dd>
                </div>
              ))}
            </div>

            <div className="border-t border-slate-100 pt-3 grid grid-cols-2 gap-3">
              {[
                { label: '👤 Persons', value: `${persons.length} added` },
                { label: '🔗 Relationships', value: `${relationships.filter(r => r.source_id && r.target_id).length} added` },
                { label: '📋 Events', value: `${events.filter(e => e.title).length} added` },
                { label: '📁 Evidence', value: 'Upload from Case Details after creation' },
              ].map(({ label, value }) => (
                <div key={label} className="rounded-lg bg-slate-50 p-3 text-sm">
                  <p className="font-medium text-slate-700">{label}</p>
                  <p className="text-slate-500 text-xs mt-0.5">{value}</p>
                </div>
              ))}
            </div>

            {error && <ErrorAlert message={error} onClose={() => setError('')} />}
          </div>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between mt-6">
          <div>
            {currentStep > 0 && (
              <button onClick={back} className="btn-secondary gap-1.5">
                <ArrowLeft className="h-4 w-4" /> Back
              </button>
            )}
          </div>

          <div className="flex gap-3">
            {stepKey !== 'review' ? (
              <>
                <button
                  onClick={() => handleSubmit(true)}
                  disabled={loading || !caseInfo.title}
                  className="btn-secondary text-xs"
                >
                  Save Draft
                </button>
                <button onClick={next} className="btn-primary gap-1.5">
                  Next <ArrowRight className="h-4 w-4" />
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => handleSubmit(true)}
                  disabled={loading}
                  className="btn-secondary"
                >
                  {loading ? 'Saving…' : 'Save as Draft'}
                </button>
                <button
                  onClick={() => handleSubmit(false)}
                  disabled={loading}
                  className="btn-primary gap-1.5"
                >
                  {loading ? 'Creating Case…' : <><Check className="h-4 w-4" /> Create Case</>}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
