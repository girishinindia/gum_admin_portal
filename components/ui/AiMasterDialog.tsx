"use client";
import { useState } from 'react';
import { Button } from './Button';
import { Dialog } from './Dialog';
import { api } from '@/lib/api';
import { toast } from './Toast';
import { Sparkles, Loader2, Check, RefreshCw, Pencil } from 'lucide-react';
import { cn } from '@/lib/utils';

type AIProvider = 'anthropic' | 'openai' | 'gemini';
type Mode = 'generate' | 'update';

const PROVIDERS: { id: AIProvider; name: string; sub: string }[] = [
  { id: 'anthropic', name: 'Anthropic', sub: 'Claude Haiku 4.5' },
  { id: 'openai', name: 'OpenAI', sub: 'GPT-4o Mini' },
  { id: 'gemini', name: 'Google', sub: 'Gemini 2.5 Flash' },
];

const BATCH_SIZE = 25;

interface AiMasterDialogProps {
  module: string;
  moduleLabel: string;
  open: boolean;
  onClose: () => void;
  createFn: (item: any) => Promise<any>;
  updateFn?: (id: number, item: any) => Promise<any>;
  onSaved: () => void;
  defaultCount?: number;
  defaultPrompt?: string;
}

export function AiMasterDialog({ module, moduleLabel, open, onClose, createFn, updateFn, onSaved, defaultCount = 10, defaultPrompt = '' }: AiMasterDialogProps) {
  const [mode, setMode] = useState<Mode>('generate');
  const [provider, setProvider] = useState<AIProvider>('gemini');
  const [count, setCount] = useState(defaultCount);
  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [prompt, setPrompt] = useState('');
  // Progress tracking
  const [genProgress, setGenProgress] = useState({ current: 0, total: 0 });
  const [saveProgress, setSaveProgress] = useState({ saved: 0, failed: 0, total: 0 });

  function handleClose() {
    setGenerated(null);
    setPrompt('');
    setGenProgress({ current: 0, total: 0 });
    setSaveProgress({ saved: 0, failed: 0, total: 0 });
    onClose();
  }

  function switchMode(m: Mode) {
    setMode(m);
    setGenerated(null);
    setGenProgress({ current: 0, total: 0 });
    setSaveProgress({ saved: 0, failed: 0, total: 0 });
  }

  async function generate() {
    if (mode === 'update' && !prompt.trim()) {
      toast.error('Prompt is required for updating existing data');
      return;
    }
    setGenerating(true);
    setGenerated(null);
    setSaveProgress({ saved: 0, failed: 0, total: 0 });

    try {
      const effectivePrompt = prompt.trim() || defaultPrompt || '';

      if (mode === 'update') {
        // Update mode — single call
        setGenProgress({ current: 1, total: 1 });
        const res = await api.updateMasterData({ module, provider, prompt: effectivePrompt });
        if (res.success) { setGenerated(res.data); } else { toast.error(res.error || 'Failed'); }
      } else {
        // Generate mode — batch if count > BATCH_SIZE
        if (count <= BATCH_SIZE) {
          setGenProgress({ current: 1, total: 1 });
          const res = await api.generateMasterData({ module, provider, count, prompt: effectivePrompt || undefined });
          if (res.success) { setGenerated(res.data); } else { toast.error(res.error || 'Failed'); }
        } else {
          // Batch generation
          const totalBatches = Math.ceil(count / BATCH_SIZE);
          setGenProgress({ current: 0, total: totalBatches });
          let allGenerated: any[] = [];
          let totalTokens = 0;
          let lastUsage = null;

          for (let batch = 0; batch < totalBatches; batch++) {
            const batchCount = Math.min(BATCH_SIZE, count - batch * BATCH_SIZE);
            setGenProgress({ current: batch + 1, total: totalBatches });

            const batchPrompt = effectivePrompt
              ? `${effectivePrompt}\n\nIMPORTANT: This is batch ${batch + 1} of ${totalBatches}. ${allGenerated.length > 0 ? `You have already generated these in previous batches — do NOT duplicate any: ${allGenerated.map((r: any) => r.name || r.code || r.slug || JSON.stringify(r).slice(0, 50)).join(', ')}` : ''}`
              : (allGenerated.length > 0
                ? `IMPORTANT: This is batch ${batch + 1} of ${totalBatches}. Do NOT duplicate these already-generated items: ${allGenerated.map((r: any) => r.name || r.code || r.slug || JSON.stringify(r).slice(0, 50)).join(', ')}`
                : undefined);

            const res = await api.generateMasterData({ module, provider, count: batchCount, prompt: batchPrompt });
            if (res.success && res.data?.generated) {
              const items = Array.isArray(res.data.generated) ? res.data.generated : [res.data.generated];
              allGenerated = [...allGenerated, ...items];
              totalTokens += res.data.usage?.total_tokens || 0;
              lastUsage = res.data.usage;
            } else {
              toast.error(`Batch ${batch + 1} failed: ${res.error || 'Unknown error'}`);
              break;
            }
          }

          if (allGenerated.length > 0) {
            setGenerated({
              generated: allGenerated,
              provider,
              module,
              usage: { ...lastUsage, total_tokens: totalTokens },
            });
          }
        }
      }
    } catch { toast.error('Failed'); }
    setGenerating(false);
  }

  async function saveAll() {
    if (!generated?.generated) return;
    setSaving(true);
    const items = Array.isArray(generated.generated) ? generated.generated : [generated.generated];
    const total = items.length;
    setSaveProgress({ saved: 0, failed: 0, total });

    try {
      let saved = 0;
      let failed = 0;
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        try {
          let res;
          if (mode === 'update' && item.id && updateFn) {
            const { id, ...data } = item;
            res = await updateFn(id, data);
          } else {
            const { id, ...data } = item;
            res = await createFn(mode === 'update' ? data : item);
          }
          if (res?.success) saved++;
          else failed++;
        } catch { failed++; }
        setSaveProgress({ saved, failed, total });
      }
      toast.success(`${mode === 'update' ? 'Updated' : 'Saved'} ${saved}/${total} ${moduleLabel.toLowerCase()}${failed > 0 ? ` (${failed} failed)` : ''}`);
      handleClose();
      onSaved();
    } catch { toast.error('Failed to save records'); }
    setSaving(false);
  }

  const totalGenerated = generated?.generated ? (Array.isArray(generated.generated) ? generated.generated.length : 1) : 0;

  return (
    <Dialog open={open} onClose={handleClose} title={`AI ${mode === 'generate' ? 'Generate' : 'Update'} ${moduleLabel}`} size="lg">
      <div className="p-6 space-y-5">
        {/* Mode Toggle */}
        {updateFn && (
          <div className="flex rounded-lg border border-slate-200 overflow-hidden">
            <button
              type="button"
              onClick={() => switchMode('generate')}
              className={cn(
                'flex-1 px-4 py-2.5 text-sm font-medium flex items-center justify-center gap-2 transition-colors',
                mode === 'generate'
                  ? 'bg-brand-50 text-brand-700 border-r border-brand-200'
                  : 'bg-white text-slate-600 hover:bg-slate-50 border-r border-slate-200'
              )}
            >
              <Sparkles className="w-4 h-4" /> Generate New
            </button>
            <button
              type="button"
              onClick={() => switchMode('update')}
              className={cn(
                'flex-1 px-4 py-2.5 text-sm font-medium flex items-center justify-center gap-2 transition-colors',
                mode === 'update'
                  ? 'bg-amber-50 text-amber-700'
                  : 'bg-white text-slate-600 hover:bg-slate-50'
              )}
            >
              <Pencil className="w-4 h-4" /> Update Existing
            </button>
          </div>
        )}

        {/* Provider Selection */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">AI Provider</label>
          <div className="grid grid-cols-3 gap-3">
            {PROVIDERS.map(p => (
              <button
                key={p.id}
                type="button"
                onClick={() => setProvider(p.id)}
                className={cn(
                  'p-3 rounded-lg border-2 text-left transition-all',
                  provider === p.id
                    ? 'border-brand-500 bg-brand-50 ring-1 ring-brand-500/20'
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                )}
              >
                <div className="text-sm font-semibold text-slate-900">{p.name}</div>
                <div className="text-xs text-slate-500 mt-0.5">{p.sub}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Count — only in generate mode */}
        {mode === 'generate' && (
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Number of records</label>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={1}
                max={100}
                value={count}
                onChange={e => setCount(Number(e.target.value))}
                className="flex-1 h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-brand-600"
              />
              <input
                type="number"
                min={1}
                max={100}
                value={count}
                onChange={e => setCount(Math.min(100, Math.max(1, Number(e.target.value))))}
                className="w-20 h-9 px-3 text-sm rounded-lg border border-slate-200 bg-white focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 focus:outline-none text-center"
              />
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-xs text-slate-400">max 100</span>
              {count > BATCH_SIZE && (
                <span className="text-xs text-amber-600 font-medium">
                  Will generate in {Math.ceil(count / BATCH_SIZE)} batches of {BATCH_SIZE}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Update info */}
        {mode === 'update' && (
          <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
            AI will fetch all active {moduleLabel.toLowerCase()} records, update them based on your instructions, and return the modified data for review before saving.
          </div>
        )}

        {/* Prompt / Instructions */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            {mode === 'update' ? 'Update Instructions' : 'Custom Instructions'}{' '}
            <span className="text-slate-400 font-normal">{mode === 'update' ? '(required)' : '(optional)'}</span>
          </label>
          <textarea
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            placeholder={mode === 'update'
              ? `e.g. "Add descriptions to all records", "Fix spelling errors", "Translate names to Hindi in description field"...`
              : defaultPrompt || `Describe what kind of ${moduleLabel.toLowerCase()} you want to generate...`
            }
            rows={3}
            className={cn(
              'w-full px-3 py-2 text-sm rounded-lg border bg-white focus:ring-2 focus:outline-none resize-none',
              mode === 'update' && !prompt.trim()
                ? 'border-amber-300 focus:border-amber-500 focus:ring-amber-500/20'
                : 'border-slate-200 focus:border-brand-500 focus:ring-brand-500/20'
            )}
          />
        </div>

        {/* Generate / Update Button + Progress */}
        {!generated && (
          <div className="space-y-2">
            <Button type="button" onClick={generate} disabled={generating} className="w-full">
              {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : mode === 'update' ? <Pencil className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />}
              {generating
                ? (genProgress.total > 1
                  ? `Generating batch ${genProgress.current}/${genProgress.total}...`
                  : (mode === 'update' ? 'Updating...' : 'Generating...'))
                : (mode === 'update' ? 'Update Existing Data' : 'Generate Sample Data')}
            </Button>
            {/* Generation progress bar */}
            {generating && genProgress.total > 1 && (
              <div className="space-y-1">
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-brand-500 rounded-full transition-all duration-500 ease-out"
                    style={{ width: `${(genProgress.current / genProgress.total) * 100}%` }}
                  />
                </div>
                <p className="text-xs text-slate-500 text-center">
                  Batch {genProgress.current} of {genProgress.total} ({Math.min(genProgress.current * BATCH_SIZE, count)}/{count} records)
                </p>
              </div>
            )}
          </div>
        )}

        {/* Results Preview */}
        {generated?.generated && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className={cn('text-sm font-medium flex items-center gap-1.5', mode === 'update' ? 'text-amber-700' : 'text-emerald-700')}>
                <Check className="w-4 h-4" /> {mode === 'update' ? 'Updated' : 'Generated'} {totalGenerated} record(s)
              </span>
              <span className="text-xs text-slate-400">
                {generated.usage?.total_tokens?.toLocaleString()} tokens
              </span>
            </div>
            <div className="max-h-64 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 p-3">
              <pre className="text-xs text-slate-700 whitespace-pre-wrap font-mono">
                {JSON.stringify(generated.generated, null, 2)}
              </pre>
            </div>

            {/* Save progress */}
            {saving && saveProgress.total > 0 && (
              <div className="space-y-1.5">
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-300 ease-out"
                    style={{
                      width: `${((saveProgress.saved + saveProgress.failed) / saveProgress.total) * 100}%`,
                      background: saveProgress.failed > 0
                        ? `linear-gradient(90deg, #22c55e ${(saveProgress.saved / (saveProgress.saved + saveProgress.failed)) * 100}%, #ef4444 ${(saveProgress.saved / (saveProgress.saved + saveProgress.failed)) * 100}%)`
                        : '#22c55e',
                    }}
                  />
                </div>
                <p className="text-xs text-slate-500 text-center">
                  Saving {saveProgress.saved + saveProgress.failed}/{saveProgress.total}
                  {saveProgress.failed > 0 && <span className="text-red-500 ml-1">({saveProgress.failed} failed)</span>}
                </p>
              </div>
            )}

            <div className="flex gap-2">
              <Button type="button" onClick={saveAll} disabled={saving} className="flex-1">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                {saving
                  ? `Saving ${saveProgress.saved + saveProgress.failed}/${saveProgress.total}...`
                  : `${mode === 'update' ? 'Save Updates' : `Save All ${totalGenerated} to ${moduleLabel}`}`}
              </Button>
              <Button type="button" variant="outline" onClick={generate} disabled={generating || saving}>
                <RefreshCw className="w-4 h-4" /> {mode === 'update' ? 'Re-update' : 'Regenerate'}
              </Button>
            </div>
          </div>
        )}
      </div>
    </Dialog>
  );
}
