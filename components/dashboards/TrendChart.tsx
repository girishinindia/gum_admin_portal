'use client';

/**
 * Phase 14 — minimal inline-SVG trend chart.
 *
 * Zero dependencies (no recharts, no chartjs). Renders a smooth area-line
 * for a single numeric series indexed by date. Fits inside DashboardShell's
 * trend slot.
 *
 *   <TrendChart
 *     title="Revenue (30 days)"
 *     data={[{ x: '2026-04-01', y: 4500 }, ...]}
 *     yFormat={(v) => `₹${v}`}
 *   />
 */

import { useMemo } from 'react';

export interface TrendPoint { x: string; y: number; }

interface TrendChartProps {
  title:   string;
  data:    TrendPoint[];
  yFormat?:(v: number) => string;
  height?: number;
}

export function TrendChart({ title, data, yFormat = (v) => String(v), height = 180 }: TrendChartProps) {
  const { path, area, ticks, max, min } = useMemo(() => buildPath(data, height), [data, height]);

  if (data.length === 0) {
    return (
      <div>
        <div className="text-sm font-semibold text-slate-900 mb-2">{title}</div>
        <div className="h-44 flex items-center justify-center text-sm text-slate-400">No data yet</div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-baseline justify-between mb-3">
        <div className="text-sm font-semibold text-slate-900">{title}</div>
        <div className="text-xs text-slate-500">
          min {yFormat(min)} · max {yFormat(max)}
        </div>
      </div>
      <svg viewBox={`0 0 600 ${height}`} preserveAspectRatio="none" className="w-full" style={{ height }}>
        {/* y grid */}
        <line x1="0" y1={height - 1} x2="600" y2={height - 1} stroke="#e2e8f0" />
        {/* area */}
        <path d={area} fill="rgba(37, 99, 235, 0.10)" />
        {/* line */}
        <path d={path} fill="none" stroke="#2563eb" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      </svg>
      <div className="flex justify-between text-[10px] text-slate-400 mt-1">
        {ticks.map((t) => <span key={t}>{t.slice(5)}</span>)}
      </div>
    </div>
  );
}

// ── path builder ───────────────────────────────────────────────
function buildPath(data: TrendPoint[], height: number) {
  if (data.length === 0) return { path: '', area: '', ticks: [], max: 0, min: 0 };
  const ys = data.map((d) => d.y);
  const max = Math.max(...ys, 1);
  const min = Math.min(...ys, 0);
  const w   = 600;
  const padY = 6;
  const usable = height - padY * 2;
  const stepX = data.length > 1 ? w / (data.length - 1) : w;

  const norm = (v: number) => max === min ? padY + usable / 2 : padY + usable - ((v - min) / (max - min)) * usable;

  let path = '';
  data.forEach((p, i) => {
    const x = i * stepX;
    const y = norm(p.y);
    path += `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)} `;
  });
  // close area
  const area = `${path}L${(data.length - 1) * stepX},${height} L0,${height} Z`;

  // 6 sparsely-spaced ticks
  const tickCount = Math.min(6, data.length);
  const ticks: string[] = [];
  for (let i = 0; i < tickCount; i++) {
    const idx = Math.round(((data.length - 1) * i) / Math.max(1, tickCount - 1));
    ticks.push(data[idx]?.x ?? '');
  }

  return { path, area, ticks, max, min };
}
