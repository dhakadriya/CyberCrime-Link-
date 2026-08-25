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
      <div className="page-header border-b border-slate-700 bg-slate-900 px-6 py-4 flex items-center gap-3">
        <button onClick={() => navigate('/persons')} className="btn-icon p-2 shrink-0"><ArrowLeft className="h-4 w-4" /></button>
        <div>
          <h1 className="text-2xl font-bold text-slate-100">{person.full_name}</h1>
          {person.alias && <p className="text-xs text-slate-400 mt-1">aka "{person.alias}"</p>}
        </div>
      </div>

      <div className="page-content space-y-5">
        {error && <ErrorAlert message={error} onClose={() => setError('')} />}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Details */}
          <div className="card p-5">
            <h3 className="font-bold text-slate-100 mb-4 text-sm uppercase tracking-wider">Personal Details</h3>
            <dl className="space-y-3 text-sm">
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
                  <dt className="w-28 shrink-0 text-slate-400 font-bold">{label}</dt>
                  <dd className="text-slate-200 font-semibold">{value}</dd>
                </div>
              ))}
            </dl>
            {person.notes && (
              <div className="mt-4 pt-4 border-t border-slate-700">
                <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-2">Notes</p>
                <p className="text-sm text-slate-200 leading-relaxed font-medium bg-[#F8FAFC] border border-[#D9E0EA] p-3 rounded-lg">{person.notes}</p>
              </div>
            )}
          </div>

          {/* Case history */}
          <div className="card p-5">
            <h3 className="font-bold text-slate-100 mb-4 text-sm uppercase tracking-wider">Case History ({person.case_history.length})</h3>
            {person.case_history.length === 0
              ? <p className="text-sm text-slate-400 font-medium">No case associations found.</p>
              : (
                <div className="space-y-3">
                  {person.case_history.map(h => (
                    <Link
                      key={h.case_id}
                      to={`/cases/${h.case_id}`}
                      className="flex items-center justify-between rounded-lg border border-[#CBD5E1] bg-white p-3.5 hover:bg-[#F8FAFC] transition-colors"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-[#4338CA]">{h.case_number}</span>
                          <StatusBadge value={h.role} />
                        </div>
                        <p className="text-sm text-slate-100 font-bold">{h.title}</p>
                        <p className="text-xs text-slate-400 font-semibold">{h.case_type} · {h.status}</p>
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
