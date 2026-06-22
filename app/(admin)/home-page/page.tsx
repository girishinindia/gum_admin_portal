"use client";
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Skeleton } from '@/components/ui/Skeleton';
import { PageHeader } from '@/components/layout/PageHeader';
import { api } from '@/lib/api';
import { toast } from '@/components/ui/Toast';
import { Plus, Trash2, Loader2, Save } from 'lucide-react';

const inputCls = 'w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500';
const labelCls = 'block text-sm font-medium text-slate-700 mb-1';

const EMPTY = {
  hero_title: '', hero_highlight: '', hero_subtitle: '',
  hero_primary_label: '', hero_primary_href: '', hero_secondary_label: '', hero_secondary_href: '',
  hiw_eyebrow: '', hiw_heading: '', hiw_subtitle: '',
  feat_eyebrow: '', feat_heading: '', feat_subtitle: '',
  nl_eyebrow: '', nl_heading: '', nl_subtitle: '', nl_whatsapp_url: '', nl_telegram_url: '',
  app_eyebrow: '', app_heading: '', app_subtitle: '', app_playstore_url: '', app_appstore_url: '',
  cta_heading: '', cta_subtitle: '', cta_primary_label: '', cta_primary_href: '', cta_secondary_label: '', cta_secondary_href: '',
};

function Card({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
      <h2 className="heading text-base text-slate-900">{title}</h2>
      {hint && <p className="text-xs text-slate-500 mt-0.5">{hint}</p>}
      <div className="mt-3">{children}</div>
    </div>
  );
}

