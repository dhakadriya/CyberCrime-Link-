import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import clsx from 'clsx'
import {
  FolderOpen, Users, FileText, ShieldAlert,
  TrendingUp, AlertTriangle, CheckCircle2, Clock,
  Network, GitBranch, Lightbulb, Activity,
} from 'lucide-react'
import {
  BarChart, Bar, PieChart, Pie, Cell, LineChart, Line,
  XAxis, YAxis, Tooltip, ResponsiveContainer,
} from 'recharts'
import { dashboardApi } from '../../api/dashboard'
import { PageLoader } from '../../components/shared/LoadingSpinner'
import type { DashboardStats, ChartData } from '../../types'

const PRIORITY_COLORS = ['#16A34A', '#D97706', '#EA580C', '#DC2626']
const STATUS_COLORS: Record<string, string> = {
  'Open': '#4F46E5', 'Under Investigation': '#D97706',
  'On Hold': '#475467', 'Solved': '#16A34A',
  'Closed': '#1E293B', 'Archived': '#64748B',
}

const CHART_TOOLTIP_STYLE = {
  backgroundColor: '#FFFFFF',
  border: '1px solid #D9E0EA',
  borderRadius: '8px',
  color: '#172033',
  fontSize: '12px',
  boxShadow: '0 4px 12px rgba(16,24,40,0.06)',
}

function AnimatedCounter({ value, duration = 800 }: { value: number; duration?: number }) {
  const [count, setCount] = useState(0)

  useEffect(() => {
    let start = 0
    const end = value
    if (start === end) {
      setCount(end)
      return
    }

    const totalMilliseconds = duration
    const incrementTime = 16 // ~60fps
    const totalSteps = totalMilliseconds / incrementTime
    const increment = (end - start) / totalSteps

    let current = start
    const timer = setInterval(() => {
      current += increment
      if (current >= end) {
        clearInterval(timer)
        setCount(end)
      } else {
        setCount(Math.floor(current))
      }
    }, incrementTime)

    return () => clearInterval(timer)
  }, [value, duration])

  return <>{count}</>
}

