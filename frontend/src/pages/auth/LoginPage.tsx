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
      <div className="w-full max-w-md relative z-10">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-indigo-600 mb-4 border border-indigo-500/30">
            <Shield className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-slate-100 tracking-tight">CrimeLink</h1>
          <p className="text-slate-300 mt-2 text-sm flex items-center justify-center gap-1.5 font-semibold">
            <Network className="h-3.5 w-3.5 text-indigo-600" />
            Criminal Network Intelligence Platform
          </p>
        </div>

        {/* Demo notice */}
        <div className="mb-5 rounded-lg border border-[#FCD34D] bg-[#FEF3C7] px-4 py-3 text-center">
          <p className="text-xs font-bold text-[#92400E]">⚠ DEMO ENVIRONMENT — SYNTHETIC DATA ONLY</p>
          <p className="text-xs text-[#B45309] mt-0.5 font-medium">No real investigation data is present</p>
        </div>

        {/* Form card */}
        <div className="rounded-2xl border border-slate-700 bg-slate-900 p-8 shadow-md">
          <h2 className="text-sm font-bold text-slate-150 mb-6 uppercase tracking-wider">Sign in to your account</h2>

          {error && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 font-medium">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">Username</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
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
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
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
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-450 hover:text-slate-100 transition-colors"
                  onClick={() => setShowPassword(v => !v)}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <button type="submit" className="btn-primary w-full mt-2 h-[44px]" disabled={loading}>
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 rounded-full border-2 border-white/20 border-t-white animate-spin" />
                  Signing in…
                </span>
              ) : 'Sign In'}
            </button>
          </form>

          {/* Demo credentials hint */}
          <div className="mt-6 rounded-lg bg-[#F8FAFC] border border-[#CBD5E1] p-4">
            <p className="text-xs font-bold text-slate-300 mb-2">Demo accounts (use SEED_DEFAULT_PASSWORD):</p>
            <div className="space-y-1.5 text-xs font-mono">
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
                    className="text-indigo-650 hover:text-indigo-800 transition-colors font-bold"
                  >
                    {user}
                  </button>
                  <span className="text-slate-300 font-semibold">{role}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
