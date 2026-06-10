import { Modal } from './Modal';
import { Button } from './Button';
import { AlertTriangle } from 'lucide-react';

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'default';
  loading?: boolean;
}

export function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'danger',
  loading = false,
}: ConfirmModalProps) {
  const iconColors = {
    danger: 'text-red-400',
    warning: 'text-orange-400',
    default: 'text-blue-400',
  };

  const buttonVariants = {
    danger: 'danger' as const,
    warning: 'warning' as const,
    default: 'primary' as const,
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="sm">
      <div className="text-center">
        <div className={`mx-auto w-12 h-12 rounded-full bg-background-secondary flex items-center justify-center mb-4`}>
          <AlertTriangle className={`w-6 h-6 ${iconColors[variant]}`} />
        </div>
        <p className="text-text-secondary mb-6">{message}</p>
        <div className="flex gap-3 justify-center">
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            {cancelText}
          </Button>
          <Button variant={buttonVariants[variant]} onClick={onConfirm} loading={loading}>
            {confirmText}
          </Button>
        </div>
      </div>
    </Modal>
  );
}