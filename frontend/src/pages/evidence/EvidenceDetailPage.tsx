import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { ArrowLeft, Download, ShieldCheck, ShieldOff, ArrowRightLeft } from 'lucide-react'
import { evidenceApi } from '../../api/evidence'
import { usersApi } from '../../api/users'
import { StatusBadge } from '../../components/shared/StatusBadge'
import { PageLoader } from '../../components/shared/LoadingSpinner'
import { ErrorAlert, SuccessAlert } from '../../components/shared/ErrorAlert'
import { getErrorMessage } from '../../api/client'
import { useAuth } from '../../context/AuthContext'
import type { Evidence, CustodyRecord, IntegrityResult, User } from '../../types'
import { format } from 'date-fns'

function formatBytes(b: number) {
  if (b < 1024) return `${b} B`
  if (b < 1048576) return `${(b / 1024).toFixed(1)} KB`
  return `${(b / 1048576).toFixed(1)} MB`
}

export function EvidenceDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { hasPermission } = useAuth()

  const [evidence, setEvidence] = useState<Evidence | null>(null)
  const [custody, setCustody] = useState<CustodyRecord[]>([])
  const [integrity, setIntegrity] = useState<IntegrityResult | null>(null)
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [verifying, setVerifying] = useState(false)
  const [transferTo, setTransferTo] = useState('')
  const [transferNote, setTransferNote] = useState('')
  const [transferring, setTransferring] = useState(false)

  useEffect(() => {
    if (!id) return
    Promise.all([
      evidenceApi.get(id),
      evidenceApi.getCustodyChain(id),
    ]).then(([e, c]) => {
      setEvidence(e)
      setCustody(c)
    }).catch(e => setError(getErrorMessage(e)))
      .finally(() => setLoading(false))

    if (hasPermission('EVIDENCE_TRANSFER')) {
      usersApi.list({ size: 100 }).then(r => setUsers(r.items)).catch(() => {})
    }
  }, [id])

  const handleVerify = async () => {
    if (!id) return
    setVerifying(true); setError(''); setIntegrity(null)
    try {
      const result = await evidenceApi.verify(id)
      setIntegrity(result)
      if (!result.is_intact) setError('INTEGRITY CHECK FAILED — File may have been tampered with!')
      else setSuccess('Integrity verified — file matches stored hash.')
    } catch (e) { setError(getErrorMessage(e)) }
    finally { setVerifying(false) }
  }

  const handleDownload = async () => {
    if (!evidence) return
    try {
      await evidenceApi.download(evidence.id, evidence.original_filename)
    } catch (e) { setError(getErrorMessage(e)) }
  }

  const handleTransfer = async () => {
    if (!id || !transferTo) return
    setTransferring(true); setError('')
    try {
      await evidenceApi.transfer(id, transferTo, transferNote || undefined)
      setSuccess('Evidence transferred successfully.')
      setTransferTo(''); setTransferNote('')
      const [e, c] = await Promise.all([evidenceApi.get(id), evidenceApi.getCustodyChain(id)])
      setEvidence(e); setCustody(c)
    } catch (e) { setError(getErrorMessage(e)) }
    finally { setTransferring(false) }
  }

  if (loading) return <PageLoader />
  if (!evidence) return <div className="p-8 text-slate-500">Evidence not found.</div>
  return (
    <div>
      <div className="page-header border-b border-slate-700 bg-slate-900 px-6 py-4 flex items-center gap-3">
        <button onClick={() => navigate('/evidence')} className="btn-icon p-2 shrink-0"><ArrowLeft className="h-4 w-4" /></button>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-bold text-[#4338CA]">{evidence.evidence_number}</span>
            <StatusBadge value={evidence.evidence_type} />
            <StatusBadge value={evidence.status} />
          </div>
          <h1 className="text-2xl font-bold text-slate-100 mt-1">{evidence.original_filename}</h1>
        </div>
        <div className="flex gap-2">
          {hasPermission('EVIDENCE_DOWNLOAD') && (
            <button onClick={handleDownload} className="btn-secondary gap-1.5 text-xs h-[36px]">
              <Download className="h-4 w-4 text-[#475467]" /> Download
            </button>
          )}
          {hasPermission('EVIDENCE_READ') && (
            <button onClick={handleVerify} disabled={verifying} className="btn-secondary gap-1.5 text-xs h-[36px]">
              <ShieldCheck className="h-4 w-4 text-[#475467]" /> {verifying ? 'Verifying…' : 'Verify Integrity'}
            </button>
          )}
        </div>
      </div>

      <div className="page-content space-y-5">
        {error && <ErrorAlert message={error} onClose={() => setError('')} />}
        {success && <SuccessAlert message={success} onClose={() => setSuccess('')} />}

        {/* Integrity result */}
        {integrity && (
          <div className={`card p-4 border-2 ${integrity.is_intact ? 'border-green-400 bg-green-50' : 'border-red-400 bg-red-50'}`}>
            <div className="flex items-center gap-2">
              {integrity.is_intact
                ? <ShieldCheck className="h-5 w-5 text-green-600" />
                : <ShieldOff className="h-5 w-5 text-red-600" />}
              <span className={`font-bold ${integrity.is_intact ? 'text-green-700' : 'text-red-700'}`}>
                {integrity.message}
              </span>
            </div>
            <div className="mt-2 space-y-1 text-xs font-mono">
              <div><span className="text-slate-500">Stored:  </span><span className="text-slate-700">{integrity.stored_hash}</span></div>
              <div><span className="text-slate-500">Current: </span>
                <span className={integrity.is_intact ? 'text-green-700' : 'text-red-700'}>{integrity.current_hash || 'N/A'}</span>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Evidence info */}
          <div className="card p-5">
            <h3 className="font-bold text-slate-100 mb-4 text-sm uppercase tracking-wider">Evidence Details</h3>
            <dl className="space-y-3 text-sm">
              {[
                ['MIME Type', evidence.mime_type],
                ['File Size', formatBytes(evidence.file_size)],
                ['Uploaded By', evidence.uploaded_by_name],
                ['Uploaded', format(new Date(evidence.uploaded_at), 'PPp')],
                ['Custodian', evidence.current_custodian_name ?? '—'],
                ['Case', <Link to={`/cases/${evidence.case_id}`} className="text-[#4338CA] hover:underline font-bold">{evidence.case_id.slice(0, 8)}…</Link>],
              ].map(([label, value]) => (
                <div key={String(label)} className="flex gap-3">
                  <dt className="w-28 shrink-0 text-slate-400 font-bold">{label}</dt>
                  <dd className="text-slate-200 font-semibold">{value}</dd>
                </div>
              ))}
            </dl>
            <div className="mt-4 pt-4 border-t border-slate-700">
              <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-2">SHA-256 Hash</p>
              <p className="hash-mono text-slate-200 bg-[#F8FAFC] border border-[#D9E0EA] rounded p-2.5 font-semibold">{evidence.sha256_hash}</p>
            </div>
            {evidence.description && (
              <div className="mt-3">
                <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-2">Description</p>
                <p className="text-sm text-slate-200 bg-[#F8FAFC] border border-[#D9E0EA] p-3 rounded-lg font-medium">{evidence.description}</p>
              </div>
            )}
          </div>

          {/* Transfer */}
          {hasPermission('EVIDENCE_TRANSFER') && (
            <div className="card p-5">
              <h3 className="font-bold text-slate-100 mb-4 text-sm uppercase tracking-wider flex items-center gap-2">
                <ArrowRightLeft className="h-4 w-4 text-indigo-600" /> Transfer Custody
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="label">Transfer To</label>
                  <select className="input h-[44px]" value={transferTo} onChange={e => setTransferTo(e.target.value)}>
                    <option value="">Select officer…</option>
                    {users.map(u => <option key={u.id} value={u.id}>{u.full_name} ({u.username})</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Remarks</label>
                  <input className="input h-[44px]" placeholder="Reason for transfer" value={transferNote} onChange={e => setTransferNote(e.target.value)} />
                </div>
                <button onClick={handleTransfer} disabled={!transferTo || transferring} className="btn-primary h-[44px] w-full flex items-center justify-center gap-1.5">
                  <ArrowRightLeft className="h-4 w-4" /> {transferring ? 'Transferring…' : 'Transfer Custody'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Chain of custody */}
        <div className="card p-5">
          <h3 className="font-bold text-slate-100 mb-4 text-sm uppercase tracking-wider">Chain of Custody</h3>
          {custody.length === 0
            ? <p className="text-sm text-slate-400 font-semibold">No custody records.</p>
            : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="table-header">
                    <tr>
                      <th className="px-4 py-3 text-left font-bold text-slate-300 text-xs uppercase tracking-wider">Action</th>
                      <th className="px-4 py-3 text-left font-bold text-slate-300 text-xs uppercase tracking-wider">From</th>
                      <th className="px-4 py-3 text-left font-bold text-slate-300 text-xs uppercase tracking-wider">To</th>
                      <th className="px-4 py-3 text-left font-bold text-slate-300 text-xs uppercase tracking-wider">By</th>
                      <th className="px-4 py-3 text-left font-bold text-slate-300 text-xs uppercase tracking-wider">Hash Snapshot</th>
                      <th className="px-4 py-3 text-left font-bold text-slate-300 text-xs uppercase tracking-wider">Time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#EAECF0]">
                    {custody.map(c => (
                      <tr key={c.id} className="table-row">
                        <td className="table-cell"><span className="rounded bg-indigo-50 border border-indigo-100 px-2 py-0.5 text-xs font-semibold text-indigo-700">{c.action}</span></td>
                        <td className="table-cell text-slate-300 text-xs font-medium">{c.previous_custodian_name ?? '—'}</td>
                        <td className="table-cell text-slate-100 text-xs font-bold">{c.new_custodian_name ?? '—'}</td>
                        <td className="table-cell text-slate-200 text-xs font-semibold">{c.transferred_by_name}</td>
                        <td className="table-cell font-mono text-xs text-slate-400">{c.sha256_at_transfer?.slice(0, 12) ?? '—'}…</td>
                        <td className="table-cell text-slate-400 text-xs font-medium">{format(new Date(c.transferred_at), 'PP p')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          }
        </div>
      </div>
    </div>
  )
}
