import { useState, useRef, useEffect } from 'react'
import {
  Upload, FileText, CheckCircle2, AlertTriangle, ArrowRight,
  Loader2, Download, Eye, Sparkles, X, Check, Trash2, Edit2, Save, Users, RefreshCw
} from 'lucide-react'
import { importApi as importApiRaw } from '../../api/import'
import { nlpApi } from '../../api/nlp'
import { personsApi } from '../../api/persons'
import { ErrorAlert, SuccessAlert } from '../../components/shared/ErrorAlert'
import { getErrorMessage } from '../../api/client'
import type { ImportPreviewResponse, ImportConfirmResponse } from '../../types'
import clsx from 'clsx'

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
  PERSON:       'bg-indigo-100 text-indigo-800 border-indigo-300 dark:bg-indigo-900/40 dark:text-indigo-300 dark:border-indigo-700/30',
  LOCATION:     'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-900/40 dark:text-emerald-300 dark:border-emerald-700/30',
  ORGANIZATION: 'bg-violet-100 text-violet-800 border-violet-300 dark:bg-violet-900/40 dark:text-violet-300 dark:border-violet-700/30',
  DATE:         'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900/40 dark:text-blue-300 dark:border-blue-700/30',
  MONEY:        'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/40 dark:text-amber-300 dark:border-amber-700/30',
  PHONE:        'bg-cyan-100 text-cyan-800 border-cyan-300 dark:bg-cyan-900/40 dark:text-cyan-300 dark:border-cyan-700/30',
  VEHICLE:      'bg-orange-100 text-orange-800 border-orange-300 dark:bg-orange-900/40 dark:text-orange-300 dark:border-orange-700/30',
  EMAIL:        'bg-pink-100 text-pink-850 border-pink-300 dark:bg-pink-900/40 dark:text-pink-300 dark:border-pink-700/30',
  CASE_REF:     'bg-slate-800 text-slate-300 border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:border-slate-800',
}

const ENTITY_TYPES = ['PERSON', 'LOCATION', 'ORGANIZATION', 'DATE', 'MONEY', 'PHONE', 'VEHICLE', 'EMAIL', 'CASE_REF']