export default function HomePageEditor() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [f, setF] = useState<any>(EMPTY);
  const [heroStats, setHeroStats] = useState<any[]>([]);
  const [statsTiles, setStatsTiles] = useState<any[]>([]);
  const [steps, setSteps] = useState<any[]>([]);
  const [features, setFeatures] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      const res = await api.getHomePage();
      if (res.success && res.data) {
        const d = res.data;
        const next: any = { ...EMPTY };
        for (const k of Object.keys(EMPTY)) next[k] = d[k] ?? '';
        setF(next);
        setHeroStats(Array.isArray(d.hero_stats) ? d.hero_stats : []);
        setStatsTiles(Array.isArray(d.stats_tiles) ? d.stats_tiles : []);
        setSteps(Array.isArray(d.hiw_steps) ? d.hiw_steps : []);
        setFeatures(Array.isArray(d.features) ? d.features : []);
      }
      setLoading(false);
    })();
  }, []);

  const set = (k: string, v: string) => setF((p: any) => ({ ...p, [k]: v }));

  async function save() {
    setSaving(true);
    try {
      const payload = {
        ...f,
        hero_stats: heroStats.filter((s) => (s.value || '').trim() || (s.label || '').trim()),
        stats_tiles: statsTiles.filter((s) => String(s.target ?? '').trim() || (s.label || '').trim()),
        hiw_steps: steps.filter((s) => (s.title || '').trim() || (s.desc || '').trim()),
        features: features.filter((s) => (s.title || '').trim() || (s.desc || '').trim()),
      };
      const res = await api.updateHomePage(payload);
      if (res.success) toast.success('Homepage saved'); else toast.error(res.error || 'Failed');
    } catch (e: any) { toast.error(e.message || 'Failed'); }
    setSaving(false);
  }

  if (loading) return <div className="space-y-4">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-32" />)}</div>;

  const SaveBtn = <Button onClick={save} disabled={saving}>{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save changes</Button>;

  return (
    <div className="animate-fade-in">
      <PageHeader title="Homepage" description="Edit the marketing content on the public homepage" actions={SaveBtn} />

      <div className="space-y-5 max-w-4xl">
        <Card title="Hero" hint="Leave blank to keep the existing translated hero text.">
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><label className={labelCls}>Title</label><Input value={f.hero_title} onChange={(e: any) => set('hero_title', e.target.value)} placeholder="Main headline (optional)" /></div>
              <div><label className={labelCls}>Highlighted phrase</label><Input value={f.hero_highlight} onChange={(e: any) => set('hero_highlight', e.target.value)} placeholder="Gradient part (optional)" /></div>
            </div>
            <div><label className={labelCls}>Subtitle</label><textarea rows={2} className={inputCls} value={f.hero_subtitle} onChange={(e) => set('hero_subtitle', e.target.value)} placeholder="Sub-text under the headline" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className={labelCls}>Primary button label</label><Input value={f.hero_primary_label} onChange={(e: any) => set('hero_primary_label', e.target.value)} placeholder="Explore Courses" /></div>
              <div><label className={labelCls}>Primary button link</label><Input value={f.hero_primary_href} onChange={(e: any) => set('hero_primary_href', e.target.value)} placeholder="/courses" /></div>
              <div><label className={labelCls}>Secondary button label</label><Input value={f.hero_secondary_label} onChange={(e: any) => set('hero_secondary_label', e.target.value)} placeholder="Watch demo" /></div>
              <div><label className={labelCls}>Secondary button link</label><Input value={f.hero_secondary_href} onChange={(e: any) => set('hero_secondary_href', e.target.value)} placeholder="#how-it-works" /></div>
            </div>
            <label className={labelCls}>Hero stats (the 3 small numbers)</label>
            {heroStats.map((s, i) => (
              <div key={i} className="flex items-center gap-2">
                <Input value={s.value || ''} onChange={(e: any) => setHeroStats(heroStats.map((x, j) => j === i ? { ...x, value: e.target.value } : x))} placeholder="50K" className="w-24" />
                <Input value={s.suffix || ''} onChange={(e: any) => setHeroStats(heroStats.map((x, j) => j === i ? { ...x, suffix: e.target.value } : x))} placeholder="+" className="w-16" />
                <Input value={s.label || ''} onChange={(e: any) => setHeroStats(heroStats.map((x, j) => j === i ? { ...x, label: e.target.value } : x))} placeholder="Learners" />
                <button type="button" onClick={() => setHeroStats(heroStats.filter((_, j) => j !== i))} className="p-2 text-slate-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
              </div>
            ))}
            <Button size="sm" variant="outline" onClick={() => setHeroStats([...heroStats, { value: '', suffix: '', label: '' }])}><Plus className="w-3.5 h-3.5" /> Add hero stat</Button>
          </div>
        </Card>

        <Card title="Stats band" hint="The 6 animated counters. Target is the number it counts up to.">
          <div className="space-y-2">
            {statsTiles.map((s, i) => (
              <div key={i} className="flex items-center gap-2">
                <Input type="number" value={s.target ?? ''} onChange={(e: any) => setStatsTiles(statsTiles.map((x, j) => j === i ? { ...x, target: e.target.value === '' ? '' : Number(e.target.value) } : x))} placeholder="50000" className="w-32" />
                <Input value={s.suffix || ''} onChange={(e: any) => setStatsTiles(statsTiles.map((x, j) => j === i ? { ...x, suffix: e.target.value } : x))} placeholder="+" className="w-16" />
                <Input value={s.label || ''} onChange={(e: any) => setStatsTiles(statsTiles.map((x, j) => j === i ? { ...x, label: e.target.value } : x))} placeholder="Students" />
                <label className="flex items-center gap-1 text-xs text-slate-500 whitespace-nowrap"><input type="checkbox" checked={!!s.isFloat} onChange={(e) => setStatsTiles(statsTiles.map((x, j) => j === i ? { ...x, isFloat: e.target.checked } : x))} /> decimal</label>
                <button type="button" onClick={() => setStatsTiles(statsTiles.filter((_, j) => j !== i))} className="p-2 text-slate-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
              </div>
            ))}
            <Button size="sm" variant="outline" onClick={() => setStatsTiles([...statsTiles, { target: 0, suffix: '', label: '', isFloat: false }])}><Plus className="w-3.5 h-3.5" /> Add stat</Button>
          </div>
        </Card>

        <Card title="How it works">
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-3">
              <div><label className={labelCls}>Eyebrow</label><Input value={f.hiw_eyebrow} onChange={(e: any) => set('hiw_eyebrow', e.target.value)} /></div>
              <div className="col-span-2"><label className={labelCls}>Heading</label><Input value={f.hiw_heading} onChange={(e: any) => set('hiw_heading', e.target.value)} /></div>
            </div>
            <div><label className={labelCls}>Subtitle</label><Input value={f.hiw_subtitle} onChange={(e: any) => set('hiw_subtitle', e.target.value)} /></div>
            <label className={labelCls}>Steps</label>
            {steps.map((s, i) => (
              <div key={i} className="flex items-start gap-2 border border-slate-100 rounded-lg p-2.5">
                <div className="flex-1 space-y-2">
                  <Input value={s.title || ''} onChange={(e: any) => setSteps(steps.map((x, j) => j === i ? { ...x, title: e.target.value } : x))} placeholder="Step title" />
                  <textarea rows={2} className={inputCls} value={s.desc || ''} onChange={(e) => setSteps(steps.map((x, j) => j === i ? { ...x, desc: e.target.value } : x))} placeholder="Step description" />
                </div>
                <button type="button" onClick={() => setSteps(steps.filter((_, j) => j !== i))} className="p-2 text-slate-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
              </div>
            ))}
            <Button size="sm" variant="outline" onClick={() => setSteps([...steps, { title: '', desc: '' }])}><Plus className="w-3.5 h-3.5" /> Add step</Button>
          </div>
        </Card>

        <Card title="Why-us features">
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-3">
              <div><label className={labelCls}>Eyebrow</label><Input value={f.feat_eyebrow} onChange={(e: any) => set('feat_eyebrow', e.target.value)} /></div>
              <div className="col-span-2"><label className={labelCls}>Heading</label><Input value={f.feat_heading} onChange={(e: any) => set('feat_heading', e.target.value)} /></div>
            </div>
            <div><label className={labelCls}>Subtitle</label><Input value={f.feat_subtitle} onChange={(e: any) => set('feat_subtitle', e.target.value)} /></div>
            <label className={labelCls}>Feature cards</label>
            {features.map((s, i) => (
              <div key={i} className="flex items-start gap-2 border border-slate-100 rounded-lg p-2.5">
                <div className="flex-1 space-y-2">
                  <Input value={s.title || ''} onChange={(e: any) => setFeatures(features.map((x, j) => j === i ? { ...x, title: e.target.value } : x))} placeholder="Feature title" />
                  <textarea rows={2} className={inputCls} value={s.desc || ''} onChange={(e) => setFeatures(features.map((x, j) => j === i ? { ...x, desc: e.target.value } : x))} placeholder="Feature description" />
                </div>
                <button type="button" onClick={() => setFeatures(features.filter((_, j) => j !== i))} className="p-2 text-slate-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
              </div>
            ))}
            <Button size="sm" variant="outline" onClick={() => setFeatures([...features, { title: '', desc: '' }])}><Plus className="w-3.5 h-3.5" /> Add feature</Button>
          </div>
        </Card>

        <Card title="Newsletter & app section">
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-3">
              <div><label className={labelCls}>Eyebrow</label><Input value={f.nl_eyebrow} onChange={(e: any) => set('nl_eyebrow', e.target.value)} /></div>
              <div className="col-span-2"><label className={labelCls}>Heading</label><Input value={f.nl_heading} onChange={(e: any) => set('nl_heading', e.target.value)} /></div>
            </div>
            <div><label className={labelCls}>Subtitle</label><Input value={f.nl_subtitle} onChange={(e: any) => set('nl_subtitle', e.target.value)} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className={labelCls}>WhatsApp link</label><Input value={f.nl_whatsapp_url} onChange={(e: any) => set('nl_whatsapp_url', e.target.value)} placeholder="https://wa.me/..." /></div>
              <div><label className={labelCls}>Telegram link</label><Input value={f.nl_telegram_url} onChange={(e: any) => set('nl_telegram_url', e.target.value)} placeholder="https://t.me/..." /></div>
            </div>
            <div className="border-t border-slate-100 pt-3 grid grid-cols-3 gap-3">
              <div><label className={labelCls}>App eyebrow</label><Input value={f.app_eyebrow} onChange={(e: any) => set('app_eyebrow', e.target.value)} /></div>
              <div className="col-span-2"><label className={labelCls}>App heading</label><Input value={f.app_heading} onChange={(e: any) => set('app_heading', e.target.value)} /></div>
            </div>
            <div><label className={labelCls}>App subtitle</label><Input value={f.app_subtitle} onChange={(e: any) => set('app_subtitle', e.target.value)} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className={labelCls}>Google Play link</label><Input value={f.app_playstore_url} onChange={(e: any) => set('app_playstore_url', e.target.value)} placeholder="https://play.google.com/..." /></div>
              <div><label className={labelCls}>App Store link</label><Input value={f.app_appstore_url} onChange={(e: any) => set('app_appstore_url', e.target.value)} placeholder="https://apps.apple.com/..." /></div>
            </div>
          </div>
        </Card>

        <Card title="Final call to action">
          <div className="space-y-3">
            <div><label className={labelCls}>Heading</label><Input value={f.cta_heading} onChange={(e: any) => set('cta_heading', e.target.value)} /></div>
            <div><label className={labelCls}>Subtitle</label><textarea rows={2} className={inputCls} value={f.cta_subtitle} onChange={(e) => set('cta_subtitle', e.target.value)} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className={labelCls}>Primary button label</label><Input value={f.cta_primary_label} onChange={(e: any) => set('cta_primary_label', e.target.value)} /></div>
              <div><label className={labelCls}>Primary button link</label><Input value={f.cta_primary_href} onChange={(e: any) => set('cta_primary_href', e.target.value)} /></div>
              <div><label className={labelCls}>Secondary button label</label><Input value={f.cta_secondary_label} onChange={(e: any) => set('cta_secondary_label', e.target.value)} /></div>
              <div><label className={labelCls}>Secondary button link</label><Input value={f.cta_secondary_href} onChange={(e: any) => set('cta_secondary_href', e.target.value)} /></div>
            </div>
          </div>
        </Card>

        <div className="flex justify-end pb-8">{SaveBtn}</div>
      </div>
    </div>
  );
}
