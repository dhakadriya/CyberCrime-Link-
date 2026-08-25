import clsx from 'clsx';

const STATUS_STYLES: Record<string, string> = {
  DRAFT: 'bg-slate-50 text-slate-700 border-slate-300',
  OPEN: 'bg-[#DBEAFE] text-[#1E40AF] border-[#93C5FD]',
  UNDER_INVESTIGATION: 'bg-[#FEF3C7] text-[#92400E] border-[#FCD34D]',
  ON_HOLD: 'bg-[#F2F4F7] text-[#344054] border-[#D0D5DD]',
  SOLVED: 'bg-[#DCFCE7] text-[#166534] border-[#86EFAC]',
  CLOSED: 'bg-[#F2F4F7] text-[#344054] border-[#D0D5DD]',
  ARCHIVED: 'bg-[#F2F4F7] text-[#344054] border-[#D0D5DD]',
  ACTIVE: 'bg-[#DCFCE7] text-[#166534] border-[#86EFAC]',
  TRANSFERRED: 'bg-[#DBEAFE] text-[#1E40AF] border-[#93C5FD]',
  COMPROMISED: 'bg-[#FEE2E2] text-[#991B1B] border-[#FCA5A5]',
  SUCCESS: 'bg-[#DCFCE7] text-[#166534] border-[#86EFAC]',
  FAILURE: 'bg-[#FEE2E2] text-[#991B1B] border-[#FCA5A5]',
  DENIED: 'bg-[#FFF7ED] text-[#9A3412] border-[#FDBA74]',
  PENDING: 'bg-[#FEF3C7] text-[#92400E] border-[#FCD34D]',
  // Lead statuses
  OPEN_LEAD: 'bg-[#DBEAFE] text-[#1E40AF] border-[#93C5FD]',
  REVIEWED: 'bg-[#DBEAFE] text-[#1E40AF] border-[#93C5FD]',
  ASSIGNED: 'bg-[#DBEAFE] text-[#1E40AF] border-[#93C5FD]',
  DISMISSED: 'bg-[#F2F4F7] text-[#344054] border-[#D0D5DD]',
  ACTIONED: 'bg-[#DCFCE7] text-[#166534] border-[#86EFAC]',
};

const PRIORITY_STYLES: Record<string, string> = {
  LOW: 'bg-[#ECFDF3] text-[#166534] border-[#86EFAC]',
  MEDIUM: 'bg-[#FEF3C7] text-[#92400E] border-[#FCD34D]',
  HIGH: 'bg-[#FFF7ED] text-[#9A3412] border-[#FDBA74]',
  CRITICAL: 'bg-[#FEE2E2] text-[#991B1B] border-[#FCA5A5]',
};

const SEVERITY_STYLES: Record<string, string> = {
  LOW: 'bg-[#ECFDF3] text-[#166534] border-[#86EFAC]',
  MEDIUM: 'bg-[#FEF3C7] text-[#92400E] border-[#FCD34D]',
  HIGH: 'bg-[#FFF7ED] text-[#9A3412] border-[#FDBA74]',
  CRITICAL: 'bg-[#FEE2E2] text-[#991B1B] border-[#FCA5A5]',
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

  const style = styleMap[value] || 'bg-[#F2F4F7] text-[#344054] border-[#D0D5DD]';

  return (
    <span
      className={clsx(
        'inline-flex items-center border rounded-full font-semibold',
        size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-sm',
        style
      )}
    >
      {value.replace(/_/g, ' ')}
    </span>
  );
}
