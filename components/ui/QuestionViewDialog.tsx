"use client";
import { useState, useEffect, useCallback } from 'react';
import { Dialog } from '@/components/ui/Dialog';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import {
  HelpCircle, PenLine, FileEdit, Link2, ListOrdered, Languages,
  CheckCircle2, XCircle, Lightbulb, BookOpen, ArrowRight, Loader2,
  ChevronLeft, ChevronRight, X
} from 'lucide-react';

/* ─── Types ─── */
export type QuestionType = 'mcq' | 'ow' | 'desc' | 'matching' | 'ordering';

interface QuestionViewDialogProps {
  open: boolean;
  onClose: () => void;
  questionType: QuestionType;
  questionId: number | null;
  questionCode?: string;
}

interface LangTranslation {
  language_id: number;
  language_name: string;
  iso_code: string;
  native_name?: string;
  question_text?: string;
  correct_answer?: string;
  answer_text?: string;
  hint?: string | null;
  hint_text?: string | null;
  explanation?: string | null;
  explanation_text?: string | null;
  image_1?: string | null;
  image_2?: string | null;
  // MCQ options
  options?: { id: number; option_text: string; is_correct: boolean; display_order: number }[];
  // OW synonyms
  synonyms?: { id: number; synonym_text: string; display_order: number }[];
  // Matching pairs
  pairs?: { id: number; left_text: string; right_text: string; display_order: number }[];
  // Ordering items
  items?: { id: number; item_text: string; correct_position: number; display_order: number }[];
}

interface QuestionMeta {
  id: number;
  code: string;
  slug: string;
  difficulty_level?: string;
  points?: number;
  question_type?: string;
  mcq_type?: string;
  answer_type?: string;
  is_case_sensitive?: boolean;
  is_trim_whitespace?: boolean;
  min_words?: number;
  max_words?: number;
}

