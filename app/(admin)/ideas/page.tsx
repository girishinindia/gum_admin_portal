'use client';

/**
 * Idea Management — review dashboard for "Submit Your Idea & Get Reward".
 * List with filters → detail modal with the full review toolkit:
 * status+remark (logged), public visibility, feedback, reward (paid → wallet
 * credit happens server-side), partnership offers.
 */

import { useCallback, useEffect, useState } from 'react';
import { Lightbulb, Search, Eye, ThumbsUp, X, Send, IndianRupee, Handshake, Globe2, MessageSquare } from 'lucide-react';
import { apiRequest } from '@/lib/api';
import { toast } from '@/components/ui/Toast';

/* eslint-disable @typescript-eslint/no-explicit-any */

const STATUSES = ['submitted', 'under_review', 'shortlisted', 'need_more_details', 'approved', 'rejected', 'planned_for_implementation', 'in_progress', 'implemented', 'rewarded', 'partnership_offered', 'closed'];

const STATUS_TONE: Record<string, string> = {
  submitted: 'bg-slate-100 text-slate-600', under_review: 'bg-amber-50 text-amber-700', shortlisted: 'bg-sky-50 text-sky-700',
  need_more_details: 'bg-orange-50 text-orange-600', approved: 'bg-emerald-50 text-emerald-700', rejected: 'bg-rose-50 text-rose-600',
  planned_for_implementation: 'bg-indigo-50 text-indigo-600', in_progress: 'bg-blue-50 text-blue-700', implemented: 'bg-emerald-100 text-emerald-800',
  rewarded: 'bg-yellow-50 text-yellow-700', partnership_offered: 'bg-violet-50 text-violet-700', closed: 'bg-slate-200 text-slate-500',
};

