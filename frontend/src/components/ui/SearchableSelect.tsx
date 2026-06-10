import { useState, useRef, useEffect } from 'react';
import { Search, ChevronDown, X } from 'lucide-react';

interface Option {
  value: string;
  label: string;
  sublabel?: string;
}

interface SearchableSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: Option[];
  placeholder?: string;
  searchable?: boolean;
}

export function SearchableSelect({ value, onChange, options, placeholder = 'Select...', searchable = true }: SearchableSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const filteredOptions = search
    ? options.filter(o => 
        o.label.toLowerCase().includes(search.toLowerCase()) ||
        o.value.toLowerCase().includes(search.toLowerCase())
      )
    : options;

  const selectedOption = options.find(o => o.value === value);

  const selectOption = (opt: Option) => {
    onChange(opt.value);
    setIsOpen(false);
    setSearch('');
  };

  const clearValue = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('');
  };

  return (
    <div ref={ref} className="relative">
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 bg-background-primary border border-white/10 rounded-lg text-sm cursor-pointer hover:border-accent/50 transition-colors"
      >
        <span className={selectedOption ? 'text-text-primary' : 'text-text-muted'}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown className={`w-4 h-4 text-text-muted ml-auto transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </div>

      {isOpen && (
        <div className="absolute z-50 mt-1 w-full bg-background-secondary border border-white/10 rounded-lg shadow-xl overflow-hidden">
          {searchable && (
            <div className="p-2 border-b border-white/10">
              <div className="flex items-center gap-2 px-2 py-1 bg-background-primary rounded">
                <Search className="w-4 h-4 text-text-muted" />
                <input
                  ref={inputRef}
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search..."
                  className="flex-1 bg-transparent text-sm outline-none text-text-primary"
                />
                {search && (
                  <button onClick={() => setSearch('')} className="p-1 hover:bg-white/10 rounded">
                    <X className="w-3 h-3 text-text-muted" />
                  </button>
                )}
              </div>
            </div>
          )}
          
          <div className="max-h-60 overflow-y-auto">
            {filteredOptions.length === 0 ? (
              <div className="p-3 text-center text-text-muted text-sm">No results found</div>
            ) : (
              filteredOptions.map(opt => (
                <div
                  key={opt.value}
                  onClick={() => selectOption(opt)}
                  className={`px-3 py-2 cursor-pointer hover:bg-accent/20 transition-colors ${
                    opt.value === value ? 'bg-accent/20 text-accent' : ''
                  }`}
                >
                  <div className="text-sm font-medium">{opt.label}</div>
                  {opt.sublabel && <div className="text-xs text-text-muted">{opt.sublabel}</div>}
                </div>
              ))
            )}
          </div>

          {search && !filteredOptions.find(o => o.value === search) && (
            <div
              onClick={() => selectOption({ value: search, label: search })}
              className="p-2 border-t border-white/10 bg-background-tertiary/50 cursor-pointer hover:bg-accent/20 transition-colors"
            >
              <div className="text-sm text-accent">Use "{search}" as new value</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}