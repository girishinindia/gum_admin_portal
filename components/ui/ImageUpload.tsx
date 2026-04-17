"use client";
import { useState, useRef } from 'react';
import { Dialog } from './Dialog';
import { ImageEditor } from './ImageEditor';
import { Upload, X, Edit2, User } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ImageUploadProps {
  label?: string;
  hint?: string;
  value?: string | null;            // existing image URL (for edit mode)
  aspectRatio?: number;              // lock aspect ratio in editor
  maxWidth?: number;                 // max output width
  maxHeight?: number;                // max output height
  shape?: 'rounded' | 'circle';     // preview shape
  placeholder?: React.ReactNode;
  className?: string;
  onChange: (blob: Blob | null, preview: string | null) => void;
}

export function ImageUpload({
  label, hint, value, aspectRatio, maxWidth = 400, maxHeight = 400,
  shape = 'rounded', placeholder, className, onChange,
}: ImageUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [rawFile, setRawFile] = useState<File | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setRawFile(f);
    setFileName(f.name);
    setEditorOpen(true);
    // Reset input so same file can be re-selected
    if (inputRef.current) inputRef.current.value = '';
  }

  function handleEditorSave(blob: Blob, previewUrl: string) {
    setPreview(previewUrl);
    setEditorOpen(false);
    setRawFile(null);
    onChange(blob, previewUrl);
  }

  function handleEditorCancel() {
    setEditorOpen(false);
    setRawFile(null);
  }

  function handleRemove(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setPreview(null);
    setFileName(null);
    onChange(null, null);
  }

  function handleReEdit(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    inputRef.current?.click();
  }

  const hasImage = preview || value;
  const displayUrl = preview || value;
  const isCircle = shape === 'circle';

  return (
    <div className={className}>
      {label && <label className="block text-sm font-medium text-slate-700 mb-1.5">{label}</label>}

      <label className={cn(
        'flex items-center gap-4 p-3 border-2 border-dashed rounded-xl cursor-pointer transition-all',
        'border-slate-200 hover:border-brand-300 hover:bg-brand-50/30',
      )}>
        {/* Preview / Placeholder */}
        <div className={cn(
          'flex items-center justify-center flex-shrink-0 overflow-hidden bg-slate-100 border border-slate-200',
          isCircle ? 'w-16 h-16 rounded-full' : 'w-20 h-14 rounded-lg',
        )}>
          {displayUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={displayUrl} alt="Preview" className="w-full h-full object-cover" />
          ) : (
            placeholder || <Upload className="w-5 h-5 text-slate-400" />
          )}
        </div>

        {/* Text */}
        <div className="flex-1 min-w-0">
          {hasImage ? (
            <>
              <div className="text-sm font-medium text-slate-900 truncate">{fileName || 'Image uploaded'}</div>
              <div className="text-xs text-slate-500 mt-0.5">Click to change · Crop, resize & filter available</div>
            </>
          ) : (
            <>
              <div className="text-sm font-medium text-slate-700 flex items-center gap-1.5">
                <Upload className="w-4 h-4" /> Click to upload image
              </div>
              <div className="text-xs text-slate-500 mt-0.5">
                Crop, resize &amp; filter before upload
              </div>
            </>
          )}
        </div>

        {/* Action buttons */}
        {hasImage && (
          <div className="flex gap-1 flex-shrink-0">
            <button type="button" onClick={handleReEdit} className="p-1.5 rounded-md text-slate-400 hover:text-brand-600 hover:bg-brand-50 transition-colors" title="Replace">
              <Edit2 className="w-4 h-4" />
            </button>
            <button type="button" onClick={handleRemove} className="p-1.5 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors" title="Remove">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleFileSelect} />
      </label>

      {hint && <p className="text-xs text-slate-500 mt-1.5">{hint}</p>}

      {/* Image Editor Dialog */}
      <Dialog
        open={editorOpen}
        onClose={handleEditorCancel}
        title="Edit Image"
        description="Crop, rotate, flip, and adjust before uploading"
        size="xl"
      >
        <div className="p-5">
          {rawFile && (
            <ImageEditor
              file={rawFile}
              aspectRatio={aspectRatio}
              maxWidth={maxWidth}
              maxHeight={maxHeight}
              onSave={handleEditorSave}
              onCancel={handleEditorCancel}
            />
          )}
        </div>
      </Dialog>
    </div>
  );
}
