"use client";
import { useState, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { Loader2, Sparkles, CheckCircle2, XCircle, Brain, Zap } from 'lucide-react';

/* ─────────────────── Types ─────────────────── */

export interface AiProgressStep {
  label: string;
  status: 'pending' | 'active' | 'done' | 'error';
}

interface AiProgressOverlayProps {
  /** Whether the overlay is visible */
  active: boolean;
  /** Determinate mode: known steps with progress */
  steps?: AiProgressStep[];
  /** Indeterminate mode: rotating phase messages for single API calls */
  phases?: string[];
  /** Phase rotation interval in ms (default: 3000) */
  phaseInterval?: number;
  /** Optional title (default: "AI Processing") */
  title?: string;
  /** Optional subtitle / description */
  subtitle?: string;
  /** Show as inline (within a container) vs full overlay */
  variant?: 'overlay' | 'inline';
  /** Custom className */
  className?: string;
}

/* ─────────────────── Default Phases ─────────────────── */

const DEFAULT_PHASES = [
  'Analyzing content...',
  'Generating AI response...',
  'Processing translations...',
  'Finalizing results...',
];

/* ─────────────────── Elapsed Timer Hook ─────────────────── */

function useElapsedTime(active: boolean) {
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef<number>(0);

  useEffect(() => {
    if (active) {
      startRef.current = Date.now();
      setElapsed(0);
      const timer = setInterval(() => {
        setElapsed(Math.floor((Date.now() - startRef.current) / 1000));
      }, 1000);
      return () => clearInterval(timer);
    } else {
      setElapsed(0);
    }
  }, [active]);

  const mins = Math.floor(elapsed / 60);
  const secs = elapsed % 60;
  return mins > 0
    ? `${mins}m ${secs.toString().padStart(2, '0')}s`
    : `${secs}s`;
}

/* ─────────────────── Component ─────────────────── */

export function AiProgressOverlay({
  active,
  steps,
  phases,
  phaseInterval = 3000,
  title = 'AI Processing',
  subtitle,
  variant = 'inline',
  className,
}: AiProgressOverlayProps) {
  const [currentPhase, setCurrentPhase] = useState(0);
  const elapsedTime = useElapsedTime(active);
  const effectivePhases = phases || DEFAULT_PHASES;

  // Rotate phases for indeterminate mode
  useEffect(() => {
    if (!active || steps) return;
    setCurrentPhase(0);
    const timer = setInterval(() => {
      setCurrentPhase(prev => (prev + 1) % effectivePhases.length);
    }, phaseInterval);
    return () => clearInterval(timer);
  }, [active, steps, effectivePhases.length, phaseInterval]);

  if (!active) return null;

  const isDeterminate = !!steps && steps.length > 0;
  const completedSteps = isDeterminate ? steps!.filter(s => s.status === 'done').length : 0;
  const totalSteps = isDeterminate ? steps!.length : 0;
  const progress = isDeterminate ? (completedSteps / totalSteps) * 100 : 0;
  const activeStep = isDeterminate ? steps!.find(s => s.status === 'active') : null;
  const hasError = isDeterminate ? steps!.some(s => s.status === 'error') : false;

  const content = (
    <div className={cn(
      'rounded-xl border bg-white shadow-sm overflow-hidden',
      hasError ? 'border-red-200' : 'border-brand-200',
      className,
    )}>
      {/* Header */}
      <div className={cn(
        'px-4 py-3 flex items-center gap-3',
        hasError ? 'bg-red-50' : 'bg-gradient-to-r from-brand-50 to-indigo-50',
      )}>
        <div className={cn(
          'w-8 h-8 rounded-lg flex items-center justify-center',
          hasError ? 'bg-red-100' : 'bg-brand-100',
        )}>
          {hasError
            ? <XCircle className="w-4.5 h-4.5 text-red-600" />
            : <Brain className="w-4.5 h-4.5 text-brand-600 animate-pulse" />
          }
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-slate-800">{title}</span>
            <Sparkles className="w-3.5 h-3.5 text-brand-400" />
          </div>
          {subtitle && (
            <p className="text-xs text-slate-500 truncate">{subtitle}</p>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-xs font-mono text-slate-400 tabular-nums">{elapsedTime}</span>
          {!hasError && <Loader2 className="w-4 h-4 text-brand-500 animate-spin" />}
        </div>
      </div>

      {/* Progress Bar */}
      <div className="px-4 pt-3 pb-1">
        {isDeterminate ? (
          /* Determinate progress bar */
          <div className="space-y-1.5">
            <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
              <div
                className={cn(
                  'h-full rounded-full transition-all duration-700 ease-out',
                  hasError ? 'bg-red-500' : 'bg-gradient-to-r from-brand-500 to-indigo-500',
                )}
                style={{ width: `${Math.max(progress, 3)}%` }}
              />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500">
                Step {completedSteps + (activeStep ? 1 : 0)} of {totalSteps}
              </span>
              <span className="text-xs font-medium text-brand-600">
                {Math.round(progress)}%
              </span>
            </div>
          </div>
        ) : (
          /* Indeterminate animated progress bar */
          <div className="space-y-1.5">
            <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-brand-400 via-indigo-500 to-brand-400 rounded-full animate-indeterminate" />
            </div>
            <p className="text-xs text-slate-500 text-center transition-opacity duration-300">
              {effectivePhases[currentPhase]}
            </p>
          </div>
        )}
      </div>

      {/* Step Details (determinate mode) */}
      {isDeterminate && (
        <div className="px-4 pb-3 pt-1">
          <div className="space-y-1">
            {steps!.map((step, i) => (
              <div
                key={i}
                className={cn(
                  'flex items-center gap-2 py-1 px-2 rounded-md text-xs transition-all',
                  step.status === 'active' && 'bg-brand-50 text-brand-700 font-medium',
                  step.status === 'done' && 'text-slate-400',
                  step.status === 'pending' && 'text-slate-300',
                  step.status === 'error' && 'bg-red-50 text-red-600 font-medium',
                )}
              >
                {step.status === 'active' && <Loader2 className="w-3.5 h-3.5 animate-spin flex-shrink-0" />}
                {step.status === 'done' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />}
                {step.status === 'error' && <XCircle className="w-3.5 h-3.5 flex-shrink-0" />}
                {step.status === 'pending' && <div className="w-3.5 h-3.5 rounded-full border-2 border-slate-200 flex-shrink-0" />}
                <span>{step.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  if (variant === 'overlay') {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm">
        <div className="w-full max-w-md mx-4">
          {content}
        </div>
      </div>
    );
  }

  return content;
}

/* ─────────────────── CSS for indeterminate animation ─────────────────── */
// Add this to your global CSS or tailwind config:
// @keyframes indeterminate {
//   0% { transform: translateX(-100%); width: 40%; }
//   50% { transform: translateX(60%); width: 60%; }
//   100% { transform: translateX(200%); width: 40%; }
// }
// .animate-indeterminate { animation: indeterminate 2s ease-in-out infinite; }

/* ─────────────────── Hook for easy integration ─────────────────── */

export interface UseAiProgressReturn {
  active: boolean;
  steps: AiProgressStep[];
  start: (stepLabels: string[]) => void;
  nextStep: () => void;
  setStepError: (index?: number) => void;
  finish: () => void;
  reset: () => void;
}

export function useAiProgress(): UseAiProgressReturn {
  const [active, setActive] = useState(false);
  const [steps, setSteps] = useState<AiProgressStep[]>([]);

  function start(stepLabels: string[]) {
    const newSteps = stepLabels.map((label, i) => ({
      label,
      status: (i === 0 ? 'active' : 'pending') as AiProgressStep['status'],
    }));
    setSteps(newSteps);
    setActive(true);
  }

  function nextStep() {
    setSteps(prev => {
      const next = [...prev];
      const activeIdx = next.findIndex(s => s.status === 'active');
      if (activeIdx >= 0) {
        next[activeIdx] = { ...next[activeIdx], status: 'done' };
        if (activeIdx + 1 < next.length) {
          next[activeIdx + 1] = { ...next[activeIdx + 1], status: 'active' };
        }
      }
      return next;
    });
  }

  function setStepError(index?: number) {
    setSteps(prev => {
      const next = [...prev];
      const idx = index ?? next.findIndex(s => s.status === 'active');
      if (idx >= 0) {
        next[idx] = { ...next[idx], status: 'error' };
      }
      return next;
    });
  }

  function finish() {
    setSteps(prev => prev.map(s => ({
      ...s,
      status: s.status === 'error' ? 'error' : 'done',
    })));
    // Keep visible briefly to show completion, then deactivate
    setTimeout(() => setActive(false), 800);
  }

  function reset() {
    setActive(false);
    setSteps([]);
  }

  return { active, steps, start, nextStep, setStepError, finish, reset };
}
