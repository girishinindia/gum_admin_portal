'use client';

/**
 * VideoUpload — Phase 15.5
 * ────────────────────────
 * Dual-mode video picker:
 *   • Default: drag-drop or click to upload a video file → backend pushes
 *     it to Bunny Stream and stores the embed URL.
 *   • "Use URL" mode: paste an external link (YouTube, Vimeo, custom MP4).
 *     Stored as-is; no upload happens.
 *
 * The parent owns both pieces of state via two callbacks:
 *   - onFileChange(file)  — fired when a file is picked / cleared.
 *   - onUrlChange(url)    — fired when an external URL is typed / cleared.
 *
 * Mutual exclusivity is enforced internally: picking a file clears the URL,
 * typing a URL clears the file. The parent decides which path to submit.
 */

import { useCallback, useRef, useState } from 'react';
import Link from 'next/link';
import { Upload, X, Film, ExternalLink, Link2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface VideoUploadProps {
  label?:        string;
  hint?:         string;
  value?:        string | null;     // existing URL (Bunny Stream embed or external)
  maxSizeMb?:    number;            // client-side guard, default 2048 (2 GB)
  className?:    string;
  onFileChange:  (file: File | null) => void;
  onUrlChange:   (url: string | null) => void;
}

function humanFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function isBunnyEmbed(url: string): boolean {
  return /mediadelivery\.net\/embed\//.test(url);
}

export function VideoUpload({
  label,
  hint,
  value,
  maxSizeMb = 2048,
  className,
  onFileChange,
  onUrlChange,
}: VideoUploadProps) {
  // mode tracks whether the active input is a file pick or a URL.
  // If the existing value looks like an external (non-Bunny) URL, default to URL mode.
  const initialMode: 'file' | 'url' = value && !isBunnyEmbed(value) ? 'url' : 'file';
  const [mode, setMode] = useState<'file' | 'url'>(initialMode);

  const inputRef = useRef<HTMLInputElement>(null);
  const [pickedFile, setPickedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dragCounter = useRef(0);
  const [urlValue, setUrlValue] = useState<string>(value && !isBunnyEmbed(value) ? value : '');

  function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const f = files[0];
    if (!f.type.startsWith('video/') && !/\.(mp4|mov|webm|mkv|avi)$/i.test(f.name)) {
      setError('Not a video file');
      return;
    }
    if (maxSizeMb && f.size > maxSizeMb * 1024 * 1024) {
      setError(`File too large (max ${maxSizeMb >= 1024 ? `${(maxSizeMb / 1024).toFixed(0)} GB` : `${maxSizeMb} MB`})`);
      return;
    }
    setError(null);
    setPickedFile(f);
    setUrlValue('');
    onFileChange(f);
    onUrlChange(null);
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

  function handleRemoveFile(e: React.MouseEvent) {
    e.preventDefault(); e.stopPropagation();
    setPickedFile(null);
    setError(null);
    onFileChange(null);
    // Also clear the stored URL — the parent now has no video for this field.
    onUrlChange(null);
  }

  function handleUrlInput(e: React.ChangeEvent<HTMLInputElement>) {
    const next = e.target.value;
    setUrlValue(next);
    setPickedFile(null);
    onFileChange(null);
    onUrlChange(next.trim() ? next.trim() : null);
  }

  const hasFile = !!pickedFile;
  const hasExistingValue = !!value && !pickedFile;

  return (
    <div className={className}>
      {label && (
        <div className="flex items-center justify-between mb-1.5">
          <label className="block text-sm font-medium text-slate-700">{label}</label>
          <button
            type="button"
            onClick={() => {
              setMode((m) => (m === 'file' ? 'url' : 'file'));
              setError(null);
            }}
            className="text-xs text-brand-600 hover:text-brand-700 hover:underline flex items-center gap-1"
          >
            {mode === 'file' ? (<><Link2 className="w-3 h-3" />use external URL</>) : (<><Upload className="w-3 h-3" />upload file instead</>)}
          </button>
        </div>
      )}

      {mode === 'file' ? (
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
            <Film className={cn('w-6 h-6', isDragging ? 'text-brand-500' : 'text-slate-400')} />
          </div>

          <div className="flex-1 min-w-0">
            {isDragging ? (
              <div className="text-sm font-medium text-brand-600">Drop video here</div>
            ) : hasFile ? (
              <>
                <div className="text-sm font-medium text-slate-900 truncate">{pickedFile!.name}</div>
                <div className="text-xs text-slate-500 mt-0.5">
                  {humanFileSize(pickedFile!.size)} · ready to upload to Bunny Stream
                </div>
              </>
            ) : hasExistingValue ? (
              <>
                <div className="text-sm font-medium text-slate-900 truncate">
                  {isBunnyEmbed(value!) ? 'On Bunny Stream' : 'External URL'}
                </div>
                <div className="text-xs text-slate-500 mt-0.5 truncate">{value} · click or drag to replace</div>
              </>
            ) : (
              <>
                <div className="text-sm font-medium text-slate-700 flex items-center gap-1.5">
                  <Upload className="w-4 h-4" /> Click or drag to upload video
                </div>
                <div className="text-xs text-slate-500 mt-0.5">
                  MP4 / MOV / WebM · max {maxSizeMb >= 1024 ? `${(maxSizeMb / 1024).toFixed(0)} GB` : `${maxSizeMb} MB`} · uploads to Bunny Stream
                </div>
              </>
            )}
          </div>

          {(hasFile || hasExistingValue) && !isDragging && (
            <div className="flex items-center gap-1 flex-shrink-0">
              {hasExistingValue && (
                <Link
                  href={value!}
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
                onClick={handleRemoveFile}
                className="p-1.5 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                title="Remove"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          <input ref={inputRef} type="file" accept="video/*,.mp4,.mov,.webm,.mkv,.avi" className="hidden" onChange={handleSelect} />
        </label>
      ) : (
        <input
          type="text"
          value={urlValue}
          onChange={handleUrlInput}
          placeholder="https://youtube.com/watch?v=…  or  https://example.com/video.mp4"
          className="block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-300 focus:border-brand-400"
        />
      )}

      {error && <p className="text-xs text-rose-600 mt-1.5">{error}</p>}
      {!error && hint && <p className="text-xs text-slate-500 mt-1.5">{hint}</p>}
    </div>
  );
}
