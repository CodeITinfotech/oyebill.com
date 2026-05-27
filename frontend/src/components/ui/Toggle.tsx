import { clsx } from 'clsx';

interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  disabled?: boolean;
}

export function Toggle({ checked, onChange, label, disabled }: ToggleProps) {
  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) {
      onChange(!checked);
    }
  };

  return (
    <div className="flex items-center gap-2">
      {label && <span className="text-sm text-text-secondary select-none whitespace-nowrap">{label}</span>}
      <div 
        onClick={handleClick}
        className={clsx(
          'relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer flex-shrink-0',
          checked ? 'bg-success' : 'bg-gray-400',
          disabled && 'opacity-50 cursor-not-allowed'
        )}
        role="switch"
        aria-checked={checked}
        aria-label={label || 'Toggle'}
      >
        <span 
          className={clsx(
            'inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow-sm',
            checked ? 'translate-x-6' : 'translate-x-1'
          )} 
        />
      </div>
    </div>
  );
}
