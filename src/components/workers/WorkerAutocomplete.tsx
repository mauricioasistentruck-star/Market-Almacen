import React, { useState, useEffect, useRef } from 'react';
import { db } from '../../db/database';
import type { Worker } from '../../types';
import { useCompany } from '../../utils/companyContext';
import { UserRound, Check } from 'lucide-react';

interface Props {
  value: string;
  onChange: (name: string) => void;
  onSelect?: (worker: Worker) => void;
  placeholder?: string;
  className?: string;
  filterType?: string[];
  required?: boolean;
}

function normalizeStr(str: string): string {
  return (str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim();
}

export const WorkerAutocomplete: React.FC<Props> = ({
  value, onChange, onSelect, placeholder = 'Escriba nombre del trabajador...', className = '', filterType, required
}) => {
  const { selectedCompanyId } = useCompany();
  const [suggestions, setSuggestions] = useState<Worker[]>([]);
  const [show, setShow] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setShow(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const search = async (text: string) => {
    if (!text || text.trim().length < 1) {
      setSuggestions([]);
      setShow(false);
      return;
    }

    const q = normalizeStr(text);
    const allWorkers = await db.workers.toArray();

    // Prioritize prefix match (starts with 'B'), then includes match
    const prefixMatches: Worker[] = [];
    const containsMatches: Worker[] = [];

    for (const w of allWorkers) {
      if (filterType && filterType.length && !filterType.includes(w.type)) continue;

      const normName = normalizeStr(w.name);
      const normRut = normalizeStr(w.rut || '');

      // Check if any word in the name starts with q (e.g. first name or last name starts with B)
      const words = normName.split(/\s+/);
      const startsWithQ = words.some(word => word.startsWith(q)) || normRut.startsWith(q);

      if (startsWithQ) {
        prefixMatches.push(w);
      } else if (normName.includes(q) || normRut.includes(q)) {
        containsMatches.push(w);
      }
    }

    // Sort prefix matches alphabetically
    prefixMatches.sort((a, b) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base' }));
    containsMatches.sort((a, b) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base' }));

    const combined = [...prefixMatches, ...containsMatches].slice(0, 8);
    setSuggestions(combined);
    setShow(combined.length > 0);
    setSelectedIndex(-1);
  };

  const handleSelect = (worker: Worker) => {
    onChange(worker.name);
    onSelect?.(worker);
    setShow(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!show || suggestions.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev < suggestions.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev > 0 ? prev - 1 : suggestions.length - 1));
    } else if (e.key === 'Enter') {
      if (selectedIndex >= 0 && selectedIndex < suggestions.length) {
        e.preventDefault();
        handleSelect(suggestions[selectedIndex]);
      }
    } else if (e.key === 'Escape') {
      setShow(false);
    }
  };

  return (
    <div className="relative w-full" ref={ref}>
      <input
        type="text"
        value={value}
        placeholder={placeholder}
        className={className}
        required={required}
        autoComplete="off"
        onChange={(e) => {
          onChange(e.target.value);
          search(e.target.value);
        }}
        onFocus={() => {
          if (value && value.trim().length >= 1) search(value);
        }}
        onKeyDown={handleKeyDown}
      />
      {show && suggestions.length > 0 && (
        <div className="absolute z-50 left-0 right-0 mt-1 max-h-56 overflow-y-auto bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden divide-y divide-slate-800 animate-fadeIn">
          {suggestions.map((w, idx) => {
            const isHighlighted = idx === selectedIndex;
            return (
              <button
                key={w.id || idx}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => handleSelect(w)}
                className={`w-full px-3.5 py-2.5 text-left flex items-center justify-between gap-2.5 transition ${
                  isHighlighted ? 'bg-orange-500/20 text-orange-200' : 'hover:bg-slate-800 text-slate-200'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-7 h-7 rounded-lg bg-orange-500/20 text-orange-400 border border-orange-500/30 flex items-center justify-center shrink-0">
                    <UserRound className="w-3.5 h-3.5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-100 truncate">{w.name}</p>
                    <p className="text-[11px] text-slate-400 font-mono truncate">
                      {w.rut ? `RUT: ${w.rut}` : ''}
                      {w.company ? ` • ${w.company}` : ''}
                      {w.role ? ` • ${w.role}` : ''}
                    </p>
                  </div>
                </div>
                <span className="text-[10px] font-bold text-slate-400 bg-slate-800 px-2 py-0.5 rounded-md shrink-0">
                  Seleccionar
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