const TYPE_CONFIG: Record<QuestionType, { label: string; icon: any; color: string }> = {
  mcq: { label: 'MCQ', icon: HelpCircle, color: 'bg-purple-50 text-purple-700 border-purple-200' },
  ow: { label: 'One Word', icon: PenLine, color: 'bg-blue-50 text-blue-700 border-blue-200' },
  desc: { label: 'Descriptive', icon: FileEdit, color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  matching: { label: 'Matching', icon: Link2, color: 'bg-amber-50 text-amber-700 border-amber-200' },
  ordering: { label: 'Ordering', icon: ListOrdered, color: 'bg-rose-50 text-rose-700 border-rose-200' },
};

const DIFF_COLORS: Record<string, string> = {
  easy: 'bg-emerald-50 text-emerald-700',
  medium: 'bg-amber-50 text-amber-700',
  hard: 'bg-red-50 text-red-700',
};

/* ─── Highlight.js syntax highlighting for code blocks & inline code ─── */
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

/** Map common aliases to Highlight.js language names */
const LANG_MAP: Record<string, string> = {
  c: 'c', cpp: 'cpp', 'c++': 'cpp', java: 'java', python: 'python', py: 'python',
  javascript: 'javascript', js: 'javascript', typescript: 'typescript', ts: 'typescript',
  html: 'xml', xml: 'xml', css: 'css', sql: 'sql', bash: 'bash', sh: 'bash',
  json: 'json', csharp: 'csharp', 'c#': 'csharp', php: 'php', ruby: 'ruby', rb: 'ruby',
  go: 'go', golang: 'go', rust: 'rust', swift: 'swift', kotlin: 'kotlin', dart: 'dart',
};

/** Known language tags the AI may place as a bare word before code */
const KNOWN_LANGS = new Set([
  'c', 'cpp', 'java', 'python', 'py', 'javascript', 'js', 'typescript', 'ts',
  'html', 'xml', 'css', 'sql', 'bash', 'sh', 'json', 'csharp', 'php', 'ruby',
  'rb', 'go', 'golang', 'rust', 'swift', 'kotlin', 'dart', 'r', 'scala', 'perl',
  'lua', 'matlab', 'assembly', 'asm', 'shell', 'powershell', 'objective-c', 'objc',
]);

/** Code-start heuristics — lines that almost certainly begin source code */
const CODE_START_PATTERNS = [
  /^#include\s/,        // C/C++
  /^import\s/,          // Python, Java, JS, TS, Go, Dart, Kotlin, Swift
  /^from\s+\S+\s+import/, // Python
  /^(int|void|float|double|char|long|short|unsigned|bool|string|var|let|const|auto|fn|func|fun|def|class|struct|enum|interface|package|module|using|namespace)\s/, // declarations
  /^(public|private|protected|static|final|abstract)\s/, // Java/C#/TS
  /^(if|for|while|switch|do|try|return)\s*[\(\{]/, // control flow
  /^(printf|cout|print|println|console\.log|System\.out|fmt\.Print|echo)\s*\(/, // output
  /^[a-zA-Z_]\w*\s*\(.*\)\s*[\{;:]?\s*$/, // function calls / definitions
  /^#(define|ifdef|ifndef|pragma)\s/,  // C preprocessor
  /^\/\/(.*)|^\/\*(.*)/, // Comments
  /^\s*\{|\s*\}/, // Braces
];

function isCodeLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return false; // blank lines are ambiguous
  return CODE_START_PATTERNS.some(pat => pat.test(trimmed));
}

function highlightCode(code: string, lang: string): string {
  const key = LANG_MAP[lang.toLowerCase()] || lang.toLowerCase();
  if (hljs.getLanguage(key)) {
    return hljs.highlight(code, { language: key }).value;
  }
  // Fallback: escape HTML and return as-is
  return code.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Renders a Highlight.js-highlighted code block */
function CodeBlock({ code, lang }: { code: string; lang: string }) {
  const highlighted = highlightCode(code, lang);
  return (
    <div className="my-2 rounded-lg overflow-hidden border border-slate-200">
      <div className="px-3 py-1 text-[10px] text-slate-500 bg-slate-50 border-b border-slate-200 uppercase tracking-wider flex items-center justify-between" style={{ fontFamily: "Fira Code, monospace" }}>
        <span>{lang}</span>
        <button
          type="button"
          className="text-slate-400 hover:text-slate-700 transition-colors text-[10px]"
          onClick={() => navigator.clipboard?.writeText(code)}
        >
          Copy
        </button>
      </div>
      <pre className="!m-0 !rounded-none !border-0 !p-3 !overflow-x-auto !text-sm !leading-relaxed" style={{ background: '#fafafa', fontFamily: "Fira Code, monospace", fontWeight: 500 }}>
        <code
          className={`language-${lang}`}
          dangerouslySetInnerHTML={{ __html: highlighted }}
        />
      </pre>
    </div>
  );
}

/** Renders inline text with `backtick` code spans */
function InlineText({ text }: { text: string }) {
  const inlineParts = text.split(/(`[^`]+`)/g);
  return (
    <>
      {inlineParts.map((ip, j) => {
        if (ip.startsWith('`') && ip.endsWith('`')) {
          return (
            <code key={j} className="px-1.5 py-0.5 rounded bg-slate-100 text-pink-600 text-[0.9em] border border-slate-200" style={{ fontFamily: "Fira Code, monospace" }}>
              {ip.slice(1, -1)}
            </code>
          );
        }
        return <span key={j}>{ip}</span>;
      })}
    </>
  );
}

function MarkdownText({ text, className }: { text: string; className?: string }) {
  // ── FORMAT A: Standard markdown fenced code blocks (```lang\n...\n```) ──
  const hasFences = text.includes('```');
  if (hasFences) {
    const parts = text.split(/(```[\s\S]*?```)/g);
    const rendered = parts.map((part, i) => {
      const fenceMatch = part.match(/^```(\w*)\n?([\s\S]*?)\n?```$/);
      if (fenceMatch) {
        return <CodeBlock key={i} code={fenceMatch[2]} lang={fenceMatch[1] || 'plaintext'} />;
      }
      return <span key={i}><InlineText text={part} /></span>;
    });
    return <div className={cn('whitespace-pre-wrap', className)}>{rendered}</div>;
  }

  // ── FORMAT B: Old AI data — bare language tag on its own line before code ──
  // Pattern: "question text?\n{lang}\n{code...}" where {lang} is a known language name
  const lines = text.split('\n');
  let langLineIdx = -1;
  let detectedLang = '';

  // Search for a line that is JUST a language name, followed by a line that looks like code
  for (let idx = 0; idx < lines.length - 1; idx++) {
    const trimmed = lines[idx].trim().toLowerCase();
    if (KNOWN_LANGS.has(trimmed) && trimmed.length <= 12) {
      // Check if the NEXT non-empty line looks like code
      const nextIdx = lines.findIndex((l, ni) => ni > idx && l.trim().length > 0);
      if (nextIdx > idx && isCodeLine(lines[nextIdx])) {
        langLineIdx = idx;
        detectedLang = trimmed;
        break;
      }
    }
  }

  if (langLineIdx >= 0) {
    // Split: text before lang tag = question text, everything after = code
    const questionPart = lines.slice(0, langLineIdx).join('\n').trim();
    const codePart = lines.slice(langLineIdx + 1).join('\n').trimEnd();

    return (
      <div className={cn('whitespace-pre-wrap', className)}>
        {questionPart && <span><InlineText text={questionPart} /></span>}
        <CodeBlock code={codePart} lang={detectedLang} />
      </div>
    );
  }

  // ── FORMAT C: No code detected — plain text with inline `code` spans ──
  return <div className={cn('whitespace-pre-wrap', className)}><InlineText text={text} /></div>;
}

/* ─── Component ─── */
export function QuestionViewDialog({ open, onClose, questionType, questionId, questionCode }: QuestionViewDialogProps) {
  const [loading, setLoading] = useState(false);
  const [meta, setMeta] = useState<QuestionMeta | null>(null);
  const [translations, setTranslations] = useState<LangTranslation[]>([]);
  const [activeLang, setActiveLang] = useState(0); // index into translations[]

  const fetchData = useCallback(async () => {
    if (!questionId) return;
    setLoading(true);
    setTranslations([]);
    setActiveLang(0);

    try {
      // Step 1: Fetch all translations for this question
      let transData: any[] = [];
      const fkField = getFkField(questionType);
      const listFn = getTransListFn(questionType);
      const res = await listFn(`?${fkField}=${questionId}&limit=100&sort=language_id&order=asc`);
      if (res.success) transData = res.data || [];

      // Step 2: Group by language and build lang translations
      const langMap = new Map<number, LangTranslation>();
      for (const t of transData) {
        const langId = t.language_id;
        const langName = t.languages?.name || `Language ${langId}`;
        const isoCode = t.languages?.iso_code || '';
        const nativeName = t.languages?.native_name || '';
        if (!langMap.has(langId)) {
          langMap.set(langId, {
            language_id: langId,
            language_name: langName,
            iso_code: isoCode,
            native_name: nativeName,
          });
        }
        const entry = langMap.get(langId)!;
        // Fill in text fields based on type
        if (questionType === 'mcq') {
          entry.question_text = t.question_text;
          entry.hint_text = t.hint_text;
          entry.explanation_text = t.explanation_text;
        } else if (questionType === 'ow') {
          entry.question_text = t.question_text;
          entry.correct_answer = t.correct_answer;
          entry.hint = t.hint;
          entry.explanation = t.explanation;
        } else if (questionType === 'desc') {
          entry.question_text = t.question_text;
          entry.answer_text = t.answer_text;
          entry.hint = t.hint;
          entry.explanation = t.explanation;
          entry.image_1 = t.image_1;
          entry.image_2 = t.image_2;
        } else if (questionType === 'matching') {
          entry.question_text = t.question_text;
          entry.explanation = t.explanation;
          entry.hint = t.hint;
        } else if (questionType === 'ordering') {
          entry.question_text = t.question_text;
          entry.explanation = t.explanation;
          entry.hint = t.hint;
        }
      }

      // Step 3: For MCQ — fetch options and option translations per language
      if (questionType === 'mcq') {
        const optRes = await api.listMcqOptions(`?mcq_question_id=${questionId}&limit=100&sort=display_order&order=asc`);
        const options = optRes.success ? (optRes.data || []) : [];
        if (options.length > 0) {
          const optIds = options.map((o: any) => o.id);
          // Fetch translations for each option in parallel
          const optTransPromises = optIds.map((oid: number) =>
            api.listMcqOptionTranslations(`?mcq_option_id=${oid}&limit=100&sort=id&order=asc`)
          );
          const optTransResults = await Promise.all(optTransPromises);
          const relevantOptTrans = optTransResults.flatMap(r => r.success ? (r.data || []) : []);

          for (const [langId, entry] of langMap) {
            entry.options = options.map((opt: any) => {
              const trans = relevantOptTrans.find((ot: any) => ot.mcq_option_id === opt.id && ot.language_id === langId);
              return {
                id: opt.id,
                option_text: trans?.option_text || opt.code || `Option ${opt.display_order}`,
                is_correct: opt.is_correct,
                display_order: opt.display_order,
              };
            }).sort((a: any, b: any) => a.display_order - b.display_order);
          }
        }
      }

      // Step 4: For OW — fetch synonyms and synonym translations per language
      if (questionType === 'ow') {
        const synRes = await api.listOwSynonyms(`?one_word_question_id=${questionId}&limit=100&sort=display_order&order=asc`);
        const synonyms = synRes.success ? (synRes.data || []) : [];
        if (synonyms.length > 0) {
          const synIds = synonyms.map((s: any) => s.id);
          const synTransPromises = synIds.map((sid: number) =>
            api.listOwSynonymTranslations(`?one_word_synonym_id=${sid}&limit=100&sort=id&order=asc`)
          );
          const synTransResults = await Promise.all(synTransPromises);
          const relevantSynTrans = synTransResults.flatMap(r => r.success ? (r.data || []) : []);

          for (const [langId, entry] of langMap) {
            entry.synonyms = synonyms.map((syn: any) => {
              const trans = relevantSynTrans.find((st: any) => st.one_word_synonym_id === syn.id && st.language_id === langId);
              return {
                id: syn.id,
                synonym_text: trans?.synonym_text || syn.synonym_text || `Synonym ${syn.display_order}`,
                display_order: syn.display_order,
              };
            }).sort((a: any, b: any) => a.display_order - b.display_order);
          }
        }
      }

      // Step 5: For Matching — fetch pairs and pair translations per language
      if (questionType === 'matching') {
        const pairRes = await api.listMatchingPairs(`?matching_question_id=${questionId}&limit=100&sort=display_order&order=asc`);
        const pairs = pairRes.success ? (pairRes.data || []) : [];
        if (pairs.length > 0) {
          const pairIds = pairs.map((p: any) => p.id);
          const pairTransPromises = pairIds.map((pid: number) =>
            api.listMatchingPairTranslations(`?matching_pair_id=${pid}&limit=100&sort=id&order=asc`)
          );
          const pairTransResults = await Promise.all(pairTransPromises);
          const relevantPairTrans = pairTransResults.flatMap(r => r.success ? (r.data || []) : []);

          for (const [langId, entry] of langMap) {
            entry.pairs = pairs.map((pair: any) => {
              const trans = relevantPairTrans.find((pt: any) => pt.matching_pair_id === pair.id && pt.language_id === langId);
              return {
                id: pair.id,
                left_text: trans?.left_text || `Pair ${pair.display_order} Left`,
                right_text: trans?.right_text || `Pair ${pair.display_order} Right`,
                display_order: pair.display_order,
              };
            }).sort((a: any, b: any) => a.display_order - b.display_order);
          }
        }
      }

      // Step 6: For Ordering — fetch items and item translations per language
      if (questionType === 'ordering') {
        const itemRes = await api.listOrderingItems(`?ordering_question_id=${questionId}&limit=100&sort=correct_position&order=asc`);
        const items = itemRes.success ? (itemRes.data || []) : [];
        if (items.length > 0) {
          const itemIds = items.map((i: any) => i.id);
          const itemTransPromises = itemIds.map((iid: number) =>
            api.listOrderingItemTranslations(`?ordering_item_id=${iid}&limit=100&sort=id&order=asc`)
          );
          const itemTransResults = await Promise.all(itemTransPromises);
          const relevantItemTrans = itemTransResults.flatMap(r => r.success ? (r.data || []) : []);

          for (const [langId, entry] of langMap) {
            entry.items = items.map((item: any) => {
              const trans = relevantItemTrans.find((it: any) => it.ordering_item_id === item.id && it.language_id === langId);
              return {
                id: item.id,
                item_text: trans?.item_text || `Item ${item.correct_position}`,
                correct_position: item.correct_position,
                display_order: item.display_order,
              };
            }).sort((a: any, b: any) => a.correct_position - b.correct_position);
          }
        }
      }

      // Sort: English first, then by language name
      const sorted = Array.from(langMap.values()).sort((a, b) => {
        if (a.iso_code === 'en') return -1;
        if (b.iso_code === 'en') return 1;
        return a.language_name.localeCompare(b.language_name);
      });

      setTranslations(sorted);

      // Get meta from the question itself
      const metaFn = getMetaFn(questionType);
      const metaRes = await metaFn(questionId);
      if (metaRes.success && metaRes.data) {
        setMeta(metaRes.data);
      }
    } catch (e) {
      console.error('Failed to load question view:', e);
    } finally {
      setLoading(false);
    }
  }, [questionId, questionType]);

  useEffect(() => {
    if (open && questionId) fetchData();
  }, [open, questionId, fetchData]);

  const config = TYPE_CONFIG[questionType];
  const Icon = config.icon;
  const current = translations[activeLang];
  // English translation for fallback when non-English is missing hint/explanation
  const english = translations.find(t => t.iso_code === 'en');
  const isNonEnglish = current && current.iso_code !== 'en';

  // Resolve hint/explanation with fallback to English
  const currentHint = current?.hint || current?.hint_text || null;
  const currentExplanation = current?.explanation || current?.explanation_text || null;
  const englishHint = english?.hint || english?.hint_text || null;
  const englishExplanation = english?.explanation || english?.explanation_text || null;
  const displayHint = currentHint || (isNonEnglish ? englishHint : null);
  const displayExplanation = currentExplanation || (isNonEnglish ? englishExplanation : null);
  const hintIsFallback = !currentHint && isNonEnglish && !!englishHint;
  const explanationIsFallback = !currentExplanation && isNonEnglish && !!englishExplanation;

  return (
    <Dialog open={open} onClose={onClose} size="full">
      <div className="flex flex-col" style={{ maxHeight: 'calc(100vh - 8rem)' }}>
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center border', config.color)}>
              <Icon className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-display text-lg font-semibold text-slate-900">
                {questionCode || meta?.code || `Question #${questionId}`}
              </h2>
              <div className="flex items-center gap-2 mt-0.5">
                <Badge variant="default" className={cn('text-xs', config.color)}>{config.label}</Badge>
                {meta?.difficulty_level && (
                  <span className={cn('inline-flex text-xs font-semibold px-2 py-0.5 rounded-full', DIFF_COLORS[meta.difficulty_level] || 'bg-slate-50 text-slate-600')}>
                    {meta.difficulty_level.charAt(0).toUpperCase() + meta.difficulty_level.slice(1)}
                  </span>
                )}
                {meta?.points != null && (
                  <span className="text-xs text-slate-500">{meta.points} pts</span>
                )}
                {meta?.question_type && (
                  <span className="text-xs text-slate-400">{meta.question_type.replace(/_/g, ' ')}</span>
                )}
                {meta?.mcq_type && (
                  <span className="text-xs text-slate-400">{meta.mcq_type.replace(/_/g, ' ')}</span>
                )}
                {meta?.answer_type && (
                  <span className="text-xs text-slate-400">{meta.answer_type.replace(/_/g, ' ')}</span>
                )}
              </div>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-md hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {loading ? (
          <div className="p-8 space-y-4">
            <Skeleton className="h-6 w-3/4" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-1/2" />
          </div>
        ) : translations.length === 0 ? (
          <div className="p-12 text-center">
            <Languages className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500 text-sm">No translations found for this question.</p>
            <p className="text-slate-400 text-xs mt-1">Generate translations first using Auto Generate.</p>
          </div>
        ) : (
          <>
            {/* Language Tabs */}
            <div className="px-6 pt-3 pb-0 border-b border-slate-100 shrink-0 overflow-x-auto">
              <div className="flex gap-1">
                {translations.map((t, idx) => (
                  <button
                    key={t.language_id}
                    onClick={() => setActiveLang(idx)}
                    className={cn(
                      'px-4 py-2.5 text-sm font-medium rounded-t-lg transition-all whitespace-nowrap border-b-2 -mb-px',
                      idx === activeLang
                        ? 'text-brand-700 border-brand-500 bg-brand-50/50'
                        : 'text-slate-500 border-transparent hover:text-slate-700 hover:bg-slate-50'
                    )}
                  >
                    <span className="flex items-center gap-1.5">
                      {t.language_name}
                      {t.iso_code && <span className="text-xs text-slate-400">({t.iso_code})</span>}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {current && (
                <div className="space-y-6">
                  {/* Question Text */}
                  <div>
                    <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 mb-2">
                      <BookOpen className="w-3.5 h-3.5" /> Question
                    </label>
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                      {current.question_text
                        ? <MarkdownText text={current.question_text} className="text-base text-slate-900 leading-relaxed" />
                        : <p className="text-slate-300 italic">No translation available</p>
                      }
                    </div>
                  </div>

                  {/* Type-specific content */}
                  {questionType === 'mcq' && current.options && current.options.length > 0 && (
                    <div>
                      <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 mb-2">
                        <HelpCircle className="w-3.5 h-3.5" /> Options
                      </label>
                      <div className="space-y-2">
                        {current.options.map((opt, i) => (
                          <div
                            key={opt.id}
                            className={cn(
                              'flex items-start gap-3 p-3 rounded-lg border transition-colors',
                              opt.is_correct
                                ? 'bg-emerald-50 border-emerald-200'
                                : 'bg-white border-slate-200'
                            )}
                          >
                            <span className={cn(
                              'w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5',
                              opt.is_correct
                                ? 'bg-emerald-500 text-white'
                                : 'bg-slate-200 text-slate-600'
                            )}>
                              {String.fromCharCode(65 + i)}
                            </span>
                            <span className={cn('text-sm flex-1', opt.is_correct ? 'text-emerald-900 font-medium' : 'text-slate-700')}>
                              <MarkdownText text={opt.option_text} />
                            </span>
                            {opt.is_correct && <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {questionType === 'ow' && (
                    <div>
                      <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 mb-2">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Correct Answer
                      </label>
                      <div className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-50 border border-emerald-200">
                        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                        <span className="text-emerald-900 font-semibold">{current.correct_answer || '—'}</span>
                      </div>
                      {current.synonyms && current.synonyms.length > 0 && (
                        <div className="mt-3">
                          <label className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-1.5 block">Alternative Answers</label>
                          <div className="flex flex-wrap gap-2">
                            {current.synonyms.map(syn => (
                              <span key={syn.id} className="inline-flex items-center px-3 py-1.5 rounded-full text-sm bg-blue-50 text-blue-700 border border-blue-200">
                                {syn.synonym_text}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {questionType === 'desc' && current.answer_text && (
                    <div>
                      <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 mb-2">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Model Answer
                      </label>
                      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
                        <MarkdownText text={current.answer_text!} className="text-sm text-emerald-900 leading-relaxed" />
                      </div>
                    </div>
                  )}

                  {questionType === 'matching' && current.pairs && current.pairs.length > 0 && (
                    <div>
                      <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 mb-2">
                        <Link2 className="w-3.5 h-3.5" /> Matching Pairs
                      </label>
                      <div className="space-y-2">
                        {current.pairs.map((pair) => (
                          <div key={pair.id} className="flex items-center gap-3">
                            <div className="flex-1 bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-900">
                              <MarkdownText text={pair.left_text} />
                            </div>
                            <ArrowRight className="w-5 h-5 text-slate-400 shrink-0" />
                            <div className="flex-1 bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-900">
                              <MarkdownText text={pair.right_text} />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {questionType === 'ordering' && current.items && current.items.length > 0 && (
                    <div>
                      <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 mb-2">
                        <ListOrdered className="w-3.5 h-3.5" /> Correct Order
                      </label>
                      <div className="space-y-2">
                        {current.items.map((item) => (
                          <div key={item.id} className="flex items-center gap-3 bg-rose-50 border border-rose-200 rounded-lg p-3">
                            <span className="w-8 h-8 rounded-full bg-rose-500 text-white flex items-center justify-center text-sm font-bold shrink-0">
                              {item.correct_position}
                            </span>
                            <span className="text-sm text-rose-900"><MarkdownText text={item.item_text} /></span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Hint */}
                  {displayHint && (
                    <div>
                      <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 mb-2">
                        <Lightbulb className="w-3.5 h-3.5" /> Hint
                        {hintIsFallback && <span className="text-[10px] font-normal text-amber-500 ml-1">(English — not yet translated)</span>}
                      </label>
                      <div className={cn('rounded-xl p-4', hintIsFallback ? 'bg-amber-50/50 border border-dashed border-amber-300' : 'bg-amber-50 border border-amber-200')}>
                        <MarkdownText text={displayHint!} className={cn('text-sm leading-relaxed', hintIsFallback ? 'text-amber-600 italic' : 'text-amber-800')} />
                      </div>
                    </div>
                  )}

                  {/* Explanation */}
                  {displayExplanation && (
                    <div>
                      <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 mb-2">
                        <BookOpen className="w-3.5 h-3.5" /> Explanation
                        {explanationIsFallback && <span className="text-[10px] font-normal text-blue-500 ml-1">(English — not yet translated)</span>}
                      </label>
                      <div className={cn('rounded-xl p-4', explanationIsFallback ? 'bg-blue-50/50 border border-dashed border-blue-300' : 'bg-blue-50 border border-blue-200')}>
                        <MarkdownText text={displayExplanation!} className={cn('text-sm leading-relaxed', explanationIsFallback ? 'text-blue-600 italic' : 'text-blue-800')} />
                      </div>
                    </div>
                  )}

                  {/* Images (Desc type) */}
                  {questionType === 'desc' && (current.image_1 || current.image_2) && (
                    <div>
                      <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 block">Images</label>
                      <div className="flex gap-4">
                        {current.image_1 && (
                          <a href={current.image_1} target="_blank" rel="noopener noreferrer">
                            <img src={current.image_1} alt="Image 1" className="w-48 h-48 object-cover rounded-lg border border-slate-200" />
                          </a>
                        )}
                        {current.image_2 && (
                          <a href={current.image_2} target="_blank" rel="noopener noreferrer">
                            <img src={current.image_2} alt="Image 2" className="w-48 h-48 object-cover rounded-lg border border-slate-200" />
                          </a>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer with language nav */}
            <div className="px-6 py-3 border-t border-slate-100 flex items-center justify-between shrink-0 bg-slate-50/50">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setActiveLang(Math.max(0, activeLang - 1))}
                  disabled={activeLang === 0}
                  className="p-1.5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-xs text-slate-500">
                  {activeLang + 1} / {translations.length} languages
                </span>
                <button
                  onClick={() => setActiveLang(Math.min(translations.length - 1, activeLang + 1))}
                  disabled={activeLang === translations.length - 1}
                  className="p-1.5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
              <Button variant="outline" size="sm" onClick={onClose}>Close</Button>
            </div>
          </>
        )}
      </div>
    </Dialog>
  );
}

/* ─── Helpers ─── */
function getFkField(type: QuestionType): string {
  switch (type) {
    case 'mcq': return 'mcq_question_id';
    case 'ow': return 'one_word_question_id';
    case 'desc': return 'descriptive_question_id';
    case 'matching': return 'matching_question_id';
    case 'ordering': return 'ordering_question_id';
  }
}

function getTransListFn(type: QuestionType) {
  switch (type) {
    case 'mcq': return api.listMcqQuestionTranslations;
    case 'ow': return api.listOwQuestionTranslations;
    case 'desc': return api.listDescQuestionTranslations;
    case 'matching': return api.listMatchingQuestionTranslations;
    case 'ordering': return api.listOrderingQuestionTranslations;
  }
}

function getMetaFn(type: QuestionType) {
  switch (type) {
    case 'mcq': return api.getMcqQuestion;
    case 'ow': return api.getOwQuestion;
    case 'desc': return api.getDescQuestion;
    case 'matching': return api.getMatchingQuestion;
    case 'ordering': return api.getOrderingQuestion;
  }
}
