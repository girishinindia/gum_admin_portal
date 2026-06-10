'use client';
import { useEffect, useRef, useState } from 'react';
import { Search, X, Loader2 } from 'lucide-react';

export interface SelectOption { id: number; name: string; email?: string }

/**
 * Debounced searchable single-select. Shows "name · email · #id" options loaded
 * from `loadOptions(search)`. Reports only the chosen id via `onChange`.
 * Remount it (via React `key`) to reset the selection — e.g. when the item type
 * changes or the dialog re-opens.
 */
export function SearchSelect({
  onChange,
  loadOptions,
  placeholder = 'Search…',
  disabled = false,
}: {
  onChange: (id: number | '') => void;
  loadOptions: (search: string) => Promise<SelectOption[]>;
  placeholder?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [options, setOptions] = useState<SelectOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<SelectOption | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => { if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const runLoad = (q: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try { setOptions(await loadOptions(q)); } catch { setOptions([]); } finally { setLoading(false); }
    }, 250);
  };

  // Preload an initial page so the first open isn't empty.
  useEffect(() => { runLoad(''); return () => { if (debounceRef.current) clearTimeout(debounceRef.current); }; }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const clear = () => { setSelected(null); onChange(''); setQuery(''); };

  return (
    <div className="relative" ref={boxRef}>
      {selected && !open ? (
        <div className="w-full flex items-center justify-between gap-2 text-sm border rounded-md px-3 py-2 bg-white">
          <button type="button" className="flex items-center gap-2 min-w-0 text-left" onClick={() => setOpen(true)} disabled={disabled}>
            <span className="truncate">{selected.name}</span>
            {selected.email && <span className="text-xs text-slate-400 truncate">{selected.email}</span>}
            <span className="font-mono text-xs text-slate-400 shrink-0">#{selected.id}</span>
          </button>
          <button type="button" aria-label="Clear" onClick={clear} className="shrink-0"><X className="w-4 h-4 text-slate-400" /></button>
        </div>
      ) : (
        <div className="flex items-center gap-2 border rounded-md px-3 py-2 bg-white">
          <Search className="w-4 h-4 text-slate-400 shrink-0" />
          <input
            className="w-full text-sm outline-none bg-transparent"
            placeholder={placeholder}
            value={query}
            disabled={disabled}
            onFocus={() => setOpen(true)}
            onChange={(e) => { setQuery(e.target.value); setOpen(true); runLoad(e.target.value); }}
          />
          {loading && <Loader2 className="w-4 h-4 text-slate-400 animate-spin shrink-0" />}
        </div>
      )}

      {open && (
        <div className="absolute z-50 mt-1 w-full max-h-56 overflow-auto bg-white border rounded-md shadow-lg">
          {options.length === 0 ? (
            <div className="px-3 py-2 text-sm text-slate-400">{loading ? 'Searching…' : 'No matches'}</div>
          ) : options.map((o) => (
            <button
              key={o.id}
              type="button"
              onClick={() => { setSelected(o); onChange(o.id); setQuery(''); setOpen(false); }}
              className="w-full flex items-center justify-between gap-2 px-3 py-2 text-sm text-left hover:bg-slate-50"
            >
              <span className="flex items-center gap-2 min-w-0">
                <span className="truncate">{o.name}</span>
                {o.email && <span className="text-xs text-slate-400 truncate">{o.email}</span>}
              </span>
              <span className="font-mono text-xs text-slate-400 shrink-0">#{o.id}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
