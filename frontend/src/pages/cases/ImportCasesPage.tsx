import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Upload, Download, CheckCircle2, AlertTriangle, X, FileSpreadsheet } from 'lucide-react'
import { importApi } from '../../api/import'
import { getErrorMessage } from '../../api/client'
import { ErrorAlert } from '../../components/shared/ErrorAlert'
import type { ImportPreviewResponse, ImportConfirmResponse } from '../../types'

type Stage = 'upload' | 'preview' | 'importing' | 'done'

function SheetPreview({ preview, label }: { preview: any; label: string }) {
  if (!preview) return null
  return (
    <div className="rounded-lg border border-slate-200 p-4">
      <div className="flex items-center justify-between mb-2">
        <h4 className="font-medium text-slate-700 text-sm">{label}</h4>
        <div className="flex gap-2 text-xs">
          <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded">
            {preview.valid_rows} valid
          </span>
          {preview.invalid_rows > 0 && (
            <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded">
              {preview.invalid_rows} invalid
            </span>
          )}
          {preview.duplicate_rows > 0 && (
            <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded">
              {preview.duplicate_rows} duplicates
            </span>
          )}
        </div>
      </div>
      {preview.errors.length > 0 && (
        <ul className="space-y-1 mt-2">
          {preview.errors.slice(0, 10).map((e: any, i: number) => (
            <li key={i} className="text-xs text-red-600 flex items-start gap-1.5">
              <AlertTriangle className="h-3 w-3 shrink-0 mt-0.5" />
              <span>Row {e.row}{e.field ? ` [${e.field}]` : ''}: {e.message}</span>
            </li>
          ))}
          {preview.errors.length > 10 && (
            <li className="text-xs text-slate-400">…and {preview.errors.length - 10} more errors</li>
          )}
        </ul>
      )}
    </div>
  )
}

