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

  function handleClose() {
    setGenerated(null);
    setPrompt('');
    onClose();
  }

  function switchMode(m: Mode) {
    setMode(m);
    setGenerated(null);
  }

  async function generate() {
    if (mode === 'update' && !prompt.trim()) {
      toast.error('Prompt is required for updating existing data');
      return;
    }
    setGenerating(true);
    setGenerated(null);
    try {
      let res;
      const effectivePrompt = prompt.trim() || defaultPrompt || '';
      if (mode === 'generate') {
        res = await api.generateMasterData({ module, provider, count, prompt: effectivePrompt || undefined });
      } else {
        res = await api.updateMasterData({ module, provider, prompt: effectivePrompt });
      }
      if (res.success) { setGenerated(res.data); } else { toast.error(res.error || 'Failed'); }
    } catch { toast.error('Failed'); }
    setGenerating(false);
  }

  async function saveAll() {
    if (!generated?.generated) return;
    setSaving(true);
    try {
      const items = Array.isArray(generated.generated) ? generated.generated : [generated.generated];
      let saved = 0;
      for (const item of items) {
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
        } catch { /* skip failed */ }
      }
      toast.success(`${mode === 'update' ? 'Updated' : 'Saved'} ${saved}/${items.length} ${moduleLabel.toLowerCase()}`);
      handleClose();
      onSaved();
    } catch { toast.error('Failed to save records'); }
    setSaving(false);
  }

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
            <input
              type="number"
              min={1}
              max={50}
              value={count}
              onChange={e => setCount(Math.min(50, Math.max(1, Number(e.target.value))))}
              className="w-24 h-9 px-3 text-sm rounded-lg border border-slate-200 bg-white focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 focus:outline-none"
            />
            <span className="text-xs text-slate-400 ml-2">max 50</span>
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

        {/* Generate / Update Button */}
        {!generated && (
          <Button type="button" onClick={generate} disabled={generating} className="w-full">
            {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : mode === 'update' ? <Pencil className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />}
            {generating ? (mode === 'update' ? 'Updating...' : 'Generating...') : (mode === 'update' ? 'Update Existing Data' : 'Generate Sample Data')}
          </Button>
        )}

        {/* Results Preview */}
        {generated?.generated && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className={cn('text-sm font-medium flex items-center gap-1.5', mode === 'update' ? 'text-amber-700' : 'text-emerald-700')}>
                <Check className="w-4 h-4" /> {mode === 'update' ? 'Updated' : 'Generated'} {Array.isArray(generated.generated) ? generated.generated.length : 1} record(s)
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
            <div className="flex gap-2">
              <Button type="button" onClick={saveAll} disabled={saving} className="flex-1">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                {saving ? 'Saving...' : `${mode === 'update' ? 'Save Updates' : `Save All to ${moduleLabel}`}`}
              </Button>
              <Button type="button" variant="outline" onClick={generate} disabled={generating}>
                <RefreshCw className="w-4 h-4" /> {mode === 'update' ? 'Re-update' : 'Regenerate'}
              </Button>
            </div>
          </div>
        )}
      </div>
    </Dialog>
  );
}
