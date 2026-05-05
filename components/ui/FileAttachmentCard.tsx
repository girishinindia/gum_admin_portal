"use client";
import { useRef, useState, useCallback } from 'react';
import { ExternalLink, X, FileArchive, FileCode, FileText, File, Upload } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FileAttachmentCardProps {
  /** The CDN URL of the existing file (null/empty = no file attached) */
  fileUrl: string | null | undefined;
  /** Label to display (e.g. "Solution ZIP", "HTML File (English)") */
  label: string;
  /** File accept filter (e.g. ".zip", ".html,.htm") */
  accept?: string;
  /** Called when user picks a new file */
  onFileSelected: (file: File | null) => void;
  /** The currently selected new file (before save) */
  newFile: File | null;
  /** Whether the component is disabled */
  disabled?: boolean;
  /** Optional: called when user clicks remove (clears existing file) */
  onRemove?: () => void;
  /** Optional: override the displayed filename (instead of extracting from URL) */
  displayName?: string;
}

/** Extract filename from a CDN URL */
function getFilenameFromUrl(url: string): string {
  try {
    const pathname = new URL(url).pathname;
    const parts = pathname.split('/');
    return decodeURIComponent(parts[parts.length - 1] || 'file');
  } catch {
    const parts = url.split('/');
    return parts[parts.length - 1] || 'file';
  }
}

/** Get file extension */
function getExtension(name: string): string {
  const parts = name.split('.');
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : '';
}

/** Get icon and colors for file type */
function getFileTypeInfo(ext: string) {
  switch (ext) {
    case 'zip': case 'rar': case '7z': case 'tar': case 'gz':
      return { Icon: FileArchive, bg: 'bg-blue-100', text: 'text-blue-600', badge: 'ZIP' };
    case 'html': case 'htm':
      return { Icon: FileCode, bg: 'bg-amber-100', text: 'text-amber-600', badge: 'HTML' };
    case 'pdf':
      return { Icon: FileText, bg: 'bg-red-100', text: 'text-red-600', badge: 'PDF' };
    case 'doc': case 'docx':
      return { Icon: FileText, bg: 'bg-indigo-100', text: 'text-indigo-600', badge: 'DOC' };
    default:
      return { Icon: File, bg: 'bg-gray-100', text: 'text-gray-500', badge: ext.toUpperCase() || 'FILE' };
  }
}

export function FileAttachmentCard({
  fileUrl,
  label,
  accept,
  onFileSelected,
  newFile,
  disabled = false,
  onRemove,
  displayName,
}: FileAttachmentCardProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const hasExisting = !!fileUrl;
  const filename = displayName || (hasExisting ? getFilenameFromUrl(fileUrl!) : '');
  const ext = filename ? getExtension(filename) : '';
  const typeInfo = getFileTypeInfo(ext || (accept?.replace('.', '') || ''));

  // Parse accepted extensions from accept string
  const acceptedExts = (accept || '').split(',').map(s => s.trim().replace('.', '').toLowerCase()).filter(Boolean);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) setIsDragOver(true);
  }, [disabled]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (containerRef.current && !containerRef.current.contains(e.relatedTarget as Node)) {
      setIsDragOver(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    if (disabled) return;

    const files = Array.from(e.dataTransfer.files);
    if (files.length === 0) return;

    const file = files[0];
    // Validate extension if accept is specified
    if (acceptedExts.length > 0) {
      const fileExt = getExtension(file.name);
      if (!acceptedExts.includes(fileExt)) {
        return; // silently reject wrong file type
      }
    }
    onFileSelected(file);
  }, [disabled, acceptedExts, onFileSelected]);

  return (
    <div
      ref={containerRef}
      className={cn(
        "space-y-1.5 relative rounded-lg transition-colors",
        isDragOver && "ring-2 ring-brand-300 bg-brand-50/50"
      )}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <label className="block text-sm font-medium text-gray-700">
        <Upload className="h-3.5 w-3.5 inline mr-1" />
        {label}
      </label>

      {/* Existing file card */}
      {hasExisting && !newFile && (
        <div className="flex items-center gap-2.5 bg-white border border-gray-200 rounded-lg px-3 py-2 shadow-sm">
          {/* File type icon */}
          <div className={cn("shrink-0 w-9 h-9 rounded-md flex items-center justify-center", typeInfo.bg)}>
            <typeInfo.Icon className={cn("w-4 h-4", typeInfo.text)} />
          </div>

          {/* File info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-slate-800 truncate">{filename}</span>
              <span className={cn(
                "inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold",
                "bg-green-100 text-green-700"
              )}>
                {typeInfo.badge} Attached
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1 shrink-0">
            <a
              href={fileUrl!}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1.5 rounded-md text-slate-400 hover:text-sky-600 hover:bg-sky-50 transition-colors"
              title="Open file"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
            {onRemove && (
              <button
                onClick={onRemove}
                disabled={disabled}
                className="p-1.5 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
                title="Remove file"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* New file selected indicator */}
      {newFile && (
        <div className="flex items-center gap-2.5 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
          <div className="shrink-0 w-9 h-9 rounded-md bg-green-100 flex items-center justify-center">
            <Upload className="w-4 h-4 text-green-600" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-green-800 truncate">{newFile.name}</span>
              <span className="text-[10px] text-green-600 font-medium">
                {(newFile.size / 1024).toFixed(0)} KB
              </span>
            </div>
            <span className="text-xs text-green-600">
              {hasExisting ? 'Will replace existing file' : 'New file ready to upload'}
            </span>
          </div>
          <button
            onClick={() => {
              onFileSelected(null);
              if (inputRef.current) inputRef.current.value = '';
            }}
            className="p-1.5 rounded-md text-green-400 hover:text-red-500 hover:bg-red-50 transition-colors"
            title="Cancel"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* File picker */}
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        onChange={e => onFileSelected(e.target.files?.[0] || null)}
        disabled={disabled}
        className="w-full text-sm text-gray-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-brand-50 file:text-brand-700 hover:file:bg-brand-100 cursor-pointer disabled:opacity-50"
      />
    </div>
  );
}
