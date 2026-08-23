import { ChevronLeft, ChevronRight } from 'lucide-react';
import clsx from 'clsx';

interface Props {
  page: number;
  pages: number;
  total: number;
  size: number;
  onChange: (page: number) => void;
}

export function Pagination({ page, pages, total, size, onChange }: Props) {
  if (pages <= 1) return null;
  const start = (page - 1) * size + 1;
  const end = Math.min(page * size, total);

  const visiblePages = () => {
    const p: number[] = [];
    for (let i = Math.max(1, page - 2); i <= Math.min(pages, page + 2); i++) p.push(i);
    return p;
  };

  return (
    <div className="flex items-center justify-between px-1 py-3">
      <p className="text-xs text-slate-500">
        Showing <span className="font-medium text-slate-400">{start}</span>–
        <span className="font-medium text-slate-400">{end}</span>{' '}
        of <span className="font-medium text-slate-400">{total}</span>
      </p>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onChange(page - 1)}
          disabled={page <= 1}
          className="rounded p-1.5 text-slate-500 hover:bg-slate-800 hover:text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        {visiblePages().map((pageNum) => (
          <button
            key={pageNum}
            onClick={() => onChange(pageNum)}
            className={clsx(
              'min-w-[28px] rounded px-2 py-1 text-xs font-medium transition-colors',
              pageNum === page
                ? 'bg-indigo-600 text-white'
                : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
            )}
          >
            {pageNum}
          </button>
        ))}
        <button
          onClick={() => onChange(page + 1)}
          disabled={page >= pages}
          className="rounded p-1.5 text-slate-500 hover:bg-slate-800 hover:text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
