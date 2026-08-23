import { useState, useRef } from 'react'
import {
  Upload, FileText, CheckCircle2, AlertTriangle, ArrowRight,
  Loader2, Download, Eye, Sparkles, X,
} from 'lucide-react'
import { importApi as importApiRaw } from '../../api/import'
import { nlpApi } from '../../api/nlp'
import { ErrorAlert, SuccessAlert } from '../../components/shared/ErrorAlert'
import { getErrorMessage } from '../../api/client'
import type { ImportPreviewResponse, ImportConfirmResponse } from '../../types'

const importApi = {
  preview: (file: File): Promise<ImportPreviewResponse> => importApiRaw.previewImport(file),
  confirm: (filename: string, fileSize: number): Promise<ImportConfirmResponse> =>
    importApiRaw.confirmImport(filename, fileSize),
}

type Stage = 'idle' | 'uploading' | 'uploaded' | 'previewed' | 'importing' | 'done'
  | 'nlp_extracting' | 'nlp_done' | 'error'

interface PipelineStep { label: string; status: 'pending' | 'running' | 'done' | 'error' }

interface ExtractedEntity {
  text: string; type: string; confidence: number; source_text: string; status: string
}

const ENTITY_TYPE_COLORS: Record<string, string> = {
  PERSON:       'bg-indigo-900/40 text-indigo-300 border-indigo-700/30',
  LOCATION:     'bg-emerald-900/40 text-emerald-300 border-emerald-700/30',
  ORGANIZATION: 'bg-violet-900/40 text-violet-300 border-violet-700/30',
  DATE:         'bg-blue-900/40 text-blue-300 border-blue-700/30',
  MONEY:        'bg-amber-900/40 text-amber-300 border-amber-700/30',
  PHONE:        'bg-cyan-900/40 text-cyan-300 border-cyan-700/30',
  VEHICLE:      'bg-orange-900/40 text-orange-300 border-orange-700/30',
  EMAIL:        'bg-pink-900/40 text-pink-300 border-pink-700/30',
  CASE_REF:     'bg-slate-700 text-slate-300 border-slate-600',
}

