import { useState, useRef } from 'react'
import { Upload, X, CheckCircle2, AlertTriangle, Copy } from 'lucide-react'
import { evidenceApi } from '../../api/evidence'
import { getErrorMessage } from '../../api/client'
import type { BulkUploadFileResult } from '../../types'

interface Props {
  caseId: string
  onComplete?: (count: number) => void
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)}KB`
  return `${(bytes / 1048576).toFixed(1)}MB`
}

export function BulkEvidenceUpload({ caseId, onComplete }: Props) {
  const [files, setFiles] = useState<File[]>([])
  const [uploading, setUploading] = useState(false)
  const [results, setResults] = useState<BulkUploadFileResult[]>([])
  const [error, setError] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const addFiles = (newFiles: FileList | File[]) => {
    const arr = Array.from(newFiles)
    setFiles(prev => {
      const existing = new Set(prev.map(f => f.name + f.size))
      return [...prev, ...arr.filter(f => !existing.has(f.name + f.size))]
    })
    setResults([])
  }

  const removeFile = (i: number) => setFiles(prev => prev.filter((_, idx) => idx !== i))

  const handleUpload = async () => {
    if (!files.length) return
    setUploading(true); setError(''); setResults([])
    try {
      const res = await evidenceApi.bulkUpload(caseId, files)
      setResults(res.results)
      if (onComplete) onComplete(res.uploaded)
      if (res.uploaded > 0) setFiles([])
    } catch (e) {
      setError(getErrorMessage(e))
    } finally {
      setUploading(false)
    }
  }

  const getStatusIcon = (r: BulkUploadFileResult) => {
    if (r.status === 'success') return <CheckCircle2 className="h-4 w-4 text-green-500" />
    if (r.status === 'duplicate') return <Copy className="h-4 w-4 text-amber-500" />
    return <AlertTriangle className="h-4 w-4 text-red-500" />
  }

  const getStatusColor = (r: BulkUploadFileResult) => {
    if (r.status === 'success') return 'bg-green-50 border-green-200'
    if (r.status === 'duplicate') return 'bg-amber-50 border-amber-200'
    return 'bg-red-50 border-red-200'
  }

  return (
    <div className="space-y-3">
      {/* Drop zone */}
      <div
        onDragOver={e => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={e => { e.preventDefault(); setDragOver(false); addFiles(e.dataTransfer.files) }}
        onClick={() => fileRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors
          ${dragOver ? 'border-primary-500 bg-primary-50' : 'border-slate-200 hover:border-primary-400 hover:bg-slate-50'}`}
      >
        <Upload className="h-8 w-8 text-slate-300 mx-auto mb-2" />
        <p className="text-sm text-slate-600">Drag & drop multiple files, or click to browse</p>
        <p className="text-xs text-slate-400 mt-1">Max 20 files · 50MB each · Images, Videos, PDFs, Audio</p>
      </div>
      <input
        ref={fileRef}
        type="file"
        multiple
        accept=".jpg,.jpeg,.png,.gif,.bmp,.webp,.mp4,.avi,.mov,.mkv,.pdf,.docx,.txt,.csv,.mp3,.wav,.aac"
        className="hidden"
        onChange={e => e.target.files && addFiles(e.target.files)}
      />

      {/* File queue */}
      {files.length > 0 && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-slate-600">{files.length} file{files.length !== 1 ? 's' : ''} queued</p>
            <button onClick={() => setFiles([])} className="text-xs text-slate-400 hover:text-red-500">Clear all</button>
          </div>
          {files.map((f, i) => (
            <div key={i} className="flex items-center gap-2 text-xs bg-slate-50 rounded-lg px-3 py-2">
              <span className="flex-1 truncate text-slate-700">{f.name}</span>
              <span className="text-slate-400">{formatBytes(f.size)}</span>
              <button onClick={() => removeFile(i)} className="text-slate-300 hover:text-red-500">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}

          {error && <p className="text-xs text-red-600">{error}</p>}

          <button
            onClick={handleUpload}
            disabled={uploading}
            className="btn-primary w-full mt-2"
          >
            {uploading ? (
              <span className="flex items-center gap-2 justify-center">
                <span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                Uploading {files.length} files…
              </span>
            ) : (
              <><Upload className="h-4 w-4" /> Upload {files.length} File{files.length !== 1 ? 's' : ''}</>
            )}
          </button>
        </div>
      )}

      {/* Upload results */}
      {results.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-slate-600 mt-2">Upload Results:</p>
          {results.map((r, i) => (
            <div key={i} className={`flex items-start gap-2 text-xs rounded-lg border px-3 py-2 ${getStatusColor(r)}`}>
              {getStatusIcon(r)}
              <div className="flex-1 min-w-0">
                <p className="font-medium text-slate-700 truncate">{r.filename}</p>
                {r.status === 'success' && (
                  <p className="text-slate-500">
                    {r.evidence_number} · {r.evidence_type} · {r.sha256?.slice(0, 12)}…
                  </p>
                )}
                {(r.status === 'duplicate' || r.status === 'failed') && (
                  <p className="text-slate-500">{r.message}</p>
                )}
              </div>
              <span className={`shrink-0 font-medium capitalize ${
                r.status === 'success' ? 'text-green-600' :
                r.status === 'duplicate' ? 'text-amber-600' : 'text-red-600'
              }`}>{r.status}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
