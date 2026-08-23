import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { personsApi } from '../../api/persons'
import { StatusBadge } from '../../components/shared/StatusBadge'
import { PageLoader } from '../../components/shared/LoadingSpinner'
import { ErrorAlert } from '../../components/shared/ErrorAlert'
import { getErrorMessage } from '../../api/client'
import type { Person } from '../../types'
import { format } from 'date-fns'

export function PersonDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [person, setPerson] = useState<Person | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!id) return
    personsApi.get(id)
      .then(setPerson)
      .catch(e => setError(getErrorMessage(e)))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) return <PageLoader />
  if (!person) return <div className="p-8 text-slate-500">Person not found.</div>

  return (
    <div>
      <div className="page-header flex items-center gap-3">
        <button onClick={() => navigate('/persons')} className="btn-secondary p-2"><ArrowLeft className="h-4 w-4" /></button>
        <div>
          <h1 className="text-xl font-bold text-slate-800">{person.full_name}</h1>
          {person.alias && <p className="text-sm text-slate-400">aka "{person.alias}"</p>}
        </div>
      </div>

      <div className="page-content space-y-5">
        {error && <ErrorAlert message={error} onClose={() => setError('')} />}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Details */}
          <div className="card p-5">
            <h3 className="font-semibold text-slate-700 mb-4">Personal Details</h3>
            <dl className="space-y-2.5 text-sm">
              {[
                ['Date of Birth', person.date_of_birth ? format(new Date(person.date_of_birth), 'PP') : '—'],
                ['Gender', person.gender ?? '—'],
                ['Nationality', person.nationality ?? '—'],
                ['National ID', person.national_id ?? '—'],
                ['Occupation', person.occupation ?? '—'],
                ['Phone', person.phone ?? '—'],
                ['Email', person.email ?? '—'],
                ['Address', person.address ?? '—'],
              ].map(([label, value]) => (
                <div key={label} className="flex gap-3">
                  <dt className="w-28 shrink-0 text-slate-400">{label}</dt>
                  <dd className="text-slate-700">{value}</dd>
                </div>
              ))}
            </dl>
            {person.notes && (
              <div className="mt-4 pt-4 border-t border-slate-100">
                <p className="text-xs text-slate-400 mb-1">Notes</p>
                <p className="text-sm text-slate-600">{person.notes}</p>
              </div>
            )}
          </div>

          {/* Case history */}
          <div className="card p-5">
            <h3 className="font-semibold text-slate-700 mb-4">Case History ({person.case_history.length})</h3>
            {person.case_history.length === 0
              ? <p className="text-sm text-slate-400">No case associations found.</p>
              : (
                <div className="space-y-2">
                  {person.case_history.map(h => (
                    <Link
                      key={h.case_id}
                      to={`/cases/${h.case_id}`}
                      className="flex items-center justify-between rounded-lg border border-slate-100 p-3 hover:bg-slate-50 transition-colors"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-primary-600">{h.case_number}</span>
                          <StatusBadge value={h.role} />
                        </div>
                        <p className="text-sm text-slate-700 mt-0.5">{h.title}</p>
                        <p className="text-xs text-slate-400">{h.case_type} · {h.status}</p>
                      </div>
                    </Link>
                  ))}
                </div>
              )
            }
          </div>
        </div>
      </div>
    </div>
  )
}
