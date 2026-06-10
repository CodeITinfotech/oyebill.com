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
    if (value) {
      const [y, m, d] = value.split('-').map(Number);
      return new Date(y, m, d);
    }
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
  const dayNames = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

  const prevMonth = () => {
    setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1));
  };

  const selectDate = (day: number) => {
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const formatted = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    onChange(formatted);
    setIsOpen(false);
  };

  const isDisabled = (day: number) => {
    const date = new Date(viewDate.getFullYear(), viewDate.getMonth(), day);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (date > today) return true;
    if (maxDate && date > maxDate) return true;
    if (minDate && date < minDate) return true;
    return false;
  };

  const isSelected = (day: number) => {
    if (!value) return false;
    const [y, m, d] = value.split('-').map(Number);
    return viewDate.getFullYear() === y && viewDate.getMonth() === m && day === d;
  };

  const isToday = (day: number) => {
    const today = new Date();
    return viewDate.getMonth() === today.getMonth() &&
           viewDate.getFullYear() === today.getFullYear() &&
           day === today.getDate();
  };

  const formatDisplay = (dateStr: string) => {
    if (!dateStr) return '';
    const [y, m, d] = dateStr.split('-').map(Number);
    const date = new Date(y, m, d);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const clearDate = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('');
  };

  return (
    <div ref={ref} className="relative">
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2.5 bg-background-primary border border-white/10 rounded-lg text-sm cursor-pointer hover:border-accent/50 transition-colors min-w-[160px]"
      >
        <Calendar className="w-4 h-4 text-text-muted flex-shrink-0" />
        <span className={`flex-1 ${value ? 'text-text-primary' : 'text-text-muted'}`}>
          {value ? formatDisplay(value) : placeholder}
        </span>
        {value && (
          <button 
            onClick={clearDate} 
            className="p-0.5 hover:bg-white/10 rounded flex-shrink-0"
          >
            <X className="w-3 h-3 text-text-muted" />
          </button>
        )}
      </div>

      {isOpen && (
        <div 
          className="absolute z-[100] mt-1 p-4 bg-background-secondary border border-white/10 rounded-xl shadow-2xl"
          style={{ minWidth: '300px' }}
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <button 
              onClick={prevMonth} 
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <span className="font-semibold text-base text-text-primary">
              {monthNames[viewDate.getMonth()]} {viewDate.getFullYear()}
            </span>
            <button 
              onClick={nextMonth} 
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          {/* Day names */}
          <div className="grid grid-cols-7 mb-2">
            {dayNames.map(d => (
              <div key={d} className="text-center text-xs font-medium text-text-muted py-1">
                {d}
              </div>
            ))}
          </div>

          {/* Days grid */}
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: firstDay }).map((_, i) => (
              <div key={`empty-${i}`} className="w-10 h-10" />
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
                    w-10 h-10 rounded-lg text-sm font-medium transition-all
                    ${disabled 
                      ? 'text-text-muted/40 cursor-not-allowed' 
                      : selected 
                        ? 'bg-accent text-white shadow-md' 
                        : 'hover:bg-accent/30 cursor-pointer text-text-primary'
                    }
                    ${today && !selected ? 'ring-2 ring-accent/50' : ''}
                  `}
                >
                  {day}
                </button>
              );
            })}
          </div>

          {/* Today shortcut */}
          <div className="mt-3 pt-3 border-t border-white/10">
            <button
              onClick={() => {
                const today = new Date();
                setViewDate(today);
                selectDate(today.getDate());
              }}
              className="w-full py-2 text-sm text-accent hover:bg-accent/10 rounded-lg transition-colors font-medium"
            >
              Today
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
