import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, FolderOpen, Users, FileText, Activity,
  GitBranch, Brain, BarChart3, ShieldAlert, UserCog, LogOut,
  Shield, Upload, Network, AlertTriangle, Map, Search,
  Lightbulb, Globe, Settings, Boxes, Clock,
} from 'lucide-react';
import clsx from 'clsx';
import { useAuth } from '../../context/AuthContext';

interface NavItem {
  to: string;
  icon: React.ReactNode;
  label: string;
  permission?: string;
  section?: string;
}

const NAV_ITEMS: NavItem[] = [
  // Main
  { to: '/dashboard', icon: <LayoutDashboard className="h-4 w-4" />, label: 'Dashboard', section: 'main' },

  // Investigation
  { to: '/cases', icon: <FolderOpen className="h-4 w-4" />, label: 'Cases', permission: 'CASE_READ', section: 'investigation' },
  { to: '/persons', icon: <Users className="h-4 w-4" />, label: 'Persons', permission: 'PERSON_READ', section: 'investigation' },
  { to: '/entities', icon: <Boxes className="h-4 w-4" />, label: 'Entities', permission: 'CASE_READ', section: 'investigation' },
  { to: '/evidence', icon: <FileText className="h-4 w-4" />, label: 'Evidence', permission: 'EVIDENCE_READ', section: 'investigation' },

  // Intelligence
  { to: '/ingest', icon: <Upload className="h-4 w-4" />, label: 'Data Ingestion', permission: 'CASE_CREATE', section: 'intelligence' },
  { to: '/network', icon: <Network className="h-4 w-4" />, label: 'Network Graph', permission: 'CASE_READ', section: 'intelligence' },
  { to: '/analysis', icon: <Brain className="h-4 w-4" />, label: 'Network Analysis', permission: 'CASE_READ', section: 'intelligence' },
  { to: '/communities', icon: <GitBranch className="h-4 w-4" />, label: 'Communities', permission: 'CASE_READ', section: 'intelligence' },
  { to: '/anomalies', icon: <AlertTriangle className="h-4 w-4" />, label: 'Anomalies', permission: 'CASE_READ', section: 'intelligence' },
  { to: '/timeline', icon: <Clock className="h-4 w-4" />, label: 'Timeline', permission: 'CASE_READ', section: 'intelligence' },
  { to: '/map', icon: <Map className="h-4 w-4" />, label: 'Geospatial', permission: 'CASE_READ', section: 'intelligence' },
  { to: '/query', icon: <Search className="h-4 w-4" />, label: 'Query Engine', permission: 'CASE_READ', section: 'intelligence' },
  { to: '/leads', icon: <Lightbulb className="h-4 w-4" />, label: 'Leads', permission: 'CASE_READ', section: 'intelligence' },

  // Reports & Admin
  { to: '/reports', icon: <BarChart3 className="h-4 w-4" />, label: 'Reports', permission: 'REPORT_GENERATE', section: 'admin' },
  { to: '/audit', icon: <Activity className="h-4 w-4" />, label: 'Audit Logs', permission: 'AUDIT_READ', section: 'admin' },
  { to: '/security', icon: <ShieldAlert className="h-4 w-4" />, label: 'Security', permission: 'SECURITY_READ', section: 'admin' },
  { to: '/users', icon: <UserCog className="h-4 w-4" />, label: 'User Management', permission: 'USER_MANAGE', section: 'admin' },
  { to: '/settings', icon: <Settings className="h-4 w-4" />, label: 'Settings', section: 'admin' },
];

const SECTION_LABELS: Record<string, string> = {
  main: '',
  investigation: 'INVESTIGATION',
  intelligence: 'INTELLIGENCE',
  admin: 'ADMIN',
};

export function Sidebar() {
  const { user, logout, hasPermission } = useAuth();

  const visibleItems = NAV_ITEMS.filter(
    (item) => !item.permission || hasPermission(item.permission)
  );

  // Group by section
  const sections = ['main', 'investigation', 'intelligence', 'admin'];

  return (
    <aside className="flex h-screen w-56 flex-col bg-slate-900 border-r border-slate-800 text-slate-300 shrink-0">
      {/* Logo */}
      <div className="flex items-center gap-2.5 border-b border-slate-800 px-4 py-3.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 shadow-lg shadow-indigo-900/50">
          <Shield className="h-4 w-4 text-white" />
        </div>
        <div>
          <div className="font-bold text-white leading-tight text-sm tracking-wide">CrimeLink</div>
          <div className="text-[10px] text-slate-500 uppercase tracking-wider">Intelligence</div>
        </div>
      </div>

      {/* Demo warning */}
      <div className="mx-3 mt-2 rounded-md border border-amber-700/30 bg-amber-900/10 px-2.5 py-1.5">
        <p className="text-[10px] font-semibold text-amber-500 uppercase tracking-wide">Demo Environment</p>
        <p className="text-[10px] text-amber-600/70">Synthetic data only</p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-2 py-2 space-y-0.5">
        {sections.map((section) => {
          const sectionItems = visibleItems.filter(i => i.section === section);
          if (sectionItems.length === 0) return null;
          const label = SECTION_LABELS[section];
          return (
            <div key={section}>
              {label && (
                <p className="px-3 pt-3 pb-1 text-[9px] font-semibold uppercase tracking-widest text-slate-600">
                  {label}
                </p>
              )}
              {sectionItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    clsx(
                      'flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition-all duration-150 border',
                      isActive
                        ? 'bg-indigo-600/15 text-indigo-400 border-indigo-500/25 shadow-sm'
                        : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200 border-transparent'
                    )
                  }
                >
                  {item.icon}
                  {item.label}
                </NavLink>
              ))}
            </div>
          );
        })}
      </nav>

      {/* User info + logout */}
      <div className="border-t border-slate-800 px-3 py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-600/20 border border-indigo-500/30 text-xs font-bold text-indigo-400">
            {user?.full_name?.charAt(0) ?? '?'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="truncate text-xs font-medium text-slate-200">{user?.full_name}</p>
            <p className="truncate text-[10px] text-slate-500">{user?.roles?.[0]?.replace(/_/g, ' ')}</p>
          </div>
          <button
            onClick={() => logout()}
            title="Logout"
            className="rounded p-1 text-slate-600 hover:bg-slate-800 hover:text-slate-400 transition-colors"
          >
            <LogOut className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </aside>
  );
}
