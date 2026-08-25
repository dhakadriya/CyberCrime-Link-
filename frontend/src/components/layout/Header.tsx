import { useState, useEffect, useRef } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import {
  Search, Bell, HelpCircle, ShieldAlert, User, LogOut,
  ChevronRight, Laptop, Activity, Key, BookOpen, Clock,
  Sun, Moon
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useTheme } from '../../context/ThemeContext'
import { apiClient } from '../../api/client'
import clsx from 'clsx'

export function Header() {
  const { user, logout, hasPermission } = useAuth()
  const { theme, setTheme } = useTheme()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchVal, setSearchVal] = useState('')
  const [showNotifications, setShowNotifications] = useState(false)
  const [showProfileMenu, setShowProfileMenu] = useState(false)
  const [showHelpDrawer, setShowHelpDrawer] = useState(false)
  const [alerts, setAlerts] = useState<any[]>([])

  const notificationsRef = useRef<HTMLDivElement>(null)
  const profileRef = useRef<HTMLDivElement>(null)

  // Fetch security events for notifications if user has permission
  useEffect(() => {
    if (user && hasPermission('SECURITY_READ')) {
      apiClient.get('/security/events?size=5')
        .then(res => {
          setAlerts(res.data.items || [])
        })
        .catch(() => {
          // Fallback if error
          setAlerts([
            { id: '1', event_type: 'SYSTEM_ONLINE', severity: 'INFO', description: 'CrimeLink Platform is running normally.', created_at: new Date().toISOString() }
          ])
        })
    } else {
      setAlerts([
        { id: '1', event_type: 'SYSTEM_ONLINE', severity: 'INFO', description: 'CrimeLink Platform is running normally.', created_at: new Date().toISOString() }
      ])
    }
  }, [user, location])

  // Close menus when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (notificationsRef.current && !notificationsRef.current.contains(event.target as Node)) {
        setShowNotifications(false)
      }
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setShowProfileMenu(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Handle Search submit
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (searchVal.trim()) {
      navigate(`/query?q=${encodeURIComponent(searchVal)}`)
      setSearchVal('')
    }
  }

  // Generate breadcrumbs from path
  const pathSegments = location.pathname.split('/').filter(Boolean)
  const getBreadcrumbs = () => {
    return (
      <div className="flex items-center gap-1 text-xs text-slate-300 font-semibold">
        <Link to="/dashboard" className="hover:text-slate-100 transition-colors">CrimeLink</Link>
        {pathSegments.map((segment, index) => {
          const path = `/${pathSegments.slice(0, index + 1).join('/')}`
          const label = segment.replace(/-/g, ' ').toUpperCase()
          const isLast = index === pathSegments.length - 1
          return (
            <div key={path} className="flex items-center gap-1">
              <ChevronRight className="h-3 w-3 text-slate-400" />
              {isLast ? (
                <span className="text-indigo-600 font-bold truncate max-w-[120px]">{label}</span>
              ) : (
                <Link to={path} className="hover:text-slate-100 transition-colors">{label}</Link>
              )}
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <header className="h-[53px] border-b border-[#E2E8F0] bg-white px-6 py-2 flex items-center justify-between sticky top-0 z-20 shadow-sm">
      {/* Breadcrumbs */}
      <div className="flex items-center gap-4 flex-1 min-w-0">
        {getBreadcrumbs()}
      </div>

      {/* Center/Right Section */}
      <div className="flex items-center gap-4 shrink-0">
        {/* Global Search */}
        <form onSubmit={handleSearch} className="relative hidden md:block">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
          <input
            type="text"
            className="w-64 rounded-lg border border-[#CBD5E1] bg-[#F8FAFC] px-9 py-1 text-xs text-[#344054] placeholder-[#667085] focus:border-[#4F46E5] focus:outline-none focus:ring-1 focus:ring-[#4F46E5]/30 transition-all h-8"
            placeholder="Search cases, suspects, files..."
            value={searchVal}
            onChange={e => setSearchVal(e.target.value)}
          />
        </form>

        {/* Security Alerts Bell */}
        <div className="relative" ref={notificationsRef}>
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="rounded-lg p-2 text-slate-300 hover:bg-slate-800 hover:text-slate-100 transition-colors relative"
            title="System Alerts"
          >
            <Bell className="h-4 w-4" />
            {alerts.length > 0 && alerts[0].event_type !== 'SYSTEM_ONLINE' && (
              <span className="absolute top-1 right-1 h-1.5 w-1.5 rounded-full bg-rose-500 animate-pulse" />
            )}
          </button>

          {showNotifications && (
            <div className="absolute right-0 mt-2 w-80 card p-0 bg-white border-slate-700 shadow-2xl z-30 animate-slide-up">
              <div className="border-b border-slate-700 px-4 py-3 flex items-center justify-between">
                <span className="text-xs font-bold text-slate-100">TACTICAL SOC ALERTS</span>
                <span className="text-[10px] bg-indigo-50 text-indigo-600 border border-indigo-100 px-1.5 rounded font-semibold">
                  {alerts.length} active
                </span>
              </div>
              <div className="max-h-64 overflow-y-auto divide-y divide-slate-700">
                {alerts.map(alert => (
                  <div key={alert.id} className="p-3 hover:bg-slate-850 transition-colors">
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className={clsx(
                        "text-[9px] px-1.5 py-0.5 rounded font-mono font-semibold border",
                        alert.severity === 'CRITICAL' ? 'bg-red-50 text-red-700 border-red-200' :
                        alert.severity === 'HIGH' ? 'bg-orange-50 text-orange-700 border-orange-200' :
                        alert.severity === 'MEDIUM' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                        'bg-slate-800 text-slate-200'
                      )}>
                        {alert.severity}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono truncate">{alert.event_type}</span>
                    </div>
                    <p className="text-xs text-slate-200 leading-snug">{alert.description}</p>
                    <span className="text-[9px] text-slate-400 mt-1 block">
                      {new Date(alert.created_at).toLocaleTimeString()}
                    </span>
                  </div>
                ))}
              </div>
              {hasPermission('SECURITY_READ') && (
                <div className="border-t border-slate-700 p-2 text-center">
                  <Link
                    to="/security"
                    onClick={() => setShowNotifications(false)}
                    className="text-[10px] text-indigo-600 hover:text-indigo-750 font-semibold block py-1"
                  >
                    View Security Dashboard →
                  </Link>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Quick Theme Toggle */}
        <button
          onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
          className="rounded-lg p-2 text-slate-300 hover:bg-slate-800 hover:text-slate-100 transition-colors"
          title={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`}
        >
          {theme === 'light' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
        </button>

        {/* System Help Trigger */}
        <button
          onClick={() => setShowHelpDrawer(true)}
          className="rounded-lg p-2 text-slate-300 hover:bg-slate-800 hover:text-slate-100 transition-colors"
          title="System Guide"
        >
          <HelpCircle className="h-4 w-4" />
        </button>

        {/* User Account Menu */}
        <div className="relative font-sans" ref={profileRef}>
          <button
            onClick={() => setShowProfileMenu(!showProfileMenu)}
            className="flex items-center gap-2 rounded-lg p-1 hover:bg-slate-800 transition-colors"
          >
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-50 border border-indigo-100 text-xs font-bold text-indigo-600">
              {user?.full_name?.charAt(0) ?? '?'}
            </div>
          </button>

          {showProfileMenu && (
            <div className="absolute right-0 mt-2 w-48 card p-1 bg-white border-slate-700 shadow-2xl z-30 animate-slide-up">
              <div className="px-3 py-2 border-b border-slate-700 mb-1">
                <p className="text-xs font-bold text-slate-100 truncate">{user?.full_name}</p>
                <p className="text-[10px] text-slate-400 truncate">{user?.username}</p>
              </div>
              <div className="px-3 py-1 border-b border-slate-700 my-1 text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                Theme
              </div>
              <div className="flex gap-1 p-1">
                {(['light', 'dark', 'system'] as const).map(t => (
                  <button
                    key={t}
                    onClick={() => setTheme(t)}
                    className={clsx(
                      "flex-1 py-1 px-1 text-[9px] capitalize rounded transition-colors font-semibold text-center",
                      theme === t
                        ? "bg-indigo-600 text-white"
                        : "text-slate-300 hover:bg-slate-800 hover:text-slate-100"
                    )}
                  >
                    {t}
                  </button>
                ))}
              </div>
              <div className="h-px bg-slate-700 my-1" />
              <div className="text-xs space-y-0.5">
                <button
                  onClick={() => { navigate('/settings'); setShowProfileMenu(false) }}
                  className="w-full text-left px-3 py-1.5 rounded hover:bg-slate-800 text-slate-200 hover:text-slate-100 transition-colors flex items-center gap-2"
                >
                  <Laptop className="h-3.5 w-3.5" /> Platform Settings
                </button>
                <button
                  onClick={() => { navigate('/security'); setShowProfileMenu(false) }}
                  className="w-full text-left px-3 py-1.5 rounded hover:bg-slate-800 text-slate-200 hover:text-slate-100 transition-colors flex items-center gap-2"
                >
                  <Activity className="h-3.5 w-3.5" /> Security Status
                </button>
                <button
                  onClick={() => { logout(); setShowProfileMenu(false) }}
                  className="w-full text-left px-3 py-1.5 rounded text-rose-600 hover:bg-rose-50 hover:text-rose-700 transition-colors flex items-center gap-2 font-semibold"
                >
                  <LogOut className="h-3.5 w-3.5" /> Sign Out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Help / System Guide Drawer */}
      {showHelpDrawer && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex justify-end">
          <div className="w-80 h-full bg-slate-900 border-l border-slate-800 p-6 overflow-y-auto relative animate-slide-up flex flex-col justify-between">
            <button
              onClick={() => setShowHelpDrawer(false)}
              className="absolute top-4 right-4 text-slate-500 hover:text-slate-300 text-sm"
            >
              ✕
            </button>
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2 uppercase tracking-wider">
                  <BookOpen className="h-4 w-4 text-indigo-400" /> Platform Guide
                </h3>
                <p className="text-xs text-slate-500 mt-1">Investigative decision-support system</p>
              </div>

              <div className="space-y-3">
                <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Security Clearances</h4>
                <div className="space-y-1.5 text-xs text-slate-500">
                  <p className="flex justify-between"><span>SUPER ADMIN:</span> <span className="text-slate-300">Full Clearance</span></p>
                  <p className="flex justify-between"><span>SUPERVISOR:</span> <span className="text-slate-300">Management & Audit</span></p>
                  <p className="flex justify-between"><span>INVESTIGATOR:</span> <span className="text-slate-300">Case Execution</span></p>
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Keyboard Shortcuts</h4>
                <div className="space-y-1.5 text-xs font-mono text-slate-500">
                  <p className="flex justify-between"><span>Alt + Q:</span> <span className="text-indigo-400">Query Engine</span></p>
                  <p className="flex justify-between"><span>Alt + G:</span> <span className="text-indigo-400">Network Graph</span></p>
                  <p className="flex justify-between"><span>Alt + L:</span> <span className="text-indigo-400">Leads Board</span></p>
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Audit logs policy</h4>
                <p className="text-xs text-slate-600 leading-relaxed italic">
                  All queries, views, and downloads are logged permanently. Under internal affairs auditing guidelines, deletions are strictly prohibited.
                </p>
              </div>
            </div>

            <div className="border-t border-slate-800 pt-4 text-center">
              <span className="text-[10px] text-slate-600 uppercase tracking-widest font-bold">CrimeLink Intel v1.1.0</span>
            </div>
          </div>
        </div>
      )}
    </header>
  )
}