const Badge = ({ s }: { s: string }) => (
  <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${STATUS_TONE[s] || 'bg-slate-100 text-slate-600'}`}>{s.replace(/_/g, ' ')}</span>
);

// BUG-77/78: hoisted to module scope. Previously declared inside DetailModal's
// render body, so it got a fresh identity on every keystroke → React remounted
// the whole subtree and the review inputs (Remark/Feedback/Reward/Partnership)
// lost focus after one character / one digit. It only uses props, so this is a
// pure cut/paste with no behaviour change.
const Section = ({ title, icon: Icon, children }: any) => (
  <div className="rounded-xl border border-slate-200 p-4">
    <h4 className="text-sm font-bold text-slate-900 flex items-center gap-1.5 mb-3"><Icon className="w-4 h-4 text-slate-400" /> {title}</h4>
    {children}
  </div>
);

const input = 'rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-brand-400';

export default function IdeasAdminPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [cats, setCats] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [f, setF] = useState<any>({ status: '', category_id: '', user_type: '', is_public: '', rewarded: false, partnership: false, q: '' });
  const [detail, setDetail] = useState<any | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const p = new URLSearchParams({ limit: '100' });
    if (f.status) p.set('status', f.status);
    if (f.category_id) p.set('category_id', f.category_id);
    if (f.user_type) p.set('user_type', f.user_type);
    if (f.is_public) p.set('is_public', f.is_public);
    if (f.rewarded) p.set('rewarded', 'true');
    if (f.partnership) p.set('partnership', 'true');
    if (f.q) p.set('q', f.q);
    try {
      const res = await apiRequest<any>(`/ideas?${p.toString()}`);
      setRows(Array.isArray(res?.data) ? res.data : []);
    } catch { toast.error('Failed to load ideas'); }
    setLoading(false);
  }, [f]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { apiRequest<any>('/idea-categories?include_inactive=true&limit=200').then(r => setCats(r?.data || [])).catch(() => {}); }, []);

  const openDetail = async (id: number) => {
    const res = await apiRequest<any>(`/ideas/${id}`);
    if (res?.success === false || !res?.data) { toast.error(res?.error || 'Failed to load idea'); return; }
    setDetail(res.data);
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2"><Lightbulb className="w-6 h-6 text-yellow-500" /> Idea Management</h1>
        <p className="text-sm text-slate-500 mt-1">Review submissions, give feedback, reward implemented ideas (paid rewards credit the owner's GUM Wallet) and offer partnerships.</p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 mb-4 flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-2.5 top-2.5" />
          <input className={`${input} pl-8 w-56`} placeholder="Search title…" value={f.q} onChange={e => setF((s: any) => ({ ...s, q: e.target.value }))} />
        </div>
        <select className={input} value={f.status} onChange={e => setF((s: any) => ({ ...s, status: e.target.value }))}>
          <option value="">All statuses</option>
          {STATUSES.map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
        </select>
        <select className={input} value={f.category_id} onChange={e => setF((s: any) => ({ ...s, category_id: e.target.value }))}>
          <option value="">All categories</option>
          {cats.map((c: any) => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
        </select>
        <select className={input} value={f.user_type} onChange={e => setF((s: any) => ({ ...s, user_type: e.target.value }))}>
          <option value="">Students + instructors</option>
          <option value="student">Students</option>
          <option value="instructor">Instructors</option>
        </select>
        <select className={input} value={f.is_public} onChange={e => setF((s: any) => ({ ...s, is_public: e.target.value }))}>
          <option value="">Public + private</option>
          <option value="true">Public only</option>
          <option value="false">Private only</option>
        </select>
        <label className="flex items-center gap-1.5 text-sm text-slate-600 px-2"><input type="checkbox" checked={f.rewarded} onChange={e => setF((s: any) => ({ ...s, rewarded: e.target.checked }))} /> Rewarded</label>
        <label className="flex items-center gap-1.5 text-sm text-slate-600"><input type="checkbox" checked={f.partnership} onChange={e => setF((s: any) => ({ ...s, partnership: e.target.checked }))} /> Partnership</label>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Idea</th>
              <th className="px-4 py-3">Submitted by</th>
              <th className="px-4 py-3">Category</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Engagement</th>
              <th className="px-4 py-3">Submitted</th>
              <th className="px-4 py-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr><td colSpan={7} className="px-4 py-10 text-center text-slate-400">Loading…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-10 text-center text-slate-400">No ideas match these filters</td></tr>
            ) : rows.map((r: any) => (
              <tr key={r.id} className="hover:bg-slate-50/60">
                <td className="px-4 py-3">
                  <div className="font-medium text-slate-900 line-clamp-1">{r.title}</div>
                  <div className="flex gap-1.5 mt-1">
                    {r.is_public ? <span className="text-[10px] font-bold text-sky-600 bg-sky-50 rounded px-1.5 py-0.5">PUBLIC</span> : null}
                    {(r.idea_rewards || []).some((x: any) => x.reward_status === 'paid') ? <span className="text-[10px] font-bold text-yellow-700 bg-yellow-50 rounded px-1.5 py-0.5">🏆 REWARDED</span> : null}
                    {(r.idea_partnerships || []).some((x: any) => ['offered', 'accepted', 'completed'].includes(x.partnership_status)) ? <span className="text-[10px] font-bold text-violet-700 bg-violet-50 rounded px-1.5 py-0.5">🤝 PARTNERSHIP</span> : null}
                    {r.interested_as_partner ? <span className="text-[10px] font-bold text-slate-500 bg-slate-100 rounded px-1.5 py-0.5">wants to partner</span> : null}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="text-slate-700">{r.users?.first_name} {r.users?.last_name}</div>
                  <div className="text-xs text-slate-400 capitalize">{r.user_type}</div>
                </td>
                <td className="px-4 py-3 text-slate-600">{r.idea_categories?.icon} {r.idea_categories?.name || '—'}</td>
                <td className="px-4 py-3"><Badge s={r.status} /></td>
                <td className="px-4 py-3 text-slate-500">
                  <span className="inline-flex items-center gap-1 mr-3"><ThumbsUp className="w-3.5 h-3.5" /> {r.likes_count}</span>
                  <span className="inline-flex items-center gap-1"><Eye className="w-3.5 h-3.5" /> {r.views_count}</span>
                </td>
                <td className="px-4 py-3 text-xs text-slate-500">{new Date(r.created_at).toLocaleDateString('en-IN', { dateStyle: 'medium' })}</td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => openDetail(r.id)} className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-700">Review</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {detail ? <DetailModal idea={detail} onClose={() => setDetail(null)} onChanged={() => { openDetail(detail.id); load(); }} /> : null}
    </div>
  );
}

// ── Detail / review modal ───────────────────────────────────────────────
function DetailModal({ idea, onClose, onChanged }: { idea: any; onClose: () => void; onChanged: () => void }) {
  const [status, setStatus] = useState(idea.status);
  const [remark, setRemark] = useState('');
  const [fb, setFb] = useState('');
  const [fbVisible, setFbVisible] = useState(true);
  const latestReward = (idea.rewards || [])[0];
  const latestPart = (idea.partnerships || [])[0];
  const [rw, setRw] = useState<any>({ reward_amount: latestReward?.reward_amount || '', reward_status: latestReward?.reward_status || 'pending', reward_note: latestReward?.reward_note || '', transaction_reference: latestReward?.transaction_reference || '' });
  const [pt, setPt] = useState<any>({ partnership_status: latestPart?.partnership_status || 'offered', partnership_type: latestPart?.partnership_type || 'contributor', partnership_note: latestPart?.partnership_note || '' });
  const [busy, setBusy] = useState('');

  useEffect(() => { setStatus(idea.status); }, [idea.status]);

  const act = async (key: string, path: string, method: string, body: any, okMsg: string) => {
    setBusy(key);
    try {
      const res = await apiRequest<any>(path, { method, body: JSON.stringify(body) });
      if (res?.success === false) throw new Error(res?.error || 'Failed');
      toast.success(okMsg);
      onChanged();
    } catch (e: any) { toast.error(e?.message || 'Failed'); }
    setBusy('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-slate-900/40 p-4 overflow-y-auto" onClick={onClose}>
      <div className="my-8 w-full max-w-4xl rounded-2xl bg-white shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 p-5">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-lg font-bold text-slate-900">{idea.title}</h3>
              <Badge s={idea.status} />
              {idea.is_public ? <span className="text-[10px] font-bold text-sky-600 bg-sky-50 rounded px-1.5 py-0.5">PUBLIC</span> : null}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              {idea.idea_categories?.icon} {idea.idea_categories?.name} · by {idea.users?.first_name} {idea.users?.last_name} ({idea.user_type}) · {idea.users?.email}
              · ♥ {idea.likes_total ?? idea.likes_count} · 👁 {idea.views_count}
              {idea.interested_as_partner ? ' · wants to be a partner/contributor' : ''}
            </p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"><X className="w-5 h-5" /></button>
        </div>

        {/* BUG-76: items-start stops the two columns from stretching to equal
            height, which made the modal jump as section content changed. */}
        <div className="grid gap-4 p-5 lg:grid-cols-2 items-start">
          {/* Left: content */}
          <div className="space-y-3 text-sm">
            {[
              ['Short summary', idea.short_summary], ['Description', idea.description], ['Problem statement', idea.problem_statement],
              ['Proposed solution', idea.proposed_solution], ['Target users', idea.target_users], ['Expected benefit', idea.expected_benefit],
              ['Why useful', idea.usefulness_reason], ['Expected reward note', idea.expected_reward_note],
            ].filter(([, v]) => v).map(([k, v]) => (
              <div key={k as string}>
                <div className="text-[11px] font-bold uppercase tracking-wide text-slate-400">{k}</div>
                <p className="text-slate-700 whitespace-pre-wrap mt-0.5">{v}</p>
              </div>
            ))}
            {Array.isArray(idea.tags) && idea.tags.length ? (
              <div className="flex flex-wrap gap-1">{idea.tags.map((t: string) => <span key={t} className="text-[11px] bg-slate-100 text-slate-600 rounded-full px-2 py-0.5">#{t}</span>)}</div>
            ) : null}
            {idea.attachment_url ? <a href={idea.attachment_url} target="_blank" rel="noreferrer" className="inline-block text-xs font-semibold text-brand-600 hover:underline">📎 Open attachment</a> : null}

            <div>
              <div className="text-[11px] font-bold uppercase tracking-wide text-slate-400 mb-1">Status history</div>
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {(idea.status_logs || []).map((l: any) => (
                  <div key={l.id} className="text-xs text-slate-500">
                    <span className="font-semibold text-slate-700">{(l.old_status || '·')} → {l.new_status}</span>
                    {l.remark ? ` — ${l.remark}` : ''} · {new Date(l.created_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right: actions */}
          <div className="space-y-4">
            <Section title="Change status" icon={Send}>
              <div className="flex gap-2">
                <select className={`${input} flex-1`} value={status} onChange={e => setStatus(e.target.value)}>
                  {STATUSES.map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
                </select>
              </div>
              <textarea rows={2} className={`${input} w-full mt-2`} placeholder="Remark (saved to history + sent to owner)" value={remark} onChange={e => setRemark(e.target.value)} />
              <button disabled={busy === 'status' || status === idea.status} onClick={() => act('status', `/ideas/${idea.id}/status`, 'PATCH', { status, remark }, 'Status updated')}
                className="mt-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50">Update status</button>
            </Section>

            <Section title="Public showcase" icon={Globe2}>
              <p className="text-xs text-slate-500 mb-2">{idea.is_public ? 'Currently visible on the public Idea Showcase.' : 'Currently private (owner only). Approve first, then publish.'}</p>
              <button disabled={busy === 'vis'} onClick={() => act('vis', `/ideas/${idea.id}/visibility`, 'PATCH', { is_public: !idea.is_public }, idea.is_public ? 'Now private' : 'Now public')}
                className={`rounded-lg px-4 py-2 text-sm font-semibold ${idea.is_public ? 'border border-slate-200 text-slate-600 hover:bg-slate-50' : 'bg-sky-600 text-white hover:bg-sky-700'}`}>
                {idea.is_public ? 'Make private' : 'Make public'}
              </button>
            </Section>

            <Section title="Feedback to owner" icon={MessageSquare}>
              <textarea rows={2} className={`${input} w-full`} placeholder="Write feedback…" value={fb} onChange={e => setFb(e.target.value)} />
              <label className="flex items-center gap-2 text-xs text-slate-600 mt-2"><input type="checkbox" checked={fbVisible} onChange={e => setFbVisible(e.target.checked)} /> Visible to owner (unticked = internal note)</label>
              <button disabled={busy === 'fb' || !fb.trim()} onClick={() => { act('fb', `/ideas/${idea.id}/feedback`, 'POST', { message: fb, is_visible_to_user: fbVisible }, 'Feedback added'); setFb(''); }}
                className="mt-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50">Send feedback</button>
              {(idea.feedbacks || []).length ? (
                <div className="mt-3 space-y-1 max-h-28 overflow-y-auto">
                  {idea.feedbacks.map((x: any) => (
                    <div key={x.id} className="text-xs text-slate-500"><span className="font-semibold text-slate-700">{x.users?.first_name}:</span> {x.message} {x.is_visible_to_user ? '' : '· (internal)'}</div>
                  ))}
                </div>
              ) : null}
            </Section>

            <Section title="Reward" icon={IndianRupee}>
              {latestReward?.reward_status === 'paid' ? (
                <p className="text-sm text-emerald-700 bg-emerald-50 rounded-lg px-3 py-2">✅ ₹{Number(latestReward.reward_amount).toLocaleString('en-IN')} PAID to the owner's GUM Wallet{latestReward.reward_payment_date ? ` on ${latestReward.reward_payment_date}` : ''}.</p>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <input type="number" className={input} placeholder="Amount ₹" value={rw.reward_amount} onChange={e => setRw((s: any) => ({ ...s, reward_amount: e.target.value }))} />
                    <select className={input} value={rw.reward_status} onChange={e => setRw((s: any) => ({ ...s, reward_status: e.target.value }))}>
                      {['pending', 'approved', 'paid', 'cancelled'].map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <input className={`${input} w-full mt-2`} placeholder="Note (optional)" value={rw.reward_note} onChange={e => setRw((s: any) => ({ ...s, reward_note: e.target.value }))} />
                  <p className="text-[11px] text-slate-400 mt-1.5">Marking <b>paid</b> credits the amount to the owner's GUM Wallet instantly and sets the idea to "rewarded".</p>
                  <button disabled={busy === 'rw' || !rw.reward_amount} onClick={() => act('rw', `/ideas/${idea.id}/reward`, latestReward ? 'PATCH' : 'POST', rw, 'Reward saved')}
                    className="mt-2 rounded-lg bg-yellow-500 px-4 py-2 text-sm font-semibold text-white hover:bg-yellow-600 disabled:opacity-50">Save reward</button>
                </>
              )}
            </Section>

            <Section title="Partnership" icon={Handshake}>
              <div className="grid grid-cols-2 gap-2">
                <select className={input} value={pt.partnership_type} onChange={e => setPt((s: any) => ({ ...s, partnership_type: e.target.value }))}>
                  {['partner', 'contributor', 'mentor', 'trainer', 'consultant', 'revenue_share'].map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
                </select>
                <select className={input} value={pt.partnership_status} onChange={e => setPt((s: any) => ({ ...s, partnership_status: e.target.value }))}>
                  {['offered', 'accepted', 'rejected', 'completed', 'not_offered'].map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
                </select>
              </div>
              <input className={`${input} w-full mt-2`} placeholder="Note to owner" value={pt.partnership_note} onChange={e => setPt((s: any) => ({ ...s, partnership_note: e.target.value }))} />
              <button disabled={busy === 'pt'} onClick={() => act('pt', `/ideas/${idea.id}/partnership`, latestPart ? 'PATCH' : 'POST', pt, 'Partnership saved')}
                className="mt-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-50">Save partnership</button>
              {latestPart ? <p className="text-xs text-slate-500 mt-2">Current: {latestPart.partnership_status} {latestPart.partnership_type ? `(${latestPart.partnership_type})` : ''}</p> : null}
            </Section>
          </div>
        </div>
      </div>
    </div>
  );
}
