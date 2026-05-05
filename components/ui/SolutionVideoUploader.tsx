"use client";
import { useState, useRef, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { toast } from '@/components/ui/Toast';
import { api } from '@/lib/api';
import {
  Plus, Trash2, Edit2, Loader2, Video, ExternalLink, Upload, X, Check, RefreshCw, FileVideo, Image
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface SolutionVideo {
  id: number;
  video: string;
  video_title: string;
  video_short_intro: string;
  video_thumbnail?: string | null;
  display_order: number;
  is_active: boolean;
  [key: string]: any;
}

interface QueuedVideo {
  id: string;
  file: File;
  title: string;
  shortIntro: string;
  status: 'queued' | 'uploading' | 'done' | 'error';
  progress: number;
  error?: string;
  thumbnailUrl?: string;
  thumbnailFile?: File;
}

/** Generate a thumbnail from a video file using canvas */
function generateVideoThumbnail(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true;
    video.playsInline = true;
    const url = URL.createObjectURL(file);
    video.src = url;
    video.onloadeddata = () => {
      video.currentTime = Math.min(1, video.duration * 0.1);
    };
    video.onseeked = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 120;
      canvas.height = 68;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
        URL.revokeObjectURL(url);
        resolve(dataUrl);
      } else {
        URL.revokeObjectURL(url);
        reject(new Error('Canvas not supported'));
      }
    };
    video.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load video'));
    };
  });
}

interface SolutionVideoUploaderProps {
  projectType: 'mini' | 'capstone';
  projectId: number | null;
  solutions: SolutionVideo[];
  onSolutionsChange: (solutions: any[]) => void;
  disabled?: boolean;
}