function StatCard({ icon, label, value, sub, color, onClick }: {
  icon: React.ReactNode; label: string; value: number | string;
  sub?: string; color?: string; onClick?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className={clsx(
        "bg-white border border-[#D9E0EA] rounded-xl p-4 flex items-start gap-3 shadow-sm transition-all duration-200 select-none hover:border-[#C5CEDB] hover:shadow-md",
        onClick ? "cursor-pointer" : ""
      )}
    >
      <div className={`rounded-lg p-2.5 ${color ?? 'bg-indigo-50 text-[#4F46E5]'} shrink-0`}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-2xl font-bold font-mono text-[#172033] tracking-tight leading-none">
          {typeof value === 'number' ? <AnimatedCounter value={value} /> : value}
        </p>
        <p className="text-[10px] font-bold text-[#475467] uppercase tracking-wider mt-1.5">{label}</p>
        {sub && <p className="text-[11px] text-[#667085] mt-1.5 leading-normal truncate">{sub}</p>}
      </div>
    </div>
  )
}


export function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [charts, setCharts] = useState<ChartData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([dashboardApi.getStats(), dashboardApi.getCharts()])
      .then(([s, c]) => { setStats(s); setCharts(c) })
      .finally(() => setLoading(false))
  }, [])

  const navigate = useNavigate()

  if (loading) return <PageLoader />

  return (

        <div className="animate-fade-in">
          {/* Header */}
          <div className="page-header flex items-center justify-between border-b border-slate-700 bg-slate-900 px-6 py-4">
            <div>
              <h1 className="text-xl font-bold text-slate-100">Investigation Dashboard</h1>
              <p className="text-xs text-slate-400 mt-0.5">Real-time overview of all investigation activities</p>
            </div>
            <span className="rounded-full bg-[#FEF3C7] border border-[#FCD34D] px-3 py-1 text-xs font-bold text-[#92400E]">
              DEMO — TACTICAL SOC ENVIRONMENT
            </span>
          </div>

          <div className="page-content space-y-5">
            {/* Primary stat cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <StatCard
                icon={<FolderOpen className="h-5 w-5" />}
                label="Total Cases"
                value={stats?.cases.total ?? 0}
                sub={`${stats?.cases.open ?? 0} open · ${stats?.cases.under_investigation ?? 0} active`}
                color="bg-indigo-50 text-[#4F46E5]"
                onClick={() => navigate('/cases')}
              />
              <StatCard
                icon={<Users className="h-5 w-5" />}
                label="Persons"
                value={stats?.persons.total ?? 0}
                sub={`${stats?.persons.suspects ?? 0} suspects · ${stats?.persons.victims ?? 0} victims`}
                color="bg-blue-50 text-[#2563EB]"
                onClick={() => navigate('/persons')}
              />
              <StatCard
                icon={<FileText className="h-5 w-5" />}
                label="Evidence Items"
                value={stats?.evidence.total ?? 0}
                sub={`${stats?.evidence.active ?? 0} active`}
                color="bg-teal-50 text-[#0D9488]"
                onClick={() => navigate('/evidence')}
              />
              <StatCard
                icon={<ShieldAlert className="h-5 w-5" />}
                label="Security Events"
                value={stats?.recent_security_events ?? 0}
                sub="Last 24 hours"
                color="bg-red-50 text-[#DC2626]"
                onClick={() => navigate('/security')}
              />
            </div>

            {/* Secondary stat cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <StatCard
                icon={<AlertTriangle className="h-4 w-4" />}
                label="Critical Priority"
                value={stats?.cases.critical_priority ?? 0}
                color="bg-red-50 text-[#DC2626]"
                onClick={() => navigate('/cases?priority=CRITICAL')}
              />
              <StatCard
                icon={<TrendingUp className="h-4 w-4" />}
                label="High Priority"
                value={stats?.cases.high_priority ?? 0}
                color="bg-orange-50 text-[#D97706]"
                onClick={() => navigate('/cases?priority=HIGH')}
              />
              <StatCard
                icon={<CheckCircle2 className="h-4 w-4" />}
                label="Cases Solved"
                value={stats?.cases.solved ?? 0}
                color="bg-emerald-50 text-[#16A34A]"
                onClick={() => navigate('/cases?status=SOLVED')}
              />
              <StatCard
                icon={<Clock className="h-4 w-4" />}
                label="On Hold"
                value={stats?.cases.on_hold ?? 0}
                color="bg-slate-50 text-[#475467]"
                onClick={() => navigate('/cases?status=ON_HOLD')}
              />
            </div>

        {/* Charts row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Cases by Status - Pie */}
          <div className="card p-5">
            <h3 className="text-sm font-bold text-slate-100 mb-4 flex items-center gap-2">
              <FolderOpen className="h-4 w-4 text-[#4F46E5]" /> Cases by Status
            </h3>
            {charts && charts.cases_by_status.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={charts.cases_by_status} dataKey="value" nameKey="name"
                    cx="50%" cy="50%" outerRadius={72} innerRadius={30}
                    label={({ name, value }) => `${name}: ${value}`}
                    labelLine={false}
                    style={{ fontSize: 10, fill: '#172033', fontWeight: 600 }}
                  >
                    {charts.cases_by_status.map((entry, i) => (
                      <Cell key={i} fill={STATUS_COLORS[entry.name] ?? entry.color ?? '#4F46E5'} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[200px] flex items-center justify-center text-sm text-[#667085]">No data yet</div>
            )}
          </div>

          {/* Cases by Priority - Bar */}
          <div className="card p-5">
            <h3 className="text-sm font-bold text-slate-100 mb-4 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-[#D97706]" /> Cases by Priority
            </h3>
            {charts && charts.cases_by_priority.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={charts.cases_by_priority} barSize={36}>
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#475467' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#475467' }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
                  <Bar dataKey="value" name="Cases" radius={[4, 4, 0, 0]}>
                    {charts.cases_by_priority.map((entry, i) => (
                      <Cell key={i} fill={PRIORITY_COLORS[i % PRIORITY_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[200px] flex items-center justify-center text-sm text-[#667085]">No data yet</div>
            )}
          </div>

          {/* Activity last 7 days */}
          <div className="card p-5 lg:col-span-2">
            <h3 className="text-sm font-bold text-slate-100 mb-4 flex items-center gap-2">
              <Activity className="h-4 w-4 text-[#16A34A]" /> Investigation Activity — Last 7 Days
            </h3>
            {charts && charts.activity_last_7_days.length > 0 ? (
              <ResponsiveContainer width="100%" height={150}>
                <LineChart data={charts.activity_last_7_days}>
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#475467' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#475467' }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
                  <Line type="monotone" dataKey="events" name="Events" stroke="#4F46E5"
                    strokeWidth={2} dot={{ r: 3, fill: '#4F46E5', strokeWidth: 0 }}
                    activeDot={{ r: 5, fill: '#6366f1' }} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[150px] flex items-center justify-center text-sm text-[#667085]">No activity data yet</div>
            )}
          </div>
        </div>

        {/* Evidence & network summary */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Evidence breakdown */}
          <div className="card p-5">
            <h3 className="text-sm font-bold text-slate-100 mb-4 flex items-center gap-2">
              <FileText className="h-4 w-4 text-[#4F46E5]" /> Evidence by Type
            </h3>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Images', value: stats?.evidence.images ?? 0, color: 'bg-[#2563EB]', text: 'text-[#2563EB]' },
                { label: 'Documents', value: stats?.evidence.documents ?? 0, color: 'bg-[#4F46E5]', text: 'text-[#4F46E5]' },
                { label: 'Videos', value: stats?.evidence.videos ?? 0, color: 'bg-[#D97706]', text: 'text-[#D97706]' },
                { label: 'Audio', value: stats?.evidence.audio ?? 0, color: 'bg-[#16A34A]', text: 'text-[#16A34A]' },
              ].map(item => (
                <div key={item.label} className="flex items-center gap-3 p-3 rounded-lg bg-[#F8FAFC] border border-[#D9E0EA]">
                  <div className={`h-2.5 w-2.5 rounded-full ${item.color} shrink-0`} />
                  <div>
                    <p className={`text-lg font-bold ${item.text}`}>{item.value}</p>
                    <p className="text-xs text-[#475467] font-semibold">{item.label}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Quick stats */}
          <div className="card p-5">
            <h3 className="text-sm font-bold text-slate-100 mb-4 flex items-center gap-2">
              <Network className="h-4 w-4 text-[#0D9488]" /> Platform Summary
            </h3>
            <div className="space-y-3">
              {[
                { label: 'Total Suspects', value: stats?.persons.suspects ?? 0, icon: <Users className="h-3.5 w-3.5 text-[#D97706]" /> },
                { label: 'Total Victims', value: stats?.persons.victims ?? 0, icon: <Users className="h-3.5 w-3.5 text-[#DC2626]" /> },
                { label: 'Witnesses', value: stats?.persons.witnesses ?? 0, icon: <Users className="h-3.5 w-3.5 text-[#2563EB]" /> },
                { label: 'Active Users', value: stats?.total_users ?? 0, icon: <ShieldAlert className="h-3.5 w-3.5 text-[#4F46E5]" /> },
              ].map(item => (
                <div key={item.label} className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs text-[#475467] font-semibold">
                    {item.icon} {item.label}
                  </div>
                  <span className="text-sm font-bold text-[#172033] font-mono">{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
