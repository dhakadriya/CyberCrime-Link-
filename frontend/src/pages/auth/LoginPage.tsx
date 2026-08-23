import { useState, FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Shield, Eye, EyeOff, Lock, User, Network } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { authApi } from '../../api/auth'
import { getErrorMessage } from '../../api/client'

export function LoginPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const { login } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const tokenData = await authApi.login(username.trim(), password)
      login(tokenData)
      navigate('/dashboard', { replace: true })
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background grid */}
      <div className="absolute inset-0 opacity-[0.03]"
        style={{ backgroundImage: 'linear-gradient(#6366f1 1px, transparent 1px), linear-gradient(90deg, #6366f1 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
      {/* Radial glow */}
      <div className="absolute inset-0 bg-radial-gradient" style={{
        background: 'radial-gradient(ellipse at 50% 40%, rgba(99,102,241,0.08) 0%, transparent 70%)'
      }} />

      <div className="w-full max-w-md relative z-10">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-indigo-600 shadow-2xl shadow-indigo-900/50 mb-4 border border-indigo-500/30">
            <Shield className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight">CrimeLink</h1>
          <p className="text-slate-500 mt-1 text-sm flex items-center justify-center gap-1.5">
            <Network className="h-3.5 w-3.5" />
            AI-Powered Criminal Network Intelligence
          </p>
        </div>

        {/* Demo notice */}
        <div className="mb-5 rounded-lg border border-amber-700/30 bg-amber-900/10 px-4 py-3 text-center">
          <p className="text-xs font-semibold text-amber-400">⚠ DEMO ENVIRONMENT — SYNTHETIC DATA ONLY</p>
          <p className="text-xs text-amber-600/70 mt-0.5">No real investigation data is present</p>
        </div>

        {/* Form card */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 backdrop-blur-sm p-8 shadow-2xl">
          <h2 className="text-base font-semibold text-slate-200 mb-6">Sign in to your account</h2>

          {error && (
            <div className="mb-4 rounded-lg border border-red-800/50 bg-red-900/20 px-4 py-3 text-sm text-red-300">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">Username</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                <input
                  type="text"
                  className="input pl-9"
                  placeholder="Enter username"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  autoComplete="username"
                  required
                  disabled={loading}
                />
              </div>
            </div>

            <div>
              <label className="label">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  className="input pl-9 pr-10"
                  placeholder="Enter password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                  disabled={loading}
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                  onClick={() => setShowPassword(v => !v)}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <button type="submit" className="btn-primary w-full mt-2 py-2.5" disabled={loading}>
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 rounded-full border-2 border-white/20 border-t-white animate-spin" />
                  Signing in…
                </span>
              ) : 'Sign In'}
            </button>
          </form>

          {/* Demo credentials hint */}
          <div className="mt-6 rounded-lg bg-slate-800/50 border border-slate-700/50 p-4">
            <p className="text-xs font-medium text-slate-500 mb-2">Demo accounts (use SEED_DEFAULT_PASSWORD):</p>
            <div className="space-y-1 text-xs font-mono">
              {[
                { user: 'superadmin', role: 'SUPER_ADMIN' },
                { user: 'supervisor', role: 'CASE_SUPERVISOR' },
                { user: 'officer', role: 'INVESTIGATION_OFFICER' },
                { user: 'evidence_officer', role: 'EVIDENCE_OFFICER' },
                { user: 'auditor', role: 'VIEWER_AUDITOR' },
              ].map(({ user, role }) => (
                <div key={user} className="flex justify-between items-center">
                  <button
                    type="button"
                    onClick={() => setUsername(user)}
                    className="text-indigo-400 hover:text-indigo-300 transition-colors"
                  >
                    {user}
                  </button>
                  <span className="text-slate-600">{role}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
