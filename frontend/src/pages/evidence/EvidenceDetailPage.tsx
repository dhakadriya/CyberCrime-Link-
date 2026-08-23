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
      <div className="page-header flex items-center gap-3">
        <button onClick={() => navigate('/evidence')} className="btn-secondary p-2"><ArrowLeft className="h-4 w-4" /></button>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm font-bold text-primary-600">{evidence.evidence_number}</span>
            <StatusBadge value={evidence.evidence_type} />
            <StatusBadge value={evidence.status} />
          </div>
          <h1 className="text-xl font-bold text-slate-800 mt-0.5">{evidence.original_filename}</h1>
        </div>
        <div className="flex gap-2">
          {hasPermission('EVIDENCE_DOWNLOAD') && (
            <button onClick={handleDownload} className="btn-secondary gap-1.5 text-xs">
              <Download className="h-3.5 w-3.5" /> Download
            </button>
          )}
          {hasPermission('EVIDENCE_READ') && (
            <button onClick={handleVerify} disabled={verifying} className="btn-secondary gap-1.5 text-xs">
              <ShieldCheck className="h-3.5 w-3.5" /> {verifying ? 'Verifying…' : 'Verify Integrity'}
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
            <h3 className="font-semibold text-slate-700 mb-4">Evidence Details</h3>
            <dl className="space-y-2.5 text-sm">
              {[
                ['MIME Type', evidence.mime_type],
                ['File Size', formatBytes(evidence.file_size)],
                ['Uploaded By', evidence.uploaded_by_name],
                ['Uploaded', format(new Date(evidence.uploaded_at), 'PPp')],
                ['Custodian', evidence.current_custodian_name ?? '—'],
                ['Case', <Link to={`/cases/${evidence.case_id}`} className="text-primary-600 hover:underline">{evidence.case_id.slice(0, 8)}…</Link>],
              ].map(([label, value]) => (
                <div key={String(label)} className="flex gap-3">
                  <dt className="w-28 shrink-0 text-slate-400">{label}</dt>
                  <dd className="text-slate-700">{value}</dd>
                </div>
              ))}
            </dl>
            <div className="mt-4 pt-4 border-t border-slate-100">
              <p className="text-xs text-slate-400 mb-1">SHA-256 Hash</p>
              <p className="hash-mono text-slate-600 bg-slate-50 rounded p-2">{evidence.sha256_hash}</p>
            </div>
            {evidence.description && (
              <div className="mt-3">
                <p className="text-xs text-slate-400 mb-1">Description</p>
                <p className="text-sm text-slate-600">{evidence.description}</p>
              </div>
            )}
          </div>

          {/* Transfer */}
          {hasPermission('EVIDENCE_TRANSFER') && (
            <div className="card p-5">
              <h3 className="font-semibold text-slate-700 mb-4 flex items-center gap-2">
                <ArrowRightLeft className="h-4 w-4" /> Transfer Custody
              </h3>
              <div className="space-y-3">
                <div>
                  <label className="label">Transfer To</label>
                  <select className="input" value={transferTo} onChange={e => setTransferTo(e.target.value)}>
                    <option value="">Select officer…</option>
                    {users.map(u => <option key={u.id} value={u.id}>{u.full_name} ({u.username})</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Remarks</label>
                  <input className="input" placeholder="Reason for transfer" value={transferNote} onChange={e => setTransferNote(e.target.value)} />
                </div>
                <button onClick={handleTransfer} disabled={!transferTo || transferring} className="btn-primary w-full">
                  <ArrowRightLeft className="h-4 w-4" /> {transferring ? 'Transferring…' : 'Transfer Custody'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Chain of custody */}
        <div className="card p-5">
          <h3 className="font-semibold text-slate-700 mb-4">Chain of Custody</h3>
          {custody.length === 0
            ? <p className="text-sm text-slate-400">No custody records.</p>
            : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-slate-100">
                    <tr>
                      <th className="pb-2 text-left font-medium text-slate-600">Action</th>
                      <th className="pb-2 text-left font-medium text-slate-600">From</th>
                      <th className="pb-2 text-left font-medium text-slate-600">To</th>
                      <th className="pb-2 text-left font-medium text-slate-600">By</th>
                      <th className="pb-2 text-left font-medium text-slate-600">Hash Snapshot</th>
                      <th className="pb-2 text-left font-medium text-slate-600">Time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {custody.map(c => (
                      <tr key={c.id}>
                        <td className="py-2 pr-4"><span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">{c.action}</span></td>
                        <td className="py-2 pr-4 text-slate-500 text-xs">{c.previous_custodian_name ?? '—'}</td>
                        <td className="py-2 pr-4 text-slate-700 text-xs">{c.new_custodian_name ?? '—'}</td>
                        <td className="py-2 pr-4 text-slate-600 text-xs">{c.transferred_by_name}</td>
                        <td className="py-2 pr-4 font-mono text-xs text-slate-400">{c.sha256_at_transfer?.slice(0, 12) ?? '—'}…</td>
                        <td className="py-2 text-slate-400 text-xs">{format(new Date(c.transferred_at), 'PP p')}</td>
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
