"use client";
import { useEffect, useState, useCallback, useRef } from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import {
  Eye, HelpCircle, BookOpen, Filter, PenLine, FileEdit, Link2, ListOrdered,
  Languages, CheckCircle2, XCircle, Lightbulb, ArrowRight, ChevronLeft, ChevronRight, X, Loader2,
} from 'lucide-react';

/* ─── Highlight.js (same as QuestionViewDialog) ─── */
import hljs from 'highlight.js/lib/core';
import hljsC from 'highlight.js/lib/languages/c';
import hljsCpp from 'highlight.js/lib/languages/cpp';
import hljsJava from 'highlight.js/lib/languages/java';
import hljsPython from 'highlight.js/lib/languages/python';
import hljsJavascript from 'highlight.js/lib/languages/javascript';
import hljsTypescript from 'highlight.js/lib/languages/typescript';
import hljsXml from 'highlight.js/lib/languages/xml';
import hljsCss from 'highlight.js/lib/languages/css';
import hljsSql from 'highlight.js/lib/languages/sql';
import hljsBash from 'highlight.js/lib/languages/bash';
import hljsJson from 'highlight.js/lib/languages/json';
import hljsCsharp from 'highlight.js/lib/languages/csharp';
import hljsPhp from 'highlight.js/lib/languages/php';
import hljsRuby from 'highlight.js/lib/languages/ruby';
import hljsGo from 'highlight.js/lib/languages/go';
import hljsRust from 'highlight.js/lib/languages/rust';
import hljsSwift from 'highlight.js/lib/languages/swift';
import hljsKotlin from 'highlight.js/lib/languages/kotlin';
import hljsDart from 'highlight.js/lib/languages/dart';
import 'highlight.js/styles/atom-one-light.css';

hljs.registerLanguage('c', hljsC);
hljs.registerLanguage('cpp', hljsCpp);
hljs.registerLanguage('java', hljsJava);
hljs.registerLanguage('python', hljsPython);
hljs.registerLanguage('javascript', hljsJavascript);
hljs.registerLanguage('typescript', hljsTypescript);
hljs.registerLanguage('xml', hljsXml);
hljs.registerLanguage('css', hljsCss);
hljs.registerLanguage('sql', hljsSql);
hljs.registerLanguage('bash', hljsBash);
hljs.registerLanguage('json', hljsJson);
hljs.registerLanguage('csharp', hljsCsharp);
hljs.registerLanguage('php', hljsPhp);
hljs.registerLanguage('ruby', hljsRuby);
hljs.registerLanguage('go', hljsGo);
hljs.registerLanguage('rust', hljsRust);
hljs.registerLanguage('swift', hljsSwift);
hljs.registerLanguage('kotlin', hljsKotlin);
hljs.registerLanguage('dart', hljsDart);

const LANG_MAP: Record<string, string> = {
  c: 'c', cpp: 'cpp', 'c++': 'cpp', java: 'java', python: 'python', py: 'python',
  javascript: 'javascript', js: 'javascript', typescript: 'typescript', ts: 'typescript',
  html: 'xml', xml: 'xml', css: 'css', sql: 'sql', bash: 'bash', sh: 'bash',
  json: 'json', csharp: 'csharp', 'c#': 'csharp', php: 'php', ruby: 'ruby', rb: 'ruby',
  go: 'go', golang: 'go', rust: 'rust', swift: 'swift', kotlin: 'kotlin', dart: 'dart',
};

const KNOWN_LANGS = new Set([
  'c', 'cpp', 'java', 'python', 'py', 'javascript', 'js', 'typescript', 'ts',
  'html', 'xml', 'css', 'sql', 'bash', 'sh', 'json', 'csharp', 'php', 'ruby',
  'rb', 'go', 'golang', 'rust', 'swift', 'kotlin', 'dart', 'r', 'scala', 'perl',
  'lua', 'matlab', 'assembly', 'asm', 'shell', 'powershell', 'objective-c', 'objc',
]);

