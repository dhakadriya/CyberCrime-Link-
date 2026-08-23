import { useState } from 'react'
import { Settings, Shield, Database, Server, Info, CheckCircle2 } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'

export function SettingsPage() {
  const { user } = useAuth()
  const [saved, setSaved] = useState(false)

  const handleSave = () => {
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <h1 className="text-lg font-bold text-slate-100 flex items-center gap-2">
          <Settings className="h-5 w-5 text-slate-400" /> Settings
        </h1>
        <p className="text-xs text-slate-500 mt-0.5">Platform configuration and preferences</p>
      </div>

      <div className="page-content space-y-5 max-w-3xl">
        {/* Demo environment notice */}
        <div className="rounded-lg border border-amber-800/30 bg-amber-900/10 px-4 py-3">
          <p className="text-xs font-semibold text-amber-400">DEMO ENVIRONMENT</p>
          <p className="text-xs text-amber-500/70 mt-0.5">
            This is a demonstration instance with synthetic data only. Configuration changes below
            are informational in this demo context.
          </p>
        </div>

        {/* User profile */}
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-slate-300 mb-4 flex items-center gap-2">
            <Shield className="h-4 w-4 text-indigo-400" /> Your Profile
          </h2>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Full Name</label>
                <input className="input" defaultValue={user?.full_name || ''} readOnly />
              </div>
              <div>
                <label className="label">Username</label>
                <input className="input" defaultValue={user?.username || ''} readOnly />
              </div>
            </div>
            <div>
              <label className="label">Roles</label>
              <div className="flex flex-wrap gap-2">
                {(user?.roles || []).map(role => (
                  <span key={role} className="px-2.5 py-1 rounded-lg bg-indigo-900/30 border border-indigo-700/30 text-indigo-300 text-xs font-medium">
                    {role.replace(/_/g, ' ')}
                  </span>
                ))}
              </div>
            </div>
            <div>
              <label className="label">Permissions ({user?.permissions?.length || 0})</label>
              <div className="flex flex-wrap gap-1.5">
                {(user?.permissions || []).map(perm => (
                  <span key={perm} className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-400 text-[10px] font-mono">
                    {perm}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Platform info */}
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-slate-300 mb-4 flex items-center gap-2">
            <Server className="h-4 w-4 text-emerald-400" /> Platform Information
          </h2>
          <div className="space-y-2 text-sm">
            {[
              { label: 'Platform', value: 'CrimeLink Intelligence v1.0.0' },
              { label: 'Environment', value: 'DEMO — Synthetic Data' },
              { label: 'Backend', value: 'FastAPI + SQLAlchemy + NetworkX' },
              { label: 'Database', value: 'PostgreSQL / SQLite (dev)' },
              { label: 'NLP Engine', value: 'spaCy en_core_web_sm + Regex' },
              { label: 'Graph Analysis', value: 'NetworkX (Greedy Modularity, Betweenness)' },
              { label: 'Auth', value: 'JWT + Argon2id (OWASP recommended)' },
              { label: 'Evidence Hashing', value: 'SHA-256' },
            ].map(({ label, value }) => (
              <div key={label} className="flex items-center justify-between py-1 border-b border-slate-800/50">
                <span className="text-slate-500">{label}</span>
                <span className="text-slate-300 font-mono text-xs">{value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Ethical design notice */}
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-slate-300 mb-4 flex items-center gap-2">
            <Info className="h-4 w-4 text-blue-400" /> Ethical Design Principles
          </h2>
          <div className="space-y-3 text-xs text-slate-400">
            {[
              'This system is a decision-support tool for authorized investigators — it does not determine guilt.',
              'No protected characteristics (race, religion, caste, gender) are used in any scoring algorithm.',
              'All algorithmic results display confidence levels, data sources, and explicit limitations.',
              'Every AI/analytical result is explainable and traceable to source data.',
              'Investigation Priority Scores are analytical aids — final decisions require human judgment.',
              'All audit actions are logged immutably. No deletion of audit records is permitted.',
            ].map((principle, i) => (
              <div key={i} className="flex items-start gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0 mt-0.5" />
                <p>{principle}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Database status */}
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-slate-300 mb-4 flex items-center gap-2">
            <Database className="h-4 w-4 text-violet-400" /> System Status
          </h2>
          <div className="space-y-2">
            {[
              { label: 'Database', status: 'Connected', ok: true },
              { label: 'Authentication', status: 'Active', ok: true },
              { label: 'Evidence Storage', status: 'Available', ok: true },
              { label: 'NLP Service', status: 'Active (spaCy)', ok: true },
              { label: 'Network Analysis', status: 'Active (NetworkX)', ok: true },
            ].map(({ label, status, ok }) => (
              <div key={label} className="flex items-center justify-between py-1.5 px-3 rounded-lg bg-slate-800/50">
                <span className="text-sm text-slate-400">{label}</span>
                <div className="flex items-center gap-1.5">
                  <div className={`h-2 w-2 rounded-full ${ok ? 'bg-emerald-500' : 'bg-red-500'}`} />
                  <span className={`text-xs ${ok ? 'text-emerald-400' : 'text-red-400'}`}>{status}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* API docs link */}
        <div className="card p-4 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-slate-300">API Documentation</p>
            <p className="text-xs text-slate-500 mt-0.5">Interactive Swagger UI for all backend endpoints</p>
          </div>
          <a
            href={`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'}/api/docs`}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-secondary text-xs py-1.5"
          >
            Open API Docs →
          </a>
        </div>
      </div>
    </div>
  )
}
