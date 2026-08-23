import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, FileText } from 'lucide-react'
import { evidenceApi } from '../../api/evidence'
import { StatusBadge } from '../../components/shared/StatusBadge'
import { Pagination } from '../../components/shared/Pagination'
import { PageLoader } from '../../components/shared/LoadingSpinner'
import { ErrorAlert } from '../../components/shared/ErrorAlert'
import { getErrorMessage } from '../../api/client'
import type { Evidence, PaginatedResponse } from '../../types'
import { formatDistanceToNow } from 'date-fns'

const TYPES = ['', 'IMAGE', 'VIDEO', 'DOCUMENT', 'AUDIO', 'PHYSICAL', 'DIGITAL']

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1048576).toFixed(1)} MB`
}

export function EvidencePage() {
  const [data, setData] = useState<PaginatedResponse<Evidence> | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [page, setPage] = useState(1)
  const navigate = useNavigate()

  const load = async (p = 1) => {
    setLoading(true); setError('')
    try {
      const res = await evidenceApi.list({ page: p, size: 20, evidence_type: typeFilter || undefined })
      setData(res)
    } catch (e) { setError(getErrorMessage(e)) }
    finally { setLoading(false) }
  }

  useEffect(() => { load(1) }, [typeFilter])

  return (
    <div>
      <div className="page-header flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Evidence</h1>
          <p className="text-sm text-slate-500 mt-0.5">{data?.total ?? 0} items — upload from Case Details</p>
        </div>
      </div>

      <div className="page-content space-y-4">
        <div className="card p-4 flex gap-3">
          <select className="input w-44" value={typeFilter} onChange={e => { setTypeFilter(e.target.value); setPage(1) }}>
            <option value="">All Types</option>
            {TYPES.slice(1).map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>

        {error && <ErrorAlert message={error} onClose={() => setError('')} />}

        {loading ? <PageLoader /> : (
          <>
            {(!data || data.items.length === 0) ? (
              <div className="card p-12 text-center">
                <FileText className="h-12 w-12 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-500">No evidence items found. Upload from a case.</p>
              </div>
            ) : (
              <div className="card overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="border-b border-slate-100 bg-slate-50">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium text-slate-600">Evidence #</th>
                      <th className="px-4 py-3 text-left font-medium text-slate-600">Type</th>
                      <th className="px-4 py-3 text-left font-medium text-slate-600">Original Filename</th>
                      <th className="px-4 py-3 text-left font-medium text-slate-600">Size</th>
                      <th className="px-4 py-3 text-left font-medium text-slate-600">SHA-256</th>
                      <th className="px-4 py-3 text-left font-medium text-slate-600">Status</th>
                      <th className="px-4 py-3 text-left font-medium text-slate-600">Uploaded</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {data.items.map(e => (
                      <tr key={e.id} onClick={() => navigate(`/evidence/${e.id}`)} className="hover:bg-slate-50 cursor-pointer">
                        <td className="px-4 py-3 font-mono text-xs text-primary-600">{e.evidence_number}</td>
                        <td className="px-4 py-3"><StatusBadge value={e.evidence_type} /></td>
                        <td className="px-4 py-3 text-slate-500 text-xs max-w-[180px] truncate">{e.original_filename}</td>
                        <td className="px-4 py-3 text-slate-500 text-xs">{formatBytes(e.file_size)}</td>
                        <td className="px-4 py-3 font-mono text-xs text-slate-400">{e.sha256_hash.slice(0, 12)}…</td>
                        <td className="px-4 py-3"><StatusBadge value={e.status} /></td>
                        <td className="px-4 py-3 text-slate-400 text-xs">{formatDistanceToNow(new Date(e.uploaded_at), { addSuffix: true })}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="px-4">
                  <Pagination page={data.page} pages={data.pages} total={data.total} size={data.size}
                    onChange={p => { setPage(p); load(p) }} />
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