const CODE_START_PATTERNS = [
  /^#include\s/, /^import\s/, /^from\s+\S+\s+import/,
  /^(int|void|float|double|char|long|short|unsigned|bool|string|var|let|const|auto|fn|func|fun|def|class|struct|enum|interface|package|module|using|namespace)\s/,
  /^(public|private|protected|static|final|abstract)\s/,
  /^(if|for|while|switch|do|try|return)\s*[\(\{]/,
  /^(printf|cout|print|println|console\.log|System\.out|fmt\.Print|echo)\s*\(/,
  /^[a-zA-Z_]\w*\s*\(.*\)\s*[\{;:]?\s*$/,
  /^#(define|ifdef|ifndef|pragma)\s/, /^\/\/(.*)|^\/\*(.*)/,
  /^\s*\{|\s*\}/,
];

function isCodeLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return false;
  return CODE_START_PATTERNS.some(pat => pat.test(trimmed));
}

function highlightCode(code: string, lang: string): string {
  const key = LANG_MAP[lang.toLowerCase()] || lang.toLowerCase();
  if (hljs.getLanguage(key)) return hljs.highlight(code, { language: key }).value;
  return code.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function CodeBlock({ code, lang }: { code: string; lang: string }) {
  const highlighted = highlightCode(code, lang);
  return (
    <div className="my-2 rounded-lg overflow-hidden border border-slate-200">
      <div className="px-3 py-1 text-[10px] text-slate-500 bg-slate-50 border-b border-slate-200 uppercase tracking-wider flex items-center justify-between" style={{ fontFamily: "Fira Code, monospace" }}>
        <span>{lang}</span>
        <button type="button" className="text-slate-400 hover:text-slate-700 transition-colors text-[10px]" onClick={() => navigator.clipboard?.writeText(code)}>Copy</button>
      </div>
      <pre className="!m-0 !rounded-none !border-0 !p-3 !overflow-x-auto !text-sm !leading-relaxed" style={{ background: '#fafafa', fontFamily: "Fira Code, monospace", fontWeight: 500 }}>
        <code className={`language-${lang}`} dangerouslySetInnerHTML={{ __html: highlighted }} />
      </pre>
    </div>
  );
}

function InlineText({ text }: { text: string }) {
  const parts = text.split(/(`[^`]+`)/g);
  return (
    <>
      {parts.map((ip, j) => {
        if (ip.startsWith('`') && ip.endsWith('`')) {
          return <code key={j} className="px-1.5 py-0.5 rounded bg-slate-100 text-pink-600 text-[0.9em] border border-slate-200" style={{ fontFamily: "Fira Code, monospace" }}>{ip.slice(1, -1)}</code>;
        }
        return <span key={j}>{ip}</span>;
      })}
    </>
  );
}

function MarkdownText({ text, className }: { text: string; className?: string }) {
  const hasFences = text.includes('```');
  if (hasFences) {
    const parts = text.split(/(```[\s\S]*?```)/g);
    const rendered = parts.map((part, i) => {
      const fenceMatch = part.match(/^```(\w*)\n?([\s\S]*?)\n?```$/);
      if (fenceMatch) return <CodeBlock key={i} code={fenceMatch[2]} lang={fenceMatch[1] || 'plaintext'} />;
      return <span key={i}><InlineText text={part} /></span>;
    });
    return <div className={cn('whitespace-pre-wrap', className)}>{rendered}</div>;
  }

  const lines = text.split('\n');
  let langLineIdx = -1;
  let detectedLang = '';
  for (let idx = 0; idx < lines.length - 1; idx++) {
    const trimmed = lines[idx].trim().toLowerCase();
    if (KNOWN_LANGS.has(trimmed) && trimmed.length <= 12) {
      const nextIdx = lines.findIndex((l, ni) => ni > idx && l.trim().length > 0);
      if (nextIdx > idx && isCodeLine(lines[nextIdx])) { langLineIdx = idx; detectedLang = trimmed; break; }
    }
  }
  if (langLineIdx >= 0) {
    const questionPart = lines.slice(0, langLineIdx).join('\n').trim();
    const codePart = lines.slice(langLineIdx + 1).join('\n').trimEnd();
    return (
      <div className={cn('whitespace-pre-wrap', className)}>
        {questionPart && <span><InlineText text={questionPart} /></span>}
        <CodeBlock code={codePart} lang={detectedLang} />
      </div>
    );
  }
  return <div className={cn('whitespace-pre-wrap', className)}><InlineText text={text} /></div>;
}

/* ─── Constants ─── */
type QuestionTab = 'mcq' | 'ow' | 'desc' | 'matching' | 'ordering';

const TABS: { key: QuestionTab; label: string }[] = [
  { key: 'mcq', label: 'MCQ' },
  { key: 'ow', label: 'One Word' },
  { key: 'desc', label: 'Descriptive' },
  { key: 'matching', label: 'Matching' },
  { key: 'ordering', label: 'Ordering' },
];

const DIFFICULTY_COLORS: Record<string, string> = { easy: 'text-emerald-600', medium: 'text-amber-600', hard: 'text-red-600' };
const DIFF_BG: Record<string, string> = { easy: 'bg-emerald-50 text-emerald-700', medium: 'bg-amber-50 text-amber-700', hard: 'bg-red-50 text-red-700' };
const selectClass = "h-9 px-3 pr-8 text-sm rounded-lg border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 appearance-none cursor-pointer bg-[url('data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20viewBox%3D%220%200%2020%2020%22%20fill%3D%22%2394a3b8%22%3E%3Cpath%20fill-rule%3D%22evenodd%22%20d%3D%22M5.23%207.21a.75.75%200%20011.06.02L10%2011.168l3.71-3.938a.75.75%200%20111.08%201.04l-4.25%204.5a.75.75%200%2001-1.08%200l-4.25-4.5a.75.75%200%2001.02-1.06z%22%20clip-rule%3D%22evenodd%22/%3E%3C/svg%3E')] bg-[length:16px] bg-[right_8px_center] bg-no-repeat";

/* ─── API loaders ─── */
function fetchQuestions(tab: QuestionTab, topicId: string) {
  const qs = `?page_size=200&topic_id=${topicId}`;
  switch (tab) {
    case 'mcq': return api.listMcqQuestions(qs);
    case 'ow': return api.listOwQuestions(qs);
    case 'desc': return api.listDescQuestions(qs);
    case 'matching': return api.listMatchingQuestions(qs);
    case 'ordering': return api.listOrderingQuestions(qs);
  }
}

function getFkField(type: QuestionTab): string {
  switch (type) { case 'mcq': return 'mcq_question_id'; case 'ow': return 'one_word_question_id'; case 'desc': return 'descriptive_question_id'; case 'matching': return 'matching_question_id'; case 'ordering': return 'ordering_question_id'; }
}
function getTransListFn(type: QuestionTab) {
  switch (type) { case 'mcq': return api.listMcqQuestionTranslations; case 'ow': return api.listOwQuestionTranslations; case 'desc': return api.listDescQuestionTranslations; case 'matching': return api.listMatchingQuestionTranslations; case 'ordering': return api.listOrderingQuestionTranslations; }
}
function getMetaFn(type: QuestionTab) {
  switch (type) { case 'mcq': return api.getMcqQuestion; case 'ow': return api.getOwQuestion; case 'desc': return api.getDescQuestion; case 'matching': return api.getMatchingQuestion; case 'ordering': return api.getOrderingQuestion; }
}

interface LangTranslation {
  language_id: number; language_name: string; iso_code: string; native_name?: string;
  question_text?: string; correct_answer?: string; answer_text?: string;
  hint?: string | null; hint_text?: string | null; explanation?: string | null; explanation_text?: string | null;
  image_1?: string | null; image_2?: string | null;
  options?: { id: number; option_text: string; is_correct: boolean; display_order: number }[];
  synonyms?: { id: number; synonym_text: string; display_order: number }[];
  pairs?: { id: number; left_text: string; right_text: string; display_order: number }[];
  items?: { id: number; item_text: string; correct_position: number; display_order: number }[];
}

/* ─── Component ─── */
export default function QaViewerPage() {
  const [subjects, setSubjects] = useState<any[]>([]);
  const [chapters, setChapters] = useState<any[]>([]);
  const [topics, setTopics] = useState<any[]>([]);
  const [subjectId, setSubjectId] = useState('');
  const [chapterId, setChapterId] = useState('');
  const [topicId, setTopicId] = useState('');
  const [activeTab, setActiveTab] = useState<QuestionTab>('mcq');

  const [questions, setQuestions] = useState<Record<QuestionTab, any[]>>({ mcq: [], ow: [], desc: [], matching: [], ordering: [] });
  const [counts, setCounts] = useState<Record<QuestionTab, number>>({ mcq: 0, ow: 0, desc: 0, matching: 0, ordering: 0 });
  const [loading, setLoading] = useState(false);
  const [filtersLoading, setFiltersLoading] = useState(true);

  // Selected question for right panel
  const listRef = useRef<HTMLDivElement>(null);
  const [selectedQ, setSelectedQ] = useState<{ id: number; code: string; type: QuestionTab } | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailMeta, setDetailMeta] = useState<any>(null);
  const [detailTranslations, setDetailTranslations] = useState<LangTranslation[]>([]);
  const [activeLang, setActiveLang] = useState(0);

  // ── Load subjects on mount ──
  useEffect(() => {
    api.listSubjects('?page_size=200&is_active=true').then(res => {
      if (res.success) setSubjects(res.data || []);
      setFiltersLoading(false);
    });
  }, []);

  useEffect(() => { setChapterId(''); setTopicId(''); setChapters([]); setTopics([]); if (subjectId) { api.listChapters(`?page_size=200&is_active=true&subject_id=${subjectId}`).then(res => { if (res.success) setChapters(res.data || []); }); } }, [subjectId]);
  useEffect(() => { setTopicId(''); setTopics([]); if (chapterId) { api.listTopics(`?page_size=200&is_active=true&chapter_id=${chapterId}`).then(res => { if (res.success) setTopics(res.data || []); }); } }, [chapterId]);

  const loadAllTabs = useCallback(async (tid: string) => {
    if (!tid) { setQuestions({ mcq: [], ow: [], desc: [], matching: [], ordering: [] }); setCounts({ mcq: 0, ow: 0, desc: 0, matching: 0, ordering: 0 }); return; }
    setLoading(true);
    setSelectedQ(null);
    const results = await Promise.all(TABS.map(t => fetchQuestions(t.key, tid)));
    const newQ: Record<QuestionTab, any[]> = { mcq: [], ow: [], desc: [], matching: [], ordering: [] };
    const newC: Record<QuestionTab, number> = { mcq: 0, ow: 0, desc: 0, matching: 0, ordering: 0 };
    TABS.forEach((t, i) => { const res = results[i]; if (res.success) { newQ[t.key] = res.data || []; newC[t.key] = res.pagination?.total ?? (res.data?.length || 0); } });
    setQuestions(newQ);
    setCounts(newC);
    setLoading(false);
    // Auto-select first question of active tab
    const firstTab = TABS.find(t => (newQ[t.key]?.length || 0) > 0);
    if (firstTab && newQ[firstTab.key].length > 0) {
      setActiveTab(firstTab.key);
      const first = newQ[firstTab.key][0];
      setSelectedQ({ id: first.id, code: first.code, type: firstTab.key });
    }
  }, []);

  useEffect(() => { loadAllTabs(topicId); }, [topicId, loadAllTabs]);

  // ── Load detail when selectedQ changes ──
  const loadDetail = useCallback(async (q: { id: number; code: string; type: QuestionTab }) => {
    setDetailLoading(true);
    setDetailTranslations([]);
    setActiveLang(0);
    setDetailMeta(null);
    try {
      const fk = getFkField(q.type);
      const listFn = getTransListFn(q.type);
      const res = await listFn(`?${fk}=${q.id}&limit=100&sort=language_id&order=asc`);
      const transData: any[] = res.success ? (res.data || []) : [];

      const langMap = new Map<number, LangTranslation>();
      for (const t of transData) {
        const langId = t.language_id;
        if (!langMap.has(langId)) {
          langMap.set(langId, { language_id: langId, language_name: t.languages?.name || `Language ${langId}`, iso_code: t.languages?.iso_code || '', native_name: t.languages?.native_name || '' });
        }
        const entry = langMap.get(langId)!;
        if (q.type === 'mcq') { entry.question_text = t.question_text; entry.hint_text = t.hint_text; entry.explanation_text = t.explanation_text; }
        else if (q.type === 'ow') { entry.question_text = t.question_text; entry.correct_answer = t.correct_answer; entry.hint = t.hint; entry.explanation = t.explanation; }
        else if (q.type === 'desc') { entry.question_text = t.question_text; entry.answer_text = t.answer_text; entry.hint = t.hint; entry.explanation = t.explanation; entry.image_1 = t.image_1; entry.image_2 = t.image_2; }
        else if (q.type === 'matching') { entry.question_text = t.question_text; entry.explanation = t.explanation; entry.hint = t.hint; }
        else if (q.type === 'ordering') { entry.question_text = t.question_text; entry.explanation = t.explanation; entry.hint = t.hint; }
      }

      // MCQ options
      if (q.type === 'mcq') {
        const optRes = await api.listMcqOptions(`?mcq_question_id=${q.id}&limit=100&sort=display_order&order=asc`);
        const options = optRes.success ? (optRes.data || []) : [];
        if (options.length > 0) {
          const optTransResults = await Promise.all(options.map((o: any) => api.listMcqOptionTranslations(`?mcq_option_id=${o.id}&limit=100&sort=id&order=asc`)));
          const allOptTrans = optTransResults.flatMap(r => r.success ? (r.data || []) : []);
          for (const [langId, entry] of langMap) {
            entry.options = options.map((opt: any, i: number) => {
              const trans = allOptTrans.find((ot: any) => ot.mcq_option_id === opt.id && ot.language_id === langId);
              return { id: opt.id, option_text: trans?.option_text || opt.code || `Option ${opt.display_order}`, is_correct: opt.is_correct, display_order: opt.display_order };
            }).sort((a: any, b: any) => a.display_order - b.display_order);
          }
        }
      }
      // OW synonyms
      if (q.type === 'ow') {
        const synRes = await api.listOwSynonyms(`?one_word_question_id=${q.id}&limit=100&sort=display_order&order=asc`);
        const synonyms = synRes.success ? (synRes.data || []) : [];
        if (synonyms.length > 0) {
          const synTransResults = await Promise.all(synonyms.map((s: any) => api.listOwSynonymTranslations(`?one_word_synonym_id=${s.id}&limit=100&sort=id&order=asc`)));
          const allSynTrans = synTransResults.flatMap(r => r.success ? (r.data || []) : []);
          for (const [langId, entry] of langMap) {
            entry.synonyms = synonyms.map((syn: any) => {
              const trans = allSynTrans.find((st: any) => st.one_word_synonym_id === syn.id && st.language_id === langId);
              return { id: syn.id, synonym_text: trans?.synonym_text || syn.synonym_text || `Synonym ${syn.display_order}`, display_order: syn.display_order };
            }).sort((a: any, b: any) => a.display_order - b.display_order);
          }
        }
      }
      // Matching pairs
      if (q.type === 'matching') {
        const pairRes = await api.listMatchingPairs(`?matching_question_id=${q.id}&limit=100&sort=display_order&order=asc`);
        const pairs = pairRes.success ? (pairRes.data || []) : [];
        if (pairs.length > 0) {
          const pairTransResults = await Promise.all(pairs.map((p: any) => api.listMatchingPairTranslations(`?matching_pair_id=${p.id}&limit=100&sort=id&order=asc`)));
          const allPairTrans = pairTransResults.flatMap(r => r.success ? (r.data || []) : []);
          for (const [langId, entry] of langMap) {
            entry.pairs = pairs.map((pair: any) => {
              const trans = allPairTrans.find((pt: any) => pt.matching_pair_id === pair.id && pt.language_id === langId);
              return { id: pair.id, left_text: trans?.left_text || `Left ${pair.display_order}`, right_text: trans?.right_text || `Right ${pair.display_order}`, display_order: pair.display_order };
            }).sort((a: any, b: any) => a.display_order - b.display_order);
          }
        }
      }
      // Ordering items
      if (q.type === 'ordering') {
        const itemRes = await api.listOrderingItems(`?ordering_question_id=${q.id}&limit=100&sort=correct_position&order=asc`);
        const items = itemRes.success ? (itemRes.data || []) : [];
        if (items.length > 0) {
          const itemTransResults = await Promise.all(items.map((i: any) => api.listOrderingItemTranslations(`?ordering_item_id=${i.id}&limit=100&sort=id&order=asc`)));
          const allItemTrans = itemTransResults.flatMap(r => r.success ? (r.data || []) : []);
          for (const [langId, entry] of langMap) {
            entry.items = items.map((item: any) => {
              const trans = allItemTrans.find((it: any) => it.ordering_item_id === item.id && it.language_id === langId);
              return { id: item.id, item_text: trans?.item_text || `Item ${item.correct_position}`, correct_position: item.correct_position, display_order: item.display_order };
            }).sort((a: any, b: any) => a.correct_position - b.correct_position);
          }
        }
      }

      const sorted = Array.from(langMap.values()).sort((a, b) => { if (a.iso_code === 'en') return -1; if (b.iso_code === 'en') return 1; return a.language_name.localeCompare(b.language_name); });
      setDetailTranslations(sorted);

      const metaRes = await getMetaFn(q.type)(q.id);
      if (metaRes.success && metaRes.data) setDetailMeta(metaRes.data);
    } catch (e) { console.error('Failed to load question:', e); }
    setDetailLoading(false);
  }, []);

  useEffect(() => {
    if (selectedQ) loadDetail(selectedQ);
  }, [selectedQ, loadDetail]);

  const currentQuestions = questions[activeTab];
  const totalQuestions = counts.mcq + counts.ow + counts.desc + counts.matching + counts.ordering;

  // ── Keyboard navigation (Up/Down arrows) ──
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle arrow keys when not typing in an input/select
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
      if (currentQuestions.length === 0) return;

      e.preventDefault();
      const currentIdx = selectedQ ? currentQuestions.findIndex((q: any) => q.id === selectedQ.id) : -1;
      let nextIdx: number;

      if (e.key === 'ArrowDown') {
        nextIdx = currentIdx < currentQuestions.length - 1 ? currentIdx + 1 : currentIdx;
      } else {
        nextIdx = currentIdx > 0 ? currentIdx - 1 : 0;
      }

      if (nextIdx !== currentIdx || !selectedQ) {
        const q = currentQuestions[nextIdx];
        setSelectedQ({ id: q.id, code: q.code, type: activeTab });
        // Scroll the item into view
        const listEl = listRef.current;
        if (listEl) {
          const items = listEl.querySelectorAll('[data-q-idx]');
          const targetItem = items[nextIdx] as HTMLElement;
          if (targetItem) {
            targetItem.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentQuestions, selectedQ, activeTab]);

  // Detail panel helpers
  const current = detailTranslations[activeLang];
  const english = detailTranslations.find(t => t.iso_code === 'en');
  const isNonEnglish = current && current.iso_code !== 'en';
  const currentHint = current?.hint || current?.hint_text || null;
  const currentExplanation = current?.explanation || current?.explanation_text || null;
  const englishHint = english?.hint || english?.hint_text || null;
  const englishExplanation = english?.explanation || english?.explanation_text || null;
  const displayHint = currentHint || (isNonEnglish ? englishHint : null);
  const displayExplanation = currentExplanation || (isNonEnglish ? englishExplanation : null);
  const hintIsFallback = !currentHint && isNonEnglish && !!englishHint;
  const explanationIsFallback = !currentExplanation && isNonEnglish && !!englishExplanation;

  return (
    <div className="animate-fade-in">
      <PageHeader title="Q&A Viewer" description="Browse questions by subject, chapter, and topic" />

      {/* ── Filter Bar ── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3 mb-4">
        <div className="flex items-center gap-3">
          <Filter className="w-4 h-4 text-slate-400 shrink-0" />
          <select className={cn(selectClass, 'flex-1')} value={subjectId} onChange={e => setSubjectId(e.target.value)} disabled={filtersLoading}>
            <option value="">Subject...</option>
            {subjects.map(s => <option key={s.id} value={s.id}>{s.english_name || s.name || `Subject ${s.id}`}</option>)}
          </select>
          <select className={cn(selectClass, 'flex-1')} value={chapterId} onChange={e => setChapterId(e.target.value)} disabled={!subjectId}>
            <option value="">{subjectId ? 'Chapter...' : '—'}</option>
            {chapters.map(c => <option key={c.id} value={c.id}>{c.english_name || c.name || `Chapter ${c.id}`}</option>)}
          </select>
          <select className={cn(selectClass, 'flex-1')} value={topicId} onChange={e => setTopicId(e.target.value)} disabled={!chapterId}>
            <option value="">{chapterId ? 'Topic...' : '—'}</option>
            {topics.map(t => <option key={t.id} value={t.id}>{t.english_name || t.name || `Topic ${t.id}`}</option>)}
          </select>
          {topicId && totalQuestions > 0 && (
            <span className="text-xs text-slate-500 whitespace-nowrap">{totalQuestions} Q</span>
          )}
        </div>
      </div>

      {/* ── Tab Bar ── */}
      <div className="flex items-center gap-1 mb-3 border-b border-slate-200">
        {TABS.map(tab => (
          <button key={tab.key} onClick={() => { setActiveTab(tab.key); setSelectedQ(null); }}
            className={cn('px-3 py-2 text-sm font-medium border-b-2 transition-colors -mb-px flex items-center gap-1',
              activeTab === tab.key ? 'text-brand-600 border-brand-500' : 'text-slate-500 border-transparent hover:text-slate-700'
            )}>
            {tab.label}
            {topicId && <span className={cn('text-xs px-1.5 py-0.5 rounded-full font-semibold', activeTab === tab.key ? 'bg-brand-100 text-brand-700' : 'bg-slate-100 text-slate-600')}>{counts[tab.key]}</span>}
          </button>
        ))}
      </div>

      {/* ── Split Panel: Left list + Right detail ── */}
      {!topicId ? (
        <EmptyState icon={Filter} title="Select Subject, Chapter, and Topic" description="Use the filters above to browse questions" />
      ) : loading ? (
        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-2">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-10 rounded-lg" />)}</div>
          <div className="col-span-2"><Skeleton className="h-64 rounded-xl" /></div>
        </div>
      ) : currentQuestions.length === 0 ? (
        <EmptyState icon={HelpCircle} title={`No ${TABS.find(t => t.key === activeTab)?.label || ''} questions`} description="No questions found for the selected topic" />
      ) : (
        <div className="flex gap-4" style={{ height: 'calc(100vh - 280px)' }}>
          {/* ── LEFT: Question List ── */}
          <div ref={listRef} className="w-[340px] shrink-0 overflow-y-auto border border-slate-200 rounded-xl bg-white">
            {currentQuestions.map((q: any, idx: number) => {
              const isSelected = selectedQ?.id === q.id && selectedQ?.type === activeTab;
              const questionText = q.question_text || '';
              const preview = questionText.length > 80 ? questionText.substring(0, 80) + '...' : questionText;
              return (
                <button
                  key={q.id}
                  data-q-idx={idx}
                  onClick={() => setSelectedQ({ id: q.id, code: q.code, type: activeTab })}
                  className={cn(
                    'w-full text-left px-3 py-2.5 border-b border-slate-100 last:border-b-0 transition-colors flex items-start gap-2',
                    isSelected ? 'bg-brand-50 border-l-2 border-l-brand-500' : 'hover:bg-slate-50 border-l-2 border-l-transparent'
                  )}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className="text-[10px] font-mono text-slate-400 truncate">{q.code}</span>
                      {q.difficulty_level && (
                        <span className={cn('text-[10px] font-semibold capitalize', DIFFICULTY_COLORS[q.difficulty_level] || 'text-slate-500')}>
                          {q.difficulty_level}
                        </span>
                      )}
                      {q.points != null && <span className="text-[10px] text-slate-400">{q.points}pt</span>}
                    </div>
                    <p className={cn('text-xs leading-snug line-clamp-2', isSelected ? 'text-brand-900 font-medium' : 'text-slate-700')}>
                      {preview || <span className="italic text-slate-400">No text</span>}
                    </p>
                  </div>
                  <Badge variant={q.is_active ? 'success' : 'danger'} className="text-[9px] px-1.5 py-0 shrink-0 mt-0.5">
                    {q.is_active ? 'Active' : 'Off'}
                  </Badge>
                </button>
              );
            })}
          </div>

          {/* ── RIGHT: Question Detail ── */}
          <div className="flex-1 overflow-y-auto border border-slate-200 rounded-xl bg-white">
            {!selectedQ ? (
              <div className="flex items-center justify-center h-full text-slate-400 text-sm">
                <div className="text-center">
                  <Eye className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                  <p>Click a question to view details</p>
                </div>
              </div>
            ) : detailLoading ? (
              <div className="p-6 space-y-4">
                <Skeleton className="h-5 w-1/3" />
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-16 w-full" />
              </div>
            ) : (
              <div className="flex flex-col h-full">
                {/* Detail Header */}
                <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/50 shrink-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-semibold text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200">{selectedQ.code}</span>
                    {detailMeta?.difficulty_level && (
                      <span className={cn('text-xs font-semibold px-2 py-0.5 rounded-full capitalize', DIFF_BG[detailMeta.difficulty_level] || 'bg-slate-50 text-slate-600')}>{detailMeta.difficulty_level}</span>
                    )}
                    {detailMeta?.points != null && <span className="text-xs text-slate-500">{detailMeta.points} pts</span>}
                    {detailMeta?.question_type && <span className="text-xs text-slate-400 capitalize">{detailMeta.question_type.replace(/_/g, ' ')}</span>}
                    {detailMeta?.mcq_type && <span className="text-xs text-slate-400 capitalize">{detailMeta.mcq_type.replace(/_/g, ' ')}</span>}
                  </div>
                </div>

                {/* Language Tabs */}
                {detailTranslations.length > 0 && (
                  <div className="px-4 pt-2 border-b border-slate-100 shrink-0 overflow-x-auto">
                    <div className="flex gap-0.5">
                      {detailTranslations.map((t, idx) => (
                        <button key={t.language_id} onClick={() => setActiveLang(idx)}
                          className={cn('px-3 py-1.5 text-xs font-medium rounded-t-md transition-all whitespace-nowrap border-b-2 -mb-px',
                            idx === activeLang ? 'text-brand-700 border-brand-500 bg-brand-50/50' : 'text-slate-500 border-transparent hover:text-slate-700'
                          )}>
                          {t.iso_code.toUpperCase()}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-4">
                  {detailTranslations.length === 0 ? (
                    <div className="text-center py-8">
                      <Languages className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                      <p className="text-sm text-slate-500">No translations found</p>
                    </div>
                  ) : current && (
                    <div className="space-y-4">
                      {/* Question */}
                      <div>
                        <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1 mb-1.5">
                          <BookOpen className="w-3 h-3" /> Question
                        </label>
                        <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                          {current.question_text
                            ? <MarkdownText text={current.question_text} className="text-sm text-slate-900 leading-relaxed" />
                            : <p className="text-slate-300 italic text-sm">No translation</p>}
                        </div>
                      </div>

                      {/* MCQ Options */}
                      {selectedQ.type === 'mcq' && current.options && current.options.length > 0 && (
                        <div>
                          <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1 mb-1.5">
                            <HelpCircle className="w-3 h-3" /> Options
                          </label>
                          <div className="space-y-1.5">
                            {current.options.map((opt, i) => (
                              <div key={opt.id} className={cn('flex items-start gap-2 p-2.5 rounded-lg border', opt.is_correct ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-slate-200')}>
                                <span className={cn('w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0', opt.is_correct ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-600')}>{String.fromCharCode(65 + i)}</span>
                                <span className={cn('text-sm flex-1', opt.is_correct ? 'text-emerald-900 font-medium' : 'text-slate-700')}><MarkdownText text={opt.option_text} /></span>
                                {opt.is_correct && <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* OW Answer */}
                      {selectedQ.type === 'ow' && (
                        <div>
                          <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1 mb-1.5">
                            <CheckCircle2 className="w-3 h-3" /> Answer
                          </label>
                          <div className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-50 border border-emerald-200">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                            <span className="text-emerald-900 font-semibold text-sm">{current.correct_answer || '—'}</span>
                          </div>
                          {current.synonyms && current.synonyms.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              {current.synonyms.map(syn => (
                                <span key={syn.id} className="text-xs px-2 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200">{syn.synonym_text}</span>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Desc Answer */}
                      {selectedQ.type === 'desc' && current.answer_text && (
                        <div>
                          <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1 mb-1.5">
                            <CheckCircle2 className="w-3 h-3" /> Model Answer
                          </label>
                          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
                            <MarkdownText text={current.answer_text!} className="text-sm text-emerald-900 leading-relaxed" />
                          </div>
                        </div>
                      )}

                      {/* Matching Pairs */}
                      {selectedQ.type === 'matching' && current.pairs && current.pairs.length > 0 && (
                        <div>
                          <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1 mb-1.5">
                            <Link2 className="w-3 h-3" /> Pairs
                          </label>
                          <div className="space-y-1.5">
                            {current.pairs.map(pair => (
                              <div key={pair.id} className="flex items-center gap-2">
                                <div className="flex-1 bg-amber-50 border border-amber-200 rounded-lg p-2 text-xs text-amber-900"><MarkdownText text={pair.left_text} /></div>
                                <ArrowRight className="w-4 h-4 text-slate-400 shrink-0" />
                                <div className="flex-1 bg-blue-50 border border-blue-200 rounded-lg p-2 text-xs text-blue-900"><MarkdownText text={pair.right_text} /></div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Ordering Items */}
                      {selectedQ.type === 'ordering' && current.items && current.items.length > 0 && (
                        <div>
                          <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1 mb-1.5">
                            <ListOrdered className="w-3 h-3" /> Order
                          </label>
                          <div className="space-y-1.5">
                            {current.items.map(item => (
                              <div key={item.id} className="flex items-center gap-2 bg-rose-50 border border-rose-200 rounded-lg p-2">
                                <span className="w-6 h-6 rounded-full bg-rose-500 text-white flex items-center justify-center text-[10px] font-bold shrink-0">{item.correct_position}</span>
                                <span className="text-xs text-rose-900"><MarkdownText text={item.item_text} /></span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Hint */}
                      {displayHint && (
                        <div>
                          <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1 mb-1.5">
                            <Lightbulb className="w-3 h-3" /> Hint
                            {hintIsFallback && <span className="text-[9px] font-normal text-amber-500">(EN fallback)</span>}
                          </label>
                          <div className={cn('rounded-lg p-3', hintIsFallback ? 'bg-amber-50/50 border border-dashed border-amber-300' : 'bg-amber-50 border border-amber-200')}>
                            <MarkdownText text={displayHint!} className={cn('text-sm leading-relaxed', hintIsFallback ? 'text-amber-600 italic' : 'text-amber-800')} />
                          </div>
                        </div>
                      )}

                      {/* Explanation */}
                      {displayExplanation && (
                        <div>
                          <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1 mb-1.5">
                            <BookOpen className="w-3 h-3" /> Explanation
                            {explanationIsFallback && <span className="text-[9px] font-normal text-blue-500">(EN fallback)</span>}
                          </label>
                          <div className={cn('rounded-lg p-3', explanationIsFallback ? 'bg-blue-50/50 border border-dashed border-blue-300' : 'bg-blue-50 border border-blue-200')}>
                            <MarkdownText text={displayExplanation!} className={cn('text-sm leading-relaxed', explanationIsFallback ? 'text-blue-600 italic' : 'text-blue-800')} />
                          </div>
                        </div>
                      )}

                      {/* Images (Desc) */}
                      {selectedQ.type === 'desc' && (current.image_1 || current.image_2) && (
                        <div className="flex gap-3">
                          {current.image_1 && <a href={current.image_1} target="_blank" rel="noopener noreferrer"><img src={current.image_1} alt="Image 1" className="w-32 h-32 object-cover rounded-lg border" /></a>}
                          {current.image_2 && <a href={current.image_2} target="_blank" rel="noopener noreferrer"><img src={current.image_2} alt="Image 2" className="w-32 h-32 object-cover rounded-lg border" /></a>}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Footer nav */}
                {detailTranslations.length > 1 && (
                  <div className="px-4 py-2 border-t border-slate-100 flex items-center gap-2 shrink-0 bg-slate-50/50">
                    <button onClick={() => setActiveLang(Math.max(0, activeLang - 1))} disabled={activeLang === 0} className="p-1 rounded text-slate-400 hover:text-slate-700 disabled:opacity-30"><ChevronLeft className="w-3.5 h-3.5" /></button>
                    <span className="text-[10px] text-slate-500">{activeLang + 1}/{detailTranslations.length}</span>
                    <button onClick={() => setActiveLang(Math.min(detailTranslations.length - 1, activeLang + 1))} disabled={activeLang === detailTranslations.length - 1} className="p-1 rounded text-slate-400 hover:text-slate-700 disabled:opacity-30"><ChevronRight className="w-3.5 h-3.5" /></button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
