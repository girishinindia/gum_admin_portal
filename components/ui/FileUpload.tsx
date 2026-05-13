'use client';

/**
 * FileUpload — Phase 15.4
 * ───────────────────────
 * Generic drag-and-drop file picker for non-image files (PDF, doc, zip, etc.).
 *
 * Behaves like ImageUpload but skips the crop/resize editor — the file is
 * passed straight to the parent. Use this for brochures, syllabi, slide
 * decks, and similar uploads where there's no client-side processing.
 *
 * Props mirror ImageUpload where it makes sense:
 *   - value:    existing CDN URL to display (if any)
 *   - accept:   accept attribute (default 'application/pdf,.pdf,.doc,.docx')
 *   - maxSizeMb: client-side size cap (default 25 MB)
 *   - onChange(file: File | null, filename: string | null)
 */

import { useCallback, useRef, useState } from 'react';
import Link from 'next/link';
import { Upload, X, FileText, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FileUploadProps {
  label?:     string;
  hint?:      string;
  value?:     string | null;          // existing CDN URL
  accept?:    string;
  maxSizeMb?: number;
  className?: string;
  onChange:   (file: File | null, filename: string | null) => void;
}

function humanFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function basename(url: string): string {
  try {
    const parts = url.split('/');
    return decodeURIComponent(parts[parts.length - 1] || url);
  } catch {
    return url;
  }
}

export function FileUpload({
  label,
  hint,
  value,
  accept = 'application/pdf,.pdf,.doc,.docx',
  maxSizeMb = 25,
  className,
  onChange,
}: FileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [pickedFile, setPickedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dragCounter = useRef(0);

  function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const f = files[0];
    if (maxSizeMb && f.size > maxSizeMb * 1024 * 1024) {
      setError(`File too large (max ${maxSizeMb} MB)`);
      return;
    }
    setError(null);
    setPickedFile(f);
    onChange(f, f.name);
  }

  function handleSelect(e: React.ChangeEvent<HTMLInputElement>) {
    handleFiles(e.target.files);
    if (inputRef.current) inputRef.current.value = '';
  }

  const onDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation();
    dragCounter.current += 1;
    if (e.dataTransfer.types.includes('Files')) setIsDragging(true);
  }, []);
  const onDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation();
    dragCounter.current -= 1;
    if (dragCounter.current === 0) setIsDragging(false);
  }, []);
  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation();
  }, []);
  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation();
    setIsDragging(false);
    dragCounter.current = 0;
    handleFiles(e.dataTransfer.files);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleRemove(e: React.MouseEvent) {
    e.preventDefault(); e.stopPropagation();
    setPickedFile(null);
    setError(null);
    onChange(null, null);
  }

  const hasFile = pickedFile || value;
  const filenameToShow = pickedFile?.name ?? (value ? basename(value) : null);

  return (
    <div className={className}>
      {label && <label className="block text-sm font-medium text-slate-700 mb-1.5">{label}</label>}

      <label
        className={cn(
          'flex items-center gap-4 p-3 border-2 border-dashed rounded-xl cursor-pointer transition-all',
          isDragging
            ? 'border-brand-500 bg-brand-50/50 ring-2 ring-brand-200'
            : 'border-slate-200 hover:border-brand-300 hover:bg-brand-50/30',
        )}
        onDragEnter={onDragEnter}
        onDragLeave={onDragLeave}
        onDragOver={onDragOver}
        onDrop={onDrop}
      >
        <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-slate-100 border border-slate-200 flex-shrink-0">
          <FileText className={cn('w-6 h-6', isDragging ? 'text-brand-500' : 'text-slate-400')} />
        </div>

        <div className="flex-1 min-w-0">
          {isDragging ? (
            <div className="text-sm font-medium text-brand-600">Drop file here</div>
          ) : hasFile ? (
            <>
              <div className="text-sm font-medium text-slate-900 truncate">{filenameToShow}</div>
              <div className="text-xs text-slate-500 mt-0.5">
                {pickedFile
                  ? `${humanFileSize(pickedFile.size)} · ready to upload`
                  : 'On CDN · click or drag to replace'}
              </div>
            </>
          ) : (
            <>
              <div className="text-sm font-medium text-slate-700 flex items-center gap-1.5">
                <Upload className="w-4 h-4" /> Click or drag to upload file
              </div>
              <div className="text-xs text-slate-500 mt-0.5">
                {accept.includes('pdf') ? 'PDF' : 'File'} · max {maxSizeMb} MB
              </div>
            </>
          )}
        </div>

        {hasFile && !isDragging && (
          <div className="flex items-center gap-1 flex-shrink-0">
            {value && !pickedFile && (
              <Link
                href={value}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="p-1.5 rounded-md text-slate-400 hover:text-brand-600 hover:bg-brand-50 transition-colors"
                title="Open in new tab"
              >
                <ExternalLink className="w-4 h-4" />
              </Link>
            )}
            <button
              type="button"
              onClick={handleRemove}
              className="p-1.5 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
              title="Remove"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        <input ref={inputRef} type="file" accept={accept} className="hidden" onChange={handleSelect} />
      </label>

      {error && <p className="text-xs text-rose-600 mt-1.5">{error}</p>}
      {!error && hint && <p className="text-xs text-slate-500 mt-1.5">{hint}</p>}
    </div>
  );
}
