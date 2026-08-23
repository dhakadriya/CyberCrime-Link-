import clsx from 'clsx';

interface Props {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function LoadingSpinner({ size = 'md', className }: Props) {
  return (
    <div
      className={clsx(
        'animate-spin rounded-full border-2 border-slate-700 border-t-indigo-500',
        size === 'sm' && 'h-4 w-4',
        size === 'md' && 'h-8 w-8',
        size === 'lg' && 'h-12 w-12',
        className
      )}
    />
  );
}

export function PageLoader() {
  return (
    <div className="flex h-64 items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <LoadingSpinner size="lg" />
        <p className="text-xs text-slate-500 animate-pulse">Loading…</p>
      </div>
    </div>
  );
}
