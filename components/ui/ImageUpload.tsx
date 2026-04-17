"use client";
import { useState, useRef } from 'react';
import { Dialog } from './Dialog';
import { ImageEditor } from './ImageEditor';
import { Upload, X, Edit2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ImageUploadProps {
  label?: string;
  hint?: string;
  value?: string | null;
  aspectRatio?: number;
  maxWidth?: number;
  maxHeight?: number;
  shape?: 'rounded' | 'circle';
  placeholder?: React.ReactNode;
  className?: string;
  onChange: (file: File | null, preview: string | null) => void;
}

// Convert a data URL to a proper File object (most reliable for FormData upload)
function dataUrlToFile(dataUrl: string, fileName: string): File {
  const arr = dataUrl.split(',');
  const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/png';
  const bstr = atob(arr[1]);
  const u8arr = new Uint8Array(bstr.length);
  for (let i = 0; i < bstr.length; i++) u8arr[i] = bstr.charCodeAt(i);
  return new File([u8arr], fileName, { type: mime });
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
    if (inputRef.current) inputRef.current.value = '';
  }

  function handleEditorSave(_blob: Blob, previewDataUrl: string) {
    // Convert data URL → File (most reliable way to ensure multer receives the file)
    const editedFile = dataUrlToFile(previewDataUrl, `edited-${Date.now()}.png`);
    setPreview(previewDataUrl);
    setEditorOpen(false);
    setRawFile(null);
    setFileName(editedFile.name);
    onChange(editedFile, previewDataUrl);
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
              <div className="text-xs text-slate-500 mt-0.5">Crop, resize &amp; filter before upload</div>
            </>
          )}
        </div>

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

      <Dialog open={editorOpen} onClose={handleEditorCancel} title="Edit Image" description="Crop, rotate, flip, and adjust before uploading" size="xl">
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
