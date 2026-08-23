import clsx from 'clsx';

const STATUS_STYLES: Record<string, string> = {
  DRAFT: 'bg-purple-900/40 text-purple-300 border-purple-700/50',
  OPEN: 'bg-blue-900/40 text-blue-300 border-blue-700/50',
  UNDER_INVESTIGATION: 'bg-amber-900/40 text-amber-300 border-amber-700/50',
  ON_HOLD: 'bg-slate-800 text-slate-400 border-slate-700',
  SOLVED: 'bg-emerald-900/40 text-emerald-300 border-emerald-700/50',
  CLOSED: 'bg-slate-800 text-slate-500 border-slate-700',
  ARCHIVED: 'bg-slate-900 text-slate-600 border-slate-800',
  ACTIVE: 'bg-emerald-900/40 text-emerald-300 border-emerald-700/50',
  TRANSFERRED: 'bg-blue-900/40 text-blue-300 border-blue-700/50',
  COMPROMISED: 'bg-red-900/40 text-red-300 border-red-700/50',
  SUCCESS: 'bg-emerald-900/40 text-emerald-300 border-emerald-700/50',
  FAILURE: 'bg-red-900/40 text-red-300 border-red-700/50',
  DENIED: 'bg-orange-900/40 text-orange-300 border-orange-700/50',
  PENDING: 'bg-amber-900/40 text-amber-300 border-amber-700/50',
  // Lead statuses
  OPEN_LEAD: 'bg-indigo-900/40 text-indigo-300 border-indigo-700/50',
  REVIEWED: 'bg-blue-900/40 text-blue-300 border-blue-700/50',
  ASSIGNED: 'bg-violet-900/40 text-violet-300 border-violet-700/50',
  DISMISSED: 'bg-slate-800 text-slate-500 border-slate-700',
  ACTIONED: 'bg-emerald-900/40 text-emerald-300 border-emerald-700/50',
};

const PRIORITY_STYLES: Record<string, string> = {
  LOW: 'bg-emerald-900/40 text-emerald-300 border-emerald-700/50',
  MEDIUM: 'bg-amber-900/40 text-amber-300 border-amber-700/50',
  HIGH: 'bg-orange-900/40 text-orange-300 border-orange-700/50',
  CRITICAL: 'bg-red-900/40 text-red-300 border-red-700/50',
};

const SEVERITY_STYLES: Record<string, string> = {
  LOW: 'bg-blue-900/40 text-blue-300 border-blue-700/50',
  MEDIUM: 'bg-amber-900/40 text-amber-300 border-amber-700/50',
  HIGH: 'bg-orange-900/40 text-orange-300 border-orange-700/50',
  CRITICAL: 'bg-red-900/40 text-red-300 border-red-700/50',
};

interface BadgeProps {
  value: string;
  type?: 'status' | 'priority' | 'severity' | 'role';
  size?: 'sm' | 'md';
}

export function StatusBadge({ value, type = 'status', size = 'sm' }: BadgeProps) {
  const styleMap =
    type === 'priority' ? PRIORITY_STYLES :
    type === 'severity' ? SEVERITY_STYLES :
    STATUS_STYLES;

  const style = styleMap[value] || 'bg-slate-800 text-slate-400 border-slate-700';

  return (
    <span
      className={clsx(
        'inline-flex items-center border rounded font-medium',
        size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-sm',
        style
      )}
    >
      {value.replace(/_/g, ' ')}
    </span>
  );
}