export function DataIngestionPage() {
  const [stage, setStage] = useState<Stage>('idle')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [previewData, setPreviewData] = useState<ImportPreviewResponse | null>(null)
  const [importResult, setImportResult] = useState<ImportConfirmResponse | null>(null)
  const [nlpText, setNlpText] = useState('')
  const [nlpEntities, setNlpEntities] = useState<ExtractedEntity[]>([])
  const [nlpDuplicates, setNlpDuplicates] = useState<Record<string, unknown>[]>([])
  const [entityFilter, setEntityFilter] = useState('')
  const [steps, setSteps] = useState<PipelineStep[]>([])
  const [activeTab, setActiveTab] = useState<'bulk' | 'nlp'>('bulk')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const updateStep = (idx: number, status: PipelineStep['status']) =>
    setSteps(prev => prev.map((s, i) => i === idx ? { ...s, status } : s))

  const handleFileSelect = (file: File) => {
    setSelectedFile(file); setStage('uploaded')
    setPreviewData(null); setImportResult(null); setError('')
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file) handleFileSelect(file)
  }

  const handlePreview = async () => {
    if (!selectedFile) return
    setStage('uploading'); setError('')
    setSteps([
      { label: 'Upload file', status: 'running' },
      { label: 'Validate format', status: 'pending' },
      { label: 'Parse content', status: 'pending' },
      { label: 'Extract entities', status: 'pending' },
      { label: 'Preview ready', status: 'pending' },
    ])
    try {
      updateStep(0, 'done'); updateStep(1, 'running')
      await new Promise(r => setTimeout(r, 300))
      updateStep(1, 'done'); updateStep(2, 'running')
      const data = await importApi.preview(selectedFile)
      updateStep(2, 'done'); updateStep(3, 'running')
      await new Promise(r => setTimeout(r, 200))
      updateStep(3, 'done'); updateStep(4, 'running')
      await new Promise(r => setTimeout(r, 100))
      updateStep(4, 'done')
      setPreviewData(data); setStage('previewed')
    } catch (e) {
      setError(getErrorMessage(e)); setStage('error')
    }
  }

  const handleImport = async () => {
    if (!selectedFile || !previewData) return
    setStage('importing'); setError('')
    try {
      const result = await importApi.confirm(selectedFile.name, selectedFile.size)
      setImportResult(result); setStage('done')
      setSuccess(`Import complete! ${result.cases_created} cases, ${result.persons_created} persons created.`)
    } catch (e) {
      setError(getErrorMessage(e)); setStage('error')
    }
  }

  const handleNlpExtract = async () => {
    if (!nlpText.trim()) return
    setStage('nlp_extracting'); setError('')
    try {
      const result = await nlpApi.extract(nlpText, 'Manual Input')
      setNlpEntities(result.entities || [])
      setNlpDuplicates(result.possible_duplicates || [])
      setStage('nlp_done')
    } catch (e) {
      setError(getErrorMessage(e)); setStage('idle')
    }
  }

  const handleReset = () => {
    setStage('idle'); setSelectedFile(null); setPreviewData(null)
    setImportResult(null); setError(''); setSuccess(''); setSteps([])
  }

  const filteredEntities = entityFilter
    ? nlpEntities.filter(e => e.type === entityFilter)
    : nlpEntities
  const uniqueTypes = [...new Set(nlpEntities.map(e => e.type))]

  const renderStepIcon = (status: PipelineStep['status']) => {
    if (status === 'done')    return <CheckCircle2 className="h-3.5 w-3.5" />
    if (status === 'running') return <Loader2 className="h-3.5 w-3.5 animate-spin" />
    if (status === 'error')   return <AlertTriangle className="h-3.5 w-3.5" />
    return <div className="h-3.5 w-3.5 rounded-full border border-current opacity-30" />
  }

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <h1 className="text-lg font-bold text-slate-100 flex items-center gap-2">
          <Upload className="h-5 w-5 text-indigo-400" /> Data Ingestion
        </h1>
        <p className="text-xs text-slate-500 mt-0.5">Import investigation data and extract entities using NLP</p>
      </div>

      <div className="page-content space-y-5">
        {/* Tab switcher */}
        <div className="flex gap-1 p-1 bg-slate-900 rounded-lg border border-slate-800 w-fit">
          {([
            { key: 'bulk', label: 'Bulk Import (XLSX/CSV)', icon: <Upload className="h-3.5 w-3.5" /> },
            { key: 'nlp',  label: 'NLP Text Extraction',   icon: <Sparkles className="h-3.5 w-3.5" /> },
          ] as const).map(({ key, label, icon }) => (
            <button key={key} onClick={() => setActiveTab(key)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-xs font-medium transition-colors ${
                activeTab === key ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}>
              {icon} {label}
            </button>
          ))}
        </div>

        {error   && <ErrorAlert   message={error}   onClose={() => setError('')} />}
        {success && <SuccessAlert message={success} onClose={() => setSuccess('')} />}

        {/* ── BULK IMPORT TAB ── */}
        {activeTab === 'bulk' && (
          <div className="space-y-4">
            {/* Pipeline progress */}
            {steps.length > 0 && (
              <div className="card p-4">
                <p className="text-xs font-semibold text-slate-400 mb-3 uppercase tracking-wider">
                  Import Pipeline
                </p>
                <div className="flex items-center gap-2 flex-wrap">
                  {steps.map((step, i) => (
                    <div key={i} className="flex items-center gap-1.5">
                      <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                        step.status === 'done'    ? 'bg-emerald-900/30 border-emerald-700/40 text-emerald-300' :
                        step.status === 'running' ? 'bg-indigo-900/30 border-indigo-700/40 text-indigo-300 animate-pulse' :
                        step.status === 'error'   ? 'bg-red-900/30 border-red-700/40 text-red-300' :
                                                    'bg-slate-800/60 border-slate-700/40 text-slate-500'
                      }`}>
                        {renderStepIcon(step.status)}
                        {step.label}
                      </div>
                      {i < steps.length - 1 && (
                        <ArrowRight className="h-3.5 w-3.5 text-slate-700 shrink-0" />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Template download */}
            <div className="card p-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-300">Import Template</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  Download the pre-formatted template to prepare your data
                </p>
              </div>
              <div className="flex gap-2">
                <a
                  href={`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'}/api/v1/import/template/xlsx`}
                  className="btn-secondary text-xs py-1.5"
                >
                  <Download className="h-3.5 w-3.5" /> XLSX Template
                </a>
                <a
                  href={`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'}/api/v1/import/template/csv`}
                  className="btn-secondary text-xs py-1.5"
                >
                  <Download className="h-3.5 w-3.5" /> CSV Template
                </a>
              </div>
            </div>

            {/* Drop zone */}
            {(stage === 'idle' || stage === 'uploaded' || stage === 'error') && (
              <div
                onDrop={handleDrop}
                onDragOver={e => e.preventDefault()}
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-700 rounded-xl p-12 text-center cursor-pointer hover:border-indigo-600/50 hover:bg-indigo-900/5 transition-colors group"
              >
                <Upload className="h-10 w-10 mx-auto text-slate-700 group-hover:text-indigo-500 transition-colors mb-3" />
                <p className="text-sm font-medium text-slate-400 group-hover:text-slate-300">
                  {selectedFile ? selectedFile.name : 'Drop your XLSX or CSV file here'}
                </p>
                <p className="text-xs text-slate-600 mt-1">or click to browse · Max 10MB</p>
                {selectedFile && (
                  <div className="mt-3 inline-flex items-center gap-2 bg-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-300">
                    <FileText className="h-3.5 w-3.5 text-indigo-400" />
                    {selectedFile.name}
                    <span className="text-slate-500">({(selectedFile.size / 1024).toFixed(0)} KB)</span>
                  </div>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="hidden"
                  onChange={e => { if (e.target.files?.[0]) handleFileSelect(e.target.files[0]) }}
                />
              </div>
            )}

            {/* Action button after file selected */}
            {selectedFile && stage === 'uploaded' && (
              <button onClick={handlePreview} className="btn-primary">
                <Eye className="h-4 w-4" /> Preview Import
              </button>
            )}

            {/* Preview result */}
            {previewData && stage !== 'done' && (
              <div className="card p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-slate-200 flex items-center gap-2">
                    <Eye className="h-4 w-4 text-indigo-400" /> Import Preview
                  </h3>
                  <div className={`text-xs px-2 py-1 rounded border ${
                    previewData.can_import
                      ? 'bg-emerald-900/30 text-emerald-300 border-emerald-700/30'
                      : 'bg-red-900/30 text-red-300 border-red-700/30'
                  }`}>
                    {previewData.can_import ? '✓ Ready to import' : '✗ Fix errors first'}
                  </div>
                </div>

                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  {([
                    { label: 'Valid rows',   value: previewData.total_valid,           color: 'text-emerald-400' },
                    { label: 'Invalid rows', value: previewData.total_invalid,         color: 'text-red-400'     },
                    { label: 'Cases',        value: previewData.cases?.valid_rows ?? 0, color: 'text-indigo-400' },
                    { label: 'Persons',      value: previewData.persons?.valid_rows ?? 0, color: 'text-blue-400' },
                  ] as const).map(({ label, value, color }) => (
                    <div key={label} className="rounded-lg bg-slate-800/60 p-3 text-center">
                      <p className={`text-xl font-bold ${color}`}>{value}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{label}</p>
                    </div>
                  ))}
                </div>

                {(previewData.cases?.errors?.length ?? 0) > 0 && (
                  <div className="rounded-lg bg-red-900/10 border border-red-800/30 p-3">
                    <p className="text-xs font-semibold text-red-400 mb-2">Validation Errors</p>
                    <div className="space-y-1">
                      {previewData.cases.errors.slice(0, 5).map((e, i) => (
                        <p key={i} className="text-xs text-red-300">Row {e.row}: {e.message}</p>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex gap-2">
                  <button
                    onClick={handleImport}
                    disabled={!previewData.can_import || stage === 'importing'}
                    className="btn-primary"
                  >
                    {stage === 'importing'
                      ? <><Loader2 className="h-4 w-4 animate-spin" /> Importing…</>
                      : <><CheckCircle2 className="h-4 w-4" /> Confirm Import</>
                    }
                  </button>
                  <button onClick={handleReset} className="btn-secondary">
                    <X className="h-4 w-4" /> Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Done state */}
            {stage === 'done' && importResult && (
              <div className="card p-5 space-y-4">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                  <h3 className="font-semibold text-emerald-300">Import Successful</h3>
                </div>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  {([
                    { label: 'Cases created',   value: importResult.cases_created },
                    { label: 'Persons created', value: importResult.persons_created },
                    { label: 'Persons linked',  value: importResult.persons_linked },
                    { label: 'Relationships',   value: importResult.relationships_created },
                  ] as const).map(({ label, value }) => (
                    <div key={label} className="rounded-lg bg-emerald-900/10 border border-emerald-800/20 p-3 text-center">
                      <p className="text-xl font-bold text-emerald-400">{value}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{label}</p>
                    </div>
                  ))}
                </div>
                <button onClick={handleReset} className="btn-secondary text-xs">
                  Import Another File
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── NLP TAB ── */}
        {activeTab === 'nlp' && (
          <div className="space-y-4">
            <div className="card p-4">
              <p className="text-xs font-semibold text-slate-400 mb-2">NLP Entity Extraction</p>
              <p className="text-xs text-slate-600 mb-3">
                Paste investigation text (FIR, witness statement, report) to automatically extract
                persons, locations, vehicles, dates, and other entities.
              </p>
              <textarea
                value={nlpText}
                onChange={e => setNlpText(e.target.value)}
                className="input min-h-[160px] resize-y font-mono text-xs"
                placeholder={`Example:\nRamesh Kumar met Suresh at Indore on 14 August using vehicle MP09XX1234.\nThey later transferred ₹2,50,000 to account 123456789012.\nPhone 9876543210 was used to coordinate.`}
              />
              <div className="flex gap-2 mt-3">
                <button
                  onClick={handleNlpExtract}
                  disabled={!nlpText.trim() || stage === 'nlp_extracting'}
                  className="btn-primary"
                >
                  {stage === 'nlp_extracting'
                    ? <><Loader2 className="h-4 w-4 animate-spin" /> Extracting…</>
                    : <><Sparkles className="h-4 w-4" /> Extract Entities</>
                  }
                </button>
                {nlpEntities.length > 0 && (
                  <button
                    onClick={() => { setNlpEntities([]); setNlpDuplicates([]); setStage('idle') }}
                    className="btn-secondary text-xs"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>

            {/* NLP Results */}
            {stage === 'nlp_done' && nlpEntities.length > 0 && (
              <div className="space-y-4">
                <div className="card p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-slate-200">
                      {nlpEntities.length} Entities Extracted
                    </h3>
                    <div className="flex gap-1.5 flex-wrap">
                      <button
                        onClick={() => setEntityFilter('')}
                        className={`text-[10px] px-2 py-0.5 rounded-full border ${
                          !entityFilter
                            ? 'bg-indigo-600 text-white border-indigo-600'
                            : 'border-slate-700 text-slate-400'
                        }`}
                      >
                        All
                      </button>
                      {uniqueTypes.map(t => (
                        <button
                          key={t}
                          onClick={() => setEntityFilter(t === entityFilter ? '' : t)}
                          className={`text-[10px] px-2 py-0.5 rounded-full border ${
                            entityFilter === t
                              ? 'bg-indigo-600 text-white border-indigo-600'
                              : 'border-slate-700 text-slate-400'
                          }`}
                        >
                          {t} ({nlpEntities.filter(e => e.type === t).length})
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-slate-800">
                          {['Entity', 'Type', 'Confidence', 'Context', 'Status'].map(h => (
                            <th key={h} className="text-left py-2 px-3 text-slate-500 font-medium">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {filteredEntities.map((entity, i) => (
                          <tr key={i} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                            <td className="py-2 px-3 font-semibold text-slate-200">{entity.text}</td>
                            <td className="py-2 px-3">
                              <span className={`px-2 py-0.5 rounded border text-[10px] font-medium ${
                                ENTITY_TYPE_COLORS[entity.type] || 'bg-slate-800 text-slate-400 border-slate-700'
                              }`}>
                                {entity.type}
                              </span>
                            </td>
                            <td className="py-2 px-3">
                              <div className="flex items-center gap-2">
                                <div className="h-1.5 w-16 bg-slate-800 rounded-full">
                                  <div
                                    className="h-1.5 rounded-full bg-indigo-500"
                                    style={{ width: `${Math.round(entity.confidence * 100)}%` }}
                                  />
                                </div>
                                <span className="text-slate-400">{Math.round(entity.confidence * 100)}%</span>
                              </div>
                            </td>
                            <td className="py-2 px-3 max-w-[200px]">
                              <span className="text-slate-600 truncate block" title={entity.source_text}>
                                {entity.source_text?.slice(0, 60)}…
                              </span>
                            </td>
                            <td className="py-2 px-3">
                              <span className="px-2 py-0.5 rounded bg-amber-900/30 text-amber-400 border border-amber-700/30 text-[10px]">
                                {entity.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Possible duplicates / entity resolution */}
                {nlpDuplicates.length > 0 && (
                  <div className="card p-4">
                    <h3 className="text-sm font-semibold text-slate-200 mb-3 flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-amber-400" />
                      Entity Resolution — Possible Duplicates
                    </h3>
                    <div className="space-y-3">
                      {nlpDuplicates.map((dup, i) => (
                        <div
                          key={i}
                          className="flex items-center justify-between p-3 rounded-lg bg-amber-900/10 border border-amber-800/30"
                        >
                          <div className="flex items-center gap-3">
                            <span className="font-semibold text-slate-200 text-sm">{String(dup.entity_a ?? '')}</span>
                            <span className="text-slate-600">↔</span>
                            <span className="font-semibold text-slate-200 text-sm">{String(dup.entity_b ?? '')}</span>
                          </div>
                          <div className="flex items-center gap-3 shrink-0">
                            <div className="text-right">
                              <p className="text-xs font-bold text-amber-400">
                                {Math.round(Number(dup.similarity ?? 0) * 100)}%
                              </p>
                              <p className="text-[10px] text-slate-600">similarity</p>
                            </div>
                            <span className={`text-[10px] px-2 py-0.5 rounded border ${
                              dup.recommendation === 'LIKELY_SAME'
                                ? 'bg-emerald-900/30 text-emerald-300 border-emerald-700/30'
                                : 'bg-amber-900/30 text-amber-300 border-amber-700/30'
                            }`}>
                              {String(dup.recommendation ?? '')}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-slate-600 mt-3 italic">
                      Identity resolution requires investigator confirmation.
                      Do not automatically merge without review.
                    </p>
                  </div>
                )}

                <div className="rounded-lg border border-blue-800/30 bg-blue-900/10 px-4 py-3">
                  <p className="text-xs font-semibold text-blue-400">All extractions are PENDING review</p>
                  <p className="text-xs text-blue-500/70 mt-0.5">
                    NLP extraction is not infallible. Review each entity before incorporating
                    into investigation records.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
