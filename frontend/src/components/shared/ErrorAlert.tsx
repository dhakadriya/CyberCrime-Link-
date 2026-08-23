import { AlertTriangle, X, CheckCircle2, Info } from 'lucide-react';

interface Props {
  message: string;
  onClose?: () => void;
}

export function ErrorAlert({ message, onClose }: Props) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-red-800/50 bg-red-900/20 px-4 py-3">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
      <p className="flex-1 text-sm text-red-300">{message}</p>
      {onClose && (
        <button onClick={onClose} className="shrink-0 text-red-500 hover:text-red-300">
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

export function SuccessAlert({ message, onClose }: Props) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-emerald-800/50 bg-emerald-900/20 px-4 py-3">
      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
      <p className="flex-1 text-sm text-emerald-300">{message}</p>
      {onClose && (
        <button onClick={onClose} className="shrink-0 text-emerald-500 hover:text-emerald-300">
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

export function InfoAlert({ message, onClose }: Props) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-blue-800/50 bg-blue-900/20 px-4 py-3">
      <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-400" />
      <p className="flex-1 text-sm text-blue-300">{message}</p>
      {onClose && (
        <button onClick={onClose} className="shrink-0 text-blue-500 hover:text-blue-300">
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
