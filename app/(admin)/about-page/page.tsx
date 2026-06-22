"use client";
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Skeleton } from '@/components/ui/Skeleton';
import { PageHeader } from '@/components/layout/PageHeader';
import { api } from '@/lib/api';
import { toast } from '@/components/ui/Toast';
import { Plus, Trash2, Loader2, Save } from 'lucide-react';

interface Stat { value: string; label: string }
interface ValueItem { title: string; description: string }

const inputCls = 'w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500';
const labelCls = 'block text-sm font-medium text-slate-700 mb-1';

const EMPTY = {
  hero_eyebrow: '', hero_title: '', hero_subtitle: '',
  story_eyebrow: '', story_heading: '', story_body: '',
  values_eyebrow: '', values_heading: '',
  mission_title: '', mission_body: '', vision_title: '', vision_body: '',
  cta_heading: '', cta_subtitle: '',
};

function Card({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
      <h2 className="heading text-base text-slate-900">{title}</h2>
      {hint && <p className="text-xs text-slate-500 mt-0.5 mb-3">{hint}</p>}
      <div className={hint ? '' : 'mt-4'}>{children}</div>
    </div>
  );
}

export default function AboutPageEditor() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [f, setF] = useState<any>(EMPTY);
  const [stats, setStats] = useState<Stat[]>([]);
  const [values, setValues] = useState<ValueItem[]>([]);

  useEffect(() => {
    (async () => {
      const res = await api.getAboutPage();
      if (res.success && res.data) {
        const d = res.data;
        const next: any = { ...EMPTY };
        for (const k of Object.keys(EMPTY)) next[k] = d[k] ?? '';
        setF(next);
        setStats(Array.isArray(d.stats) ? d.stats : []);
        setValues(Array.isArray(d.values) ? d.values : []);
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
        stats: stats.filter((s) => (s.value || '').trim() || (s.label || '').trim()),
        values: values.filter((v) => (v.title || '').trim() || (v.description || '').trim()),
      };
      const res = await api.updateAboutPage(payload);
      if (res.success) toast.success('About page saved'); else toast.error(res.error || 'Failed');
    } catch (e: any) { toast.error(e.message || 'Failed'); }
    setSaving(false);
  }

  if (loading) {
    return <div className="space-y-4">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-32" />)}</div>;
  }

  const SaveBtn = <Button onClick={save} disabled={saving}>{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save changes</Button>;

  return (
    <div className="animate-fade-in">
      <PageHeader title="About Page" description="Edit the public About Us page content" actions={SaveBtn} />

      <div className="space-y-5 max-w-4xl">
        <Card title="Hero">
          <div className="space-y-3">
            <div><label className={labelCls}>Eyebrow</label><Input value={f.hero_eyebrow} onChange={(e: any) => set('hero_eyebrow', e.target.value)} placeholder="About Grow Up More" /></div>
            <div><label className={labelCls}>Title</label><Input value={f.hero_title} onChange={(e: any) => set('hero_title', e.target.value)} placeholder="Main heading" /></div>
            <div><label className={labelCls}>Subtitle</label><textarea rows={2} className={inputCls} value={f.hero_subtitle} onChange={(e) => set('hero_subtitle', e.target.value)} placeholder="Short intro under the title" /></div>
          </div>
        </Card>

        <Card title="Stats" hint="Numbers shown in the band below the hero.">
          <div className="space-y-2">
            {stats.map((s, i) => (
              <div key={i} className="flex items-center gap-2">
                <Input value={s.value} onChange={(e: any) => setStats(stats.map((x, j) => j === i ? { ...x, value: e.target.value } : x))} placeholder="50K+" className="w-32" />
                <Input value={s.label} onChange={(e: any) => setStats(stats.map((x, j) => j === i ? { ...x, label: e.target.value } : x))} placeholder="Learners" />
                <button type="button" onClick={() => setStats(stats.filter((_, j) => j !== i))} className="p-2 text-slate-400 hover:text-red-600" title="Remove"><Trash2 className="w-4 h-4" /></button>
              </div>
            ))}
            <Button size="sm" variant="outline" onClick={() => setStats([...stats, { value: '', label: '' }])}><Plus className="w-3.5 h-3.5" /> Add stat</Button>
          </div>
        </Card>

        <Card title="Our story">
          <div className="space-y-3">
            <div><label className={labelCls}>Eyebrow</label><Input value={f.story_eyebrow} onChange={(e: any) => set('story_eyebrow', e.target.value)} placeholder="Our story" /></div>
            <div><label className={labelCls}>Heading</label><Input value={f.story_heading} onChange={(e: any) => set('story_heading', e.target.value)} placeholder="From a regret to a movement" /></div>
            <div><label className={labelCls}>Body</label><textarea rows={6} className={inputCls} value={f.story_body} onChange={(e) => set('story_body', e.target.value)} placeholder="Separate paragraphs with a blank line." /><p className="text-[11px] text-slate-400 mt-1">Separate paragraphs with a blank line.</p></div>
          </div>
        </Card>

        <Card title="Core values">
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><label className={labelCls}>Eyebrow</label><Input value={f.values_eyebrow} onChange={(e: any) => set('values_eyebrow', e.target.value)} placeholder="What we believe" /></div>
              <div><label className={labelCls}>Heading</label><Input value={f.values_heading} onChange={(e: any) => set('values_heading', e.target.value)} placeholder="Three things, non-negotiable." /></div>
            </div>
            <div className="space-y-2">
              {values.map((v, i) => (
                <div key={i} className="flex items-start gap-2 border border-slate-100 rounded-lg p-2.5">
                  <div className="flex-1 space-y-2">
                    <Input value={v.title} onChange={(e: any) => setValues(values.map((x, j) => j === i ? { ...x, title: e.target.value } : x))} placeholder="Value title" />
                    <textarea rows={2} className={inputCls} value={v.description} onChange={(e) => setValues(values.map((x, j) => j === i ? { ...x, description: e.target.value } : x))} placeholder="Value description" />
                  </div>
                  <button type="button" onClick={() => setValues(values.filter((_, j) => j !== i))} className="p-2 text-slate-400 hover:text-red-600" title="Remove"><Trash2 className="w-4 h-4" /></button>
                </div>
              ))}
              <Button size="sm" variant="outline" onClick={() => setValues([...values, { title: '', description: '' }])}><Plus className="w-3.5 h-3.5" /> Add value</Button>
            </div>
          </div>
        </Card>

        <Card title="Mission & Vision">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Input value={f.mission_title} onChange={(e: any) => set('mission_title', e.target.value)} placeholder="Our mission" />
              <textarea rows={4} className={inputCls} value={f.mission_body} onChange={(e) => set('mission_body', e.target.value)} placeholder="Mission statement" />
            </div>
            <div className="space-y-2">
              <Input value={f.vision_title} onChange={(e: any) => set('vision_title', e.target.value)} placeholder="Our vision" />
              <textarea rows={4} className={inputCls} value={f.vision_body} onChange={(e) => set('vision_body', e.target.value)} placeholder="Vision statement" />
            </div>
          </div>
        </Card>

        <Card title="Call to action">
          <div className="space-y-3">
            <div><label className={labelCls}>Heading</label><Input value={f.cta_heading} onChange={(e: any) => set('cta_heading', e.target.value)} placeholder="Ready to grow your career?" /></div>
            <div><label className={labelCls}>Subtitle</label><textarea rows={2} className={inputCls} value={f.cta_subtitle} onChange={(e) => set('cta_subtitle', e.target.value)} placeholder="Short supporting line" /></div>
          </div>
        </Card>

        <div className="flex justify-end pb-8">{SaveBtn}</div>
      </div>
    </div>
  );
}
