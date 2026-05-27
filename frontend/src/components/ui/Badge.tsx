import { clsx } from 'clsx';

type BadgeVariant = 'success' | 'warning' | 'error' | 'info' | 'accent' | 'default';

interface BadgeProps {
  variant?: BadgeVariant;
  children: React.ReactNode;
  className?: string;
}

export function Badge({ variant = 'default', children, className }: BadgeProps) {
  const variants = {
    success: 'badge-success',
    warning: 'badge-warning',
    error: 'badge-error',
    info: 'badge-info',
    accent: 'badge-accent',
    default: 'bg-white/10 text-text-secondary',
  };

  return (
    <span className={clsx('badge', variants[variant], className)}>
      {children}
    </span>
  );
}