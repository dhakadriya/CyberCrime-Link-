import { useEffect, useState } from 'react'
import { casesApi } from '../../api/cases'
import type { CaseCompletion } from '../../types'
import { CheckCircle2, Circle } from 'lucide-react'

interface Props { caseId: string; refresh?: number }

export function CaseCompletionWidget({ caseId, refresh }: Props) {
  const [completion, setCompletion] = useState<CaseCompletion | null>(null)

  useEffect(() => {
    casesApi.getCompletion(caseId).then(setCompletion).catch(() => {})
  }, [caseId, refresh])

  if (!completion) return null

  const { percentage } = completion

  const items = [
    { label: 'Case Information', done: true, detail: 'Title + Type' },
    { label: 'Description', done: completion.has_description },
    { label: 'Location', done: completion.has_location },
    { label: 'Incident Date', done: completion.has_incident_date },
    { label: 'Persons', done: completion.persons_count > 0, detail: `${completion.persons_count} added` },
    { label: 'Evidence', done: completion.evidence_count > 0, detail: `${completion.evidence_count} items` },
    { label: 'Relationships', done: completion.relationships_count > 0, detail: `${completion.relationships_count} added` },
    { label: 'Investigation Events', done: completion.events_count > 0, detail: `${completion.events_count} events` },
  ]

  const barColor = percentage >= 75 ? 'bg-green-500' : percentage >= 50 ? 'bg-amber-500' : percentage >= 25 ? 'bg-orange-500' : 'bg-red-400'

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm font-semibold text-slate-700">Case Completion</p>
        <span className={`text-sm font-bold ${percentage >= 75 ? 'text-green-600' : percentage >= 50 ? 'text-amber-600' : 'text-slate-600'}`}>
          {percentage}%
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-2 bg-slate-100 rounded-full mb-4">
        <div
          className={`h-2 rounded-full transition-all duration-500 ${barColor}`}
          style={{ width: `${percentage}%` }}
        />
      </div>

      {/* Checklist */}
      <div className="space-y-1.5">
        {items.map(item => (
          <div key={item.label} className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5">
              {item.done
                ? <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />
                : <Circle className="h-3.5 w-3.5 text-slate-300 shrink-0" />
              }
              <span className={item.done ? 'text-slate-700' : 'text-slate-400'}>{item.label}</span>
            </div>
            {item.detail && (
              <span className="text-slate-400">{item.detail}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