export function SolutionVideoUploader({
  projectType,
  projectId,
  solutions,
  onSolutionsChange,
  disabled = false,
}: SolutionVideoUploaderProps) {
  const [queue, setQueue] = useState<QueuedVideo[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [editingInlineId, setEditingInlineId] = useState<number | null>(null);
  const [editInlineTitle, setEditInlineTitle] = useState('');
  const [editInlineIntro, setEditInlineIntro] = useState('');
  const [editInlineFile, setEditInlineFile] = useState<File | null>(null);
  const [editInlineThumbnailFile, setEditInlineThumbnailFile] = useState<File | null>(null);
  const [savingInline, setSavingInline] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const replaceFileInputRef = useRef<HTMLInputElement>(null);
  const thumbnailInputRef = useRef<HTMLInputElement>(null);
  const editThumbnailInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);

  // ── Add files to queue (shared by input and drag-drop) ──
  const addVideosToQueue = useCallback((files: File[]) => {
    if (files.length === 0) return;

    const newItems: QueuedVideo[] = files.map(f => ({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      file: f,
      title: f.name.replace(/\.[^/.]+$/, ''),
      shortIntro: '',
      status: 'queued',
      progress: 0,
    }));

    setQueue(prev => [...prev, ...newItems]);

    // Generate thumbnails in background
    newItems.forEach(item => {
      generateVideoThumbnail(item.file)
        .then(thumbUrl => {
          setQueue(prev => prev.map(q => q.id === item.id ? { ...q, thumbnailUrl: thumbUrl } : q));
        })
        .catch(() => {});
    });
  }, []);

  const handleFilesSelected = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    addVideosToQueue(files);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [addVideosToQueue]);

  // ── Drag & Drop handlers ──
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled && !isUploading) setIsDragOver(true);
  }, [disabled, isUploading]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Only set false if leaving the drop zone entirely
    if (dropZoneRef.current && !dropZoneRef.current.contains(e.relatedTarget as Node)) {
      setIsDragOver(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    if (disabled || isUploading) return;

    const droppedFiles = Array.from(e.dataTransfer.files);
    const videoFiles = droppedFiles.filter(f => f.type.startsWith('video/'));
    const imageFiles = droppedFiles.filter(f => f.type.startsWith('image/'));

    // If only images dropped and there are queued items, attach as thumbnails to last queued item
    if (imageFiles.length > 0 && videoFiles.length === 0) {
      const queuedItems = queue.filter(q => q.status === 'queued');
      if (queuedItems.length > 0) {
        // Attach first image as thumbnail to last queued item
        const lastQueued = queuedItems[queuedItems.length - 1];
        const imgFile = imageFiles[0];
        const url = URL.createObjectURL(imgFile);
        setQueue(prev => prev.map(q => q.id === lastQueued.id ? { ...q, thumbnailFile: imgFile, thumbnailUrl: url } : q));
        toast.success(`Thumbnail attached to "${lastQueued.title}"`);
      } else if (editingInlineId) {
        // If in edit mode, set thumbnail for editing item
        setEditInlineThumbnailFile(imageFiles[0]);
        toast.success('Thumbnail selected for editing');
      } else {
        toast.info('Drop video files to add to queue, or drop images on a queued video for thumbnails');
      }
      return;
    }

    // Add video files to queue
    if (videoFiles.length > 0) {
      addVideosToQueue(videoFiles);
      toast.success(`${videoFiles.length} video${videoFiles.length > 1 ? 's' : ''} added to queue`);
    }

    // If both video and image files were dropped, ignore images (videos take priority)
    if (videoFiles.length === 0 && imageFiles.length === 0) {
      toast.error('Please drop video or image files');
    }
  }, [disabled, isUploading, queue, editingInlineId, addVideosToQueue]);

  // ── Update title in queue ──
  const updateQueueTitle = (id: string, title: string) => {
    setQueue(prev => prev.map(q => q.id === id ? { ...q, title } : q));
  };

  // ── Remove from queue ──
  const removeFromQueue = (id: string) => {
    setQueue(prev => prev.filter(q => q.id !== id));
  };

  // ── Upload all queued videos ──
  const uploadAll = async () => {
    if (!projectId) {
      toast.error('Please save the project first before uploading videos');
      return;
    }

    const pendingItems = queue.filter(q => q.status === 'queued');
    if (pendingItems.length === 0) {
      toast.info('No videos to upload');
      return;
    }

    setIsUploading(true);

    for (const item of pendingItems) {
      setQueue(prev => prev.map(q => q.id === item.id ? { ...q, status: 'uploading', progress: 30 } : q));

      try {
        const titles = [item.title];
        const files = [item.file];

        let result: any;
        if (projectType === 'mini') {
          result = await api.bulkUploadMiniProjectSolutions(projectId, files, titles, item.shortIntro || undefined);
        } else {
          result = await api.bulkUploadCapstoneProjectSolutions(projectId, files, titles, item.shortIntro || undefined);
        }

        if (result.success || result.data?.uploaded?.length > 0) {
          setQueue(prev => prev.map(q => q.id === item.id ? { ...q, status: 'done', progress: 100 } : q));
        } else {
          const errMsg = result.data?.errors?.[0] || result.error || 'Upload failed';
          setQueue(prev => prev.map(q => q.id === item.id ? { ...q, status: 'error', error: errMsg } : q));
        }
      } catch (e: any) {
        setQueue(prev => prev.map(q => q.id === item.id ? { ...q, status: 'error', error: e.message || 'Upload failed' } : q));
      }
    }

    setIsUploading(false);
    await refreshSolutions();

    setTimeout(() => {
      setQueue(prev => prev.filter(q => q.status !== 'done'));
    }, 2000);
  };

  // ── Refresh solutions from server ──
  const refreshSolutions = async () => {
    if (!projectId) return;
    try {
      let r: any;
      if (projectType === 'mini') {
        r = await api.listMiniProjectSolutions(`?mini_project_id=${projectId}&limit=50`);
      } else {
        r = await api.listCapstoneProjectSolutions(`?capstone_project_id=${projectId}&limit=50`);
      }
      if (r.success) onSolutionsChange(r.data || []);
    } catch {}
  };

  // ── Delete a saved solution ──
  const deleteSolution = async (id: number) => {
    if (!confirm('Permanently delete this solution video?')) return;
    let r: any;
    if (projectType === 'mini') {
      r = await api.deleteMiniProjectSolution(id);
    } else {
      r = await api.deleteCapstoneProjectSolution(id);
    }
    if (r.success) {
      toast.success('Deleted');
      onSolutionsChange(solutions.filter(s => s.id !== id));
    } else {
      toast.error(r.error || 'Delete failed');
    }
  };

  // ── Inline edit a saved solution ──
  const startInlineEdit = (s: SolutionVideo) => {
    setEditingInlineId(s.id);
    setEditInlineTitle(s.video_title || '');
    setEditInlineIntro(s.video_short_intro || '');
    setEditInlineFile(null);
    setEditInlineThumbnailFile(null);
  };

  const handleReplaceFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setEditInlineFile(file);
    if (replaceFileInputRef.current) replaceFileInputRef.current.value = '';
  };

  const handleEditThumbnailSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setEditInlineThumbnailFile(file);
    if (editThumbnailInputRef.current) editThumbnailInputRef.current.value = '';
  };

  const saveInlineEdit = async () => {
    if (!editingInlineId) return;
    setSavingInline(true);
    try {
      const data: any = { video_title: editInlineTitle, video_short_intro: editInlineIntro };
      let r: any;
      if (projectType === 'mini') {
        r = await api.updateMiniProjectSolution(editingInlineId, data, editInlineFile || undefined, editInlineThumbnailFile || undefined);
      } else {
        r = await api.updateCapstoneProjectSolution(editingInlineId, data, editInlineFile || undefined, editInlineThumbnailFile || undefined);
      }
      if (r.success) {
        toast.success(editInlineFile ? 'Video replaced & updated' : 'Updated');
        await refreshSolutions();
        setEditingInlineId(null);
        setEditInlineFile(null);
        setEditInlineThumbnailFile(null);
      } else {
        toast.error(r.error || 'Update failed');
      }
    } finally {
      setSavingInline(false);
    }
  };

  const pendingCount = queue.filter(q => q.status === 'queued').length;

  return (
    <div
      ref={dropZoneRef}
      className={cn(
        "border rounded-lg p-4 bg-gray-50 relative transition-colors",
        isDragOver && "border-brand-400 bg-brand-50/50 ring-2 ring-brand-200"
      )}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Drag overlay */}
      {isDragOver && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-brand-50/80 border-2 border-dashed border-brand-400 rounded-lg pointer-events-none">
          <div className="text-center">
            <Upload className="w-8 h-8 text-brand-500 mx-auto mb-1" />
            <p className="text-sm font-medium text-brand-700">Drop videos or thumbnail images here</p>
            <p className="text-xs text-brand-500 mt-0.5">Videos → add to queue · Images → set as thumbnail</p>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
          <Video className="h-4 w-4" />
          Solution Videos ({solutions.length})
        </h4>
        <div className="flex items-center gap-2">
          {pendingCount > 0 && (
            <Button
              size="sm"
              onClick={uploadAll}
              disabled={disabled || isUploading || !projectId}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              {isUploading ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Upload className="w-3.5 h-3.5 mr-1" />}
              Upload {pendingCount} Video{pendingCount > 1 ? 's' : ''}
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled || isUploading}
          >
            <Plus className="w-3.5 h-3.5 mr-1" /> Add Videos
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept="video/*"
            multiple
            onChange={handleFilesSelected}
            className="hidden"
          />
        </div>
      </div>

      {!projectId && (
        <p className="text-xs text-amber-600 mb-3 flex items-center gap-1">
          <Upload className="h-3 w-3" /> Save the project first, then you can upload solution videos.
        </p>
      )}

      {/* ── Upload Queue ── */}
      {queue.length > 0 && (
        <div className="mb-4 space-y-2">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Upload Queue</p>
          {queue.map(item => (
            <div key={item.id} className={cn(
              "flex items-start gap-3 bg-white border rounded-md px-3 py-2.5 text-sm",
              item.status === 'done' && "bg-green-50 border-green-200",
              item.status === 'error' && "bg-red-50 border-red-200",
              item.status === 'uploading' && "bg-blue-50 border-blue-200",
            )}>
              {/* Video Thumbnail — clickable or drag-drop to upload custom thumbnail */}
              <div className="shrink-0">
                <div
                  className={cn(
                    "w-16 h-10 rounded overflow-hidden bg-gray-200 flex items-center justify-center relative group",
                    item.status === 'queued' && "cursor-pointer hover:ring-2 hover:ring-brand-300"
                  )}
                  onClick={() => {
                    if (item.status === 'queued') {
                      const input = document.createElement('input');
                      input.type = 'file';
                      input.accept = 'image/*';
                      input.onchange = (e: any) => {
                        const f = e.target.files?.[0];
                        if (f) {
                          const url = URL.createObjectURL(f);
                          setQueue(prev => prev.map(q => q.id === item.id ? { ...q, thumbnailFile: f, thumbnailUrl: url } : q));
                        }
                      };
                      input.click();
                    }
                  }}
                  onDragOver={(e) => { if (item.status === 'queued') { e.preventDefault(); e.stopPropagation(); } }}
                  onDrop={(e) => {
                    if (item.status !== 'queued') return;
                    e.preventDefault();
                    e.stopPropagation();
                    setIsDragOver(false);
                    const files = Array.from(e.dataTransfer.files);
                    const img = files.find(f => f.type.startsWith('image/'));
                    if (img) {
                      const url = URL.createObjectURL(img);
                      setQueue(prev => prev.map(q => q.id === item.id ? { ...q, thumbnailFile: img, thumbnailUrl: url } : q));
                    }
                  }}
                  title={item.status === 'queued' ? 'Click or drop image for custom thumbnail' : undefined}
                >
                  {item.thumbnailUrl ? (
                    <img src={item.thumbnailUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <Video className="w-5 h-5 text-gray-400" />
                  )}
                  {item.status === 'queued' && (
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 flex items-center justify-center transition-colors">
                      <Image className="w-3.5 h-3.5 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  )}
                </div>
                {item.thumbnailFile && item.status === 'queued' && (
                  <button
                    onClick={() => setQueue(prev => prev.map(q => q.id === item.id ? { ...q, thumbnailFile: undefined, thumbnailUrl: undefined } : q))}
                    className="text-[10px] text-red-500 hover:text-red-700 mt-0.5 block w-full text-center"
                  >
                    Remove
                  </button>
                )}
              </div>

              <div className="flex-1 min-w-0">
                {item.status === 'queued' ? (
                  <div className="space-y-1.5">
                    <Input
                      value={item.title}
                      onChange={e => updateQueueTitle(item.id, e.target.value)}
                      placeholder="Video title *"
                      className="h-7 text-sm"
                    />
                    <Input
                      value={item.shortIntro}
                      onChange={e => setQueue(prev => prev.map(q => q.id === item.id ? { ...q, shortIntro: e.target.value } : q))}
                      placeholder="Short intro (optional)"
                      className="h-7 text-sm"
                    />
                  </div>
                ) : (
                  <div>
                    <span className="font-medium text-slate-800 truncate block">{item.title}</span>
                    {item.shortIntro && <span className="text-xs text-gray-500 truncate block">{item.shortIntro}</span>}
                  </div>
                )}
                <span className="text-xs text-gray-400 mt-0.5 block">{item.file.name} · {(item.file.size / (1024 * 1024)).toFixed(1)} MB</span>
              </div>

              <div className="flex items-center gap-1.5 shrink-0 mt-1">
                {item.status === 'uploading' && (
                  <div className="flex items-center gap-1.5">
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-500" />
                    <span className="text-xs text-blue-600">Uploading...</span>
                  </div>
                )}
                {item.status === 'done' && (
                  <span className="text-xs text-green-600 flex items-center gap-0.5">
                    <Check className="h-3.5 w-3.5" /> Done
                  </span>
                )}
                {item.status === 'error' && (
                  <span className="text-xs text-red-600 truncate max-w-[150px]" title={item.error}>
                    {item.error}
                  </span>
                )}
                {item.status === 'queued' && (
                  <button onClick={() => removeFromQueue(item.id)} className="p-1.5 rounded-md text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors" title="Remove from queue">
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Existing Solutions List ── */}
      {solutions.length === 0 && queue.length === 0 ? (
        <div className="text-center py-4 border-2 border-dashed border-gray-200 rounded-lg">
          <Video className="w-8 h-8 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-400">No solution videos yet.</p>
          <p className="text-xs text-gray-400 mt-1">Click &quot;Add Videos&quot; or drag &amp; drop video files here</p>
        </div>
      ) : solutions.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Saved Videos</p>
          {solutions.map(s => (
            <div key={s.id} className="flex items-center gap-3 bg-white border rounded-md px-3 py-2 text-sm">
              {editingInlineId === s.id ? (
                /* ── EDIT MODE ── */
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2">
                    <Input
                      value={editInlineTitle}
                      onChange={e => setEditInlineTitle(e.target.value)}
                      placeholder="Title"
                      className="h-7 text-sm flex-1"
                    />
                    <Input
                      value={editInlineIntro}
                      onChange={e => setEditInlineIntro(e.target.value)}
                      placeholder="Short intro"
                      className="h-7 text-sm flex-1"
                    />
                  </div>
                  {/* Replace video file */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      onClick={() => replaceFileInputRef.current?.click()}
                      className="flex items-center gap-1.5 px-2 py-1 text-xs font-medium rounded-md border border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100 transition-colors"
                    >
                      <RefreshCw className="w-3 h-3" />
                      {editInlineFile ? 'Change File' : 'Replace Video'}
                    </button>
                    {editInlineFile && (
                      <span className="text-xs text-amber-600 flex items-center gap-1">
                        <FileVideo className="w-3 h-3" />
                        {editInlineFile.name} ({(editInlineFile.size / (1024 * 1024)).toFixed(1)} MB)
                        <button onClick={() => setEditInlineFile(null)} className="ml-1 text-red-400 hover:text-red-600">
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    )}
                    {!editInlineFile && s.video && (
                      <span className="text-xs text-gray-400">Old video will be deleted if you replace</span>
                    )}
                    <input
                      ref={replaceFileInputRef}
                      type="file"
                      accept="video/*"
                      onChange={handleReplaceFileSelected}
                      className="hidden"
                    />
                  </div>
                  {/* Update thumbnail */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      onClick={() => editThumbnailInputRef.current?.click()}
                      className="flex items-center gap-1.5 px-2 py-1 text-xs font-medium rounded-md border border-purple-300 bg-purple-50 text-purple-700 hover:bg-purple-100 transition-colors"
                    >
                      <Image className="w-3 h-3" />
                      {editInlineThumbnailFile ? 'Change Thumbnail' : s.video_thumbnail ? 'Replace Thumbnail' : 'Upload Thumbnail'}
                    </button>
                    {editInlineThumbnailFile && (
                      <span className="text-xs text-purple-600 flex items-center gap-1">
                        <Image className="w-3 h-3" />
                        {editInlineThumbnailFile.name}
                        <button onClick={() => setEditInlineThumbnailFile(null)} className="ml-1 text-red-400 hover:text-red-600">
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    )}
                    {!editInlineThumbnailFile && s.video_thumbnail && (
                      <span className="text-xs text-gray-400 flex items-center gap-1">
                        <img src={s.video_thumbnail} alt="" className="w-8 h-5 rounded object-cover border" />
                        Current thumbnail
                      </span>
                    )}
                    <input
                      ref={editThumbnailInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleEditThumbnailSelected}
                      className="hidden"
                    />
                  </div>
                  {/* Save / Cancel */}
                  <div className="flex items-center gap-2">
                    <button onClick={saveInlineEdit} disabled={savingInline} className="flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-green-600 text-white hover:bg-green-700 disabled:opacity-50">
                      {savingInline ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                      {savingInline ? (editInlineFile ? 'Replacing...' : 'Saving...') : 'Save'}
                    </button>
                    <button onClick={() => { setEditingInlineId(null); setEditInlineFile(null); setEditInlineThumbnailFile(null); }} className="px-2.5 py-1 rounded-md text-xs font-medium text-gray-500 hover:bg-gray-100">
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                /* ── VIEW MODE ── */
                <>
                  {/* Thumbnail */}
                  <div className="shrink-0 w-12 h-9 rounded overflow-hidden bg-gray-200 flex items-center justify-center">
                    {s.video_thumbnail ? (
                      <img src={s.video_thumbnail} alt="" className="w-full h-full object-cover" />
                    ) : s.video ? (
                      <Video className="w-4 h-4 text-gray-400" />
                    ) : (
                      <FileVideo className="w-4 h-4 text-gray-300" />
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-slate-800 truncate">{s.video_title || '(untitled)'}</span>
                      {s.video && (
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-green-100 text-green-700">
                          <Video className="w-2.5 h-2.5" /> Attached
                        </span>
                      )}
                      {!s.video && (
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-gray-100 text-gray-500">
                          No Video
                        </span>
                      )}
                    </div>
                    {s.video_short_intro && <span className="text-xs text-slate-500 block truncate">{s.video_short_intro}</span>}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 shrink-0">
                    {s.video && (
                      <a href={s.video} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded-md text-slate-400 hover:text-sky-600 hover:bg-sky-50 transition-colors" title="Open video">
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    )}
                    <button onClick={() => startInlineEdit(s)} className="p-1.5 rounded-md text-slate-400 hover:text-brand-600 hover:bg-brand-50 transition-colors" title="Edit / Replace Video">
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => deleteSolution(s.id)} className="p-1.5 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors" title="Delete">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
