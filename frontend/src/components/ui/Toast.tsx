import { useEffect, useState } from 'react';
import { clsx } from 'clsx';
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

interface Toast {
  id: string;
  type: ToastType;
  message: string;
  exiting?: boolean;
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
      // Auto-dismiss after 2 seconds with slide-out animation
      setTimeout(() => {
        setToasts((prev) => prev.map(x => x.id === t.id ? { ...x, exiting: true } : x));
        setTimeout(() => {
          setToasts((prev) => prev.filter((x) => x.id !== t.id));
        }, 300); // Slide-out animation duration
      }, 2000); // Display duration
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
              'flex items-center gap-3 px-4 py-3 rounded-lg border backdrop-blur-sm min-w-[300px] transition-all duration-300',
              colors[t.type],
              t.exiting ? 'animate-slide-out' : 'animate-slide-in'
            )}
          >
            <Icon className="w-5 h-5 shrink-0" />
            <span className="flex-1 text-sm">{t.message}</span>
            <button
              onClick={() => {
                setToasts((prev) => prev.map(x => x.id === t.id ? { ...x, exiting: true } : x));
                setTimeout(() => {
                  setToasts((prev) => prev.filter((to) => to.id !== t.id));
                }, 300);
              }}
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