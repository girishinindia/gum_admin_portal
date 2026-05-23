"use client";
import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from './Button';
import { Crop, RotateCcw, ZoomIn, ZoomOut, Sun, Contrast, Droplets, Check, X, FlipHorizontal, FlipVertical, Maximize } from 'lucide-react';

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

type DragMode = 'none' | 'move-crop' | 'draw-new' | 'pan'
  | 'resize-tl' | 'resize-tr' | 'resize-bl' | 'resize-br'
  | 'resize-t' | 'resize-b' | 'resize-l' | 'resize-r';

const DEFAULT_FILTERS: Filters = { brightness: 100, contrast: 100, saturate: 100, rotate: 0, flipH: false, flipV: false };
const HANDLE_HIT = 12;   // corner hit-test radius (display px)
const EDGE_HIT = 8;      // edge hit-test radius (display px)

export function ImageEditor({ file, aspectRatio, maxWidth = 800, maxHeight = 800, outputFormat = 'webp', onSave, onCancel }: ImageEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [filters, setFilters] = useState<Filters>({ ...DEFAULT_FILTERS });
  const [crop, setCrop] = useState<CropBox | null>(null);
  const [cropping, setCropping] = useState(false);
  const [tab, setTab] = useState<'crop' | 'adjust'>('crop');

  // Zoom & pan (zoom 1 = fit-to-canvas, panOffset in display-px)
  const [zoom, setZoom] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });

  // Drag tracking via refs (avoids re-render lag on every mousemove)
  const dragModeRef = useRef<DragMode>('none');
  const dragStartRef = useRef({
    mx: 0, my: 0,
    cropSnap: { x: 0, y: 0, w: 0, h: 0 },
    panSnap: { x: 0, y: 0 },
  });
  const [cursorStyle, setCursorStyle] = useState('default');

  /* ─── Load image ─── */
  useEffect(() => {
    const image = new Image();
    image.onload = () => {
      setImg(image);
      setCrop({ x: 0, y: 0, w: image.width, h: image.height });
    };
    image.src = URL.createObjectURL(file);
    return () => URL.revokeObjectURL(image.src);
  }, [file]);

  /* ─── Canvas / scale helpers ─── */
  const getCanvasDims = useCallback(() => {
    if (!img) return { cw: 400, ch: 300, baseScale: 1 };
    const maxCW = Math.min(560, window.innerWidth - 80);
    const maxCH = 380;
    const bs = Math.min(maxCW / img.width, maxCH / img.height, 1);
    return { cw: Math.round(img.width * bs), ch: Math.round(img.height * bs), baseScale: bs };
  }, [img]);

  /** Image-space → display-space */
  const i2d = useCallback((ix: number, iy: number) => {
    if (!img) return { dx: 0, dy: 0 };
    const { cw, ch, baseScale } = getCanvasDims();
    const es = baseScale * zoom;
    const drawW = img.width * es, drawH = img.height * es;
    const ox = panOffset.x + (cw - drawW) / 2;
    const oy = panOffset.y + (ch - drawH) / 2;
    return { dx: ix * es + ox, dy: iy * es + oy };
  }, [img, zoom, panOffset, getCanvasDims]);

  /** Display-space → image-space */
  const d2i = useCallback((dx: number, dy: number) => {
    if (!img) return { ix: 0, iy: 0 };
    const { cw, ch, baseScale } = getCanvasDims();
    const es = baseScale * zoom;
    const drawW = img.width * es, drawH = img.height * es;
    const ox = panOffset.x + (cw - drawW) / 2;
    const oy = panOffset.y + (ch - drawH) / 2;
    return { ix: (dx - ox) / es, iy: (dy - oy) / es };
  }, [img, zoom, panOffset, getCanvasDims]);

  /* ─── Render preview ─── */
  useEffect(() => {
    if (!img || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const { cw, ch, baseScale } = getCanvasDims();
    canvas.width = cw;
    canvas.height = ch;
    const ctx = canvas.getContext('2d')!;
    const es = baseScale * zoom;
    const drawW = img.width * es, drawH = img.height * es;
    const ox = panOffset.x + (cw - drawW) / 2;
    const oy = panOffset.y + (ch - drawH) / 2;

    // Checkerboard background (signals transparency)
    ctx.fillStyle = '#f1f5f9';
    ctx.fillRect(0, 0, cw, ch);

    ctx.save();
    ctx.filter = `brightness(${filters.brightness}%) contrast(${filters.contrast}%) saturate(${filters.saturate}%)`;

    // Rotation + flip around the drawn-image center
    const cx = ox + drawW / 2, cy = oy + drawH / 2;
    ctx.translate(cx, cy);
    ctx.rotate((filters.rotate * Math.PI) / 180);
    ctx.scale(filters.flipH ? -1 : 1, filters.flipV ? -1 : 1);
    ctx.translate(-cx, -cy);

    ctx.drawImage(img, ox, oy, drawW, drawH);
    ctx.restore();

    // Crop overlay
    if (crop && cropping) {
      const tl = i2d(crop.x, crop.y);
      const br = i2d(crop.x + crop.w, crop.y + crop.h);
      const rcx = tl.dx, rcy = tl.dy, rcw = br.dx - tl.dx, rch = br.dy - tl.dy;

      // Dim outside crop
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.fillRect(0, 0, cw, rcy);
      ctx.fillRect(0, rcy, rcx, rch);
      ctx.fillRect(rcx + rcw, rcy, cw - rcx - rcw, rch);
      ctx.fillRect(0, rcy + rch, cw, ch - rcy - rch);

      // Crop border
      ctx.strokeStyle = '#0ea5e9';
      ctx.lineWidth = 2;
      ctx.strokeRect(rcx, rcy, rcw, rch);

      // Rule-of-thirds grid
      ctx.strokeStyle = 'rgba(255,255,255,0.3)';
      ctx.lineWidth = 0.5;
      for (let i = 1; i <= 2; i++) {
        ctx.beginPath();
        ctx.moveTo(rcx + (rcw * i) / 3, rcy);
        ctx.lineTo(rcx + (rcw * i) / 3, rcy + rch);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(rcx, rcy + (rch * i) / 3);
        ctx.lineTo(rcx + rcw, rcy + (rch * i) / 3);
        ctx.stroke();
      }

      // Corner handles (large, with white border for visibility)
      const hs = 10;
      ctx.fillStyle = '#0ea5e9';
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      const corners = [[rcx, rcy], [rcx + rcw, rcy], [rcx, rcy + rch], [rcx + rcw, rcy + rch]];
      for (const [hx, hy] of corners) {
        ctx.fillRect(hx - hs / 2, hy - hs / 2, hs, hs);
        ctx.strokeRect(hx - hs / 2, hy - hs / 2, hs, hs);
      }

      // Edge midpoint handles (smaller)
      if (!aspectRatio) {
        const ehs = 6;
        ctx.fillStyle = '#0ea5e9';
        ctx.lineWidth = 1;
        const edges = [
          [rcx + rcw / 2, rcy],         // top
          [rcx + rcw / 2, rcy + rch],   // bottom
          [rcx, rcy + rch / 2],         // left
          [rcx + rcw, rcy + rch / 2],   // right
        ];
        for (const [hx, hy] of edges) {
          ctx.fillRect(hx - ehs / 2, hy - ehs / 2, ehs, ehs);
          ctx.strokeRect(hx - ehs / 2, hy - ehs / 2, ehs, ehs);
        }
      }
    }
  }, [img, filters, crop, cropping, zoom, panOffset, getCanvasDims, i2d]);

  /* ─── Hit detection ─── */
  function hitTest(dx: number, dy: number): DragMode {
    if (!crop || !cropping || !img) return 'pan';
    const tl = i2d(crop.x, crop.y);
    const br = i2d(crop.x + crop.w, crop.y + crop.h);
    const cx = tl.dx, cy = tl.dy, cw = br.dx - tl.dx, ch = br.dy - tl.dy;

    // Corner handles (checked first — highest priority)
    if (Math.abs(dx - cx) <= HANDLE_HIT && Math.abs(dy - cy) <= HANDLE_HIT) return 'resize-tl';
    if (Math.abs(dx - (cx + cw)) <= HANDLE_HIT && Math.abs(dy - cy) <= HANDLE_HIT) return 'resize-tr';
    if (Math.abs(dx - cx) <= HANDLE_HIT && Math.abs(dy - (cy + ch)) <= HANDLE_HIT) return 'resize-bl';
    if (Math.abs(dx - (cx + cw)) <= HANDLE_HIT && Math.abs(dy - (cy + ch)) <= HANDLE_HIT) return 'resize-br';

    // Edge handles (only when freeform — locked ratio must use corners)
    if (!aspectRatio) {
      if (Math.abs(dy - cy) <= EDGE_HIT && dx > cx + HANDLE_HIT && dx < cx + cw - HANDLE_HIT) return 'resize-t';
      if (Math.abs(dy - (cy + ch)) <= EDGE_HIT && dx > cx + HANDLE_HIT && dx < cx + cw - HANDLE_HIT) return 'resize-b';
      if (Math.abs(dx - cx) <= EDGE_HIT && dy > cy + HANDLE_HIT && dy < cy + ch - HANDLE_HIT) return 'resize-l';
      if (Math.abs(dx - (cx + cw)) <= EDGE_HIT && dy > cy + HANDLE_HIT && dy < cy + ch - HANDLE_HIT) return 'resize-r';
    }

    // Inside crop box → move
    if (dx >= cx && dx <= cx + cw && dy >= cy && dy <= cy + ch) return 'move-crop';

    // Outside → draw new
    return 'draw-new';
  }

  function cursorFor(mode: DragMode): string {
    switch (mode) {
      case 'resize-tl': case 'resize-br': return 'nwse-resize';
      case 'resize-tr': case 'resize-bl': return 'nesw-resize';
      case 'resize-t': case 'resize-b': return 'ns-resize';
      case 'resize-l': case 'resize-r': return 'ew-resize';
      case 'move-crop': return 'grab';
      case 'draw-new': return 'crosshair';
      case 'pan': return zoom > 1 ? 'grab' : 'default';
      default: return 'default';
    }
  }

  /* ─── Mouse handlers ─── */
  function handleMouseDown(e: React.MouseEvent) {
    if (!img) return;
    const rect = canvasRef.current!.getBoundingClientRect();
    const dx = e.clientX - rect.left, dy = e.clientY - rect.top;

    const mode = cropping ? hitTest(dx, dy) : 'pan';
    dragModeRef.current = mode;
    dragStartRef.current = {
      mx: dx, my: dy,
      cropSnap: crop ? { ...crop } : { x: 0, y: 0, w: img.width, h: img.height },
      panSnap: { ...panOffset },
    };
    if (mode === 'move-crop' || mode === 'pan') setCursorStyle('grabbing');
  }

  function handleMouseMove(e: React.MouseEvent) {
    if (!img || !canvasRef.current) return;
    const rect = canvasRef.current!.getBoundingClientRect();
    const dx = e.clientX - rect.left, dy = e.clientY - rect.top;
    const mode = dragModeRef.current;

    // Not dragging — just update cursor based on what's under the pointer
    if (mode === 'none') {
      const hover = cropping ? hitTest(dx, dy) : (zoom > 1 ? 'pan' : 'none');
      setCursorStyle(cursorFor(hover));
      return;
    }

    const { mx: sx, my: sy, cropSnap: cs, panSnap: ps } = dragStartRef.current;
    const ddx = dx - sx, ddy = dy - sy; // delta in display px
    const { baseScale } = getCanvasDims();
    const es = baseScale * zoom;

    /* — PAN — */
    if (mode === 'pan') {
      setPanOffset({ x: ps.x + ddx, y: ps.y + ddy });
      return;
    }

    /* — MOVE CROP — */
    if (mode === 'move-crop') {
      let nx = cs.x + ddx / es;
      let ny = cs.y + ddy / es;
      nx = Math.max(0, Math.min(nx, img.width - cs.w));
      ny = Math.max(0, Math.min(ny, img.height - cs.h));
      setCrop({ x: nx, y: ny, w: cs.w, h: cs.h });
      return;
    }

    /* — DRAW NEW — */
    if (mode === 'draw-new') {
      const s = d2i(sx, sy), c = d2i(dx, dy);
      let x = Math.min(s.ix, c.ix), y = Math.min(s.iy, c.iy);
      let w = Math.abs(c.ix - s.ix), h = Math.abs(c.iy - s.iy);
      if (aspectRatio) h = w / aspectRatio;
      x = Math.max(0, x); y = Math.max(0, y);
      w = Math.min(w, img.width - x);
      h = Math.min(h, img.height - y);
      if (aspectRatio) w = h * aspectRatio;
      if (w >= 5 && h >= 5) setCrop({ x, y, w, h });
      return;
    }

    /* — RESIZE — */
    if (mode.startsWith('resize-')) {
      const diX = ddx / es, diY = ddy / es; // delta in image px
      let { x, y, w, h } = cs;

      const isCorner = mode === 'resize-tl' || mode === 'resize-tr' || mode === 'resize-bl' || mode === 'resize-br';

      switch (mode) {
        case 'resize-tl': x += diX; w -= diX; y += diY; h -= diY; break;
        case 'resize-tr': w += diX; y += diY; h -= diY; break;
        case 'resize-bl': x += diX; w -= diX; h += diY; break;
        case 'resize-br': w += diX; h += diY; break;
        case 'resize-t': y += diY; h -= diY; break;
        case 'resize-b': h += diY; break;
        case 'resize-l': x += diX; w -= diX; break;
        case 'resize-r': w += diX; break;
      }

      // Minimum size
      if (w < 20) { w = 20; if (mode === 'resize-tl' || mode === 'resize-bl' || mode === 'resize-l') x = cs.x + cs.w - 20; }
      if (h < 20) { h = 20; if (mode === 'resize-tl' || mode === 'resize-tr' || mode === 'resize-t') y = cs.y + cs.h - 20; }

      // Aspect ratio enforcement (corners only)
      if (aspectRatio && isCorner) {
        h = w / aspectRatio;
        if (h < 20) { h = 20; w = h * aspectRatio; }
        // Re-anchor based on which corner is fixed
        switch (mode) {
          case 'resize-tl': x = cs.x + cs.w - w; y = cs.y + cs.h - h; break;
          case 'resize-tr': y = cs.y + cs.h - h; break;
          case 'resize-bl': x = cs.x + cs.w - w; break;
          case 'resize-br': break; // TL fixed, nothing to adjust
        }
      }

      // Clamp to image bounds
      if (x < 0) { w += x; x = 0; }
      if (y < 0) { h += y; y = 0; }
      if (x + w > img.width) w = img.width - x;
      if (y + h > img.height) h = img.height - y;
      if (w >= 5 && h >= 5) setCrop({ x, y, w, h });
    }
  }

  function handleMouseUp() {
    const mode = dragModeRef.current;
    if (mode === 'move-crop') setCursorStyle('grab');
    else if (mode === 'pan') setCursorStyle(zoom > 1 ? 'grab' : 'default');
    dragModeRef.current = 'none';
  }

  /* ─── Wheel zoom ─── */
  // Use a native listener so we can call preventDefault on a non-passive wheel event
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    function onWheel(e: WheelEvent) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.15 : 0.15;
      setZoom(z => Math.min(5, Math.max(0.5, +(z + delta).toFixed(2))));
    }
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  function zoomIn() { setZoom(z => Math.min(5, +(z + 0.25).toFixed(2))); }
  function zoomOut() { setZoom(z => Math.max(0.5, +(z - 0.25).toFixed(2))); }
  function zoomReset() { setZoom(1); setPanOffset({ x: 0, y: 0 }); }

  /* ─── Center crop ─── */
  function centerCrop() {
    if (!img) return;
    let w = img.width, h = img.height;
    if (aspectRatio) {
      if (w / h > aspectRatio) w = h * aspectRatio;
      else h = w / aspectRatio;
    }
    setCrop({ x: (img.width - w) / 2, y: (img.height - h) / 2, w, h });
  }

  /* ─── Export ─── */
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

    // PNG for universal browser support (server converts to WebP via Sharp anyway)
    const mime = 'image/png';
    const previewUrl = offscreen.toDataURL(mime, 0.95);
    offscreen.toBlob(blob => {
      if (blob) {
        const f = new File([blob], `edited-${Date.now()}.png`, { type: mime });
        onSave(f, previewUrl);
      }
    }, mime, 0.95);
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
      <div ref={containerRef} className="flex justify-center bg-slate-900/5 rounded-xl p-3 border border-slate-200 overflow-hidden">
        <canvas
          ref={canvasRef}
          style={{ cursor: cursorStyle }}
          className="rounded-lg max-w-full"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        />
      </div>

      {/* Zoom toolbar */}
      <div className="flex items-center justify-center gap-2">
        <Button type="button" size="sm" variant="outline" onClick={zoomOut} disabled={zoom <= 0.5} className="px-2">
          <ZoomOut className="w-3.5 h-3.5" />
        </Button>
        <span className="text-xs text-slate-500 font-mono w-14 text-center">{Math.round(zoom * 100)}%</span>
        <Button type="button" size="sm" variant="outline" onClick={zoomIn} disabled={zoom >= 5} className="px-2">
          <ZoomIn className="w-3.5 h-3.5" />
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={zoomReset} className="px-2 ml-1" title="Reset zoom">
          <Maximize className="w-3.5 h-3.5" />
        </Button>
        {zoom !== 1 && <span className="text-[10px] text-slate-400 ml-1">Scroll to zoom &middot; Drag to pan</span>}
      </div>

      {/* Tab buttons */}
      <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
        <button type="button" onClick={() => setTab('crop')} className={`flex-1 py-2 text-xs font-semibold rounded-md transition-colors ${tab === 'crop' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}>
          <Crop className="w-3.5 h-3.5 inline mr-1.5" />Crop &amp; Transform
        </button>
        <button type="button" onClick={() => setTab('adjust')} className={`flex-1 py-2 text-xs font-semibold rounded-md transition-colors ${tab === 'adjust' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}>
          <Sun className="w-3.5 h-3.5 inline mr-1.5" />Adjust
        </button>
      </div>

      {tab === 'crop' && (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" variant={cropping ? 'primary' : 'outline'} onClick={() => { setCropping(!cropping); if (!cropping) centerCrop(); }}>
              <Crop className="w-3.5 h-3.5" /> {cropping ? 'Cropping...' : 'Start crop'}
            </Button>
            {cropping && (
              <Button type="button" size="sm" variant="outline" onClick={centerCrop}>Center crop</Button>
            )}
            <Button type="button" size="sm" variant="outline" onClick={() => setFilters(f => ({ ...f, rotate: (f.rotate + 90) % 360 }))}>
              <RotateCcw className="w-3.5 h-3.5" /> Rotate
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => setFilters(f => ({ ...f, flipH: !f.flipH }))}>
              <FlipHorizontal className="w-3.5 h-3.5" /> Flip H
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => setFilters(f => ({ ...f, flipV: !f.flipV }))}>
              <FlipVertical className="w-3.5 h-3.5" /> Flip V
            </Button>
          </div>
          {crop && cropping && (
            <div className="text-xs text-slate-500 flex flex-wrap items-center gap-x-3 gap-y-1">
              <span>Crop: {Math.round(crop.w)} &times; {Math.round(crop.h)}px</span>
              {aspectRatio && <span className="text-brand-600">Aspect ratio locked ({aspectRatio >= 1 ? `${aspectRatio}:1` : `1:${Math.round(1 / aspectRatio)}`})</span>}
              <span className="text-slate-400">Drag inside to move &middot; Drag corners to resize</span>
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
          <Button type="button" size="sm" variant="outline" onClick={resetFilters}>
            <RotateCcw className="w-3.5 h-3.5" /> Reset all
          </Button>
        </div>
      )}

      {/* Output info */}
      <div className="bg-slate-50 rounded-lg px-3 py-2 text-xs text-slate-600 flex items-center justify-between">
        <span>Original: {img.width}&times;{img.height}px &middot; {(file.size / 1024).toFixed(1)}KB</span>
        <span>Output: max {maxWidth}&times;{maxHeight}px &middot; {outputFormat.toUpperCase()}</span>
      </div>

      {/* Actions */}
      <div className="flex gap-2 justify-end">
        <Button type="button" variant="outline" onClick={onCancel}><X className="w-4 h-4" /> Cancel</Button>
        <Button type="button" onClick={handleSave}><Check className="w-4 h-4" /> Apply &amp; Use</Button>
      </div>
    </div>
  );
}