export function ImportCasesPage() {
  const navigate = useNavigate()
  const fileRef = useRef<HTMLInputElement>(null)

  const [stage, setStage] = useState<Stage>('upload')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<ImportPreviewResponse | null>(null)
  const [result, setResult] = useState<ImportConfirmResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [dragOver, setDragOver] = useState(false)

  const handleFile = (f: File) => {
    const ext = f.name.toLowerCase().split('.').pop()
    if (!['xlsx', 'xls', 'csv'].includes(ext || '')) {
      setError('Only .xlsx, .xls, and .csv files are supported')
      return
    }
    setSelectedFile(f)
    setError('')
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false)
    const f = e.dataTransfer.files[0]
    if (f) handleFile(f)
  }

  const handlePreview = async () => {
    if (!selectedFile) return
    setLoading(true); setError('')
    try {
      const p = await importApi.previewImport(selectedFile)
      setPreview(p)
      setStage('preview')
    } catch (e) {
      setError(getErrorMessage(e))
    } finally {
      setLoading(false)
    }
  }

  const handleConfirm = async () => {
    if (!selectedFile || !preview) return
    setStage('importing')
    setError('')
    try {
      const r = await importApi.confirmImport(selectedFile.name, selectedFile.size)
      setResult(r)
      setStage('done')
    } catch (e) {
      setError(getErrorMessage(e))
      setStage('preview')
    }
  }

  return (
    <div>
      <div className="page-header flex items-center gap-3">
        <button onClick={() => navigate('/cases')} className="btn-secondary p-2">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div>
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-emerald-600" />
            <h1 className="text-xl font-bold text-slate-800">Import Cases</h1>
          </div>
          <p className="text-sm text-slate-500">Bulk import cases from Excel or CSV</p>
        </div>
      </div>

      <div className="page-content max-w-2xl space-y-5">
        {/* Templates */}
        <div className="card p-4 flex items-center justify-between">
          <div>
            <p className="font-medium text-slate-700 text-sm">Download Templates</p>
            <p className="text-xs text-slate-400 mt-0.5">Use these templates to prepare your import data</p>
          </div>
          <div className="flex gap-2">
            <button onClick={importApi.downloadXlsxTemplate} className="btn-secondary text-xs gap-1.5">
              <Download className="h-3.5 w-3.5" /> Excel Template
            </button>
            <button onClick={importApi.downloadCsvTemplate} className="btn-secondary text-xs gap-1.5">
              <Download className="h-3.5 w-3.5" /> CSV Template
            </button>
          </div>
        </div>

        {error && <ErrorAlert message={error} onClose={() => setError('')} />}

        {/* STAGE: Upload */}
        {stage === 'upload' && (
          <div className="card p-6 space-y-4">
            <h2 className="font-semibold text-slate-700">1. Select File</h2>
            <div
              onDragOver={e => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors
                ${dragOver ? 'border-primary-500 bg-primary-50' : 'border-slate-300 hover:border-primary-400 hover:bg-slate-50'}`}
            >
              <Upload className="h-10 w-10 text-slate-300 mx-auto mb-3" />
              {selectedFile ? (
                <div>
                  <p className="font-medium text-slate-700">{selectedFile.name}</p>
                  <p className="text-xs text-slate-400 mt-1">{(selectedFile.size / 1024).toFixed(1)} KB</p>
                </div>
              ) : (
                <>
                  <p className="text-slate-600">Drag & drop your file here, or click to browse</p>
                  <p className="text-xs text-slate-400 mt-1">Supported: .xlsx, .xls, .csv (max 10MB)</p>
                </>
              )}
            </div>
            <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden"
              onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />

            {selectedFile && (
              <div className="flex gap-3">
                <button onClick={handlePreview} disabled={loading} className="btn-primary">
                  {loading ? (
                    <span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin inline-block" />
                  ) : 'Preview Import'}
                </button>
                <button onClick={() => { setSelectedFile(null); if (fileRef.current) fileRef.current.value = '' }}
                  className="btn-secondary">Clear</button>
              </div>
            )}

            <div className="rounded-lg bg-slate-50 border border-slate-100 p-4 text-xs text-slate-500 space-y-1">
              <p className="font-medium text-slate-600 mb-1">Security notes:</p>
              <p>• File contents are validated server-side against allowlists</p>
              <p>• Formula injection is automatically stripped from all cells</p>
              <p>• Data is previewed before anything is written to the database</p>
              <p>• Full audit log is created on successful import</p>
            </div>
          </div>
        )}

        {/* STAGE: Preview */}
        {stage === 'preview' && preview && (
          <div className="space-y-4">
            <div className="card p-5">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-semibold text-slate-700">2. Import Preview</h2>
                <div className="flex gap-2 text-xs">
                  <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded font-medium">
                    {preview.total_valid} valid
                  </span>
                  {preview.total_invalid > 0 && (
                    <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded font-medium">
                      {preview.total_invalid} invalid
                    </span>
                  )}
                </div>
              </div>

              <div className="text-xs text-slate-500 mb-4">
                File: <strong>{preview.filename}</strong> · {(preview.file_size / 1024).toFixed(1)} KB ·
                Sheets: {preview.sheets_found.join(', ')}
              </div>

              <div className="space-y-3">
                <SheetPreview preview={preview.cases} label="Cases" />
                <SheetPreview preview={preview.persons} label="Persons" />
                {preview.relationships && <SheetPreview preview={preview.relationships} label="Relationships" />}
                {preview.events && <SheetPreview preview={preview.events} label="Investigation Events" />}
              </div>
            </div>

            {!preview.can_import && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                <strong>Cannot import:</strong> Fix the errors above before importing.
              </div>
            )}

            <div className="flex gap-3">
              {preview.can_import && (
                <button onClick={handleConfirm} className="btn-primary gap-1.5">
                  <CheckCircle2 className="h-4 w-4" /> Confirm Import
                </button>
              )}
              <button onClick={() => { setStage('upload'); setPreview(null) }} className="btn-secondary">
                Cancel / Re-upload
              </button>
            </div>
          </div>
        )}

        {/* STAGE: Importing */}
        {stage === 'importing' && (
          <div className="card p-12 text-center">
            <div className="h-12 w-12 rounded-full border-4 border-slate-200 border-t-primary-500 animate-spin mx-auto mb-4" />
            <p className="font-medium text-slate-700">Importing data…</p>
            <p className="text-sm text-slate-400 mt-1">Creating cases, persons, and relationships</p>
          </div>
        )}

        {/* STAGE: Done */}
        {stage === 'done' && result && (
          <div className="card p-6 space-y-4">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-8 w-8 text-green-500" />
              <div>
                <h2 className="font-bold text-slate-800">Import Complete</h2>
                <p className="text-sm text-slate-500">Data has been imported and audit log created</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Cases Created', value: result.cases_created, color: 'bg-blue-50 text-blue-700' },
                { label: 'Persons Created', value: result.persons_created, color: 'bg-amber-50 text-amber-700' },
                { label: 'Persons Linked', value: result.persons_linked, color: 'bg-purple-50 text-purple-700' },
                { label: 'Relationships', value: result.relationships_created, color: 'bg-teal-50 text-teal-700' },
                { label: 'Events', value: result.events_created, color: 'bg-indigo-50 text-indigo-700' },
                { label: 'Errors', value: result.errors.length, color: result.errors.length > 0 ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700' },
              ].map(item => (
                <div key={item.label} className={`rounded-lg p-3 ${item.color}`}>
                  <p className="text-2xl font-bold">{item.value}</p>
                  <p className="text-xs font-medium mt-0.5">{item.label}</p>
                </div>
              ))}
            </div>

            {result.errors.length > 0 && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                <p className="text-xs font-medium text-red-700 mb-1">Import warnings:</p>
                {result.errors.slice(0, 5).map((e, i) => (
                  <p key={i} className="text-xs text-red-600">{e}</p>
                ))}
              </div>
            )}

            <div className="flex gap-3">
              <button onClick={() => navigate('/cases')} className="btn-primary">View Cases</button>
              <button onClick={() => { setStage('upload'); setSelectedFile(null); setPreview(null); setResult(null) }}
                className="btn-secondary">Import Another File</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