export function DataIngestionPage() {
  const [stage, setStage] = useState<Stage>('idle')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [previewData, setPreviewData] = useState<ImportPreviewResponse | null>(null)
  const [importResult, setImportResult] = useState<ImportConfirmResponse | null>(null)
  const [nlpText, setNlpText] = useState('')
  const [nlpEntities, setNlpEntities] = useState<ExtractedEntity[]>([])
  const [nlpDuplicates, setNlpDuplicates] = useState<Record<string, any>[]>([])
  const [entityFilter, setEntityFilter] = useState('')
  const [steps, setSteps] = useState<PipelineStep[]>([])
  const [activeTab, setActiveTab] = useState<'bulk' | 'nlp' | 'resolution'>('bulk')
  const fileInputRef = useRef<HTMLInputElement>(null)

  // In-place edit state for NLP entities
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [editText, setEditText] = useState('')
  const [editType, setEditType] = useState('')

  // Global identity resolution state
  const [dbPersons, setDbPersons] = useState<any[]>([])
  const [mergeSourceId, setMergeSourceId] = useState('')
  const [mergeTargetId, setMergeTargetId] = useState('')
  const [merging, setMerging] = useState(false)

  const loadPersons = () => {
    personsApi.list({ size: 100 })
      .then(res => setDbPersons(res.items || []))
      .catch(() => {})
  }

  useEffect(() => {
    loadPersons()
  }, [])

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

  // Interactive review helpers
  const handleAcceptEntity = (index: number) => {
    setNlpEntities(prev => prev.map((e, idx) => idx === index ? { ...e, status: 'APPROVED' } : e))
  }

  const handleRejectEntity = (index: number) => {
    setNlpEntities(prev => prev.filter((_, idx) => idx !== index))
  }

  const handleStartEdit = (index: number, entity: ExtractedEntity) => {
    setEditingIndex(index)
    setEditText(entity.text)
    setEditType(entity.type)
  }

  const handleSaveEdit = (index: number) => {
    setNlpEntities(prev => prev.map((e, idx) => idx === index ? { ...e, text: editText, type: editType, status: 'EDITED' } : e))
    setEditingIndex(null)
  }

  // Perform identity resolution database merge
  const handleMergeProfiles = async () => {
    if (!mergeSourceId || !mergeTargetId) return
    if (mergeSourceId === mergeTargetId) {
      setError('Cannot merge a profile into itself.')
      return
    }
    setMerging(true)
    setError('')
    setSuccess('')
    try {
      const res = await personsApi.merge(mergeSourceId, mergeTargetId)
      setSuccess(res.message || 'Profiles successfully merged in the database.')
      setMergeSourceId('')
      setMergeTargetId('')
      loadPersons()
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setMerging(false)
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

  const sourcePerson = dbPersons.find(p => p.id === mergeSourceId)
  const targetPerson = dbPersons.find(p => p.id === mergeTargetId)

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <h1 className="text-lg font-bold text-slate-100 flex items-center gap-2">
          <Upload className="h-5 w-5 text-indigo-400" /> Data Ingestion & Resolution
        </h1>
        <p className="text-xs text-slate-500 mt-0.5">Ingest spreadsheet logs, extract entities, and resolve duplicate files</p>
      </div>

      <div className="page-content space-y-5">
        {/* Tab switcher */}
        <div className="flex gap-1 p-1 bg-slate-900 rounded-lg border border-slate-800 w-fit">
          {[
            { key: 'bulk', label: 'Bulk Import (XLSX/CSV)', icon: <Upload className="h-3.5 w-3.5" /> },
            { key: 'nlp',  label: 'NLP Review Extractor',   icon: <Sparkles className="h-3.5 w-3.5" /> },
            { key: 'resolution', label: 'Identity Resolution', icon: <Users className="h-3.5 w-3.5" /> },
          ].map(({ key, label, icon }) => (
            <button key={key} onClick={() => { setActiveTab(key as any); setError(''); setSuccess('') }}
              className={clsx(
                "flex items-center gap-1.5 px-4 py-2 rounded-md text-xs font-medium transition-colors",
                activeTab === key ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
              )}>
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
              <div className="card p-4 border-slate-800">
                <p className="text-[10px] font-bold text-slate-400 mb-3 uppercase tracking-widest">
                  Import Pipeline
                </p>
                <div className="flex items-center gap-2 flex-wrap">
                  {steps.map((step, i) => (
                    <div key={i} className="flex items-center gap-1.5">
                      <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all ${
                        step.status === 'done'    ? 'bg-emerald-100 border-emerald-200 text-emerald-800 dark:bg-emerald-900/30 dark:border-emerald-700/40 dark:text-emerald-300' :
                        step.status === 'running' ? 'bg-indigo-100 border-indigo-200 text-indigo-800 dark:bg-indigo-900/30 dark:border-indigo-700/40 dark:text-indigo-300 animate-pulse' :
                        step.status === 'error'   ? 'bg-red-100 border-red-200 text-red-800 dark:bg-red-900/30 dark:border-red-700/40 dark:text-red-300' :
                                                    'bg-slate-800 border-slate-700 text-slate-300 dark:text-slate-500'
                      }`}>
                        {renderStepIcon(step.status)}
                        {step.label}
                      </div>
                      {i < steps.length - 1 && (
                        <ArrowRight className="h-3.5 w-3.5 text-slate-750 shrink-0" />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Template download */}
            <div className="card p-4 flex items-center justify-between border-slate-800">
              <div>
                <p className="text-sm font-semibold text-slate-200">Import Template</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  Prepare your spreadsheet data matching the system schema
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
                className="border-2 border-dashed border-slate-800 bg-slate-900/20 rounded-xl p-12 text-center cursor-pointer hover:border-indigo-650/50 hover:bg-indigo-950/10 transition-all group"
              >
                <Upload className="h-10 w-10 mx-auto text-slate-600 group-hover:text-indigo-500 transition-colors mb-3" />
                <p className="text-sm font-semibold text-slate-400 group-hover:text-slate-300">
                  {selectedFile ? selectedFile.name : 'Drag and drop your spreadsheet here'}
                </p>
                <p className="text-xs text-slate-500 mt-1">Accepts XLSX and CSV files · Max 10MB</p>
                {selectedFile && (
                  <div className="mt-3 inline-flex items-center gap-2 bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200">
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

            {/* Action button */}
            {selectedFile && stage === 'uploaded' && (
              <button onClick={handlePreview} className="btn-primary">
                <Eye className="h-4 w-4" /> Validate & Preview
              </button>
            )}

            {/* Preview result */}
            {previewData && stage !== 'done' && (
              <div className="card p-5 space-y-4 border-slate-800">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-slate-200 flex items-center gap-2">
                    <Eye className="h-4 w-4 text-indigo-400" /> Import Preview
                  </h3>
                  <div className={clsx(
                    "text-xs px-2 py-1 rounded border font-semibold",
                    previewData.can_import
                      ? 'bg-emerald-950/40 text-emerald-400 border-emerald-800/30'
                      : 'bg-red-950/40 text-red-400 border-red-800/30'
                  )}>
                    {previewData.can_import ? '✓ Ready to import' : '✗ Format validation errors found'}
                  </div>
                </div>

                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  {[
                    { label: 'Valid rows',   value: previewData.total_valid,           color: 'text-emerald-400' },
                    { label: 'Invalid rows', value: previewData.total_invalid,         color: 'text-red-400'     },
                    { label: 'Cases',        value: previewData.cases?.valid_rows ?? 0, color: 'text-indigo-400' },
                    { label: 'Persons',      value: previewData.persons?.valid_rows ?? 0, color: 'text-blue-400' },
                  ].map(({ label, value, color }) => (
                    <div key={label} className="rounded-lg bg-slate-900/60 border border-slate-800/50 p-3 text-center">
                      <p className={`text-xl font-bold font-mono ${color}`}>{value}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{label}</p>
                    </div>
                  ))}
                </div>

                {(previewData.cases?.errors?.length ?? 0) > 0 && (
                  <div className="rounded-lg bg-red-950/15 border border-red-800/30 p-3">
                    <p className="text-xs font-semibold text-red-400 mb-2">Validation Errors</p>
                    <div className="space-y-1 font-mono text-xs">
                      {previewData.cases.errors.slice(0, 5).map((e, i) => (
                        <p key={i} className="text-red-300">Row {e.row}: {e.message}</p>
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
                      ? <><Loader2 className="h-4 w-4 animate-spin" /> Ingesting…</>
                      : <><CheckCircle2 className="h-4 w-4" /> Confirm Ingest</>
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
              <div className="card p-5 space-y-4 border-slate-800">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                  <h3 className="font-semibold text-emerald-300">Ingest Successful</h3>
                </div>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  {[
                    { label: 'Cases created',   value: importResult.cases_created },
                    { label: 'Persons created', value: importResult.persons_created },
                    { label: 'Persons linked',  value: importResult.persons_linked },
                    { label: 'Relationships',   value: importResult.relationships_created },
                  ].map(({ label, value }) => (
                    <div key={label} className="rounded-lg bg-emerald-950/10 border border-emerald-800/20 p-3 text-center">
                      <p className="text-xl font-bold font-mono text-emerald-400">{value}</p>
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
          <div className="space-y-4 animate-fade-in">
            <div className="card p-4 border-slate-800">
              <p className="text-xs font-semibold text-slate-300 mb-2">Natural Language Extraction</p>
              <p className="text-xs text-slate-500 mb-3">
                Paste incident text to parse people, locations, email addresses, and vehicle numbers.
              </p>
              <textarea
                value={nlpText}
                onChange={e => setNlpText(e.target.value)}
                className="input min-h-[140px] resize-y font-mono text-xs bg-slate-950"
                placeholder={`Example:\nRashid Malik was seen contacting Victor Holloway in Mumbai. They met at Hotel Oberoi on 2026-05-12.\nThey drove vehicle MH01AV1234. Contact number +91-9820098200 was active.`}
              />
              <div className="flex gap-2 mt-3">
                <button
                  onClick={handleNlpExtract}
                  disabled={!nlpText.trim() || stage === 'nlp_extracting'}
                  className="btn-primary"
                >
                  {stage === 'nlp_extracting'
                    ? <><Loader2 className="h-4 w-4 animate-spin" /> Parsing Text…</>
                    : <><Sparkles className="h-4 w-4" /> Run Extractor</>
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

            {/* NLP Review Table */}
            {stage === 'nlp_done' && nlpEntities.length > 0 && (
              <div className="space-y-4 animate-slide-up">
                <div className="card p-4 border-slate-800">
                  <div className="flex items-center justify-between mb-4 border-b border-slate-800 pb-3">
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                      Extracted Entities Board ({nlpEntities.length})
                    </h3>
                    <div className="flex gap-1.5 flex-wrap">
                      <button
                        onClick={() => setEntityFilter('')}
                        className={clsx(
                          "text-[10px] px-2.5 py-0.5 rounded-full border font-medium",
                          !entityFilter ? 'bg-indigo-650 text-white border-indigo-650' : 'border-slate-800 text-slate-500'
                        )}
                      >
                        All
                      </button>
                      {uniqueTypes.map(t => (
                        <button
                          key={t}
                          onClick={() => setEntityFilter(t === entityFilter ? '' : t)}
                          className={clsx(
                            "text-[10px] px-2.5 py-0.5 rounded-full border font-medium",
                            entityFilter === t ? 'bg-indigo-650 text-white border-indigo-650' : 'border-slate-800 text-slate-500'
                          )}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left">
                      <thead>
                        <tr className="border-b border-slate-850 bg-slate-950/40">
                          {['Entity Value', 'Type Tag', 'Confidence', 'Context Span', 'Actions'].map(h => (
                            <th key={h} className="py-2.5 px-3 text-slate-500 font-semibold">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-850">
                        {filteredEntities.map((entity, i) => {
                          const isEditing = editingIndex === i
                          return (
                            <tr key={i} className="hover:bg-slate-800/20 transition-colors">
                              {/* Value cell */}
                              <td className="py-2.5 px-3">
                                {isEditing ? (
                                  <input
                                    type="text"
                                    className="input py-0.5 px-1.5 text-xs w-44 bg-slate-950"
                                    value={editText}
                                    onChange={e => setEditText(e.target.value)}
                                  />
                                ) : (
                                  <span className="font-semibold text-slate-200">{entity.text}</span>
                                )}
                              </td>
                              {/* Type cell */}
                              <td className="py-2.5 px-3">
                                {isEditing ? (
                                  <select
                                    className="input py-0.5 px-1.5 text-xs bg-slate-950"
                                    value={editType}
                                    onChange={e => setEditType(e.target.value)}
                                  >
                                    {ENTITY_TYPES.map(type => (
                                      <option key={type} value={type}>{type}</option>
                                    ))}
                                  </select>
                                ) : (
                                  <span className={clsx("px-2 py-0.5 rounded border text-[10px] font-semibold uppercase", ENTITY_TYPE_COLORS[entity.type] || 'bg-slate-800 text-slate-400 border-slate-700')}>
                                    {entity.type}
                                  </span>
                                )}
                              </td>
                              {/* Confidence */}
                              <td className="py-2.5 px-3">
                                <span className="font-mono text-slate-400 font-medium">{Math.round(entity.confidence * 100)}%</span>
                              </td>
                              {/* Context */}
                              <td className="py-2.5 px-3 text-slate-500 max-w-[200px] truncate" title={entity.source_text}>
                                {entity.source_text}
                              </td>
                              {/* Actions */}
                              <td className="py-2.5 px-3">
                                <div className="flex items-center gap-1.5">
                                  {isEditing ? (
                                    <>
                                      <button onClick={() => handleSaveEdit(i)} className="p-1 rounded bg-indigo-950 border border-indigo-700/30 text-indigo-400 hover:bg-indigo-900/30" title="Save changes">
                                        <Save className="h-3.5 w-3.5" />
                                      </button>
                                      <button onClick={() => setEditingIndex(null)} className="p-1 rounded bg-slate-850 text-slate-500 hover:text-slate-300" title="Cancel edit">
                                        <X className="h-3.5 w-3.5" />
                                      </button>
                                    </>
                                  ) : (
                                    <>
                                      <button
                                        onClick={() => handleAcceptEntity(i)}
                                        disabled={entity.status === 'APPROVED'}
                                        className={clsx(
                                          "p-1 rounded hover:bg-emerald-950/40 transition-colors",
                                          entity.status === 'APPROVED' ? 'text-emerald-400 bg-emerald-950/30 border border-emerald-800/20' : 'text-slate-500 hover:text-emerald-400'
                                        )}
                                        title="Accept entity"
                                      >
                                        <Check className="h-3.5 w-3.5" />
                                      </button>
                                      <button onClick={() => handleStartEdit(i, entity)} className="p-1 rounded text-slate-500 hover:text-indigo-400 hover:bg-indigo-950/20 transition-colors" title="Edit extraction">
                                        <Edit2 className="h-3.5 w-3.5" />
                                      </button>
                                      <button onClick={() => handleRejectEntity(i)} className="p-1 rounded text-slate-500 hover:text-rose-400 hover:bg-rose-950/20 transition-colors" title="Dismiss entity">
                                        <Trash2 className="h-3.5 w-3.5" />
                                      </button>
                                    </>
                                  )}
                                </div>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Duplicates resolving within text */}
                {nlpDuplicates.length > 0 && (
                  <div className="card p-4 border-slate-800">
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                      <AlertTriangle className="h-4 w-4 text-amber-500" /> Duplicates Detected inside parsed text
                    </h3>
                    <div className="space-y-2">
                      {nlpDuplicates.map((dup, i) => (
                        <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-amber-900/5 border border-amber-800/20">
                          <span className="font-semibold text-slate-200 text-xs">{dup.entity_a} ↔ {dup.entity_b}</span>
                          <span className="text-[10px] font-bold text-amber-400 font-mono">Similarity: {Math.round(dup.similarity * 100)}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── RESOLUTION TAB ── */}
        {activeTab === 'resolution' && (
          <div className="space-y-4 animate-fade-in">
            <div className="card p-5 border-slate-800">
              <h3 className="text-sm font-bold text-slate-200 mb-2 flex items-center gap-2">
                <Users className="h-4 w-4 text-indigo-400" /> Database Profile Deduplicator
              </h3>
              <p className="text-xs text-slate-500 mb-4">
                Merge duplicate persons/suspects profiles in the database. When merging, all related cases, phone logs, relationships, and timeline events will point to the Target profile, and the duplicate Source profile will be deleted.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Source Selection */}
                <div className="space-y-3">
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">
                    Source Profile (To be Merged & Deleted)
                  </label>
                  <select
                    className="input w-full bg-slate-950 border-slate-800 text-xs"
                    value={mergeSourceId}
                    onChange={e => setMergeSourceId(e.target.value)}
                  >
                    <option value="">Select profile to delete...</option>
                    {dbPersons.map(p => (
                      <option key={p.id} value={p.id}>{p.full_name} {p.alias ? `(aka ${p.alias})` : ''}</option>
                    ))}
                  </select>

                  {sourcePerson && (
                    <div className="rounded-lg bg-slate-900/60 border border-slate-850 p-4 space-y-2 text-xs animate-slide-up">
                      <p className="font-bold text-indigo-400">File details:</p>
                      <p><span className="text-slate-500">Aliases:</span> <span className="text-slate-300">{sourcePerson.alias || 'None'}</span></p>
                      <p><span className="text-slate-500">Occupation:</span> <span className="text-slate-300">{sourcePerson.occupation || 'N/A'}</span></p>
                      <p><span className="text-slate-500">Nationality:</span> <span className="text-slate-300">{sourcePerson.nationality || 'N/A'}</span></p>
                      <p><span className="text-slate-500">Phone:</span> <span className="text-slate-300 font-mono">{sourcePerson.phone || 'N/A'}</span></p>
                    </div>
                  )}
                </div>

                {/* Target Selection */}
                <div className="space-y-3">
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">
                    Target Profile (To Keep / Preserve)
                  </label>
                  <select
                    className="input w-full bg-slate-950 border-slate-800 text-xs"
                    value={mergeTargetId}
                    onChange={e => setMergeTargetId(e.target.value)}
                  >
                    <option value="">Select profile to keep...</option>
                    {dbPersons.filter(p => p.id !== mergeSourceId).map(p => (
                      <option key={p.id} value={p.id}>{p.full_name} {p.alias ? `(aka ${p.alias})` : ''}</option>
                    ))}
                  </select>

                  {targetPerson && (
                    <div className="rounded-lg bg-slate-900/60 border border-slate-850 p-4 space-y-2 text-xs animate-slide-up">
                      <p className="font-bold text-indigo-400">File details:</p>
                      <p><span className="text-slate-500">Aliases:</span> <span className="text-slate-300">{targetPerson.alias || 'None'}</span></p>
                      <p><span className="text-slate-500">Occupation:</span> <span className="text-slate-300">{targetPerson.occupation || 'N/A'}</span></p>
                      <p><span className="text-slate-500">Nationality:</span> <span className="text-slate-300">{targetPerson.nationality || 'N/A'}</span></p>
                      <p><span className="text-slate-500">Phone:</span> <span className="text-slate-300 font-mono">{targetPerson.phone || 'N/A'}</span></p>
                    </div>
                  )}
                </div>
              </div>

              {mergeSourceId && mergeTargetId && (
                <div className="mt-6 border-t border-slate-800/80 pt-4 flex justify-end">
                  <button
                    onClick={handleMergeProfiles}
                    disabled={merging}
                    className="btn-primary bg-indigo-600 hover:bg-indigo-500 text-xs py-2 px-4 flex items-center gap-1.5"
                  >
                    {merging ? (
                      <><Loader2 className="h-4 w-4 animate-spin" /> Executing Merge…</>
                    ) : (
                      <><Check className="h-4 w-4" /> Confirm Merge Profiles</>
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
