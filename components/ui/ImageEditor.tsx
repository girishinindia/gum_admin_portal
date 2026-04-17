"use client";
import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from './Button';
import { Crop, RotateCcw, ZoomIn, ZoomOut, Sun, Contrast, Droplets, Check, X, FlipHorizontal, FlipVertical } from 'lucide-react';

interface ImageEditorProps {
  file: File;
  aspectRatio?: number;       // e.g. 4/3 for flags, 1 for avatars. undefined = freeform
  maxWidth?: number;          // max output width
  maxHeight?: number;         // max output height
  outputFormat?: 'webp' | 'png' | 'jpeg';
  onSave: (blob: Blob, preview: string) => void;
  onCancel: () => void;
}

interface CropBox { x: number; y: number; w: number; h: number }
interface Filters { brightness: number; contrast: number; saturate: number; rotate: number; flipH: boolean; flipV: boolean }

const DEFAULT_FILTERS: Filters = { brightness: 100, contrast: 100, saturate: 100, rotate: 0, flipH: false, flipV: false };

export function ImageEditor({ file, aspectRatio, maxWidth = 800, maxHeight = 800, outputFormat = 'webp', onSave, onCancel }: ImageEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [filters, setFilters] = useState<Filters>({ ...DEFAULT_FILTERS });
  const [crop, setCrop] = useState<CropBox | null>(null);
  const [cropping, setCropping] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [scale, setScale] = useState(1);
  const [tab, setTab] = useState<'crop' | 'adjust'>('crop');

  // Load image
  useEffect(() => {
    const image = new Image();
    image.onload = () => {
      setImg(image);
      // Default crop = full image
      setCrop({ x: 0, y: 0, w: image.width, h: image.height });
    };
    image.src = URL.createObjectURL(file);
    return () => URL.revokeObjectURL(image.src);
  }, [file]);

  // Calculate display dimensions
  const getDisplayDims = useCallback(() => {
    if (!img) return { dw: 400, dh: 300, scale: 1 };
    const maxCanvasW = Math.min(560, window.innerWidth - 80);
    const maxCanvasH = 380;
    const s = Math.min(maxCanvasW / img.width, maxCanvasH / img.height, 1);
    return { dw: img.width * s, dh: img.height * s, scale: s };
  }, [img]);

  // Render preview
  useEffect(() => {
    if (!img || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const { dw, dh, scale: s } = getDisplayDims();
    setScale(s);
    canvas.width = dw;
    canvas.height = dh;
    const ctx = canvas.getContext('2d')!;

    ctx.clearRect(0, 0, dw, dh);
    ctx.save();

    // Apply CSS-like filters
    ctx.filter = `brightness(${filters.brightness}%) contrast(${filters.contrast}%) saturate(${filters.saturate}%)`;

    // Apply transforms
    ctx.translate(dw / 2, dh / 2);
    ctx.rotate((filters.rotate * Math.PI) / 180);
    ctx.scale(filters.flipH ? -1 : 1, filters.flipV ? -1 : 1);
    ctx.translate(-dw / 2, -dh / 2);

    ctx.drawImage(img, 0, 0, dw, dh);
    ctx.restore();

    // Draw crop overlay
    if (crop && cropping) {
      const cx = crop.x * s, cy = crop.y * s, cw = crop.w * s, ch = crop.h * s;
      // Dim outside crop
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(0, 0, dw, cy);
      ctx.fillRect(0, cy, cx, ch);
      ctx.fillRect(cx + cw, cy, dw - cx - cw, ch);
      ctx.fillRect(0, cy + ch, dw, dh - cy - ch);
      // Crop border
      ctx.strokeStyle = '#0ea5e9';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 3]);
      ctx.strokeRect(cx, cy, cw, ch);
      ctx.setLineDash([]);
      // Corner handles
      const hs = 8;
      ctx.fillStyle = '#0ea5e9';
      for (const [hx, hy] of [[cx, cy], [cx + cw, cy], [cx, cy + ch], [cx + cw, cy + ch]]) {
        ctx.fillRect(hx - hs / 2, hy - hs / 2, hs, hs);
      }
    }
  }, [img, filters, crop, cropping, getDisplayDims]);

  // Mouse handlers for crop
  function handleMouseDown(e: React.MouseEvent) {
    if (!cropping || !img) return;
    const rect = canvasRef.current!.getBoundingClientRect();
    setDragStart({ x: (e.clientX - rect.left) / scale, y: (e.clientY - rect.top) / scale });
  }

  function handleMouseMove(e: React.MouseEvent) {
    if (!dragStart || !cropping || !img) return;
    const rect = canvasRef.current!.getBoundingClientRect();
    const mx = (e.clientX - rect.left) / scale;
    const my = (e.clientY - rect.top) / scale;
    let w = Math.max(20, mx - dragStart.x);
    let h = Math.max(20, my - dragStart.y);
    if (aspectRatio) h = w / aspectRatio;
    // Clamp
    w = Math.min(w, img.width - dragStart.x);
    h = Math.min(h, img.height - dragStart.y);
    if (aspectRatio) w = h * aspectRatio;
    setCrop({ x: Math.max(0, dragStart.x), y: Math.max(0, dragStart.y), w, h });
  }

  function handleMouseUp() { setDragStart(null); }

  // Center crop with aspect ratio
  function centerCrop() {
    if (!img) return;
    let w = img.width, h = img.height;
    if (aspectRatio) {
      if (w / h > aspectRatio) w = h * aspectRatio;
      else h = w / aspectRatio;
    }
    setCrop({ x: (img.width - w) / 2, y: (img.height - h) / 2, w, h });
  }

  // Export
  function handleSave() {
    if (!img) return;
    const offscreen = document.createElement('canvas');
    const c = crop || { x: 0, y: 0, w: img.width, h: img.height };
    let outW = c.w, outH = c.h;
    if (outW > maxWidth) { outH *= maxWidth / outW; outW = maxWidth; }
    if (outH > maxHeight) { outW *= maxHeight / outH; outH = maxHeight; }
    offscreen.width = Math.round(outW);
    offscreen.height = Math.round(outH);
    const ctx = offscreen.getContext('2d')!;

    ctx.filter = `brightness(${filters.brightness}%) contrast(${filters.contrast}%) saturate(${filters.saturate}%)`;
    ctx.save();
    ctx.translate(outW / 2, outH / 2);
    ctx.rotate((filters.rotate * Math.PI) / 180);
    ctx.scale(filters.flipH ? -1 : 1, filters.flipV ? -1 : 1);
    ctx.translate(-outW / 2, -outH / 2);
    ctx.drawImage(img, c.x, c.y, c.w, c.h, 0, 0, outW, outH);
    ctx.restore();

    const mime = outputFormat === 'png' ? 'image/png' : outputFormat === 'jpeg' ? 'image/jpeg' : 'image/webp';
    offscreen.toBlob(blob => {
      if (blob) onSave(blob, offscreen.toDataURL(mime, 0.9));
    }, mime, 0.9);
  }

  function resetFilters() { setFilters({ ...DEFAULT_FILTERS }); }

  if (!img) return <div className="p-12 text-center text-slate-500">Loading image...</div>;

  const sliders: { key: keyof Filters; label: string; icon: any; min: number; max: number; step: number }[] = [
    { key: 'brightness', label: 'Brightness', icon: Sun, min: 20, max: 200, step: 5 },
    { key: 'contrast', label: 'Contrast', icon: Contrast, min: 20, max: 200, step: 5 },
    { key: 'saturate', label: 'Saturation', icon: Droplets, min: 0, max: 200, step: 5 },
  ];

  return (
    <div className="space-y-4">
      {/* Canvas */}
      <div className="flex justify-center bg-slate-900/5 rounded-xl p-3 border border-slate-200">
        <canvas
          ref={canvasRef}
          className="rounded-lg cursor-crosshair max-w-full"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        />
      </div>

      {/* Tab buttons */}
      <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
        <button onClick={() => setTab('crop')} className={`flex-1 py-2 text-xs font-semibold rounded-md transition-colors ${tab === 'crop' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}>
          <Crop className="w-3.5 h-3.5 inline mr-1.5" />Crop &amp; Transform
        </button>
        <button onClick={() => setTab('adjust')} className={`flex-1 py-2 text-xs font-semibold rounded-md transition-colors ${tab === 'adjust' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}>
          <Sun className="w-3.5 h-3.5 inline mr-1.5" />Adjust
        </button>
      </div>

      {tab === 'crop' && (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant={cropping ? 'primary' : 'outline'} onClick={() => { setCropping(!cropping); if (!cropping) centerCrop(); }}>
              <Crop className="w-3.5 h-3.5" /> {cropping ? 'Drawing crop...' : 'Start crop'}
            </Button>
            {cropping && (
              <Button size="sm" variant="outline" onClick={centerCrop}>Center crop</Button>
            )}
            <Button size="sm" variant="outline" onClick={() => setFilters(f => ({ ...f, rotate: (f.rotate + 90) % 360 }))}>
              <RotateCcw className="w-3.5 h-3.5" /> Rotate
            </Button>
            <Button size="sm" variant="outline" onClick={() => setFilters(f => ({ ...f, flipH: !f.flipH }))}>
              <FlipHorizontal className="w-3.5 h-3.5" /> Flip H
            </Button>
            <Button size="sm" variant="outline" onClick={() => setFilters(f => ({ ...f, flipV: !f.flipV }))}>
              <FlipVertical className="w-3.5 h-3.5" /> Flip V
            </Button>
          </div>
          {crop && (
            <div className="text-xs text-slate-500">
              Crop: {Math.round(crop.w)} × {Math.round(crop.h)}px
              {aspectRatio && <span className="ml-2 text-brand-600">Aspect ratio locked ({aspectRatio > 1 ? `${aspectRatio}:1` : `1:${1/aspectRatio}`})</span>}
            </div>
          )}
        </div>
      )}

      {tab === 'adjust' && (
        <div className="space-y-3">
          {sliders.map(({ key, label, icon: Icon, min, max, step }) => (
            <div key={key} className="flex items-center gap-3">
              <Icon className="w-4 h-4 text-slate-500 flex-shrink-0" />
              <label className="text-xs font-medium text-slate-700 w-20">{label}</label>
              <input
                type="range" min={min} max={max} step={step}
                value={filters[key] as number}
                onChange={e => setFilters(f => ({ ...f, [key]: Number(e.target.value) }))}
                className="flex-1 h-1.5 appearance-none bg-slate-200 rounded-full accent-brand-500 cursor-pointer"
              />
              <span className="text-xs text-slate-500 w-10 text-right font-mono">{filters[key] as number}%</span>
            </div>
          ))}
          <Button size="sm" variant="outline" onClick={resetFilters}>
            <RotateCcw className="w-3.5 h-3.5" /> Reset all
          </Button>
        </div>
      )}

      {/* Output info */}
      <div className="bg-slate-50 rounded-lg px-3 py-2 text-xs text-slate-600 flex items-center justify-between">
        <span>Original: {img.width}×{img.height}px · {(file.size / 1024).toFixed(1)}KB</span>
        <span>Output: max {maxWidth}×{maxHeight}px · {outputFormat.toUpperCase()}</span>
      </div>

      {/* Actions */}
      <div className="flex gap-2 justify-end">
        <Button variant="outline" onClick={onCancel}><X className="w-4 h-4" /> Cancel</Button>
        <Button onClick={handleSave}><Check className="w-4 h-4" /> Apply &amp; Use</Button>
      </div>
    </div>
  );
}
