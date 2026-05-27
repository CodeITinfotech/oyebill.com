import { useEffect, useState } from 'react';
import { clsx } from 'clsx';
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

interface Toast {
  id: string;
  type: ToastType;
  message: string;
}

// Use a stable singleton pattern
let toastId = 0;
const listeners: Set<(toast: Toast) => void> = new Set();

export function toast(type: ToastType, message: string) {
  const newToast: Toast = { id: String(++toastId), type, message };
  setTimeout(() => {
    listeners.forEach((listener) => listener(newToast));
  }, 0);
}

export function ToastContainer() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    const listener = (t: Toast) => {
      setToasts((prev) => [...prev, t]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((x) => x.id !== t.id));
      }, 5000);
    };
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  const icons = {
    success: CheckCircle,
    error: XCircle,
    warning: AlertTriangle,
    info: Info,
  };

  const colors = {
    success: 'bg-success/20 border-success text-success',
    error: 'bg-error/20 border-error text-error',
    warning: 'bg-warning/20 border-warning text-warning',
    info: 'bg-info/20 border-info text-info',
  };

  return (
    <div className="fixed top-4 right-4 z-[100] space-y-2">
      {toasts.map((t) => {
        const Icon = icons[t.type];
        return (
          <div
            key={t.id}
            className={clsx(
              'flex items-center gap-3 px-4 py-3 rounded-lg border backdrop-blur-sm animate-slide-in min-w-[300px]',
              colors[t.type]
            )}
          >
            <Icon className="w-5 h-5 shrink-0" />
            <span className="flex-1 text-sm">{t.message}</span>
            <button
              onClick={() => setToasts((prev) => prev.filter((to) => to.id !== t.id))}
              className="p-1 hover:bg-white/10 rounded"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}