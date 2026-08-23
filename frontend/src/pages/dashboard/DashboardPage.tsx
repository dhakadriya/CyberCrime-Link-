import { useEffect, useState } from 'react'
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

const PRIORITY_COLORS = ['#10b981', '#f59e0b', '#f97316', '#ef4444']
const STATUS_COLORS: Record<string, string> = {
  'Open': '#6366f1', 'Under Investigation': '#f59e0b',
  'On Hold': '#475569', 'Solved': '#10b981',
  'Closed': '#334155', 'Archived': '#1e293b',
}

const CHART_TOOLTIP_STYLE = {
  backgroundColor: '#1e293b',
  border: '1px solid #334155',
  borderRadius: '8px',
  color: '#e2e8f0',
  fontSize: '12px',
}

function StatCard({ icon, label, value, sub, color, accent }: {
  icon: React.ReactNode; label: string; value: number | string;
  sub?: string; color?: string; accent?: string;
}) {
  return (
    <div className="card p-4 flex items-start gap-3 hover:border-slate-700 transition-colors">
      <div className={`rounded-lg p-2.5 ${color ?? 'bg-indigo-500/10'}`}>
        {icon}
      </div>
      <div>
        <p className={`text-2xl font-bold ${accent ?? 'text-slate-100'}`}>{value}</p>
        <p className="text-xs font-medium text-slate-400">{label}</p>
        {sub && <p className="text-xs text-slate-600 mt-0.5">{sub}</p>}
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

  if (loading) return <PageLoader />

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="page-header flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-slate-100">Investigation Dashboard</h1>
          <p className="text-xs text-slate-500 mt-0.5">Real-time overview of all investigation activities</p>
        </div>
        <span className="rounded-full bg-amber-900/30 border border-amber-700/40 px-3 py-1 text-xs font-medium text-amber-400">
          DEMO — SYNTHETIC DATA
        </span>
      </div>

      <div className="page-content space-y-5">
        {/* Primary stat cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard
            icon={<FolderOpen className="h-5 w-5 text-indigo-400" />}
            label="Total Cases"
            value={stats?.cases.total ?? 0}
            sub={`${stats?.cases.open ?? 0} open · ${stats?.cases.under_investigation ?? 0} active`}
            color="bg-indigo-500/10"
            accent="text-indigo-300"
          />
          <StatCard
            icon={<Users className="h-5 w-5 text-blue-400" />}
            label="Persons"
            value={stats?.persons.total ?? 0}
            sub={`${stats?.persons.suspects ?? 0} subjects · ${stats?.persons.victims ?? 0} victims`}
            color="bg-blue-500/10"
            accent="text-blue-300"
          />
          <StatCard
            icon={<FileText className="h-5 w-5 text-violet-400" />}
            label="Evidence Items"
            value={stats?.evidence.total ?? 0}
            sub={`${stats?.evidence.active ?? 0} active`}
            color="bg-violet-500/10"
            accent="text-violet-300"
          />
          <StatCard
            icon={<ShieldAlert className="h-5 w-5 text-red-400" />}
            label="Security Events"
            value={stats?.recent_security_events ?? 0}
            sub="Last 24 hours"
            color="bg-red-500/10"
            accent="text-red-300"
          />
        </div>

        {/* Secondary stat cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard
            icon={<AlertTriangle className="h-4 w-4 text-red-400" />}
            label="Critical Priority"
            value={stats?.cases.critical_priority ?? 0}
            color="bg-red-500/10"
          />
          <StatCard
            icon={<TrendingUp className="h-4 w-4 text-orange-400" />}
            label="High Priority"
            value={stats?.cases.high_priority ?? 0}
            color="bg-orange-500/10"
          />
          <StatCard
            icon={<CheckCircle2 className="h-4 w-4 text-emerald-400" />}
            label="Cases Solved"
            value={stats?.cases.solved ?? 0}
            color="bg-emerald-500/10"
          />
          <StatCard
            icon={<Clock className="h-4 w-4 text-amber-400" />}
            label="On Hold"
            value={stats?.cases.on_hold ?? 0}
            color="bg-amber-500/10"
          />
        </div>

        {/* Charts row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Cases by Status - Pie */}
          <div className="card p-5">
            <h3 className="text-sm font-semibold text-slate-300 mb-4 flex items-center gap-2">
              <FolderOpen className="h-4 w-4 text-indigo-400" /> Cases by Status
            </h3>
            {charts && charts.cases_by_status.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={charts.cases_by_status} dataKey="value" nameKey="name"
                    cx="50%" cy="50%" outerRadius={72} innerRadius={30}
                    label={({ name, value }) => `${name}: ${value}`}
                    labelLine={false}
                    style={{ fontSize: 10 }}
                  >
                    {charts.cases_by_status.map((entry, i) => (
                      <Cell key={i} fill={STATUS_COLORS[entry.name] ?? entry.color ?? '#6366f1'} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[200px] flex items-center justify-center text-sm text-slate-600">No data yet</div>
            )}
          </div>

          {/* Cases by Priority - Bar */}
          <div className="card p-5">
            <h3 className="text-sm font-semibold text-slate-300 mb-4 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-orange-400" /> Cases by Priority
            </h3>
            {charts && charts.cases_by_priority.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={charts.cases_by_priority} barSize={36}>
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
                  <Bar dataKey="value" name="Cases" radius={[4, 4, 0, 0]}>
                    {charts.cases_by_priority.map((entry, i) => (
                      <Cell key={i} fill={PRIORITY_COLORS[i % PRIORITY_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[200px] flex items-center justify-center text-sm text-slate-600">No data yet</div>
            )}
          </div>

          {/* Activity last 7 days */}
          <div className="card p-5 lg:col-span-2">
            <h3 className="text-sm font-semibold text-slate-300 mb-4 flex items-center gap-2">
              <Activity className="h-4 w-4 text-emerald-400" /> Investigation Activity — Last 7 Days
            </h3>
            {charts && charts.activity_last_7_days.length > 0 ? (
              <ResponsiveContainer width="100%" height={150}>
                <LineChart data={charts.activity_last_7_days}>
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
                  <Line type="monotone" dataKey="events" name="Events" stroke="#6366f1"
                    strokeWidth={2} dot={{ r: 3, fill: '#6366f1', strokeWidth: 0 }}
                    activeDot={{ r: 5, fill: '#818cf8' }} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[150px] flex items-center justify-center text-sm text-slate-600">No activity data yet</div>
            )}
          </div>
        </div>

        {/* Evidence & network summary */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Evidence breakdown */}
          <div className="card p-5">
            <h3 className="text-sm font-semibold text-slate-300 mb-4 flex items-center gap-2">
              <FileText className="h-4 w-4 text-violet-400" /> Evidence by Type
            </h3>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Images', value: stats?.evidence.images ?? 0, color: 'bg-blue-500', text: 'text-blue-400' },
                { label: 'Documents', value: stats?.evidence.documents ?? 0, color: 'bg-violet-500', text: 'text-violet-400' },
                { label: 'Videos', value: stats?.evidence.videos ?? 0, color: 'bg-amber-500', text: 'text-amber-400' },
                { label: 'Audio', value: stats?.evidence.audio ?? 0, color: 'bg-emerald-500', text: 'text-emerald-400' },
              ].map(item => (
                <div key={item.label} className="flex items-center gap-3 p-3 rounded-lg bg-slate-800/50 border border-slate-800">
                  <div className={`h-2.5 w-2.5 rounded-full ${item.color} shrink-0`} />
                  <div>
                    <p className={`text-lg font-bold ${item.text}`}>{item.value}</p>
                    <p className="text-xs text-slate-500">{item.label}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Quick stats */}
          <div className="card p-5">
            <h3 className="text-sm font-semibold text-slate-300 mb-4 flex items-center gap-2">
              <Network className="h-4 w-4 text-cyan-400" /> Platform Summary
            </h3>
            <div className="space-y-3">
              {[
                { label: 'Total Suspects', value: stats?.persons.suspects ?? 0, icon: <Users className="h-3.5 w-3.5 text-orange-400" /> },
                { label: 'Total Victims', value: stats?.persons.victims ?? 0, icon: <Users className="h-3.5 w-3.5 text-red-400" /> },
                { label: 'Witnesses', value: stats?.persons.witnesses ?? 0, icon: <Users className="h-3.5 w-3.5 text-blue-400" /> },
                { label: 'Active Users', value: stats?.total_users ?? 0, icon: <ShieldAlert className="h-3.5 w-3.5 text-indigo-400" /> },
              ].map(item => (
                <div key={item.label} className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    {item.icon} {item.label}
                  </div>
                  <span className="text-sm font-bold text-slate-200">{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
