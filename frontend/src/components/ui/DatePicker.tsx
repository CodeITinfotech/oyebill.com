import { useState, useRef, useEffect } from 'react';
import { Calendar, ChevronLeft, ChevronRight, X } from 'lucide-react';

interface DatePickerProps {
  value: string;
  onChange: (date: string) => void;
  placeholder?: string;
  maxDate?: Date;
  minDate?: Date;
}

export function DatePicker({ value, onChange, placeholder = 'Select date', maxDate, minDate }: DatePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [viewDate, setViewDate] = useState(() => {
    if (value) return new Date(value);
    return new Date();
  });
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const daysInMonth = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0).getDate();
  const firstDay = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1).getDay();
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const prevMonth = () => {
    setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1));
  };

  const selectDate = (day: number) => {
    const d = new Date(viewDate.getFullYear(), viewDate.getMonth(), day);
    const formatted = d.toISOString().split('T')[0];
    onChange(formatted);
    setIsOpen(false);
  };

  const isDisabled = (day: number) => {
    const date = new Date(viewDate.getFullYear(), viewDate.getMonth(), day);
    if (maxDate && date > maxDate) return true;
    if (minDate && date < minDate) return true;
    if (date > new Date()) return true;
    return false;
  };

  const isSelected = (day: number) => {
    if (!value) return false;
    const date = new Date(viewDate.getFullYear(), viewDate.getMonth(), day);
    return date.toISOString().split('T')[0] === value;
  };

  const isToday = (day: number) => {
    const today = new Date();
    return viewDate.getMonth() === today.getMonth() &&
           viewDate.getFullYear() === today.getFullYear() &&
           day === today.getDate();
  };

  const formatDisplay = (dateStr: string) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const clearDate = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('');
  };

  return (
    <div ref={ref} className="relative">
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 bg-background-primary border border-white/10 rounded-lg text-sm cursor-pointer hover:border-accent/50 transition-colors"
      >
        <Calendar className="w-4 h-4 text-text-muted" />
        <span className={value ? 'text-text-primary' : 'text-text-muted'}>
          {value ? formatDisplay(value) : placeholder}
        </span>
        {value && (
          <button onClick={clearDate} className="ml-auto p-1 hover:bg-white/10 rounded">
            <X className="w-3 h-3 text-text-muted" />
          </button>
        )}
      </div>

      {isOpen && (
        <div className="absolute z-50 mt-1 p-3 bg-background-secondary border border-white/10 rounded-lg shadow-xl">
          {/* Header */}
          <div className="flex items-center justify-between mb-3">
            <button onClick={prevMonth} className="p-1 hover:bg-white/10 rounded">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <span className="font-medium">{monthNames[viewDate.getMonth()]} {viewDate.getFullYear()}</span>
            <button onClick={nextMonth} className="p-1 hover:bg-white/10 rounded">
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          {/* Day names */}
          <div className="grid grid-cols-7 gap-1 mb-1">
            {dayNames.map(d => (
              <div key={d} className="text-center text-xs text-text-muted py-1">{d}</div>
            ))}
          </div>

          {/* Days */}
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: firstDay }).map((_, i) => (
              <div key={`empty-${i}`} />
            ))}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const disabled = isDisabled(day);
              const selected = isSelected(day);
              const today = isToday(day);
              return (
                <button
                  key={day}
                  onClick={() => !disabled && selectDate(day)}
                  disabled={disabled}
                  className={`
                    w-8 h-8 rounded-lg text-sm transition-colors
                    ${disabled ? 'text-text-muted/30 cursor-not-allowed' : 'hover:bg-accent/20 cursor-pointer'}
                    ${selected ? 'bg-accent text-white' : ''}
                    ${today && !selected ? 'border border-accent' : ''}
                  `}
                >
                  {day}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}